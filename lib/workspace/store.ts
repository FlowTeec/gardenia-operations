import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { countActiveAdminCredentials, provisionInitialAdmin } from "./accounts";
import { blobEnabled, readRemote, StoreConflict, writeRemote } from "./blob-store";
import { normalizeWorkspace } from "./rules";
import { createSeed } from "./seed";
import type { Mutation, Workspace } from "./types";

type Snapshot = {
  workspace: Workspace;
  etag: string | null;
  revision: number;
};

function dataFile() {
  if (process.env.MRS_DATA_FILE) return process.env.MRS_DATA_FILE;
  // Vercel serverless disks are read-only except /tmp. The demonstration
  // file stays under data/ on a normal machine.
  if (process.env.VERCEL) {
    return path.join("/tmp", "material-request-store", "workspace-demo.json");
  }
  return path.join(process.cwd(), "data", "workspace-demo.json");
}

let memory: Workspace | null = null;
let queue: Promise<void> = Promise.resolve();

async function finalize(state: Workspace): Promise<Workspace> {
  return provisionInitialAdmin(normalizeWorkspace(state));
}

async function readFileSnapshot(): Promise<Snapshot> {
  if (memory) return { workspace: structuredClone(memory), etag: null, revision: 0 };
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ dataFile(), "utf8");
    const parsed = JSON.parse(raw) as Workspace;
    if (
      !parsed ||
      !Array.isArray(parsed.materials) ||
      !Array.isArray(parsed.requests) ||
      !Array.isArray(parsed.users)
    ) {
      throw new Error("The demonstration file is unreadable.");
    }
    const ready = await finalize(parsed);
    memory = ready;
    if (countActiveAdminCredentials(ready) > countActiveAdminCredentials(parsed)) {
      await persist(ready, null, 0);
    }
    return { workspace: structuredClone(memory), etag: null, revision: 0 };
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    if (code === "ENOENT") {
      memory = await finalize(createSeed());
      await persist(memory, null, 0);
      return { workspace: structuredClone(memory), etag: null, revision: 0 };
    }
    if (error instanceof SyntaxError) throw new Error("The demonstration file is unreadable.");
    throw error;
  }
}

async function readSnapshot(): Promise<Snapshot> {
  if (!blobEnabled()) return readFileSnapshot();
  const remote = await readRemote();
  if (!remote) {
    const seeded = await finalize(createSeed());
    try {
      const etag = await writeRemote(seeded, null, 1);
      return { workspace: seeded, etag, revision: 1 };
    } catch (error) {
      if (!(error instanceof StoreConflict)) throw error;
      const again = await readRemote();
      if (!again) throw new Error("The account could not be saved. Try again.");
      const ready = await finalize(again.workspace);
      return { workspace: ready, etag: again.etag, revision: again.revision };
    }
  }
  const ready = await finalize(remote.workspace);
  if (countActiveAdminCredentials(ready) > countActiveAdminCredentials(remote.workspace)) {
    const etag = await writeRemote(ready, remote.etag, remote.revision + 1);
    return { workspace: ready, etag, revision: remote.revision + 1 };
  }
  return { workspace: ready, etag: remote.etag, revision: remote.revision };
}

async function persist(state: Workspace, etag: string | null, revision: number) {
  const next = await finalize(state);
  if (blobEnabled()) {
    await writeRemote(next, etag, revision + 1);
    return next;
  }
  const file = dataFile();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ file, JSON.stringify(next));
  memory = next;
  return next;
}

export function readWorkspace() {
  const run = queue.then(async () => structuredClone((await readSnapshot()).workspace));
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function updateWorkspace<T>(fn: (state: Workspace) => Mutation<T>) {
  const run = queue.then(async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const current = await readSnapshot();
      const result = fn(structuredClone(current.workspace));
      if (!result.ok || result.replayed) return result;
      try {
        await persist(result.state, current.etag, current.revision);
        return result;
      } catch (error) {
        if (error instanceof StoreConflict && attempt < 4) continue;
        throw error;
      }
    }
    throw new StoreConflict();
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function resetWorkspace() {
  const run = queue.then(async () => {
    memory = null;
    const current = blobEnabled() ? await readRemote() : null;
    return structuredClone(await persist(createSeed(), current?.etag ?? null, current?.revision ?? 0));
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
