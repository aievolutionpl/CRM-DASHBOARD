"use client";
import {
  useEffect,
  useRef,
  useId,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, string> = {
    dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    companies:
      "M4 21V5l8-2 8 2v16 M2 21h20 M8 8h1 M15 8h1 M8 12h1 M15 12h1 M10 21v-5h4v5",
    deals: "M3 4h5v16H3z M10 4h5v11h-5z M17 4h4v8h-4z",
    contacts:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8",
    tasks: "M9 5h12 M9 12h12 M9 19h12 M3 4l1 1 2-2 M3 11l1 1 2-2 M3 18l1 1 2-2",
    mail: "M3 5h18v14H3z M3 5l9 7 9-7",
    agent:
      "M12 3v3 M5 9h14v11H5z M8 13h.01 M16 13h.01 M9 17h6 M2 12v5 M22 12v5",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
    search: "M21 21l-5-5 M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16",
    plus: "M12 5v14 M5 12h14",
    arrow: "M5 12h14 M14 7l5 5-5 5",
    close: "M6 6l12 12 M6 18L18 6",
    check: "M5 12l4 4L19 6",
    menu: "M3 6h18 M3 12h18 M3 18h18",
    help: "M9 9a3 3 0 1 1 5 2c-2 1-2 2-2 3 M12 17h.01 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
    download: "M12 3v12 M7 10l5 5 5-5 M4 16v5h16v-5",
    clock: "M12 8v5l3 2 M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20",
    spark: "M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z",
    trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
    edit: "M15 5l4 4 M4 20l4-1L21 6l-3-3L5 16z",
    file: "M5 3h10l4 4v14H5z M14 3v5h5 M8 12h8 M8 16h6",
    globe:
      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20 M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20",
    github:
      "M9 19c-4 1.5-4-2-6-2.5 M15 22v-3.5a3 3 0 0 0-1-2.5c3 0 6-1.5 6-6.5a5 5 0 0 0-1.4-3.5 4.6 4.6 0 0 0-.1-3.5s-1.1-.3-3.5 1.3a12 12 0 0 0-6 0C6.6 2.2 5.5 2.5 5.5 2.5a4.6 4.6 0 0 0-.1 3.5A5 5 0 0 0 4 9.5c0 5 3 6.5 6 6.5a3 3 0 0 0-1 2.5V22",
    star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z",
    palette:
      "M12 22a10 10 0 1 1 10-10c0 2.8-2.2 4-4 4h-2a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 22z M7.5 11h.01 M10.5 7h.01 M15 7.5h.01",
    link: "M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1 M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
    trend: "M3 17l6-6 4 4 8-8 M15 7h6v6",
    phone:
      "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z",
    pin: "M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name] ?? paths.spark} />
    </svg>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`crm-badge ${tone}`}>{children}</span>;
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="crm-empty">
      <span className="crm-empty-icon">
        <Icon name="file" size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const element = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    element?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element?.close();
      document.body.style.overflow = "";
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`crm-modal ${wide ? "wide" : ""}`}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = ref.current!.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="crm-modal-head">
        <h2>{title}</h2>
        <button
          className="crm-icon-button"
          aria-label="Zamknij"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const field = isValidElement<{ id?: string; "aria-describedby"?: string }>(
    children,
  )
    ? children
    : null;
  const inputId = field?.props.id ?? generatedId;
  return (
    <div className="crm-field">
      <label htmlFor={inputId}>{label}</label>
      {field
        ? cloneElement(field, {
            id: inputId,
            "aria-describedby": hint
              ? `${inputId}-hint`
              : field.props["aria-describedby"],
          })
        : children}
      {hint && <small id={`${inputId}-hint`}>{hint}</small>}
    </div>
  );
}

export function Actions({
  onCancel,
  label = "Zapisz",
}: {
  onCancel: () => void;
  label?: string;
}) {
  return (
    <div className="crm-form-actions">
      <button type="button" className="crm-button secondary" onClick={onCancel}>
        Anuluj
      </button>
      <button type="submit" className="crm-button">
        {label}
      </button>
    </div>
  );
}
