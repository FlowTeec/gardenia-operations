import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { normalizeWorkspace } from "./normalize";
import { createGardeniaSeed } from "./seed";
import type { GardeniaWorkspace } from "./types";

type Mutation<T> = (state: GardeniaWorkspace) => T;

function dataFile(): string {
  if (process.env.GARDENIA_DATA_FILE) return process.env.GARDENIA_DATA_FILE;
  if (process.env.VERCEL) {
    return path.join("/tmp", "gardenia", "workspace.json");
  }
  return path.join(process.cwd(), "data", "gardenia.json");
}

let memory: GardeniaWorkspace | null = null;
let loadedMtime = 0;
let queue: Promise<void> = Promise.resolve();

async function fileMtime(file: string): Promise<number> {
  try {
    return (await stat(file)).mtimeMs;
  } catch {
    return 0;
  }
}

async function persist(state: GardeniaWorkspace): Promise<void> {
  const file = dataFile();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(state, null, 2), "utf8");
  memory = state;
  loadedMtime = await fileMtime(file);
}

async function readSnapshot(): Promise<GardeniaWorkspace> {
  const file = dataFile();
  const mtime = await fileMtime(file);
  // Reload when the file is replaced outside this process (re-seed, another worker).
  if (memory && mtime > 0 && mtime === loadedMtime) return structuredClone(memory);
  try {
    const raw = await readFile(/*turbopackIgnore: true*/ file, "utf8");
    const parsed = JSON.parse(raw) as GardeniaWorkspace;
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.products)) {
      throw new Error("Invalid workspace data");
    }
    const { changed } = normalizeWorkspace(parsed);
    if (changed) {
      await persist(parsed);
      return structuredClone(parsed);
    }
    memory = parsed;
    loadedMtime = mtime;
    return structuredClone(memory);
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    if (code === "ENOENT") {
      memory = await createGardeniaSeed();
      await persist(memory);
      return structuredClone(memory);
    }
    throw error;
  }
}

export async function readWorkspace(): Promise<GardeniaWorkspace> {
  return readSnapshot();
}

export async function updateWorkspace<T>(
  mutation: Mutation<T>
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    queue = queue.then(async () => {
      try {
        const state = await readSnapshot();
        const value = mutation(state);
        const failed =
          value !== null &&
          typeof value === "object" &&
          "error" in value &&
          Boolean((value as { error?: unknown }).error);
        if (failed) {
          // Discard the mutated copy so a validation failure cannot write partial changes.
          resolve({ ok: true, value });
          return;
        }
        await persist(state);
        resolve({ ok: true, value });
      } catch (err) {
        resolve({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    });
  });
}
