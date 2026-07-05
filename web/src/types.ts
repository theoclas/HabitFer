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


export type ScheduleType = "DAILY" | "WEEKLY";

export type Habit = {
  id: string;
  title: string;
  description: string | null;
  color: string;
  icon: string | null;
  archived: boolean;
  scheduleType: ScheduleType;
  scheduleDays: number[];
  streakEnabled: boolean;
  reminderEnabled: boolean;
  reminderTime: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  scheduledToday: boolean;
  recentCompletions?: string[];
};

export type HabitToday = Habit & {
  scheduledForDate: string;
};

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
};

export type CompleteHabitResponse = {
  habit: Habit;
  unlockedAchievement?: UnlockedAchievement;
};

export type CreateHabitPayload = {
  title: string;
  description?: string;
  color?: string;
  icon?: string | null;
  scheduleType?: ScheduleType;
  scheduleDays?: number[];
  streakEnabled?: boolean;
  reminderEnabled?: boolean;
  reminderTime?: string;
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
  sourceType: "HABIT" | "TASK";
  sourceId: string;
  title: string;
  body: string | null;
  triggerAt: string;
  createdAt: string;
};


export type StatsOverview = {
  habits: {
    active: number;
    weekCompletionRate: number;
    daily: { date: string; label: string; scheduled: number; completed: number; rate: number }[];
    topStreaks: { id: string; title: string; color: string; currentStreak: number; longestStreak: number }[];
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

