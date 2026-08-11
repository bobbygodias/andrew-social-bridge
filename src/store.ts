import { promises as fs } from "node:fs";
import path from "node:path";
import { getConfig } from "./config.js";
import { canonicalDraftDigest, isValidDraftId, type DraftPayload } from "./security.js";

function dirs() {
  const root = path.resolve(getConfig().APPROVAL_STATE_DIR);
  return {
    root,
    drafts: path.join(root, "drafts"),
    claims: path.join(root, "claims"),
  };
}

async function ensureDirs(): Promise<void> {
  const d = dirs();
  await fs.mkdir(d.drafts, { recursive: true, mode: 0o700 });
  await fs.mkdir(d.claims, { recursive: true, mode: 0o700 });
}

export async function saveDraft(payload: DraftPayload): Promise<void> {
  await ensureDirs();
  if (!isValidDraftId(payload.id)) throw new Error("Invalid draft id");
  const file = path.join(dirs().drafts, `${payload.id}.json`);
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

export async function loadDraft(id: string): Promise<DraftPayload> {
  await ensureDirs();
  if (!isValidDraftId(id)) throw new Error("Invalid draft id");
  const file = path.join(dirs().drafts, `${id}.json`);
  const raw = await fs.readFile(file, "utf8");
  const payload = JSON.parse(raw) as DraftPayload;
  if (payload.id !== id || payload.v !== 1 || payload.kind !== "image") throw new Error("Corrupt draft record");
  return payload;
}

export async function claimPublication(payload: DraftPayload): Promise<{ digest: string; claimPath: string }> {
  await ensureDirs();
  const digest = canonicalDraftDigest(payload);
  const claimPath = path.join(dirs().claims, `${digest}.claim`);
  try {
    await fs.writeFile(claimPath, `${new Date().toISOString()}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EEXIST") throw new Error("This exact draft was already claimed for publication; replay blocked");
    throw error;
  }
  return { digest, claimPath };
}

export async function releasePublicationClaim(claimPath: string): Promise<void> {
  await fs.rm(claimPath, { force: true });
}

export async function completePublicationClaim(claimPath: string, result: { mediaId: string; containerId: string }): Promise<void> {
  const finalPath = claimPath.replace(/\.claim$/, ".published.json");
  await fs.writeFile(finalPath, `${JSON.stringify({ ...result, publishedAt: new Date().toISOString() }, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  await fs.rm(claimPath, { force: true });
}
