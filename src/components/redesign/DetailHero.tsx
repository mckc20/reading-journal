import { Link } from "react-router-dom";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { buildBookLibraryFilterPath } from "@/components/LinkedMetadata";
import { cn } from "@/lib/utils";

export function DetailHero({
  titleId,
  color,
  banner,
  navigation,
  actions,
  artwork,
  children,
}: {
  titleId: string;
  color: string;
  banner?: string | null;
  navigation: ReactNode;
  actions?: ReactNode;
  artwork: ReactNode;
  children: ReactNode;
}) {
  const [failedBanner, setFailedBanner] = useState<string | null>(null);
  return (
    <header className="rj-detail-hero" aria-labelledby={titleId}>
      <div className="rj-detail-cover-stage" style={{ "--book-detail-hero-color": color } as CSSProperties}>
        {banner && banner !== failedBanner && (
          <img className="rj-detail-hero-banner" src={banner} alt="" onError={() => setFailedBanner(banner)} />
        )}
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

export function DetailGenreTags({ genres, linked = true }: { genres: string[]; linked?: boolean }) {
  if (genres.length === 0) return null;
  return (
    <div className="rj-detail-tags">
      {genres.map(genre => linked ? <Link key={genre} to={buildBookLibraryFilterPath("genre", genre)}>{genre}</Link>
        : <span key={genre}>{genre}</span>)}
    </div>
  );
}

export function DetailStat({
  icon: Icon,
  label,
  value,
  detail,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rj-reading-stat rj-reading-stat-static", className)}>
      <dt className="rj-reading-stat-label">
        <Icon aria-hidden="true" />
        {label}
      </dt>
      <dd className="rj-reading-stat-value">{value}</dd>
      {detail && <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>}
    </div>
  );
}
