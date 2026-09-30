import { Calendar } from "lucide-react";
import { usePreserData } from "@/contexts/PreserDataContext";
import { periodoLabel } from "@/lib/format";
import { cicloPreser } from "@/lib/preser/ciclo";

export function PreserPeriodoFilter() {
  const { extratos, selectedId, setSelectedId } = usePreserData();

  if (extratos.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <select
        value={selectedId ?? ""}
        title="Mês do PRESER (apuração). O bônus de metas refere-se ao mês anterior."
        onChange={(e) => setSelectedId(e.target.value)}
        className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {extratos.map((ex) => (
          <option key={ex.id} value={ex.id}>
            PRESER {periodoLabel(ex.periodo.slice(0, 7))} · metas {cicloPreser(ex.periodo).mesMetasCurto}
          </option>
        ))}
      </select>
    </div>
  );
}
