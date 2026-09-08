import type { ReactNode } from "react";
import { BookOpen, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  message: ReactNode;
  title?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({ message, title, icon: Icon = BookOpen, action, compact = false, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-3 text-center", compact ? "py-8" : "py-16", className)}>
      <Icon className="h-10 w-10 text-muted-foreground/40" aria-hidden />
      {title && <p className="font-medium">{title}</p>}
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

export type { EmptyStateProps };
