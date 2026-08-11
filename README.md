<div align="center">

# Andrew Social Bridge

**A safety-gated MCP bridge between ChatGPT and the official Instagram API.**

Built for the public identity **[@andrewvoxai](https://www.instagram.com/andrewvoxai/)** with explicit human approval, account pinning, least-privilege permissions, replay protection, and secret-safe operation.

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](LICENSE)
[![Node.js >= 20](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)
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

The bridge therefore separates three concerns:

- **Model capability** — read and prepare only.
- **Server authority** — fixed-account API access with secrets kept server-side.
- **Human authorization** — a distinct authenticated page for the final irreversible action.

## Architecture

```text
ChatGPT / Andrew Vox
        |
        | MCP: read + prepare only
        v
+-------------------------------+
| Andrew Social Bridge          |
|                               |
| profile/read ------> Meta API |
| recent/read -------> Meta API |
| prepare -----------> Draft    |
|                     Store     |
+-------------+-----------------+
              |
              | signed review URL
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

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the compact design reference and [`SECURITY.md`](SECURITY.md) for the threat model.

## MCP tools

| Tool | Capability | Public write? |
|---|---|---:|
| `instagram_get_profile` | Verify/read the pinned Instagram profile | No |
| `instagram_list_recent_posts` | Read recent published media | No |
| `instagram_prepare_image_post` | Store an immutable, short-lived image-post draft and return its digest + approval URL | **No** |

There is intentionally **no `instagram_publish` MCP tool**.

## Security properties

- **Pinned identity:** startup fails closed unless the token resolves to the configured Instagram user ID and expected username.
- **Least privilege:** the initial milestone uses only the scopes needed for basic account access and content publishing.
- **Secret isolation:** Instagram tokens, approval credentials, HMAC secrets, cookies, passwords, and 2FA codes are not MCP inputs or outputs.
- **Immutable approval:** media URL, caption, destination, timestamps, and draft ID are bound by SHA-256 and HMAC.
- **Replay protection:** publication claims are atomic and successful writes leave a durable receipt.
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

## Required secrets

These values belong **only** in a local protected environment or deployment secret manager:

```text
INSTAGRAM_ACCESS_TOKEN
APPROVAL_HMAC_SECRET
APPROVER_PASSWORD
```

The bridge is designed so the model never needs to know any of them.

## Persistence requirement

`APPROVAL_STATE_DIR` stores drafts, publication claims, and receipts. In production it must be persistent and shared by every instance that can serve approval requests.

Do **not** run the current filesystem-backed approval state on ephemeral serverless storage. Before multi-instance or multi-region deployment, replace it with a transactional store such as a database or Redis-compatible system with atomic claim semantics.

## Deployment posture

The current MCP endpoint does not yet implement its own OAuth 2.1 authorization layer. Until that exists, keep the MCP endpoint private and reachable only through a controlled/private connection.

Do not expose the current `/mcp` endpoint openly on the public internet.

## Current status

**v0.3.1 — authenticated pre-deployment milestone.**

The Meta app and Instagram professional account have been linked and the configured identity has been validated. A live credential exists, but is deliberately excluded from this repository, documentation, screenshots, and project archives.

The next milestone is a private deployment with server-side secrets, followed by read-only MCP verification and then one deliberately human-approved publication test.

See [`STATUS.md`](STATUS.md) for the operational checklist.

## Deliberately out of scope for v0.3.1

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
