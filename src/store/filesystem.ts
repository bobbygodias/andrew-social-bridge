import { promises as fs } from "node:fs";
import path from "node:path";
import { canonicalDraftDigest, isValidDraftId, type DraftPayload } from "../security.js";
import type { PublicationClaim, PublicationResult, StateStore } from "./types.js";

export class FileStateStore implements StateStore {
  private readonly root: string;

  constructor(root: string) {
    if (!root.trim()) throw new Error("FileStateStore requires a non-empty root path");
    this.root = path.resolve(root);
  }

  private dirs() {
    return {
      root: this.root,
      drafts: path.join(this.root, "drafts"),
      claims: path.join(this.root, "claims"),
    };
  }

  private async ensureDirs(): Promise<void> {
    const d = this.dirs();
    await fs.mkdir(d.drafts, { recursive: true, mode: 0o700 });
    await fs.mkdir(d.claims, { recursive: true, mode: 0o700 });
  }

  private claimPath(digest: string): string {
    if (!/^[0-9a-f]{64}$/i.test(digest)) throw new Error("Invalid publication digest");
    return path.join(this.dirs().claims, `${digest}.claim`);
  }

  private publishedPath(digest: string): string {
    return this.claimPath(digest).replace(/\.claim$/, ".published.json");
  }

  private async assertNotPublished(digest: string): Promise<void> {
    try {
      await fs.access(this.publishedPath(digest));
      throw new Error("This exact draft was already published; replay blocked");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return;
      throw error;
    }
  }

  async assertReady(): Promise<void> {
    await this.ensureDirs();
  }

  async saveDraft(payload: DraftPayload): Promise<void> {
    await this.ensureDirs();
    if (!isValidDraftId(payload.id)) throw new Error("Invalid draft id");
    const file = path.join(this.dirs().drafts, `${payload.id}.json`);
    await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
  }

  async loadDraft(id: string): Promise<DraftPayload> {
    await this.ensureDirs();
    if (!isValidDraftId(id)) throw new Error("Invalid draft id");
    const file = path.join(this.dirs().drafts, `${id}.json`);
    const raw = await fs.readFile(file, "utf8");
    const payload = JSON.parse(raw) as DraftPayload;
    if (payload.id !== id || payload.v !== 1 || payload.kind !== "image") throw new Error("Corrupt draft record");
    return payload;
  }

  async claimPublication(payload: DraftPayload): Promise<PublicationClaim> {
    await this.ensureDirs();
    const digest = canonicalDraftDigest(payload);
    await this.assertNotPublished(digest);
    const claimPath = this.claimPath(digest);
    try {
      await fs.writeFile(claimPath, `${new Date().toISOString()}\n`, { encoding: "utf8", mode: 0o600, flag: "wx" });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST") throw new Error("This exact draft was already claimed for publication; replay blocked");
      throw error;
    }
    return { digest };
  }

  async releasePublicationClaim(digest: string): Promise<void> {
    await fs.rm(this.claimPath(digest), { force: true });
  }

  async completePublicationClaim(digest: string, result: PublicationResult): Promise<void> {
    const claimPath = this.claimPath(digest);
    const finalPath = this.publishedPath(digest);
    try {
      await fs.writeFile(finalPath, `${JSON.stringify({ ...result, publishedAt: new Date().toISOString() }, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
        flag: "wx",
      });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EEXIST") throw new Error("Publication receipt already exists; replay blocked");
      throw error;
    }
    await fs.rm(claimPath, { force: true });
  }
}
