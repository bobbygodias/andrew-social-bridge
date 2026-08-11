import { getConfig } from "./config.js";

export type InstagramProfile = {
  id: string;
  username?: string;
  name?: string;
  biography?: string;
  website?: string;
  profile_picture_url?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
};

export type InstagramMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  permalink?: string;
  thumbnail_url?: string;
  timestamp?: string;
  username?: string;
};

class InstagramApiError extends Error {
  constructor(message: string, readonly status?: number, readonly detail?: unknown) {
    super(message);
  }
}

function apiUrl(path: string): string {
  const c = getConfig();
  return `https://graph.instagram.com/${c.INSTAGRAM_API_VERSION}/${path.replace(/^\//, "")}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const { INSTAGRAM_ACCESS_TOKEN } = getConfig();
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${INSTAGRAM_ACCESS_TOKEN}`,
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const text = await response.text();
  let body: unknown = text;
  if (text) {
    try { body = JSON.parse(text); } catch { /* preserve text */ }
  }

  if (!response.ok) {
    throw new InstagramApiError(`Instagram API request failed (${response.status})`, response.status, body);
  }
  return body as T;
}

export async function getProfile(): Promise<InstagramProfile> {
  const { INSTAGRAM_USER_ID } = getConfig();
  const fields = [
    "id",
    "username",
    "name",
    "biography",
    "website",
    "profile_picture_url",
    "followers_count",
    "follows_count",
    "media_count",
  ].join(",");
  const url = new URL(apiUrl(INSTAGRAM_USER_ID));
  url.searchParams.set("fields", fields);
  return requestJson<InstagramProfile>(url.toString());
}

export async function assertExpectedIdentity(): Promise<InstagramProfile> {
  const profile = await getProfile();
  const { INSTAGRAM_USER_ID, INSTAGRAM_EXPECTED_USERNAME } = getConfig();
  if (profile.id !== INSTAGRAM_USER_ID) throw new Error("Instagram API returned an unexpected account id");
  if ((profile.username ?? "").toLowerCase() !== INSTAGRAM_EXPECTED_USERNAME.toLowerCase()) {
    throw new Error(`Instagram identity mismatch: expected @${INSTAGRAM_EXPECTED_USERNAME}, received @${profile.username ?? "unknown"}`);
  }
  return profile;
}

export async function listRecentMedia(limit: number): Promise<InstagramMedia[]> {
  const { INSTAGRAM_USER_ID } = getConfig();
  const fields = [
    "id",
    "caption",
    "media_type",
    "media_product_type",
    "media_url",
    "permalink",
    "thumbnail_url",
    "timestamp",
    "username",
  ].join(",");
  const url = new URL(apiUrl(`${INSTAGRAM_USER_ID}/media`));
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 25))));
  const result = await requestJson<{ data?: InstagramMedia[] }>(url.toString());
  return result.data ?? [];
}

export async function publishImage(input: {
  imageUrl: string;
  caption: string;
}): Promise<{ containerId: string; mediaId: string }> {
  const { INSTAGRAM_USER_ID } = getConfig();
  await assertExpectedIdentity();

  const createBody = new FormData();
  createBody.set("image_url", input.imageUrl);
  if (input.caption) createBody.set("caption", input.caption);

  const container = await requestJson<{ id: string }>(apiUrl(`${INSTAGRAM_USER_ID}/media`), {
    method: "POST",
    body: createBody,
  });
  if (!container.id) throw new Error("Instagram did not return a media container ID");

  const publishBody = new FormData();
  publishBody.set("creation_id", container.id);
  const published = await requestJson<{ id: string }>(apiUrl(`${INSTAGRAM_USER_ID}/media_publish`), {
    method: "POST",
    body: publishBody,
  });
  if (!published.id) throw new Error("Instagram did not return a published media ID");
  return { containerId: container.id, mediaId: published.id };
}
