import { useEffect, useMemo, useState } from "react";
import { usePreserData } from "@/contexts/PreserDataContext";
import { listExtratosCompletos } from "@/lib/preser/api";
import type { PreserExtratoCompleto } from "@/lib/preser/types";
import { fmtPct, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

// Padrão MB (variante App)
export const C_ATUAL = "#016690";
export const C_COMP = "#5FB0CE";
export const C_BOM = "#1F9D6B";
export const C_RISCO = "#D64545";
export const C_ATENCAO = "#D4A300";
export const C_GRADE = "#DCE6F2";
export const C_TINTA = "#5B7299";

/** Todos os extratos completos (mais antigo → mais recente), recarregando quando a lista muda. */
export function useExtratosCompletos() {
  const { extratos, selectedId } = usePreserData();
  const [todos, setTodos] = useState<PreserExtratoCompleto[] | null>(null);
  useEffect(() => {
    listExtratosCompletos().then(setTodos).catch(() => setTodos([]));
  }, [extratos]);
  const periodoSelecionado = extratos.find((e) => e.id === selectedId)?.periodo.slice(0, 7) ?? null;
  return { todos, periodoSelecionado };
}

export type Comparacao = "anterior" | "ano" | "nenhum";

/** Mês escolhido + mês de comparação (mês anterior importado ou mesmo mês do ano anterior). */
export function usePeriodos(todos: PreserExtratoCompleto[] | null, inicial: string | null, filtro?: (e: PreserExtratoCompleto) => boolean) {
  const periodos = useMemo(
    () => (todos ?? []).filter((e) => !filtro || filtro(e)).map((e) => e.extrato.periodo.slice(0, 7)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todos],
  );
  const [mes, setMes] = useState<string | null>(null);
  const [comparacao, setComparacao] = useState<Comparacao>("anterior");
  const atual = mes && periodos.includes(mes) ? mes : inicial && periodos.includes(inicial) ? inicial : periodos[periodos.length - 1] ?? null;
  const idx = atual ? periodos.indexOf(atual) : -1;
  const anoPassado = atual ? `${parseInt(atual.slice(0, 4), 10) - 1}${atual.slice(4)}` : null;
  const comp =
    comparacao === "anterior" ? periodos[idx - 1] ?? null : comparacao === "ano" && anoPassado && periodos.includes(anoPassado) ? anoPassado : null;
  const porPeriodo = (p: string | null) => (p ? (todos ?? []).find((e) => e.extrato.periodo.startsWith(p)) ?? null : null);
  return { periodos, atual, setMes, comparacao, setComparacao, comp, exAtual: porPeriodo(atual), exComp: porPeriodo(comp), anoPassado };
}

export function BarraPeriodo({
  periodos,
  atual,
  setMes,
  comparacao,
  setComparacao,
  comp,
  anoPassado,
  children,
}: {
  periodos: string[];
  atual: string | null;
  setMes: (p: string) => void;
  comparacao: Comparacao;
  setComparacao: (c: Comparacao) => void;
  comp: string | null;
  anoPassado: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mês do PRESER</span>
        <select
          value={atual ?? ""}
          onChange={(e) => setMes(e.target.value)}
          className="min-w-[170px] rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm font-medium"
        >
          {[...periodos].reverse().map((p) => (
            <option key={p} value={p}>
              {periodoLabel(p)}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comparar com</span>
        <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs font-medium">
          {(
            [
              ["anterior", "Mês anterior"],
              ["ano", anoPassado ? `${periodoLabel(anoPassado)}` : "Ano anterior"],
              ["nenhum", "Sem comparação"],
            ] as const
          ).map(([k, t]) => (
            <button
              key={k}
              onClick={() => setComparacao(k)}
              className={cn(
                "rounded-md px-2.5 py-1 transition-colors",
                comparacao === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      {comparacao !== "nenhum" && (
        <span className="pb-1.5 text-xs text-muted-foreground">
          {comp ? <>comparando com <b className="text-foreground">{periodoLabel(comp)}</b></> : "mês de comparação não importado"}
        </span>
      )}
      {children && <div className="ml-auto flex flex-wrap items-end gap-2">{children}</div>}
    </div>
  );
}

export function Chip({ ativo, onClick, children, cor }: { ativo: boolean; onClick: () => void; children: React.ReactNode; cor?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {cor && <span className="inline-block h-2 w-2 rounded-full" style={{ background: cor }} />}
      {children}
    </button>
  );
}

export function Pill({ v, pontos }: { v: number | null | undefined; pontos?: boolean }) {
  if (v == null || !isFinite(v)) return <span className="text-muted-foreground">—</span>;
  const txt = pontos ? `${v >= 0 ? "+" : ""}${(v * 100).toFixed(2).replace(".", ",")} p.p.` : `${v >= 0 ? "+" : ""}${fmtPct(v)}`;
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        v >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
      )}
    >
      {txt}
    </span>
  );
}

/** Mini gráfico de linha (tendência), sem eixos. */
export function Sparkline({ valores, largura = 84, altura = 22 }: { valores: (number | null)[]; largura?: number; altura?: number }) {
  const v = valores.map((x) => x ?? 0);
  if (v.length < 2) return null;
  const max = Math.max(...v);
  const min = Math.min(...v, 0);
  const esc = (x: number) => (max === min ? altura / 2 : altura - 2 - ((x - min) / (max - min)) * (altura - 4));
  const pts = v.map((x, i) => `${(i / (v.length - 1)) * (largura - 2) + 1},${esc(x)}`).join(" ");
  const ultimo = v[v.length - 1];
  const penultimo = v[v.length - 2];
  return (
    <svg width={largura} height={altura} className="inline-block align-middle">
      <polyline points={pts} fill="none" stroke={C_COMP} strokeWidth={1.5} />
      <circle
        cx={largura - 1}
        cy={esc(ultimo)}
        r={2.5}
        fill={ultimo >= penultimo ? C_BOM : C_RISCO}
      />
    </svg>
  );
}

export const variacao = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null || !a ? null : (b - a) / Math.abs(a);

export function Kpi({
  rotulo,
  valor,
  sub,
  delta,
  pontos,
}: {
  rotulo: string;
  valor: string;
  sub?: React.ReactNode;
  delta?: number | null;
  pontos?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{valor}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {delta !== undefined && <Pill v={delta} pontos={pontos} />}
        {sub}
      </div>
    </div>
  );
}
