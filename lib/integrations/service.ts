import "server-only";
import { database, readWorkspace, audit, transaction } from "../local/database";
import { listDocuments, saveDocument } from "../knowledge/repository";
import { adapter, providerConfig } from "./providers";
import {
  PROVIDERS,
  RESOURCE_PROVIDERS,
  type Provider,
  type ResourceProvider,
  type IntegrationResult,
} from "./model";
import {
  connectionRows,
  connectionState,
  integrationSettings,
  saveIntegrationSettings,
  saveMarketingRows,
} from "./repository";
import { credential } from "./google-vault";
import { IntegrationError } from "./http";
const running = new Set<string>();
export function integrations(wid: string) {
  readWorkspace(wid);
  return {
    states: connectionRows(wid),
    snapshots: database()
      .prepare(
        "SELECT provider,payload FROM provider_data WHERE workspace_id=?",
      )
      .all(wid)
      .map((r) => ({
        provider: String(r.provider),
        payload: JSON.parse(String(r.payload)) as IntegrationResult,
      })),
    providers: PROVIDERS.map((provider) => ({
      provider,
      ...providerConfig(provider, integrationSettings(wid, provider), wid),
    })),
  };
}
export async function integrationAction(
  wid: string,
  body: Record<string, unknown>,
) {
  readWorkspace(wid);
  if (!PROVIDERS.includes(body.provider as Provider))
    throw new IntegrationError("Nieznany dostawca integracji.", 400);
  const provider = body.provider as Provider,
    key = `${wid}:${provider}`;
  if (running.has(key))
    throw new IntegrationError(
      "Odczyt tej integracji już trwa. Poczekaj na wynik.",
      409,
    );
  if (
    body.action === "configure" &&
    RESOURCE_PROVIDERS.includes(provider as ResourceProvider)
  ) {
    return {
      resource: saveIntegrationSettings(
        wid,
        provider as ResourceProvider,
        body.resource,
      ),
      message: "Zapisano usługę dla tej przestrzeni. Teraz sprawdź odczyt API.",
    };
  }
  if (body.action === "disconnect") {
    connectionState(wid, provider, "disconnected");
    return {
      message:
        "Wyłączono odczyt w tej przestrzeni. Historia danych pozostaje w kopii bazy; dostępu Google nie cofnięto. Sekrety możesz usunąć z .env.local.",
    };
  }
  if (!["check", "sync"].includes(String(body.action)))
    throw new IntegrationError("Nieprawidłowa operacja.", 400);
  if (
    body.action === "sync" &&
    connectionRows(wid).some(
      (r) => r.provider === provider && r.status === "disconnected",
    )
  )
    throw new IntegrationError("Najpierw połącz integrację ponownie.", 400);
  const resource = integrationSettings(wid, provider);
  if (!providerConfig(provider, resource, wid).configured)
    throw new IntegrationError(
      "Uzupełnij konfigurację dostawcy i zapisz usługę w tej przestrzeni.",
      400,
    );
  running.add(key);
  try {
    const google =
      provider === "ga4" ||
      provider === "search_console" ||
      provider === "google_ads";
    const generation = google ? credential(wid)?.generation : undefined;
    const result = await adapter(provider, resource, wid).read();
    if (
      google &&
      (generation !== credential(wid)?.generation ||
        JSON.stringify(resource) !==
          JSON.stringify(integrationSettings(wid, provider)))
    )
      throw new IntegrationError(
        "Połączenie lub usługa Google zmieniły się w czasie odczytu. Pobierz raport ponownie.",
        409,
      );
    if (body.action === "sync") {
      if (result.documents) {
        const existing = listDocuments(wid);
        for (const d of result.documents) {
          const current = existing.find(
            (n) => n.category === "web" && n.title === d.title,
          );
          if (!current || current.content !== d.content) {
            const id = saveDocument(wid, {
              ...d,
              id: current?.id || "",
              category: "web",
              revision: current?.revision || 0,
            });
            const updated = {
              id,
              title: d.title,
              content: d.content,
              category: "web" as const,
              revision: (current?.revision || 0) + 1,
              updated_at: new Date().toISOString(),
            };
            if (current) Object.assign(current, updated);
            else existing.push(updated);
          }
        }
      }
      result.synced_at = new Date().toISOString();
      const campaigns = result.campaigns;
      if (campaigns) {
        if (campaigns.length) saveMarketingRows(wid, campaigns);
        delete result.campaigns;
      }
      transaction(() => {
        database()
          .prepare(
            "INSERT INTO provider_data VALUES(?,?,?) ON CONFLICT(workspace_id,provider) DO UPDATE SET payload=excluded.payload",
          )
          .run(wid, provider, JSON.stringify(result));
        connectionState(wid, provider, "checked");
        audit(wid, "integration.synced");
      });
    } else connectionState(wid, provider, "checked");
    return result;
  } catch (error) {
    const message =
      error instanceof IntegrationError
        ? error.message
        : "Odczyt nie został ukończony. Sprawdź konfigurację, format odpowiedzi i uprawnienia dostawcy. Import stron mógł zapisać wcześniejsze poprawne notatki.";
    connectionState(wid, provider, "error", message);
    throw new IntegrationError(
      message,
      error instanceof IntegrationError ? error.status : 502,
    );
  } finally {
    running.delete(key);
  }
}
