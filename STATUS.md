# Project status — 2026-08-11

## Current milestone

**v0.4.0 — durable-state pre-deployment.**

The Meta app and Instagram professional identity are linked and validated. The live access token is intentionally absent from Git, Drive archives, documentation, screenshots, and model-visible configuration.

Approval state is now host-agnostic behind `StateStore`, with both filesystem and PostgreSQL adapters implementing the same immutable-draft, atomic-claim, and permanent replay-protection contract.

## Done

- Minimal MCP tool surface designed: profile read, recent-media read, and image-post draft preparation.
- Instagram API with Instagram Login route selected (`graph.instagram.com`).
- Meta app configured for the professional Instagram identity.
- Initial scopes configured for basic account access and content publishing.
- Instagram tester authorization completed and app connection appears active on the Instagram account.
- Live identity validation completed for `@andrewvoxai`.
- Startup identity pinning implemented: wrong account ID/username fails closed before the listener opens.
- Server-side drafts with SHA-256 + HMAC review links implemented.
- Human-only publication page implemented.
- Second publish-action token implemented.
- `StateStore` contract isolates approval logic from infrastructure storage.
- `FileStateStore` preserves local/persistent-disk operation.
- `PostgresStateStore` provides shared durable state without changing the approval model.
- Versioned PostgreSQL migration runner implemented under the explicit `andrew_social` schema.
- PostgreSQL publication ledger permanently blocks a digest after a completed publication receipt.
- Post-publication receipt failures preserve the active claim instead of automatically releasing it for a potentially duplicating retry.
- State-store readiness is checked at startup and fails closed before the listener opens.
- CI provisions disposable PostgreSQL 18, applies migrations, runs TypeScript typecheck, filesystem tests, PostgreSQL replay tests, and build.
- Full CI for the PostgreSQL milestone passed on Node.js 22.
- Regimento + Andrew Social Skill included.
- Threat model documented.
- Token-safe one-shot identity verifier included (`npm run verify:instagram`).
- Apache-2.0 licensing added for the public repository.

## Still required before live publication

- Initialize the production PostgreSQL schema with the versioned migration runner.
- Choose a private deployment target with a server-side secret manager.
- Store the runtime database URL and Instagram credential only in the deployment secret manager.
- Keep the MCP endpoint private until an OAuth 2.1 authorization layer is implemented.
- Choose public HTTPS media hosting compatible with Meta's fetch requirements.
- Add rate limiting and bounded draft retention/garbage collection before broader exposure.
- Define manual recovery for claims whose external publication outcome is ambiguous.
- Verify token lifetime/refresh/rotation procedures for the deployed environment.

## Next milestone

1. Apply `npm run migrate` to the production PostgreSQL environment using a direct migration connection.
2. Configure the bridge with the pooled/runtime PostgreSQL connection and `STATE_STORE_BACKEND=postgres`.
3. Deploy privately with credentials stored only in the host secret manager.
4. Confirm startup passes both storage readiness and pinned Instagram identity checks without exposing credentials.
5. Connect the MCP endpoint privately and run `instagram_get_profile`.
6. Run `instagram_list_recent_posts`.
7. Prepare one non-sensitive test draft and inspect its SHA-256 + approval page.
8. Perform one deliberate human-approved publication test.
9. Preserve the resulting publication receipt and review the complete audit path before expanding permissions.
