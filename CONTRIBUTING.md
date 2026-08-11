# Contributing to Andrew Social Bridge

Thanks for helping improve the bridge. Security, interoperability, and clarity are more important here than feature count.

## Principles

- Preserve the hard separation between MCP/model capability and final public publication.
- Do not add model-callable tools that bypass the human approval boundary.
- Keep secrets out of code, tests, fixtures, logs, screenshots, issues, and pull requests.
- Prefer least-privilege API scopes and explicit capability expansion.
- Keep the configured Instagram identity pinned and fail closed on mismatch.
- Preserve the `StateStore` invariants across every storage adapter.
- Add tests for authorization, replay, expiry, identity mismatch, malformed input, and storage failure when changing security-sensitive code.

## Development

```bash
npm install
npm run typecheck
npm test
```

Node.js 22 or newer is required.

Changes to PostgreSQL schema or storage behavior must include a versioned migration and should be exercised against a disposable PostgreSQL instance before merge. The repository CI does this automatically.

## Pull requests

Keep changes focused. Explain:

1. what behavior changes;
2. which trust boundary it touches;
3. whether new API permissions are required;
4. how failure behaves;
5. which tests cover the change.

A capability that needs a broader Meta permission should be reviewed as a permission-surface change, not slipped into an unrelated refactor.

A new storage adapter must not weaken immutable drafts, atomic claims, permanent post-publication replay blocking, or the human approval boundary.

## Security reports

Do not publish exploit details or live credentials in a public issue. Follow the private reporting guidance in [`SECURITY.md`](SECURITY.md).
