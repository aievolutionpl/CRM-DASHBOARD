"use client";
import { isSqlite } from "@/lib/growth/model";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import Workspace from "../crm/workspace";
import Members from "./members";
import { useCrm } from "@/stores/crm-store";
import { browserSupabase, cloudRequest } from "@/lib/supabase/browser";
import {
  canWrite,
  snapshot,
  validateSnapshot,
  type WorkspaceInfo,
} from "@/lib/growth/model";
import { downloadFile } from "@/lib/crm/backup";
import { emptyAutomation } from "@/lib/automation/model";
import { Field, Icon } from "../crm/ui";
export default function CloudWorkspace({ user }: { user: User }) {
  const selectionKey = `growth-os-space:${isSqlite() ? "sqlite" : "cloud"}:${user.id}`;
  const savedLabel = isSqlite() ? "Zapisano w SQLite" : "Zapisano w Supabase";
  const [spaces, setSpaces] = useState<WorkspaceInfo[]>([]),
    [selected, setSelected] = useState<WorkspaceInfo | null>(null),
    [loaded, setLoaded] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [sync, setSync] = useState("Wybierz przestrzeń"),
    [members, setMembers] = useState(false),
    [createOpen, setCreateOpen] = useState(false),
    [spacesReady, setSpacesReady] = useState(false);
  const pending =
    sync === "Zmiany oczekują na zapis" ||
    sync === "Zapisywanie…" ||
    sync === "Zmiany niezapisane";
  const dirty = useRef(false),
    failure = useRef(false),
    revision = useRef(0);
  const refresh = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    let active = true;
    cloudRequest("")
      .then((r) => {
        if (active) {
          setSpaces(r.workspaces);
          if (!r.workspaces.length) setCreateOpen(true);
          let previous = "";
          try {
            previous = sessionStorage.getItem(selectionKey) || "";
          } catch {}
          const returning = isSqlite()
            ? new URLSearchParams(window.location.search).get("googleWorkspace")
            : null;
          setSelected(
            r.workspaces.find((s: WorkspaceInfo) => s.id === returning) ??
              r.workspaces.find((s: WorkspaceInfo) => s.id === previous) ??
              r.workspaces[0] ??
              null,
          );
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setSpacesReady(true);
      });
    return () => {
      active = false;
    };
  }, [selectionKey]);
  useEffect(() => {
    if (!selected) return;
    try {
      sessionStorage.setItem(selectionKey, selected.id);
    } catch {}
    let active = true,
      writing = false,
      hydrating = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    queueMicrotask(() => {
      if (active) {
        setLoaded(false);
        setError("");
        setLoading(true);
      }
    });
    failure.current = false;
    dirty.current = false;
    useCrm.setState({
      firms: [],
      contacts: [],
      deals: [],
      tasks: [],
      mails: [],
      onboarded: false,
      sender: "",
      agentEnabled: false,
      businessMode: "crm",
      automation: emptyAutomation(),
    });
    let unsubscribe = () => {};
    const save = async () => {
      if (!active || writing || !dirty.current || failure.current) return;
      writing = true;
      dirty.current = false;
      setSync("Zapisywanie…");
      const payload = snapshot(useCrm.getState(), revision.current);
      try {
        const result = await cloudRequest(`/${selected.id}/data`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        if (active) {
          revision.current = result.revision;
          setSync(dirty.current ? "Zapisywanie…" : savedLabel);
        }
      } catch (e) {
        if (active) {
          failure.current = true;
          dirty.current = true;
          setError(e instanceof Error ? e.message : "Błąd zapisu.");
          setSync("Zmiany niezapisane");
        }
      } finally {
        writing = false;
        if (active && dirty.current && !failure.current) void save();
      }
    };
    cloudRequest(`/${selected.id}/data`)
      .then((raw) => {
        if (!active) return;
        const state = validateSnapshot(raw);
        revision.current = state.revision;
        useCrm.setState({ ...state.data, ...state.settings });
        setLoaded(true);
        setSync(savedLabel);
        if (canWrite(selected.role))
          unsubscribe = useCrm.subscribe((next, prev) => {
            if (hydrating) return;
            if (
              JSON.stringify(snapshot(next, 0)) ===
              JSON.stringify(snapshot(prev, 0))
            )
              return;
            dirty.current = true;
            setSync("Zmiany oczekują na zapis");
            clearTimeout(timer);
            timer = setTimeout(() => void save(), 180);
          });
      })
      .catch((e) => {
        if (active) {
          setError(e.message);
          setSync("Brak połączenia");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    refresh.current = async () => {
      if (!active || writing || dirty.current || failure.current) return;
      setLoading(true);
      setSync("Wczytywanie…");
      try {
        const state = validateSnapshot(
          await cloudRequest(`/${selected.id}/data`),
        );
        if (!active) return;
        revision.current = state.revision;
        hydrating = true;
        try {
          useCrm.setState({ ...state.data, ...state.settings });
        } finally {
          hydrating = false;
        }
        setSync(savedLabel);
      } catch {
        if (active) {
          failure.current = true;
          setError(
            "Nie udało się odświeżyć CRM po działaniu agenta. Wczytaj dane z bazy.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current || writing) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", unload);
    return () => {
      active = false;
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener("beforeunload", unload);
    };
  }, [selected, savedLabel, selectionKey]);
  function backup() {
    downloadFile(
      "growth-os-niezapisane-zmiany.json",
      JSON.stringify(
        {
          version: 1,
          data: snapshot(useCrm.getState(), 0).data,
          settings: snapshot(useCrm.getState(), 0).settings,
        },
        null,
        2,
      ),
    );
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dirty.current || pending) return;
    setLoading(true);
    setError("");
    const name = new FormData(event.currentTarget).get("name");
    try {
      const r = await cloudRequest("", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      const list = await cloudRequest("");
      setSpaces(list.workspaces);
      setCreateOpen(false);
      setSelected(list.workspaces.find((s: WorkspaceInfo) => s.id === r.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd tworzenia.");
    } finally {
      setLoading(false);
    }
  }
  async function signOut() {
    if (dirty.current || pending) return;
    try {
      const { error } = await browserSupabase().auth.signOut();
      if (error) throw error;
      useCrm.setState({
        firms: [],
        contacts: [],
        deals: [],
        tasks: [],
        mails: [],
      });
    } catch {
      setError("Nie udało się wylogować. Spróbuj ponownie.");
    }
  }
  return (
    <div className="crm flex-col [&_.crm-main]:ml-0! [&_.crm-sidebar]:sticky! [&_.crm-sidebar]:top-0 [&_.crm-sidebar]:h-dvh [&_.crm-sidebar]:self-start">
      <header className="relative z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/80 bg-white/85 px-4 py-2.5 shadow-[0_6px_20px_-18px_#41367a] backdrop-blur-xl sm:px-6">
        <strong className="flex items-center gap-2 text-sm text-slate-800">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-[11px] font-extrabold text-white">
            EG
          </span>
          Evolution Growth OS {isSqlite() && "· lokalnie"}
        </strong>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
          Przestrzeń
          <select
            aria-label="Przestrzeń robocza"
            className="max-w-[16em] rounded-xl! border border-slate-200 px-3! py-1.5! text-sm font-semibold text-slate-800"
            value={selected?.id ?? ""}
            disabled={pending || loading}
            onChange={(e) =>
              setSelected(spaces.find((s) => s.id === e.target.value) ?? null)
            }
          >
            {!selected && <option value="">Wybierz</option>}
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <span
          role="status"
          className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
        >
          {sync}
        </span>
        {selected && (
          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
            Rola: {selected.role}
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!isSqlite() && (
            <button
              className="crm-button secondary"
              disabled={!selected || pending || loading}
              onClick={() => setMembers(true)}
            >
              Zespół
            </button>
          )}
          <button
            className="crm-button secondary"
            disabled={pending || loading}
            onClick={() => void signOut()}
            hidden={isSqlite()}
          >
            Wyloguj
          </button>
          <details className="relative" open={createOpen}>
            <summary
              aria-disabled={!spacesReady}
              className="flex cursor-pointer list-none items-center gap-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm [&::-webkit-details-marker]:hidden"
              onClick={(e) => {
                e.preventDefault();
                if (spacesReady) setCreateOpen((value) => !value);
              }}
            >
              <Icon name="plus" size={14} />
              {isSqlite()
                ? "Nowa przestrzeń firmy"
                : "Moje konto · nowa przestrzeń"}
            </summary>
            <div className="absolute top-full right-0 z-40 mt-2 w-[min(92vw,420px)] rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_24px_60px_-20px_#41367a66]">
              <p className="crm-muted mb-3 text-xs break-all">
                {user.email} · UUID: {user.id}
              </p>
              <form onSubmit={create} className="grid gap-3">
                <Field label="Nazwa nowej przestrzeni">
                  <input
                    name="name"
                    required
                    maxLength={120}
                    placeholder="Nazwa Twojej firmy"
                  />
                </Field>
                <button
                  className="crm-button justify-self-start"
                  disabled={!spacesReady || loading || pending}
                >
                  Utwórz przestrzeń
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>
      {error && (
        <div className="p-4">
          <p role="alert" className="crm-alert error">
            {error} Edycja zatrzymana, żeby chronić dane.
          </p>
          {loaded && (
            <button className="crm-button secondary" onClick={backup}>
              Pobierz kopię zmian
            </button>
          )}
          <button
            className="crm-button secondary"
            onClick={() => {
              if (
                !dirty.current ||
                confirm(
                  "Odrzucić niezapisane zmiany i wczytać dane z bazy? Pobierz wcześniej kopię.",
                )
              ) {
                dirty.current = false;
                if (selected) setSelected({ ...selected });
                else window.location.reload();
              }
            }}
          >
            Wczytaj z bazy
          </button>
        </div>
      )}
      {selected?.role === "viewer" && (
        <p className="crm-alert m-4">
          Dostęp tylko do odczytu. Zmiany może wprowadzać marketer,
          administrator lub właściciel.
        </p>
      )}
      {loaded && selected ? (
        <div inert={Boolean(error) || loading}>
          <Workspace
            key={selected.id}
            storageBusy={pending || loading}
            reloadDatabase={() => {
              void refresh.current();
            }}
            cloud={{
              id: selected.id,
              storage: isSqlite() ? "sqlite" : "supabase",
              name: selected.name,
              readOnly: selected.role === "viewer",
            }}
          />
        </div>
      ) : (
        !error && (
          <div className="p-8">
            <h1>
              {loading ? "Wczytywanie danych…" : "Utwórz pierwszą przestrzeń"}
            </h1>
            <p className="crm-muted">
              Nowa przestrzeń zaczyna od pustej bazy. Zaimportuj kopię lokalnego
              CRM w Ustawieniach.
            </p>
          </div>
        )
      )}
      {members && selected && (
        <Members
          workspace={selected}
          onClose={() => {
            setMembers(false);
            void cloudRequest("")
              .then((r) => {
                setSpaces(r.workspaces);
                const current = r.workspaces.find(
                  (w: WorkspaceInfo) => w.id === selected.id,
                );
                if (current && current.role !== selected.role)
                  setSelected(current);
              })
              .catch(() => setError("Nie udało się odświeżyć uprawnień."));
          }}
        />
      )}
    </div>
  );
}
