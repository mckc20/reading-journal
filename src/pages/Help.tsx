import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, CircleHelp } from 'lucide-react';
import { AppHeading, HeadingDescription } from '@/components/design';

export default function Help() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <Link to="/settings" className="inline-flex items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />Settings
      </Link>
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <CircleHelp className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
          <AppHeading level={1}>Help</AppHeading>
        </div>
        <HeadingDescription>A guide to your reading journal.</HeadingDescription>
      </header>
      <nav aria-label="Help topics">
        <Link
          to="/help/wrap-ups"
          className="group flex items-center justify-between gap-4 rounded-lg border p-5 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="space-y-2">
            <AppHeading level={2} className="text-xl underline-offset-4 group-hover:underline">Wrap-ups</AppHeading>
            <p className="text-sm text-muted-foreground">Learn about saved months, reading stats, highlights, and activity.</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}
