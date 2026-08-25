import { Sparkles } from "lucide-react";

export default function WrapUps() {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 text-center">
      <Sparkles className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      <h1 className="font-heading text-3xl font-medium leading-tight">Wrap-Ups</h1>
      <p className="text-sm text-muted-foreground">Wrap-ups will come soon.</p>
    </div>
  );
}
