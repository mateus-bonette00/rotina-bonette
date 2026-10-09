import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  AlignLeft,
  Calendar,
  CheckSquare,
  Kanban as KanbanIcon,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type TaskStatus,
} from "rotina-bonette-shared";
import { Button, Dialog, PriorityBadge } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { cx } from "../../lib/format";
import type { Project, Task } from "../../types";
import { TaskDialog, type TaskDraft } from "./TaskDialog";

type MoveVars = { id: string; status: TaskStatus; confirmReplace?: boolean };

export type KanbanColumnConfig = {
  id: string; // TaskStatus or custom id like "custom_123"
  title: string;
  status: TaskStatus;
  isCustom?: boolean;
  color?: string;
};

const DEFAULT_COLUMNS: KanbanColumnConfig[] = [
  { id: "custom_start", title: "Lista", status: "BACKLOG", isCustom: true },
];

const STORAGE_LISTS_KEY = "rotina.kanban.board_lists.v3";
const STORAGE_TASK_LISTS_KEY = "rotina.kanban.task_custom_lists.v3";

export function KanbanPage() {
  const queryClient = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [pending, setPending] = useState<MoveVars | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Custom columns state
  const [columns, setColumns] = useState<KanbanColumnConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LISTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return DEFAULT_COLUMNS;
  });

  // Task-to-custom-column mapping
  const [customTaskMap, setCustomTaskMap] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_TASK_LISTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {};
  });

  // Inline column add state
  const [isAddingList, setIsAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_LISTS_KEY, JSON.stringify(columns));
    } catch {
      // ignore
    }
  }, [columns]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_TASK_LISTS_KEY, JSON.stringify(customTaskMap));
    } catch {
      // ignore
    }
  }, [customTaskMap]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const tasks = useQuery({
    queryKey: ["tasks", projectId, priority],
    queryFn: () => {
      const params = new URLSearchParams();
      if (projectId) params.set("projectId", projectId);
      if (priority) params.set("priority", priority);
      const query = params.toString();
      return api<{ tasks: Task[] }>(`/tasks${query ? `?${query}` : ""}`);
    },
  });

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => api<{ projects: Project[] }>("/projects"),
  });

  const move = useMutation({
    mutationFn: (vars: MoveVars) => api(`/tasks/${vars.id}/move`, { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: async () => {
      setError(null);
      setPending(null);
      await queryClient.invalidateQueries();
    },
    onError: (caught, vars) => {
      if (caught instanceof ApiError && caught.code === "DOING_LIMIT_REACHED") {
        setPending(vars);
        return;
      }
      setError(caught instanceof ApiError ? caught.message : "Não movi a tarefa.");
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // Filter tasks by search query
  const filteredTasks = useMemo(() => {
    const list = tasks.data?.tasks ?? [];
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.project?.name.toLowerCase().includes(q) ||
        t.nextAction?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }, [tasks.data, searchQuery]);

  // Group tasks into the user's columns
  const columnTaskMap = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const col of columns) {
      map.set(col.id, []);
    }

    for (const task of filteredTasks) {
      const customColId = customTaskMap[task.id];
      if (customColId && map.has(customColId)) {
        map.get(customColId)!.push(task);
        continue;
      }
      const statusCol = columns.find((c) => c.status === task.status && !c.isCustom);
      if (statusCol && map.has(statusCol.id)) {
        map.get(statusCol.id)!.push(task);
      }
    }
    return map;
  }, [columns, filteredTasks, customTaskMap]);

  // Global counts for Doing/Today domain limits
  const doingCount = useMemo(
    () => tasks.data?.tasks.filter((t) => t.status === "DOING").length ?? 0,
    [tasks.data],
  );
  const todayCount = useMemo(
    () => tasks.data?.tasks.filter((t) => t.status === "TODAY").length ?? 0,
    [tasks.data],
  );

  function handleCreateCustomList() {
    if (!newListTitle.trim()) return;
    const newCol: KanbanColumnConfig = {
      id: `custom_${Date.now()}`,
      title: newListTitle.trim(),
      status: "BACKLOG", // backend persistence fallback
      isCustom: true,
      color: "#8b949e",
    };
    setColumns((prev) => [...prev, newCol]);
    setNewListTitle("");
    setIsAddingList(false);
  }

  function handleRemoveCustomList(columnId: string) {
    setColumns((prev) => prev.filter((c) => c.id !== columnId));
    setCustomTaskMap((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(next)) {
        if (v === columnId) delete next[k];
      }
      return next;
    });
  }

  function handleRenameList(columnId: string, newTitle: string) {
    if (!newTitle.trim()) return;
    setColumns((prev) =>
      prev.map((c) => (c.id === columnId ? { ...c, title: newTitle.trim() } : c)),
    );
  }

  function handleResetLists() {
    setColumns(DEFAULT_COLUMNS);
    setCustomTaskMap({});
  }

  function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : "";
    const task = tasks.data?.tasks.find((item) => item.id === taskId);
    if (!task || !overId) return;

    // Is over a column?
    let targetCol = columns.find((c) => c.id === overId);
    let overTask: Task | undefined;

    if (!targetCol) {
      // Dropped over another task
      overTask = tasks.data?.tasks.find((item) => item.id === overId);
      if (overTask) {
        // find which column contains overTask
        const targetColId = customTaskMap[overTask.id] || overTask.status;
        targetCol =
          columns.find((c) => c.id === targetColId) ||
          columns.find((c) => c.status === overTask?.status) ||
          columns[0];
      }
    }

    if (!targetCol) return;

    // If moving to a custom column, update task mapping
    if (targetCol.isCustom) {
      setCustomTaskMap((prev) => ({ ...prev, [task.id]: targetCol!.id }));
    } else {
      setCustomTaskMap((prev) => {
        const next = { ...prev };
        delete next[task.id];
        return next;
      });
    }

    const nextStatus = targetCol.status;

    // Check if reordering within the same status
    if (nextStatus === task.status && !targetCol.isCustom) {
      if (!overTask || overTask.id === task.id) return;
      const tasksInCol = columnTaskMap.get(targetCol.id) ?? [];
      const ids = tasksInCol.map((item) => item.id);
      const from = ids.indexOf(task.id);
      const to = ids.indexOf(overTask.id);
      if (from < 0 || to < 0 || from === to) return;
      const orderedIds = arrayMove(ids, from, to);
      void api("/tasks/reorder", {
        method: "POST",
        body: JSON.stringify({ status: nextStatus, orderedIds }),
      }).then(() => queryClient.invalidateQueries({ queryKey: ["tasks"] }));
      return;
    }

    move.mutate({ id: task.id, status: nextStatus });
  }

  return (
    <div className="relative min-h-[calc(100dvh-6rem)] h-auto rounded-2xl bg-[#0f1216] text-[#e6edf3] p-4 md:p-6 overflow-visible border border-line/40 shadow-2xl flex flex-col">
      {/* Ambient background light (inspired by Trello dark theme in user's print) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-44 left-1/3 h-[500px] w-[500px] rounded-full bg-orange-600/10 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-10 h-[350px] w-[350px] rounded-full bg-blue-600/5 blur-[120px]"
      />

      {/* Top Board Navigation Bar (matching print) */}
      <header className="relative z-10 mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-focus/20 text-focus border border-focus/30">
              <KanbanIcon className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Quadro
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted font-normal">
                  Rotina Bonette
                </span>
              </h1>
              <p className="text-xs text-muted/80">Fazendo {doingCount}/1 · Hoje {todayCount}/3</p>
            </div>
          </div>

        </div>

        {/* Action Controls and Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick search input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-40 sm:w-56 rounded-xl border border-white/[0.1] bg-[#161b22] pl-8 pr-3 text-xs text-white placeholder:text-muted focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus transition"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          {/* Project Filter */}
          <select
            aria-label="Filtrar por projeto"
            className="h-9 rounded-xl border border-white/[0.1] bg-[#161b22] px-3 text-xs text-white outline-none focus:border-focus cursor-pointer transition hover:bg-[#1f242c]"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            <option value="">Todos os projetos</option>
            {projects.data?.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            aria-label="Filtrar por prioridade"
            className="h-9 rounded-xl border border-white/[0.1] bg-[#161b22] px-3 text-xs text-white outline-none focus:border-focus cursor-pointer transition hover:bg-[#1f242c]"
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            <option value="">Todas prioridades</option>
            {["P1", "P2", "P3", "P4"].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          {/* Reset Columns button */}
          <button
            type="button"
            onClick={handleResetLists}
            title="Restaurar colunas padrão"
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.1] bg-[#161b22] text-muted hover:bg-[#1f242c] hover:text-white transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          {/* Create Task Button */}
          <Button
            onClick={() => setDraft({ mode: "create", status: "INBOX" })}
            className="h-9 px-3.5 bg-focus hover:bg-focus/90 text-white rounded-xl text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            Criar
          </Button>
        </div>
      </header>

      {/* Error alert if move rejected */}
      {error ? (
        <div
          data-testid="kanban-error"
          className="relative z-10 mb-4 flex items-center gap-2 rounded-xl border border-hot/30 bg-hot/10 px-4 py-2.5 text-xs font-semibold text-hot shadow-sm"
        >
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Kanban Board Horizontal Scroll Track */}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="relative z-10 w-full flex items-start gap-3.5 overflow-x-auto overflow-y-visible pb-4 pt-1 select-none">
          {columns.map((column) => {
            const colTasks = columnTaskMap.get(column.id) ?? [];
            return (
              <Column
                key={column.id}
                column={column}
                tasks={colTasks}
                onMove={(id, next) => move.mutate({ id, status: next })}
                onCreateTask={(initialTitle) => {
                  if (initialTitle) {
                    void api<{ task: Task }>("/tasks", {
                      method: "POST",
                      body: JSON.stringify({
                        title: initialTitle,
                        status: column.status,
                      }),
                    }).then((res) => {
                      if (column.isCustom && res.task?.id) {
                        setCustomTaskMap((prev) => ({ ...prev, [res.task.id]: column.id }));
                      }
                      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
                    });
                  } else {
                    setDraft({ mode: "create", status: column.status });
                  }
                }}
                onEditTask={(task) => setDraft({ mode: "edit", task })}
                onRename={(newTitle) => handleRenameList(column.id, newTitle)}
                onRemove={column.isCustom ? () => handleRemoveCustomList(column.id) : undefined}
              />
            );
          })}

          {/* "+ Adicionar outra lista" Column Button (matches Trello exactly!) */}
          <div className="w-72 shrink-0">
            {isAddingList ? (
              <div className="rounded-xl border border-white/[0.1] bg-[#161b22] p-3 shadow-xl transition">
                <input
                  type="text"
                  placeholder="Insira o título da lista..."
                  autoFocus
                  value={newListTitle}
                  onChange={(e) => setNewListTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateCustomList();
                    if (e.key === "Escape") {
                      setIsAddingList(false);
                      setNewListTitle("");
                    }
                  }}
                  className="w-full rounded-lg border border-white/20 bg-[#0d1117] px-3 py-2 text-xs text-white placeholder:text-muted outline-none focus:border-focus"
                />
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCreateCustomList}
                    className="rounded-lg bg-focus px-3 py-1.5 text-xs font-semibold text-white hover:bg-focus/90 transition cursor-pointer"
                  >
                    Adicionar lista
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingList(false);
                      setNewListTitle("");
                    }}
                    className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-white/10 hover:text-white transition cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsAddingList(true)}
                className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-xs font-semibold text-muted hover:border-white/30 hover:bg-white/[0.06] hover:text-white transition cursor-pointer shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Adicionar outra lista
              </button>
            )}
          </div>
        </div>
      </DndContext>

      {/* Bottom Switcher Dock (like in the print: Caixa de entrada | Planejador | Quadro | Mudar de quadros) */}
      <footer className="relative z-10 mt-auto pt-4 flex justify-center">
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-[#161b22]/90 backdrop-blur-md px-2 py-1.5 text-xs shadow-xl">
          <a
            href="/ideias"
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-muted hover:bg-white/10 hover:text-white transition"
          >
            <span>Caixa de entrada</span>
          </a>
          <a
            href="/"
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-muted hover:bg-white/10 hover:text-white transition"
          >
            <span>Planejador</span>
          </a>
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 font-semibold text-white shadow-sm">
            <LayoutGrid className="h-3.5 w-3.5 text-focus" />
            <span>Quadro</span>
          </span>
          <a
            href="/projetos"
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-muted hover:bg-white/10 hover:text-white transition"
          >
            <span>Projetos</span>
          </a>
        </div>
      </footer>

      {/* Confirmation modal for Doing replacement */}
      <Dialog
        open={Boolean(pending)}
        title="Trocar a tarefa em execução?"
        onClose={() => setPending(null)}
      >
        <p className="text-sm text-muted">
          Já existe uma tarefa em Fazendo. Se confirmar, ela volta para Hoje, ou para Esta Semana se Hoje estiver cheio.
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            data-testid="confirm-replace"
            onClick={() => pending && move.mutate({ ...pending, confirmReplace: true })}
          >
            Trocar
          </Button>
          <Button variant="ghost" onClick={() => setPending(null)}>
            Cancelar
          </Button>
        </div>
      </Dialog>

      {/* Task Creation & Editing Dialog */}
      <TaskDialog
        draft={draft}
        projects={projects.data?.projects ?? []}
        onClose={() => setDraft(null)}
        onSaved={async () => queryClient.invalidateQueries()}
      />
    </div>
  );
}

function Column({
  column,
  tasks,
  onMove,
  onCreateTask,
  onEditTask,
  onRename,
  onRemove,
}: {
  column: KanbanColumnConfig;
  tasks: Task[];
  onMove: (id: string, status: TaskStatus) => void;
  onCreateTask: (initialTitle?: string) => void;
  onEditTask: (task: Task) => void;
  onRename: (newTitle: string) => void;
  onRemove?: () => void;
}) {
  const drop = useDroppable({ id: column.id });
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(column.title);
  const [menuOpen, setMenuOpen] = useState(false);

  function submitNewCard() {
    if (!newCardTitle.trim()) return;
    onCreateTask(newCardTitle.trim());
    setNewCardTitle("");
    setIsAddingCard(false);
  }

  function submitRename() {
    setIsEditingTitle(false);
    if (titleInput.trim() && titleInput !== column.title) {
      onRename(titleInput.trim());
    } else {
      setTitleInput(column.title);
    }
  }

  return (
    <section
      ref={drop.setNodeRef}
      data-testid={`column-${column.status}`}
      className={cx(
        "flex h-fit w-72 shrink-0 flex-col rounded-2xl border border-white/[0.08] bg-[#101418]/90 backdrop-blur-sm p-3 shadow-lg transition-colors duration-150",
        drop.isOver && "border-focus ring-2 ring-focus/25 bg-[#141a22]",
      )}
    >
      {/* Column Header */}
      <header className="mb-2.5 flex items-center justify-between gap-1.5 px-1 py-0.5 relative">
        {isEditingTitle ? (
          <input
            type="text"
            autoFocus
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={submitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
              if (e.key === "Escape") {
                setIsEditingTitle(false);
                setTitleInput(column.title);
              }
            }}
            className="w-full rounded border border-focus bg-[#161b22] px-2 py-0.5 text-xs font-bold text-white outline-none"
          />
        ) : (
          <div
            className="flex items-center gap-2 cursor-pointer group flex-1 min-w-0"
            onClick={() => setIsEditingTitle(true)}
            title="Clique para renomear"
          >
            <h2 className="truncate text-xs font-bold uppercase tracking-wider text-[#d0d7de] group-hover:text-white transition">
              {column.title}
            </h2>
            <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted">
              {tasks.length}
              {column.status === "DOING" ? "/1" : column.status === "TODAY" ? "/3" : ""}
            </span>
          </div>
        )}

        {/* Column Actions Menu */}
        <div className="relative">
          <button
            type="button"
            aria-label={`Opções da lista ${column.title}`}
            onClick={() => setMenuOpen((v) => !v)}
            className="grid h-6 w-6 place-items-center rounded-lg text-muted hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-white/10 bg-[#161b22] p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setIsAddingCard(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-white hover:bg-white/10 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar cartão
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setIsEditingTitle(true);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-white hover:bg-white/10 transition"
              >
                <AlignLeft className="h-3.5 w-3.5" />
                Renomear lista
              </button>
              {onRemove ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemove();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-hot hover:bg-hot/10 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Excluir lista
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {/* Cards List with Smooth Scroll */}
      <div className="space-y-2 pr-1">
        {tasks.map((task) => (
          <CardTask key={task.id} task={task} onMove={onMove} onEdit={onEditTask} />
        ))}

        {/* Inline Card Creation Composer */}
        {isAddingCard ? (
          <div className="rounded-xl border border-white/10 bg-[#22272b] p-2.5 shadow-md">
            <textarea
              autoFocus
              rows={2}
              placeholder="Insira um título para este cartão..."
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitNewCard();
                }
                if (e.key === "Escape") {
                  setIsAddingCard(false);
                  setNewCardTitle("");
                }
              }}
              className="w-full resize-none rounded-lg border border-transparent bg-transparent p-1 text-xs text-white placeholder:text-muted outline-none focus:border-focus"
            />
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={submitNewCard}
                className="rounded-lg bg-focus px-3 py-1.5 text-xs font-semibold text-white hover:bg-focus/90 transition cursor-pointer"
              >
                Adicionar cartão
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingCard(false);
                  setNewCardTitle("");
                }}
                className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-white/10 hover:text-white transition cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Add Card Button (Trello Style) */}
      {!isAddingCard ? (
        <button
          type="button"
          onClick={() => setIsAddingCard(true)}
          className="mt-2.5 flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-white/[0.06] hover:text-white transition cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Adicionar um cartão
        </button>
      ) : null}
    </section>
  );
}

function CardTask({
  task,
  onMove,
  onEdit,
}: {
  task: Task;
  onMove: (id: string, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
}) {
  const drag = useDraggable({ id: task.id });

  // Compute label color bar on top of the card
  const labelColor = task.project?.color ?? (task.priority === "P1" ? "#f85149" : task.priority === "P2" ? "#d29922" : null);

  return (
    <article
      ref={drag.setNodeRef}
      style={{
        transform: drag.transform ? `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` : undefined,
      }}
      className={cx(
        "group relative rounded-xl border border-[#2c333a] bg-[#22272b] p-3 shadow-sm transition hover:border-white/20 hover:bg-[#282e33] cursor-grab active:cursor-grabbing",
        drag.isDragging && "opacity-60 ring-2 ring-focus rotate-1 shadow-2xl z-20",
      )}
      {...drag.listeners}
      {...drag.attributes}
    >
      {/* Top Color Label Strip (like Trello cards in user's print) */}
      {labelColor ? (
        <div
          className="mb-2 h-1.5 w-10 rounded-full"
          style={{ backgroundColor: labelColor }}
          title={task.project?.name ?? "Etiqueta"}
        />
      ) : null}

      {/* Card Title */}
      <button
        type="button"
        className="w-full text-left text-xs font-semibold leading-snug text-[#e6edf3] group-hover:text-white cursor-pointer line-clamp-3"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => onEdit(task)}
      >
        {task.title}
      </button>

      {/* Next Action or Project hint */}
      {task.nextAction ? (
        <p className="mt-1 text-[11px] text-muted line-clamp-1">{task.nextAction}</p>
      ) : null}

      {/* Card Bottom Meta Bar (Icons, Checklists, Avatar badge - matching print) */}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2 text-[11px] text-muted">
        <div className="flex items-center gap-2.5">
          {/* Details/description icon */}
          {task.description ? (
            <span title="Possui descrição" className="hover:text-white">
              <AlignLeft className="h-3 w-3" />
            </span>
          ) : null}

          {/* Checklist indicator */}
          <span className="inline-flex items-center gap-1 hover:text-white" title="Checklist">
            <CheckSquare className="h-3 w-3" />
            <span className="font-mono text-[10px]">{task.status === "DONE" ? "1/1" : "0/1"}</span>
          </span>

          {/* Due date if present */}
          {task.dueDate ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-warn" title="Prazo">
              <Calendar className="h-3 w-3" />
              <span>{task.dueDate.slice(5, 10)}</span>
            </span>
          ) : null}

          {/* Priority Badge */}
          <PriorityBadge priority={task.priority} />
        </div>

        <div className="flex items-center gap-1.5">
          <select
            aria-label={`Mover ${task.title}`}
            data-testid={`status-${task.id}`}
            className="opacity-0 w-3 h-3 absolute pointer-events-none"
            value={task.status}
            tabIndex={-1}
            onPointerDown={(event) => event.stopPropagation()}
            onChange={(event) => onMove(task.id, event.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABEL[status]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </article>
  );
}
