# Architecture — Andrew Social Bridge

```text
ChatGPT / Andrew Vox
        |
        | MCP (read + prepare only)
        v
+---------------------------------+
| Andrew Social Bridge            |
|                                 |
| profile/read ------> Meta API   |
| recent/read -------> Meta API   |
| prepare -----------> StateStore |
+--------------+------------------+
               |
               | host-agnostic contract
               v
       +-----------------------+
       | Storage adapter       |
       |                       |
       | FileStateStore        |
       | PostgresStateStore    |
       +-----------+-----------+
                   |
                   | immutable draft + durable claim/receipt
                   v
          Human-only review page
          separate authentication
          exact image + caption + hash
                   |
                   | explicit click + action token
                   v
            atomic replay claim
                   |
                   v
         identity re-verification
                   |
                   v
        POST /{ig-user-id}/media
                   |
                   v
    POST /{ig-user-id}/media_publish
                   |
                   v
           publication receipt
```

## Design law

**The model may prepare; only the human gate may publish.**

No prompt, Skill instruction, or MCP tool can bypass this because the external write route is absent from the MCP tool surface.

## Storage boundary

Approval state is accessed only through the `StateStore` contract. The MCP and approval flow do not depend on filesystem paths, PostgreSQL, or any hosting provider.

`FileStateStore` is suitable for local development or a single service with genuinely persistent disk. `PostgresStateStore` implements the same contract for environments where local disk is ephemeral or multiple service instances need shared state.

Both adapters preserve the same invariants:

- drafts are insert-only;
- the canonical SHA-256 digest identifies the exact approved content;
- only one active publication claim may exist for a digest;
- a released pre-publication claim may be retried;
- a completed publication receipt permanently blocks replay;
- storage failure after an external publication must not automatically release the claim.

## PostgreSQL model

PostgreSQL state lives in the explicit `andrew_social` schema. Runtime queries are fully schema-qualified and do not depend on session-level `search_path` state.

`andrew_social.drafts` stores the immutable draft payload and its canonical digest. `andrew_social.publication_ledger` is a durable state machine keyed by that digest: a row begins as `claimed` and is updated in place to `published` after a successful external write. The primary/foreign-key constraints make duplicate claims and mismatched draft/digest pairs database-level failures instead of application conventions.

Schema changes are versioned under `migrations/` and applied transactionally by `npm run migrate`.
