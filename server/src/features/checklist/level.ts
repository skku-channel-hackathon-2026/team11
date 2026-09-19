import type { HomeProgress } from "@tutorial/shared";

export const levelConfig = [
  { level: 1, threshold: 0, name: "첫 발걸음" },
  { level: 2, threshold: 50, name: "캠퍼스 탐색자" },
  { level: 3, threshold: 120, name: "적응 중인 새내기" },
  { level: 4, threshold: 200, name: "캠퍼스 적응자" },
  { level: 5, threshold: 300, name: "익숙한 대학생" },
  { level: 6, threshold: 420, name: "능숙한 캠퍼스인" },
  { level: 7, threshold: 560, name: "학교생활 해결사" },
  { level: 8, threshold: 720, name: "캠퍼스 베테랑" },
  { level: 9, threshold: 900, name: "한눈 마스터" },
  { level: 10, threshold: 1100, name: "캠퍼스 마스터" },
] as const;

export function calculateLevelProgress(
  totalXp: number,
  completedTasks: number,
  totalTasks: number,
): HomeProgress {
  const current = [...levelConfig]
    .reverse()
    .find((item) => totalXp >= item.threshold) ?? levelConfig[0];
  const next = levelConfig.find((item) => item.level === current.level + 1) ?? null;
  const nextLevelXp = next ? next.threshold - current.threshold : null;
  const currentLevelXp = next ? totalXp - current.threshold : totalXp;
  const nextLevelRemainingXp = next ? Math.max(next.threshold - totalXp, 0) : 0;

  return {
    totalXp,
    level: current.level,
    levelName: current.name,
    currentLevelXp,
    nextLevelXp,
    nextLevelRemainingXp,
    isMaxLevel: !next,
    completedTasks,
    totalTasks,
    completionRate: totalTasks > 0 ? completedTasks / totalTasks : 0,
  };
}
