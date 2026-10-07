"use client";

import { useEffect, useRef, useState } from "react";

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};
const errors: Record<string, string> = {
  "not-allowed":
    "Brak zgody na mikrofon. Sprawdź uprawnienia przeglądarki albo wpisz wiadomość.",
  "service-not-allowed":
    "Przeglądarka nie pozwala na rozpoznawanie mowy. Wpisz wiadomość.",
  "audio-capture":
    "Nie znaleziono mikrofonu. Sprawdź urządzenie i spróbuj ponownie.",
  "no-speech": "Nie wykryto mowy. Spróbuj ponownie.",
  network:
    "Rozpoznawanie mowy wymaga działającego połączenia z usługą przeglądarki.",
};

export default function VoiceInput({
  value,
  onChange,
  disabled,
  maxLength,
}: {
  value: string;
  onChange: (text: string) => void;
  disabled: boolean;
  maxLength: number;
}) {
  const recognition = useRef<Recognition | null>(null);
  const latest = useRef({ value, onChange });
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);
  useEffect(() => {
    const w = window as VoiceWindow;
    let active = true;
    queueMicrotask(() => {
      if (active)
        setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    });
    const abort = () => recognition.current?.abort();
    const hidden = () => {
      if (document.hidden) abort();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", hidden);
      const r = recognition.current;
      recognition.current = null;
      if (r) {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
        r.abort();
      }
    };
  }, []);
  useEffect(() => {
    if (disabled) recognition.current?.abort();
  }, [disabled]);

  function toggle() {
    if (recognition.current) {
      recognition.current.stop();
      return;
    }
    const w = window as VoiceWindow;
    const Constructor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Constructor || disabled) return;
    const r = new Constructor();
    recognition.current = r;
    r.lang = "pl-PL";
    r.continuous = false;
    r.interimResults = true;
    setFeedback("Słucham… Powiedz, co chcesz przygotować.");
    setListening(true);
    r.onresult = (event) => {
      if (recognition.current !== r) return;
      let final = "",
        interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal)
          final += event.results[i][0].transcript + " ";
        else interim += event.results[i][0].transcript;
      }
      if (final.trim()) {
        const { value: draft, onChange: update } = latest.current;
        const text = `${draft}${draft && !/\s$/.test(draft) ? " " : ""}${final.trim()}`;
        latest.current.value = text.slice(0, maxLength);
        update(latest.current.value);
        setFeedback(
          text.length > maxLength
            ? "Osiągnięto limit wiadomości. Skróć tekst przed wysłaniem."
            : "Tekst dodany. Sprawdź go i wyślij, kiedy będzie gotowy.",
        );
      } else if (interim) setFeedback(interim);
    };
    r.onerror = (event) => {
      if (recognition.current !== r) return;
      setFeedback(
        event.error === "aborted"
          ? "Dyktowanie zatrzymane. Treść pozostaje w polu."
          : errors[event.error] ||
              "Nie udało się rozpoznać mowy. Wpisz wiadomość lub spróbuj ponownie.",
      );
    };
    r.onend = () => {
      if (recognition.current !== r) return;
      recognition.current = null;
      setListening(false);
    };
    try {
      r.start();
    } catch {
      recognition.current = null;
      setListening(false);
      setFeedback(
        "Nie można uruchomić mikrofonu. Spróbuj ponownie albo wpisz wiadomość.",
      );
    }
  }
  return (
    <div className="crm-voice-input">
      <button
        type="button"
        className="crm-button secondary"
        aria-pressed={listening}
        disabled={!supported || (disabled && !listening)}
        onClick={toggle}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" />
        </svg>
        {listening ? "Zatrzymaj dyktowanie" : "Dyktuj wiadomość"}
      </button>
      <p className="crm-muted text-xs" role="status">
        {feedback ||
          (supported
            ? "Mowa → tekst. Sprawdź treść przed wysłaniem. Usługa przeglądarki może przetwarzać dźwięk online."
            : "Dyktowanie niedostępne w tej przeglądarce. Możesz pisać poniżej.")}
      </p>
    </div>
  );
}
