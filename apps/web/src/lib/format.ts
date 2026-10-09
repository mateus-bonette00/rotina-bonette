import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function longDate(date = new Date()) {
  return format(date, "EEEE, d 'de' MMMM", { locale: ptBR });
}

export function clock(value: string) {
  return format(new Date(value), "HH:mm");
}

export function minutesLabel(value: number | null | undefined) {
  if (!value) return "sem estimativa";
  return `${value} min`;
}
