"use client";

import { useState, type FormEvent } from "react";
import { Money } from "@nashtract/core";
import { useStore } from "@/lib/store";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { TextField } from "./ui/Field";
import { Mark } from "./Mark";

export function CreateProjectForm() {
  const { createProject } = useStore();
  const [rate, setRate] = useState("1500");
  const [currency, setCurrency] = useState("EUR");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const referenceRate = Money.money(rate, currency);
      if (Money.compare(referenceRate, Money.zero(currency)) <= 0) {
        setError("Reference rate must be greater than zero.");
        return;
      }
      createProject(referenceRate);
    } catch {
      setError("Enter a valid decimal amount.");
    }
  }

  return (
    <div className="mx-auto max-w-md py-16 text-center sm:py-24">
      <Mark className="mx-auto mb-6 h-8 w-8 text-accent" />
      <h1 className="text-2xl font-semibold tracking-tight">Start a project</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-ink-soft">
        One reference rate, shared by every milestone you propose within it. You can act as either party at any
        time using the switch in the header.
      </p>
      <Card className="mt-8 text-left">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <TextField
              label="Reference daily rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-soft">Currency</span>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-[38px] rounded-lg border border-line bg-bg-2 px-3 text-sm text-ink focus:border-accent focus:outline-none"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
              </select>
            </label>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" variant="primary" className="w-full">
            Create project
          </Button>
        </form>
      </Card>
    </div>
  );
}
