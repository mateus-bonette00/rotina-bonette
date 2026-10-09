import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Download,
  Lock,
  LogOut,
  Palette,
  Settings as SettingsIcon,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { changePinSchema, settingsPatchSchema } from "rotina-bonette-shared";
import type { z } from "zod";
import { Button, Card, Field, controlClass } from "../../components/ui";
import { ApiError, api, setCsrf } from "../../lib/api";
import type { Settings } from "../../types";

type SettingsForm = z.infer<typeof settingsPatchSchema>;
type PinForm = z.infer<typeof changePinSchema>;

export function SettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<string | null>(null);
  const [wipe, setWipe] = useState("");
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => api<{ settings: Settings }>("/settings") });
  const form = useForm<SettingsForm>({ resolver: zodResolver(settingsPatchSchema) });
  const pinForm = useForm<PinForm>({ resolver: zodResolver(changePinSchema) });

  useEffect(() => {
    if (settings.data) form.reset(settings.data.settings);
  }, [settings.data, form]);

  return (
    <div className="grid max-w-3xl gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-focus/15 text-focus">
            <SettingsIcon className="h-4 w-4" />
          </span>
          <h1 className="page-title">Ajustes & Preferências</h1>
        </div>
        <p className="mt-1 text-xs text-muted">
          Gerencie o tema, comportamento do sistema, segurança do PIN e backups dos seus dados.
        </p>
      </div>

      {message ? (
        <div className="rounded-xl border border-focus/30 bg-focus/10 px-4 py-2.5 text-xs font-semibold text-focus">
          {message}
        </div>
      ) : null}

      {/* General Settings */}
      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
          <Palette className="h-4 w-4 text-focus" />
          Aparência & Rotina
        </h2>
        <form
          className="grid gap-3.5 sm:grid-cols-2"
          onSubmit={form.handleSubmit(async (values) => {
            await api("/settings", { method: "PATCH", body: JSON.stringify(values) });
            setMessage("Preferências salvas com sucesso.");
            await queryClient.invalidateQueries({ queryKey: ["settings"] });
          })}
        >
          <Field label="Tema Visual">
            <select className={controlClass} {...form.register("theme")}>
              <option value="dark">Escuro (Trello / Minimalista)</option>
              <option value="light">Claro</option>
              <option value="system">Seguir Sistema</option>
            </select>
          </Field>

          <Field label="Foco Padrão (Minutos)">
            <input
              type="number"
              className={controlClass}
              {...form.register("defaultFocusMinutes", { valueAsNumber: true })}
            />
          </Field>

          <Field label="Primeiro Dia da Semana">
            <select className={controlClass} {...form.register("weekStartsOn", { valueAsNumber: true })}>
              <option value={1}>Segunda-feira</option>
              <option value={0}>Domingo</option>
            </select>
          </Field>

          <Field label="Expiração de Sessão (Horas)">
            <input
              type="number"
              className={controlClass}
              {...form.register("sessionIdleHours", { valueAsNumber: true })}
            />
          </Field>

          <Field label="Histórico de Concluídos no Kanban (Dias)">
            <input
              type="number"
              className={controlClass}
              {...form.register("showCompletedDays", { valueAsNumber: true })}
            />
          </Field>

          <div className="sm:col-span-2 pt-2">
            <Button type="submit">Salvar Preferências</Button>
          </div>
        </form>
      </Card>

      {/* Security: Change PIN */}
      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-focus" />
          Segurança: Alterar PIN de Acesso
        </h2>
        <form
          className="grid gap-3.5 sm:grid-cols-2"
          onSubmit={pinForm.handleSubmit(async (values) => {
            try {
              const result = await api<{ csrfToken: string }>("/auth/change-pin", {
                method: "POST",
                body: JSON.stringify(values),
              });
              setCsrf(result.csrfToken);
              pinForm.reset();
              setMessage("PIN alterado com sucesso.");
            } catch (error) {
              setMessage(error instanceof ApiError ? error.message : "Não foi possível alterar o PIN.");
            }
          })}
        >
          <Field label="PIN Atual (4 dígitos)">
            <input
              inputMode="numeric"
              maxLength={4}
              type="password"
              className={controlClass}
              placeholder="••••"
              {...pinForm.register("currentPin")}
            />
          </Field>

          <Field label="Novo PIN (4 dígitos)">
            <input
              inputMode="numeric"
              maxLength={4}
              type="password"
              className={controlClass}
              placeholder="••••"
              {...pinForm.register("newPin")}
            />
          </Field>

          <div className="sm:col-span-2 pt-2">
            <Button type="submit">Atualizar PIN</Button>
          </div>
        </form>
      </Card>

      {/* Backup & Portability */}
      <Card>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
          <Download className="h-4 w-4 text-focus" />
          Backup & Portabilidade
        </h2>
        <p className="text-xs text-muted mb-4">
          Exporte todos os seus dados em JSON para guardar cópias locais de segurança ou importar em outro ambiente.
        </p>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="ghost"
            onClick={async () => {
              const payload = await api<unknown>("/settings/export", { method: "POST", body: "{}" });
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "rotina-bonette-backup.json";
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-4 w-4" />
            Exportar JSON
          </Button>

          <label className="inline-flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-3.5 py-2 text-xs font-semibold text-ink hover:bg-panel-2/80 transition cursor-pointer">
            <Upload className="h-4 w-4" />
            Importar JSON
            <input
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                await api("/settings/import", { method: "POST", body: text });
                setMessage("Backup importado com sucesso. Cópia anterior salva em data/backups.");
                await queryClient.invalidateQueries();
              }}
            />
          </label>

          <Button
            variant="ghost"
            onClick={async () => {
              await api("/auth/logout-all", { method: "POST", body: "{}" });
              setCsrf(null);
              queryClient.clear();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Sair de Todas as Sessões
          </Button>
        </div>
      </Card>

      {/* Danger Zone: Wipe Data */}
      <Card className="border-hot/30 bg-hot/5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-hot mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-hot" />
          Zona de Perigo: Apagar Dados
        </h2>
        <p className="text-xs text-muted">
          Para restaurar a rotina do zero, digite <strong className="text-ink font-mono font-bold">APAGAR TUDO</strong> abaixo. Isso apagará projetos, tarefas, ideias, rotinas e blocos. O PIN permanecerá inalterado.
        </p>

        <input
          className={`${controlClass} mt-3.5 max-w-sm border-hot/30 focus:border-hot`}
          placeholder="Digite APAGAR TUDO..."
          value={wipe}
          onChange={(event) => setWipe(event.target.value)}
        />

        <div className="mt-3.5">
          <Button
            variant="danger"
            disabled={wipe !== "APAGAR TUDO"}
            onClick={async () => {
              await api("/settings/wipe", { method: "POST", body: JSON.stringify({ confirmation: "APAGAR TUDO" }) });
              setWipe("");
              setMessage("Dados apagados. O backup anterior foi salvo em data/backups.");
              await queryClient.invalidateQueries();
            }}
          >
            Confirmar e Apagar Dados
          </Button>
        </div>
      </Card>
    </div>
  );
}
