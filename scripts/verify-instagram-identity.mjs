const required = [
  "INSTAGRAM_API_VERSION",
  "INSTAGRAM_USER_ID",
  "INSTAGRAM_EXPECTED_USERNAME",
  "INSTAGRAM_ACCESS_TOKEN",
];

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(2);
  }
}

const version = process.env.INSTAGRAM_API_VERSION;
const userId = process.env.INSTAGRAM_USER_ID;
const expectedUsername = process.env.INSTAGRAM_EXPECTED_USERNAME;
const token = process.env.INSTAGRAM_ACCESS_TOKEN;

if (!/^v\d+\.\d+$/.test(version)) {
  console.error("Invalid INSTAGRAM_API_VERSION format; expected e.g. v26.0");
  process.exit(2);
}

const url = new URL(`https://graph.instagram.com/${version}/${encodeURIComponent(userId)}`);
url.searchParams.set("fields", "id,username,name,media_count");

try {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }

  if (!response.ok) {
    console.error(`Instagram identity verification failed with HTTP ${response.status}.`);
    // Deliberately do not echo response headers, request headers, URL query secrets, or token.
    if (body?.error?.message) console.error(`Meta message: ${String(body.error.message).slice(0, 300)}`);
    process.exit(1);
  }

  const actualId = String(body.id ?? "");
  const actualUsername = String(body.username ?? "");
  if (actualId !== userId || actualUsername.toLowerCase() !== expectedUsername.toLowerCase()) {
    console.error("IDENTITY MISMATCH — bridge must not start.");
    console.error(`Expected: @${expectedUsername} (${userId})`);
    console.error(`Received: @${actualUsername || "unknown"} (${actualId || "unknown"})`);
    process.exit(1);
  }

  console.log("IDENTITY_OK");
  console.log(`username=@${actualUsername}`);
  console.log(`id=${actualId}`);
  if (body.name) console.log(`name=${String(body.name)}`);
  if (body.media_count !== undefined) console.log(`media_count=${String(body.media_count)}`);
} catch (error) {
  console.error(`Instagram identity verification could not complete: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
}
