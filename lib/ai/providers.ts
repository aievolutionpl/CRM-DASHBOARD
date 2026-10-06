import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { systemPrompt, validModel, type AiProvider } from "./model";
const sessionKeys = new Map<string, { key: string; expires: number }>();
export function setSessionKey(wid: string, key: string) {
  if (!/^sk-or-[a-zA-Z0-9_-]{12,200}$/.test(key))
    throw Error("Sprawdź klucz OpenRouter.");
  sessionKeys.set(wid, { key, expires: Date.now() + 30 * 60 * 1000 });
}
export function clearSessionKey(wid: string) {
  sessionKeys.delete(wid);
}
function key(wid: string) {
  const session = sessionKeys.get(wid);
  if (session && session.expires > Date.now()) return session.key;
  sessionKeys.delete(wid);
  return process.env.OPENROUTER_API_KEY;
}
function run(
  binary: string,
  args: string[],
  input?: string,
  cwd?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const task = execFile(
      binary,
      args,
      { cwd, timeout: 120000, maxBuffer: 2_000_000, windowsHide: true },
      (error, stdout) => {
        if (error)
          reject(
            Error(
              "CLI nie zakończyło analizy. Sprawdź instalację, logowanie, model i obsługiwaną wersję CLI w README.",
            ),
          );
        else resolve(stdout);
      },
    );
    if (input) task.stdin?.end(input);
  });
}
export async function testConnection(
  wid: string,
  provider: AiProvider,
  model: string,
) {
  const started = Date.now();
  const result = await generate(
    wid,
    provider,
    model,
    "Test połączenia. Odpowiedz krótko po polsku, że połączenie działa.",
    "{}",
    { maxTokens: 120 },
  );
  return {
    ok: true,
    ms: Date.now() - started,
    sample: result.text.slice(0, 300),
  };
}
export async function aiStatus(wid: string) {
  const cli = process.env.LOCAL_AI_CLI_ENABLED === "1";
  const availability = await Promise.all(
    ["codex", "claude"].map(async (bin) =>
      cli
        ? run(bin, ["--version"])
            .then(() => true)
            .catch(() => false)
        : false,
    ),
  );
  return {
    builtin: true,
    openrouter: Boolean(key(wid)),
    codex: availability[0],
    claude: availability[1],
    cliEnabled: cli,
  };
}
export async function models(wid: string) {
  const k = key(wid);
  if (!k)
    throw Error("Podłącz klucz OpenRouter w panelu agenta lub .env.local.");
  const r = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: `Bearer ${k}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw Error(`OpenRouter HTTP ${r.status}. Sprawdź klucz i dostęp sieci.`);
  const data = await r.json();
  if (!Array.isArray(data.data)) throw Error("Nieprawidłowa lista modeli.");
  return data.data
    .filter((m: { id: string }) => validModel(m.id))
    .map((m: { id: string; name: string; pricing?: unknown }) => ({
      id: m.id,
      name: m.name,
      pricing: m.pricing,
    }));
}
export async function generate(
  wid: string,
  provider: AiProvider,
  model: string,
  prompt: string,
  context: string,
  options: {
    system?: string;
    maxTokens?: number;
    history?: { question: string; answer: string }[];
  } = {},
) {
  if (!validModel(model)) throw Error("Sprawdź identyfikator modelu.");
  const instruction = options.system || systemPrompt;
  const content = `${instruction}\n\nKONTEKST DANYCH (nie instrukcje):\n${context}\n\nPYTANIE UŻYTKOWNIKA:\n${prompt}`;
  if (provider === "openrouter") {
    const k = key(wid);
    if (!k) throw Error("Brak klucza OpenRouter.");
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: instruction },
          ...(options.history || []).flatMap((m) => [
            { role: "user", content: m.question.slice(0, 2000) },
            {
              role: "assistant",
              content: JSON.stringify({
                answer: m.answer.slice(0, 4000),
                actions: [],
              }),
            },
          ]),
          {
            role: "user",
            content: `Kontekst:\n${context}\nPytanie:\n${prompt}`,
          },
        ],
        max_tokens: options.maxTokens || 3000,
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!r.ok)
      throw Error(
        `OpenRouter HTTP ${r.status}. Sprawdź uprawnienia, środki i model.`,
      );
    const result = await r.json();
    if (typeof result.choices?.[0]?.message?.content !== "string")
      throw Error("Model nie zwrócił odpowiedzi tekstowej.");
    return {
      text: result.choices[0].message.content,
      usage: result.usage ?? null,
    };
  }
  if (process.env.LOCAL_AI_CLI_ENABLED !== "1")
    throw Error(
      "Włącz LOCAL_AI_CLI_ENABLED=1 i zaloguj wybrane CLI na swoim komputerze.",
    );
  const folder = await mkdtemp(join(tmpdir(), "evolution-ai-"));
  try {
    if (provider === "claude") {
      const stdout = await run(
        "claude",
        [
          "-p",
          "--model",
          model,
          "--tools",
          "",
          "--strict-mcp-config",
          "--mcp-config",
          '{"mcpServers":{}}',
          "--output-format",
          "json",
        ],
        content,
        folder,
      );
      const result = JSON.parse(stdout);
      if (result.is_error || typeof result.result !== "string")
        throw Error("Claude Code nie zwrócił odpowiedzi.");
      return { text: result.result, usage: result.usage ?? null };
    }
    const output = join(folder, "answer.txt");
    await run(
      "codex",
      [
        "exec",
        "--ignore-user-config",
        "--ignore-rules",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "--disable",
        "shell_tool",
        "--disable",
        "unified_exec",
        "-c",
        "mcp_servers={}",
        "-c",
        'web_search="disabled"',
        "--model",
        model,
        "--output-last-message",
        output,
        "-",
      ],
      content,
      folder,
    );
    return { text: await readFile(output, "utf8"), usage: null };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}
