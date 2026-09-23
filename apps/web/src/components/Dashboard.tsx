"use client";

import { useState } from "react";
import type { ProjectState } from "@nashtract/ledger";
import { formatMoney } from "@/lib/format";
import { Button } from "./ui/Button";
import { MilestoneCard } from "./MilestoneCard";
import { MilestoneDetail } from "./MilestoneDetail";
import { ProposeMilestoneForm } from "./ProposeMilestoneForm";
import { CalibrationView } from "./CalibrationView";

type Tab = "milestones" | "calibration";

export function Dashboard({ project }: { project: ProjectState }) {
  const [tab, setTab] = useState<Tab>("milestones");
  const [selected, setSelected] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);

  const milestones = [...project.milestones.values()];
  const selectedMilestone = selected ? project.milestones.get(selected) : undefined;

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Project</h1>
          <p className="mt-1 text-sm text-ink-soft">Reference rate {formatMoney(project.referenceRate)} / effort-day</p>
        </div>
        <nav className="inline-flex rounded-full border border-line bg-bg-2 p-1 text-sm">
          {(["milestones", "calibration"] as const).map((key) => (
            <button
              key={key}
              onClick={() => {
                setTab(key);
                setSelected(null);
              }}
              className={`rounded-full px-3.5 py-1.5 capitalize transition-colors duration-150 ${
                tab === key ? "bg-accent text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {key}
            </button>
          ))}
        </nav>
      </div>

      {tab === "calibration" ? (
        <CalibrationView project={project} />
      ) : selectedMilestone ? (
        <MilestoneDetail milestone={selectedMilestone} onBack={() => setSelected(null)} />
      ) : proposing ? (
        <ProposeMilestoneForm onDone={() => setProposing(false)} />
      ) : (
        <div>
          <div className="mb-4 flex justify-end">
            <Button variant="primary" onClick={() => setProposing(true)}>
              Propose milestone
            </Button>
          </div>
          {milestones.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-ink-faint">
              No milestones yet.
            </div>
          ) : (
            <div className="space-y-3">
              {milestones.map((m) => (
                <MilestoneCard key={m.milestoneId} milestone={m} onClick={() => setSelected(m.milestoneId)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
