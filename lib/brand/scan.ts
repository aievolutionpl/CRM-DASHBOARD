import "server-only";
import { readPage, websiteUrl } from "../knowledge/research";
import { apiJson } from "../integrations/http";
import { auditScore, extractSite, type SiteFacts } from "./extract";
import { githubTarget, githubWebsite, summarizeGithub } from "./github";
import {
  emptyBrand,
  validateBrand,
  type BrandProfile,
  type BrandReview,
} from "./model";

type Json = Record<string, unknown>;

async function github(input: string) {
  const target = githubTarget(input);
  if (!target) return null;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Evolution-Growth-OS BrandStudio",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN)
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const api = (path: string) =>
    apiJson(`https://api.github.com${path}`, { headers }).catch((e: Error) => {
      throw Error(
        /HTTP 404/.test(e.message)
          ? "GitHub: nie znaleziono profilu lub repozytorium (albo jest prywatne)."
          : /HTTP 429/.test(e.message)
            ? "GitHub: limit zapytań wyczerpany. Spróbuj za godzinę lub ustaw GITHUB_TOKEN w .env.local."
            : /HTTP 403/.test(e.message)
              ? "GitHub odrzucił zapytanie (limit zapytań lub brak dostępu sieci do api.github.com). Ustaw GITHUB_TOKEN w .env.local lub spróbuj później."
              : `GitHub: ${e.message}`,
      );
    });
  const optional = <T>(promise: Promise<unknown>, fallback: T) =>
    promise.then((v) => v as T).catch(() => fallback);
  const repo = target.repo
    ? ((await api(`/repos/${target.owner}/${target.repo}`)) as Json)
    : undefined;
  const [profile, repos, languages] = await Promise.all([
    repo
      ? optional<Json>(
          api(`/users/${target.owner}`),
          (repo.owner as Json | undefined) ?? { login: target.owner },
        )
      : (api(`/users/${target.owner}`) as Promise<Json>),
    optional<Json[]>(
      api(`/users/${target.owner}/repos?per_page=100&sort=pushed`),
      [],
    ),
    repo
      ? optional<Record<string, number> | undefined>(
          api(`/repos/${target.owner}/${target.repo}/languages`),
          undefined,
        )
      : Promise.resolve(undefined),
  ]);
  return {
    url: target.url,
    data: summarizeGithub(
      profile,
      Array.isArray(repos) ? repos : [],
      repo,
      languages,
    ),
    website: githubWebsite(profile, repo),
    email: typeof profile.email === "string" ? profile.email : "",
    twitter:
      typeof profile.twitter_username === "string"
        ? profile.twitter_username
        : "",
  };
}

async function website(input: string) {
  const url = websiteUrl(input);
  const started = Date.now();
  const html = await readPage(url);
  const responseMs = Date.now() - started;
  let css = "";
  const first = extractSite(html, url.href);
  for (const sheet of first.stylesheets.slice(0, 2))
    try {
      css +=
        "\n" +
        (await readPage(websiteUrl(sheet.split("?")[0]), {
          types: /text\/css/i,
          limit: 800_000,
        }));
    } catch {}
  const facts = css ? extractSite(html, url.href, css) : first;
  const extras: { sitemap: boolean; robots: boolean } = {
    sitemap: false,
    robots: false,
  };
  await Promise.all(
    (["sitemap", "robots"] as const).map(async (key) => {
      try {
        await readPage(
          new URL(key === "sitemap" ? "/sitemap.xml" : "/robots.txt", url),
          {
            types: /xml|text\/plain/i,
            limit: 500_000,
          },
        );
        extras[key] = true;
      } catch {}
    }),
  );
  facts.checks.push(
    {
      id: "sitemap",
      label: "Mapa witryny sitemap.xml",
      ok: extras.sitemap,
      weight: 1,
      hint: "Dodaj /sitemap.xml i zgłoś ją w Google Search Console.",
    },
    {
      id: "robots",
      label: "Plik robots.txt",
      ok: extras.robots,
      weight: 1,
      hint: "Dodaj /robots.txt z adresem mapy witryny.",
    },
    {
      id: "speed",
      label: "Szybka odpowiedź serwera (< 1,5 s)",
      ok: responseMs < 1500,
      weight: 1,
      hint: `Pierwsza odpowiedź HTML zajęła ${(responseMs / 1000).toFixed(1)} s.`,
    },
  );
  return { facts, responseMs };
}

async function placeReviews(query: string) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key || !query) return null;
  const result = (await apiJson(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "places.displayName,places.rating,places.userRatingCount,places.googleMapsUri,places.formattedAddress,places.reviews",
      },
      body: JSON.stringify({
        textQuery: query,
        languageCode: "pl",
        maxResultCount: 1,
      }),
    },
    true,
  )) as { places?: Json[] };
  const place = result.places?.[0];
  if (!place) return null;
  const reviews: BrandReview[] = (
    Array.isArray(place.reviews) ? (place.reviews as Json[]) : []
  )
    .map((r) => ({
      author: String(
        (r.authorAttribution as Json | undefined)?.displayName ??
          "Klient Google",
      ),
      rating: typeof r.rating === "number" ? r.rating : null,
      text: String(
        (r.text as Json | undefined)?.text ??
          (r.originalText as Json | undefined)?.text ??
          "",
      ).slice(0, 600),
      date:
        typeof r.publishTime === "string"
          ? r.publishTime.slice(0, 10)
          : undefined,
      source: "Google",
    }))
    .filter((r) => r.text)
    .slice(0, 5);
  return {
    rating:
      typeof place.rating === "number"
        ? {
            value: place.rating,
            count:
              typeof place.userRatingCount === "number"
                ? place.userRatingCount
                : 0,
            source: "Google",
            url:
              typeof place.googleMapsUri === "string"
                ? place.googleMapsUri
                : "",
          }
        : null,
    reviews,
    address:
      typeof place.formattedAddress === "string" ? place.formattedAddress : "",
  };
}

export async function scanBrand(input: {
  website?: string;
  github?: string;
}): Promise<BrandProfile> {
  const warnings: string[] = [];
  const brand = emptyBrand();
  let gh: Awaited<ReturnType<typeof github>> = null;
  if (input.github?.trim())
    try {
      gh = await github(input.github);
    } catch (e) {
      warnings.push(
        e instanceof Error ? e.message : "Nie udało się odczytać GitHub.",
      );
    }
  let site = input.website?.trim() || gh?.website || "";
  if (site && !/^https?:\/\//i.test(site)) site = `https://${site}`;
  site = site.replace(/^http:\/\//i, "https://");
  let facts: SiteFacts | null = null;
  let responseMs: number | null = null;
  if (site)
    try {
      const result = await website(site);
      facts = result.facts;
      responseMs = result.responseMs;
    } catch (e) {
      warnings.push(
        `Strona www: ${e instanceof Error ? e.message : "nie udało się odczytać."}`,
      );
    }
  if (!facts && !gh)
    throw Error(
      warnings.join(" ") || "Podaj adres strony www lub link GitHub.",
    );
  if (facts) {
    brand.name = facts.name;
    brand.tagline = facts.tagline;
    brand.description = facts.description;
    brand.website = facts.url;
    brand.logo = facts.logo;
    brand.icon = facts.icon;
    brand.image = facts.image;
    brand.colors = {
      primary: facts.colors[0] ?? brand.colors.primary,
      accent: facts.colors[1] ?? brand.colors.accent,
      palette: facts.colors,
    };
    brand.fonts = facts.fonts;
    brand.headingFont = facts.fonts[0] ?? "";
    brand.language = facts.language;
    brand.contact = {
      emails: facts.emails,
      phones: facts.phones,
      address: facts.address,
      nip: facts.nip,
      city: facts.city,
    };
    brand.socials = facts.socials;
    brand.keywords = facts.keywords;
    brand.services = facts.services;
    brand.technologies = facts.technologies;
    brand.trackers = facts.trackers;
    brand.rating = facts.rating
      ? { ...facts.rating, source: "Strona firmy", url: facts.url }
      : null;
    brand.reviews = facts.reviews;
    brand.audit = {
      score: auditScore(facts.checks),
      checks: facts.checks,
      responseMs,
    };
    if (!facts.colors.length)
      warnings.push(
        "Nie wykryto kolorów marki w kodzie strony — ustaw je ręcznie poniżej.",
      );
  }
  if (gh) {
    brand.github = gh.url;
    brand.githubData = gh.data;
    if (!brand.name) brand.name = gh.data.name;
    if (!brand.description) brand.description = gh.data.bio;
    if (!brand.logo) brand.logo = gh.data.avatar;
    if (!brand.icon) brand.icon = gh.data.avatar;
    if (!brand.contact.city) brand.contact.city = gh.data.location;
    if (gh.email && !brand.contact.emails.includes(gh.email))
      brand.contact.emails.push(gh.email);
    if (!brand.socials.some((s) => s.network === "GitHub"))
      brand.socials.push({
        network: "GitHub",
        url: `https://github.com/${gh.data.login}`,
      });
    if (gh.twitter && !brand.socials.some((s) => s.network === "X"))
      brand.socials.push({ network: "X", url: `https://x.com/${gh.twitter}` });
    if (!brand.keywords.length) brand.keywords = gh.data.topics;
    if (!brand.technologies.length)
      brand.technologies = gh.data.languages.map((l) => l.name);
  }
  try {
    const places = await placeReviews(
      [brand.name, brand.contact.city].filter(Boolean).join(" "),
    );
    if (places) {
      if (places.rating) brand.rating = places.rating;
      if (places.reviews.length)
        brand.reviews = [...places.reviews, ...brand.reviews].slice(0, 8);
      if (!brand.contact.address) brand.contact.address = places.address;
    }
  } catch (e) {
    warnings.push(
      `Opinie Google: ${e instanceof Error ? e.message : "niedostępne."}`,
    );
  }
  if (!brand.rating && !brand.reviews.length)
    warnings.push(
      process.env.GOOGLE_PLACES_API_KEY
        ? "Nie znaleziono opinii — sprawdź nazwę firmy i miasto w Profilu Firmy w Google."
        : "Opinie Google: ustaw GOOGLE_PLACES_API_KEY w .env.local, aby pobrać ocenę i recenzje z Map Google.",
    );
  brand.warnings = warnings;
  brand.scannedAt = new Date().toISOString();
  return validateBrand(brand)!;
}
