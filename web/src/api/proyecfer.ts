import { api } from "./client";
import type {
  ActivityItem,
  BlockItem,
  CollabProject,
  CollabProjectDetail,
  CollabTask,
  CommentItem,
  DatabaseDetail,
  PageDetail,
  WorkspaceDetail,
  WorkspaceSummary,
  WorkspaceUser,
} from "../types/proyecfer";

export async function fetchWorkspaces() {
  const { data } = await api.get<WorkspaceSummary[]>("/proyecfer/workspaces");
  return data;
}

export async function createWorkspace(payload: { name: string; description?: string; icon?: string }) {
  const { data } = await api.post<WorkspaceSummary>("/proyecfer/workspaces", payload);
  return data;
}

export async function fetchWorkspace(id: string) {
  const { data } = await api.get<WorkspaceDetail>("/proyecfer/workspaces/" + id);
  return data;
}

export async function updateWorkspace(
  id: string,
  payload: { name?: string; description?: string; icon?: string },
) {
  const { data } = await api.patch<WorkspaceDetail>("/proyecfer/workspaces/" + id, payload);
  return data;
}

export async function addWorkspaceMember(workspaceId: string, userId: string, role?: string) {
  const { data } = await api.post("/proyecfer/workspaces/" + workspaceId + "/members", { userId, role });
  return data;
}

export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  await api.delete("/proyecfer/workspaces/" + workspaceId + "/members/" + userId);
}

export async function searchWorkspaceUsers(workspaceId: string, q: string) {
  const { data } = await api.get<WorkspaceUser[]>("/proyecfer/workspaces/" + workspaceId + "/users/search", { params: { q } });
  return data;
}

export async function fetchWorkspaceActivity(workspaceId: string, projectId?: string) {
  const { data } = await api.get<ActivityItem[]>("/proyecfer/workspaces/" + workspaceId + "/activity", {
    params: projectId ? { projectId } : undefined,
  });
  return data;
}

export async function fetchCollabProjects(workspaceId: string) {
  const { data } = await api.get<CollabProject[]>("/proyecfer/workspaces/" + workspaceId + "/projects");
  return data;
}

export async function createCollabProject(workspaceId: string, payload: { name: string; description?: string; color?: string }) {
  const { data } = await api.post<CollabProject>("/proyecfer/workspaces/" + workspaceId + "/projects", payload);
  return data;
}

export async function fetchCollabProject(projectId: string) {
  const { data } = await api.get<CollabProjectDetail>("/proyecfer/projects/" + projectId);
  return data;
}

export async function updateCollabProject(
  projectId: string,
  payload: { name?: string; description?: string; color?: string },
) {
  const { data } = await api.patch<CollabProject>("/proyecfer/projects/" + projectId, payload);
  return data;
}

export async function createCollabTask(projectId: string, payload: Partial<CollabTask> & { title: string }) {
  const { data } = await api.post<CollabTask>("/proyecfer/projects/" + projectId + "/tasks", payload);
  return data;
}

export async function updateCollabTask(taskId: string, payload: Partial<CollabTask>) {
  const { data } = await api.patch<CollabTask>("/proyecfer/tasks/" + taskId, payload);
  return data;
}

export async function deleteCollabTask(taskId: string) {
  await api.delete("/proyecfer/tasks/" + taskId);
}

export async function fetchComments(targetType: string, targetId: string) {
  const { data } = await api.get<CommentItem[]>("/proyecfer/comments", { params: { targetType, targetId } });
  return data;
}

export async function createComment(payload: { targetType: string; targetId: string; body: string; parentCommentId?: string }) {
  const { data } = await api.post<CommentItem>("/proyecfer/comments", payload);
  return data;
}

export async function fetchPage(pageId: string) {
  const { data } = await api.get<PageDetail>("/proyecfer/pages/" + pageId);
  return data;
}

export async function updatePage(pageId: string, payload: { title?: string; icon?: string }) {
  const { data } = await api.patch<PageDetail>("/proyecfer/pages/" + pageId, payload);
  return data;
}

export async function createPage(payload: { workspaceId: string; title: string; projectId?: string; icon?: string }) {
  const { data } = await api.post<PageDetail>("/proyecfer/pages", payload);
  return data;
}

export async function savePageBlocks(
  pageId: string,
  blocks: { type: string; content: Record<string, unknown>; sortOrder: number; parentBlockId?: string }[],
) {
  const { data } = await api.put<BlockItem[]>("/proyecfer/pages/" + pageId + "/blocks", { blocks });
  return data;
}

export async function fetchDatabase(databaseId: string) {
  const { data } = await api.get<DatabaseDetail>("/proyecfer/databases/" + databaseId);
  return data;
}

export async function createDatabase(pageId: string, title: string) {
  const { data } = await api.post<DatabaseDetail>("/proyecfer/databases", { pageId, title });
  return data;
}

export async function addDatabaseRow(databaseId: string, title: string, values?: Record<string, unknown>) {
  const { data } = await api.post("/proyecfer/databases/" + databaseId + "/rows", { title, values });
  return data;
}

export async function updateDatabaseRow(rowId: string, values: Record<string, unknown>, title?: string) {
  const { data } = await api.patch("/proyecfer/databases/rows/" + rowId, { values, title });
  return data;
}

export async function fetchProyecFerStats(workspaceId: string) {
  const { data } = await api.get<import("../types/proyecfer").ProyecFerStats>(
    "/proyecfer/workspaces/" + workspaceId + "/stats",
  );
  return data;
}

export async function fetchCollabNotifications(unreadOnly = false) {
  const { data } = await api.get<import("../types/proyecfer").CollabNotificationItem[]>(
    "/proyecfer/notifications",
    { params: unreadOnly ? { unread: "1" } : undefined },
  );
  return data;
}

export async function markCollabNotificationRead(id: string) {
  await api.patch("/proyecfer/notifications/" + id + "/read");
}

export async function markAllCollabNotificationsRead() {
  await api.patch("/proyecfer/notifications/read-all");
}

export async function fetchWorkGuides(projectId: string) {
  const { data } = await api.get<import("../types/proyecfer").WorkGuideSummary[]>(
    "/proyecfer/projects/" + projectId + "/work-guides",
  );
  return data;
}

export async function createWorkGuide(
  projectId: string,
  payload: { title: string; description?: string; icon?: string; category?: string },
) {
  const { data } = await api.post<import("../types/proyecfer").WorkGuideDetail>(
    "/proyecfer/projects/" + projectId + "/work-guides",
    payload,
  );
  return data;
}

export async function fetchWorkGuide(guideId: string) {
  const { data } = await api.get<import("../types/proyecfer").WorkGuideDetail>(
    "/proyecfer/work-guides/" + guideId,
  );
  return data;
}

export async function updateWorkGuide(
  guideId: string,
  payload: Partial<{ title: string; description: string; icon: string; category: string; published: boolean }>,
) {
  const { data } = await api.patch<import("../types/proyecfer").WorkGuideDetail>(
    "/proyecfer/work-guides/" + guideId,
    payload,
  );
  return data;
}

export async function deleteWorkGuide(guideId: string) {
  await api.delete("/proyecfer/work-guides/" + guideId);
}

export async function addWorkGuideStep(
  guideId: string,
  payload: { title: string; summary?: string; content?: string; tips?: string; durationMin?: number },
) {
  const { data } = await api.post<import("../types/proyecfer").WorkGuideStep>(
    "/proyecfer/work-guides/" + guideId + "/steps",
    payload,
  );
  return data;
}

export async function updateWorkGuideStep(
  stepId: string,
  payload: Partial<{ title: string; summary: string; content: string; tips: string; durationMin: number | null }>,
) {
  const { data } = await api.patch<import("../types/proyecfer").WorkGuideStep>(
    "/proyecfer/work-guides/steps/" + stepId,
    payload,
  );
  return data;
}

export async function deleteWorkGuideStep(stepId: string) {
  await api.delete("/proyecfer/work-guides/steps/" + stepId);
}

export async function reorderWorkGuideSteps(guideId: string, stepIds: string[]) {
  const { data } = await api.put<import("../types/proyecfer").WorkGuideStep[]>(
    "/proyecfer/work-guides/" + guideId + "/steps/reorder",
    { stepIds },
  );
  return data;
}
