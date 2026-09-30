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
import { classifyFaixa } from "@/lib/calculations";
import { FAIXAS_ORDER, FaixaFaturamento } from "@/lib/types";
import { fmtBRL, fmtNum, fmtPct, fmtROI } from "@/lib/format";

const FAIXA_COLORS: Record<FaixaFaturamento, string> = {
  "Até 200 mil": "hsl(0 72% 55%)",
  "200 mil a 500 mil": "hsl(38 92% 50%)",
  "500 mil a 1 mi": "hsl(197 99% 28%)",
  "1 mi a 2 mi": "hsl(196 89% 35%)",
  "Acima de 2 mi": "hsl(152 60% 42%)",
};

// Faixas de custo sobre a venda (custo da equipe ÷ faturamento), do menos eficiente
// para o mais eficiente.
const PCT_BANDS: { label: string; color: string; test: (p: number) => boolean }[] = [
  { label: "5% ou mais", color: "hsl(0 72% 55%)", test: (p) => p >= 0.05 },
  { label: "4% a 5%", color: "hsl(25 90% 55%)", test: (p) => p >= 0.04 && p < 0.05 },
  { label: "3% a 4%", color: "hsl(38 92% 50%)", test: (p) => p >= 0.03 && p < 0.04 },
  { label: "2% a 3%", color: "hsl(48 90% 50%)", test: (p) => p >= 0.02 && p < 0.03 },
  { label: "1% a 2%", color: "hsl(196 89% 35%)", test: (p) => p >= 0.01 && p < 0.02 },
  { label: "Até 1%", color: "hsl(152 60% 42%)", test: (p) => p < 0.01 },
];

export default function Faixas() {
  const { rows: rowsAll, periodos } = useData();
  // Filtra supervisores: eles já agregam o faturamento dos vendedores deles.
  const rows = useMemo(() => rowsAll.filter((r) => !r.is_supervisor), [rowsAll]);

  // ─── Agrega por VENDEDOR (cada um conta 1x; valores em média mensal) ───────
  // Antes a página somava linhas vendedor×mês — quem aparecia em 5 meses contava
  // como 5 vendedores. Agora consolidamos por vendedor_id e usamos a média mensal
  // (faturamento total ÷ meses ativos), que é a base correta da "faixa mensal".
  const porVendedor = useMemo(() => {
    type Agg = {
      id: string;
      nome: string;
      fat: number;
      custo: number;
      meses: Set<string>;
      clientesSum: number;
      clientesN: number;
    };
    const m = new Map<string, Agg>();
    for (const r of rows) {
      let v = m.get(r.vendedor_id);
      if (!v) {
        v = { id: r.vendedor_id, nome: r.vendedor_nome, fat: 0, custo: 0, meses: new Set(), clientesSum: 0, clientesN: 0 };
        m.set(r.vendedor_id, v);
      }
      v.fat += r.faturamento;
      v.custo += r.custo;
      if (r.faturamento > 0) v.meses.add(r.periodo);
      if (r.total_clientes_carteira > 0) {
        v.clientesSum += r.total_clientes_carteira;
        v.clientesN += 1;
      }
    }
    return [...m.values()]
      .filter((v) => v.meses.size > 0)
      .map((v) => {
        const n = v.meses.size;
        const fatMensal = v.fat / n;
        const custoMensal = v.custo / n;
        return {
          id: v.id,
          nome: v.nome,
          fatMensal,
          custoMensal,
          pctCusto: v.fat > 0 ? v.custo / v.fat : 0,
          roi: v.custo > 0 ? v.fat / v.custo : 0,
          clientesMedio: v.clientesN > 0 ? v.clientesSum / v.clientesN : 0,
          faixa: classifyFaixa(fatMensal),
        };
      });
  }, [rows]);

  const stats = useMemo(() => {
    return FAIXAS_ORDER.map((faixa) => {
      const sub = porVendedor.filter((v) => v.faixa === faixa);
      const fat = sub.reduce((s, v) => s + v.fatMensal, 0);
      const cust = sub.reduce((s, v) => s + v.custoMensal, 0);
      const clientes = sub.reduce((s, v) => s + v.clientesMedio, 0);
      return {
        faixa,
        vendedores: sub.length,
        faturamento: fat,
        custo: cust,
        pct_custo: fat > 0 ? cust / fat : 0,
        roi: cust > 0 ? fat / cust : 0,
        clientes_medio: sub.length ? clientes / sub.length : 0,
        ticket_medio: clientes > 0 ? fat / clientes : 0,
      };
    });
  }, [porVendedor]);

  // ─── Distribuição por % de custo sobre a venda ────────────────────────────
  const { custoBands, semCusto } = useMemo(() => {
    const comCusto = porVendedor.filter((v) => v.custoMensal > 0);
    const bands = PCT_BANDS.map((b) => {
      const sub = comCusto.filter((v) => b.test(v.pctCusto));
      const fat = sub.reduce((s, v) => s + v.fatMensal, 0);
      const cust = sub.reduce((s, v) => s + v.custoMensal, 0);
      return {
        label: b.label,
        color: b.color,
        vendedores: sub.length,
        faturamento: fat,
        custo: cust,
        pct_custo: fat > 0 ? cust / fat : 0,
        roi: cust > 0 ? fat / cust : 0,
        lista: [...sub].sort((a, c) => c.pctCusto - a.pctCusto),
      };
    });
    return { custoBands: bands, semCusto: porVendedor.length - comCusto.length };
  }, [porVendedor]);

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Distribuição por Faixa de Faturamento" />
        <EmptyState />
      </>
    );
  }

  const nMeses = periodos.length;
  const subt =
    nMeses > 1
      ? `${fmtNum(porVendedor.length)} vendedores distintos · faixa pela média mensal (${nMeses} meses).`
      : `${fmtNum(porVendedor.length)} vendedores · faturamento do mês.`;

  return (
    <>
      <PageHeader
        title="Distribuição por Faixa de Faturamento"
        subtitle={subt}
        actions={<PeriodoFilter />}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard
          title="Vendedores por faixa"
          description="Quantos vendedores distintos em cada faixa (cada um conta 1×)."
          dataKey="vendedores"
          formatter={(v: number) => `${fmtNum(v)} vendedor(es)`}
          stats={stats}
        />
        <ChartCard
          title="Faturamento mensal por faixa"
          description="Soma da média mensal dos vendedores em cada faixa."
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
            Cada vendedor entra uma vez, pela média mensal de faturamento no período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 pr-4">Faixa</th>
                  <th className="py-2.5 pr-4 text-right">Vendedores</th>
                  <th className="py-2.5 pr-4 text-right">Faturamento médio/mês</th>
                  <th className="py-2.5 pr-4 text-right">Custo médio/mês</th>
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
                      <span className="inline-flex items-center gap-2" title={s.faixa}>
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: FAIXA_COLORS[s.faixa] }}
                        />
                        {s.faixa}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-semibold">{fmtNum(s.vendedores)}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtBRL(s.faturamento, { compact: true })}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtBRL(s.custo, { compact: true })}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtPct(s.pct_custo)}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtROI(s.roi)}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtNum(s.clientes_medio, 1)}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtBRL(s.ticket_medio, { compact: true })}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-semibold">
                  <td className="py-2.5 pr-4">Total</td>
                  <td className="py-2.5 pr-4 text-right">
                    {fmtNum(stats.reduce((s, x) => s + x.vendedores, 0))}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    {fmtBRL(stats.reduce((s, x) => s + x.faturamento, 0), { compact: true })}
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    {fmtBRL(stats.reduce((s, x) => s + x.custo, 0), { compact: true })}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ─── Nova tabela: distribuição por % de custo sobre a venda ─────────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Distribuição por % de custo sobre a venda</CardTitle>
          <CardDescription>
            Quantos vendedores em cada nível de custo (custo da equipe ÷ faturamento). Quanto menor o
            %, mais eficiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2.5 pr-4">% de custo</th>
                  <th className="py-2.5 pr-4 text-right">Vendedores</th>
                  <th className="py-2.5 pr-4 text-right">Faturamento médio/mês</th>
                  <th className="py-2.5 pr-4 text-right">Custo médio/mês</th>
                  <th className="py-2.5 pr-4 text-right">% Custo real</th>
                  <th className="py-2.5 pr-4 text-right">ROI</th>
                </tr>
              </thead>
              <tbody>
                {custoBands.map((b) => (
                  <tr key={b.label} className="border-b border-border last:border-0">
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                        {b.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-semibold">{fmtNum(b.vendedores)}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtBRL(b.faturamento, { compact: true })}</td>
                    <td className="py-2.5 pr-4 text-right">{fmtBRL(b.custo, { compact: true })}</td>
                    <td className="py-2.5 pr-4 text-right">{b.vendedores ? fmtPct(b.pct_custo) : "—"}</td>
                    <td className="py-2.5 pr-4 text-right">{b.vendedores ? fmtROI(b.roi) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {semCusto > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              {fmtNum(semCusto)} vendedor(es) sem custo de folha casado não entram nesta tabela (custo = R$ 0).
              Veja o status do cruzamento no Resumo.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Cards com os nomes dos vendedores em cada faixa de custo ───────── */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Vendedores em cada faixa de custo</CardTitle>
          <CardDescription>
            Quem está em cada nível de custo sobre a venda — nome, % de custo e faturamento médio/mês.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {custoBands
              .filter((b) => b.vendedores > 0)
              .map((b) => (
                <div key={b.label} className="rounded-xl border border-border bg-card p-3 shadow-card">
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
                      {b.label}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">
                      {fmtNum(b.vendedores)}
                    </span>
                  </div>
                  <ul className="max-h-[240px] space-y-1.5 overflow-y-auto pr-1 text-sm">
                    {b.lista.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2">
                        <span className="truncate" title={v.nome}>
                          {v.nome}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {fmtPct(v.pctCusto)} · {fmtBRL(v.fatMensal, { compact: true })}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
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
              <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} isAnimationActive={false}>
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
