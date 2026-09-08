import type { ReactNode } from "react";
import { AppHeading, HeadingDescription } from "@/components/design";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="min-w-0">
        <AppHeading level={1}>{title}</AppHeading>
        {description && <HeadingDescription>{description}</HeadingDescription>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export type { PageHeaderProps };
