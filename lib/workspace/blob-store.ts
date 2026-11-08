import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from "@vercel/blob";

import type { Workspace } from "./types";

const PATH = "material-request-store/workspace.json";

export class StoreConflict extends Error {
  constructor() {
    super("The change could not be saved because another save finished at the same time. Try again.");
  }
}

export type RemoteSnapshot = {
  workspace: Workspace;
  etag: string;
  revision: number;
};

function isWorkspace(value: unknown): value is Workspace {
  if (!value || typeof value !== "object") return false;
  const record = value as Workspace;
  return Array.isArray(record.materials) && Array.isArray(record.requests) && Array.isArray(record.users);
}

function unwrap(parsed: unknown): { workspace: Workspace; revision: number } | null {
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as { revision?: unknown; workspace?: unknown };
  if (isWorkspace(record.workspace)) {
    return {
      workspace: record.workspace,
      revision: typeof record.revision === "number" && record.revision >= 0 ? record.revision : 0,
    };
  }
  if (isWorkspace(parsed)) return { workspace: parsed, revision: 0 };
  return null;
}

export function blobEnabled() {
  return process.env.VERCEL_ENV === "production" && Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export async function readRemote(): Promise<RemoteSnapshot | null> {
  let meta;
  try {
    meta = await head(PATH);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw new Error("The account store could not be read. Try again.");
  }
  let result;
  try {
    result = await get(PATH, { access: "private", useCache: false });
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw new Error("The account store could not be read. Try again.");
  }
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const raw = await new Response(result.stream).text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("The account store is unreadable.");
  }
  const body = unwrap(parsed);
  if (!body) throw new Error("The account store is unreadable.");
  // The file download ETag is not accepted by a conditional overwrite.
  // head() returns the store ETag that ifMatch compares.
  return { workspace: body.workspace, revision: body.revision, etag: meta.etag };
}

export async function writeRemote(workspace: Workspace, etag: string | null, revision: number) {
  const body = JSON.stringify({ revision, workspace });
  try {
    const saved = await put(PATH, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: Boolean(etag),
      contentType: "application/json",
      cacheControlMaxAge: 60,
      ...(etag ? { ifMatch: etag } : {}),
    });
    return saved.etag;
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) throw new StoreConflict();
    const message = error instanceof Error ? error.message : "";
    if (/already exists|precondition|condition failed/i.test(message)) throw new StoreConflict();
    throw new Error("The account could not be saved. Try again.");
  }
}
