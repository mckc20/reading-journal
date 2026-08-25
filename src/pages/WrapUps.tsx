import { Sparkles } from "lucide-react";
import { AppHeading, HeadingDescription } from "@/components/design";

export default function WrapUps() {
  return (
    <div className="flex min-h-[24rem] flex-col items-center justify-center gap-3 text-center">
      <Sparkles className="h-10 w-10 text-muted-foreground/40" aria-hidden="true" />
      <AppHeading level={1}>Wrap-Ups</AppHeading>
      <HeadingDescription>Wrap-ups will come soon.</HeadingDescription>
    </div>
  );
}
