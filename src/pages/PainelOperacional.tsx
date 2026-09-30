import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Banknote,
  Coins,
  Info,
  Landmark,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { QuantoSobrou } from "@/components/QuantoSobrou";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useData } from "@/contexts/DataContext";
import { custoFolha } from "@/lib/calculations";
import { listExtratos } from "@/lib/preser/api";
import type { PreserExtrato } from "@/lib/preser/types";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  DRO_FONTE,
  DRO_MESES,
  agregarDro,
  custoBuckets,
  varYoY,
} from "@/lib/dro/logisticaData";
import { montarFonteDro } from "@/lib/dro/fonte";

const AZUL = "hsl(197 99% 28%)";
const VERDE = "hsl(152 60% 42%)";
const VERMELHO = "hsl(0 72% 55%)";
const CINZA = "hsl(220 10% 55%)";

export default function PainelOperacional() {
  // ─── Camada comercial (ponte dinheiro × operação) ─────────────────────────
  const { dataset, rowsAll } = useData();
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

  // ─── Fonte do DRO: importado (cascata completa) ou embutido (Jan–Abr) ──────
  const fonteDro = useMemo(() => montarFonteDro(dataset.dro), [dataset.dro]);
  const MESES_FILTRO = fonteDro.mesesIdx; // meses de 2026 (chips, séries, KPIs absolutos)
  const MESES_COMP = fonteDro.mesesComuns; // base same-period das comparações vs 2025

  // ─── Filtro de meses do DRO (Acumulado ou um mês) ─────────────────────────
  const [mesSel, setMesSel] = useState<number | "all">("all");
  // Se o mês selecionado deixar de existir na fonte, volta pro acumulado.
  const mesAtivo: number | "all" =
    mesSel === "all" || MESES_FILTRO.includes(mesSel) ? mesSel : "all";

  // Escopo dos valores ABSOLUTOS de 2026 (KPIs, cascata) — todos os meses do filtro.
  const mesesEscopo = useMemo(
    () => (mesAtivo === "all" ? MESES_FILTRO : [mesAtivo]),
    [mesAtivo, MESES_FILTRO],
  );
  // Escopo da COMPARAÇÃO vs 2025 — só meses que os DOIS anos têm (same-period).
  const mesesComp = useMemo(
    () => (mesAtivo === "all" ? MESES_COMP : MESES_COMP.includes(mesAtivo) ? [mesAtivo] : []),
    [mesAtivo, MESES_COMP],
  );
  const temBaseComp = mesesComp.length > 0;

  const ytd2026 = useMemo(() => agregarDro(fonteDro.d2026, mesesEscopo), [fonteDro, mesesEscopo]);
  const ytd2026Comp = useMemo(() => agregarDro(fonteDro.d2026, mesesComp), [fonteDro, mesesComp]);
  const ytd2025 = useMemo(() => agregarDro(fonteDro.d2025, mesesComp), [fonteDro, mesesComp]);
  const custosTotais2026 =
    ytd2026.custoServicos + ytd2026.despesasTributarias + ytd2026.despesasOperacionais;
  const margens2026 = {
    ebitda: ytd2026.receitaLiquida ? ytd2026.ebitda / ytd2026.receitaLiquida : 0,
    liquida: ytd2026.receitaLiquida ? ytd2026.resultado / ytd2026.receitaLiquida : 0,
  };
  // YoY sempre 2026×2025 sobre o MESMO período (ytd2026Comp/ytd2025); NaN = sem base.
  const yoy = {
    receita: varYoY(ytd2026Comp.receitaLiquida, ytd2025.receitaLiquida),
    ebitda: varYoY(ytd2026Comp.ebitda, ytd2025.ebitda),
    resultado: varYoY(ytd2026Comp.resultado, ytd2025.resultado),
    despesasOperacionais: varYoY(ytd2026Comp.despesasOperacionais, ytd2025.despesasOperacionais),
    despesasFinanceiras: varYoY(ytd2026Comp.despesasFinanceiras, ytd2025.despesasFinanceiras),
    irCsll: varYoY(ytd2026Comp.irCsll, ytd2025.irCsll),
  };
  // Rótulo do período: intervalo quando contíguo, lista quando há lacuna (period misto).
  const rotuloMeses = (idx: number[]): string => {
    if (!idx.length) return "—";
    const f = idx[0];
    const l = idx[idx.length - 1];
    return l - f === idx.length - 1
      ? `${DRO_MESES[f]}–${DRO_MESES[l]}`
      : idx.map((i) => DRO_MESES[i]).join(", ");
  };
  const PERIODO = mesAtivo === "all" ? rotuloMeses(MESES_FILTRO) : DRO_MESES[mesAtivo];
  // Período da comparação (same-period): meses comuns a 2026 e 2025.
  const PERIODO_COMP = mesAtivo === "all" ? rotuloMeses(MESES_COMP) : DRO_MESES[mesAtivo];

  // Acumulado do ano para a "Leitura rápida": 2026 cheio (absolutos) e 2026×2025
  // same-period (variações). Independe do filtro de mês.
  const droYtdFixo = useMemo(() => agregarDro(fonteDro.d2026, MESES_FILTRO), [fonteDro, MESES_FILTRO]);
  const droYtdComp = useMemo(() => agregarDro(fonteDro.d2026, MESES_COMP), [fonteDro, MESES_COMP]);
  const droYtd2025Fixo = useMemo(() => agregarDro(fonteDro.d2025, MESES_COMP), [fonteDro, MESES_COMP]);
  const yoyYtd = {
    receita: varYoY(droYtdComp.receitaLiquida, droYtd2025Fixo.receitaLiquida),
    ebitda: varYoY(droYtdComp.ebitda, droYtd2025Fixo.ebitda),
    resultado: varYoY(droYtdComp.resultado, droYtd2025Fixo.resultado),
  };
  // Denominador FIXO da composição (baldes Jan–Abr) — não acompanha o filtro.
  const custoBucketsTotal = custoBuckets.reduce((s, b) => s + b.valor, 0);

  // Narrativa adaptativa (acompanha o sinal; trata ausência de base 2025 = NaN).
  const verbReceita = yoy.receita >= 0 ? "cresceu" : "recuou";
  const corReceita = yoy.receita >= 0 ? "text-success" : "text-destructive";
  const verbResultado = !Number.isFinite(yoy.resultado)
    ? ""
    : Math.abs(yoy.resultado) < 0.03
      ? "ficou quase parado"
      : yoy.resultado >= 0
        ? "subiu"
        : "caiu";
  const temSqueeze =
    Number.isFinite(yoy.receita) && Number.isFinite(yoy.resultado) && yoy.receita > yoy.resultado;

  const folhaTotal = useMemo(
    () => (dataset.folha ?? []).reduce((s, f) => s + custoFolha(f), 0),
    [dataset.folha],
  );
  const colaboradoresFolha = useMemo(
    () => new Set((dataset.folha ?? []).map((f) => f.codigo || f.nome)).size,
    [dataset.folha],
  );
  const folhaUltimoMes = useMemo(() => {
    const ps = [...new Set((dataset.folha ?? []).map((f) => f.periodo))].sort();
    return ps.length ? ps[ps.length - 1] : null;
  }, [dataset.folha]);
  const receitaPreser = useMemo(() => {
    let total = 0;
    for (const ex of extratos) {
      const contab = ex.valor_total_contabilizado ?? ex.valor_total_comissao ?? 0;
      const impostos =
        (ex.irrf_retido ?? 0) + (ex.pis_retido ?? 0) + (ex.cofins_retido ?? 0) + (ex.csll_retido ?? 0);
      total += contab - impostos;
    }
    return total;
  }, [extratos]);

  // Consolidado comercial SEM dupla contagem: supervisores já agregam os
  // vendedores deles (mesma regra do Resumo Executivo).
  const comercial = useMemo(() => {
    const base = rowsAll.filter((r) => !r.is_supervisor);
    return {
      faturamento: base.reduce((s, r) => s + r.faturamento, 0),
      vendedores: new Set(base.map((r) => r.vendedor_id)).size,
    };
  }, [rowsAll]);

  const temComercial = comercial.vendedores > 0 || folhaTotal > 0 || receitaPreser > 0;

  // ─── Séries do DRO (apenas meses com lançamento) ──────────────────────────
  const serieMensal = useMemo(
    () =>
      MESES_FILTRO.map((i) => ({
        mes: DRO_MESES[i],
        receitaLiquida: fonteDro.d2026.receitaLiquida[i],
        resultado: fonteDro.d2026.resultado[i],
      })),
    [fonteDro, MESES_FILTRO],
  );

  // ─── Cascata do resultado (waterfall, escopo do filtro) ───────────────────
  const cascata = useMemo(() => {
    const financeiroLiq = ytd2026.despesasFinanceiras - ytd2026.receitasFinanceiras;
    const outras = ytd2026.despesasNaoDedutiveis - ytd2026.receitasNaoOperacionais;
    const steps: { nome: string; valor: number; tipo: "total" | "drop" | "final" }[] = [
      { nome: "Receita Líquida", valor: ytd2026.receitaLiquida, tipo: "total" },
      { nome: "Custo dos Serviços", valor: -ytd2026.custoServicos, tipo: "drop" },
      { nome: "Desp. Tributárias", valor: -ytd2026.despesasTributarias, tipo: "drop" },
      { nome: "Desp. Operacionais", valor: -ytd2026.despesasOperacionais, tipo: "drop" },
      { nome: "EBITDA", valor: ytd2026.ebitda, tipo: "total" },
      { nome: "Result. Financeiro", valor: -financeiroLiq, tipo: "drop" },
      { nome: "IR / CSLL", valor: -ytd2026.irCsll, tipo: "drop" },
      { nome: "Deprec. + n/ dedut.", valor: -(ytd2026.depreciacao + outras), tipo: "drop" },
      { nome: "Resultado", valor: ytd2026.resultado, tipo: "final" },
    ];
    let running = 0;
    return steps.map((s) => {
      if (s.tipo === "total" || s.tipo === "final") {
        running = s.valor;
        return {
          ...s,
          base: 0,
          mag: s.valor,
          fill: s.tipo === "final" ? (s.valor >= 0 ? VERDE : VERMELHO) : AZUL,
        };
      }
      const base = running + s.valor; // s.valor é negativo
      const row = { ...s, base, mag: -s.valor, fill: VERMELHO };
      running = base;
      return row;
    });
  }, [ytd2026]);

  // ─── Comparativo 2025 × 2026 (MESMO período: ambos sobre mesesComp) ────────
  const comparativo = useMemo(
    () => [
      { nome: "Receita Líq.", a2025: ytd2025.receitaLiquida, a2026: ytd2026Comp.receitaLiquida },
      { nome: "EBITDA", a2025: ytd2025.ebitda, a2026: ytd2026Comp.ebitda },
      { nome: "Resultado", a2025: ytd2025.resultado, a2026: ytd2026Comp.resultado },
    ],
    [ytd2025, ytd2026Comp],
  );

  const pctCustos = custosTotais2026 / ytd2026.receitaLiquida;
  const pessoal = custoBuckets[0];

  return (
    <>
      <PageHeader
        title="Painel Operacional — MB Logística"
        subtitle={
          mesAtivo === "all"
            ? `Dinheiro × operação · DRO 2026 · acumulado ${PERIODO} (vs. mesmo período de 2025)`
            : `Dinheiro × operação · DRO 2026 · ${DRO_MESES[mesAtivo]}/2026 (vs. ${DRO_MESES[mesAtivo]}/2025)`
        }
      />

      {/* ─── Filtro de meses ────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Período:
        </span>
        <MesChip ativo={mesAtivo === "all"} onClick={() => setMesSel("all")}>
          Acumulado
        </MesChip>
        {MESES_FILTRO.map((i) => (
          <MesChip key={i} ativo={mesAtivo === i} onClick={() => setMesSel(i)}>
            {DRO_MESES[i]}
          </MesChip>
        ))}
        <span
          className="ml-auto rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
          title={
            fonteDro.importado
              ? "Números do DRO que você importou na aba Importação."
              : "DRO embutido (Jan–Abr). Importe o Excel do DRO para trazer mais meses."
          }
        >
          {fonteDro.importado ? "DRO importado" : "DRO embutido (Jan–Abr)"}
        </span>
      </div>

      {/* ─── A) Saúde financeira (DRO real) ─────────────────────────────────── */}
      <SectionTitle>Saúde financeira do negócio (DRO)</SectionTitle>
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HeroCard
          label="Receita Líquida"
          value={fmtBRL(ytd2026.receitaLiquida, { compact: true })}
          sub="Receita de serviços já sem impostos"
          icon={Banknote}
          accent="primary"
          delta={{ pct: yoy.receita, label: "vs 2025" }}
        />
        <HeroCard
          label="EBITDA"
          value={fmtBRL(ytd2026.ebitda, { compact: true })}
          sub={`Margem ${fmtPct(margens2026.ebitda)} · geração de caixa operacional`}
          icon={TrendingUp}
          accent="accent"
          delta={{ pct: yoy.ebitda, label: "vs 2025" }}
        />
        <HeroCard
          label="Resultado do Exercício"
          value={fmtBRL(ytd2026.resultado, { compact: true })}
          sub={`Margem líquida ${fmtPct(margens2026.liquida)} · lucro final`}
          icon={Wallet}
          accent="success"
          delta={{ pct: yoy.resultado, label: "vs 2025" }}
        />
        <HeroCard
          label="Custos + Despesas"
          value={fmtBRL(custosTotais2026, { compact: true })}
          sub={`${fmtPct(pctCustos)} da receita líquida consumida`}
          icon={TrendingDown}
          accent="destructive"
        />
      </div>

      {/* ─── B) Cresce o topo, aperta o fundo ───────────────────────────────── */}
      <SectionTitle>
        {mesAtivo === "all" ? "Leitura do ano: cresce o topo, aperta o fundo" : `Leitura de ${PERIODO}`}
      </SectionTitle>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1 border-warning/30 bg-gradient-to-br from-warning/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" /> Margem sob pressão
            </CardTitle>
            <CardDescription>Mesmo período, ano contra ano.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {temBaseComp ? (
              <>
                <p className="leading-relaxed">
                  A operação <strong className={corReceita}>{verbReceita}</strong> (receita {fmtPct(yoy.receita, 1)} e EBITDA{" "}
                  {fmtPct(yoy.ebitda, 1)}), e o <strong>lucro {verbResultado}</strong> ({fmtPct(yoy.resultado, 1)})
                  {temSqueeze ? ": o que entra a mais está sendo consumido abaixo do EBITDA." : "."}
                </p>
                <ul className="space-y-1.5 text-[13px] text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    Despesas operacionais {fmtPct(yoy.despesasOperacionais, 1)}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    Despesas financeiras {fmtPct(yoy.despesasFinanceiras, 1)}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                    IR / CSLL {fmtPct(yoy.irCsll, 1)}
                  </li>
                </ul>
              </>
            ) : (
              <p className="leading-relaxed text-muted-foreground">
                Sem base de 2025 no DRO para comparar este período. Os valores absolutos de 2026 aparecem acima; a
                comparação ano-a-ano fica disponível quando o mesmo período de 2025 estiver na planilha.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>2025 × 2026 lado a lado</CardTitle>
            <CardDescription>
              {mesAtivo === "all"
                ? `Acumulado do mesmo período (${PERIODO_COMP}).`
                : `${PERIODO_COMP}/2026 vs. ${PERIODO_COMP}/2025.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparativo} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="nome" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tickFormatter={(v) => fmtBRL(v, { compact: true })}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    formatter={(v: number, n: string) => [fmtBRL(v), n === "a2025" ? "2025" : "2026"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(v) => (v === "a2025" ? "2025" : "2026")}
                  />
                  <Bar dataKey="a2025" name="a2025" fill={CINZA} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="a2026" name="a2026" fill={AZUL} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── C) Cascata do resultado ────────────────────────────────────────── */}
      <SectionTitle>Da receita ao lucro (cascata)</SectionTitle>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Como cada real de receita vira lucro</CardTitle>
          <CardDescription>
            Receita líquida menos custos, despesas, financeiro e impostos —{" "}
            {mesAtivo === "all" ? `acumulado ${PERIODO} 2026` : `${PERIODO}/2026`}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cascata}
                layout="vertical"
                margin={{ top: 4, right: 56, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => fmtBRL(v, { compact: true })}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={124}
                  tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }}
                />
                <Tooltip content={<CascataTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
                <Bar dataKey="base" stackId="a" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="mag" stackId="a" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {cascata.map((d, i) => (
                    <Cell key={i} fill={d.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ─── C2) Quanto sobrou: venda × recebido × lucro líquido ─────────────── */}
      <SectionTitle>Quanto sobrou do que vendemos</SectionTitle>
      <QuantoSobrou
        d2026={fonteDro.d2026}
        d2025={fonteDro.d2025}
        meses={MESES_FILTRO}
        mesesComuns={MESES_COMP}
        extratos={extratos}
      />

      {/* ─── D) Evolução mensal ─────────────────────────────────────────────── */}
      <SectionTitle>Mês a mês</SectionTitle>
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Receita líquida × resultado</CardTitle>
            <CardDescription>{PERIODO} 2026 · maio em diante ainda sem lançamento.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={serieMensal} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={AZUL} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={AZUL} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tickFormatter={(v) => fmtBRL(v, { compact: true })}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    formatter={(v: number, n: string) => [
                      fmtBRL(v),
                      n === "receitaLiquida" ? "Receita Líquida" : "Resultado",
                    ]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 12 }}
                    formatter={(v) => (v === "receitaLiquida" ? "Receita Líquida" : "Resultado")}
                  />
                  <Area
                    type="monotone"
                    dataKey="receitaLiquida"
                    name="receitaLiquida"
                    stroke={AZUL}
                    fill="url(#gRec)"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Bar dataKey="resultado" name="resultado" radius={[4, 4, 0, 0]} barSize={28} isAnimationActive={false}>
                    {serieMensal.map((d, i) => (
                      <Cell key={i} fill={d.resultado >= 0 ? VERDE : VERMELHO} />
                    ))}
                  </Bar>
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Só aparece quando a história é DE FATO verdadeira: março negativo apesar de
            EBITDA forte, por causa da provisão de IR/CSLL do 1º tri lançada no mês. */}
        {MESES_FILTRO.includes(2) &&
          fonteDro.d2026.resultado[2] < 0 &&
          fonteDro.d2026.ebitda[2] > 0 &&
          fonteDro.d2026.irCsll[2] > 0 &&
          (mesAtivo === "all" || mesAtivo === 2) && (
            <Card className="border-warning/30 bg-gradient-to-br from-warning/10 to-transparent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <Info className="h-5 w-5" /> Por que março ficou negativo?
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-relaxed">
                <p>
                  O resultado de março foi <strong className="text-destructive">{fmtBRL(fonteDro.d2026.resultado[2], { compact: true })}</strong>,
                  mas <strong>não foi piora da operação</strong>: o EBITDA de março ({fmtBRL(fonteDro.d2026.ebitda[2], { compact: true })})
                  ficou entre os mais altos do período.
                </p>
                <p className="rounded-lg bg-card/70 p-3 text-[13px] text-muted-foreground ring-1 ring-border">
                  Todo o <strong className="text-foreground">IR/CSLL do 1º trimestre ({fmtBRL(fonteDro.d2026.irCsll[2], { compact: true })})</strong>{" "}
                  foi lançado em março. É provisão de imposto trimestral — distorce o mês, mas o acumulado segue positivo.
                </p>
              </CardContent>
            </Card>
          )}
      </div>

      {/* ─── E) Composição de custos ────────────────────────────────────────── */}
      <SectionTitle>Para onde vai o dinheiro</SectionTitle>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Composição dos custos · estrutural (base Jan–Abr)</CardTitle>
          <CardDescription>
            Pessoal pesa {fmtPct(pessoal.pctReceita, 0)} da receita líquida — 3 de cada 4 reais de custo é gente. A
            quebra por balde é estrutural (acumulado Jan–Abr) e não acompanha o filtro de mês nem os meses importados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {custoBuckets.map((b) => (
            <div key={b.nome}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">{b.nome}</span>
                <span className="text-muted-foreground">
                  {fmtBRL(b.valor, { compact: true })} ·{" "}
                  <span className="font-semibold text-foreground">{fmtPct(b.pctReceita, 0)} da receita</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(b.valor / custoBucketsTotal) * 100}%`, background: b.cor }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ─── F) Ponte: dinheiro × operação comercial ────────────────────────── */}
      <SectionTitle>Ponte: dinheiro × operação comercial</SectionTitle>
      {temComercial ? (
        <>
          <p className="mb-3 flex items-start gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Cada número tem natureza diferente: <strong className="text-foreground">folha</strong> é custo (entra no DRO);{" "}
            <strong className="text-foreground">faturamento intermediado</strong> é sell-out do cliente (NÃO é receita da MB);{" "}
            <strong className="text-foreground">PRESER</strong> é a comissão que vira caixa. Não some entre si.
          </p>
          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <HeroCard
              label="Folha (c/ encargos)"
              value={folhaTotal > 0 ? fmtBRL(folhaTotal, { compact: true }) : "—"}
              sub={
                folhaTotal > 0
                  ? `${fmtPct(folhaTotal / ytd2026.receitaLiquida, 0)} da receita do DRO${folhaUltimoMes ? ` · ${periodoLabel(folhaUltimoMes)}` : ""}`
                  : "Importe a folha em /upload"
              }
              icon={Receipt}
              accent="destructive"
            />
            <HeroCard
              label="Equipe comercial"
              value={comercial.vendedores > 0 ? fmtNum(comercial.vendedores) : "—"}
              sub={colaboradoresFolha > 0 ? `${fmtNum(colaboradoresFolha)} pessoas na folha total` : "Vendedores ativos"}
              icon={Users}
              accent="accent"
            />
            <HeroCard
              label="Faturamento intermediado"
              value={comercial.faturamento > 0 ? fmtBRL(comercial.faturamento, { compact: true }) : "—"}
              sub="Sell-out dos clientes — não é receita da MB"
              icon={Coins}
              accent="primary"
            />
            <HeroCard
              label="Receita PRESER (líquida)"
              value={receitaPreser > 0 ? fmtBRL(receitaPreser, { compact: true }) : "—"}
              sub={receitaPreser > 0 ? "Comissão contabilizada − impostos" : "Importe em /preser/importar"}
              icon={Landmark}
              accent="success"
            />
          </div>
        </>
      ) : (
        <Card className="mb-6 border-dashed">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <Scale className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium">Conecte a operação comercial ao financeiro</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Importe a folha, o consolidado comercial e o extrato PRESER para ligar o custo da equipe e a
              comissão recebida aos números do DRO acima.
            </p>
            <div className="mt-2 flex gap-2 text-xs">
              <Link to="/upload" className="rounded-lg bg-primary px-3 py-1.5 font-medium text-primary-foreground">
                Importar consolidado + folha
              </Link>
              <Link to="/preser/importar" className="rounded-lg border border-border px-3 py-1.5 font-medium">
                Importar PRESER
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── G) Leitura rápida ──────────────────────────────────────────────── */}
      <SectionTitle>Leitura rápida para decisão · acumulado do ano</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Insight
          icon={TrendingUp}
          tone="success"
          titulo="O topo está crescendo"
          texto={`Receita ${fmtPct(yoyYtd.receita, 1)} e EBITDA ${fmtPct(yoyYtd.ebitda, 1)} vs. o mesmo período de 2025. A operação está vendendo e gerando mais caixa operacional.`}
        />
        <Insight
          icon={AlertTriangle}
          tone="warning"
          titulo="O lucro não acompanhou: margem sob pressão"
          texto={`Resultado só ${fmtPct(yoyYtd.resultado, 1)} (de ${fmtBRL(droYtd2025Fixo.resultado, { compact: true })} para ${fmtBRL(droYtdComp.resultado, { compact: true })}). Despesas operacionais, financeiras e impostos subiram mais que a receita e comeram o ganho.`}
        />
        <Insight
          icon={Users}
          tone="primary"
          titulo="Pessoal é a maior alavanca de eficiência"
          texto={`${pessoal.nome} consome ${fmtPct(pessoal.pctReceita, 0)} da receita líquida (${fmtBRL(pessoal.valor, { compact: true })}). Qualquer ganho de produtividade da equipe vira lucro direto.`}
        />
        <Insight
          icon={Landmark}
          tone="muted"
          titulo="Olho no caixa: financeiro + impostos"
          texto={`Abaixo do EBITDA, ${fmtBRL(droYtdFixo.despesasFinanceiras + droYtdFixo.irCsll, { compact: true })} saíram em despesas financeiras e IR/CSLL no acumulado do ano. Reduzir custo de dívida e planejar o imposto é o caminho mais rápido para o lucro crescer junto com a receita.`}
        />
      </div>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Fonte: {DRO_FONTE} (aba MB Logística) · cascata reconciliada com a planilha ·{" "}
        {mesAtivo === "all" ? `acumulado ${PERIODO}` : PERIODO} dos dois anos (mesmo período). O ano de 2025 fechou no
        negativo por perdas no 2º semestre, fora deste recorte.
      </p>
    </>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  );
}

function MesChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        ativo
          ? "border-primary bg-primary text-primary-foreground shadow-sm"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

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
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", accentBg[accent])} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={cn("h-5 w-5", accentText[accent])} />
        </div>
        <p className="mt-3 text-3xl font-bold leading-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
        {delta &&
          (Number.isFinite(delta.pct) ? (
            <div
              className={cn(
                "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                delta.pct >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
              )}
            >
              {delta.pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {delta.pct >= 0 ? "+" : ""}
              {fmtPct(delta.pct, 1)} {delta.label}
            </div>
          ) : (
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              s/ base 2025
            </div>
          ))}
      </div>
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

function CascataTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const sinal = d.tipo === "drop" ? "−" : "";
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-elevated">
      <div className="font-semibold">{d.nome}</div>
      <div className="mt-1 text-muted-foreground">
        {sinal}
        {fmtBRL(d.mag)}
      </div>
    </div>
  );
}
