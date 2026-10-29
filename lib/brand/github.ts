import type { BrandGithub, BrandRepo } from "./model";

type Json = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function githubTarget(input: string) {
  const raw = input.trim();
  if (!raw) return null;
  const value = /^[\w.-]+(\/[\w.-]+)?$/.test(raw)
    ? `https://github.com/${raw}`
    : raw;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw Error("Podaj link do profilu, organizacji lub repozytorium GitHub.");
  }
  if (!/^(www\.)?github\.com$/i.test(url.hostname) || url.protocol !== "https:")
    throw Error("Link GitHub musi prowadzić do https://github.com/…");
  const [owner, repo] = url.pathname.split("/").filter(Boolean);
  if (!owner || !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(owner))
    throw Error("Nie rozpoznano nazwy użytkownika lub organizacji GitHub.");
  const name = repo?.replace(/\.git$/, "");
  if (name && !/^[\w.-]{1,100}$/.test(name))
    throw Error("Nie rozpoznano nazwy repozytorium GitHub.");
  return {
    owner,
    repo: name || undefined,
    url: `https://github.com/${owner}${name ? `/${name}` : ""}`,
  };
}

export const publicRepo = (r: Json) =>
  r.private !== true &&
  (r.visibility === undefined || r.visibility === "public");

export function summarizeGithub(
  profile: Json,
  repos: Json[],
  repo?: Json,
  languages?: Record<string, number>,
): BrandGithub {
  const own = repos.filter((r) => !r.fork && !r.archived && publicRepo(r));
  const list: BrandRepo[] = [...(repo ? [repo] : []), ...own]
    .filter(
      (r, i, all) => all.findIndex((x) => x.full_name === r.full_name) === i,
    )
    .sort((a, b) =>
      repo && a === repo
        ? -1
        : repo && b === repo
          ? 1
          : n(b.stargazers_count) - n(a.stargazers_count),
    )
    .slice(0, 6)
    .map((r) => ({
      name: s(r.name),
      description: s(r.description),
      stars: n(r.stargazers_count),
      forks: n(r.forks_count),
      language: s(r.language),
      url: s(r.html_url),
      pushed: s(r.pushed_at).slice(0, 10),
    }));
  const langTotals = new Map<string, number>();
  if (languages && Object.keys(languages).length)
    for (const [k, v] of Object.entries(languages)) langTotals.set(k, n(v));
  else
    for (const r of own)
      if (s(r.language))
        langTotals.set(
          s(r.language),
          (langTotals.get(s(r.language)) ?? 0) +
            1 +
            n(r.stargazers_count) * 0.1,
        );
  const total = [...langTotals.values()].reduce((a, b) => a + b, 0) || 1;
  const pool = repo ? [repo] : own;
  return {
    login: s(profile.login),
    name: s(profile.name) || s(profile.login),
    url: repo ? s(repo.html_url) : s(profile.html_url),
    avatar: s(profile.avatar_url),
    bio: (repo ? s(repo.description) : "") || s(profile.bio),
    location: s(profile.location),
    followers: n(profile.followers),
    publicRepos: n(profile.public_repos),
    stars: pool.reduce((a, r) => a + n(r.stargazers_count), 0),
    forks: pool.reduce((a, r) => a + n(r.forks_count), 0),
    openIssues: pool.reduce((a, r) => a + n(r.open_issues_count), 0),
    lastPush:
      pool
        .map((r) => s(r.pushed_at))
        .sort()
        .reverse()[0]
        ?.slice(0, 10) ?? "",
    languages: [...langTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, v]) => ({
        name,
        share: Math.round((v / total) * 1000) / 10,
      })),
    topics: [
      ...new Set(
        pool.flatMap((r) =>
          Array.isArray(r.topics) ? r.topics.map(String) : [],
        ),
      ),
    ].slice(0, 12),
    repos: list,
  };
}
export const githubWebsite = (profile: Json, repo?: Json) =>
  s(repo?.homepage) || s(profile.blog);
