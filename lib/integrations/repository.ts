import "server-only";
import { database, transaction, audit } from "../local/database";
import { validateResource } from "./model";
import { parseCsv, type CampaignDay } from "./marketing";
export function marketingRows(wid: string) {
  return database()
    .prepare(
      "SELECT payload FROM campaign_days WHERE workspace_id=? ORDER BY date DESC",
    )
    .all(wid)
    .map((r) => JSON.parse(String(r.payload)) as CampaignDay);
}
export function importMarketing(wid: string, csv: string) {
  return saveMarketingRows(wid, parseCsv(csv));
}
function upsertMarketingRows(wid: string, rows: CampaignDay[]) {
  const q = database().prepare(
    "INSERT INTO campaign_days VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,date,source,campaign) DO UPDATE SET payload=excluded.payload",
  );
  for (const row of rows)
    q.run(wid, row.date, row.source, row.campaign, JSON.stringify(row));
  audit(wid, "marketing.imported");
}
export function saveMarketingRows(wid: string, rows: CampaignDay[]) {
  transaction(() => upsertMarketingRows(wid, rows));
  return rows.length;
}
export function replaceMarketingWindow(
  wid: string,
  source: CampaignDay["source"],
  from: string,
  rows: CampaignDay[],
) {
  transaction(() => {
    database()
      .prepare(
        "DELETE FROM campaign_days WHERE workspace_id=? AND source=? AND date>=?",
      )
      .run(wid, source, from);
    upsertMarketingRows(wid, rows);
  });
  return rows.length;
}
export function connectionRows(wid: string) {
  return database()
    .prepare(
      "SELECT provider,status,last_sync,error FROM connections WHERE workspace_id=?",
    )
    .all(wid);
}
export function connectionState(
  wid: string,
  provider: string,
  status: string,
  error: string | null = null,
) {
  database()
    .prepare(
      "INSERT INTO connections VALUES(?,?,?,?,?) ON CONFLICT(workspace_id,provider) DO UPDATE SET status=excluded.status,last_sync=COALESCE(excluded.last_sync,connections.last_sync),error=excluded.error",
    )
    .run(
      wid,
      provider,
      status,
      status === "checked" ? new Date().toISOString() : null,
      error,
    );
}

export function integrationSettings(wid: string, provider: string) {
  database().exec(
    "CREATE TABLE IF NOT EXISTS integration_settings(workspace_id TEXT NOT NULL REFERENCES workspaces(id),provider TEXT NOT NULL,config TEXT NOT NULL,PRIMARY KEY(workspace_id,provider))",
  );
  const row = database()
    .prepare(
      "SELECT config FROM integration_settings WHERE workspace_id=? AND provider=?",
    )
    .get(wid, provider);
  return row
    ? (JSON.parse(String(row.config)) as import("./model").Resource)
    : {};
}
export function saveIntegrationSettings(
  wid: string,
  provider: import("./model").ResourceProvider,
  value: unknown,
) {
  const resource = validateResource(provider, value);
  const previous = integrationSettings(wid, provider);
  if (JSON.stringify(previous) === JSON.stringify(resource)) return resource;
  transaction(() => {
    database()
      .prepare(
        "INSERT INTO integration_settings VALUES(?,?,?) ON CONFLICT(workspace_id,provider) DO UPDATE SET config=excluded.config",
      )
      .run(wid, provider, JSON.stringify(resource));
    database()
      .prepare("DELETE FROM provider_data WHERE workspace_id=? AND provider=?")
      .run(wid, provider);
    database()
      .prepare("DELETE FROM connections WHERE workspace_id=? AND provider=?")
      .run(wid, provider);
    if (provider === "meta_ads" && Object.keys(previous).length)
      database()
        .prepare(
          "DELETE FROM campaign_days WHERE workspace_id=? AND source='meta_ads'",
        )
        .run(wid);
    connectionState(wid, provider, "configured");
    audit(wid, "integration.configured");
  });
  return resource;
}
