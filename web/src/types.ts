export type AuthUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role?: "USER" | "ADMIN";
  status?: UserStatus;
};

export type UserStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

export type AuthResponse = {
  token?: string;
  pending?: boolean;
  message?: string;
  user: AuthUser;
};


/** DAILY: todos los dias · WEEKLY: dias fijos · WEEKLY_COUNT: X veces por semana. */
export type ScheduleType = "DAILY" | "WEEKLY" | "WEEKLY_COUNT";
export type TimeOfDay = "ANYTIME" | "MORNING" | "AFTERNOON" | "EVENING";
/** BUILD: hacer algo · QUIT: dejar algo (dias limpio y recaidas). */
export type HabitKind = "BUILD" | "QUIT";
export type StreakUnit = "days" | "weeks";

export type ChallengeState = {
  startKey: string;
  endKey: string;
  days: number;
  /** Dia del reto en que va (0 si aun no empieza). */
  dayIndex: number;
  done: number;
  total: number;
  /** Dias que quedan, contando hoy. */
  remaining: number;
  status: "upcoming" | "active" | "won" | "broken";
  brokenOn: string | null;
};

export type PauseRange = { id: string; habitId: string | null; startKey: string; endKey: string; note: string | null };

export type Habit = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  icon: string | null;
  archived: boolean;
  kind: HabitKind;
  scheduleType: ScheduleType;
  scheduleDays: number[];
  /** X veces por semana. */
  weeklyTarget: number | null;
  timeOfDay: TimeOfDay;
  streakEnabled: boolean;
  /** Meta del dia: 1 = si/no; mas de 1 = medible. */
  goal: number;
  unit: string | null;
  /** Cuanto suma cada toque (medibles). */
  step: number;
  /** Dejar algo: primer dia limpio. */
  startDate: string | null;
  reminderEnabled: boolean;
  reminderTime: string | null;
  /** Todas las horas de aviso (HH:mm). */
  reminderTimes: string[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  /** Unidad de la racha: dias, o semanas en X veces por semana. En QUIT son dias limpio. */
  streakUnit: StreakUnit;
  currentStreak: number;
  longestStreak: number;
  /** Se llego a la meta ese dia. */
  completedToday: boolean;
  /** Aparece ese dia (se puede marcar). */
  scheduledToday: boolean;
  /** Ese dia se pedia: cuenta para el dia perfecto. */
  requiredToday: boolean;
  /** Cantidad del dia (medibles). */
  valueToday: number;
  /** X veces por semana: veces hechas esta semana. */
  weekDone: number | null;
  relapsedToday: boolean;
  frozenToday: boolean;
  /** Ultimo dia de la pausa que cubre ese dia. */
  pausedUntil: string | null;
  challenge: ChallengeState | null;
  note?: string | null;
  recentCompletions?: string[];
  /** Solo en el detalle. */
  totalCompletions?: number;
  recentNotes?: { date: string; note: string }[];
  amounts?: { date: string; value: number }[];
  relapses?: { date: string; note: string | null }[];
  freezeDates?: string[];
  pauses?: PauseRange[];
  challengeWins?: { id: string; days: number; startDate: string; endDate: string; wonAt: string }[];
  /** Algo que celebrar al cargar (hitos de dias limpio, retos cumplidos). */
  unlockedAchievement?: UnlockedAchievement;
  challengeWon?: UnlockedAchievement;
};

export type HabitToday = Habit & {
  scheduledForDate: string;
  /** Nota de ese dia. */
  note: string | null;
};

export type HabitAchievementRow = {
  id: string;
  habitId: string;
  milestoneDays: number;
  phraseIndex: number;
  unlockedAt: string;
  label?: string;
  headline?: string;
  kind?: AchievementKind;
};

export type AchievementKind = "days" | "weeks" | "clean" | "challenge";

export type UnlockedAchievement = {
  id: string;
  habitId: string;
  milestoneDays: number;
  phraseIndex: number;
  unlockedAt: string;
  habitTitle: string;
  habitColor: string;
  habitIcon: string | null;
  label: string;
  /** Titular listo ("3 semanas seguidas", "10 días limpio", "Reto de 30 días cumplido"). */
  headline?: string;
  kind?: AchievementKind;
};

export type CompleteHabitResponse = {
  habit: Habit;
  value?: number;
  done?: boolean;
  unlockedAchievement?: UnlockedAchievement;
  challengeWon?: UnlockedAchievement;
};

export type CreateHabitPayload = {
  title: string;
  description?: string;
  color?: string;
  icon?: string | null;
  kind?: HabitKind;
  scheduleType?: ScheduleType;
  scheduleDays?: number[];
  weeklyTarget?: number;
  timeOfDay?: TimeOfDay;
  streakEnabled?: boolean;
  goal?: number;
  unit?: string | null;
  step?: number;
  startDate?: string;
  challengeDays?: number | null;
  challengeStart?: string;
  reminderEnabled?: boolean;
  reminderTime?: string;
  reminderTimes?: string[];
};

export type SpecialAchievement = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  progress: number;
  target: number;
  unlocked: boolean;
  count: number;
  note: string | null;
};

export type ChallengeTrophy = UnlockedAchievement & { startDate: string; endDate: string };

export type AchievementsSummary = {
  totalMilestones: number;
  specials: SpecialAchievement[];
  challenges: ChallengeTrophy[];
  habits: {
    habit: {
      id: string;
      title: string;
      color: string;
      icon: string | null;
      streakEnabled: boolean;
      kind: HabitKind;
      streakUnit: StreakUnit;
    };
    currentStreak: number;
    longestStreak: number;
    unlocked: {
      id: string;
      milestoneDays: number;
      phraseIndex: number;
      unlockedAt: string;
      label: string;
      headline?: string;
      kind?: AchievementKind;
    }[];
    next: { milestoneDays: number; remaining: number; label: string } | null;
  }[];
};

export type FreezeBalance = { earned: number; used: number; available: number; level?: number };

export type HabitPause = {
  id: string;
  habitId: string | null;
  startDate: string;
  endDate: string;
  note: string | null;
  active: boolean;
  habit?: { title: string; icon: string | null; color: string } | null;
};


export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH";

export type Project = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  openTasks: number;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  projectId: string | null;
  project: { id: string; name: string; color: string } | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  reminderEnabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  overdue: boolean;
  dueToday: boolean;
};

export type CreateTaskPayload = {
  title: string;
  description?: string;
  projectId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  dueTime?: string | null;
  reminderEnabled?: boolean;
};

export type CreateProjectPayload = {
  name: string;
  color?: string;
};


export type ReminderItem = {
  id: string;
  sourceType: "HABIT" | "TASK" | "SUMMARY" | "MORNING";
  sourceId: string;
  title: string;
  body: string | null;
  triggerAt: string;
  createdAt: string;
};


export type OverviewPause = { id: string; startDate: string; endDate: string; note: string | null };

export type StatsOverview = {
  habits: {
    active: number;
    weekCompletionRate: number;
    daily: { date: string; label: string; scheduled: number; completed: number; rate: number }[];
    topStreaks: { id: string; title: string; color: string; currentStreak: number; longestStreak: number; streakUnit?: StreakUnit }[];
    /** Dias seguidos con todos los habitos cumplidos (hoy suma solo si ya esta completo). */
    perfectStreak: number;
    todayPerfect: boolean;
    perfectDaysTotal: number;
    level: LevelInfo;
    freezes?: FreezeBalance;
    /** Pausa de todos los habitos que cubre hoy. */
    pause?: OverviewPause | null;
    nextPause?: OverviewPause | null;
  };
  tasks: {
    open: number;
    completedThisWeek: number;
    daily: { date: string; label: string; completed: number }[];
  };
};

export type HabitStatsDetail = {
  id: string;
  title: string;
  color: string;
  streakEnabled: boolean;
  currentStreak: number;
  longestStreak: number;
  completionRate30d: number;
  calendar: { date: string; scheduled: boolean; completed: boolean }[];
};

export type TaskStatsSummary = {
  byStatus: { todo: number; inProgress: number; done: number };
  byPriorityOpen: { high: number; medium: number; low: number };
  weeklyCompleted: { label: string; completed: number }[];
};


export type ManagedUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: "USER" | "ADMIN";
  status?: UserStatus;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserPayload = {
  email: string;
  username: string;
  fullName: string;
  password: string;
  role?: "USER" | "ADMIN";
};


export type LevelInfo = {
  xp: number;
  todayXp: number;
  level: number;
  title: string;
  levelStartXp: number;
  nextLevelXp: number;
};

export type DayStat = { date: string; scheduled: number; completed: number; rate: number; perfect: boolean };

export type RankingRow = {
  id: string;
  title: string;
  icon: string | null;
  color: string;
  streakEnabled: boolean;
  scheduled: number;
  completed: number;
  rate: number;
  currentStreak: number;
  streakUnit?: StreakUnit;
};

export type StatsRange = {
  from: string;
  to: string;
  days: DayStat[];
  byWeekday: { weekday: number; scheduled: number; completed: number; rate: number }[];
  byHour: number[];
  totals: { scheduled: number; completed: number; rate: number; perfectDays: number };
  ranking: RankingRow[];
  mood: { entries: number; average: number | null; highRate: number | null; lowRate: number | null };
  moods: DayMood[];
};

export type DayMood = { date: string; mood: number };

/** Frase sacada de tus datos (sin IA). */
export type Insight = {
  id: string;
  emoji: string;
  title: string;
  text: string;
  tone: "good" | "tip" | "info";
  habitId?: string;
  score: number;
};

type MonthHabit = { id: string; title: string; icon: string | null; color: string; rate: number; completed: number };

/** Tu mes en HabitFer (para las tarjetas del resumen). */
export type MonthSummary = {
  month: string;
  from: string;
  to: string;
  complete: boolean;
  firstMonth: string;
  totals: { scheduled: number; completed: number; rate: number; perfectDays: number; activeDays: number; days: number };
  bestDay: { date: string; completed: number } | null;
  bestWeekday: { weekday: number; rate: number } | null;
  bestHour: number | null;
  starHabit: MonthHabit | null;
  topHabits: MonthHabit[];
  longestStreak: { id: string; title: string; icon: string | null; color: string; days: number; unit: StreakUnit } | null;
  xp: number;
  levelStart: number;
  levelEnd: number;
  cleanDays: number;
  moodAverage: number | null;
  previousRate: number | null;
  challengesWon: { id: string; days: number; title: string; icon: string | null; color: string }[];
};

export type ImportReport = {
  habitsCreated: number;
  habitsMerged: number;
  completions: number;
  amounts: number;
  relapses: number;
  freezes: number;
  achievements: number;
  challenges: number;
  pauses: number;
  moods: number;
  projects: number;
  tasks: number;
};

export type CoachMessage = { id: string; weekStart: string; text: string; createdAt: string; readAt: string | null };

export type CoachState = {
  /** El servidor tiene la llave de Claude. */
  enabled: boolean;
  /** El usuario quiere recibirlo. */
  optedIn: boolean;
  week: string;
  message: CoachMessage | null;
  canGenerate: boolean;
};
