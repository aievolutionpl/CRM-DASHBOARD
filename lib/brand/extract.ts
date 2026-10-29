import { toOklch, type BrandCheck, type BrandReview } from "./model";

export type SiteFacts = {
  url: string;
  name: string;
  tagline: string;
  description: string;
  logo: string;
  icon: string;
  image: string;
  colors: string[];
  fonts: string[];
  language: string;
  emails: string[];
  phones: string[];
  address: string;
  city: string;
  nip: string;
  socials: { network: string; url: string }[];
  keywords: string[];
  services: string[];
  technologies: string[];
  trackers: string[];
  rating: { value: number; count: number } | null;
  reviews: BrandReview[];
  stylesheets: string[];
  checks: BrandCheck[];
};

const ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  oacute: "ó",
  Oacute: "Ó",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};
export function decode(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTITIES[e] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}
const strip = (html: string) =>
  decode(
    html
      .replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
function attrs(tag: string) {
  const result: Record<string, string> = {};
  for (const m of tag.matchAll(
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g,
  ))
    result[m[1].toLowerCase()] = decode(m[3] ?? m[4] ?? m[5] ?? "");
  return result;
}
function tags(html: string, name: string) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((m) =>
    attrs(m[0]),
  );
}
function absolute(value: string | undefined, base: URL) {
  if (!value || /^(data|javascript|mailto|tel):/i.test(value)) return "";
  try {
    const url = new URL(value, base);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}
function meta(html: string, key: string) {
  const k = key.toLowerCase();
  return (
    tags(html, "meta").find(
      (m) => (m.name ?? m.property ?? m.itemprop ?? "").toLowerCase() === k,
    )?.content ?? ""
  );
}
const unique = <T>(items: T[]) => [...new Set(items)];
const slug = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/gi, "l")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

type Json = Record<string, unknown>;
export function jsonLd(html: string) {
  const out: Json[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") {
      out.push(node as Json);
      const graph = (node as Json)["@graph"];
      if (graph) visit(graph);
    }
  };
  for (const m of html.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  ))
    try {
      visit(JSON.parse(m[1].trim()));
    } catch {}
  return out;
}
const typeOf = (node: Json) =>
  ([] as unknown[]).concat(node["@type"] ?? []).map(String);
const ORG =
  /Organization|LocalBusiness|Corporation|Store|Restaurant|Service|Company|Agency|Professional|Dentist|Clinic|Shop|Hotel|Brand|Product/i;
const text = (v: unknown): string =>
  typeof v === "string"
    ? decode(v)
    : typeof v === "number"
      ? String(v)
      : v && typeof v === "object" && "name" in (v as Json)
        ? text((v as Json).name)
        : "";
const imageUrl = (v: unknown): string =>
  typeof v === "string"
    ? v
    : Array.isArray(v)
      ? imageUrl(v[0])
      : v && typeof v === "object"
        ? text((v as Json).url ?? (v as Json).contentUrl)
        : "";

export function normalizeColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  let m = v.match(/^#([0-9a-f]{3,8})$/);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4)
      return `#${h
        .slice(0, 3)
        .split("")
        .map((c) => c + c)
        .join("")}`;
    if (h.length === 6 || h.length === 8) return `#${h.slice(0, 6)}`;
    return null;
  }
  m = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m)
    return `#${[m[1], m[2], m[3]]
      .map((x) => Math.min(255, Number(x)).toString(16).padStart(2, "0"))
      .join("")}`;
  return null;
}
export function brandish(color: string) {
  const { l, c } = toOklch(color);
  return c > 0.06 && l > 0.25 && l < 0.88;
}
export function rankColors(css: string, preferred: string[] = []) {
  const named: string[] = [];
  for (const m of css.matchAll(
    /--([\w-]*(?:primary|brand|accent|main|theme|secondary)[\w-]*)\s*:\s*(#[0-9a-f]{3,8}\b|rgba?\([^)]*\))/gi,
  )) {
    const c = normalizeColor(m[2]);
    if (c && brandish(c)) named.push(c);
  }
  const counts = new Map<string, number>();
  for (const m of css.matchAll(
    /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi,
  )) {
    const c = normalizeColor(m[0]);
    if (c && brandish(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const frequent = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
  const ordered = unique([
    ...preferred
      .map(normalizeColor)
      .filter((c): c is string => !!c && brandish(c)),
    ...named,
    ...frequent,
  ]);
  const distinct: string[] = [];
  for (const c of ordered) {
    const h = toOklch(c).h;
    if (
      distinct.every((d) => {
        const diff = Math.abs(toOklch(d).h - h);
        return Math.min(diff, 360 - diff) > 18;
      })
    )
      distinct.push(c);
    if (distinct.length >= 6) break;
  }
  return distinct;
}
export function fontFamilies(html: string, css: string) {
  const fonts: string[] = [];
  for (const link of tags(html, "link"))
    if (/fonts\.googleapis\.com/i.test(link.href ?? ""))
      for (const m of (link.href ?? "").matchAll(/family=([^&:;]+)/g))
        fonts.push(decodeURIComponent(m[1]).replace(/\+/g, " "));
  for (const m of css.matchAll(
    /@import\s+url\(["']?[^)"']*fonts\.googleapis\.com[^)"']*family=([^&:;)"']+)/gi,
  ))
    fonts.push(decodeURIComponent(m[1]).replace(/\+/g, " "));
  for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    const first = m[1].split(",")[0].replace(/["']/g, "").trim();
    if (
      first &&
      !/^(inherit|initial|var\(|-apple-system|system-ui|sans-serif|serif|monospace|arial|helvetica|times|georgia|verdana|tahoma|segoe|roboto mono|courier|dashicons|font ?awesome|eicons|swiper|icomoon|star|wp|ui-)/i.test(
        first,
      ) &&
      first.length < 40
    )
      fonts.push(first);
  }
  const counts = new Map<string, number>();
  for (const f of fonts) counts.set(f, (counts.get(f) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([f]) => f)
    .slice(0, 4);
}
const SOCIAL: [string, RegExp][] = [
  ["Facebook", /facebook\.com\/(?!sharer|share|dialog|tr\b|plugins)/i],
  ["Instagram", /instagram\.com\/(?!p\/)/i],
  ["LinkedIn", /linkedin\.com\/(company|in|school)\//i],
  ["YouTube", /youtube\.com\/(@|c\/|channel\/|user\/)/i],
  ["TikTok", /tiktok\.com\/@/i],
  ["X", /(twitter|x)\.com\/(?!intent|share|home)[A-Za-z0-9_]+\/?$/i],
  ["GitHub", /github\.com\/[A-Za-z0-9-]+\/?$/i],
  ["Pinterest", /pinterest\.[a-z.]+\/(?!pin\/create)/i],
  ["Google", /(g\.page|maps\.app\.goo\.gl|google\.[a-z.]+\/maps)/i],
];
const TECH: [string, RegExp][] = [
  ["WordPress", /wp-content|wp-includes|wordpress/i],
  ["WooCommerce", /woocommerce/i],
  ["Elementor", /elementor/i],
  ["Shopify", /cdn\.shopify\.com|shopify/i],
  ["Wix", /wixstatic|wix\.com/i],
  ["Webflow", /webflow/i],
  ["Squarespace", /squarespace/i],
  ["Next.js", /\/_next\/|__NEXT_DATA__/],
  ["Nuxt", /\/_nuxt\//],
  ["Gatsby", /gatsby/i],
  ["PrestaShop", /prestashop/i],
  ["Shoper", /shoper/i],
  ["Framer", /framerusercontent|framer\.com/i],
  ["Tailwind CSS", /tailwind/i],
  ["Bootstrap", /bootstrap(\.min)?\.(css|js)/i],
  ["Cloudflare", /cdnjs\.cloudflare|cloudflareinsights|__cf/i],
];
const TRACKERS: [string, RegExp][] = [
  ["Google Analytics 4", /gtag\/js\?id=G-|['"]G-[A-Z0-9]{6,}['"]/],
  ["Google Tag Manager", /googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]{4,}/],
  ["Google Ads", /AW-[0-9]{6,}|googleadservices/],
  ["Meta Pixel", /connect\.facebook\.net\/[^"']*fbevents|fbq\(/],
  ["Hotjar", /hotjar/i],
  ["Microsoft Clarity", /clarity\.ms/i],
  ["LinkedIn Insight", /snap\.licdn\.com/i],
  ["TikTok Pixel", /analytics\.tiktok\.com/i],
  ["PostHog", /posthog/i],
  ["Plausible", /plausible\.io/i],
  ["Matomo", /matomo|piwik/i],
  [
    "Cookiebot / CMP",
    /cookiebot|cookieyes|onetrust|cookie-law-info|complianz/i,
  ],
];

export function extractSite(
  html: string,
  pageUrl: string,
  css = "",
): SiteFacts {
  const base = new URL(pageUrl);
  const head =
    html.match(/<head\b[\s\S]*?<\/head>/i)?.[0] ?? html.slice(0, 60000);
  const body = html.match(/<body\b[\s\S]*<\/body>/i)?.[0] ?? html;
  const nodes = jsonLd(html);
  const org =
    nodes.find((n) => typeOf(n).some((t) => ORG.test(t)) && n.name) ??
    nodes.find((n) => n.name && (n.logo || n.address));
  const site = nodes.find((n) => typeOf(n).includes("WebSite"));
  const title = decode(
    head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
  );
  const ogSite = meta(head, "og:site_name");
  const description = meta(head, "description") || meta(head, "og:description");
  const h1s = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
    .map((m) => strip(m[1]))
    .filter(Boolean);
  const h2s = [...body.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((m) => strip(m[1]))
    .filter((t) => t.length > 3 && t.length < 90);
  const titleParts = title
    .split(/\s[|–—\-·:]\s/)
    .map((t) => t.trim())
    .filter(Boolean);
  const label = slug(base.hostname.replace(/^www\./, "").split(".")[0]);
  const domainPart = titleParts.find(
    (t) =>
      label.length > 2 &&
      (slug(t).includes(label) ||
        (label.includes(slug(t)) && slug(t).length > 2)),
  );
  const name =
    text(org?.name) ||
    ogSite ||
    text(site?.name) ||
    domainPart?.replace(/\.(pl|com|eu|net|org|com\.pl)$/i, "") ||
    (titleParts.length > 1
      ? titleParts[titleParts.length - 1]
      : titleParts[0]) ||
    base.hostname.replace(/^www\./, "");
  const links = tags(html, "link");
  const iconLink = (re: RegExp) =>
    links
      .filter((l) => re.test(l.rel ?? ""))
      .sort((a, b) => parseInt(b.sizes ?? "0") - parseInt(a.sizes ?? "0"))[0]
      ?.href;
  const imgs = tags(body, "img");
  const logoImg =
    imgs.find((i) =>
      /logo/i.test(
        `${i.class ?? ""} ${i.id ?? ""} ${i.alt ?? ""} ${i.src ?? ""}`,
      ),
    ) ??
    imgs
      .slice(0, 6)
      .find((i) => label.length > 2 && slug(i.alt ?? "").includes(label));
  const logo =
    absolute(imageUrl(org?.logo), base) ||
    absolute(logoImg?.src ?? logoImg?.["data-src"], base) ||
    absolute(iconLink(/apple-touch-icon/i), base);
  const icon =
    absolute(iconLink(/apple-touch-icon/i), base) ||
    absolute(iconLink(/\bicon\b/i), base) ||
    absolute("/favicon.ico", base);
  const image = absolute(
    meta(head, "og:image") || meta(head, "twitter:image"),
    base,
  );
  const inlineCss = [
    ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
      (m) => m[1],
    ),
    ...[...html.matchAll(/\sstyle=["']([^"']+)["']/gi)].map((m) => m[1]),
  ].join("\n");
  const preferred = [
    meta(head, "theme-color"),
    meta(head, "msapplication-TileColor"),
  ].filter(Boolean);
  const colors = rankColors(`${inlineCss}\n${css}`, preferred);
  const fonts = fontFamilies(html, `${inlineCss}\n${css}`);
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) =>
    decode(m[1]),
  );
  const emails = unique([
    ...hrefs
      .filter((h) => /^mailto:/i.test(h))
      .map((h) => h.slice(7).split("?")[0]),
    ...[...strip(body).matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+[a-z]/gi)].map(
      (m) => m[0],
    ),
    ...(typeof org?.email === "string"
      ? [org.email.replace(/^mailto:/i, "")]
      : []),
  ])
    .map((e) => e.toLowerCase())
    .filter(
      (e) =>
        /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(e) &&
        !/\.(png|jpg|webp|svg)$/.test(e) &&
        !/sentry|example|wixpress/.test(e),
    )
    .slice(0, 4);
  const phones = unique([
    ...hrefs
      .filter((h) => /^tel:/i.test(h))
      .map((h) => decodeURIComponent(h.slice(4)).trim()),
    ...(typeof org?.telephone === "string" ? [org.telephone] : []),
  ])
    .filter((p) => p.replace(/\D/g, "").length >= 7)
    .filter(
      (p, i, all) =>
        all.findIndex(
          (q) =>
            q.replace(/\D/g, "").slice(-9) === p.replace(/\D/g, "").slice(-9),
        ) === i,
    )
    .slice(0, 3);
  const addr = (org?.address ?? null) as Json | string | null;
  const address =
    typeof addr === "string"
      ? decode(addr)
      : addr
        ? [addr.streetAddress, addr.postalCode, addr.addressLocality]
            .map((x) => text(x))
            .filter(Boolean)
            .join(", ")
        : "";
  const city =
    addr && typeof addr === "object" ? text(addr.addressLocality) : "";
  const nipMatch = strip(body).match(
    /NIP[:\s.]*((?:PL)?\s?\d{3}[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2}|\d{3}[-\s]?\d{2}[-\s]?\d{2}[-\s]?\d{3})/i,
  );
  const nip = nipMatch ? nipMatch[1].replace(/\D/g, "").slice(-10) : "";
  const sameAs = ([] as unknown[]).concat(org?.sameAs ?? []).map(String);
  const socials: { network: string; url: string }[] = [];
  for (const href of unique([...sameAs, ...hrefs])) {
    const url = absolute(href, base);
    if (!url) continue;
    const hit = SOCIAL.find(([, re]) => re.test(url));
    if (hit && !socials.some((s) => s.network === hit[0]))
      socials.push({ network: hit[0], url });
  }
  const keywordMeta = meta(head, "keywords")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k && k.length < 40);
  const navText = [...html.matchAll(/<nav\b[\s\S]*?<\/nav>/gi)]
    .flatMap((n) =>
      [...n[0].matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => strip(m[1])),
    )
    .filter((t) => t.length > 2 && t.length < 30);
  const offers = nodes
    .filter((n) => typeOf(n).some((t) => /Service|Product|Offer/i.test(t)))
    .map((n) => text(n.name))
    .filter(Boolean);
  const services = unique([...offers, ...h2s]).slice(0, 8);
  const technologies = TECH.filter(([, re]) => re.test(html)).map(([n]) => n);
  const trackers = TRACKERS.filter(([, re]) => re.test(html)).map(([n]) => n);
  const ratingNode = (org?.aggregateRating ??
    nodes.find((n) => n.aggregateRating)?.aggregateRating ??
    nodes.find((n) => typeOf(n).includes("AggregateRating"))) as
    | Json
    | undefined;
  const best = Number(text(ratingNode?.bestRating)) || 5;
  const rating =
    ratingNode && Number(text(ratingNode.ratingValue))
      ? {
          value:
            Math.round((Number(text(ratingNode.ratingValue)) / best) * 5 * 10) /
            10,
          count:
            Number(text(ratingNode.reviewCount ?? ratingNode.ratingCount)) || 0,
        }
      : null;
  const reviews: BrandReview[] = nodes
    .flatMap((n) =>
      typeOf(n).includes("Review")
        ? [n]
        : ([] as unknown[]).concat(n.review ?? []),
    )
    .filter((r): r is Json => !!r && typeof r === "object")
    .map((r) => {
      const rr = r.reviewRating as Json | undefined;
      const value = Number(text(rr?.ratingValue));
      return {
        author: text(r.author) || "Klient",
        rating:
          Number.isFinite(value) && value > 0
            ? Math.round(
                (value / (Number(text(rr?.bestRating)) || 5)) * 5 * 10,
              ) / 10
            : null,
        text: text(r.reviewBody ?? r.description).slice(0, 600),
        date: text(r.datePublished).slice(0, 10) || undefined,
        source: "Strona firmy (schema.org)",
      };
    })
    .filter((r) => r.text)
    .slice(0, 6);
  const language = (
    html.match(/<html\b[^>]*\blang=["']?([\w-]+)/i)?.[1] ?? ""
  ).toLowerCase();
  const stylesheets = links
    .filter((l) => /stylesheet/i.test(l.rel ?? "") && l.href)
    .map((l) => absolute(l.href, base))
    .filter(
      (u) =>
        u &&
        new URL(u).hostname.replace(/^www\./, "") ===
          base.hostname.replace(/^www\./, ""),
    )
    .slice(0, 3);
  const robots = meta(head, "robots").toLowerCase();
  const withAlt = imgs.filter((i) => typeof i.alt === "string").length;
  const check = (
    id: string,
    label: string,
    ok: boolean,
    weight: number,
    hint: string,
  ): BrandCheck => ({ id, label, ok, weight, hint });
  const checks = [
    check(
      "https",
      "Strona działa po HTTPS",
      base.protocol === "https:",
      2,
      "Włącz certyfikat SSL i przekierowanie na HTTPS.",
    ),
    check(
      "title",
      "Tytuł strony 10–65 znaków",
      title.length >= 10 && title.length <= 65,
      2,
      `Obecnie ${title.length} znaków. Zawrzyj usługę i lokalizację.`,
    ),
    check(
      "description",
      "Opis meta 50–160 znaków",
      description.length >= 50 && description.length <= 160,
      2,
      `Obecnie ${description.length} znaków. Opis wpływa na CTR w Google.`,
    ),
    check(
      "h1",
      "Dokładnie jeden nagłówek H1",
      h1s.length === 1,
      1,
      `Znaleziono ${h1s.length}. Jeden H1 jasno mówi, czym zajmuje się firma.`,
    ),
    check(
      "lang",
      "Atrybut języka strony",
      !!language,
      1,
      'Dodaj lang="pl" do znacznika <html>.',
    ),
    check(
      "viewport",
      "Wersja mobilna (viewport)",
      !!meta(head, "viewport"),
      2,
      "Dodaj meta viewport — Google indeksuje wersję mobilną.",
    ),
    check(
      "canonical",
      "Adres kanoniczny",
      links.some((l) => /canonical/i.test(l.rel ?? "")),
      1,
      'Dodaj link rel="canonical", aby uniknąć duplikatów.',
    ),
    check(
      "og",
      "Podgląd w social media (Open Graph)",
      !!meta(head, "og:title") && !!image,
      1,
      "Dodaj og:title i og:image — link ładnie wygląda na Facebooku i LinkedIn.",
    ),
    check(
      "schema",
      "Dane strukturalne firmy (schema.org)",
      !!org,
      2,
      "Dodaj JSON-LD Organization lub LocalBusiness z adresem i logo.",
    ),
    check(
      "alt",
      "Opisy alternatywne obrazów",
      !imgs.length || withAlt / imgs.length >= 0.8,
      1,
      `${withAlt} z ${imgs.length} obrazów ma atrybut alt.`,
    ),
    check(
      "indexable",
      "Strona może być indeksowana",
      !/noindex/.test(robots),
      3,
      "Usuń noindex z meta robots, jeśli strona ma być w Google.",
    ),
    check(
      "contact",
      "Widoczny kontakt (e-mail lub telefon)",
      emails.length + phones.length > 0,
      2,
      "Dodaj klikalny telefon i e-mail — to podstawa konwersji.",
    ),
    check(
      "analytics",
      "Pomiar ruchu (GA4/GTM lub inny)",
      trackers.some((t) => !/Cookie/.test(t)),
      2,
      "Brak wykrytej analityki. Podłącz GA4, aby mierzyć efekty.",
    ),
    check(
      "size",
      "Lekki HTML (< 600 KB)",
      html.length < 600_000,
      1,
      `HTML ma ${Math.round(html.length / 1024)} KB.`,
    ),
  ];
  return {
    url: base.href,
    name: name.slice(0, 120),
    tagline: (
      h1s[0] ||
      titleParts.find((t) => t !== domainPart && slug(t) !== slug(name)) ||
      ""
    ).slice(0, 200),
    description: (description || text(org?.description)).slice(0, 1000),
    logo,
    icon,
    image,
    colors,
    fonts,
    language,
    emails,
    phones,
    address,
    city,
    nip,
    socials: socials.slice(0, 8),
    keywords: unique([...keywordMeta, ...navText]).slice(0, 14),
    services,
    technologies,
    trackers,
    rating,
    reviews,
    stylesheets,
    checks,
  };
}
export function auditScore(checks: BrandCheck[]) {
  const total = checks.reduce((s, c) => s + c.weight, 0);
  return total
    ? Math.round(
        (checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0) / total) *
          100,
      )
    : 0;
}
