import type { ReactNode } from "react";
import { AppHeading, HeadingDescription } from "@/components/design";
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
        <AppHeading level={level} as="h2">{title}</AppHeading>
        {description && <HeadingDescription className="text-xs">{description}</HeadingDescription>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export type { SectionHeaderProps };
