import { CollabTask, CollabTaskCompletion } from '@prisma/client';
import { addDays, localTodayKey, parseDateKey, toDateKey } from '../common/date.utils';

export type DailyTaskWithCompletions = CollabTask & {
  completions: CollabTaskCompletion[];
  assignee: { id: string; fullName: string } | null;
};

export function taskActiveFromKey(task: { activeFrom: Date | null; createdAt: Date }): string {
  if (task.activeFrom) return toDateKey(task.activeFrom);
  return toDateKey(task.createdAt);
}

export function eachDayKey(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = parseDateKey(from);
  const end = parseDateKey(to);
  while (cursor.getTime() <= end.getTime()) {
    days.push(toDateKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function defaultComplianceRange(days = 30): { from: string; to: string } {
  const to = localTodayKey();
  const from = toDateKey(addDays(parseDateKey(to), -(days - 1)));
  return { from, to };
}

export function parseComplianceRange(from?: string, to?: string, defaultDays = 30) {
  if (from && to) return { from, to };
  return defaultComplianceRange(defaultDays);
}

export function expectedDaysForTask(task: { activeFrom: Date | null; createdAt: Date }, from: string, to: string): string[] {
  const start = taskActiveFromKey(task);
  const rangeStart = from > start ? from : start;
  if (rangeStart > to) return [];
  return eachDayKey(rangeStart, to);
}

export function completionKeySet(completions: CollabTaskCompletion[]): Set<string> {
  return new Set(completions.map((c) => toDateKey(c.date)));
}

export function currentStreak(completedKeys: Set<string>, refDate: string): number {
  let streak = 0;
  let cursor = parseDateKey(refDate);
  for (let i = 0; i < 400; i++) {
    const key = toDateKey(cursor);
    if (completedKeys.has(key)) {
      streak++;
    } else if (key === refDate) {
      // hoy pendiente no rompe
    } else {
      break;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function rate(completed: number, expected: number): number {
  if (expected <= 0) return 0;
  return Math.round((completed / expected) * 100);
}

export type TaskComplianceRow = {
  taskId: string;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  expectedDays: number;
  completedDays: number;
  rate: number;
  currentStreak: number;
  lastCompletedDate: string | null;
  days: { date: string; done: boolean }[];
};

export type AssigneeComplianceRow = {
  assigneeId: string | null;
  assigneeName: string;
  expectedDays: number;
  completedDays: number;
  rate: number;
};

export type DailyTrendPoint = {
  date: string;
  expected: number;
  completed: number;
  rate: number;
};

export type ComplianceReport = {
  from: string;
  to: string;
  projectId: string;
  dailyTaskCount: number;
  totals: {
    expectedDays: number;
    completedDays: number;
    rate: number;
    perfectDays: number;
    rate7d: number;
    rate30d: number;
  };
  tasks: TaskComplianceRow[];
  byAssignee: AssigneeComplianceRow[];
  trend: DailyTrendPoint[];
};

export function buildComplianceReport(
  projectId: string,
  tasks: DailyTaskWithCompletions[],
  from: string,
  to: string,
): ComplianceReport {
  const days = eachDayKey(from, to);
  const trendMap = new Map<string, { expected: number; completed: number }>();
  for (const d of days) trendMap.set(d, { expected: 0, completed: 0 });

  const assigneeMap = new Map<string, AssigneeComplianceRow>();
  const taskRows: TaskComplianceRow[] = [];
  let totalExpected = 0;
  let totalCompleted = 0;

  for (const task of tasks) {
    const expected = expectedDaysForTask(task, from, to);
    const keys = completionKeySet(task.completions);
    const completedInRange = expected.filter((d) => keys.has(d)).length;
    totalExpected += expected.length;
    totalCompleted += completedInRange;

    const assigneeKey = task.assigneeId ?? '__unassigned__';
    const assigneeName = task.assignee?.fullName ?? 'Sin asignar';
    const agg = assigneeMap.get(assigneeKey) ?? {
      assigneeId: task.assigneeId,
      assigneeName,
      expectedDays: 0,
      completedDays: 0,
      rate: 0,
    };
    agg.expectedDays += expected.length;
    agg.completedDays += completedInRange;
    assigneeMap.set(assigneeKey, agg);

    const dayCells = expected.map((date) => {
      const done = keys.has(date);
      const bucket = trendMap.get(date);
      if (bucket) {
        bucket.expected += 1;
        if (done) bucket.completed += 1;
      }
      return { date, done };
    });

    const completedDates = [...keys].filter((d) => d >= from && d <= to).sort();
    const lastCompletedDate = completedDates.length ? completedDates[completedDates.length - 1] : null;

    taskRows.push({
      taskId: task.id,
      title: task.title,
      assigneeId: task.assigneeId,
      assigneeName: task.assignee?.fullName ?? null,
      expectedDays: expected.length,
      completedDays: completedInRange,
      rate: rate(completedInRange, expected.length),
      currentStreak: currentStreak(keys, to),
      lastCompletedDate,
      days: dayCells,
    });
  }

  let perfectDays = 0;
  const trend: DailyTrendPoint[] = days.map((date) => {
    const bucket = trendMap.get(date)!;
    if (bucket.expected > 0 && bucket.completed === bucket.expected) perfectDays += 1;
    return {
      date,
      expected: bucket.expected,
      completed: bucket.completed,
      rate: rate(bucket.completed, bucket.expected),
    };
  });

  const range7 = defaultComplianceRange(7);
  const range30 = defaultComplianceRange(30);
  const rate7 = aggregateRate(tasks, range7.from, range7.to);
  const rate30 = aggregateRate(tasks, range30.from, range30.to);

  const byAssignee = [...assigneeMap.values()].map((a) => ({
    ...a,
    rate: rate(a.completedDays, a.expectedDays),
  }));

  return {
    from,
    to,
    projectId,
    dailyTaskCount: tasks.length,
    totals: {
      expectedDays: totalExpected,
      completedDays: totalCompleted,
      rate: rate(totalCompleted, totalExpected),
      perfectDays,
      rate7d: rate7,
      rate30d: rate30,
    },
    tasks: taskRows,
    byAssignee,
    trend,
  };
}

function aggregateRate(tasks: DailyTaskWithCompletions[], from: string, to: string): number {
  let expected = 0;
  let completed = 0;
  for (const task of tasks) {
    const days = expectedDaysForTask(task, from, to);
    const keys = completionKeySet(task.completions);
    expected += days.length;
    completed += days.filter((d) => keys.has(d)).length;
  }
  return rate(completed, expected);
}

export function buildWorkspaceDailyRates(
  tasks: DailyTaskWithCompletions[],
): { rate7d: number; rate30d: number; dailyTaskCount: number } {
  const daily = tasks.filter((t) => t.kind === 'DAILY');
  const range7 = defaultComplianceRange(7);
  const range30 = defaultComplianceRange(30);
  return {
    dailyTaskCount: daily.length,
    rate7d: aggregateRate(daily, range7.from, range7.to),
    rate30d: aggregateRate(daily, range30.from, range30.to),
  };
}

export function projectDailyRate(
  tasks: DailyTaskWithCompletions[],
  projectId: string,
  days = 7,
): number {
  const daily = tasks.filter((t) => t.kind === 'DAILY' && t.projectId === projectId);
  const range = defaultComplianceRange(days);
  return aggregateRate(daily, range.from, range.to);
}
