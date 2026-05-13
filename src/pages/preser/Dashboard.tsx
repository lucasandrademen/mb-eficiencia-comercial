import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DollarSign,
  Percent,
  TrendingUp,
  Receipt,
  TrendingDown,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PreserPeriodoFilter } from "@/components/PreserPeriodoFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fmtBRL, fmtPct, periodoLabel } from "@/lib/format";
import { usePreserData } from "@/contexts/PreserDataContext";
import { PreserEmptyState } from "./PreserEmptyState";
import { cn } from "@/lib/utils";

// ─── Cores semânticas ───────────────────────────────────────────────────────
const C_OK = "hsl(152 60% 42%)";
const C_WARN = "hsl(38 92% 50%)";
const C_BAD = "hsl(0 72% 55%)";
const C_PRIMARY = "hsl(215 80% 48%)";
const C_MUTED = "hsl(220 10% 50%)";

const CRITERIO_COLORS = [
  "hsl(215 80% 48%)",
  "hsl(152 60% 42%)",
  "hsl(38 92% 50%)",
  "hsl(271 60% 56%)",
  "hsl(0 72% 55%)",
  "hsl(185 60% 42%)",
];

export default function PreserDashboard() {
  const { loading, atual, extratos: historico, serie } = usePreserData();

  const variacao = useMemo(() => {
    if (serie.length < 2) return null;
    const last = serie[serie.length - 1];
    const prev = serie[serie.length - 2];
    if (!prev.comissao) return null;
    return (last.comissao - prev.comissao) / prev.comissao;
  }, [serie]);

  const composicao = useMemo(() => {
    if (!atual) return [];
    const skuTotal = atual.skus.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const dropsTotal = atual.drops.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const metasTotal = atual.metas.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const armazTotal = atual.outros
      .filter((o) => o.criterio_codigo === 22 || o.criterio_codigo === 23)
      .reduce((s, r) => s + (r.comissao ?? 0), 0);
    const garantiaTotal = atual.outros
      .filter((o) => o.tipo_servico === "Garantia de Crédito")
      .reduce((s, r) => s + (r.comissao ?? 0), 0);
    const outrosTotal = atual.outros
      .filter(
        (o) =>
          o.criterio_codigo !== 22 &&
          o.criterio_codigo !== 23 &&
          o.tipo_servico !== "Garantia de Crédito",
      )
      .reduce((s, r) => s + (r.comissao ?? 0), 0);

    return [
      { name: "Comercial (SKUs)", value: skuTotal },
      { name: "Drops", value: dropsTotal },
      { name: "Metas VBC/Cob.", value: metasTotal },
      { name: "Armazenagem", value: armazTotal },
      { name: "Garantia crédito", value: garantiaTotal },
      { name: "Outros", value: outrosTotal },
    ].filter((d) => d.value > 0);
  }, [atual]);

  const atingimentoPorBU = useMemo(() => {
    if (!atual) return [];
    const vbcMetas = atual.metas.filter((m) => m.tipo === "VBC" && m.objetivo_meta);
    const map = new Map<string, { bu: string; pct: number; status: string }>();
    for (const m of vbcMetas) {
      const bu = m.bu ?? "Outros";
      const pct = (m.efetivo_fiscal ?? 0) / (m.objetivo_meta ?? 1);
      map.set(bu, {
        bu,
        pct,
        status: pct >= 1.0 ? "ideal" : pct >= 0.87 ? "meta" : pct >= 0.7 ? "minimo" : "abaixo",
      });
    }
    return [...map.values()].sort((a, b) => b.pct - a.pct);
  }, [atual]);

  const alertasRecomendador = useMemo(
    () =>
      atual?.metas.filter(
        (m) => m.tipo === "Recomendador" && (m.efetivo_fiscal ?? 0) < 0.5 && m.comissao === 0,
      ) ?? [],
    [atual],
  );

  if (loading) return <PageHeader title="Remuneração Broker (PRESER)" subtitle="Carregando…" />;

  if (!atual) {
    return (
      <>
        <PageHeader
          title="Remuneração Broker (PRESER)"
          subtitle="Extrato mensal de remuneração da MB Logística como Broker da Nestlé."
        />
        <PreserEmptyState semExtrato />
      </>
    );
  }

  const e = atual.extrato;
  const impostos =
    (e.irrf_retido ?? 0) + (e.pis_retido ?? 0) + (e.cofins_retido ?? 0) + (e.csll_retido ?? 0);
  const periodoLabel_ = periodoLabel(e.periodo.slice(0, 7));

  return (
    <>
      <PageHeader
        title="Remuneração Broker (PRESER)"
        subtitle={`${periodoLabel_} • ${historico.length} extrato(s) no histórico`}
        actions={<PreserPeriodoFilter />}
      />

      {/* Alertas críticos */}
      {alertasRecomendador.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              Recomendador(es) abaixo do gatilho — comissão zerada
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {alertasRecomendador.map((m) => (
                <li key={m.id}>
                  <strong>{m.bu}</strong>: {fmtPct(m.efetivo_fiscal ?? 0)} atingido (mínimo 50%) →
                  perdeu {fmtBRL((m.objetivo_meta ?? 0) * (m.pct_meta ?? 0.005) * (m.efetivo_mes ?? 0) || 0)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Receita Broker Total"
          value={fmtBRL(e.valor_total_comissao, { compact: true })}
          sub={fmtBRL(e.valor_total_comissao)}
          icon={DollarSign}
          accent="primary"
          delta={variacao != null ? { pct: variacao, label: "vs mês anterior" } : undefined}
        />
        <KpiCard
          label="% sobre Faturamento AC"
          value={fmtPct(e.pct_remuneracao_sobre_fat ?? 0, 3)}
          sub={`Faturamento AC: ${fmtBRL(e.faturamento_ac, { compact: true })}`}
          icon={Percent}
          accent="accent"
        />
        <KpiCard
          label="Valor Contabilizado"
          value={fmtBRL(e.valor_total_contabilizado, { compact: true })}
          sub={
            e.valor_total_comissao
              ? `${fmtPct((e.valor_total_contabilizado ?? 0) / e.valor_total_comissao)} do total bruto`
              : undefined
          }
          icon={TrendingUp}
          accent="success"
        />
        <KpiCard
          label="Impostos Retidos"
          value={fmtBRL(impostos, { compact: true })}
          sub={`IRRF ${fmtBRL(e.irrf_retido, { compact: true })} • PIS/COFINS/CSLL ${fmtBRL((e.pis_retido ?? 0) + (e.cofins_retido ?? 0) + (e.csll_retido ?? 0), { compact: true })}`}
          icon={Receipt}
          accent="destructive"
        />
      </div>

      {/* Evolução temporal + Composição */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Evolução da Receita Broker</CardTitle>
                <CardDescription>Comissão total mensal nos últimos {serie.length} meses.</CardDescription>
              </div>
              {variacao != null && (
                <Badge variant={variacao >= 0 ? "success" : "destructive"} className="gap-1 shrink-0">
                  {variacao >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {fmtPct(variacao)} vs mês ant.
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {serie.length === 0 ? (
              <NoData />
            ) : (
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gComissao" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C_PRIMARY} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={C_PRIMARY} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="periodo"
                      tickFormatter={(v) => periodoLabel(v).replace("/20", "/").replace("eiro", "").replace("eiro","").slice(0,6)}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtBRL(v, { compact: true })}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip content={<SerieTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="comissao"
                      name="Comissão"
                      stroke={C_PRIMARY}
                      fill="url(#gComissao)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: C_PRIMARY }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composição da Receita</CardTitle>
            <CardDescription>{periodoLabel_}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={composicao}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={38}
                    outerRadius={68}
                    paddingAngle={2}
                  >
                    {composicao.map((_, i) => (
                      <Cell key={i} fill={CRITERIO_COLORS[i % CRITERIO_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [fmtBRL(v), ""]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 space-y-1 text-xs">
              {composicao.map((d, i) => (
                <li key={d.name} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: CRITERIO_COLORS[i % CRITERIO_COLORS.length] }}
                    />
                    <span className="truncate text-muted-foreground">{d.name}</span>
                  </span>
                  <span className="shrink-0 font-semibold">{fmtBRL(d.value, { compact: true })}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Atingimento VBC por BU */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>% Atingimento VBC por BU</CardTitle>
            <CardDescription>Efetivo ÷ Meta. Linha tracejada = 100% da meta.</CardDescription>
          </CardHeader>
          <CardContent>
            {atingimentoPorBU.length === 0 ? (
              <NoData />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={atingimentoPorBU.map((d) => ({
                      ...d,
                      pctDisplay: Math.round(d.pct * 1000) / 10,
                    }))}
                    layout="vertical"
                    margin={{ top: 4, right: 40, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      domain={[0, Math.max(1.2, ...atingimentoPorBU.map((d) => d.pct + 0.1))]}
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="bu"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      width={60}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${v.toFixed(1)}%`, "Atingimento"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="pct" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {atingimentoPorBU.map((d, i) => (
                        <Cell
                          key={i}
                          fill={
                            d.status === "ideal"
                              ? C_OK
                              : d.status === "meta"
                              ? C_WARN
                              : d.status === "minimo"
                              ? "hsl(38 70% 55%)"
                              : C_BAD
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* % Remuneração s/ Faturamento — evolução */}
        <Card>
          <CardHeader>
            <CardTitle>% Remuneração / Faturamento AC</CardTitle>
            <CardDescription>Evolução do take-rate mensal.</CardDescription>
          </CardHeader>
          <CardContent>
            {serie.length === 0 ? (
              <NoData />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gPct" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={C_OK} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={C_OK} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="periodo"
                      tickFormatter={(v) => periodoLabel(v).slice(0, 6)}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickFormatter={(v) => `${(v * 100).toFixed(2)}%`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      formatter={(v: number) => [`${(v * 100).toFixed(3)}%`, "% / Fat. AC"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="pct"
                      stroke={C_OK}
                      fill="url(#gPct)"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: C_OK }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Links para módulos analíticos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/preser/oportunidades", label: "Oportunidades", desc: "Quanto está perdendo por canal/meta" },
          { to: "/preser/sku", label: "Análise por SKU", desc: "Mix por categoria e divisão" },
          { to: "/preser/canais", label: "Canais & Drops", desc: "R$/drop e oportunidades" },
          { to: "/preser/metas", label: "Metas e Gaps", desc: "Atingimento por critério" },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary"
          >
            <div>
              <p className="text-sm font-semibold">{l.label}</p>
              <p className="text-xs text-muted-foreground">{l.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  delta,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "destructive" | "success" | "accent";
  delta?: { pct: number; label: string };
}) {
  const accentBg: Record<string, string> = {
    primary: "from-primary/15 to-primary/0",
    destructive: "from-destructive/15 to-destructive/0",
    success: "from-success/15 to-success/0",
    accent: "from-accent/15 to-accent/0",
  };
  const accentText: Record<string, string> = {
    primary: "text-primary",
    destructive: "text-destructive",
    success: "text-success",
    accent: "text-accent",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          accentBg[accent],
        )}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <Icon className={cn("h-5 w-5", accentText[accent])} />
        </div>
        <p className="mt-3 text-3xl font-bold leading-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        {delta && (
          <div
            className={cn(
              "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              delta.pct >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
            )}
          >
            {delta.pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {fmtPct(delta.pct)} {delta.label}
          </div>
        )}
      </div>
    </div>
  );
}

function NoData() {
  return (
    <p className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      Sem dados suficientes.
    </p>
  );
}

function SerieTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { payload: { comissao: number; faturamento_ac: number; pct: number } }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-elevated">
      <p className="mb-2 font-semibold">{periodoLabel(label ?? "")}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Comissão:</span>
        <span className="text-right font-medium">{fmtBRL(d.comissao)}</span>
        <span className="text-muted-foreground">Fat. AC:</span>
        <span className="text-right font-medium">{fmtBRL(d.faturamento_ac)}</span>
        <span className="text-muted-foreground">% Fat.:</span>
        <span className="text-right font-medium">{fmtPct(d.pct, 3)}</span>
      </div>
    </div>
  );
}
