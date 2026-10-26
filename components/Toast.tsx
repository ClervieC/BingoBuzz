"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Tone = "info" | "success" | "error" | "bingo";

interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (message: string, options?: { tone?: Tone; duration?: number; action?: ToastItem["action"] }) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const TONE_CLASS: Record<Tone, string> = {
  info: "bg-fg text-bg",
  success: "bg-success text-on-status",
  error: "bg-danger text-on-status",
  bingo: "bg-gold text-black",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (message, options) => {
      const id = nextId.current++;
      const item: ToastItem = { id, message, tone: options?.tone ?? "info", action: options?.action };
      setItems((list) => [...list.slice(-2), item]);
      window.setTimeout(() => dismiss(id), options?.duration ?? (item.action ? 6000 : 3000));
    },
    [dismiss],
  );

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4"
        style={{ paddingTop: "calc(var(--safe-top) + 12px)" }}
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={`animate-toast pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold shadow-lg ${TONE_CLASS[item.tone]}`}
          >
            <span>{item.message}</span>
            {item.action && (
              <button
                type="button"
                className="min-h-[36px] rounded-full bg-black/15 px-3 text-sm font-bold underline-offset-2"
                onClick={() => {
                  item.action?.onClick();
                  dismiss(item.id);
                }}
              >
                {item.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast doit être utilisé dans <ToastProvider>");
  return api;
}
