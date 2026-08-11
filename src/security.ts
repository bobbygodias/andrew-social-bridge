import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { getConfig } from "./config.js";

export type DraftPayload = {
  v: 1;
  kind: "image";
  id: string;
  instagramUserId: string;
  expectedUsername: string;
  mediaUrl: string;
  caption: string;
  createdAt: string;
  expiresAt: string;
};

function hmac(message: string): string {
  const { APPROVAL_HMAC_SECRET } = getConfig();
  return crypto.createHmac("sha256", APPROVAL_HMAC_SECRET).update(message, "utf8").digest("base64url");
}

export function canonicalDraftDigest(payload: DraftPayload): string {
  const canonical = JSON.stringify({
    v: payload.v,
    kind: payload.kind,
    id: payload.id,
    instagramUserId: payload.instagramUserId,
    expectedUsername: payload.expectedUsername,
    mediaUrl: payload.mediaUrl,
    caption: payload.caption,
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
  });
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function newDraftPayload(input: {
  instagramUserId: string;
  expectedUsername: string;
  mediaUrl: string;
  caption: string;
  ttlMinutes?: number;
}): DraftPayload {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + (input.ttlMinutes ?? 30) * 60_000);
  return {
    v: 1,
    kind: "image",
    id: crypto.randomUUID(),
    instagramUserId: input.instagramUserId,
    expectedUsername: input.expectedUsername,
    mediaUrl: input.mediaUrl,
    caption: input.caption,
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function createApprovalSignature(payload: DraftPayload): string {
  return hmac(`review:${payload.id}:${canonicalDraftDigest(payload)}:${payload.expiresAt}`);
}

export function createPublishActionToken(payload: DraftPayload): string {
  return hmac(`publish:${payload.id}:${canonicalDraftDigest(payload)}:${payload.expiresAt}`);
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyApprovalSignature(payload: DraftPayload, signature: string): void {
  if (!safeEqual(signature, createApprovalSignature(payload))) throw new Error("Invalid approval signature");
  if (Date.parse(payload.expiresAt) <= Date.now()) throw new Error("Approval link expired");
}

export function verifyPublishActionToken(payload: DraftPayload, token: string): void {
  if (!safeEqual(token, createPublishActionToken(payload))) throw new Error("Invalid publish action token");
  if (Date.parse(payload.expiresAt) <= Date.now()) throw new Error("Approval link expired");
}

export function isValidDraftId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function isPublicHttpsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (host === "::1" || host === "0.0.0.0") return false;

    const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const octets = ipv4.slice(1).map(Number);
      if (octets.some((n) => n < 0 || n > 255)) return false;
      const [a, b] = octets;
      if (a === 10 || a === 127 || a === 0) return false;
      if (a === 169 && b === 254) return false;
      if (a === 172 && b !== undefined && b >= 16 && b <= 31) return false;
      if (a === 192 && b === 168) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function unauthorized(res: Response): void {
  res.setHeader("WWW-Authenticate", 'Basic realm="Andrew Social Approval", charset="UTF-8"');
  res.status(401).send("Human approval required.");
}

export function requireHumanApproval(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Basic ")) return unauthorized(res);

  let decoded = "";
  try {
    decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  } catch {
    return unauthorized(res);
  }

  const separator = decoded.indexOf(":");
  if (separator < 0) return unauthorized(res);
  const username = decoded.slice(0, separator);
  const password = decoded.slice(separator + 1);
  const config = getConfig();

  if (!safeEqual(username, config.APPROVER_USERNAME) || !safeEqual(password, config.APPROVER_PASSWORD)) {
    return unauthorized(res);
  }
  next();
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[ch] ?? ch));
}
