import { GameState } from '../types/game';

/**
 * Step 6: Job Processing
 * Tracks work experience.
 */
export interface JobResult {
  totalWeeksWorked: number;
}

export function processJobs(state: GameState): JobResult {
  let totalWeeksWorked = state?.totalWeeksWorked ?? 0;
  if (state?.currentJobId) {
    totalWeeksWorked += 1;
  }
  return { totalWeeksWorked };
}
