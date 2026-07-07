'use client';

import * as React from "react";
import { CheckCircleRounded, ErrorRounded, InfoRounded } from "@mui/icons-material";

export type ToastType = "success" | "error" | "info";

export interface ShowToastOptions {
  message: string;
  type?: ToastType;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  /** true once the exit transition has been triggered */
  exiting: boolean;
  /** false until the first rAF fires so the browser paints the start state */
  entered: boolean;
}

interface ToastContextValue {
  showToast: (opts: ShowToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue>({ showToast: () => {} });

export function useToast(): ToastContextValue {
  return React.useContext(ToastContext);
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const TOAST_ICON: Record<ToastType, React.ReactNode> = {
  success: <CheckCircleRounded fontSize="small" />,
  error: <ErrorRounded fontSize="small" />,
  info: <InfoRounded fontSize="small" />,
};

const TOAST_BG: Record<ToastType, string> = {
  success: "#1B5E20",
  error: "#B71C1C",
  info: "#1A237E",
};

function ToastChip({
  item,
  reducedMotion,
}: {
  item: ToastItem;
  reducedMotion: boolean;
}) {
  const visible = item.entered && !item.exiting;

  const transformStyle = reducedMotion
    ? undefined
    : { transform: visible ? "translateY(0)" : "translateY(-120%)" };

  return (
    <div
      role="alert"
      aria-atomic="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        backgroundColor: TOAST_BG[item.type],
        color: "#fff",
        borderRadius: 999,
        padding: "10px 20px 10px 14px",
        fontSize: 14,
        fontWeight: 600,
        fontFamily: "inherit",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        pointerEvents: "auto",
        maxWidth: "min(480px, calc(100vw - 32px))",
        opacity: visible ? 1 : 0,
        transition: "transform 300ms ease, opacity 300ms ease",
        willChange: "transform, opacity",
        ...transformStyle,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
        {TOAST_ICON[item.type]}
      </span>
      <span style={{ lineHeight: 1.4 }}>{item.message}</span>
    </div>
  );
}

const VISIBLE_MS = 5000;
const EXIT_MS = 350;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const idRef = React.useRef(0);
  const reducedMotion = usePrefersReducedMotion();

  const showToast = React.useCallback(({ message, type = "info" }: ShowToastOptions) => {
    const id = ++idRef.current;

    setToasts((prev) => [
      ...prev,
      { id, message, type, exiting: false, entered: false },
    ]);

    // Two rAF ticks: browser must paint the initial (hidden) state before we
    // toggle `entered`, otherwise the transition has nothing to run from.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, entered: true } : t)),
        );
      });
    });

    // Start exit after VISIBLE_MS, then remove after the transition completes.
    const exitTimer = setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
      );
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, EXIT_MS);
    }, VISIBLE_MS);

    return () => clearTimeout(exitTimer);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Live region announced to screen readers; individual chips use role="alert" */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: "fixed",
          top: 16,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
          width: "max-content",
          maxWidth: "calc(100vw - 32px)",
        }}
      >
        {toasts.map((t) => (
          <ToastChip key={t.id} item={t} reducedMotion={reducedMotion} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
