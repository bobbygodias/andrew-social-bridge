import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

process.env.INSTAGRAM_API_VERSION = "v26.0";
process.env.INSTAGRAM_USER_ID = "123";
process.env.INSTAGRAM_EXPECTED_USERNAME = "andrewvoxai";
process.env.INSTAGRAM_ACCESS_TOKEN = "x".repeat(40);
process.env.PUBLIC_BASE_URL = "http://localhost:3000";
process.env.APPROVAL_HMAC_SECRET = "h".repeat(64);
process.env.APPROVER_USERNAME = "captain";
process.env.APPROVER_PASSWORD = "p".repeat(32);
process.env.APPROVAL_STATE_DIR = ".state-test-unused";
process.env.NODE_ENV = "test";

const sec = await import("../src/security.js");
const { FileStateStore } = await import("../src/store.js");

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

test("image URL policy rejects literal IPs, local hosts, and embedded credentials", () => {
  const rejected = [
    "http://example.com/a.jpg",
    "https://localhost/a.jpg",
    "https://localhost./a.jpg",
    "https://test.localhost/a.jpg",
    "https://printer.local/a.jpg",
    "https://service.internal/a.jpg",
    "https://127.0.0.1/a.jpg",
    "https://127.1/a.jpg",
    "https://192.168.1.3/a.jpg",
    "https://8.8.8.8/a.jpg",
    "https://[::1]/a.jpg",
    "https://[fe80::1]/a.jpg",
    "https://[fc00::1]/a.jpg",
    "https://[::ffff:127.0.0.1]/a.jpg",
    "https://user:secret@example.com/a.jpg",
  ];
  for (const url of rejected) {
    assert.equal(sec.isPublicHttpsUrl(url), false, `accepted: ${url}`);
  }

  for (const url of [
    "https://example.com/a.jpg",
    "https://cdn.example.com:443/a.jpg",
  ]) {
    assert.equal(sec.isPublicHttpsUrl(url), true, `rejected: ${url}`);
  }
});

test("filesystem store preserves immutable drafts and atomic replay claims", async () => {
  const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), "andrew-social-test-"));
  const store = new FileStateStore(stateDir);
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
  await store.releasePublicationClaim(claim.digest);

  const secondClaim = await store.claimPublication(draft);
  await store.completePublicationClaim(secondClaim.digest, { mediaId: "media-1", containerId: "container-1" });
  await assert.rejects(() => store.claimPublication(draft), /replay blocked/);
});
