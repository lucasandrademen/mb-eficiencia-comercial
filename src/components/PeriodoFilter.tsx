import { useData } from "@/contexts/DataContext";
import { periodoLabel } from "@/lib/format";
import { Select } from "@/components/ui/select";

export function PeriodoFilter() {
  const { periodos, periodoSelecionado, setPeriodoSelecionado } = useData();
  if (periodos.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Período</span>
      <Select
        value={periodoSelecionado}
        onChange={(e) => setPeriodoSelecionado(e.target.value as any)}
        className="w-[180px]"
      >
        <option value="ALL">Todos os períodos</option>
        {periodos.map((p) => (
          <option key={p} value={p}>
            {periodoLabel(p)}
          </option>
        ))}
      </Select>
    </div>
  );
}
