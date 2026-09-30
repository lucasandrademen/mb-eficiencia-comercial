import { useMemo, useState } from "react";
import { AnoToggle } from "@/components/PeriodoFilter";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  Coins,
  Gauge,
  Receipt,
  TrendingDown,
  TrendingUp,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { custoFolha, encargosFolha } from "@/lib/calculations";
import { receitaLiquidaMes } from "@/lib/dro/receita";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const AZUL = "hsl(197 99% 28%)";
const VERDE = "hsl(152 60% 42%)";
const LARANJA = "hsl(38 92% 50%)";
const VERMELHO = "hsl(0 72% 55%)";

interface SetorAgg {
  setor: string;
  headcount: number;
  custo: number;
  custoMedio: number;
  pct: number;
  pctReceita: number;
}

export default function EficienciaOperacional() {
  const { dataset } = useData();
  const folha = dataset.folha ?? [];

  const periodos = useMemo(() => [...new Set(folha.map((f) => f.periodo))].sort(), [folha]);
  const [mes, setMes] = useState("");
  const mesAtivo = mes && periodos.includes(mes) ? mes : periodos[periodos.length - 1] ?? "";

  const doMes = useMemo(() => folha.filter((f) => f.periodo === mesAtivo), [folha, mesAtivo]);

  // ─── KPIs do mês ──────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const bruto = doMes.reduce((s, f) => s + f.bruto, 0);
    const encargos = doMes.reduce((s, f) => s + encargosFolha(f), 0);
    const custo = bruto + encargos;
    const headcount = new Set(doMes.map((f) => f.codigo)).size;
    const receita = receitaLiquidaMes(dataset.dro, mesAtivo);
    return {
      bruto,
      encargos,
      custo,
      headcount,
      custoMedio: headcount > 0 ? custo / headcount : 0,
      receita,
      pessoalPctReceita: receita > 0 ? custo / receita : 0,
      receitaPorFunc: receita > 0 && headcount > 0 ? receita / headcount : 0,
    };
  }, [doMes, mesAtivo, dataset.dro]);

  // ─── Por setor (mês) ──────────────────────────────────────────────────────
  const setores: SetorAgg[] = useMemo(() => {
    const map = new Map<string, { custo: number; cods: Set<string> }>();
    for (const f of doMes) {
      const k = f.departamento?.trim() || "Sem setor";
      if (!map.has(k)) map.set(k, { custo: 0, cods: new Set() });
      const v = map.get(k)!;
      v.custo += custoFolha(f);
      v.cods.add(f.codigo);
    }
    const total = [...map.values()].reduce((s, v) => s + v.custo, 0);
    const receita = receitaLiquidaMes(dataset.dro, mesAtivo);
    return [...map.entries()]
      .map(([setor, v]) => ({
        setor,
        headcount: v.cods.size,
        custo: v.custo,
        custoMedio: v.cods.size > 0 ? v.custo / v.cods.size : 0,
        pct: total > 0 ? v.custo / total : 0,
        pctReceita: receita > 0 ? v.custo / receita : 0,
      }))
      .sort((a, b) => b.custo - a.custo);
  }, [doMes, mesAtivo, dataset.dro]);

  // ─── Evolução mensal ──────────────────────────────────────────────────────
  const serie = useMemo(() => {
    const map = new Map<string, { custo: number; cods: Set<string>; adm: number; dem: number }>();
    for (const f of folha) {
      if (!map.has(f.periodo)) map.set(f.periodo, { custo: 0, cods: new Set(), adm: 0, dem: 0 });
      const v = map.get(f.periodo)!;
      v.custo += custoFolha(f);
      v.cods.add(f.codigo);
      if (f.admissao && f.admissao.slice(0, 7) === f.periodo) v.adm += 1;
      if (f.demissao && f.demissao.slice(0, 7) === f.periodo) v.dem += 1;
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, v]) => {
        const receita = receitaLiquidaMes(dataset.dro, periodo);
        const headcount = v.cods.size;
        return {
          periodo,
          label: periodoLabel(periodo).replace("/2026", "").replace("/2025", ""),
          custo: v.custo,
          headcount,
          custoMedio: headcount > 0 ? v.custo / headcount : 0,
          receita,
          pessoalPct: receita > 0 ? v.custo / receita : 0,
          receitaPorFunc: receita > 0 && headcount > 0 ? receita / headcount : 0,
          admissoes: v.adm,
          demissoes: v.dem,
        };
      });
  }, [folha, dataset.dro]);

  // ─── Turnover do mês ──────────────────────────────────────────────────────
  const turnover = useMemo(() => {
    const adm = doMes.filter((f) => f.admissao?.slice(0, 7) === mesAtivo).length;
    const dem = doMes.filter((f) => f.demissao?.slice(0, 7) === mesAtivo).length;
    const taxa = kpis.headcount > 0 ? (adm + dem) / 2 / kpis.headcount : 0;
    return { adm, dem, saldo: adm - dem, taxa };
  }, [doMes, mesAtivo, kpis.headcount]);
  const temDatas = useMemo(() => folha.some((f) => f.admissao), [folha]);

  const serieComReceita = useMemo(() => serie.filter((s) => s.receita > 0), [serie]);

  // ─── Leitura rápida ───────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const setorCaro = [...setores].sort((a, b) => b.custoMedio - a.custoMedio)[0];
    const setorConcentra = setores[0];
    const primeiro = serie[0];
    const ultimo = serie[serie.length - 1];
    const varCustoMedio =
      primeiro && ultimo && primeiro.custoMedio > 0
        ? ultimo.custoMedio / primeiro.custoMedio - 1
        : null;
    return { setorCaro, setorConcentra, primeiro, ultimo, varCustoMedio };
  }, [setores, serie]);

  if (folha.length === 0) {
    return (
      <>
        <PageHeader title="Eficiência Operacional" subtitle="Custo por funcionário e eficiência da operação." />
        <EmptyState
          title="Nenhuma folha importada"
          description="Importe o PDF da folha em Importação para ver a análise de custo por funcionário."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Eficiência Operacional"
        subtitle={`MB Logística · ${periodoLabel(mesAtivo)} · custo por funcionário, por setor e eficiência da operação.`}
        actions={
          <>
            <AnoToggle />
            <Select value={mesAtivo} onChange={(e) => setMes(e.target.value)} className="w-44">
              {periodos.map((p) => (
                <option key={p} value={p}>
                  {periodoLabel(p)}
                </option>
              ))}
            </Select>
          </>
        }
      />

      {/* ─── KPIs ───────────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          title="Custo de pessoal (real)"
          value={fmtBRL(kpis.custo, { compact: true })}
          subtitle={`Bruto + encargos (${fmtPct(kpis.bruto > 0 ? kpis.encargos / kpis.bruto : 0, 0)} de encargo)`}
          icon={Receipt}
          variant="destructive"
        />
        <MetricCard
          title="Custo por funcionário"
          value={fmtBRL(kpis.custoMedio, { compact: true })}
          subtitle={`${fmtNum(kpis.headcount)} colaboradores · média/mês`}
          icon={Users}
          variant="primary"
        />
        <MetricCard
          title="Pessoal / Receita"
          value={kpis.pessoalPctReceita > 0 ? fmtPct(kpis.pessoalPctReceita, 0) : "—"}
          subtitle={
            kpis.pessoalPctReceita > 0
              ? `da Receita Líquida (${fmtBRL(kpis.receita, { compact: true })})`
              : "Sem receita do DRO neste mês"
          }
          icon={Gauge}
          variant={
            kpis.pessoalPctReceita === 0
              ? "default"
              : kpis.pessoalPctReceita < 0.45
              ? "success"
              : kpis.pessoalPctReceita < 0.6
              ? "warning"
              : "destructive"
          }
        />
        <MetricCard
          title="Receita por funcionário"
          value={kpis.receitaPorFunc > 0 ? fmtBRL(kpis.receitaPorFunc, { compact: true }) : "—"}
          subtitle={kpis.receitaPorFunc > 0 ? "Receita líquida ÷ headcount" : "Sem receita do DRO neste mês"}
          icon={Coins}
          variant="accent"
        />
      </div>

      {/* ─── Custo por funcionário por setor ────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" /> Custo por funcionário, por setor
            </CardTitle>
            <CardDescription>Onde o custo por cabeça é maior — {periodoLabel(mesAtivo)}.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...setores].sort((a, b) => b.custoMedio - a.custoMedio)}
                  layout="vertical"
                  margin={{ top: 4, right: 56, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => fmtBRL(v, { compact: true })} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis type="category" dataKey="setor" width={130} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} />
                  <Tooltip
                    formatter={(v: number) => [fmtBRL(v), "Custo/funcionário"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Bar dataKey="custoMedio" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                    {setores.map((_, i) => (
                      <Cell key={i} fill={AZUL} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhe por setor</CardTitle>
            <CardDescription>
              <strong>% receita</strong> = custo do setor sobre a Receita Líquida da MB (DRO).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">Setor</th>
                    <th className="py-2 px-2 text-right">Pessoas</th>
                    <th className="py-2 px-2 text-right">Custo total</th>
                    <th className="py-2 px-2 text-right">Custo/func.</th>
                    <th className="py-2 px-2 text-right">% receita</th>
                    <th className="py-2 pl-2 text-right">% custo</th>
                  </tr>
                </thead>
                <tbody>
                  {setores.map((s) => (
                    <tr key={s.setor} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 font-medium">{s.setor}</td>
                      <td className="py-2 px-2 text-right">{fmtNum(s.headcount)}</td>
                      <td className="py-2 px-2 text-right">{fmtBRL(s.custo, { compact: true })}</td>
                      <td className="py-2 px-2 text-right font-semibold">{fmtBRL(s.custoMedio, { compact: true })}</td>
                      <td className="py-2 px-2 text-right font-semibold text-primary">
                        {kpis.receita > 0 ? fmtPct(s.pctReceita, 1) : "—"}
                      </td>
                      <td className="py-2 pl-2 text-right text-muted-foreground">{fmtPct(s.pct, 0)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border font-bold">
                    <td className="py-2 pr-3">Total</td>
                    <td className="py-2 px-2 text-right">{fmtNum(kpis.headcount)}</td>
                    <td className="py-2 px-2 text-right">{fmtBRL(kpis.custo, { compact: true })}</td>
                    <td className="py-2 px-2 text-right">{fmtBRL(kpis.custoMedio, { compact: true })}</td>
                    <td className="py-2 px-2 text-right text-primary">
                      {kpis.receita > 0 ? fmtPct(kpis.pessoalPctReceita, 1) : "—"}
                    </td>
                    <td className="py-2 pl-2 text-right">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Evolução: custo total, custo/func, headcount ───────────────────── */}
      {serie.length > 1 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Evolução do custo de pessoal
            </CardTitle>
            <CardDescription>
              Custo total (barras) × custo por funcionário (linha) × headcount. Meses com 13º/férias pagos sobem naturalmente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="custo" tickFormatter={(v) => fmtBRL(v, { compact: true })} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="med" orientation="right" tickFormatter={(v) => fmtBRL(v, { compact: true })} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(v: number, n: string) => [n === "Headcount" ? fmtNum(v) : fmtBRL(v), n]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="custo" dataKey="custo" name="Custo total" fill={`${AZUL.replace(")", " / 0.4)")}`} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Line yAxisId="med" type="monotone" dataKey="custoMedio" name="Custo/funcionário" stroke={LARANJA} strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
                  <Line yAxisId="med" type="monotone" dataKey="headcount" name="Headcount" stroke={VERDE} strokeWidth={2} strokeDasharray="4 3" dot={{ r: 3 }} isAnimationActive={false} hide />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Eficiência: pessoal × receita ──────────────────────────────────── */}
      {serieComReceita.length >= 1 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-accent" /> Eficiência: pessoal × receita
            </CardTitle>
            <CardDescription>
              Custo de pessoal contra a Receita Líquida do DRO (meses com DRO). Quanto menor o % da receita, mais eficiente. Meses com 13º/férias pagos pioram o % naturalmente — olhe a tendência, não o mês isolado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serieComReceita} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="rs" tickFormatter={(v) => fmtBRL(v, { compact: true })} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => fmtPct(v, 0)} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    formatter={(v: number, n: string) => [n === "Pessoal / Receita" ? fmtPct(v, 1) : fmtBRL(v), n]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="rs" dataKey="receita" name="Receita líquida" fill={`${VERDE.replace(")", " / 0.35)")}`} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar yAxisId="rs" dataKey="custo" name="Custo de pessoal" fill={`${VERMELHO.replace(")", " / 0.45)")}`} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Line yAxisId="pct" type="monotone" dataKey="pessoalPct" name="Pessoal / Receita" stroke={AZUL} strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Movimentação de pessoal (turnover) ─────────────────────────────── */}
      {temDatas && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-primary" /> Movimentação de pessoal (turnover)
            </CardTitle>
            <CardDescription>Admissões e demissões em {periodoLabel(mesAtivo)} e a evolução no período.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniStat icon={UserPlus} tone="success" label="Admissões" value={fmtNum(turnover.adm)} sub="no mês" />
              <MiniStat icon={UserMinus} tone="destructive" label="Demissões" value={fmtNum(turnover.dem)} sub="no mês" />
              <MiniStat
                icon={Users}
                tone={turnover.saldo >= 0 ? "success" : "destructive"}
                label="Saldo"
                value={`${turnover.saldo >= 0 ? "+" : ""}${fmtNum(turnover.saldo)}`}
                sub="admissões − demissões"
              />
              <MiniStat icon={ArrowRightLeft} tone="primary" label="Rotatividade" value={fmtPct(turnover.taxa, 1)} sub="(adm+dem)/2 ÷ headcount" />
            </div>
            {serie.length > 1 && (
              <div className="mt-4 h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={serie} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      formatter={(v: number, n: string) => [fmtNum(v), n]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="admissoes" name="Admissões" fill={VERDE} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="demissoes" name="Demissões" fill={VERMELHO} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Leitura rápida COO ─────────────────────────────────────────────── */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Leitura rápida para decisão
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Insight
          icon={Users}
          tone="primary"
          titulo="Custo médio por funcionário"
          texto={`Cada colaborador custa em média ${fmtBRL(kpis.custoMedio)} /mês (bruto + encargos reais). São ${fmtNum(kpis.headcount)} pessoas, ${fmtBRL(kpis.custo, { compact: true })} no total do mês.`}
        />
        {insights.setorCaro && insights.setorConcentra && (
          <Insight
            icon={Building2}
            tone="warning"
            titulo="Onde o custo se concentra"
            texto={`${insights.setorConcentra.setor} é ${fmtPct(insights.setorConcentra.pct, 0)} do custo (${fmtNum(insights.setorConcentra.headcount)} pessoas). O custo por cabeça mais alto é em ${insights.setorCaro.setor}: ${fmtBRL(insights.setorCaro.custoMedio, { compact: true })}/func.`}
          />
        )}
        {kpis.pessoalPctReceita > 0 ? (
          <Insight
            icon={Gauge}
            tone={kpis.pessoalPctReceita < 0.45 ? "success" : "warning"}
            titulo="Eficiência: pessoal sobre a receita"
            texto={`A folha consome ${fmtPct(kpis.pessoalPctReceita, 1)} da Receita Líquida do mês. Cada funcionário sustenta ${fmtBRL(kpis.receitaPorFunc, { compact: true })} de receita.`}
          />
        ) : (
          <Insight
            icon={AlertTriangle}
            tone="muted"
            titulo="Falta a receita do mês p/ eficiência"
            texto="Este mês não tem Receita Líquida do DRO carregada, então o indicador pessoal/receita fica indisponível. Os meses com DRO aparecem no gráfico de eficiência."
          />
        )}
        {insights.varCustoMedio != null && (
          <Insight
            icon={insights.varCustoMedio >= 0 ? TrendingUp : TrendingDown}
            tone={insights.varCustoMedio >= 0 ? "warning" : "success"}
            titulo="Tendência do custo por funcionário"
            texto={`Do ${insights.primeiro?.label} ao ${insights.ultimo?.label}, o custo por funcionário ${insights.varCustoMedio >= 0 ? "subiu" : "caiu"} ${fmtPct(Math.abs(insights.varCustoMedio), 1)} (de ${fmtBRL(insights.primeiro!.custoMedio, { compact: true })} para ${fmtBRL(insights.ultimo!.custoMedio, { compact: true })}). Meses com 13º/férias inflam o número.`}
          />
        )}
        {temDatas && (
          <Insight
            icon={ArrowRightLeft}
            tone={turnover.dem > turnover.adm ? "warning" : "primary"}
            titulo="Movimentação de pessoal"
            texto={`${fmtNum(turnover.adm)} admissão(ões) e ${fmtNum(turnover.dem)} demissão(ões) em ${periodoLabel(mesAtivo)} (saldo ${turnover.saldo >= 0 ? "+" : ""}${fmtNum(turnover.saldo)}, rotatividade ${fmtPct(turnover.taxa, 1)}). Cada saída/entrada custa recrutamento, treino e curva de produtividade — alta rotatividade encarece a operação além da folha.`}
          />
        )}
      </div>

      <div className="mt-6 rounded-lg border border-border bg-secondary/30 p-3 text-[11px] leading-relaxed text-muted-foreground">
        <p>
          <strong className="text-foreground">Custo</strong> = bruto + encargos patronais <strong>reais</strong> da folha
          (FGTS + INSS-empresa + Terceiros + RAT ≈ 27% do bruto num mês normal). Atenção: esse é o encargo de{" "}
          <strong>caixa do mês</strong>; o <strong>13º e as férias</strong> entram no bruto só quando pagos (meses
          específicos), então o custo anual por funcionário é maior que um mês normal — não compare um mês sem 13º com
          um mês com 13º. <strong>Receita</strong> = Receita Líquida do DRO MB Logística; folha e receita são da{" "}
          <strong>empresa inteira</strong> (mesmo escopo). Onde a folha não traz encargo real (dado antigo), usa-se a
          estimativa de 67%.
        </p>
      </div>
    </>
  );
}

function MiniStat({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "destructive" | "primary";
  label: string;
  value: string;
  sub: string;
}) {
  const ic: Record<string, string> = {
    success: "text-success",
    destructive: "text-destructive",
    primary: "text-primary",
  };
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn("h-4 w-4", ic[tone])} />
      </div>
      <p className="mt-1 text-2xl font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Insight({
  icon: Icon,
  tone,
  titulo,
  texto,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "success" | "primary" | "warning" | "muted";
  titulo: string;
  texto: string;
}) {
  const ring: Record<string, string> = {
    success: "ring-success/30",
    primary: "ring-primary/30",
    warning: "ring-warning/40",
    muted: "ring-border",
  };
  const ic: Record<string, string> = {
    success: "text-success",
    primary: "text-primary",
    warning: "text-warning",
    muted: "text-muted-foreground",
  };
  return (
    <div className={cn("flex gap-3 rounded-xl bg-card p-4 shadow-card ring-1", ring[tone])}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ic[tone])} />
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{texto}</p>
      </div>
    </div>
  );
}
