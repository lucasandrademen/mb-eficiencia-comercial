import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/PageHeader";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";
import { FAIXAS_ORDER, FaixaFaturamento } from "@/lib/types";
import { fmtBRL, fmtNum, fmtPct, fmtROI } from "@/lib/format";

const FAIXA_COLORS: Record<FaixaFaturamento, string> = {
  "Até 200 mil": "hsl(0 72% 55%)",
  "200 mil a 500 mil": "hsl(38 92% 50%)",
  "500 mil a 1 mi": "hsl(215 80% 48%)",
  "1 mi a 2 mi": "hsl(200 70% 45%)",
  "Acima de 2 mi": "hsl(152 60% 42%)",
};

export default function Faixas() {
  const { rows: rowsAll } = useData();
  // Filtra supervisores: eles já agregam o faturamento dos vendedores
  const rows = useMemo(() => rowsAll.filter((r) => !r.is_supervisor), [rowsAll]);

  const stats = useMemo(() => {
    return FAIXAS_ORDER.map((faixa) => {
      const sub = rows.filter((r) => r.faixa_faturamento === faixa);
      const fat = sub.reduce((s, r) => s + r.faturamento, 0);
      const cust = sub.reduce((s, r) => s + r.custo, 0);
      const totalClientes = sub.reduce((s, r) => s + r.total_clientes_carteira, 0);
      return {
        faixa,
        vendedores: sub.length,
        faturamento: fat,
        custo: cust,
        pct_custo: fat > 0 ? cust / fat : 0,
        roi: cust > 0 ? fat / cust : 0,
        clientes_medio: sub.length ? totalClientes / sub.length : 0,
        ticket_medio: totalClientes > 0 ? fat / totalClientes : 0,
      };
    });
  }, [rows]);

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Distribuição por Faixa de Faturamento" />
        <EmptyState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Distribuição por Faixa de Faturamento"
        subtitle="Como o time se distribui entre cinco faixas de faturamento mensal."
        actions={<PeriodoFilter />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Vendedores por faixa"
          description="Quantos vendedores em cada faixa."
          dataKey="vendedores"
          formatter={(v: number) => `${fmtNum(v)} vendedor(es)`}
          stats={stats}
        />
        <ChartCard
          title="Faturamento total por faixa"
          description="Soma do faturamento dos vendedores em cada faixa."
          dataKey="faturamento"
          formatter={(v: number) => fmtBRL(v)}
          stats={stats}
          yFormatter={(v: number) => fmtBRL(v, { compact: true })}
        />
        <ChartCard
          title="% de custo médio por faixa"
          description="Percentual do faturamento que vira custo (ponderado)."
          dataKey="pct_custo"
          formatter={(v: number) => fmtPct(v)}
          stats={stats}
          yFormatter={(v: number) => fmtPct(v, 0)}
        />
        <ChartCard
          title="ROI médio por faixa"
          description="Faturamento ÷ custo dos vendedores em cada faixa."
          dataKey="roi"
          formatter={(v: number) => fmtROI(v)}
          stats={stats}
          yFormatter={(v: number) => `${v.toFixed(1)}x`}
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Detalhe por faixa</CardTitle>
          <CardDescription>
            Clientes médios na carteira e venda média por cliente em cada faixa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 pr-4">Faixa</th>
                  <th className="py-2.5 pr-4 text-right">Vendedores</th>
                  <th className="py-2.5 pr-4 text-right">Faturamento</th>
                  <th className="py-2.5 pr-4 text-right">Custo</th>
                  <th className="py-2.5 pr-4 text-right">% Custo</th>
                  <th className="py-2.5 pr-4 text-right">ROI</th>
                  <th className="py-2.5 pr-4 text-right">Clientes médios</th>
                  <th className="py-2.5 pr-4 text-right">Ticket médio</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.faixa} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-4">
                      <span
                        className="inline-flex items-center gap-2"
                        title={s.faixa}
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: FAIXA_COLORS[s.faixa] }}
                        />
                        {s.faixa}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">{fmtNum(s.vendedores)}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtBRL(s.faturamento, { compact: true })}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtBRL(s.custo, { compact: true })}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtPct(s.pct_custo)}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtROI(s.roi)}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtNum(s.clientes_medio, 1)}</td>
                    <td className="py-2.5 pr-4 text-right">
                      {fmtBRL(s.ticket_medio, { compact: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function ChartCard({
  title,
  description,
  dataKey,
  formatter,
  yFormatter,
  stats,
}: {
  title: string;
  description: string;
  dataKey: string;
  formatter: (v: number) => string;
  yFormatter?: (v: number) => string;
  stats: any[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats} margin={{ top: 8, right: 12, left: 0, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="faixa"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={48}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={yFormatter}
              />
              <Tooltip
                formatter={(v: any) => [formatter(Number(v)), title]}
                contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }}
              />
              <Legend wrapperStyle={{ display: "none" }} />
              <Bar dataKey={dataKey} radius={[6, 6, 0, 0]}>
                {stats.map((s) => (
                  <Cell key={s.faixa} fill={FAIXA_COLORS[s.faixa as FaixaFaturamento]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
