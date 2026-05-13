import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
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
  Zap,
  Sparkles,
  Target,
  Flame,
  Lightbulb,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PreserPeriodoFilter } from "@/components/PreserPeriodoFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { usePreserData } from "@/contexts/PreserDataContext";
import {
  MetaDrillModal,
  ComparativoBanner,
  SkuRecommendations,
  EsforcoImpactoMatrix,
} from "@/components/preser/DashboardEnhancements";
import { PreserEmptyState } from "./PreserEmptyState";
import { cn } from "@/lib/utils";

// ─── Cores semânticas ──────────────────────────────────────────────────
const C_OK = "hsl(152 60% 42%)";
const C_WARN = "hsl(38 92% 50%)";
const C_BAD = "hsl(0 72% 55%)";
const C_PRIMARY = "hsl(215 80% 48%)";
const C_PURPLE = "hsl(271 60% 56%)";

export default function PreserDashboard() {
  const { loading, atual, anterior, extratos: historico, serie } = usePreserData();
  const [whatIfPct, setWhatIfPct] = useState<number>(0); // % de melhoria simulada
  const [heatmapHover, setHeatmapHover] = useState<{ bu: string; tipo: string } | null>(null);
  const [drillCell, setDrillCell] = useState<{ bu: string; tipo: "VBC" | "Cobertura" | "Recomendador" } | null>(null);

  // ─── KPIs ──────────────────────────────────────────────────────────
  const variacao = useMemo(() => {
    if (!atual || !anterior) return null;
    const a = anterior.extrato.valor_total_comissao ?? 0;
    const t = atual.extrato.valor_total_comissao ?? 0;
    if (!a) return null;
    return (t - a) / a;
  }, [atual, anterior]);

  // ─── Quick Wins: as 3 maiores oportunidades acionáveis ───────────
  const quickWins = useMemo(() => {
    if (!atual) return [];
    const out: Array<{
      icon: typeof Zap;
      titulo: string;
      descricao: string;
      acao: string;
      ganho_potencial: number;
      cor: string;
      bg: string;
      link: string;
    }> = [];

    // 1) Recomendadores abaixo do gatilho — recuperação total
    for (const m of atual.metas) {
      if (m.tipo === "Recomendador" && (m.efetivo_fiscal ?? 0) < 0.5 && (m.comissao ?? 0) === 0) {
        const potencial = (m.pct_meta ?? 0.005) * (m.efetivo_mes ?? 0);
        if (potencial > 100) {
          const faltam = 0.5 - (m.efetivo_fiscal ?? 0);
          out.push({
            icon: Flame,
            titulo: `${m.bu}: subir ${(faltam * 100).toFixed(1)}pp no Recomendador`,
            descricao: `Atual ${fmtPct(m.efetivo_fiscal ?? 0)} — gatilho de 50% zerou a comissão.`,
            acao: `Recuperar ${fmtPct(faltam)} ativa toda a comissão potencial.`,
            ganho_potencial: potencial,
            cor: C_BAD,
            bg: "from-destructive/15 to-destructive/0",
            link: "/preser/oportunidades",
          });
        }
      }
    }

    // 2) Metas VBC OU Cobertura abaixo da meta (gap concreto)
    for (const m of atual.metas) {
      if ((m.tipo === "VBC" || m.tipo === "Cobertura") && (m.objetivo_meta ?? 0) > 0) {
        const ef = m.efetivo_fiscal ?? 0;
        const meta = m.objetivo_meta ?? 0;
        if (ef >= meta) continue; // já bateu
        const ganhoExtra = (m.pct_ideal ?? 0.0065) * (m.efetivo_mes ?? 0) - (m.comissao ?? 0);
        if (ganhoExtra > 1000) {
          const faltam = meta - ef;
          const unidade = m.tipo === "Cobertura" ? "clientes" : "R$";
          out.push({
            icon: Sparkles,
            titulo: `${m.bu} (${m.tipo}): faltam ${m.tipo === "Cobertura" ? fmtNum(faltam) : fmtBRL(faltam, { compact: true })} ${unidade}`,
            descricao: `Em ${fmtPct(ef / meta)} da meta — comissão na faixa mínima.`,
            acao: `Bater meta sobe % e libera comissão extra.`,
            ganho_potencial: ganhoExtra,
            cor: C_PURPLE,
            bg: "from-accent/15 to-accent/0",
            link: "/preser/metas",
          });
        }
      }
    }

    // 3) Canais com R$/drop = 0 mas drops > 0 (Farma B sem rate)
    for (const d of atual.drops) {
      const qtd = d.qtd_drops ?? 0;
      const rs = d.rs_por_drop ?? 0;
      if (qtd > 0 && rs === 0) {
        // Drops realizados mas sem remuneração — precisa investigar
        out.push({
          icon: AlertTriangle,
          titulo: `${d.canal_nome}: ${fmtNum(qtd)} drops sem remuneração`,
          descricao: `R$/drop = 0 mesmo com volume — verificar configuração.`,
          acao: `Confirmar tabela de tarifas com a Nestlé.`,
          ganho_potencial: qtd * 35.82, // assume taxa Farma C como referência
          cor: C_WARN,
          bg: "from-warning/15 to-warning/0",
          link: "/preser/canais",
        });
      }
    }

    // 4) Canais com baixa qtd vs média (oportunidade de incremento)
    const dropTotal = atual.drops.reduce((s, d) => s + (d.qtd_drops ?? 0), 0);
    const dropMedio = atual.drops.length > 0 ? dropTotal / atual.drops.length : 0;
    for (const d of atual.drops) {
      const qtd = d.qtd_drops ?? 0;
      const rs = d.rs_calculado ?? 0;
      if (qtd > 0 && qtd < dropMedio * 0.3 && rs > 50) {
        const incremento = Math.round(dropMedio * 0.3 - qtd);
        const ganho = incremento * rs;
        if (ganho > 5000) {
          out.push({
            icon: Zap,
            titulo: `Crescer ${incremento} drops em ${d.canal_nome}`,
            descricao: `Hoje tem ${fmtNum(qtd)}, abaixo da média de ${fmtNum(Math.round(dropMedio))}.`,
            acao: `R$ ${rs.toFixed(2)}/drop × ${incremento} = ${fmtBRL(ganho, { compact: true })}.`,
            ganho_potencial: ganho,
            cor: C_OK,
            bg: "from-success/15 to-success/0",
            link: "/preser/canais",
          });
        }
      }
    }

    return out.sort((a, b) => b.ganho_potencial - a.ganho_potencial).slice(0, 3);
  }, [atual]);

  // ─── Funil de Receita ─────────────────────────────────────────────
  // Lógica: o valor que vale é o "Valor total contabilizado" do PDF —
  // esse É a receita oficial registrada pela Nestlé (4 categorias fiscais).
  // valor_total_comissao é a soma das parcelas (pode ter pequenas diferenças
  // por critérios não capturados pelo parser).
  const funil = useMemo(() => {
    if (!atual) return null;
    const e = atual.extrato;
    const contab = e.valor_total_contabilizado ?? 0;
    const impostos =
      (e.irrf_retido ?? 0) +
      (e.pis_retido ?? 0) +
      (e.cofins_retido ?? 0) +
      (e.csll_retido ?? 0);
    const liquido = contab - impostos;
    const pctImpostos = contab > 0 ? impostos / contab : 0;
    return [
      { name: "Receita Bruta", valor: contab, cor: C_PRIMARY, hint: "Total contabilizado pela Nestlé" },
      { name: "Impostos", valor: impostos, cor: C_BAD, isNegativo: true, hint: `${fmtPct(pctImpostos, 2)} do bruto` },
      { name: "Líquido (caixa)", valor: liquido, cor: C_OK, isFinal: true, hint: "Cai na conta da MB" },
    ];
  }, [atual]);

  // ─── Heatmap interativo BU × Tipo ─────────────────────────────────
  // status = "OK" (verde) | "atencao" (amarelo) | "perdeu" (vermelho)
  type CellStatus = "OK" | "atencao" | "perdeu" | "sem_dado";
  const heatmapData = useMemo(() => {
    if (!atual) return { bus: [], tipos: [], cells: new Map<string, { pct: number; comissao: number; gap: number; status: CellStatus }>() };
    const bus = Array.from(new Set(atual.metas.map((m) => m.bu ?? "—"))).filter((b) => b !== "—").sort();
    const tipos: Array<"VBC" | "Cobertura" | "Recomendador"> = ["VBC", "Cobertura", "Recomendador"];
    const cells = new Map<string, { pct: number; comissao: number; gap: number; status: CellStatus }>();
    for (const bu of bus) {
      for (const tipo of tipos) {
        const metas = atual.metas.filter((m) => m.bu === bu && m.tipo === tipo);
        if (metas.length === 0) continue;
        let pct = 0;
        let comissao = 0;
        let gap = 0;
        let zerouPorGatilho = false;
        for (const m of metas) {
          comissao += m.comissao ?? 0;
          if (tipo === "Recomendador") {
            const ef = m.efetivo_fiscal ?? 0;
            pct = Math.max(pct, ef * 2); // efetivo 0.5 = 100%
            if (ef < 0.5) {
              gap += (m.pct_meta ?? 0.005) * (m.efetivo_mes ?? 0) - (m.comissao ?? 0);
              if ((m.comissao ?? 0) === 0) zerouPorGatilho = true;
            }
          } else {
            const ef = m.efetivo_fiscal ?? 0;
            const meta = m.objetivo_meta ?? 0;
            if (meta > 0) pct = Math.max(pct, ef / meta);
            if (ef < meta && meta > 0) {
              gap += (m.pct_ideal ?? 0.0065) * (m.efetivo_mes ?? 0) - (m.comissao ?? 0);
            }
          }
        }
        gap = Math.max(0, gap);

        // status definido por: comissão ganha + gap restante
        let status: CellStatus;
        if (tipo === "Recomendador" && zerouPorGatilho) {
          status = "perdeu"; // não bateu gatilho 50% → zerou tudo
        } else if (pct >= 1.0 && gap < 100) {
          status = "OK"; // atingiu meta plena
        } else if (pct >= 0.85) {
          status = "atencao"; // perto da meta
        } else {
          status = "perdeu"; // bem abaixo
        }
        cells.set(`${bu}|${tipo}`, { pct, comissao, gap, status });
      }
    }
    return { bus, tipos, cells };
  }, [atual]);

  // ─── Pareto: 80% da comissão vem de qual % dos SKUs? ─────────────
  const pareto = useMemo(() => {
    if (!atual || atual.skus.length === 0) return null;
    const ordenados = [...atual.skus]
      .filter((s) => (s.comissao ?? 0) > 0)
      .sort((a, b) => (b.comissao ?? 0) - (a.comissao ?? 0));
    const total = ordenados.reduce((s, r) => s + (r.comissao ?? 0), 0);
    let acumulado = 0;
    let skus80 = 0;
    const dataChart = ordenados.slice(0, 25).map((s, i) => {
      acumulado += s.comissao ?? 0;
      const pct = acumulado / total;
      if (pct < 0.8 || skus80 === 0) skus80 = i + 1;
      return {
        nome: s.grupo_nome.length > 22 ? s.grupo_nome.slice(0, 20) + "…" : s.grupo_nome,
        comissao: s.comissao ?? 0,
        acumulado: pct * 100,
      };
    });
    return { dataChart, skus80, totalSKUs: ordenados.length, totalComissao: total };
  }, [atual]);

  // ─── What-If: ganho simulado se melhorar metas em X% ──────────────
  const whatIfImpacto = useMemo(() => {
    if (!atual || whatIfPct === 0) return null;
    let ganho = 0;
    let metasImpactadas = 0;
    for (const m of atual.metas) {
      if (m.tipo === "Recomendador") {
        // Se subir o % de atingimento, e isso ultrapassar 50%, ganha comissão
        const novoEf = Math.min(1, (m.efetivo_fiscal ?? 0) * (1 + whatIfPct / 100));
        if ((m.efetivo_fiscal ?? 0) < 0.5 && novoEf >= 0.5) {
          ganho += (m.pct_meta ?? 0.005) * (m.efetivo_mes ?? 0) - (m.comissao ?? 0);
          metasImpactadas++;
        }
      } else if (m.tipo === "VBC") {
        const ef = m.efetivo_fiscal ?? 0;
        const novoEf = ef * (1 + whatIfPct / 100);
        const meta = m.objetivo_meta ?? 0;
        if (meta > 0 && ef < meta && novoEf >= meta) {
          ganho += (m.pct_meta ?? 0.005) * (m.efetivo_mes ?? 0) - (m.comissao ?? 0);
          metasImpactadas++;
        }
      }
    }
    return { ganho, metasImpactadas };
  }, [atual, whatIfPct]);

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
  const oportunidadeTotal = quickWins.reduce((s, q) => s + q.ganho_potencial, 0);

  return (
    <>
      <PageHeader
        title="Remuneração Broker (PRESER)"
        subtitle={`${periodoLabel_} • ${historico.length} extrato(s) no histórico`}
        actions={<PreserPeriodoFilter />}
      />

      {/* ── Banner comparativo (se há mês anterior) ─────────────── */}
      {anterior && <ComparativoBanner atual={atual} anterior={anterior} />}

      {/* ── HERO: Quick Wins (3 maiores oportunidades) ────────────── */}
      {quickWins.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              <h2 className="text-lg font-bold">Quick Wins do mês</h2>
              <Badge variant="warning">
                +{fmtBRL(oportunidadeTotal, { compact: true })} potencial
              </Badge>
            </div>
            <Link
              to="/preser/oportunidades"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Ver todas oportunidades <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {quickWins.map((q, i) => {
              const Icon = q.icon;
              return (
                <Link
                  key={i}
                  to={q.link}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:scale-[1.02] hover:shadow-elevated",
                  )}
                >
                  <div
                    className={cn(
                      "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
                      q.bg,
                    )}
                  />
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
                        style={{ background: `${q.cor}22`, color: q.cor }}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        #{i + 1}
                      </span>
                    </div>
                    <p className="text-base font-bold leading-tight">{q.titulo}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">{q.descricao}</p>
                    <div className="mt-3 flex items-end justify-between">
                      <p className="text-xs leading-tight">
                        <span className="text-muted-foreground">→ </span>
                        <span className="font-medium">{q.acao}</span>
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">Ganho potencial</span>
                      <span className="text-lg font-bold" style={{ color: q.cor }}>
                        {fmtBRL(q.ganho_potencial)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── KPIs ───────────────────────────────────────────────────── */}
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
          sub={`Faturamento: ${fmtBRL(e.faturamento_ac, { compact: true })}`}
          icon={Percent}
          accent="accent"
        />
        <KpiCard
          label="Valor Líquido (após impostos)"
          value={fmtBRL((e.valor_total_contabilizado ?? 0) - impostos, { compact: true })}
          sub={`Impostos retidos: ${fmtBRL(impostos, { compact: true })}`}
          icon={TrendingUp}
          accent="success"
        />
        <KpiCard
          label="Comissão por parcela"
          value={fmtBRL(e.valor_total_comissao, { compact: true })}
          sub="SKUs + Drops + Metas + Outros"
          icon={Receipt}
          accent="destructive"
        />
      </div>

      {/* ── Funil de Receita (cards visuais com setas) ────────────── */}
      {funil && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Funil da receita: da comissão bruta até o caixa
            </CardTitle>
            <CardDescription>
              Quanto realmente cai na conta após contabilização fiscal e impostos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {funil.map((d, i) => (
                <div key={d.name} className="relative">
                  <div
                    className="rounded-2xl border p-4 shadow-card transition-all hover:shadow-elevated"
                    style={{
                      borderColor: `${d.cor}66`,
                      background: `linear-gradient(135deg, ${d.cor}1a 0%, ${d.cor}05 100%)`,
                    }}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {i + 1}. {d.name}
                    </p>
                    <p
                      className="mt-2 text-2xl font-bold leading-tight"
                      style={{ color: d.cor }}
                    >
                      {d.isNegativo ? "−" : ""}
                      {fmtBRL(d.valor, { compact: true })}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{fmtBRL(d.valor)}</p>
                    {d.hint && (
                      <p className="mt-2 text-[11px] italic text-muted-foreground/80">{d.hint}</p>
                    )}
                  </div>
                  {/* seta entre cards */}
                  {i < funil.length - 1 && (
                    <div className="hidden sm:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10 h-6 w-6 items-center justify-center rounded-full bg-card border border-border shadow-card">
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Heatmap BU × Tipo + What-If lado a lado ─────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* Heatmap (3 colunas) */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-warning" />
              Atingimento por BU × Tipo
            </CardTitle>
            <CardDescription>
              Verde = bateu meta. Vermelho = abaixo. <strong>Clique numa célula</strong> para ver os critérios.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {heatmapData.bus.length === 0 ? (
              <NoData />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className="px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          BU
                        </th>
                        {heatmapData.tipos.map((t) => (
                          <th
                            key={t}
                            className="px-2 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"
                          >
                            {t}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {heatmapData.bus.map((bu) => (
                        <tr key={bu}>
                          <td className="px-2 py-2 font-bold text-sm">{bu}</td>
                          {heatmapData.tipos.map((tipo) => {
                            const cell = heatmapData.cells.get(`${bu}|${tipo}`);
                            if (!cell) {
                              return (
                                <td key={tipo} className="px-1 py-1">
                                  <div className="rounded-lg border border-dashed border-border/60 px-3 py-3 text-center text-[10px] text-muted-foreground/40">
                                    —
                                  </div>
                                </td>
                              );
                            }
                            // Cor agora reflete o STATUS real (não só o pct)
                            const cor =
                              cell.status === "OK"
                                ? C_OK
                                : cell.status === "atencao"
                                  ? C_WARN
                                  : C_BAD;
                            const hover = heatmapHover?.bu === bu && heatmapHover?.tipo === tipo;
                            return (
                              <td key={tipo} className="px-1 py-1">
                                <div
                                  onMouseEnter={() => setHeatmapHover({ bu, tipo })}
                                  onMouseLeave={() => setHeatmapHover(null)}
                                  onClick={() => setDrillCell({ bu, tipo })}
                                  className={cn(
                                    "cursor-pointer rounded-lg p-3 text-center transition-all",
                                    hover ? "scale-105 shadow-elevated" : "",
                                  )}
                                  style={{
                                    background: `linear-gradient(135deg, ${cor}33 0%, ${cor}11 100%)`,
                                    border: `1px solid ${cor}66`,
                                  }}
                                >
                                  <p className="text-xl font-bold" style={{ color: cor }}>
                                    {fmtPct(Math.min(1.5, cell.pct))}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    {fmtBRL(cell.comissao, { compact: true })}
                                  </p>
                                  {cell.gap > 100 && (
                                    <p className="mt-0.5 text-[10px] font-medium text-destructive">
                                      gap: {fmtBRL(cell.gap, { compact: true })}
                                    </p>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {heatmapHover && (
                  <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3 text-xs">
                    <p>
                      <strong>{heatmapHover.bu}</strong> em <strong>{heatmapHover.tipo}</strong>:{" "}
                      {(() => {
                        const c = heatmapData.cells.get(`${heatmapHover.bu}|${heatmapHover.tipo}`);
                        if (!c) return "—";
                        return (
                          <>
                            {fmtPct(c.pct)} de atingimento, {fmtBRL(c.comissao)} ganhos
                            {c.gap > 100 && (
                              <span className="text-destructive">
                                {" "}
                                — {fmtBRL(c.gap)} deixados na mesa
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* What-If Simulator (2 colunas) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Simulador "E se?"
            </CardTitle>
            <CardDescription>
              Quanto a mais ganharia se as metas subissem X%?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Melhorar atingimento em:</span>
                  <span className="font-bold text-accent">+{whatIfPct}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={1}
                  value={whatIfPct}
                  onChange={(e) => setWhatIfPct(parseInt(e.target.value))}
                  className="w-full accent-accent"
                />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                  <span>0%</span>
                  <span>25%</span>
                  <span>50%</span>
                </div>
              </div>

              <div className="rounded-xl bg-gradient-to-br from-accent/15 to-accent/0 p-4">
                {whatIfPct === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    Arraste o slider para simular o impacto
                  </p>
                ) : whatIfImpacto && whatIfImpacto.ganho > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Ganho estimado
                    </p>
                    <p className="text-3xl font-bold text-accent">
                      +{fmtBRL(whatIfImpacto.ganho)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {whatIfImpacto.metasImpactadas} meta(s) ultrapassariam o limiar
                    </p>
                    <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
                      <span className="text-muted-foreground">Nova receita estimada:</span>
                      <span className="font-bold">
                        {fmtBRL((e.valor_total_comissao ?? 0) + whatIfImpacto.ganho, { compact: true })}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-sm text-muted-foreground">
                    Esse incremento não atravessa nenhum limiar. Tente um valor maior.
                  </p>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                💡 Recomendadores ganham comissão só se atingirem 50%. VBC ganham mais ao
                bater faixa Meta (0,5%) vs. Mínimo (0,35%).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Matriz Esforço × Impacto ─────────────────────────────── */}
      <EsforcoImpactoMatrix metas={atual.metas} drops={[]} />

      {/* ── Recomendações de SKUs pra fechar gaps ────────────────── */}
      <SkuRecommendations skus={atual.skus} metas={atual.metas} />

      {/* ── Pareto 80/20 dos SKUs ─────────────────────────────────── */}
      {pareto && (
        <Card className="mb-5">
          <CardHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <CardTitle>Pareto de SKUs (80/20)</CardTitle>
                <CardDescription>
                  Top {pareto.skus80} SKUs concentram 80% da comissão (
                  {fmtPct(pareto.skus80 / pareto.totalSKUs)} do portfólio).
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Badge variant="default">
                  {pareto.skus80} SKUs = 80% receita
                </Badge>
                <Link to="/preser/sku">
                  <Button variant="outline" size="sm" className="gap-1">
                    Ver todos <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={pareto.dataChart} margin={{ top: 8, right: 24, left: 0, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="nome"
                    tick={{ fontSize: 9 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    yAxisId="left"
                    tickFormatter={(v) => fmtBRL(v, { compact: true })}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                    formatter={(v: number, name) =>
                      name === "Acumulado %" ? `${v.toFixed(1)}%` : fmtBRL(v)
                    }
                  />
                  <Bar yAxisId="left" dataKey="comissao" name="Comissão" fill={C_PRIMARY} radius={[4, 4, 0, 0]} />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="acumulado"
                    name="Acumulado %"
                    stroke={C_BAD}
                    strokeWidth={2.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Evolução temporal ──────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>Evolução da Receita Broker</CardTitle>
                <CardDescription>Últimos {serie.length} mês(es).</CardDescription>
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
              <div className="h-[220px]">
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
                      tickFormatter={(v) => periodoLabel(v).slice(0, 6)}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtBRL(v, { compact: true })}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      formatter={(v: number) => [fmtBRL(v), "Comissão"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                      labelFormatter={(l) => periodoLabel(l)}
                    />
                    <Area
                      type="monotone"
                      dataKey="comissao"
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
            <CardTitle>% Remuneração / Faturamento AC</CardTitle>
            <CardDescription>Take-rate mensal — quanto a Nestlé está pagando ao broker.</CardDescription>
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
                      labelFormatter={(l) => periodoLabel(l)}
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

      {/* ── Modal de drill-down do heatmap ───────────────────────── */}
      {drillCell && (
        <MetaDrillModal
          open={!!drillCell}
          onClose={() => setDrillCell(null)}
          bu={drillCell.bu}
          tipo={drillCell.tipo}
          metas={atual.metas}
        />
      )}

      {/* ── Links rápidos ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { to: "/preser/oportunidades", label: "Oportunidades", desc: "Quanto está perdendo" },
          { to: "/preser/comparativo", label: "Comparativo Mensal", desc: "Atual vs anterior" },
          { to: "/preser/sku", label: "Análise por SKU", desc: "Mix por categoria" },
          { to: "/preser/canais", label: "Canais & Drops", desc: "R$/drop por canal" },
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
  label, value, sub, icon: Icon, accent, delta,
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
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", accentBg[accent])} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
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
    <p className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      Sem dados suficientes.
    </p>
  );
}
