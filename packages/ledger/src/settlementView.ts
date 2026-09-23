/**
 * Query helpers that project a `MilestoneAggregate` back through
 * `@nashtract/core`'s pure settlement math. Nothing here is stored in
 * the ledger — it is recomputed on demand from frozen accepted terms
 * (widened by any accepted continuations) and accumulated effort, so
 * there is exactly one implementation of the settlement equation in
 * the whole system (SPEC.md §13).
 */

import { calculateMaximumExposure, calculateSettlement, type Exposure, type Settlement } from "@nashtract/core";
import { effectiveAcceptedTerms, type MilestoneAggregate } from "./replay.js";

/** Maximum automatic exposure under the milestone's current effective boundary (SPEC.md §5). */
export function computeMilestoneExposure(milestone: MilestoneAggregate): Exposure {
  return calculateMaximumExposure(effectiveAcceptedTerms(milestone));
}

/**
 * Settlement for the effort consumed so far. Valid to call at any
 * point after acceptance — during ACTIVE this is a live preview
 * ("what would this settle at right now"), not only a final figure.
 */
export function computeMilestoneSettlement(milestone: MilestoneAggregate): Settlement {
  return calculateSettlement(effectiveAcceptedTerms(milestone), milestone.consumedEffortDays);
}
