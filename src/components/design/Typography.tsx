import { cn } from "@/lib/utils";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

type HeadingLevel = 1 | 2 | 3 | 4;

const headingClasses: Record<HeadingLevel, string> = {
  1: "font-heading text-3xl font-medium leading-tight",
  2: "font-heading text-2xl font-medium leading-snug",
  3: "font-heading text-xl font-medium leading-tight",
  4: "font-heading text-base font-medium leading-snug",
};

interface AppHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: HeadingLevel;
  as?: ElementType;
  children: ReactNode;
}

export function AppHeading({
  level,
  as,
  className,
  children,
  ...props
}: AppHeadingProps) {
  const Component = as ?? (`h${level}` as ElementType);

  return (
    <Component className={cn(headingClasses[level], className)} {...props}>
      {children}
    </Component>
  );
}

export function HeadingDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

