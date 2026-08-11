<div align="center">

# Andrew Social Bridge

**A safety-gated MCP bridge between ChatGPT and the official Instagram API.**

Built for the public identity **[@andrewvoxai](https://www.instagram.com/andrewvoxai/)** with explicit human approval, account pinning, least-privilege permissions, replay protection, and secret-safe operation.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Node.js >= 22](https://img.shields.io/badge/Node.js-%3E%3D22-339933?logo=node.js&logoColor=white)](package.json)
[![MCP](https://img.shields.io/badge/MCP-Streamable%20HTTP-6f42c1)](ARCHITECTURE.md)
[![Status](https://img.shields.io/badge/status-pre--deployment-orange)](STATUS.md)

</div>

---

## What this is

Andrew Social Bridge is a small Node.js/TypeScript service that exposes a deliberately limited MCP surface for one pinned Instagram professional account.

The model can **read** the configured profile, inspect recent posts, and **prepare** an image-post draft. It **cannot publish directly**. Publication exists only behind a separate human-only approval boundary that shows the exact media, caption, destination, expiry, and SHA-256 before an explicit click.

> **Design law:** the model may prepare; only the human gate may publish.

## Why it exists

A social connector should not turn a language model into a password holder or an unconstrained posting bot. This project treats public writes as an authorization problem, not a prompt-engineering problem.

The bridge therefore separates four concerns:

- **Model capability** — read and prepare only.
- **Server authority** — fixed-account API access with secrets kept server-side.
- **Human authorization** — a distinct authenticated page for the final irreversible action.
- **Durable state** — an interchangeable `StateStore` preserves drafts, claims, and publication receipts without coupling the authorization model to a hosting provider.

## Architecture

```text
ChatGPT / Andrew Vox
        |
        | MCP: read + prepare only
        v
+--------------------------------+
| Andrew Social Bridge           |
|                                |
| profile/read ------> Meta API  |
| recent/read -------> Meta API  |
| prepare -----------> StateStore|
+--------------+-----------------+
               |
        +------+-------+
        |              |
        v              v
  FileStateStore  PostgresStateStore
        |              |
        +------+-------+
               |
               | immutable draft + claim/receipt
               v
      Human-only approval page
      separate authentication
      exact image + caption + hash
               |
               | explicit click
               v
        atomic replay claim
               |
               v
      identity re-verification
               |
               v
        Instagram publish API
               |
               v
        publication receipt
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the design reference and [`SECURITY.md`](SECURITY.md) for the threat model.

## MCP tools

| Tool | Capability | Public write? |
|---|---|---:|
| `instagram_get_profile` | Verify/read the pinned Instagram profile | No |
| `instagram_list_recent_posts` | Read recent published media | No |
| `instagram_prepare_image_post` | Store an immutable, short-lived image-post draft and return its digest + approval URL | **No** |

There is intentionally **no `instagram_publish` MCP tool**.

## Security properties

- **Pinned identity:** startup fails closed unless the token resolves to the configured Instagram user ID and expected username.
- **State readiness:** startup also fails closed if the configured state backend is unavailable or not initialized.
- **Least privilege:** the initial milestone uses only the scopes needed for basic account access and content publishing.
- **Secret isolation:** Instagram tokens, database credentials, approval credentials, HMAC secrets, cookies, passwords, and 2FA codes are not MCP inputs or outputs.
- **Immutable approval:** media URL, caption, destination, timestamps, and draft ID are bound by SHA-256 and HMAC.
- **Replay protection:** publication claims are atomic and completed writes leave a durable receipt that permanently blocks the same digest.
- **Post-publication safety:** if receipt persistence fails after an external write succeeds, the claim is preserved for inspection rather than automatically released for a potentially duplicating retry.
- **Human-only final action:** publication requires separate authentication and an explicit browser click outside MCP.
- **No silent account switching:** identity is checked before draft creation and again before publication.

## Instagram requirements

This project targets **Instagram API with Instagram Login** on `graph.instagram.com`.

- The Instagram account must be **Professional** (Creator or Business).
- Initial publishing scopes: `instagram_business_basic` and `instagram_business_content_publish`.
- Images must be reachable by Meta over public HTTPS.
- `INSTAGRAM_API_VERSION` is intentionally explicit. Do not hard-code a guessed future version; set the version supported by the configured Meta app.

## Local setup

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

Never commit `.env`.

For the one-shot identity check, see [`docs/LOCAL_SMOKE_TEST.md`](docs/LOCAL_SMOKE_TEST.md).

## State storage

The bridge supports two interchangeable approval-state backends.

### Filesystem

```text
STATE_STORE_BACKEND=filesystem
APPROVAL_STATE_DIR=.state
```

Suitable for local development or a single service with genuinely persistent disk.

### PostgreSQL

```text
STATE_STORE_BACKEND=postgres
DATABASE_URL=postgresql://...
DATABASE_POOL_MAX=4
```

Suitable for ephemeral hosts or multiple bridge instances that need shared durable state. PostgreSQL state uses the dedicated `andrew_social` schema and a durable publication ledger keyed by the canonical draft digest.

Before first use:

```bash
DATABASE_DIRECT_URL='postgresql://...' npm run migrate
```

The migration runner falls back to `DATABASE_URL` if a separate direct URL is not supplied. See [`docs/POSTGRES_STATE_STORE.md`](docs/POSTGRES_STATE_STORE.md).

## Required secrets

These values belong **only** in a local protected environment or deployment secret manager:

```text
INSTAGRAM_ACCESS_TOKEN
APPROVAL_HMAC_SECRET
APPROVER_PASSWORD
DATABASE_URL          # when PostgreSQL is selected
DATABASE_DIRECT_URL   # optional migration-only secret
```

The bridge is designed so the model never needs to know any of them.

## Deployment posture

The application is deliberately **hosting-provider agnostic**. No provider-specific deployment manifest is required by the bridge.

The current MCP endpoint does not yet implement its own OAuth 2.1 authorization layer. Until that exists, keep the MCP endpoint private and reachable only through a controlled/private connection.

Do not expose the current `/mcp` endpoint openly on the public internet.

## Current status

**v0.4.0 — durable-state pre-deployment milestone.**

The Meta app and Instagram professional account are linked and the configured identity has been validated. Approval state is now abstracted behind `StateStore`, with filesystem and PostgreSQL adapters implementing the same authorization/replay contract. A live Instagram credential exists, but is deliberately excluded from this repository, documentation, screenshots, and project archives.

The next milestone is to initialize a private PostgreSQL environment, deploy the bridge with server-side secrets, verify the read-only MCP path, and then perform one deliberately human-approved publication test.

See [`STATUS.md`](STATUS.md) for the operational checklist.

## Deliberately out of scope for v0.4.0

- publication without the human approval click;
- DMs;
- follow/unfollow;
- account recovery or security-setting changes;
- password or 2FA changes;
- Reels, Stories, and carousels;
- comment moderation/replies;
- analytics-driven engagement loops;
- spam, mass engagement, or fabricated social activity.

New capabilities require a specific permission review instead of silently expanding the token scope.

## Social regimento

The project includes a public operating charter in [`REGIMENTO_SOCIAL.md`](REGIMENTO_SOCIAL.md) and an Andrew Social skill in [`skills/andrew-social/SKILL.md`](skills/andrew-social/SKILL.md).

The short version:

> **A voz existe; o impulso é contido.**

## Contributing

Contributions are welcome, especially around protocol correctness, security review, storage backends, OAuth, test coverage, and interoperability. Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request.

Security-sensitive findings should follow the private reporting guidance in [`SECURITY.md`](SECURITY.md), not a public issue.

## License

Licensed under the [Apache License 2.0](LICENSE).
