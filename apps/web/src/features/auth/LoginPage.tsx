import { useQueryClient } from "@tanstack/react-query";
import { Delete } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useSession } from "../../hooks/useSession";
import { ApiError, api, setCsrf } from "../../lib/api";
import { cx } from "../../lib/format";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "back", "0", "ok"];

export function LoginPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(next = pin) {
    if (next.length !== 4 || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await api<{ csrfToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ pin: next }),
      });
      setCsrf(result.csrfToken);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    } catch (caught) {
      setPin("");
      setError(caught instanceof ApiError ? caught.message : "Não foi possível entrar.");
    } finally {
      setPending(false);
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (pending) return;
      if (/^\d$/.test(event.key)) {
        setPin((current) => {
          const next = (current + event.key).slice(0, 4);
          if (next.length === 4) void submit(next);
          return next;
        });
      } else if (event.key === "Backspace") {
        setPin((current) => current.slice(0, -1));
      } else if (event.key === "Enter") {
        void submit();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, pin]);

  if (session.data?.authenticated) return <Navigate to="/" replace />;

  return (
    <main className="relative grid min-h-[100dvh] place-items-center px-4 bg-bg overflow-hidden select-none">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-focus/15 blur-[140px]"
      />

      <section className="relative z-10 w-full max-w-sm rounded-3xl border border-line bg-panel/90 p-8 shadow-2xl backdrop-blur-xl text-center">
        {/* App Mark */}
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-focus shadow-lg shadow-focus/30 text-white">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h10M4 18h7" />
          </svg>
        </div>

        <h1 className="text-xl font-bold tracking-tight text-ink">Rotina Bonette</h1>
        <p className="mt-1.5 text-xs text-muted">Digite seu PIN de 4 números para entrar</p>

        {/* PIN Dots */}
        <div className="mt-6 flex justify-center gap-3" data-testid="pin-dots" aria-label="PIN oculto">
          {[0, 1, 2, 3].map((index) => {
            const filled = index < pin.length;
            return (
              <span
                key={index}
                className={cx(
                  "h-3.5 w-3.5 rounded-full transition-all duration-200",
                  filled
                    ? "bg-focus scale-110 shadow-sm shadow-focus/50"
                    : "bg-line border border-line/80",
                )}
              />
            );
          })}
        </div>

        {/* Numeric Keypad */}
        <div className="mt-8 grid grid-cols-3 gap-2.5">
          {keys.map((key) => {
            const isOk = key === "ok";
            const isBack = key === "back";
            return (
              <button
                key={key}
                type="button"
                data-testid={isOk ? "pin-submit" : `pin-key-${key}`}
                disabled={pending}
                onClick={() => {
                  if (key === "back") setPin((current) => current.slice(0, -1));
                  else if (key === "ok") void submit();
                  else {
                    setPin((current) => {
                      const next = (current + key).slice(0, 4);
                      if (next.length === 4) void submit(next);
                      return next;
                    });
                  }
                }}
                className={cx(
                  "grid h-13 place-items-center rounded-2xl border text-base font-semibold transition-all duration-150 cursor-pointer active:scale-95 disabled:opacity-40",
                  isOk
                    ? "border-focus bg-focus text-white hover:bg-focus/90 shadow-sm text-sm"
                    : isBack
                    ? "border-line bg-panel-2/60 text-muted hover:bg-panel-2 hover:text-ink"
                    : "border-line bg-panel text-ink hover:bg-panel-2 hover:border-line/80 shadow-xs",
                )}
              >
                {isBack ? (
                  <Delete className="h-5 w-5" aria-label="Apagar" />
                ) : isOk ? (
                  "Entrar"
                ) : (
                  key
                )}
              </button>
            );
          })}
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2 text-xs font-semibold text-hot animate-shake">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
