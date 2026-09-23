"use client";

import { useStore, type Role } from "@/lib/store";

const ROLES: { key: Role; label: string }[] = [
  { key: "provider", label: "Provider" },
  { key: "client", label: "Client" },
];

export function RoleSwitch() {
  const { role, setRole } = useStore();
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-bg-2 p-1 text-sm">
      <span className="hidden pl-2 pr-1 text-xs text-ink-faint sm:inline">Viewing as</span>
      {ROLES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => setRole(key)}
          className={`rounded-full px-3 py-1 transition-colors duration-150 ${
            role === key ? "bg-accent text-white" : "text-ink-soft hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
