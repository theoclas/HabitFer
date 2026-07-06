import type { TaskPriority, TaskStatus } from "../types";

export type WorkspaceRole = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

export type WorkspaceSummary = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  ownerId: string;
  archived: boolean;
  myRole: WorkspaceRole;
  projectCount: number;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceUser = {
  id: string;
  username: string;
  fullName: string;
  email: string;
};

export type WorkspaceMember = {
  id: string;
  userId: string;
  role: WorkspaceRole;
  user: WorkspaceUser;
  joinedAt: string;
};

export type WorkspaceDetail = WorkspaceSummary & {
  members: WorkspaceMember[];
};

export type CollabProject = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  archived: boolean;
  openTasks?: number;
  createdAt: string;
  updatedAt: string;
};

export type CollabTaskKind = "ONE_OFF" | "DAILY";

export type CollabTaskCompletion = {
  date: string;
  completedById: string;
};

export type CollabTask = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  kind: CollabTaskKind;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assignee: WorkspaceUser | null;
  createdById: string;
  createdBy?: WorkspaceUser;
  dueDate: string | null;
  dueTime: string | null;
  activeFrom: string | null;
  sourceDailyId?: string | null;
  scheduledDate?: string | null;
  sourceDaily?: { id: string; title: string } | null;
  completions?: CollabTaskCompletion[];
  completedOnDate?: boolean;
  rate7d?: number;
  currentStreak?: number;
  createdAt: string;
  updatedAt: string;
};

export type CollabProjectDetail = CollabProject & {
  tasks: CollabTask[];
  dailyTemplates?: CollabTask[];
  pages: { id: string; title: string; icon: string | null }[];
  workGuides?: WorkGuideSummary[];
  members: { user: WorkspaceUser; role: WorkspaceRole }[];
};

export type WorkGuideSummary = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  published: boolean;
  stepCount?: number;
  _count?: { steps: number };
};

export type WorkGuideStep = {
  id: string;
  guideId: string;
  title: string;
  summary: string | null;
  content: string | null;
  tips: string | null;
  durationMin: number | null;
  sortOrder: number;
};

export type WorkGuideDetail = {
  id: string;
  workspaceId: string;
  projectId: string;
  title: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  published: boolean;
  steps: WorkGuideStep[];
  createdBy: WorkspaceUser;
  project: { id: string; name: string; color: string };
  createdAt: string;
  updatedAt: string;
};

export type CommentItem = {
  id: string;
  body: string;
  author: WorkspaceUser;
  createdAt: string;
  replies?: CommentItem[];
};

export type ActivityItem = {
  id: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: WorkspaceUser;
};

export type BlockItem = {
  id: string;
  type: string;
  content: Record<string, unknown>;
  sortOrder: number;
  parentBlockId: string | null;
};

export type PageDetail = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string;
  icon: string | null;
  coverUrl: string | null;
  blocks: BlockItem[];
  childPages: { id: string; title: string; icon: string | null }[];
  database: DatabaseDetail | null;
};

export type DatabaseProperty = {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  sortOrder: number;
};

export type DatabaseView = {
  id: string;
  name: string;
  type: "TABLE" | "BOARD" | "CALENDAR" | "GALLERY";
  config: Record<string, unknown>;
  sortOrder: number;
};

export type DatabaseRow = {
  id: string;
  pageId: string;
  values: Record<string, unknown>;
  page: { id: string; title: string; icon: string | null };
};

export type DatabaseDetail = {
  id: string;
  pageId: string;
  title: string;
  properties: DatabaseProperty[];
  views: DatabaseView[];
  rows: DatabaseRow[];
  page?: { workspaceId: string; projectId: string | null };
};

export type ProyecFerStats = {
  totalProjects: number;
  openTasks: number;
  doneTasks: number;
  totalTasks?: number;
  dailyTaskCount?: number;
  dailyComplianceRate7d?: number;
  dailyComplianceRate30d?: number;
  totalMembers?: number;
  totalGuides?: number;
  totalPages?: number;
  completionRate?: number;
  byAssignee: Record<string, number>;
  byStatus?: { TODO: number; IN_PROGRESS: number; DONE: number };
  projects?: WorkspaceProjectSummary[];
};

export type WorkspaceProjectSummary = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  openTasks: number;
  doneTasks: number;
  totalTasks: number;
  dailyTaskCount?: number;
  dailyComplianceRate7d?: number;
  guideCount: number;
  updatedAt: string;
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
  tasks: {
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
  }[];
  byAssignee: {
    assigneeId: string | null;
    assigneeName: string;
    expectedDays: number;
    completedDays: number;
    rate: number;
  }[];
  trend: { date: string; expected: number; completed: number; rate: number }[];
};

export type CollabNotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
};
