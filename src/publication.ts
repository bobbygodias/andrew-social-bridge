import type { DraftPayload } from "./security.js";
import type { StateStore } from "./store.js";

type Receipt = { containerId: string; mediaId: string };
type Publisher = (input: { imageUrl: string; caption: string }) => Promise<Receipt>;

// A remote failure can occur after the provider commits publication. Preserve
// the existing atomic claim on ANY ambiguous remote or receipt failure.
// Only explicit, out-of-band reconciliation may release such a claim.
export async function publishClaimedDraft(
  store: StateStore, payload: DraftPayload, digest: string, publish: Publisher,
): Promise<Receipt> {
  const receipt = await publish({ imageUrl: payload.mediaUrl, caption: payload.caption });
  if (!receipt.containerId || !receipt.mediaId) throw new Error("Incomplete publication receipt");
  await store.completePublicationClaim(digest, receipt);
  return receipt;
}
