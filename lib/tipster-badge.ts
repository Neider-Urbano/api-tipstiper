export type TipsterBadge =
  | "RISING_STAR"
  | "RELIABILITY"
  | "TOP_5_GLOBAL"
  | "TOP_1_GLOBAL"
  | null;

interface StatsForBadge {
  totalPicks: number;
  wonPicks: number;
  winRate: number;
  yield: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(Math.floor(sorted.length * p), sorted.length - 1);
  return sorted[idx];
}

export function computeBadge(
  stats: StatsForBadge,
  allYields: number[],
): TipsterBadge {
  const { totalPicks, winRate, yield: tipsterYield } = stats;

  if (totalPicks < 20) return null;

  const sorted = [...allYields].sort((a, b) => a - b);
  const p95 = percentile(sorted, 0.95);
  const p99 = percentile(sorted, 0.99);

  if (tipsterYield >= p99) return "TOP_1_GLOBAL";
  if (tipsterYield >= p95) return "TOP_5_GLOBAL";
  if (totalPicks < 50 && winRate >= 60) return "RISING_STAR";
  if (totalPicks >= 50 && winRate >= 60) return "RELIABILITY";

  return null;
}
