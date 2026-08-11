# Project status — 2026-08-11

## Current milestone

**v0.3.1 — authenticated pre-deployment.**

The Meta app and Instagram professional identity are linked and validated. The live access token is intentionally absent from Git, Drive archives, documentation, screenshots, and model-visible configuration.

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
- Atomic replay/double-publish guard implemented for persistent/shared filesystem deployment.
- Regimento + Andrew Social Skill included.
- Threat model documented.
- Token-safe one-shot identity verifier included (`npm run verify:instagram`).
- Apache-2.0 licensing added for the public repository.

## Still required before live publication

- Install dependencies in a networked build/deployment environment and run full TypeScript typecheck + unit tests.
- Choose a private deployment target with a server-side secret manager.
- Configure persistent/shared approval state; do not use ephemeral serverless storage for the current filesystem backend.
- Keep the MCP endpoint private until an OAuth 2.1 authorization layer is implemented.
- Choose public HTTPS media hosting compatible with Meta's fetch requirements.
- Add rate limiting and bounded draft retention/garbage collection before broader exposure.
- Verify token lifetime/refresh/rotation procedures for the deployed environment.

## Next milestone

1. Deploy the bridge privately with secrets stored only in the host secret manager.
2. Confirm startup emits a successful pinned-identity check without exposing credentials.
3. Connect the MCP endpoint privately and run `instagram_get_profile`.
4. Run `instagram_list_recent_posts`.
5. Prepare one non-sensitive test draft and inspect its SHA-256 + approval page.
6. Perform one deliberate human-approved publication test.
7. Preserve the resulting publication receipt and review the complete audit path before expanding permissions.
