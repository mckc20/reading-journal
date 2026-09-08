import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BookStatus as BookStatusType } from "@/types";

const statusStyles: Record<BookStatusType, { variant: "default" | "secondary" | "outline" | "destructive"; className?: string }> = {
  "To Read": { variant: "outline" },
  "Up Next": { variant: "secondary", className: "border-primary/15 bg-primary/8 text-primary" },
  Reading: { variant: "default" },
  Paused: { variant: "secondary" },
  Finished: { variant: "outline", className: "border-primary/20 text-primary" },
  DNF: { variant: "destructive" },
};

interface BookStatusProps {
  status: BookStatusType;
  className?: string;
}

/** A semantic status badge; pages should not choose status colors themselves. */
export function BookStatus({ status, className }: BookStatusProps) {
  const style = statusStyles[status];
  return <Badge variant={style.variant} className={cn(style.className, className)}>{status}</Badge>;
}

export type { BookStatusProps };
