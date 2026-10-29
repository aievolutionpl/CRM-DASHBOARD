import { isCloud } from "@/lib/growth/model";
import { authenticated } from "@/lib/supabase/server";
export function localhost(request: Request) {
  const url = new URL(request.url),
    host = request.headers.get("host") || url.host;
  return (
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]{1,5})?$/.test(host)
  );
}
export function crossSite(request: Request) {
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site") return true;
  if (!origin) return false;
  try {
    const url = new URL(request.url),
      host = request.headers.get("host") || url.host;
    return (
      new URL(origin).origin !== new URL(`${url.protocol}//${host}`).origin
    );
  } catch {
    return true;
  }
}
export async function trusted(request: Request) {
  if (localhost(request)) return true;
  if (!isCloud()) return false;
  const auth = await authenticated(request);
  return !(auth instanceof Response);
}
