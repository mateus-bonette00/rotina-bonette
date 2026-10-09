import {
  Compass,
  Folder,
  Handshake,
  HeartPulse,
  PanelsTopLeft,
  Sparkles,
  Stethoscope,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import type { Priority, ScoreReason } from "rotina-bonette-shared";
import { cx } from "../lib/format";

const ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  "panels-top-left": PanelsTopLeft,
  handshake: Handshake,
  "heart-pulse": HeartPulse,
  compass: Compass,
  sparkles: Sparkles,
  folder: Folder,
};

export function ProjectIcon({ name, className }: { name?: string; className?: string }) {
  const Icon = ICONS[name ?? "folder"] ?? Folder;
  return <Icon className={className} strokeWidth={1.75} aria-hidden />;
}

export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "quiet" }) {
  const styles = {
    primary:
      "bg-focus text-white shadow-sm hover:brightness-105 active:scale-[0.98] border border-focus/80",
    ghost:
      "border border-line bg-panel text-ink hover:bg-panel-2 hover:border-line/80 active:scale-[0.98]",
    danger:
      "bg-hot text-white hover:brightness-110 active:scale-[0.98] border border-hot/80 shadow-sm",
    quiet:
      "text-muted hover:text-ink hover:bg-panel-2 active:scale-[0.98]",
  }[variant];
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
        styles,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  ...props
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cx(
        "rounded-2xl border border-line bg-panel p-5 shadow-sm transition hover:border-line/80",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        {hint ? <span className="text-xs text-muted/80">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export const controlClass =
  "w-full rounded-xl border border-line bg-panel px-3.5 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-focus focus:ring-2 focus:ring-focus/15";

export function Dialog({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    try {
      if (open && !element.open) element.showModal();
      if (!open && element.open) element.close();
    } catch {
      element.open = open;
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="text-ink"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-line/60 pb-3">
        <div>
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-xs text-muted">{subtitle}</p> : null}
        </div>
        <button
          aria-label="Fechar"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-muted hover:bg-panel-2 hover:text-ink transition cursor-pointer"
          type="button"
          onClick={onClose}
        >
          <X className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>
      <div className="mt-4 flex min-h-0 flex-col">{children}</div>
    </dialog>
  );
}

const priorityStyles: Record<Priority, { label: string; badge: string }> = {
  P1: { label: "P1", badge: "bg-hot/10 text-hot border-hot/25" },
  P2: { label: "P2", badge: "bg-strategy/10 text-strategy border-strategy/25" },
  P3: { label: "P3", badge: "bg-warn/10 text-warn border-warn/25" },
  P4: { label: "P4", badge: "bg-muted/10 text-muted border-line" },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = priorityStyles[priority];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold tracking-tight uppercase tabular-nums",
        config.badge,
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          priority === "P1" && "bg-hot",
          priority === "P2" && "bg-strategy",
          priority === "P3" && "bg-warn",
          priority === "P4" && "bg-muted",
        )}
      />
      {config.label}
    </span>
  );
}

export function Reasons({ reasons }: { reasons?: ScoreReason[] }) {
  if (!reasons?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 text-xs text-muted">
      {reasons.map((reason, index) => (
        <span
          key={index}
          className="inline-flex items-center rounded-md bg-panel-2 px-2 py-0.5 font-medium text-muted"
        >
          {reason.label}
          {reason.points ? (
            <span className={cx("ml-1 font-mono text-[10px]", reason.points > 0 ? "text-ok" : "text-hot")}>
              {reason.points > 0 ? `+${reason.points}` : reason.points}
            </span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
