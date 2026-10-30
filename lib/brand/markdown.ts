import { competitorGaps, toCompetitor, type BrandProfile } from "./model";

const list = (items: string[]) =>
  items.length ? items.map((i) => `- ${i}`).join("\n") : "- MISSING";

export function brandNoteTitle(brand: Pick<BrandProfile, "name">) {
  const name = brand.name.replace(/[\[\]<>:"|?*\\/\x00-\x1f]/g, " ").trim();
  return `Profil marki — ${name || "Moja firma"}`
    .slice(0, 100)
    .replace(/\.+$/, "");
}

export function brandMarkdown(brand: BrandProfile) {
  const gh = brand.githubData;
  const failed = brand.audit.checks.filter((c) => !c.ok);
  return [
    `# ${brand.name || "Moja firma"}`,
    "",
    brand.tagline ? `> ${brand.tagline}` : "",
    "",
    `Źródła: ${[brand.website, brand.github].filter(Boolean).join(" · ") || "MISSING"}`,
    `Zeskanowano: ${brand.scannedAt.slice(0, 10) || "—"} (dane publiczne, CONFIRMED tylko jeśli widoczne na stronie).`,
    "",
    "## Opis",
    brand.description || "MISSING",
    "",
    "## Identyfikacja wizualna",
    `- Kolor główny: ${brand.colors.primary}`,
    `- Kolor akcentu: ${brand.colors.accent}`,
    `- Paleta: ${brand.colors.palette.join(", ") || "—"}`,
    `- Czcionki: ${brand.fonts.join(", ") || "—"}`,
    brand.logo ? `- Logo: ${brand.logo}` : "- Logo: MISSING",
    "",
    "## Kontakt",
    `- E-mail: ${brand.contact.emails.join(", ") || "MISSING"}`,
    `- Telefon: ${brand.contact.phones.join(", ") || "MISSING"}`,
    `- Adres: ${brand.contact.address || brand.contact.city || "MISSING"}`,
    `- NIP: ${brand.contact.nip || "MISSING"}`,
    "",
    "## Social media",
    list(brand.socials.map((s) => `${s.network}: ${s.url}`)),
    "",
    "## Oferta i komunikaty ze strony",
    list(brand.services),
    "",
    "## Słowa kluczowe",
    list(brand.keywords),
    "",
    "## Opinie",
    brand.rating
      ? `Ocena ${brand.rating.value.toFixed(1)}/5 (${brand.rating.count} opinii, ${brand.rating.source}).`
      : "Brak ocen w źródłach — TO CONFIRM w Profilu Firmy w Google.",
    ...brand.reviews.map(
      (r) =>
        `- **${r.author}**${r.rating ? ` (${r.rating}/5)` : ""}: ${r.text.replace(/\n/g, " ")}`,
    ),
    "",
    `## Audyt strony — ${brand.audit.score}/100`,
    failed.length
      ? failed.map((c) => `- [ ] ${c.label} — ${c.hint}`).join("\n")
      : "- Wszystkie sprawdzane elementy są poprawne.",
    "",
    "## Technologia i pomiar",
    `- Platforma: ${brand.technologies.join(", ") || "—"}`,
    `- Analityka i piksele: ${brand.trackers.join(", ") || "brak wykrytych"}`,
    ...(gh
      ? [
          "",
          "## GitHub",
          `- Profil: ${gh.url}`,
          `- Gwiazdki: ${gh.stars} · forki: ${gh.forks} · repozytoria: ${gh.publicRepos} · obserwujący: ${gh.followers}`,
          `- Języki: ${gh.languages.map((l) => `${l.name} ${l.share}%`).join(", ") || "—"}`,
          ...gh.repos.map(
            (r) =>
              `- [${r.name}](${r.url}) ★${r.stars} — ${r.description || "bez opisu"}`,
          ),
        ]
      : []),
    "",
  ]
    .filter((line, i, all) => !(line === "" && all[i - 1] === ""))
    .join("\n");
}

export function competitorsMarkdown(brand: BrandProfile) {
  const own = toCompetitor(brand);
  const all = [{ ...own, name: `${own.name} (my)` }, ...brand.competitors];
  const cell = (v: string | number | null) =>
    v === null || v === "" ? "—" : String(v);
  return [
    `# Konkurencja — ${brand.name || "Moja firma"}`,
    "",
    `Porównanie publicznych stron z ${new Date().toISOString().slice(0, 10)}. Dane z odczytu HTML i schema.org — TO CONFIRM przed użyciem w komunikacji.`,
    "",
    `| Firma | Strona | Wynik strony | Ocena | Opinie | Analityka | Social media | Platforma |`,
    `| --- | --- | --- | --- | --- | --- | --- | --- |`,
    ...all.map(
      (c) =>
        `| ${c.name} | ${c.website || "—"} | ${cell(c.score)} | ${c.rating === null ? "—" : c.rating.toFixed(1)} | ${c.reviews} | ${c.trackers.join(", ") || "brak"} | ${c.socials} | ${c.technologies.join(", ") || "—"} |`,
    ),
    "",
    "## Gdzie konkurencja wygrywa",
    ...(competitorGaps(brand).map((g) => `- ${g}`).length
      ? competitorGaps(brand).map((g) => `- ${g}`)
      : ["- Nie wykryto przewag konkurencji w mierzonych obszarach."]),
    "",
    ...brand.competitors.flatMap((c) => [
      `## ${c.name}`,
      `- Strona: ${c.website}`,
      `- Oferta i komunikaty: ${c.services.join("; ") || "MISSING"}`,
      `- Braki na stronie: ${c.failed.join("; ") || "brak wykrytych"}`,
      "",
    ]),
  ].join("\n");
}
