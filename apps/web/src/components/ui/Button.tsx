import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90 disabled:bg-accent/40",
  secondary: "border border-line text-ink hover:border-ink-soft disabled:opacity-40",
  ghost: "text-ink-soft hover:text-ink disabled:opacity-40",
  danger: "border border-danger/40 text-danger hover:bg-danger-dim disabled:opacity-40",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium
        transition-colors duration-200 ease-out disabled:cursor-not-allowed
        ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
