"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !ref.current) return;

    const el = ref.current;
    const prev = document.activeElement as HTMLElement | null;

    const focusables = () => el.querySelectorAll<HTMLElement>(FOCUSABLE);

    const first = () => focusables()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const f = focusables();
      if (f.length === 0) return;
      const active = document.activeElement;
      if (e.shiftKey) {
        if (active === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      } else {
        if (active === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };

    // Focus first element on open
    setTimeout(() => first(), 50);
    el.addEventListener("keydown", onKeyDown);

    return () => {
      el.removeEventListener("keydown", onKeyDown);
      prev?.focus();
    };
  }, [active]);

  return ref;
}
