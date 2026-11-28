import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { publishClaimedDraft } from "../src/publication.js";
import { FileStateStore } from "../src/store/filesystem.js";
import type { DraftPayload } from "../src/security.js";

const payload: DraftPayload = {
  v: 1, kind: "image", id: "aabbccdd-1234-4234-8234-aabbccddeeff",
  instagramUserId: "123", expectedUsername: "test", mediaUrl: "https://example.com/test.jpg",
  caption: "synthetic", createdAt: "2026-11-27T00:00:00.000Z", expiresAt: "2026-11-28T00:00:00.000Z"
};
for (const scenario of ["timeout", "invalid-receipt", "receipt-write", "success"] as const) {
  test("claimed publication: " + scenario, async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "social-publish-"));
    try {
      const store = new FileStateStore(dir);
      await store.saveDraft(payload);
      const claim = await store.claimPublication(payload);
      let calls = 0;
      if (scenario === "receipt-write") store.completePublicationClaim = async () => { throw new Error("disk failure"); };
      const invoke = () => publishClaimedDraft(store, payload, claim.digest, async input => {
        calls++;
        assert.equal(input.caption, payload.caption);
        if (scenario === "timeout") throw new Error("network timeout after POST");
        return { containerId: "c", mediaId: scenario === "invalid-receipt" ? "" : "m" };
      });
      if (scenario === "success") assert.deepEqual(await invoke(), {containerId:"c",mediaId:"m"});
      else await assert.rejects(invoke);
      assert.equal(calls, 1);
      await assert.rejects(() => store.claimPublication(payload), /replay blocked/);
    } finally { await fs.rm(dir, { recursive: true, force: true }); }
  });
}

test("claim blocks replay when another claimant completes between check and exclusive write", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "social-claim-race-"));
  try {
    const delayed = new FileStateStore(dir);
    const winner = new FileStateStore(dir);
    await delayed.assertReady();
    const internal = delayed as unknown as { assertNotPublished(digest: string): Promise<void> };
    const original = internal.assertNotPublished.bind(delayed);
    let signalChecked!: () => void;
    let resume!: () => void;
    const checked = new Promise<void>(resolve => { signalChecked = resolve; });
    const resumeGate = new Promise<void>(resolve => { resume = resolve; });
    let first = true;
    internal.assertNotPublished = async digest => {
      await original(digest);
      if (first) {
        first = false;
        signalChecked();
        await resumeGate;
      }
    };
    const attempt = delayed.claimPublication(payload);
    const rejected = assert.rejects(attempt, /replay blocked/);
    try {
      await checked;
      const claim = await winner.claimPublication(payload);
      await winner.completePublicationClaim(claim.digest, { containerId: "c", mediaId: "m" });
    } finally { resume(); }
    await rejected;
    await assert.rejects(() => winner.claimPublication(payload), /replay blocked/);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});
