import { StickyNote } from "lucide-react";

export default function Notes() {
  return (
    <div className="mx-auto flex min-h-[50svh] max-w-2xl flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <StickyNote className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-medium leading-snug">Notes</h1>
        <p className="text-sm leading-6 text-muted-foreground">
          Your notes workspace will live here later.
        </p>
      </div>
    </div>
  );
}
