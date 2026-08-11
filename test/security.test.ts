import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "andrew-social-test-"));
process.env.INSTAGRAM_API_VERSION = "v26.0";
process.env.INSTAGRAM_USER_ID = "123";
process.env.INSTAGRAM_EXPECTED_USERNAME = "andrewvoxai";
process.env.INSTAGRAM_ACCESS_TOKEN = "x".repeat(40);
process.env.PUBLIC_BASE_URL = "http://localhost:3000";
process.env.APPROVAL_HMAC_SECRET = "h".repeat(64);
process.env.APPROVER_USERNAME = "captain";
process.env.APPROVER_PASSWORD = "p".repeat(32);
process.env.APPROVAL_STATE_DIR = stateDir;
process.env.NODE_ENV = "test";

const sec = await import("../src/security.js");
const store = await import("../src/store.js");

test("draft approval signatures bind exact content", () => {
  const draft = sec.newDraftPayload({
    instagramUserId: "123",
    expectedUsername: "andrewvoxai",
    mediaUrl: "https://example.com/image.jpg",
    caption: "hello",
    ttlMinutes: 30,
  });
  const sig = sec.createApprovalSignature(draft);
  assert.doesNotThrow(() => sec.verifyApprovalSignature(draft, sig));
  assert.throws(() => sec.verifyApprovalSignature({ ...draft, caption: "changed" }, sig));
});

test("private and local image URLs are rejected", () => {
  assert.equal(sec.isPublicHttpsUrl("http://example.com/a.jpg"), false);
  assert.equal(sec.isPublicHttpsUrl("https://localhost/a.jpg"), false);
  assert.equal(sec.isPublicHttpsUrl("https://127.0.0.1/a.jpg"), false);
  assert.equal(sec.isPublicHttpsUrl("https://192.168.1.3/a.jpg"), false);
  assert.equal(sec.isPublicHttpsUrl("https://example.com/a.jpg"), true);
});

test("exact draft can only be claimed once until released", async () => {
  const draft = sec.newDraftPayload({
    instagramUserId: "123",
    expectedUsername: "andrewvoxai",
    mediaUrl: "https://example.com/image2.jpg",
    caption: "once",
  });
  await store.saveDraft(draft);
  const loaded = await store.loadDraft(draft.id);
  assert.equal(sec.canonicalDraftDigest(loaded), sec.canonicalDraftDigest(draft));
  const claim = await store.claimPublication(draft);
  await assert.rejects(() => store.claimPublication(draft), /replay blocked/);
  await store.releasePublicationClaim(claim.claimPath);
});
