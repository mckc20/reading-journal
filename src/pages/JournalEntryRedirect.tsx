import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { NotebookPen } from "lucide-react";
import { AppHeading, HeadingDescription } from "@/components/design";
import { Button } from "@/components/ui/button";
import { resolveJournalEntryByPublicId } from "@/lib/journalEntryLookup";

export default function JournalEntryRedirect() {
  const { publicId } = useParams<{ publicId: string }>();
  const [href, setHref] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicId) {
      setNotFound(true);
      return;
    }

    let cancelled = false;
    setHref(null);
    setNotFound(false);
    setError(null);

    resolveJournalEntryByPublicId(publicId)
      .then((entry) => {
        if (cancelled) return;
        if (entry) setHref(entry.href);
        else setNotFound(true);
      })
      .catch((lookupError) => {
        if (!cancelled) {
          setError(lookupError instanceof Error ? lookupError.message : "Could not open this journal entry");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicId]);

  if (href) return <Navigate to={href} replace />;

  if (notFound) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <NotebookPen className="mx-auto h-10 w-10 text-muted-foreground/45" aria-hidden="true" />
        <div className="space-y-1">
          <AppHeading level={1} as="h1">Journal entry not found</AppHeading>
          <HeadingDescription>This entry may have been deleted or may not be available to your account.</HeadingDescription>
        </div>
        <Button asChild variant="outline">
          <Link to="/library/journal">Open journal</Link>
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="h-40 animate-pulse rounded-lg bg-muted" />
    </div>
  );
}
