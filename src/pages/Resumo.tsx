import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Crown,
  DollarSign,
  HandCoins,
  Percent,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { ENCARGOS_PCT } from "@/lib/calculations";
import { listExtratos } from "@/lib/preser/api";
import type { PreserExtrato } from "@/lib/preser/types";
import { Quadrante, QUADRANTES_ORDER } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUADRANT_COLORS: Record<Quadrante, string> = {
  Estrela: "hsl(152 60% 42%)",
  "Trator caro": "hsl(38 92% 50%)",
  Potencial: "hsl(215 80% 48%)",
  "Alerta vermelho": "hsl(0 72% 55%)",
  "—": "hsl(220 10% 50%)",
};

type Escopo = "todos" | "vendedores" | "supervisores";

export default function Resumo() {
  const { dataset, rows, rowsAll, periodosSelecionados, periodos } = useData();
  const [escopo, setEscopo] = useState<Escopo>("todos");
  const [selColabs, setSelColabs] = useState<Set<string>>(new Set());
  const [filtroOpen, setFiltroOpen] = useState(false);

  // ─── Resultado real: receita PRESER líquida × folha completa ──────────────
  const [extratos, setExtratos] = useState<PreserExtrato[]>([]);
  useEffect(() => {
    (async () => {
      try {
        setExtratos(await listExtratos());
      } catch {
        setExtratos([]);
      }
    })();
  }, []);

  // Série mensal do resultado real (todos os meses com PRESER e/ou folha)
  const serieReal = useMemo(() => {
    const map = new Map<
      string,
      { receitaLiquida: number; folhaTotal: number; temPreser: boolean; temFolha: boolean }
    >();
    const get = (p: string) => {
      let v = map.get(p);
      if (!v) {
        v = { receitaLiquida: 0, folhaTotal: 0, temPreser: false, temFolha: false };
        map.set(p, v);
      }
      return v;
    };
    for (const ex of extratos) {
      const v = get(ex.periodo.slice(0, 7));
      const contab = ex.valor_total_contabilizado ?? ex.valor_total_comissao ?? 0;
      const impostos =
        (ex.irrf_retido ?? 0) +
        (ex.pis_retido ?? 0) +
        (ex.cofins_retido ?? 0) +
        (ex.csll_retido ?? 0);
      v.receitaLiquida += contab - impostos;
      v.temPreser = true;
    }
    for (const f of dataset.folha ?? []) {
      const v = get(f.periodo);
      v.folhaTotal += f.bruto * (1 + ENCARGOS_PCT);
      v.temFolha = true;
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, v]) => ({
        periodo,
        label: periodoLabel(periodo),
        ...v,
        resultado: v.receitaLiquida - v.folhaTotal,
        margem: v.receitaLiquida > 0 ? (v.receitaLiquida - v.folhaTotal) / v.receitaLiquida : 0,
      }));
  }, [extratos, dataset.folha]);

  // KPIs do resultado real no(s) período(s) selecionado(s)
  const kpisReal = useMemo(() => {
    const meses =
      periodosSelecionados.length === 0
        ? serieReal
        : serieReal.filter((m) => periodosSelecionados.includes(m.periodo));
    const receitaLiquida = meses.reduce((s, m) => s + m.receitaLiquida, 0);
    const folhaTotal = meses.reduce((s, m) => s + m.folhaTotal, 0);
    const resultado = receitaLiquida - folhaTotal;
    const margem = receitaLiquida > 0 ? resultado / receitaLiquida : 0;
    const semPreser = !meses.some((m) => m.temPreser);
    const semFolha = !meses.some((m) => m.temFolha);
    return { receitaLiquida, folhaTotal, resultado, margem, semPreser, semFolha };
  }, [serieReal, periodosSelecionados]);

  const rowsPorEscopo = useMemo(() => {
    if (escopo === "vendedores") return rows.filter((r) => !r.is_supervisor);
    if (escopo === "supervisores") return rows.filter((r) => r.is_supervisor);
    // "todos" = consolidado da empresa SEM dupla contagem:
    // supervisores já agregam o faturamento dos vendedores deles,
    // então somar tudo dobraria. Usamos apenas vendedores diretos.
    return rows.filter((r) => !r.is_supervisor);
  }, [rows, escopo]);

  const rowsFiltradas = useMemo(() => {
    if (selColabs.size === 0) return rowsPorEscopo;
    return rowsPorEscopo.filter((r) => selColabs.has(r.vendedor_id));
  }, [rowsPorEscopo, selColabs]);

  const colabsDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rowsPorEscopo) {
      if (!map.has(r.vendedor_id)) map.set(r.vendedor_id, r.vendedor_nome);
    }
    return [...map.entries()]
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [rowsPorEscopo]);

  // ─── KPIs consolidados ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const faturamento = rowsFiltradas.reduce((s, r) => s + r.faturamento, 0);
    const custo = rowsFiltradas.reduce((s, r) => s + r.custo, 0);
    const pctCusto = faturamento > 0 ? custo / faturamento : 0;
    // Custo da equipe a cada R$ 1.000 intermediados — eficiência honesta,
    // sem fingir que faturamento de sell-out é receita da MB
    const custoPorMil = faturamento > 0 ? (custo / faturamento) * 1000 : 0;
    const vendIds = new Set(rowsFiltradas.map((r) => r.vendedor_id));
    return { faturamento, custo, pctCusto, custoPorMil, vendedores: vendIds.size };
  }, [rowsFiltradas]);

  // ─── Série mensal (usa rowsAll para evolução completa) ────────────────────
  const serieMensal = useMemo(() => {
    let base = rowsAll;
    if (escopo === "vendedores") base = base.filter((r) => !r.is_supervisor);
    if (escopo === "supervisores") base = base.filter((r) => r.is_supervisor);
    if (selColabs.size > 0) base = base.filter((r) => selColabs.has(r.vendedor_id));

    const byPer = new Map<string, { faturamento: number; custo: number; vendedores: Set<string> }>();
    for (const r of base) {
      if (!byPer.has(r.periodo))
        byPer.set(r.periodo, { faturamento: 0, custo: 0, vendedores: new Set() });
      const v = byPer.get(r.periodo)!;
      v.faturamento += r.faturamento;
      v.custo += r.custo;
      v.vendedores.add(r.vendedor_id);
    }
    return [...byPer.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, v]) => ({
        periodo,
        label: periodoLabel(periodo),
        faturamento: v.faturamento,
        custo: v.custo,
        pctCusto: v.faturamento > 0 ? v.custo / v.faturamento : 0,
        custoPorMil: v.faturamento > 0 ? (v.custo / v.faturamento) * 1000 : 0,
        vendedores: v.vendedores.size,
      }));
  }, [rowsAll, escopo, selColabs]);

  // ─── Ranking acumulado no escopo atual ────────────────────────────────────
  const rankingAcumulado = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; nome: string; faturamento: number; custo: number; quadrante: Quadrante }
    >();
    for (const r of rowsFiltradas) {
      const cur = byId.get(r.vendedor_id);
      if (!cur) {
        byId.set(r.vendedor_id, {
          id: r.vendedor_id,
          nome: r.vendedor_nome,
          faturamento: r.faturamento,
          custo: r.custo,
          quadrante: r.quadrante_performance,
        });
      } else {
        cur.faturamento += r.faturamento;
        cur.custo += r.custo;
      }
    }
    return [...byId.values()]
      .map((v) => ({
        ...v,
        pctCusto: v.faturamento > 0 ? v.custo / v.faturamento : 0,
        resultado: v.faturamento - v.custo,
      }))
      .sort((a, b) => b.faturamento - a.faturamento);
  }, [rowsFiltradas]);

  const top5 = rankingAcumulado.slice(0, 5);
  const bottom5 = [...rankingAcumulado].reverse().slice(0, 5);

  const distribuicaoQuadrante = useMemo(() => {
    const counts: Record<Quadrante, number> = {
      Estrela: 0,
      "Trator caro": 0,
      Potencial: 0,
      "Alerta vermelho": 0,
      "—": 0,
    };
    for (const r of rankingAcumulado) counts[r.quadrante]++;
    return QUADRANTES_ORDER.map((q) => ({ name: q, value: counts[q], color: QUADRANT_COLORS[q] }));
  }, [rankingAcumulado]);

  const alertas = useMemo(
    () => rankingAcumulado.filter((r) => r.quadrante === "Alerta vermelho" || r.resultado < 0),
    [rankingAcumulado],
  );

  const variacao = useMemo(() => {
    if (serieMensal.length < 2) return null;
    const last = serieMensal[serieMensal.length - 1];
    const prev = serieMensal[serieMensal.length - 2];
    if (prev.faturamento === 0) return null;
    const delta = last.faturamento - prev.faturamento;
    const pct = delta / prev.faturamento;
    return { delta, pct, lastLabel: last.label, prevLabel: prev.label };
  }, [serieMensal]);

  if (rowsAll.length === 0) {
    return (
      <>
        <PageHeader title="Resumo Executivo" subtitle="Visão geral da eficiência comercial." />
        <EmptyState />
      </>
    );
  }

  const subtituloPeriodo =
    periodosSelecionados.length === 0
      ? `Consolidado de ${periodos.length} mês(es).`
      : periodosSelecionados.length === 1
      ? periodoLabel(periodosSelecionados[0])
      : `${periodosSelecionados.length} meses selecionados`;

  return (
    <>
      <PageHeader title="Resumo Executivo" subtitle={subtituloPeriodo} actions={<PeriodoFilter />} />

      {/* Filtros: escopo + colaboradores */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          {(["todos", "vendedores", "supervisores"] as Escopo[]).map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                setEscopo(e);
                setSelColabs(new Set());
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
                escopo === e
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {e}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setFiltroOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm hover:bg-secondary"
        >
          <Users className="h-3.5 w-3.5" />
          Colaboradores
          <Badge variant={selColabs.size > 0 ? "default" : "outline"}>
            {selColabs.size === 0 ? "Todos" : `${selColabs.size} selec.`}
          </Badge>
        </button>

        {selColabs.size > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setSelColabs(new Set())}>
            <X className="h-3 w-3" /> limpar
          </Button>
        )}
      </div>

      {filtroOpen && colabsDisponiveis.length > 0 && (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap gap-1.5 p-3">
            {colabsDisponiveis.map((c) => {
              const active = selColabs.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const s = new Set(selColabs);
                    if (s.has(c.id)) s.delete(c.id);
                    else s.add(c.id);
                    setSelColabs(s);
                  }}
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
          </CardContent>
        </Card>
      )}

      {/* ─── Bloco 1: Resultado real (PRESER × Folha) ───────────────────────── */}
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Resultado real da operação
        </h2>
        <Link
          to="/preser-folha"
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          ver análise completa →
        </Link>
      </div>
      {kpisReal.semPreser ? (
        <div className="mb-5 rounded-xl border border-warning/40 bg-warning/10 p-4 text-xs">
          <p className="font-semibold text-warning">Sem extrato PRESER no(s) mês(es) selecionado(s).</p>
          <p className="mt-0.5 text-muted-foreground">
            O resultado real (comissão recebida − folha completa) depende do extrato PRESER.{" "}
            <Link to="/preser/importar" className="underline hover:text-foreground">
              Importe em /preser/importar
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <HeroCard
            label="Receita PRESER (líquida)"
            value={fmtBRL(kpisReal.receitaLiquida, { compact: true })}
            sub="Comissão contabilizada − impostos retidos"
            icon={HandCoins}
            accent="primary"
          />
          <HeroCard
            label="Folha total (c/ encargos)"
            value={kpisReal.semFolha ? "—" : fmtBRL(kpisReal.folhaTotal, { compact: true })}
            sub={kpisReal.semFolha ? "Importe a folha do período" : "Todos os setores, bruto + encargos"}
            icon={Receipt}
            accent="destructive"
          />
          <HeroCard
            label="Resultado real"
            value={kpisReal.semFolha ? "—" : fmtBRL(kpisReal.resultado, { compact: true })}
            sub="Receita líquida − folha completa"
            icon={Scale}
            accent={kpisReal.resultado >= 0 ? "success" : "destructive"}
          />
          <HeroCard
            label="Margem"
            value={kpisReal.semFolha ? "—" : fmtPct(kpisReal.margem)}
            sub={
              kpisReal.semFolha
                ? undefined
                : `Folha consome ${fmtPct(kpisReal.folhaTotal / kpisReal.receitaLiquida, 0)} da comissão`
            }
            icon={Percent}
            accent={kpisReal.margem >= 0.2 ? "success" : kpisReal.margem >= 0 ? "accent" : "destructive"}
          />
        </div>
      )}

      {/* ─── Bloco 2: Operação comercial (faturamento intermediado) ────────── */}
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Operação comercial — faturamento intermediado
      </h2>
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HeroCard
          label="Faturamento intermediado"
          value={fmtBRL(kpis.faturamento, { compact: true })}
          sub="Sell-out dos clientes — não é receita da MB"
          icon={DollarSign}
          accent="primary"
          delta={variacao ? { pct: variacao.pct, label: `vs. ${variacao.prevLabel}` } : undefined}
        />
        <HeroCard
          label="Custo da equipe"
          value={fmtBRL(kpis.custo, { compact: true })}
          sub={`${fmtPct(kpis.pctCusto)} do faturamento intermediado`}
          icon={TrendingDown}
          accent="destructive"
        />
        <HeroCard
          label="Custo por R$ 1.000"
          value={fmtBRL(kpis.custoPorMil)}
          sub="Custo da equipe a cada R$ 1.000 intermediados"
          icon={Scale}
          accent="accent"
        />
        <HeroCard
          label="Colaboradores"
          value={fmtNum(kpis.vendedores)}
          sub="No escopo e filtros atuais"
          icon={Users}
          accent="accent"
        />
      </div>

      {/* ─── Evolução + Distribuição ────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Evolução mensal</CardTitle>
                <CardDescription>
                  Faturamento intermediado × custo da equipe — escopo e filtros aplicados.
                </CardDescription>
              </div>
              {variacao && (
                <Badge variant={variacao.pct >= 0 ? "success" : "destructive"} className="gap-1">
                  {variacao.pct >= 0 ? (
                    <TrendingUp className="h-3 w-3" />
                  ) : (
                    <TrendingDown className="h-3 w-3" />
                  )}
                  {fmtPct(variacao.pct)} vs mês anterior
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {serieMensal.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Sem dados no escopo.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serieMensal} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(215 80% 48%)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(215 80% 48%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gCusto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0 72% 55%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(0 72% 55%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      tickFormatter={(v) => fmtBRL(v, { compact: true })}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip content={<EvolucaoTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area
                      type="monotone"
                      dataKey="faturamento"
                      name="Faturamento"
                      stroke="hsl(215 80% 48%)"
                      fill="url(#gFat)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="custo"
                      name="Custo"
                      stroke="hsl(0 72% 55%)"
                      fill="url(#gCusto)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição de performance</CardTitle>
            <CardDescription>Matriz 2x2 consolidada do escopo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribuicaoQuadrante.filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {distribuicaoQuadrante.map((d) => (
                      <Cell key={d.name} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${v} colab.`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs">
              {distribuicaoQuadrante.map((d) => (
                <li key={d.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    {d.name}
                  </span>
                  <span className="font-semibold">{d.value}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ─── ROI + Resultado mensal ─────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Custo por R$ 1.000 intermediado</CardTitle>
            <CardDescription>
              Quanto a equipe custa a cada R$ 1.000 que intermediou — quanto menor, melhor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {serieMensal.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serieMensal}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtBRL(v)}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      formatter={(v: any) => [fmtBRL(v), "Custo / R$ 1.000"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="custoPorMil"
                      stroke="hsl(38 92% 50%)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado real por mês</CardTitle>
            <CardDescription>
              Comissão PRESER líquida menos folha completa — empresa toda, sem filtros de equipe.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {serieReal.filter((m) => m.temPreser && m.temFolha).length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Sem mês com PRESER e folha importados.
              </p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serieReal.filter((m) => m.temPreser && m.temFolha)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtBRL(v, { compact: true })}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      formatter={(v: any) => [fmtBRL(v), "Resultado"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                      }}
                    />
                    <Bar dataKey="resultado" radius={[4, 4, 0, 0]}>
                      {serieReal
                        .filter((m) => m.temPreser && m.temFolha)
                        .map((d, i) => (
                          <Cell key={i} fill={d.resultado >= 0 ? "hsl(152 60% 42%)" : "hsl(0 72% 55%)"} />
                        ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Top 5 / Bottom 5 / Alertas ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <TopList
          title="Top 5 faturamento"
          icon={<Crown className="h-4 w-4 text-success" />}
          rows={top5}
          emptyMsg="Sem colaboradores no escopo."
        />
        <TopList
          title="5 menores faturamentos"
          icon={<TrendingDown className="h-4 w-4 text-warning" />}
          rows={bottom5}
          emptyMsg="Sem colaboradores no escopo."
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Atenção
            </CardTitle>
            <CardDescription>Em alerta vermelho ou com resultado negativo.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {alertas.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Nenhum colaborador em alerta.
              </p>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {alertas.slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.nome}</div>
                      <div className="text-[11px] text-muted-foreground">
                        Resultado: {fmtBRL(r.resultado, { compact: true })} • % custo:{" "}
                        {fmtPct(r.pctCusto)}
                      </div>
                    </div>
                    <Badge variant="destructive" className="shrink-0 text-[10px]">
                      {r.quadrante}
                    </Badge>
                  </li>
                ))}
                {alertas.length > 8 && (
                  <li className="p-3 text-center text-[11px] text-muted-foreground">
                    +{alertas.length - 8} outros — veja na Matriz ou Ranking.
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────────────

function HeroCard({
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

function TopList({
  title,
  icon,
  rows,
  emptyMsg,
}: {
  title: string;
  icon: React.ReactNode;
  rows: { id: string; nome: string; faturamento: number; custo: number; pctCusto: number }[];
  emptyMsg: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-xs text-muted-foreground">{emptyMsg}</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {rows.map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-5 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.nome}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Custo {fmtBRL(r.custo, { compact: true })} • % custo {fmtPct(r.pctCusto)}
                  </div>
                </div>
                <span className="shrink-0 text-right font-semibold">
                  {fmtBRL(r.faturamento, { compact: true })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function EvolucaoTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-elevated">
      <div className="mb-2 font-semibold">{label}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Faturamento:</span>
        <span className="text-right font-medium">{fmtBRL(d.faturamento)}</span>
        <span className="text-muted-foreground">Custo:</span>
        <span className="text-right font-medium">{fmtBRL(d.custo)}</span>
        <span className="text-muted-foreground">% custo:</span>
        <span className="text-right font-medium">{fmtPct(d.pctCusto)}</span>
        <span className="text-muted-foreground">Custo / R$ 1.000:</span>
        <span className="text-right font-medium">{fmtBRL(d.custoPorMil)}</span>
        <span className="text-muted-foreground">Colaboradores:</span>
        <span className="text-right font-medium">{fmtNum(d.vendedores)}</span>
      </div>
    </div>
  );
}
