import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function DetailHero({
  titleId,
  color,
  navigation,
  actions,
  artwork,
  children,
}: {
  titleId: string;
  color: string;
  navigation: ReactNode;
  actions?: ReactNode;
  artwork: ReactNode;
  children: ReactNode;
}) {
  return (
    <header className="rj-detail-hero" aria-labelledby={titleId}>
      <div className="rj-detail-cover-stage" style={{ "--book-detail-hero-color": color } as CSSProperties}>
        <div className="rj-detail-topline">
          {navigation}
          {actions}
        </div>
        {artwork}
      </div>
      <div className="rj-detail-summary">{children}</div>
    </header>
  );
}

export function DetailStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="rj-reading-stat rj-reading-stat-static">
      <dt className="rj-reading-stat-label">
        <Icon aria-hidden="true" />
        {label}
      </dt>
      <dd className="rj-reading-stat-value">{value}</dd>
      {detail && <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>}
    </div>
  );
}
