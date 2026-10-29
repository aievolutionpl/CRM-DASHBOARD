import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
export type WebSource = {
  id: string;
  url: string;
  text: string;
  checkedAt: string;
};

// Conservative public-address policy. DNS results are pinned to the TLS request,
// so a second DNS lookup cannot redirect the reader into a private network.
export function publicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && [0, 168].includes(b)) ||
      (a === 198 && [18, 19, 51].includes(b)) ||
      (a === 203 && b === 0)
    );
  }
  // Globally routed IPv6 only; reject mapped IPv4 and special-use ranges.
  return (
    isIP(address) === 6 &&
    /^[23][0-9a-f]{3}:/i.test(address) &&
    !/^2001:(?:0:|db8:|2:|10:|20:)/i.test(address) &&
    !/^2002:/i.test(address)
  );
}
export function websiteUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw Error("Podaj pełny adres https:// strony firmy.");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    url.search ||
    !url.hostname.includes(".") ||
    url.hostname.endsWith(".") ||
    /\.(localhost|local|internal|test|invalid)$/i.test(url.hostname) ||
    isIP(url.hostname.replace(/^\[|\]$/g, ""))
  )
    throw Error(
      "Użyj publicznej domeny HTTPS bez loginu, parametrów i niestandardowego portu.",
    );
  url.hash = "";
  return url;
}
export function pageText(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|h[1-6]|li|div|section)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n")
    .trim()
    .slice(0, 14000);
}
export function researchLinks(html: string, base: URL) {
  const result = new Set<string>();
  for (const match of html.matchAll(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    try {
      const url = websiteUrl(new URL(match[1], base).href);
      if (
        url.origin === base.origin &&
        url.pathname !== base.pathname &&
        /about|o-nas|onas|kontakt|contact|uslug|oferta|services|produkt|pricing|cennik|faq/i.test(
          url.pathname + " " + pageText(match[2]),
        ) &&
        !/\.(pdf|png|jpg|zip|xml)$/i.test(url.pathname)
      )
        result.add(url.href);
    } catch {}
  }
  return [...result].slice(0, 4);
}
type PageOptions = { types?: RegExp; limit?: number; hops?: number };
export async function readPage(url: URL, options: PageOptions = {}) {
  return (await fetchPage(url, options)).html;
}
export async function fetchPage(
  url: URL,
  options: PageOptions = {},
): Promise<{ html: string; url: URL }> {
  const types = options.types ?? /text\/html/i,
    limit = options.limit ?? 2_000_000,
    hops = options.hops ?? 3;
  // Do not silently bypass a managed HTTP proxy/network policy.
  if (process.env.HTTPS_PROXY || process.env.https_proxy)
    throw Error(
      "Odczyt strony wymaga połączenia bez proxy. Uruchom lokalnie na komputerze; w tej instalacji wykryto proxy sieciowe.",
    );
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw Error("Domena prowadzi do niedozwolonego adresu sieciowego.");
  const selected = addresses[0];
  return new Promise((resolve, reject) => {
    const task = request(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent": "Evolution-Growth-OS/0.2 CompanyBrain",
          Accept: types.source.includes("css") ? "text/css" : "text/html",
          "Accept-Encoding": "identity",
        },
        lookup: (_host, options, cb) =>
          options.all
            ? cb(null, [selected])
            : cb(null, selected.address, selected.family),
        signal: AbortSignal.timeout(20000),
      },
      (response) => {
        const location = response.headers.location;
        if (
          hops > 0 &&
          [301, 302, 303, 307, 308].includes(response.statusCode ?? 0) &&
          location
        ) {
          response.resume();
          let next: URL;
          try {
            next = websiteUrl(new URL(location, url).href);
          } catch (e) {
            reject(e);
            return;
          }
          fetchPage(next, { ...options, hops: hops - 1 }).then(resolve, reject);
          return;
        }
        if (
          response.statusCode !== 200 ||
          !types.test(String(response.headers["content-type"]))
        ) {
          response.resume();
          reject(
            Error(
              "Strona nie udostępnia HTML (lub przekierowuje). Podaj jej docelowy adres HTTPS.",
            ),
          );
          return;
        }
        const chunks: Buffer[] = [];
        let length = 0;
        response.on("data", (chunk: Buffer) => {
          length += chunk.length;
          if (length > limit)
            task.destroy(Error("Strona przekracza dozwolony rozmiar."));
          else chunks.push(chunk);
        });
        response.on("error", () =>
          reject(Error("Przerwano pobieranie strony.")),
        );
        response.on("end", () =>
          resolve({ html: Buffer.concat(chunks).toString("utf8"), url }),
        );
      },
    );
    task.on("error", () =>
      reject(
        Error(
          "Nie udało się pobrać strony. Sprawdź adres, dostęp sieci i blokady strony.",
        ),
      ),
    );
    task.end();
  });
}
export async function researchWebsite(input: string) {
  const { html, url } = await fetchPage(websiteUrl(input));
  const sources: WebSource[] = [
    {
      id: "S01",
      url: url.href,
      text: pageText(html),
      checkedAt: new Date().toISOString(),
    },
  ];
  if (sources[0].text.length < 80)
    throw Error(
      "Za mało publicznej treści. Strona może wymagać JavaScript lub logowania; zaimportuj jej treść jako Markdown.",
    );
  const warnings: string[] = [];
  for (const link of researchLinks(html, url)) {
    try {
      const text = pageText(await readPage(websiteUrl(link)));
      if (text.length >= 80)
        sources.push({
          id: `S0${sources.length + 1}`,
          url: link,
          text,
          checkedAt: new Date().toISOString(),
        });
      else warnings.push(`Za mało treści: ${link}`);
    } catch {
      warnings.push(`Nie odczytano podstrony: ${link}`);
    }
  }
  return { sources, warnings };
}
