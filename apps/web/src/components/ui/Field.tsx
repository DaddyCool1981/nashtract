import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

const inputClass =
  "w-full rounded-lg border border-line bg-bg-2 px-3 py-2 text-sm text-ink placeholder:text-ink-faint " +
  "focus:border-accent focus:outline-none transition-colors duration-150";

export function FieldShell({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-ink-soft">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-faint">{hint}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint}>
      <input className={inputClass} {...props} />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint}>
      <textarea className={`${inputClass} min-h-24 resize-y`} {...props} />
    </FieldShell>
  );
}
