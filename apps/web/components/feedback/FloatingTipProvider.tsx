"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type FloatingTipPosition = {
  x?: number;
  y?: number;
};

type FloatingTipOptions = FloatingTipPosition & {
  durationMs?: number;
};

type FloatingTipItem = {
  id: number;
  text: string;
  x?: number;
  y?: number;
  durationMs: number;
};

type FloatingTipContextValue = {
  showTip: (text: string, options?: FloatingTipOptions) => void;
};

const FloatingTipContext = createContext<FloatingTipContextValue | null>(null);

export function FloatingTipProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<FloatingTipItem[]>([]);

  const showTip = useCallback((text: string, options: FloatingTipOptions = {}) => {
    const nextText = text.trim();
    if (!nextText) {
      return;
    }

    const id = Date.now() + Math.floor(Math.random() * 1000);
    const durationMs = options.durationMs ?? 1800;
    setItems((current) => [
      ...current,
      {
        id,
        text: nextText,
        x: options.x,
        y: options.y,
        durationMs,
      },
    ]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, durationMs);
  }, []);

  const value = useMemo(() => ({ showTip }), [showTip]);

  return (
    <FloatingTipContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-0 z-[80]">
        {items.map((item) => (
          <div
            key={item.id}
            className="floating-tip fixed rounded-md border border-[var(--color-line)] bg-[var(--color-ink)] px-4 py-2 text-sm font-semibold text-[var(--color-page)] shadow-[var(--shadow-soft)]"
            style={{
              left: item.x ?? "50%",
              top: item.y ?? "50%",
              animationDuration: `${item.durationMs}ms`,
            }}
          >
            {item.text}
          </div>
        ))}
      </div>
    </FloatingTipContext.Provider>
  );
}

export function useFloatingTip() {
  const context = useContext(FloatingTipContext);
  if (!context) {
    throw new Error("useFloatingTip must be used within FloatingTipProvider");
  }
  return context.showTip;
}
