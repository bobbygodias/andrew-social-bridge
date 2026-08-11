import { getConfig } from "./config.js";
import { FileStateStore } from "./store/filesystem.js";
import type { StateStore } from "./store/types.js";

let cached: StateStore | undefined;

export function getStateStore(): StateStore {
  if (cached) return cached;
  const config = getConfig();
  cached = new FileStateStore(config.APPROVAL_STATE_DIR);
  return cached;
}

export { FileStateStore } from "./store/filesystem.js";
export type { PublicationClaim, PublicationResult, StateStore } from "./store/types.js";
