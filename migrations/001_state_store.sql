CREATE SCHEMA IF NOT EXISTS andrew_social;

CREATE TABLE IF NOT EXISTS andrew_social.drafts (
  id uuid PRIMARY KEY,
  digest text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT drafts_digest_format CHECK (digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT drafts_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT drafts_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT drafts_id_digest_unique UNIQUE (id, digest)
);

CREATE TABLE IF NOT EXISTS andrew_social.publication_ledger (
  digest text PRIMARY KEY,
  draft_id uuid NOT NULL,
  status text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  container_id text,
  media_id text,
  CONSTRAINT publication_digest_format CHECK (digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT publication_status CHECK (status IN ('claimed', 'published')),
  CONSTRAINT publication_draft_identity
    FOREIGN KEY (draft_id, digest)
    REFERENCES andrew_social.drafts (id, digest)
    ON DELETE RESTRICT,
  CONSTRAINT publication_state_consistency CHECK (
    (status = 'claimed' AND published_at IS NULL AND container_id IS NULL AND media_id IS NULL)
    OR
    (status = 'published' AND published_at IS NOT NULL AND container_id IS NOT NULL AND media_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS publication_ledger_status_idx
  ON andrew_social.publication_ledger (status, claimed_at);
