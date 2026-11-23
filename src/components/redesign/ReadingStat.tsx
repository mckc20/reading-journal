import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function ReadingStat({
  icon: Icon, label, value, secondary, children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  secondary?: { label: string; value: string };
  children: ReactNode;
}) {
  const summary = secondary ? `${label}: ${value}, ${secondary.label}: ${secondary.value}` : `${label}: ${value}`;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="rj-reading-stat" aria-label={summary}>
          <Icon aria-hidden="true" />
          <span className="flex flex-wrap gap-x-5 gap-y-3">
            <span>
              <span className="rj-reading-stat-label">{label}</span>
              <span className="rj-reading-stat-value">{value}</span>
            </span>
            {secondary && (
              <span>
                <span className="rj-reading-stat-label">{secondary.label}</span>
                <span className="rj-reading-stat-value">{secondary.value}</span>
              </span>
            )}
          </span>
          <ChevronRight aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto pt-11 sm:max-w-md" aria-describedby={undefined}>
        <DialogTitle className="sr-only">{label}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function StatRow({ icon: Icon, label, value }: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="relative grid min-h-16 content-center gap-1 rounded-xl bg-card py-3 pr-3 pl-16">
      <dt className="text-xs text-muted-foreground">
        <Icon aria-hidden="true" className="absolute top-1/2 left-[1.375rem] size-5 -translate-y-1/2 text-favorite" />
        {label}
      </dt>
      <dd className="text-base font-semibold leading-snug">{value}</dd>
    </div>
  );
}
