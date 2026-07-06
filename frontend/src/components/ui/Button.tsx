import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center justify-center gap-2 font-body font-semibold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-slate-950 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0";

const sizeMap: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm"
};

const variantMap: Record<ButtonVariant, string> = {
  primary:
    "bg-brand hover:bg-brand-light active:bg-brand-dark text-white shadow-sm shadow-brand/20 hover:shadow-md hover:shadow-brand/25 hover:-translate-y-px active:translate-y-0",
  secondary:
    "bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
  ghost:
    "bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white",
  danger:
    "bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20",
  icon:
    "w-9 h-9 !p-0 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variant !== "icon" && sizeMap[size], variantMap[variant], className)}
      {...rest}
    />
  );
});
