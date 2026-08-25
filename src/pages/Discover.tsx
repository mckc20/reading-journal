import { Compass } from "lucide-react";

export default function Discover() {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 text-center">
      <Compass className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      <h1 className="font-heading text-3xl font-medium leading-tight">Discover</h1>
      <p className="text-sm text-muted-foreground">Discover features will come soon.</p>
    </div>
  );
}
