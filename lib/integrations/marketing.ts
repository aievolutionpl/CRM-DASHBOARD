export const SOURCES = [
  "google_ads",
  "microsoft_ads",
  "meta_ads",
  "organic",
  "gbp",
  "direct",
] as const;
export type Source = (typeof SOURCES)[number];
export const sourceLabels: Record<Source, string> = {
  google_ads: "Google Ads",
  microsoft_ads: "Microsoft Ads",
  meta_ads: "Meta Ads",
  organic: "Organic",
  gbp: "Profil Firmy Google",
  direct: "Bezpośrednie",
};
export type CampaignDay = {
  date: string;
  source: Source;
  campaign: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  qualified: number;
  revenue: number;
};
export function parseCsv(text: string): CampaignDay[] {
  if (text.length > 2_000_000) throw Error("CSV może mieć do 2 MB.");
  const delimiter = text.split(/\r?\n/)[0].includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" && !quoted) {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Niedomknięty cudzysłów w CSV.");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = (rows.shift() || []).map((h) =>
    h.replace(/^\uFEFF/, "").trim(),
  );
  const required = [
    "date",
    "source",
    "campaign",
    "spend",
    "impressions",
    "clicks",
    "leads",
    "qualified",
    "revenue",
  ];
  if (
    required.some((h) => !headers.includes(h)) ||
    new Set(headers).size !== headers.length
  )
    throw Error("CSV wymaga kolumn: " + required.join(", "));
  const data = rows
    .filter((r) => r.some((v) => v.trim()))
    .map((r, i) => {
      const get = (key: string) => r[headers.indexOf(key)]?.trim();
      if (r.length !== headers.length)
        throw Error(`Wiersz ${i + 2}: liczba kolumn.`);
      const d = {
        date: get("date"),
        source: get("source"),
        campaign: get("campaign"),
      } as CampaignDay;
      if (
        !d.date ||
        !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ||
        new Date(d.date).toISOString().slice(0, 10) !== d.date ||
        !SOURCES.includes(d.source) ||
        !d.campaign ||
        d.campaign.length > 200
      )
        throw Error(`Wiersz ${i + 2}: sprawdź datę, source i campaign.`);
      for (const k of [
        "spend",
        "impressions",
        "clicks",
        "leads",
        "qualified",
        "revenue",
      ] as const) {
        const raw = get(k);
        if (!raw || !/^\d+(?:[.,]\d+)?$/.test(raw))
          throw Error(`Wiersz ${i + 2}: nieprawidłowe ${k}.`);
        d[k] = Number(raw.replace(",", "."));
        if (
          !Number.isFinite(d[k]) ||
          d[k] > 1e12 ||
          (!["spend", "revenue"].includes(k) && !Number.isInteger(d[k]))
        )
          throw Error(`Wiersz ${i + 2}: zakres ${k}.`);
      }
      if (d.qualified > d.leads)
        throw Error(`Wiersz ${i + 2}: qualified nie może przekraczać leads.`);
      return d;
    });
  if (!data.length || data.length > 10000)
    throw Error("Import wymaga 1–10000 wierszy.");
  const keys = data.map((d) => `${d.date}:${d.source}:${d.campaign}`);
  if (new Set(keys).size !== keys.length)
    throw Error(
      "CSV zawiera powtórzone kampanie dla tego samego dnia i źródła.",
    );
  return data;
}
export function metrics(rows: CampaignDay[]) {
  const totals = rows.reduce(
    (s, r) => ({
      spend: s.spend + r.spend,
      clicks: s.clicks + r.clicks,
      leads: s.leads + r.leads,
      qualified: s.qualified + r.qualified,
      revenue: s.revenue + r.revenue,
    }),
    { spend: 0, clicks: 0, leads: 0, qualified: 0, revenue: 0 },
  );
  return {
    ...totals,
    cpa: totals.leads ? totals.spend / totals.leads : null,
    cpql: totals.qualified ? totals.spend / totals.qualified : null,
    cvr: totals.clicks ? (totals.leads / totals.clicks) * 100 : null,
    roas: totals.spend ? totals.revenue / totals.spend : null,
  };
}
