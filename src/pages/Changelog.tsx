import { Clock3, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatReleaseNoteDate,
  getChangelogEntries,
  type ReleaseNote,
} from "@/lib/releaseNotes";
import { cn } from "@/lib/utils";

function ChangelogBullet({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <li className="rounded-lg border border-border/70 bg-muted/25 p-4">
      <p className="font-medium leading-tight">{title}</p>
      {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
    </li>
  );
}

function ChangelogEntryCard({
  entry,
  isLatest,
}: {
  entry: ReleaseNote;
  isLatest: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-card shadow-[var(--shadow-card)]",
        isLatest && "border-primary/30",
      )}
    >
      <div className="border-b border-border/70 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          {isLatest && (
            <Badge variant="secondary" className="gap-1.5">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              Latest
            </Badge>
          )}
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {formatReleaseNoteDate(entry.published_at)}
          </span>
          <Badge variant="outline" className="font-mono text-[11px]">
            {entry.version}
          </Badge>
        </div>
        <h2 className="mt-3 font-heading text-xl font-medium leading-tight">{entry.title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{entry.summary}</p>
      </div>
      <div className="px-5 py-5 sm:px-6">
        <ul className="grid gap-3">
          {entry.highlights.map((highlight) => (
            <ChangelogBullet
              key={`${entry.version}-${highlight.title}`}
              title={highlight.title}
              description={highlight.description}
            />
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function Changelog() {
  const entries = getChangelogEntries();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Changelog
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-medium leading-tight sm:text-4xl">
              Notable updates over time
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              This archive keeps the important releases, feature drops, and notable fixes in
              reverse chronological order. Very small maintenance changes are intentionally left
              out.
            </p>
          </div>
        </div>

        <Button asChild variant="outline" className="sm:self-start">
          <Link to="/settings/about">Open settings</Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {entries.map((entry, index) => (
          <ChangelogEntryCard key={entry.version} entry={entry} isLatest={index === 0} />
        ))}
      </div>
    </div>
  );
}
