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
       +-------------------+
       | Storage adapter   |
       |                   |
       | filesystem today  |
       | external DB later |
       +---------+---------+
                 |
                 | approval URL (id + signed reference)
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

Approval state is accessed through the `StateStore` contract. The MCP and approval flow do not depend on filesystem paths or a hosting provider.

The current adapter is `FileStateStore`, which preserves the original immutable-draft and atomic-claim behavior for local development or hosts with persistent disk. A future database adapter must implement the same contract and replay semantics; changing storage must not change the publication authorization model.
