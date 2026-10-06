"use client";
import { useState, type FormEvent } from "react";
import { useCrm } from "@/stores/crm-store";
import {
  DEAL_STAGES,
  id,
  today,
  offsetDate,
  validEmail,
  validNip,
  safeWebsite,
  FIRM_STATUSES,
  firmStatusLabels,
  type FirmStatus,
  type Firm,
  type Contact,
  type Deal,
  type Task,
} from "@/lib/crm/model";
import { Modal, Field, Actions } from "./ui";
export type Editor =
  | { kind: "firm"; item?: Firm }
  | { kind: "contact"; item?: Contact; companyId?: string }
  | { kind: "deal"; item?: Deal; companyId?: string }
  | { kind: "task"; item?: Task; companyId?: string };
export default function EntityForm({
  editor,
  onClose,
  onSaved,
  serviceMode = false,
}: {
  editor: Editor;
  onClose: () => void;
  onSaved: () => void;
  serviceMode?: boolean;
}) {
  const s = useCrm();
  const initial = editor.item;
  const [data, setData] = useState<Record<string, string | boolean>>(() => {
    if (initial)
      return Object.fromEntries(
        Object.entries(initial).map(([key, value]) => [
          key,
          typeof value === "boolean" ? value : String(value),
        ]),
      );
    switch (editor.kind) {
      case "firm":
        return {
          name: "",
          nip: "",
          city: "",
          industry: "Usługi",
          website: "",
          notes: "",
          email: "",
          phone: "",
          address: "",
          status: "lead",
          owner: "",
          source: "",
          tags: "",
        };
      case "contact":
        return {
          companyId: editor.companyId ?? s.firms[0]?.id ?? "",
          name: "",
          role: "",
          email: "",
          phone: "+48 ",
          consent: false,
        };
      case "deal":
        return {
          companyId: editor.companyId ?? s.firms[0]?.id ?? "",
          name: "",
          value: "",
          probability: "30",
          stage: "Nowa",
          closeDate: offsetDate(14),
        };
      case "task":
        return {
          companyId: editor.companyId ?? "",
          title: "",
          date: today(),
          done: false,
        };
    }
  });
  const [error, setError] = useState("");
  const text = (key: string) => String(data[key] ?? "");
  const change = (key: string, value: string | boolean) => {
    setData((d) => ({ ...d, [key]: value }));
    setError("");
  };
  function input(
    key: string,
    type = "text",
    required = false,
    maxLength = 200,
  ) {
    return (
      <input
        value={text(key)}
        type={type}
        required={required}
        maxLength={maxLength}
        onChange={(e) => change(key, e.target.value)}
      />
    );
  }
  function firmField(optional = false) {
    return (
      <Field label={serviceMode ? "Klient" : "Firma"}>
        <select
          required={!optional}
          value={text("companyId")}
          onChange={(e) => change("companyId", e.target.value)}
        >
          <option value="">
            {optional ? "Bez przypisanej firmy" : "Wybierz firmę"}
          </option>
          {s.firms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </Field>
    );
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    if (
      (editor.kind === "firm" ||
        editor.kind === "contact" ||
        editor.kind === "deal") &&
      !text("name").trim()
    )
      return setError("Wpisz nazwę.");
    const key = initial?.id ?? id();
    if (editor.kind === "firm") {
      if (!validNip(text("nip")))
        return setError(
          "NIP ma nieprawidłową sumę kontrolną. Możesz też pozostawić to pole puste.",
        );
      if (text("website") && !safeWebsite(text("website")))
        return setError("Wpisz poprawny adres strony internetowej.");
      if (text("email") && !validEmail(text("email")))
        return setError("Wpisz poprawny e-mail klienta.");
      s.saveFirm({
        ...(initial as Firm),
        email: text("email"),
        phone: text("phone"),
        address: text("address"),
        id: key,
        name: text("name").trim(),
        nip: text("nip").replace(/[\s-]/g, ""),
        city: text("city").trim(),
        industry: text("industry"),
        website: safeWebsite(text("website")),
        notes: text("notes"),
        created: (initial as Firm)?.created ?? today(),
        status: (FIRM_STATUSES as readonly string[]).includes(text("status"))
          ? (text("status") as FirmStatus)
          : "lead",
        owner: text("owner").trim(),
        source: text("source").trim(),
        tags: [
          ...new Set(
            text("tags")
              .split(",")
              .map((t) => t.trim().slice(0, 40))
              .filter(Boolean),
          ),
        ].slice(0, 12),
      });
    }
    if (editor.kind === "contact") {
      if (!validEmail(text("email")))
        return setError("Wpisz poprawny adres e-mail.");
      if (!s.firms.some((f) => f.id === text("companyId")))
        return setError("Najpierw dodaj firmę i przypisz kontakt.");
      s.saveContact({
        id: key,
        companyId: text("companyId"),
        name: text("name").trim(),
        role: text("role"),
        email: text("email").trim(),
        phone: text("phone"),
        consent: !!data.consent,
      });
    }
    if (editor.kind === "deal") {
      const value = Number(text("value")),
        probability = Number(text("probability"));
      if (
        !text("value") ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1e12 ||
        probability < 0 ||
        probability > 100
      )
        return setError(
          "Podaj wartość od 0 do 1 biliona PLN i prawdopodobieństwo od 0 do 100%.",
        );
      if (!s.firms.some((f) => f.id === text("companyId")))
        return setError("Przypisz szansę do firmy.");
      const stage = text("stage") as Deal["stage"];
      s.saveDeal({
        ...(initial as Deal),
        id: key,
        name: text("name").trim(),
        companyId: text("companyId"),
        value,
        probability:
          stage === "Wygrana" ? 100 : stage === "Przegrana" ? 0 : probability,
        stage,
        closeDate: text("closeDate"),
      });
    }
    if (editor.kind === "task") {
      if (!text("title").trim()) return setError("Wpisz treść zadania.");
      s.saveTask({
        id: key,
        companyId: text("companyId"),
        title: text("title").trim(),
        date: text("date"),
        done: !!data.done,
      });
    }
    onSaved();
    onClose();
  }
  const companyFields = (
    <>
      <div className="crm-form-grid">
        <Field label="NIP (opcjonalnie)">
          {input("nip", "text", false, 20)}
        </Field>
        <Field label="Miasto">{input("city", "text", false, 100)}</Field>
      </div>
      <Field label="Branża">
        <select
          value={text("industry")}
          onChange={(e) => change("industry", e.target.value)}
        >
          {[
            ...new Set([
              "Usługi",
              "Marketing",
              "E-commerce",
              "Logistyka",
              "Edukacja",
              "Technologia",
              "Produkcja",
              "Finanse",
              "Nieruchomości",
              "Zdrowie i uroda",
              "Gastronomia",
              "Budownictwo",
              "Inna",
              ...(text("industry") ? [text("industry")] : []),
            ]),
          ].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </Field>
      <Field label="Strona internetowa">
        {input("website", "text", false, 500)}
      </Field>
    </>
  );
  const relationFields = (
    <>
      <div className="crm-form-grid">
        <Field label="Status relacji">
          <select
            value={text("status") || "lead"}
            onChange={(e) => change("status", e.target.value)}
          >
            {FIRM_STATUSES.map((v) => (
              <option key={v} value={v}>
                {firmStatusLabels[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Opiekun">{input("owner", "text", false, 100)}</Field>
      </div>
      <div className="crm-form-grid">
        <Field label="Źródło pozyskania">
          <input
            list="crm-firm-sources"
            value={text("source")}
            maxLength={100}
            onChange={(e) => change("source", e.target.value)}
          />
        </Field>
        <Field label="Tagi" hint="Oddziel przecinkami, np. B2B, polecenie">
          {input("tags", "text", false, 400)}
        </Field>
      </div>
      <datalist id="crm-firm-sources">
        {[
          "Polecenie",
          "Google Ads",
          "Meta Ads",
          "Strona www",
          "LinkedIn",
          "Targi / wydarzenie",
          "Cold mailing",
          "Telefon",
        ].map((v) => (
          <option key={v} value={v} />
        ))}
      </datalist>
    </>
  );
  const title = `${initial ? "Edytuj" : "Dodaj"} ${{ firm: serviceMode ? "klienta" : "firmę", contact: "kontakt", deal: "szansę sprzedaży", task: "zadanie" }[editor.kind]}`;
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="crm-form">
        {error && (
          <div role="alert" className="crm-alert error">
            {error}
          </div>
        )}
        {editor.kind === "firm" && (
          <>
            <Field
              label={
                serviceMode ? "Imię i nazwisko / nazwa klienta" : "Nazwa firmy"
              }
            >
              {input("name", "text", true)}
            </Field>
            {serviceMode && (
              <>
                <div className="crm-form-grid">
                  <Field label="E-mail klienta">
                    {input("email", "email", false, 254)}
                  </Field>
                  <Field label="Telefon klienta">
                    {input("phone", "tel", false, 50)}
                  </Field>
                </div>
                <Field label="Adres klienta">
                  {input("address", "text", false, 500)}
                </Field>
              </>
            )}
            {serviceMode ? (
              <details>
                <summary>Dane firmy (opcjonalnie)</summary>
                {companyFields}
              </details>
            ) : (
              companyFields
            )}
            {relationFields}
            <Field label="Notatki">
              <textarea
                value={text("notes")}
                maxLength={5000}
                rows={4}
                onChange={(e) => change("notes", e.target.value)}
              />
            </Field>
          </>
        )}
        {editor.kind === "contact" && (
          <>
            {firmField()}
            <Field label="Imię i nazwisko">{input("name", "text", true)}</Field>
            <Field label="Stanowisko">
              {input("role", "text", false, 100)}
            </Field>
            <div className="crm-form-grid">
              <Field label="E-mail">{input("email", "email", true, 254)}</Field>
              <Field label="Telefon">{input("phone", "tel", false, 50)}</Field>
            </div>
            <label className="crm-checkbox">
              <input
                type="checkbox"
                checked={!!data.consent}
                onChange={(e) => change("consent", e.target.checked)}
              />
              Mam podstawę do wysłania wiadomości do tego kontaktu.
            </label>
            <p className="crm-muted">
              Zaznaczenie pola nie zbiera zgody. Potwierdź ją poza aplikacją,
              jeśli jest wymagana dla danego rodzaju wiadomości.
            </p>
          </>
        )}
        {editor.kind === "deal" && (
          <>
            {firmField()}
            <Field label="Nazwa szansy">{input("name", "text", true)}</Field>
            <div className="crm-form-grid">
              <Field label="Wartość (PLN)">
                <input
                  type="number"
                  required
                  min="0"
                  max="1000000000000"
                  step="0.01"
                  value={text("value")}
                  onChange={(e) => change("value", e.target.value)}
                />
              </Field>
              <Field label="Szansa wygranej (%)">
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={text("probability")}
                  onChange={(e) => change("probability", e.target.value)}
                />
              </Field>
            </div>
            <div className="crm-form-grid">
              <Field label="Etap">
                <select
                  value={text("stage")}
                  onChange={(e) => change("stage", e.target.value)}
                >
                  {DEAL_STAGES.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="Planowane zamknięcie">
                {input("closeDate", "date", true)}
              </Field>
            </div>
          </>
        )}
        {editor.kind === "task" && (
          <>
            {firmField(true)}
            <Field label="Treść zadania">{input("title", "text", true)}</Field>
            <Field label="Termin">{input("date", "date", true)}</Field>
            <label className="crm-checkbox">
              <input
                type="checkbox"
                checked={!!data.done}
                onChange={(e) => change("done", e.target.checked)}
              />
              Zadanie ukończone
            </label>
          </>
        )}
        <Actions onCancel={onClose} />
      </form>
    </Modal>
  );
}
