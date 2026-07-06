import { HTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

type CardVariant = "base" | "elevated" | "interactive";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  variant?: CardVariant;
  padding?: "sm" | "md" | "lg" | "none";
};

const variantClasses: Record<CardVariant, string> = {
  base: "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200",
  elevated:
    "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/60 dark:shadow-slate-950/80",
  interactive:
    "group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm hover:shadow-lg hover:border-brand/40 hover:-translate-y-0.5 transition-all duration-200 ease-out cursor-pointer"
};

const paddingClasses: Record<NonNullable<CardProps["padding"]>, string> = {
  none: "",
  sm: "p-5",
  md: "p-6",
  lg: "p-8"
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = "base", padding = "md", ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(variantClasses[variant], paddingClasses[padding], className)}
      {...rest}
    />
  );
});
