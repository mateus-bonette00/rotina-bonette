import { Router } from "express";
import { DAILY_RANK_LABEL, type ScoreReason } from "rotina-bonette-shared";
import { asyncHandler } from "../lib/http.js";
import { presentTasks, taskInclude, type TaskWithProject } from "../lib/present.js";
import { prisma } from "../lib/prisma.js";

type Ranked = TaskWithProject & { score: number; reasons: ScoreReason[] };

const statusOrder = ["DOING", "TODAY", "THIS_WEEK", "WAITING", "BACKLOG", "INBOX"];

function compareToday(a: Ranked, b: Ranked): number {
  const rankA = a.dailyRank ?? 99;
  const rankB = b.dailyRank ?? 99;
  if (rankA !== rankB) return rankA - rankB;
  if (a.score !== b.score) return b.score - a.score;
  return a.sortOrder - b.sortOrder;
}

function nextStep(tasks: { status: string; priority: string; nextAction: string | null; title: string; sortOrder: number }[]) {
  const open = [...tasks].sort((a, b) => {
    const byStatus = statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status);
    if (byStatus !== 0) return byStatus;
    if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
    return a.sortOrder - b.sortOrder;
  });
  const top = open[0];
  if (!top) return null;
  return top.nextAction || top.title;
}

export const dashboardRouter = Router();

dashboardRouter.get(
  "/today",
  asyncHandler(async (_req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [openTasks, doneToday, projects, agenda, runningFocus] = await Promise.all([
      prisma.task.findMany({
        where: { status: { not: "DONE" } },
        include: taskInclude,
        orderBy: { sortOrder: "asc" },
      }),
      prisma.task.findMany({
        where: { status: "DONE", completedAt: { gte: start, lte: end } },
        include: taskInclude,
        orderBy: { completedAt: "desc" },
      }),
      prisma.project.findMany({
        where: { status: "ACTIVE" },
        include: { tasks: { where: { status: { not: "DONE" } } } },
        orderBy: [{ priority: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.calendarBlock.findMany({
        where: { startAt: { lt: end }, endAt: { gt: start } },
        include: { project: { select: { id: true, name: true, color: true } } },
        orderBy: { startAt: "asc" },
      }),
      prisma.focusSession.findFirst({
        where: { status: "RUNNING" },
        include: { task: { select: { id: true, title: true } } },
      }),
    ]);

    const presented = await presentTasks(openTasks);
    const doing = presented.find((task) => task.status === "DOING") ?? null;
    const today = presented.filter((task) => task.status === "TODAY").sort(compareToday);
    const nowTask = doing ?? today[0] ?? null;
    const source = doing ? "doing" : nowTask ? "suggestion" : "empty";
    const reasons = nowTask ? [...nowTask.reasons] : [];
    if (source === "suggestion" && nowTask?.dailyRank === 1) {
      reasons.push({ code: "manual-rank", label: "Você marcou esta como principal", points: 0 });
    }

    const suggestions = presented
      .filter((task) => task.id !== nowTask?.id)
      .filter((task) => task.status !== "DOING")
      .filter((task) => !task.blocked)
      .filter((task) => task.project?.status !== "PARKED" && task.project?.status !== "ARCHIVED")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    res.json({
      date: start.toISOString(),
      now: nowTask ? { task: { ...nowTask, reasons }, source, reasons } : null,
      top3: today.slice(0, 3).map((task, index) => ({
        label: DAILY_RANK_LABEL[index] ?? "Tarefa",
        task,
      })),
      agenda,
      activeProjects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        color: project.color,
        icon: project.icon,
        priority: project.priority,
        progress: project.progress,
        status: project.status,
        nextStep: nextStep(project.tasks),
      })),
      doneToday: await presentTasks(doneToday),
      suggestions,
      runningFocus,
    });
  }),
);
