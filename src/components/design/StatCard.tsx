import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

interface StatCardProps {
  label: string;
  value: string;
  detail?: string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

export default function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  onClick,
  active = false,
  className,
}: StatCardProps) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon ? <Icon className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> : null}
      </div>
      <p className="mt-2 text-lg font-semibold leading-tight">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
    </>
  );

  const classes = cn(
    "rounded-lg border border-border/60 bg-muted/10 p-3 transition-colors",
    active && "border-primary/70 bg-primary/5",
    onClick &&
      "text-left hover:border-primary/50 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
    className,
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-pressed={active}>
        {content}
      </button>
    );
  }

  return <div className={classes}>{content}</div>;
}

