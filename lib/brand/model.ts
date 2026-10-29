export type BrandReview = {
  author: string;
  rating: number | null;
  text: string;
  date?: string;
  source: string;
};
export type BrandCheck = {
  id: string;
  label: string;
  ok: boolean;
  weight: number;
  hint: string;
};
export type BrandRepo = {
  name: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  url: string;
  pushed: string;
};
export type BrandGithub = {
  login: string;
  name: string;
  url: string;
  avatar: string;
  bio: string;
  location: string;
  followers: number;
  publicRepos: number;
  stars: number;
  forks: number;
  openIssues: number;
  lastPush: string;
  languages: { name: string; share: number }[];
  topics: string[];
  repos: BrandRepo[];
};
export type BrandPoint = {
  at: string;
  score: number | null;
  rating: number | null;
  reviews: number;
  stars: number | null;
  issues: number;
};
export type Competitor = {
  name: string;
  website: string;
  logo: string;
  scannedAt: string;
  score: number | null;
  rating: number | null;
  reviews: number;
  trackers: string[];
  technologies: string[];
  socials: number;
  services: string[];
  failed: string[];
  responseMs: number | null;
  color: string;
};
export type BrandProfile = {
  name: string;
  tagline: string;
  description: string;
  website: string;
  github: string;
  logo: string;
  icon: string;
  image: string;
  colors: { primary: string; accent: string; palette: string[] };
  fonts: string[];
  headingFont: string;
  useFont: boolean;
  language: string;
  contact: {
    emails: string[];
    phones: string[];
    address: string;
    nip: string;
    city: string;
  };
  socials: { network: string; url: string }[];
  keywords: string[];
  services: string[];
  technologies: string[];
  trackers: string[];
  rating: { value: number; count: number; source: string; url: string } | null;
  reviews: BrandReview[];
  audit: { score: number; checks: BrandCheck[]; responseMs: number | null };
  githubData: BrandGithub | null;
  warnings: string[];
  scannedAt: string;
  applied: boolean;
  history: BrandPoint[];
  competitors: Competitor[];
};

const LIMIT = 120_000;
const hex = /^#[0-9a-f]{6}$/i;
const str = (v: unknown, max = 500) =>
  typeof v === "string" ? v.slice(0, max) : "";
const num = (v: unknown, fallback = 0) =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const strings = (v: unknown, count = 20, max = 300) =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === "string")
        .slice(0, count)
        .map((x) => x.slice(0, max))
    : [];
export const safeUrl = (v: unknown) => {
  const value = str(v, 2048);
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};
const color = (v: unknown, fallback: string) =>
  typeof v === "string" && hex.test(v) ? v.toLowerCase() : fallback;

export function emptyBrand(): BrandProfile {
  return {
    name: "",
    tagline: "",
    description: "",
    website: "",
    github: "",
    logo: "",
    icon: "",
    image: "",
    colors: { primary: "#6842ff", accent: "#10b981", palette: [] },
    fonts: [],
    headingFont: "",
    useFont: false,
    language: "",
    contact: { emails: [], phones: [], address: "", nip: "", city: "" },
    socials: [],
    keywords: [],
    services: [],
    technologies: [],
    trackers: [],
    rating: null,
    reviews: [],
    audit: { score: 0, checks: [], responseMs: null },
    githubData: null,
    warnings: [],
    scannedAt: "",
    applied: false,
    history: [],
    competitors: [],
  };
}

export function validateBrand(value: unknown): BrandProfile | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object") throw Error("Nieprawidłowy profil marki.");
  if (JSON.stringify(value).length > LIMIT)
    throw Error("Profil marki przekracza dozwolony rozmiar.");
  const v = value as Partial<BrandProfile>;
  const base = emptyBrand();
  const g = v.githubData as Partial<BrandGithub> | null | undefined;
  return {
    name: str(v.name, 120),
    tagline: str(v.tagline, 240),
    description: str(v.description, 1200),
    website: safeUrl(v.website),
    github: safeUrl(v.github),
    logo: safeUrl(v.logo),
    icon: safeUrl(v.icon),
    image: safeUrl(v.image),
    colors: {
      primary: color(v.colors?.primary, base.colors.primary),
      accent: color(v.colors?.accent, base.colors.accent),
      palette: strings(v.colors?.palette, 8, 7).filter((c) => hex.test(c)),
    },
    fonts: strings(v.fonts, 6, 60),
    headingFont: str(v.headingFont, 60).replace(/[^\w \-]/g, ""),
    useFont: v.useFont === true,
    language: str(v.language, 12),
    contact: {
      emails: strings(v.contact?.emails, 5, 120),
      phones: strings(v.contact?.phones, 5, 40),
      address: str(v.contact?.address, 300),
      nip: str(v.contact?.nip, 13),
      city: str(v.contact?.city, 80),
    },
    socials: Array.isArray(v.socials)
      ? v.socials
          .slice(0, 10)
          .map((s) => ({ network: str(s?.network, 30), url: safeUrl(s?.url) }))
          .filter((s) => s.network && s.url)
      : [],
    keywords: strings(v.keywords, 20, 60),
    services: strings(v.services, 12, 160),
    technologies: strings(v.technologies, 12, 40),
    trackers: strings(v.trackers, 12, 40),
    rating:
      v.rating && typeof v.rating === "object"
        ? {
            value: Math.min(5, Math.max(0, num(v.rating.value))),
            count: Math.max(0, Math.round(num(v.rating.count))),
            source: str(v.rating.source, 60),
            url: safeUrl(v.rating.url),
          }
        : null,
    reviews: Array.isArray(v.reviews)
      ? v.reviews.slice(0, 8).map((r) => ({
          author: str(r?.author, 80),
          rating:
            typeof r?.rating === "number" && Number.isFinite(r.rating)
              ? Math.min(5, Math.max(0, r.rating))
              : null,
          text: str(r?.text, 700),
          date: str(r?.date, 30) || undefined,
          source: str(r?.source, 60),
        }))
      : [],
    audit: {
      score: Math.min(100, Math.max(0, Math.round(num(v.audit?.score)))),
      responseMs:
        typeof v.audit?.responseMs === "number"
          ? Math.round(v.audit.responseMs)
          : null,
      checks: Array.isArray(v.audit?.checks)
        ? v.audit.checks.slice(0, 24).map((c) => ({
            id: str(c?.id, 40),
            label: str(c?.label, 120),
            ok: c?.ok === true,
            weight: Math.max(0, num(c?.weight, 1)),
            hint: str(c?.hint, 300),
          }))
        : [],
    },
    githubData:
      g && typeof g === "object"
        ? {
            login: str(g.login, 100),
            name: str(g.name, 120),
            url: safeUrl(g.url),
            avatar: safeUrl(g.avatar),
            bio: str(g.bio, 400),
            location: str(g.location, 120),
            followers: num(g.followers),
            publicRepos: num(g.publicRepos),
            stars: num(g.stars),
            forks: num(g.forks),
            openIssues: num(g.openIssues),
            lastPush: str(g.lastPush, 30),
            languages: Array.isArray(g.languages)
              ? g.languages.slice(0, 8).map((l) => ({
                  name: str(l?.name, 40),
                  share: Math.min(100, Math.max(0, num(l?.share))),
                }))
              : [],
            topics: strings(g.topics, 15, 50),
            repos: Array.isArray(g.repos)
              ? g.repos.slice(0, 6).map((r) => ({
                  name: str(r?.name, 100),
                  description: str(r?.description, 300),
                  stars: num(r?.stars),
                  forks: num(r?.forks),
                  language: str(r?.language, 40),
                  url: safeUrl(r?.url),
                  pushed: str(r?.pushed, 30),
                }))
              : [],
          }
        : null,
    warnings: strings(v.warnings, 10, 300),
    scannedAt: str(v.scannedAt, 30),
    applied: v.applied === true,
    history: Array.isArray(v.history)
      ? v.history
          .filter((h) => h && typeof h === "object" && str(h.at, 30))
          .slice(-52)
          .map((h) => ({
            at: str(h.at, 30),
            score:
              typeof h.score === "number" && Number.isFinite(h.score)
                ? Math.min(100, Math.max(0, Math.round(h.score)))
                : null,
            rating:
              typeof h.rating === "number" && Number.isFinite(h.rating)
                ? Math.min(5, Math.max(0, h.rating))
                : null,
            reviews: Math.max(0, Math.round(num(h.reviews))),
            stars:
              typeof h.stars === "number" && Number.isFinite(h.stars)
                ? Math.max(0, Math.round(h.stars))
                : null,
            issues: Math.max(0, Math.round(num(h.issues))),
          }))
      : [],
    competitors: Array.isArray(v.competitors)
      ? v.competitors.slice(0, 3).map((c) => ({
          name: str(c?.name, 120),
          website: safeUrl(c?.website),
          logo: safeUrl(c?.logo),
          scannedAt: str(c?.scannedAt, 30),
          score:
            typeof c?.score === "number" && Number.isFinite(c.score)
              ? Math.min(100, Math.max(0, Math.round(c.score)))
              : null,
          rating:
            typeof c?.rating === "number" && Number.isFinite(c.rating)
              ? Math.min(5, Math.max(0, c.rating))
              : null,
          reviews: Math.max(0, Math.round(num(c?.reviews))),
          trackers: strings(c?.trackers, 12, 40),
          technologies: strings(c?.technologies, 12, 40),
          socials: Math.max(0, Math.round(num(c?.socials))),
          services: strings(c?.services, 8, 160),
          failed: strings(c?.failed, 24, 120),
          responseMs:
            typeof c?.responseMs === "number" ? Math.round(c.responseMs) : null,
          color: color(c?.color, "#94a3b8"),
        }))
      : [],
  };
}

function toLinear(c: number) {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function fromLinear(c: number) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
}
export function hexToRgb(value: string) {
  const n = parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
}
function rgbToHex(rgb: readonly number[]) {
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(255, Math.max(0, c)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
export function toOklch(value: string) {
  const [r, g, b] = hexToRgb(value).map((c) => toLinear(c / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const H = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: H < 0 ? H + 360 : H };
}
function oklchToRgb(l: number, c: number, h: number) {
  const a = c * Math.cos((h * Math.PI) / 180),
    b = c * Math.sin((h * Math.PI) / 180);
  const L = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const M = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const S = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}
export function fromOklch(l: number, c: number, h: number) {
  let chroma = c;
  for (let i = 0; i < 24; i++) {
    const rgb = oklchToRgb(l, chroma, h);
    if (rgb.every((x) => x >= -0.0005 && x <= 1.0005))
      return rgbToHex(
        rgb.map((x) => fromLinear(Math.min(1, Math.max(0, x))) * 255),
      );
    chroma *= 0.88;
  }
  return rgbToHex(
    oklchToRgb(l, 0, h).map(
      (x) => fromLinear(Math.min(1, Math.max(0, x))) * 255,
    ),
  );
}
export function luminance(value: string) {
  const [r, g, b] = hexToRgb(value).map((c) => toLinear(c / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export const SHADES = [
  50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950,
] as const;
const LIGHTNESS = [
  0.975, 0.945, 0.89, 0.81, 0.71, 0.625, 0.545, 0.475, 0.405, 0.345, 0.26,
];
const CHROMA = [0.12, 0.22, 0.42, 0.65, 0.85, 1, 1, 0.95, 0.85, 0.72, 0.6];
export function scale(value: string) {
  const { c, h } = toOklch(value);
  const base = Math.max(c, 0.015);
  return Object.fromEntries(
    SHADES.map((shade, i) => [
      shade,
      fromOklch(LIGHTNESS[i], base * CHROMA[i], h),
    ]),
  ) as Record<(typeof SHADES)[number], string>;
}
export function readablePrimary(value: string) {
  if (contrast(value, "#ffffff") >= 4.5) return value;
  const { c, h, l } = toOklch(value);
  for (let L = Math.min(l, 0.7); L > 0.2; L -= 0.02) {
    const candidate = fromOklch(L, c, h);
    if (contrast(candidate, "#ffffff") >= 4.5) return candidate;
  }
  return "#4c1d95";
}
export function brandTheme(brand: Pick<BrandProfile, "colors">) {
  const primary = readablePrimary(brand.colors.primary);
  const shades = scale(primary);
  const { h, c } = toOklch(primary);
  const vars: Record<string, string> = {
    "--primary": primary,
    "--accent": shades[100],
    "--accent-foreground": shades[700],
    "--ring": shades[400],
    "--brand-hero-a": fromOklch(0.5, Math.max(c, 0.03), h),
    "--brand-hero-b": fromOklch(0.33, Math.max(c, 0.03) * 0.75, h),
    "--brand-hero-c": fromOklch(0.2, Math.max(c, 0.03) * 0.45, h),
    "--brand-accent": brand.colors.accent,
  };
  for (const shade of SHADES) {
    vars[`--brand-${shade}`] = shades[shade];
    vars[`--color-violet-${shade}`] = shades[shade];
    vars[`--color-indigo-${shade}`] = shades[shade];
  }
  return vars;
}
export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "AE"
  );
}

export function brandPoint(brand: BrandProfile): BrandPoint {
  return {
    at: brand.scannedAt || new Date().toISOString(),
    score: brand.audit.checks.length ? brand.audit.score : null,
    rating: brand.rating?.value ?? null,
    reviews: brand.rating?.count ?? 0,
    stars: brand.githubData?.stars ?? null,
    issues: brand.audit.checks.filter((c) => !c.ok).length,
  };
}
export function brandTarget(brand: Pick<BrandProfile, "website" | "github">) {
  const host = (u: string) => {
    try {
      return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return "";
    }
  };
  return {
    site: host(brand.website),
    github: brand.github.toLowerCase().replace(/\/+$/, ""),
  };
}
export function sameBrandTarget(
  a: Pick<BrandProfile, "website" | "github">,
  b: Pick<BrandProfile, "website" | "github">,
) {
  const x = brandTarget(a),
    y = brandTarget(b);
  return (
    (!!x.site && x.site === y.site) || (!!x.github && x.github === y.github)
  );
}
export function withHistory(
  next: BrandProfile,
  previous?: BrandProfile,
): BrandProfile {
  const point = brandPoint(next);
  const day = point.at.slice(0, 10);
  const kept =
    previous && sameBrandTarget(next, previous) ? previous.history : [];
  const history = [...kept.filter((h) => h.at.slice(0, 10) !== day), point]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(-52);
  return { ...next, history };
}
export function brandAlerts(history: BrandPoint[]) {
  const [prev, last] = history.slice(-2);
  if (!prev || !last) return [];
  const alerts: string[] = [];
  if (
    prev.score !== null &&
    last.score !== null &&
    last.score <= prev.score - 5
  )
    alerts.push(`wynik strony spadł z ${prev.score} do ${last.score}`);
  if (
    prev.rating !== null &&
    last.rating !== null &&
    Math.round(last.rating * 10) <= Math.round(prev.rating * 10) - 1
  )
    alerts.push(
      `ocena spadła z ${prev.rating.toFixed(1)} do ${last.rating.toFixed(1)}`,
    );
  if (last.issues > prev.issues)
    alerts.push(`nowe problemy na stronie: ${last.issues - prev.issues}`);
  if (prev.score !== null && last.score === null)
    alerts.push("strona przestała odpowiadać przy skanie");
  return alerts;
}

export function toCompetitor(scanned: BrandProfile): Competitor {
  return {
    name: scanned.name || scanned.website,
    website: scanned.website,
    logo: scanned.logo || scanned.icon,
    scannedAt: scanned.scannedAt,
    score: scanned.audit.checks.length ? scanned.audit.score : null,
    rating: scanned.rating?.value ?? null,
    reviews: scanned.rating?.count ?? 0,
    trackers: scanned.trackers,
    technologies: scanned.technologies,
    socials: scanned.socials.length,
    services: scanned.services.slice(0, 8),
    failed: scanned.audit.checks.filter((c) => !c.ok).map((c) => c.label),
    responseMs: scanned.audit.responseMs,
    color: scanned.colors.primary,
  };
}
export function competitorGaps(brand: BrandProfile) {
  const own = toCompetitor(brand);
  const gaps: string[] = [];
  for (const c of brand.competitors) {
    if (c.score !== null && own.score !== null && c.score > own.score)
      gaps.push(`${c.name} ma lepszą stronę (${c.score} vs ${own.score}/100)`);
    if (c.rating !== null && (own.rating === null || c.rating > own.rating))
      gaps.push(
        `${c.name} ma wyższą ocenę (${c.rating.toFixed(1)} vs ${own.rating?.toFixed(1) ?? "brak"})`,
      );
    if (c.reviews > own.reviews * 1.5 && c.reviews - own.reviews >= 10)
      gaps.push(`${c.name} ma więcej opinii (${c.reviews} vs ${own.reviews})`);
    if (
      c.trackers.some((t) => !/Cookie/.test(t)) &&
      !own.trackers.some((t) => !/Cookie/.test(t))
    )
      gaps.push(`${c.name} mierzy ruch (${c.trackers.join(", ")}), Ty nie`);
    if (c.socials > own.socials + 1)
      gaps.push(
        `${c.name} ma więcej kanałów social (${c.socials} vs ${own.socials})`,
      );
  }
  return gaps;
}
