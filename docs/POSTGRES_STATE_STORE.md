# PostgreSQL State Store

The bridge can persist approval state in PostgreSQL without changing the MCP or human-approval surface.

## Runtime configuration

```text
STATE_STORE_BACKEND=postgres
DATABASE_URL=postgresql://...
DATABASE_POOL_MAX=4
```

`DATABASE_URL` is a secret. Keep it in the deployment secret manager; never commit it, paste it into issues, or include it in screenshots.

The runtime adapter uses a small `pg` connection pool and fully schema-qualified SQL. It does not rely on session-level `SET search_path` state.

## Migrations

Apply migrations before starting the bridge:

```bash
DATABASE_DIRECT_URL='postgresql://...' npm run migrate
```

If `DATABASE_DIRECT_URL` is absent, the migration runner falls back to `DATABASE_URL`.

For providers that place PgBouncer or another transaction pooler in front of PostgreSQL, prefer a direct/unpooled connection for schema migrations and a pooled connection for normal application traffic.

The migration runner:

1. creates the `andrew_social` schema if needed;
2. records applied files in `andrew_social.schema_migrations`;
3. applies each new `migrations/*.sql` file inside a transaction;
4. never prints a database connection string.

## Tables

### `andrew_social.drafts`

Insert-only approval drafts keyed by UUID, with the canonical SHA-256 digest stored alongside the JSON payload.

### `andrew_social.publication_ledger`

A durable replay ledger keyed by draft digest.

- `claimed` means a human-approved publication is in progress or requires inspection.
- `published` means the external write completed and its media/container receipt was persisted.

A published digest cannot be claimed again.

## Failure posture

The bridge releases a claim only when the Instagram publishing operation itself throws before a successful result is returned. Once an external publication result exists, a later persistence failure leaves the claim in place for manual inspection rather than making an automatic retry possible.

This deliberately prefers a blocked/inspectable state over a silent duplicate public post.
