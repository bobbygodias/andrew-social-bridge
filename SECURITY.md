# Security model — Andrew Social Bridge v0.3.1

This bridge is intentionally designed around **least privilege** and a hard separation between model capability and public publication.

## Reporting a vulnerability

Please do **not** open a public issue for a vulnerability that could expose credentials, bypass the approval boundary, publish without authorization, switch the pinned Instagram identity, or enable replay/double publication.

Prefer GitHub's private security-reporting/advisory flow when available. Include a minimal reproduction, affected version/commit, expected impact, and any proposed mitigation. Never include live access tokens, passwords, cookies, 2FA codes, or other credentials in the report.

## Trust boundaries

### MCP / model side
Can:
- verify the configured Instagram identity;
- read recent posts;
- create a short-lived local draft;
- receive the draft SHA-256 and a review URL.

Cannot:
- call the Instagram publish endpoint directly;
- read the Meta access token;
- read the HMAC secret;
- read the human approval password;
- generate the final human publish action token without server assistance.

### Human approval side
Protected by a credential kept outside the model. The page displays exact content and requires an explicit click.

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
| Server restart | Drafts and publication receipts live in `APPROVAL_STATE_DIR`; production storage must be persistent. |
| Multi-instance race | Use one persistent shared filesystem or replace the file store with an atomic DB/Redis store before scaling. |
| Secret exposure in model output | Secrets are environment variables only; tools never return them. |
| Public MCP abuse / draft-storage DoS | **Not solved in v0.3.1.** Keep MCP private behind a controlled/private connection until MCP OAuth 2.1 is implemented. |
| Compromised deployment host | Out of scope for app-layer controls; use secret manager, minimal host permissions, patching, encrypted storage, and audit logs. |

## Known security gates before public exposure

1. Add OAuth 2.1 to the MCP endpoint or keep it private.
2. Use persistent/shared approval state.
3. Store all secrets in the deployment secret manager.
4. Verify Meta app scopes and token lifetime/refresh behavior.
5. Run MCP Inspector, typecheck, unit tests, and negative authorization tests.
6. Add rate limiting and bounded draft retention/garbage collection.

## Non-goals

This project does not automate password changes, 2FA, DMs, follow/unfollow, mass engagement, account recovery, or security settings.

## v0.3 startup fail-closed identity check

The server verifies the configured Instagram account before opening the MCP/HTTP listener. If the access token does not resolve to the exact configured user ID and username, startup is blocked. This prevents a rotated/wrong token from silently exposing a bridge that targets an unexpected account.

The one-shot verification script prints only non-secret identity metadata. It never prints the access token.
