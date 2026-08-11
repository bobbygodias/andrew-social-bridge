import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { newDraftPayload, canonicalDraftDigest } from "../src/security.js";
import { PostgresStateStore } from "../src/store/postgres.js";

const databaseUrl = process.env.TEST_DATABASE_URL;

test("PostgreSQL store preserves immutable drafts and permanent replay protection", { skip: !databaseUrl }, async () => {
  if (!databaseUrl) return;

  const store = new PostgresStateStore(databaseUrl, { poolMax: 2 });
  try {
    await store.assertReady();

    const draft = newDraftPayload({
      instagramUserId: "123",
      expectedUsername: "andrewvoxai",
      mediaUrl: "https://example.com/postgres-store.jpg",
      caption: `postgres-${randomUUID()}`,
      ttlMinutes: 30,
    });

    await store.saveDraft(draft);
    await assert.rejects(() => store.saveDraft(draft), /immutable insert rejected/);

    const loaded = await store.loadDraft(draft.id);
    assert.equal(canonicalDraftDigest(loaded), canonicalDraftDigest(draft));

    const firstClaim = await store.claimPublication(draft);
    assert.equal(firstClaim.digest, canonicalDraftDigest(draft));
    await assert.rejects(() => store.claimPublication(draft), /replay blocked/);

    await store.releasePublicationClaim(firstClaim.digest);
    const retryClaim = await store.claimPublication(draft);
    assert.equal(retryClaim.digest, firstClaim.digest);

    await store.completePublicationClaim(retryClaim.digest, {
      containerId: "container-test-1",
      mediaId: "media-test-1",
    });

    await assert.rejects(() => store.claimPublication(draft), /replay blocked/);
    await assert.rejects(
      () => store.completePublicationClaim(retryClaim.digest, { containerId: "container-test-2", mediaId: "media-test-2" }),
      /already completed|replay blocked/,
    );

    // Release is intentionally unable to erase a completed publication receipt.
    await store.releasePublicationClaim(retryClaim.digest);
    await assert.rejects(() => store.claimPublication(draft), /replay blocked/);
  } finally {
    await store.close();
  }
});
