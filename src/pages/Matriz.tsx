import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, fmtROI } from "@/lib/format";
import { median } from "@/lib/calculations";
import { Quadrante, QUADRANTES_ORDER, VendedorConsolidado } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUADRANT_COLORS: Record<Quadrante, string> = {
  Estrela: "hsl(152 60% 42%)",
  "Trator caro": "hsl(38 92% 50%)",
  Potencial: "hsl(215 80% 48%)",
  "Alerta vermelho": "hsl(0 72% 55%)",
  "—": "hsl(220 10% 50%)",
};

const QUADRANT_DESCS: Record<Quadrante, string> = {
  Estrela: "Vende muito com custo controlado.",
  "Trator caro": "Vende muito, mas está caro.",
  Potencial: "Vende pouco, mas com custo enxuto — espaço pra crescer.",
  "Alerta vermelho": "Vende pouco e custa caro.",
  "—": "",
};

const quadrantBadge: Record<Quadrante, "success" | "warning" | "default" | "destructive" | "muted"> = {
  Estrela: "success",
  "Trator caro": "warning",
  Potencial: "default",
  "Alerta vermelho": "destructive",
  "—": "muted",
};

type Aba = "vendedores" | "supervisores";

export default function Matriz() {
  const { rows } = useData();
  const [aba, setAba] = useState<Aba>("vendedores");
  const [selColabs, setSelColabs] = useState<Set<string>>(new Set());
  const [selQuads, setSelQuads] = useState<Set<Quadrante>>(new Set());
  const [acumulado, setAcumulado] = useState<boolean>(true);

  // Filtra por aba (supervisor vs vendedor)
  const escopoRows = useMemo(
    () => rows.filter((r) => (aba === "supervisores" ? r.is_supervisor : !r.is_supervisor)),
    [rows, aba],
  );

  // Lista de colaboradores do escopo atual (para filtro multi-select)
  const colabsDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of escopoRows) {
      if (!map.has(r.vendedor_id)) map.set(r.vendedor_id, r.vendedor_nome);
    }
    return [...map.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [escopoRows]);

  // Aplica filtro de colaboradores (vazio = todos)
  const filteredRowsRaw = useMemo(() => {
    if (selColabs.size === 0) return escopoRows;
    return escopoRows.filter((r) => selColabs.has(r.vendedor_id));
  }, [escopoRows, selColabs]);

  // Em modo "acumulado", soma faturamento/custo/carteira de cada vendedor nos períodos selecionados.
  const filteredRows = useMemo(() => {
    if (!acumulado) return filteredRowsRaw;
    const byId = new Map<string, VendedorConsolidado>();
    for (const r of filteredRowsRaw) {
      const cur = byId.get(r.vendedor_id);
      if (!cur) {
        byId.set(r.vendedor_id, { ...r, periodo: "ACUMULADO" });
        continue;
      }
      cur.faturamento += r.faturamento;
      cur.custo += r.custo;
      cur.resultado_bruto += r.resultado_bruto;
      cur.total_clientes_carteira += r.total_clientes_carteira;
      cur.total_municipios_atendidos = Math.max(
        cur.total_municipios_atendidos,
        r.total_municipios_atendidos,
      );
    }
    for (const r of byId.values()) {
      r.percentual_custo = r.faturamento > 0 ? r.custo / r.faturamento : 0;
      r.roi_comercial = r.custo > 0 ? r.faturamento / r.custo : 0;
      r.ticket_medio = r.total_clientes_carteira > 0 ? r.faturamento / r.total_clientes_carteira : 0;
    }
    return [...byId.values()];
  }, [filteredRowsRaw, acumulado]);

  // Medianas recalculadas sobre o escopo filtrado (para cortes da matriz)
  const medianFat = useMemo(
    () => median(filteredRows.map((r) => r.faturamento)),
    [filteredRows],
  );
  const medianPct = useMemo(
    () => median(filteredRows.map((r) => r.percentual_custo).filter((v) => v > 0)),
    [filteredRows],
  );

  // Reclassifica o quadrante em função das medianas do escopo filtrado
  const rowsClassificados = useMemo(() => {
    return filteredRows.map((r) => {
      const fatHigh = r.faturamento >= medianFat;
      const pctLow = r.percentual_custo <= medianPct;
      let q: Quadrante = "—";
      if (fatHigh && pctLow) q = "Estrela";
      else if (fatHigh && !pctLow) q = "Trator caro";
      else if (!fatHigh && pctLow) q = "Potencial";
      else q = "Alerta vermelho";
      return { ...r, quadrante_performance: q };
    });
  }, [filteredRows, medianFat, medianPct]);

  // Filtra por quadrantes (vazio = todos)
  const rowsComFiltroQuad = useMemo(() => {
    if (selQuads.size === 0) return rowsClassificados;
    return rowsClassificados.filter((r) => selQuads.has(r.quadrante_performance));
  }, [rowsClassificados, selQuads]);

  const grouped = useMemo(() => {
    const map: Record<Quadrante, VendedorConsolidado[]> = {
      Estrela: [],
      "Trator caro": [],
      Potencial: [],
      "Alerta vermelho": [],
      "—": [],
    };
    for (const r of rowsComFiltroQuad) map[r.quadrante_performance].push(r);
    return map;
  }, [rowsComFiltroQuad]);

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Matriz de Performance" />
        <EmptyState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Matriz de Performance"
        subtitle="Cada ponto é um colaborador. As linhas tracejadas são as medianas do escopo selecionado."
        actions={<PeriodoFilter />}
      />

      {/* Toggle: Acumulado vs Por mês */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {([
            { key: true, label: "Acumulado" },
            { key: false, label: "Por mês" },
          ] as const).map((o) => (
            <button
              key={String(o.key)}
              type="button"
              onClick={() => setAcumulado(o.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                acumulado === o.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">
          {acumulado
            ? "Soma dos meses selecionados — 1 ponto por colaborador."
            : "1 ponto por colaborador por mês."}
        </span>
      </div>

      {/* Abas Vendedores / Supervisores */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">
        {(["vendedores", "supervisores"] as Aba[]).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => {
              setAba(a);
              setSelColabs(new Set());
            }}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              aba === a
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {a === "vendedores" ? "Vendedores" : "Supervisores"}
            <span className="ml-1.5 text-[11px] opacity-70">
              (
              {a === "vendedores"
                ? rows.filter((r) => !r.is_supervisor).length
                : rows.filter((r) => r.is_supervisor).length}
              )
            </span>
          </button>
        ))}
      </div>

      {/* Filtro multi-select de colaboradores */}
      <ColaboradorFilter
        colabs={colabsDisponiveis}
        selecionados={selColabs}
        onToggle={(id) => {
          const s = new Set(selColabs);
          if (s.has(id)) s.delete(id);
          else s.add(id);
          setSelColabs(s);
        }}
        onClear={() => setSelColabs(new Set())}
      />

      {/* Filtro multi-select de quadrantes */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Quadrante
        </span>
        <button
          type="button"
          onClick={() => setSelQuads(new Set())}
          className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
            selQuads.size === 0
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/70",
          )}
        >
          Todos
        </button>
        {QUADRANTES_ORDER.map((q) => {
          const active = selQuads.has(q);
          return (
            <button
              key={q}
              type="button"
              onClick={() => {
                const s = new Set(selQuads);
                if (s.has(q)) s.delete(q);
                else s.add(q);
                setSelQuads(s);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/70",
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: QUADRANT_COLORS[q] }}
              />
              {q}
              <span className="opacity-70">({rowsClassificados.filter((r) => r.quadrante_performance === q).length})</span>
            </button>
          );
        })}
      </div>

      {rowsComFiltroQuad.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum {aba === "supervisores" ? "supervisor" : "vendedor"} no escopo selecionado.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Faturamento × % de custo</CardTitle>
              <CardDescription>
                Cortes pela mediana do escopo — Faturamento: {fmtBRL(medianFat, { compact: true })} • %
                Custo: {fmtPct(medianPct)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[440px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 16, right: 24, bottom: 32, left: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="faturamento"
                      name="Faturamento"
                      tickFormatter={(v) => fmtBRL(v, { compact: true })}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      label={{
                        value: "Faturamento realizado",
                        position: "insideBottom",
                        offset: -10,
                        style: { fontSize: 12, fill: "hsl(var(--muted-foreground))" },
                      }}
                    />
                    <YAxis
                      type="number"
                      dataKey="percentual_custo"
                      name="% Custo"
                      tickFormatter={(v) => fmtPct(v, 0)}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      label={{
                        value: "% de custo",
                        angle: -90,
                        position: "insideLeft",
                        style: { fontSize: 12, fill: "hsl(var(--muted-foreground))" },
                      }}
                    />
                    <ZAxis range={[120, 120]} />
                    <ReferenceLine
                      x={medianFat}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      label={{
                        value: "Mediana fat.",
                        position: "top",
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <ReferenceLine
                      y={medianPct}
                      stroke="hsl(var(--muted-foreground))"
                      strokeDasharray="4 4"
                      label={{
                        value: "Mediana % custo",
                        position: "right",
                        fontSize: 10,
                        fill: "hsl(var(--muted-foreground))",
                      }}
                    />
                    <Tooltip content={<MatrizTooltip />} />
                    {QUADRANTES_ORDER.map((q) => (
                      <Scatter
                        key={q}
                        name={q}
                        data={grouped[q]}
                        fill={QUADRANT_COLORS[q]}
                        shape="circle"
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {QUADRANTES_ORDER.map((q) => (
                  <div key={q} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: QUADRANT_COLORS[q] }}
                    />
                    <span className="font-medium">{q}</span>
                    <span className="text-muted-foreground">({grouped[q].length})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {QUADRANTES_ORDER.map((q) => (
              <Card key={q}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Badge variant={quadrantBadge[q]}>{q}</Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">{QUADRANT_DESCS[q]}</CardDescription>
                    </div>
                    <span className="text-2xl font-bold">{grouped[q].length}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  {grouped[q].length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum colaborador neste quadrante.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border text-sm">
                      {grouped[q]
                        .slice()
                        .sort((a, b) => b.faturamento - a.faturamento)
                        .map((r) => (
                          <li
                            key={`${r.periodo}|${r.vendedor_id}`}
                            className="flex items-center justify-between py-2"
                          >
                            <div className="min-w-0">
                              <div className="font-medium truncate">{r.vendedor_nome}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {r.supervisor || "—"} • {r.cidade_principal || "—"}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-medium">
                                {fmtBRL(r.faturamento, { compact: true })}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {fmtPct(r.percentual_custo)} • {fmtROI(r.roi_comercial)}
                              </div>
                            </div>
                          </li>
                        ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function ColaboradorFilter({
  colabs,
  selecionados,
  onToggle,
  onClear,
}: {
  colabs: { id: string; nome: string }[];
  selecionados: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (colabs.length === 0) return null;
  const total = selecionados.size;
  return (
    <div className="mb-4 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Colaboradores
          </span>
          <Badge variant={total > 0 ? "default" : "outline"}>
            {total === 0 ? "Todos" : `${total} selecionado(s)`}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {open ? "ocultar" : "filtrar"}
          </span>
        </button>
        {total > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-3 w-3" /> limpar
          </Button>
        )}
      </div>
      {open && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {colabs.map((c) => {
            const active = selecionados.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggle(c.id)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/70",
                )}
              >
                {c.nome}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MatrizTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as VendedorConsolidado;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-elevated">
      <div className="font-semibold text-sm mb-1">{r.vendedor_nome}</div>
      <div className="text-muted-foreground mb-2">
        {r.supervisor || "—"} • {r.cidade_principal || "—"} • {r.periodo}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Faturamento:</span>
        <span className="font-medium text-right">{fmtBRL(r.faturamento)}</span>
        <span className="text-muted-foreground">Custo:</span>
        <span className="font-medium text-right">{fmtBRL(r.custo)}</span>
        <span className="text-muted-foreground">% Custo:</span>
        <span className="font-medium text-right">{fmtPct(r.percentual_custo)}</span>
        <span className="text-muted-foreground">ROI:</span>
        <span className="font-medium text-right">{fmtROI(r.roi_comercial)}</span>
        <span className="text-muted-foreground">Carteira:</span>
        <span className="font-medium text-right">{fmtNum(r.total_clientes_carteira)}</span>
        <span className="text-muted-foreground">Ticket médio:</span>
        <span className="font-medium text-right">{fmtBRL(r.ticket_medio, { compact: true })}</span>
      </div>
      <Badge variant={quadrantBadge[r.quadrante_performance]} className="mt-2 text-[10px]">
        {r.quadrante_performance}
      </Badge>
    </div>
  );
}
