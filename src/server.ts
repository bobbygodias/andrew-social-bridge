import express, { type Request, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./mcp.js";
import { getConfig } from "./config.js";
import {
  canonicalDraftDigest,
  createPublishActionToken,
  escapeHtml,
  requireHumanApproval,
  verifyApprovalSignature,
  verifyPublishActionToken,
} from "./security.js";
import { assertExpectedIdentity, publishImage } from "./instagram.js";
import {
  claimPublication,
  completePublicationClaim,
  loadDraft,
  releasePublicationClaim,
} from "./store.js";

const config = getConfig();
const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false, limit: "64kb" }));
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "andrew-social-bridge", version: "0.3.1" });
});

app.post("/mcp", async (req: Request, res: Response) => {
  const server = buildMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP request failed", error instanceof Error ? error.message : error);
    if (!res.headersSent) res.status(500).json({ error: "MCP request failed" });
  }
});

app.get("/mcp", (_req: Request, res: Response) => {
  res.status(405).set("Allow", "POST").send("This MCP deployment is stateless; use POST /mcp.");
});
app.delete("/mcp", (_req: Request, res: Response) => {
  res.status(405).set("Allow", "POST").send("This MCP deployment is stateless; there is no session to delete.");
});

app.get("/approve", requireHumanApproval, async (req: Request, res: Response) => {
  const id = typeof req.query.id === "string" ? req.query.id : "";
  const sig = typeof req.query.sig === "string" ? req.query.sig : "";
  try {
    const payload = await loadDraft(id);
    verifyApprovalSignature(payload, sig);
    if (payload.instagramUserId !== config.INSTAGRAM_USER_ID) throw new Error("Draft targets a different Instagram account id");
    if (payload.expectedUsername.toLowerCase() !== config.INSTAGRAM_EXPECTED_USERNAME.toLowerCase()) {
      throw new Error("Draft targets a different Instagram username");
    }

    const digest = canonicalDraftDigest(payload);
    const actionToken = createPublishActionToken(payload);
    const safeCaption = escapeHtml(payload.caption).replace(/\n/g, "<br>");
    const safeUrl = escapeHtml(payload.mediaUrl);

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src https:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    res.type("html").send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Andrew Social — Aprovação humana</title>
<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;background:#111;color:#eee}.card{border:1px solid #444;border-radius:14px;padding:20px;background:#181818}.meta{color:#aaa;font-size:14px;word-break:break-all}img{max-width:100%;max-height:540px;border-radius:10px;background:#222}.caption{white-space:normal;line-height:1.5}button{font:inherit;padding:12px 18px;border-radius:9px;border:0;background:#f1f1f1;color:#111;font-weight:700;cursor:pointer}.warn{color:#ffcf70}code{word-break:break-all}</style>
</head><body>
<h1>Andrew Social — aprovação humana</h1>
<p class="warn"><strong>Nada foi publicado.</strong> Revise o conteúdo exato abaixo. O botão final publica imediatamente no perfil configurado.</p>
<div class="card"><p><img src="${safeUrl}" alt="Prévia da imagem"></p>
<h2>Legenda</h2><p class="caption">${safeCaption || "(sem legenda)"}</p>
<p class="meta">Destino: @${escapeHtml(payload.expectedUsername)}</p>
<p class="meta">Expira: ${escapeHtml(payload.expiresAt)}</p>
<p class="meta">SHA-256 do rascunho: <code>${digest}</code></p>
<form method="post" action="/approve/publish">
<input type="hidden" name="id" value="${escapeHtml(payload.id)}">
<input type="hidden" name="sig" value="${escapeHtml(sig)}">
<input type="hidden" name="action_token" value="${escapeHtml(actionToken)}">
<button type="submit">PUBLICAR ESTE CONTEÚDO</button></form></div>
</body></html>`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid draft";
    res.status(400).type("text").send(`Approval failed: ${message}`);
  }
});

app.post("/approve/publish", requireHumanApproval, async (req: Request, res: Response) => {
  const id = typeof req.body?.id === "string" ? req.body.id : "";
  const sig = typeof req.body?.sig === "string" ? req.body.sig : "";
  const actionToken = typeof req.body?.action_token === "string" ? req.body.action_token : "";
  let claimPath: string | undefined;
  try {
    const payload = await loadDraft(id);
    verifyApprovalSignature(payload, sig);
    verifyPublishActionToken(payload, actionToken);
    if (payload.instagramUserId !== config.INSTAGRAM_USER_ID) throw new Error("Draft targets a different Instagram account id");
    if (payload.expectedUsername.toLowerCase() !== config.INSTAGRAM_EXPECTED_USERNAME.toLowerCase()) {
      throw new Error("Draft targets a different Instagram username");
    }

    const claim = await claimPublication(payload);
    claimPath = claim.claimPath;
    const result = await publishImage({ imageUrl: payload.mediaUrl, caption: payload.caption });
    await completePublicationClaim(claim.claimPath, result);
    claimPath = undefined;

    console.info("Instagram publication approved and completed", {
      draftDigest: claim.digest,
      mediaId: result.mediaId,
      timestamp: new Date().toISOString(),
    });

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.type("html").send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Publicado</title>
<body style="font-family:system-ui;max-width:720px;margin:40px auto;padding:0 20px;background:#111;color:#eee">
<h1>Publicado.</h1><p>O conteúdo aprovado foi enviado ao Instagram.</p>
<p>Media ID: <code>${escapeHtml(result.mediaId)}</code></p>
<p>SHA-256 do rascunho aprovado: <code>${claim.digest}</code></p>
<p>A credencial humana de aprovação nunca foi exposta ao MCP.</p></body></html>`);
  } catch (error) {
    if (claimPath) await releasePublicationClaim(claimPath).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Publication failed";
    console.error("Instagram publication failed", message);
    res.status(502).type("text").send(`Publication failed: ${message}`);
  }
});

app.use((_req: Request, res: Response) => res.status(404).send("Not found"));

async function start(): Promise<void> {
  try {
    const profile = await assertExpectedIdentity();
    console.error(`Instagram identity verified at startup: @${profile.username ?? "unknown"} (${profile.id})`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown identity verification error";
    console.error(`Startup blocked: Instagram identity verification failed: ${message}`);
    process.exitCode = 1;
    return;
  }

  app.listen(config.PORT, "0.0.0.0", () => {
    console.error(`Andrew Social Bridge listening on port ${config.PORT}`);
    console.error(`MCP endpoint: ${config.PUBLIC_BASE_URL.replace(/\/$/, "")}/mcp`);
  });
}

void start();
