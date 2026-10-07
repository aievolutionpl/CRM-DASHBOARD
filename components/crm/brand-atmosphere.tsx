"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";

const BrandShader = dynamic(() => import("./brand-shader"), {
  ssr: false,
  loading: () => null,
});

class EffectBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Decorative only. The CSS backdrop remains even if loading or GPU setup fails. */
export default function BrandAtmosphere() {
  const host = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const transparency = matchMedia("(prefers-reduced-transparency: reduce)");
    let visible = false;
    const update = () =>
      setRunning(
        "gpu" in navigator &&
          visible &&
          !document.hidden &&
          !motion.matches &&
          !transparency.matches,
      );
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    if (host.current) observer.observe(host.current);
    motion.addEventListener("change", update);
    transparency.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", update);
      transparency.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <div
      ref={host}
      className="crm-brand-atmosphere"
      aria-hidden="true"
      data-effect={running && !failed ? "gpu" : "static"}
    >
      {running && !failed && (
        <EffectBoundary>
          <BrandShader unavailable={() => setFailed(true)} />
        </EffectBoundary>
      )}
    </div>
  );
}
