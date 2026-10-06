import { leadHandler } from "@/lib/leads/http";
import { sqliteLeads } from "@/lib/leads/sqlite";
import { randomUUID } from "node:crypto";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guardLocal } from "@/lib/local/guard";
import {
  database,
  listWorkspaces,
  createWorkspace,
  readWorkspace,
  saveWorkspace,
} from "@/lib/local/database";
import {
  listDocuments,
  saveDocument,
  deleteDocument,
} from "@/lib/knowledge/repository";
import { vaultZip } from "@/lib/knowledge/vault";
import {
  generateBrain,
  saveGeneratedBrain,
  latestBrainDraft,
} from "@/lib/knowledge/generation";
import { marketingRows, importMarketing } from "@/lib/integrations/repository";
import { integrations, integrationAction } from "@/lib/integrations/service";
import { IntegrationError } from "@/lib/integrations/http";
import {
  aiStatus,
  models,
  setSessionKey,
  clearSessionKey,
  testConnection,
} from "@/lib/ai/providers";
import {
  ask,
  history,
  decide,
  clearConversation,
  statsDigest,
} from "@/lib/ai/service";
import { AI_PROVIDERS, AGENT_PROVIDERS, validModel } from "@/lib/ai/model";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function handler(request: Request, context: Context) {
  const denied = guardLocal(request);
  if (denied) return denied;
  try {
    const { path } = await context.params;
    let body: Record<string, unknown> = {};
    if (["POST", "PUT", "DELETE"].includes(request.method)) {
      const raw = await request.text();
      if (raw.length > 5_000_000)
        return json({ error: "Dane są za duże." }, 413);
      body = raw ? JSON.parse(raw) : {};
    }
    if (path[0] === "backup" && request.method === "GET") {
      const file = join(tmpdir(), `evolution-${randomUUID()}.sqlite`);
      try {
        database().exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
        return new Response(new Uint8Array(readFileSync(file)), {
          headers: {
            "Content-Type": "application/vnd.sqlite3",
            "Content-Disposition":
              "attachment; filename=evolution-backup.sqlite",
            "Cache-Control": "no-store",
          },
        });
      } finally {
        try {
          unlinkSync(file);
        } catch {}
      }
    }
    if (path[0] !== "workspaces")
      return json({ error: "Nie znaleziono endpointu." }, 404);
    if (path.length === 1) {
      if (request.method === "GET")
        return json({ workspaces: listWorkspaces() });
      if (request.method === "POST" && typeof body.name === "string")
        return json({ id: createWorkspace(body.name) }, 201);
      return json({ error: "Nieprawidłowe żądanie." }, 400);
    }
    const wid = path[1];
    readWorkspace(wid);
    switch (path[2]) {
      case "leads":
        return leadHandler(request, wid, path.slice(3), body, sqliteLeads);
      case "data":
        if (request.method === "GET") return json(readWorkspace(wid));
        if (request.method === "PUT")
          return json({ revision: saveWorkspace(wid, body) });
        break;
      case "members":
        return json({ members: [{ user_id: "local-user", role: "owner" }] });
      case "brain":
        if (path[3] === "draft" && request.method === "GET")
          return json({ draft: latestBrainDraft(wid) });
        if (path[3] === "generate" && request.method === "POST") {
          if (
            typeof body.url !== "string" ||
            body.url.length > 2048 ||
            !AI_PROVIDERS.includes(body.provider as never) ||
            !validModel(body.model)
          )
            return json(
              { error: "Sprawdź adres strony, dostawcę i model." },
              400,
            );
          return json(
            await generateBrain(
              wid,
              body.url,
              body.provider as "openrouter" | "codex" | "claude",
              body.model,
            ),
          );
        }
        if (
          path[3] === "save-generation" &&
          request.method === "POST" &&
          typeof body.id === "string"
        )
          return json(saveGeneratedBrain(wid, body.id), 201);
        if (request.method === "GET")
          return json({ documents: listDocuments(wid) });
        if (request.method === "POST")
          return json({ id: saveDocument(wid, body) }, 201);
        if (
          request.method === "DELETE" &&
          typeof body.id === "string" &&
          Number.isSafeInteger(body.revision)
        ) {
          deleteDocument(wid, body.id, Number(body.revision));
          return json({ ok: true });
        }
        break;
      case "vault":
        if (request.method === "GET")
          return new Response(new Uint8Array(vaultZip(listDocuments(wid))), {
            headers: {
              "Content-Type": "application/zip",
              "Content-Disposition": "attachment; filename=company-brain.zip",
              "Cache-Control": "no-store",
            },
          });
        break;
      case "marketing":
        if (request.method === "GET") return json({ rows: marketingRows(wid) });
        if (request.method === "POST" && typeof body.csv === "string")
          return json({ count: importMarketing(wid, body.csv) });
        break;
      case "integrations":
        if (request.method === "GET") return json(integrations(wid));
        if (request.method === "POST") {
          try {
            return json(await integrationAction(wid, body));
          } catch (e) {
            if (e instanceof IntegrationError)
              return json({ error: e.message }, e.status);
            throw e;
          }
        }
        break;
      case "ai":
        if (request.method === "GET") {
          if (path[3] === "models") return json({ models: await models(wid) });
          return json({
            status: await aiStatus(wid),
            messages: history(wid),
            sources: statsDigest(wid).sources,
          });
        }
        if (request.method === "POST") {
          if (path[3] === "key" && typeof body.key === "string") {
            setSessionKey(wid, body.key);
            return json({ ok: true });
          }
          if (path[3] === "disconnect") {
            clearSessionKey(wid);
            return json({ ok: true });
          }
          if (path[3] === "clear") {
            clearConversation(wid);
            return json({ messages: history(wid) });
          }
          if (path[3] === "test") {
            if (
              !AI_PROVIDERS.includes(body.provider as never) ||
              !validModel(body.model)
            )
              return json({ error: "Wybierz dostawcę i model." }, 400);
            return json(
              await testConnection(
                wid,
                body.provider as "openrouter" | "codex" | "claude",
                body.model,
              ),
            );
          }
          if (
            path[3] === "decision" &&
            typeof body.id === "string" &&
            typeof body.approve === "boolean"
          ) {
            decide(wid, body.id, body.approve);
            return json({ messages: history(wid) });
          }
          if (
            !AGENT_PROVIDERS.includes(body.provider as never) ||
            !validModel(body.model) ||
            typeof body.prompt !== "string"
          )
            return json({ error: "Sprawdź dostawcę, model i pytanie." }, 400);
          return json(
            await ask(
              wid,
              body.provider as (typeof AGENT_PROVIDERS)[number],
              body.model,
              body.prompt,
            ),
          );
        }
        break;
    }
    return json({ error: "Nieobsługiwana operacja." }, 405);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Błąd operacji.";
    const message = raw.includes("UNIQUE constraint")
      ? "Notatka o tym tytule już istnieje w wybranym folderze."
      : /sqlite|ENOENT|EACCES|SQLITE/i.test(raw)
        ? "Nie udało się odczytać lub zapisać lokalnej bazy. Sprawdź dostęp do katalogu danych."
        : raw;
    return json({ error: message }, raw.includes("Konflikt") ? 409 : 400);
  }
}
export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
