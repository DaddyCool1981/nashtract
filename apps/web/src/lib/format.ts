import { Money } from "@nashtract/core";

export function formatMoney(money: Money.Money): string {
  const amount = Money.toDecimalString(money);
  const symbol = CURRENCY_SYMBOLS[money.currency] ?? `${money.currency} `;
  const negative = amount.startsWith("-");
  const digits = negative ? amount.slice(1) : amount;
  return `${negative ? "−" : ""}${symbol}${addThousandsSeparators(digits)}`;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
};

function addThousandsSeparators(decimal: string): string {
  const [intPart, fracPart] = decimal.split(".");
  const withSeparators = intPart!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return fracPart !== undefined ? `${withSeparators}.${fracPart}` : withSeparators;
}

export function formatDays(days: number): string {
  const rounded = Math.round(days * 100) / 100;
  const trimmed = rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `${trimmed} d`;
}

export function formatPercent(fraction: number, decimals = 0): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
