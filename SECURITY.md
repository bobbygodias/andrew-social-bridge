# Security model — Andrew Social Bridge v0.4.0

This bridge is intentionally designed around **least privilege** and a hard separation between model capability and public publication.

## Reporting a vulnerability

Please do **not** open a public issue for a vulnerability that could expose credentials, bypass the approval boundary, publish without authorization, switch the pinned Instagram identity, or enable replay/double publication.

Prefer GitHub's private security-reporting/advisory flow when available. Include a minimal reproduction, affected version/commit, expected impact, and any proposed mitigation. Never include live access tokens, database URLs, passwords, cookies, 2FA codes, or other credentials in the report.

## Trust boundaries

### MCP / model side
Can:
- verify the configured Instagram identity;
- read recent posts;
- create a short-lived immutable draft;
- receive the draft SHA-256 and a review URL.

Cannot:
- call the Instagram publish endpoint directly;
- read the Meta access token;
- read a database credential;
- read the HMAC secret;
- read the human approval password;
- generate the final human publish action token without server assistance.

### Human approval side
Protected by a credential kept outside the model. The page displays exact content and requires an explicit click.

### State-store side
Approval state is accessed through `StateStore`. The configured adapter must preserve immutable drafts, atomic claims, durable publication receipts, and permanent replay blocking after publication.

### Instagram/Meta side
The token is stored server-side and only used by the bridge for fixed-account API calls.

## Threats and mitigations

| Threat | Mitigation |
|---|---|
| Prompt injection asks Andrew to publish | No publish MCP tool exists. |
| Prompt injection changes approved content | Approval signature and SHA-256 bind the immutable server-side draft. |
| Wrong Instagram account/token configured | Identity is re-read and username + user ID are checked before draft creation and again before publish. |
| Approval URL leaks | It contains only a draft id + HMAC signature, not the content or credentials; human Basic Auth is still required. |
| Cross-site forced publish | POST requires a server-generated publish action token only exposed after authenticated review. |
| Double click / replay | Atomic digest claim blocks reuse; successful publication leaves a durable receipt. |
| Replay after a completed publication | Both storage adapters permanently reject a digest that already has a publication receipt/ledger entry. |
| Receipt persistence fails after Instagram succeeds | The active claim is preserved for manual inspection instead of being automatically released for a potentially duplicating retry. |
| Server restart | Use `FileStateStore` only with genuinely persistent disk, or `PostgresStateStore` for shared durable state. |
| Multi-instance race | Use `PostgresStateStore`; uniqueness/foreign-key constraints enforce claim identity at the database boundary. |
| State backend unavailable or uninitialized | Startup calls `StateStore.assertReady()` and fails closed before opening the listener. |
| Secret exposure in model output | Secrets are environment variables/secret-manager values only; MCP tools never return them. |
| Public MCP abuse / draft-storage DoS | **Not solved in v0.4.0.** Keep MCP private behind a controlled/private connection until MCP OAuth 2.1 is implemented. |
| Compromised deployment host | Out of scope for app-layer controls; use secret manager, minimal host permissions, patching, encrypted storage, and audit logs. |

## Known security gates before public exposure

1. Add OAuth 2.1 to the MCP endpoint or keep it private.
2. Use a durable state backend appropriate to the host topology.
3. Store all secrets in the deployment secret manager.
4. Verify Meta app scopes and token lifetime/refresh behavior.
5. Run MCP Inspector, typecheck, unit tests, migration tests, and negative authorization tests.
6. Add rate limiting and bounded draft retention/garbage collection.
7. Define a manual recovery procedure for claims whose external publication outcome is ambiguous.

## Non-goals

This project does not automate password changes, 2FA, DMs, follow/unfollow, mass engagement, account recovery, or security settings.

## Startup fail-closed checks

Before opening the MCP/HTTP listener, the server verifies both:

1. the configured state backend is reachable and initialized; and
2. the Instagram access token resolves to the exact configured user ID and username.

A missing database migration, unavailable storage backend, rotated/wrong token, or identity mismatch therefore blocks startup instead of leaving a partially functional bridge online.

The one-shot Instagram verification script prints only non-secret identity metadata. It never prints the access token.
