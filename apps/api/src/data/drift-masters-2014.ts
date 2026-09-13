import type { DmManualEvent, DmManualRoundResult } from './drift-masters-2014-r1.js';
import { DM_2014_R1_EVENT, DM_2014_R1_RESULTS } from './drift-masters-2014-r1.js';
import { DM_2014_R2_EVENT, DM_2014_R2_RESULTS } from './drift-masters-2014-r2.js';
import { DM_2014_R3_EVENT, DM_2014_R3_RESULTS } from './drift-masters-2014-r3.js';

export interface DmManualRound {
  event: DmManualEvent;
  results: DmManualRoundResult[];
}

export const DM_2014_ROUNDS: DmManualRound[] = [
  { event: DM_2014_R1_EVENT, results: DM_2014_R1_RESULTS },
  { event: DM_2014_R2_EVENT, results: DM_2014_R2_RESULTS },
  { event: DM_2014_R3_EVENT, results: DM_2014_R3_RESULTS },
];
