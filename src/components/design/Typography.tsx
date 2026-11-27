import { cn } from "@/lib/utils";
import { HeadingInfo } from "@/components/ui/heading-info";
import type { ElementType, HTMLAttributes, ReactNode } from "react";

type HeadingLevel = 1 | 2 | 3 | 4;

const headingClasses: Record<HeadingLevel, string> = {
  1: "font-heading text-3xl font-medium italic leading-tight",
  2: "font-sans text-2xl font-medium leading-snug",
  3: "font-sans text-xl font-medium leading-tight",
  4: "font-sans text-base font-medium leading-snug",
};

interface AppHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level: HeadingLevel;
  as?: ElementType;
  children: ReactNode;
  info?: ReactNode;
}

export function AppHeading({
  level,
  as,
  className,
  children,
  info,
  ...props
}: AppHeadingProps) {
  const Component = as ?? (`h${level}` as ElementType);

  const title = (
    <Component className={cn(headingClasses[level], className)} {...props}>
      {children}
    </Component>
  );
  if (!info) return title;

  return (
    <div className="inline-flex max-w-full items-center gap-1 align-middle">
      {title}
      <HeadingInfo>{info}</HeadingInfo>
    </div>
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

