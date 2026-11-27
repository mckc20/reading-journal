import type { ReactNode } from "react";
import { AppHeading } from "@/components/design";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  level?: 2 | 3 | 4;
  className?: string;
}

export function SectionHeader({ title, description, action, level = 3, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <AppHeading level={level} as={`h${level}`} info={description}>{title}</AppHeading>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export type { SectionHeaderProps };
