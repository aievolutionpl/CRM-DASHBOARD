"use client";
import Image from "next/image";
import { useMemo, useState, type CSSProperties } from "react";
import { brandTheme, initials, type BrandProfile } from "@/lib/brand/model";
import { useCrm } from "@/stores/crm-store";

export function useBrandStyle(brand: BrandProfile | undefined) {
  return useMemo(() => {
    if (!brand?.applied) return undefined;
    const vars: Record<string, string> = brandTheme(brand);
    if (brand.useFont && brand.headingFont)
      vars["--brand-heading-font"] = `"${brand.headingFont}"`;
    return vars as CSSProperties;
  }, [brand]);
}

export function BrandFont({ brand }: { brand: BrandProfile | undefined }) {
  if (!brand?.applied || !brand.useFont || !brand.headingFont) return null;
  const family = encodeURIComponent(brand.headingFont).replace(/%20/g, "+");
  return (
    <link
      rel="stylesheet"
      precedence="default"
      href={`https://fonts.googleapis.com/css2?family=${family}:wght@500;600;700;800&display=swap`}
    />
  );
}

export function BrandLogo({
  brand,
  size = 44,
  fallback,
  className = "",
}: {
  brand: Pick<BrandProfile, "logo" | "icon" | "name"> | undefined;
  size?: number;
  fallback?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = [brand?.logo, brand?.icon].find((s) => s && !failed.includes(s));
  if (!src)
    return (
      <span
        className={`grid shrink-0 place-items-center rounded-2xl bg-[linear-gradient(135deg,var(--brand-500),var(--brand-800))] font-bold text-white ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.36 }}
        aria-hidden
      >
        {initials(brand?.name || fallback || "")}
      </span>
    );
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-1 ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        key={src}
        src={src}
        alt=""
        width={size}
        height={size}
        unoptimized
        referrerPolicy="no-referrer"
        className="size-full object-contain"
        onError={() => setFailed((f) => [...f, src])}
      />
    </span>
  );
}

export function useBrand() {
  return useCrm((s) => s.brand);
}
