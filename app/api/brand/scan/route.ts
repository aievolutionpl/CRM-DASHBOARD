import { scanBrand } from "@/lib/brand/scan";
import { crossSite, trusted } from "@/lib/http/trust";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  return json({
    github: true,
    githubToken: Boolean(process.env.GITHUB_TOKEN),
    places: Boolean(process.env.GOOGLE_PLACES_API_KEY),
  });
}

export async function POST(request: Request) {
  if (crossSite(request))
    return json({ error: "Żądanie z innej domeny zostało odrzucone." }, 403);
  if (!(await trusted(request)))
    return json(
      {
        error:
          "Skanowanie marki działa na localhost lub po zalogowaniu do przestrzeni.",
      },
      403,
    );
  let body: { website?: unknown; github?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Nieprawidłowe dane żądania." }, 400);
  }
  const website = typeof body.website === "string" ? body.website.trim() : "";
  const github = typeof body.github === "string" ? body.github.trim() : "";
  if ((!website && !github) || website.length > 2048 || github.length > 300)
    return json(
      { error: "Podaj adres strony www lub link do GitHub (lub oba)." },
      400,
    );
  try {
    return json({ brand: await scanBrand({ website, github }) });
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "Nie udało się przeskanować." },
      422,
    );
  }
}
