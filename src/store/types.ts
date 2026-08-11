import type { DraftPayload } from "../security.js";

export type PublicationResult = {
  mediaId: string;
  containerId: string;
};

export type PublicationClaim = {
  digest: string;
};

export interface StateStore {
  assertReady(): Promise<void>;
  saveDraft(payload: DraftPayload): Promise<void>;
  loadDraft(id: string): Promise<DraftPayload>;
  claimPublication(payload: DraftPayload): Promise<PublicationClaim>;
  releasePublicationClaim(digest: string): Promise<void>;
  completePublicationClaim(digest: string, result: PublicationResult): Promise<void>;
}
