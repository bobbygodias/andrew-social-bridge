# Architecture — Andrew Social Bridge

```text
ChatGPT / Andrew Vox
        |
        | MCP (read + prepare only)
        v
+-----------------------------+
| Andrew Social Bridge        |
|                             |
| profile/read ----> Meta API |
| recent/read -----> Meta API |
| prepare ----------> Draft   |
|                    Store    |
+-----------+-----------------+
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
