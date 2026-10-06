"use client";
import { useState } from "react";
import type { ResourceProvider, Resource } from "@/lib/integrations/model";
import { Field } from "../crm/ui";
export default function GoogleSetup({
  provider,
  resource,
  busy,
  save,
}: {
  provider: ResourceProvider;
  resource: Resource;
  busy: boolean;
  save: (resource: Resource) => Promise<void>;
}) {
  const key = (
    {
      ga4: "propertyId",
      search_console: "siteUrl",
      meta_ads: "adAccountId",
      plausible: "siteId",
    } as const
  )[provider];
  const copy = {
    ga4: {
      label: "Identyfikator usługi GA4",
      placeholder: "123456789 — nie G-…",
      hint: "Numer znajdziesz w GA4 → Administracja → Szczegóły usługi. Konto Google musi mieć co najmniej rolę Przeglądający.",
      button: "GA4",
      max: 20,
    },
    search_console: {
      label: "Usługa Search Console",
      placeholder: "sc-domain:twoja-firma.pl lub https://twoja-firma.pl/",
      hint: "Wpisz dokładną nazwę usługi widoczną w Search Console, łącznie z prefiksem lub końcowym ukośnikiem. Konto musi mieć dostęp do tej witryny.",
      button: "Search Console",
      max: 1000,
    },
    meta_ads: {
      label: "Konto reklamowe Meta",
      placeholder: "act_1234567890",
      hint: "Identyfikator znajdziesz w Menedżerze reklam → Ustawienia konta. Token musi mieć uprawnienie ads_read do tego konta.",
      button: "Meta Ads",
      max: 30,
    },
    plausible: {
      label: "Witryna w Plausible",
      placeholder: "twoja-firma.pl",
      hint: "Domena dokładnie taka jak w panelu Plausible (site_id).",
      button: "Plausible",
      max: 253,
    },
  }[provider];
  const [value, setValue] = useState(resource[key] || "");
  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ [key]: value });
      }}
    >
      <Field label={copy.label}>
        <input
          required
          disabled={busy}
          maxLength={copy.max}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={copy.placeholder}
        />
      </Field>
      <p className="crm-muted">
        {copy.hint} Zapis dotyczy tylko bieżącej przestrzeni.
      </p>
      <button
        className="crm-button secondary justify-self-start"
        disabled={busy || !value.trim()}
      >
        Zapisz usługę {copy.button}
      </button>
    </form>
  );
}
