import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConfig } from "./config.js";
import { assertExpectedIdentity, listRecentMedia } from "./instagram.js";
import {
  canonicalDraftDigest,
  createApprovalSignature,
  isPublicHttpsUrl,
  newDraftPayload,
} from "./security.js";
import { saveDraft } from "./store.js";

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: "andrew-social-bridge", version: "0.3.1" },
    {
      instructions:
        "This bridge serves the configured Andrew Vox Instagram identity. Read actions are allowed. Preparing a draft never publishes. Final Instagram publication is intentionally unavailable as an MCP tool: only the separate human approval page can publish after external authentication and an explicit click. Never request, reveal, or return Instagram tokens, approval passwords, cookies, or 2FA codes.",
    },
  );

  server.registerTool(
    "instagram_get_profile",
    {
      title: "Get Andrew Vox Instagram profile",
      description: "Use this when the user wants to inspect and verify the configured Andrew Vox Instagram professional profile.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async () => {
      try {
        const profile = await assertExpectedIdentity();
        return {
          structuredContent: { profile },
          content: [{ type: "text", text: `Verified Instagram profile: @${profile.username ?? "unknown"}.` }],
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "instagram_list_recent_posts",
    {
      title: "List recent Instagram posts",
      description: "Use this when the user wants to inspect recent posts already published on the configured Andrew Vox Instagram account.",
      inputSchema: { limit: z.number().int().min(1).max(25).default(10) },
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    },
    async ({ limit }) => {
      try {
        await assertExpectedIdentity();
        const posts = await listRecentMedia(limit);
        return {
          structuredContent: { posts },
          content: [{ type: "text", text: `Found ${posts.length} recent Instagram post(s).` }],
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "instagram_prepare_image_post",
    {
      title: "Prepare an Instagram image post for human approval",
      description:
        "Use this only when a specific image and caption should be prepared for the configured Andrew Vox account. This tool cannot publish. It stores an immutable short-lived draft and returns its SHA-256 plus a human approval URL. Publication requires separate authentication and a human click outside MCP.",
      inputSchema: {
        image_url: z.string().url().describe("Public HTTPS image URL reachable by Meta"),
        caption: z.string().max(2200),
        approval_ttl_minutes: z.number().int().min(5).max(120).default(30),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    async ({ image_url, caption, approval_ttl_minutes }) => {
      try {
        if (!isPublicHttpsUrl(image_url)) {
          throw new Error("image_url must be a public HTTPS URL and may not target localhost/private addresses");
        }
        const config = getConfig();
        await assertExpectedIdentity();
        const payload = newDraftPayload({
          instagramUserId: config.INSTAGRAM_USER_ID,
          expectedUsername: config.INSTAGRAM_EXPECTED_USERNAME,
          mediaUrl: image_url,
          caption,
          ttlMinutes: approval_ttl_minutes,
        });
        await saveDraft(payload);
        const digest = canonicalDraftDigest(payload);
        const signature = createApprovalSignature(payload);
        const base = config.PUBLIC_BASE_URL.replace(/\/$/, "");
        const approvalUrl = `${base}/approve?id=${encodeURIComponent(payload.id)}&sig=${encodeURIComponent(signature)}`;

        return {
          structuredContent: {
            draft_id: payload.id,
            draft_digest_sha256: digest,
            approval_url: approvalUrl,
            expires_at: payload.expiresAt,
            destination: `@${config.INSTAGRAM_EXPECTED_USERNAME}`,
          },
          content: [{
            type: "text",
            text: `Draft prepared for @${config.INSTAGRAM_EXPECTED_USERNAME}. SHA-256: ${digest}. It is NOT published. A human must open the approval URL, authenticate outside ChatGPT, review the exact content, and click Publish.`,
          }],
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  return server;
}
