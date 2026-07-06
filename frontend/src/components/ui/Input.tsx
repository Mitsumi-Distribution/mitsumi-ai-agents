import { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, forwardRef, useId } from "react";
import { cn } from "../../lib/cn";

type FieldWrapperProps = {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, hint, error, success, htmlFor, children, className }: FieldWrapperProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-body font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger flex items-center gap-1 mt-0.5">
          <span aria-hidden>⚠</span> {error}
        </p>
      ) : success ? (
        <p className="text-xs text-success flex items-center gap-1 mt-0.5">
          <span aria-hidden>✓</span> {success}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

const controlBase =
  "w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-body text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed";

const invalidClasses = "border-danger focus:ring-danger/20 bg-danger/5";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  inputClassName?: string;
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, success, id, className, inputClassName, containerClassName, ...rest },
  ref
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const inputEl = (
    <input
      ref={ref}
      id={inputId}
      className={cn(controlBase, error && invalidClasses, inputClassName, className)}
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  );
  if (!label && !hint && !error && !success) return <div className={containerClassName}>{inputEl}</div>;
  return (
    <Field label={label} hint={hint} error={error} success={success} htmlFor={inputId} className={containerClassName}>
      {inputEl}
    </Field>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  textareaClassName?: string;
  containerClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, success, id, className, textareaClassName, containerClassName, rows = 4, ...rest },
  ref
) {
  const reactId = useId();
  const textareaId = id ?? reactId;
  const el = (
    <textarea
      ref={ref}
      id={textareaId}
      rows={rows}
      className={cn(controlBase, "resize-none", error && invalidClasses, textareaClassName, className)}
      aria-invalid={error ? true : undefined}
      {...rest}
    />
  );
  if (!label && !hint && !error && !success) return <div className={containerClassName}>{el}</div>;
  return (
    <Field label={label} hint={hint} error={error} success={success} htmlFor={textareaId} className={containerClassName}>
      {el}
    </Field>
  );
});
