import { getConfig } from "./config.js";
import { FileStateStore } from "./store/filesystem.js";
import { PostgresStateStore } from "./store/postgres.js";
import type { StateStore } from "./store/types.js";

let cached: StateStore | undefined;

export function getStateStore(): StateStore {
  if (cached) return cached;
  const config = getConfig();

  if (config.STATE_STORE_BACKEND === "postgres") {
    if (!config.DATABASE_URL) throw new Error("DATABASE_URL is required for the PostgreSQL state store");
    cached = new PostgresStateStore(config.DATABASE_URL, { poolMax: config.DATABASE_POOL_MAX });
    return cached;
  }

  cached = new FileStateStore(config.APPROVAL_STATE_DIR);
  return cached;
}

export { FileStateStore } from "./store/filesystem.js";
export { PostgresStateStore } from "./store/postgres.js";
export type { PublicationClaim, PublicationResult, StateStore } from "./store/types.js";
