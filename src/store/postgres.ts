import { Pool } from "pg";
import { canonicalDraftDigest, isValidDraftId, type DraftPayload } from "../security.js";
import type { PublicationClaim, PublicationResult, StateStore } from "./types.js";

export type PostgresStateStoreOptions = {
  poolMax?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
};

type DraftRow = {
  digest: string;
  payload: DraftPayload;
};

function pgErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "") || undefined
    : undefined;
}

export class PostgresStateStore implements StateStore {
  private readonly pool: Pool;

  constructor(connectionString: string, options: PostgresStateStoreOptions = {}) {
    if (!/^postgres(?:ql)?:\/\//.test(connectionString)) {
      throw new Error("PostgresStateStore requires a PostgreSQL connection string");
    }

    this.pool = new Pool({
      connectionString,
      max: options.poolMax ?? 4,
      connectionTimeoutMillis: options.connectionTimeoutMillis ?? 10_000,
      idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
      allowExitOnIdle: true,
    });

    this.pool.on("error", (error) => {
      console.error("Unexpected PostgreSQL pool error", error.message);
    });
  }

  async assertReady(): Promise<void> {
    const result = await this.pool.query<{
      drafts_table: string | null;
      ledger_table: string | null;
    }>(`
      SELECT
        to_regclass('andrew_social.drafts')::text AS drafts_table,
        to_regclass('andrew_social.publication_ledger')::text AS ledger_table
    `);

    const row = result.rows[0];
    if (!row?.drafts_table || !row.ledger_table) {
      throw new Error("PostgreSQL state schema is not initialized; run npm run migrate first");
    }
  }

  async saveDraft(payload: DraftPayload): Promise<void> {
    if (!isValidDraftId(payload.id)) throw new Error("Invalid draft id");
    const digest = canonicalDraftDigest(payload);

    try {
      await this.pool.query(
        `INSERT INTO andrew_social.drafts
          (id, digest, payload, created_at, expires_at)
         VALUES ($1::uuid, $2, $3::jsonb, $4::timestamptz, $5::timestamptz)`,
        [payload.id, digest, JSON.stringify(payload), payload.createdAt, payload.expiresAt],
      );
    } catch (error) {
      if (pgErrorCode(error) === "23505") throw new Error("Draft already exists; immutable insert rejected");
      throw error;
    }
  }

  async loadDraft(id: string): Promise<DraftPayload> {
    if (!isValidDraftId(id)) throw new Error("Invalid draft id");

    const result = await this.pool.query<DraftRow>(
      `SELECT digest, payload
         FROM andrew_social.drafts
        WHERE id = $1::uuid`,
      [id],
    );

    if (result.rowCount !== 1) throw new Error("Draft not found");
    const row = result.rows[0];
    const payload = row.payload;

    if (!payload || payload.id !== id || payload.v !== 1 || payload.kind !== "image") {
      throw new Error("Corrupt draft record");
    }
    if (canonicalDraftDigest(payload) !== row.digest) {
      throw new Error("Draft digest mismatch; stored payload failed integrity check");
    }

    return payload;
  }

  async claimPublication(payload: DraftPayload): Promise<PublicationClaim> {
    const digest = canonicalDraftDigest(payload);

    try {
      await this.pool.query(
        `INSERT INTO andrew_social.publication_ledger
          (digest, draft_id, status, claimed_at)
         VALUES ($1, $2::uuid, 'claimed', now())`,
        [digest, payload.id],
      );
    } catch (error) {
      const code = pgErrorCode(error);
      if (code === "23505") {
        throw new Error("This exact draft was already claimed or published; replay blocked");
      }
      if (code === "23503") {
        throw new Error("Draft must be stored before it can be claimed for publication");
      }
      throw error;
    }

    return { digest };
  }

  async releasePublicationClaim(digest: string): Promise<void> {
    if (!/^[0-9a-f]{64}$/i.test(digest)) throw new Error("Invalid publication digest");
    await this.pool.query(
      `DELETE FROM andrew_social.publication_ledger
        WHERE digest = $1
          AND status = 'claimed'`,
      [digest],
    );
  }

  async completePublicationClaim(digest: string, result: PublicationResult): Promise<void> {
    if (!/^[0-9a-f]{64}$/i.test(digest)) throw new Error("Invalid publication digest");

    const update = await this.pool.query(
      `UPDATE andrew_social.publication_ledger
          SET status = 'published',
              container_id = $2,
              media_id = $3,
              published_at = now()
        WHERE digest = $1
          AND status = 'claimed'`,
      [digest, result.containerId, result.mediaId],
    );

    if (update.rowCount !== 1) {
      throw new Error("Publication claim is missing or already completed; replay blocked");
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
