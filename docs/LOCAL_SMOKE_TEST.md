# Local smoke test — token-safe path

This path verifies the live Instagram credential without placing the token in ChatGPT, Drive, screenshots, shell history, or the repository.

## 1. Install dependencies

```bash
npm install
```

## 2. Export non-secret identity settings

Use the Instagram user ID shown by Meta when the token was generated.

```bash
export INSTAGRAM_API_VERSION=v25.0
export INSTAGRAM_USER_ID=<INSTAGRAM_USER_ID>
export INSTAGRAM_EXPECTED_USERNAME=andrewvoxai
```

The current Meta API helper screen observed during setup displayed `v25.0`. Use the version actually shown/configured by the Meta app at test time; do not treat this document as a permanent API-version default.

## 3. Read the access token without echo or shell history

On bash/zsh:

```bash
read -rsp "Instagram token: " INSTAGRAM_ACCESS_TOKEN; echo
export INSTAGRAM_ACCESS_TOKEN
```

Do **not** paste the token into a command line such as `export INSTAGRAM_ACCESS_TOKEN=...`, because that may be retained in shell history. Do not put the token in screenshots.

## 4. Verify identity

```bash
npm run verify:instagram
```

Success is intentionally small and non-secret:

```text
IDENTITY_OK
username=@andrewvoxai
id=...
```

If the ID or username does not match exactly, stop. Do not start or deploy the bridge.

## 5. Clear the temporary shell secret when finished

```bash
unset INSTAGRAM_ACCESS_TOKEN
```

For the actual bridge process, store the token in the hosting provider's secret manager or an appropriately protected service environment — not in Git, Drive, docs, or ChatGPT.
