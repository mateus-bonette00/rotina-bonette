import { prisma } from "../src/lib/prisma.js";

function atHour(offsetDays: number, hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function projectByName(name: string) {
  return prisma.project.findFirst({ where: { name } });
}

async function ensureProject(data: {
  name: string;
  description: string;
  color: string;
  icon: string;
  status: "ACTIVE" | "MAINTENANCE" | "PARKED" | "ARCHIVED";
  priority: "P1" | "P2" | "P3" | "P4";
  category: "CLIENT" | "WORK" | "PERSONAL" | "PORTFOLIO" | "MAINTENANCE" | "LEARNING";
  deadline?: Date | null;
  progress: number;
  notes?: string;
  sortOrder: number;
}) {
  const existing = await projectByName(data.name);
  if (existing) return { project: existing, created: false };
  const project = await prisma.project.create({ data });
  return { project, created: true };
}

async function ensureTask(
  created: boolean,
  data: {
    projectId: string;
    title: string;
    status: "INBOX" | "BACKLOG" | "THIS_WEEK" | "TODAY" | "DOING" | "WAITING" | "DONE";
    priority: "P1" | "P2" | "P3" | "P4";
    dailyRank?: number | null;
    estimatedMinutes?: number;
    dueDate?: Date;
    externalCommitment?: boolean;
    nextAction?: string;
    sortOrder: number;
  },
) {
  if (!created) return null;
  return prisma.task.create({ data });
}

async function ensureRoutine(data: {
  name: string;
  projectId?: string | null;
  enabled?: boolean;
  daysOfWeek: number[];
  startTime?: string;
  durationMinutes: number;
  type: string;
  notes?: string;
}) {
  const existing = await prisma.routine.findFirst({ where: { name: data.name } });
  if (existing) return existing;
  return prisma.routine.create({
    data: {
      ...data,
      projectId: data.projectId ?? null,
      enabled: data.enabled ?? true,
    },
  });
}

const odonto = await ensureProject({
  name: "OdontoClin",
  description: "Corrigir o bug em que o horário marcado é diferente do horário informado na mensagem.",
  color: "#4c86ff",
  icon: "stethoscope",
  status: "ACTIVE",
  priority: "P1",
  category: "WORK",
  deadline: atHour(2, 18),
  progress: 20,
  notes: "Categoria tratada como trabalho ativo. A manutenção recorrente fica com Pró-Saúde.",
  sortOrder: 1,
});

const odontoTask = await ensureTask(odonto.created, {
  projectId: odonto.project.id,
  title: "Reproduzir e corrigir bug de horário no agendamento",
  status: "DOING",
  priority: "P1",
  estimatedMinutes: 60,
  dueDate: atHour(2, 18),
  externalCommitment: true,
  nextAction: "Criar agendamento de teste e comparar horário salvo, timezone e horário enviado na mensagem",
  sortOrder: 0,
});

const janaina = await ensureProject({
  name: "Landing Page Janaina",
  description: "Landing page de cliente, com compromisso externo.",
  color: "#e2b340",
  icon: "panels-top-left",
  status: "ACTIVE",
  priority: "P1",
  category: "CLIENT",
  deadline: atHour(10, 18),
  progress: 10,
  sortOrder: 2,
});

const janainaTasks = [
  ["Definir estrutura final da Landing Page", "TODAY", 1, 45],
  ["Implementar Hero", "TODAY", 2, 90],
  ["Implementar seções principais", "THIS_WEEK", null, 120],
  ["Ajustar responsividade", "THIS_WEEK", null, 60],
  ["Revisar e gerar versão apresentável", "THIS_WEEK", null, 45],
] as const;

for (const [index, [title, status, dailyRank, estimatedMinutes]] of janainaTasks.entries()) {
  await ensureTask(janaina.created, {
    projectId: janaina.project.id,
    title,
    status,
    priority: "P1",
    dailyRank,
    estimatedMinutes,
    externalCommitment: true,
    sortOrder: index + 1,
  });
}

const junta = await ensureProject({
  name: "Junta Já",
  description: "Produto de trabalho. A próxima tarefa concreta ainda precisa ser definida.",
  color: "#2ec4c6",
  icon: "handshake",
  status: "ACTIVE",
  priority: "P2",
  category: "WORK",
  progress: 15,
  sortOrder: 3,
});

await ensureTask(junta.created, {
  projectId: junta.project.id,
  title: "Definir próxima task concreta de desenvolvimento do Junta Já",
  status: "TODAY",
  priority: "P2",
  dailyRank: 3,
  estimatedMinutes: 30,
  sortOrder: 1,
});

const proSaude = await ensureProject({
  name: "Pró-Saúde",
  description: "Manutenção de presença: um post por semana é obrigatório e um segundo post é opcional.",
  color: "#2faf7a",
  icon: "heart-pulse",
  status: "MAINTENANCE",
  priority: "P3",
  category: "MAINTENANCE",
  progress: 40,
  sortOrder: 4,
});

await ensureProject({
  name: "Ponte Viva",
  description: "Projeto estratégico de portfólio de Engenharia de IA. Estacionado enquanto OdontoClin e Janaina forem prioridade.",
  color: "#9b8cff",
  icon: "compass",
  status: "PARKED",
  priority: "P2",
  category: "PORTFOLIO",
  progress: 5,
  sortOrder: 5,
});

await ensureProject({
  name: "Clineline",
  description: "SaaS pessoal desenvolvido junto com a prima. Cabe no máximo um bloco semanal de exploração, sem virar projeto ativo sozinho.",
  color: "#e08bb8",
  icon: "sparkles",
  status: "PARKED",
  priority: "P2",
  category: "PERSONAL",
  progress: 8,
  sortOrder: 6,
});

await ensureRoutine({
  name: "Post obrigatório Pró-Saúde",
  projectId: proSaude.project.id,
  daysOfWeek: [2],
  startTime: "10:00",
  durationMinutes: 40,
  type: "post",
  notes: "Um post por semana é obrigatório.",
});

await ensureRoutine({
  name: "Post opcional Pró-Saúde",
  projectId: proSaude.project.id,
  enabled: false,
  daysOfWeek: [5],
  startTime: "10:30",
  durationMinutes: 40,
  type: "post",
  notes: "Segundo post semanal, só se o obrigatório já estiver feito.",
});

await ensureRoutine({
  name: "Revisar posts salvos de IA",
  daysOfWeek: [3],
  startTime: "19:00",
  durationMinutes: 45,
  type: "review",
  notes: "Prioridade P4. Cada item termina em descartar, anotar ou converter em tarefa/ideia.",
});

await ensureRoutine({
  name: "Revisão semanal",
  daysOfWeek: [5],
  startTime: "16:00",
  durationMinutes: 30,
  type: "weekly-review",
  notes: "Olhar o que ficou em execução, o que estacionar e o que entra na próxima semana.",
});

await prisma.appSettings.upsert({
  where: { id: "app" },
  update: {},
  create: { id: "app" },
});

if (odonto.created && odontoTask) {
  await prisma.calendarBlock.create({
    data: {
      title: "Foco: bug de horário",
      projectId: odonto.project.id,
      taskId: odontoTask.id,
      type: "DEEP_FOCUS",
      startAt: atHour(0, 14),
      endAt: atHour(0, 15),
      notes: "Bloco inicial para reproduzir o bug do OdontoClin.",
    },
  });
}

console.log("Seed concluído.");
await prisma.$disconnect();
