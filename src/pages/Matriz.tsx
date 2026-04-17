import { useMemo } from "react";
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
import { PageHeader } from "@/components/PageHeader";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, fmtROI } from "@/lib/format";
import { Quadrante, QUADRANTES_ORDER, VendedorConsolidado } from "@/lib/types";

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

export default function Matriz() {
  const { rows, metrics } = useData();

  const grouped = useMemo(() => {
    const map: Record<Quadrante, VendedorConsolidado[]> = {
      Estrela: [],
      "Trator caro": [],
      Potencial: [],
      "Alerta vermelho": [],
      "—": [],
    };
    for (const r of rows) map[r.quadrante_performance].push(r);
    return map;
  }, [rows]);

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
        subtitle="Cada ponto é um vendedor. As linhas tracejadas são as medianas do time no período."
        actions={<PeriodoFilter />}
      />

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Faturamento × % de custo</CardTitle>
          <CardDescription>
            Cortes pela mediana — Faturamento: {fmtBRL(metrics.mediana_faturamento, { compact: true })} •{" "}
            % Custo: {fmtPct(metrics.mediana_percentual_custo)}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[440px]">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 16, right: 24, bottom: 32, left: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  dataKey="faturamento_realizado"
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
                  x={metrics.mediana_faturamento}
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
                  y={metrics.mediana_percentual_custo}
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
                <p className="text-sm text-muted-foreground">Nenhum vendedor neste quadrante.</p>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {grouped[q]
                    .sort((a, b) => b.faturamento_realizado - a.faturamento_realizado)
                    .slice(0, 8)
                    .map((r) => (
                      <li
                        key={`${r.periodo}|${r.vendedor_id}`}
                        className="flex items-center justify-between py-2"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.vendedor_nome}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {r.supervisor || "—"} • {r.regiao || "—"}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-medium">
                            {fmtBRL(r.faturamento_realizado, { compact: true })}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {fmtPct(r.percentual_custo)} • {fmtROI(r.roi_comercial)}
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              )}
              {grouped[q].length > 8 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  +{grouped[q].length - 8} outros — veja na aba Ranking.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function MatrizTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload as VendedorConsolidado;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-elevated">
      <div className="font-semibold text-sm mb-1">{r.vendedor_nome}</div>
      <div className="text-muted-foreground mb-2">
        {r.supervisor || "—"} • {r.regiao || "—"} • {r.periodo}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Faturamento:</span>
        <span className="font-medium text-right">{fmtBRL(r.faturamento_realizado)}</span>
        <span className="text-muted-foreground">Custo:</span>
        <span className="font-medium text-right">{fmtBRL(r.custo_total)}</span>
        <span className="text-muted-foreground">% Custo:</span>
        <span className="font-medium text-right">{fmtPct(r.percentual_custo)}</span>
        <span className="text-muted-foreground">ROI:</span>
        <span className="font-medium text-right">{fmtROI(r.roi_comercial)}</span>
        <span className="text-muted-foreground">Carteira:</span>
        <span className="font-medium text-right">{fmtNum(r.total_clientes_carteira)}</span>
        <span className="text-muted-foreground">Pos. 3M:</span>
        <span className="font-medium text-right">{fmtNum(r.clientes_positivados_3m)}</span>
      </div>
      <Badge
        variant={quadrantBadge[r.quadrante_performance]}
        className="mt-2 text-[10px]"
      >
        {r.quadrante_performance}
      </Badge>
    </div>
  );
}
