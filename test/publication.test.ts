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
