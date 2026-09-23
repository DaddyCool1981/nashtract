import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-line bg-panel/60 p-6 sm:p-8 ${className}`}
      {...props}
    />
  );
}
