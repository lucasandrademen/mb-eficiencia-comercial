import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Database, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { filterPurinaMetas, isPurina, usePreserData } from "@/contexts/PreserDataContext";
import { listExtratosCompletos } from "@/lib/preser/api";
import { FONTES, somarFontes, type FonteKey } from "@/lib/preser/fontes";
import { CATEGORIA_NOMES, type PreserCategoriaCodigo, type PreserExtratoCompleto } from "@/lib/preser/types";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PreserEmptyState } from "./PreserEmptyState";

// Padrão MB (variante App): ano anterior = azul claro, ano atual = azul Nestlé
const C_ANT = "#5FB0CE";
const C_ATU = "#016690";
const C_BOM = "#1F9D6B";
const C_RISCO = "#D64545";
const C_GRADE = "#DCE6F2";
const C_TINTA = "#5B7299";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Base = "periodo" | "completo";

/** Números de um mês do PRESER, já sem Purina (broker não opera). */
interface Mes {
  ano: number;
  mes: number; // 1–12
  comissao: number;
  liquida: number;
  faturamento: number;
  drops: number;
  fontes: Record<FonteKey, number>;
  e: PreserExtratoCompleto;
}

function toMes(raw: PreserExtratoCompleto): Mes {
  const e: PreserExtratoCompleto = {
    ...raw,
    metas: filterPurinaMetas(raw.metas),
    outros: raw.outros.filter((o) => !isPurina(o)),
  };
  const x = e.extrato;
  const impostos = (x.irrf_retido ?? 0) + (x.pis_retido ?? 0) + (x.cofins_retido ?? 0) + (x.csll_retido ?? 0);
  return {
    ano: parseInt(x.periodo.slice(0, 4), 10),
    mes: parseInt(x.periodo.slice(5, 7), 10),
    comissao: x.valor_total_comissao ?? 0,
    liquida: (x.valor_total_contabilizado ?? 0) - impostos,
    faturamento: x.faturamento_ac ?? 0,
    drops: e.drops.reduce((s, d) => s + (d.qtd_drops ?? 0), 0),
    fontes: somarFontes(e),
    e,
  };
}

const soma = (ms: Mes[], f: (m: Mes) => number) => ms.reduce((s, m) => s + f(m), 0);
const varPct = (ant: number, atu: number) => (ant ? (atu - ant) / Math.abs(ant) : null);

/** Soma uma dimensão (chave → valor) sobre vários meses. */
function agrupar(ms: Mes[], linhas: (e: PreserExtratoCompleto) => [string, number][]) {
  const m = new Map<string, number>();
  for (const x of ms) for (const [k, v] of linhas(x.e)) m.set(k, (m.get(k) ?? 0) + v);
  return m;
}

/** Junta dois agrupamentos em linhas de tabela, ordenadas pelo maior valor. */
function comparar(ant: Map<string, number>, atu: Map<string, number>) {
  const chaves = new Set([...ant.keys(), ...atu.keys()]);
  return [...chaves]
    .map((k) => ({ k, ant: ant.get(k) ?? 0, atu: atu.get(k) ?? 0 }))
    .filter((r) => r.ant !== 0 || r.atu !== 0)
    .sort((a, b) => Math.max(b.ant, b.atu) - Math.max(a.ant, a.atu));
}

export default function PreserAnual() {
  const { extratos } = usePreserData();
  const [todos, setTodos] = useState<PreserExtratoCompleto[] | null>(null);
  const [base, setBase] = useState<Base>("periodo");

  useEffect(() => {
    listExtratosCompletos().then(setTodos).catch(() => setTodos([]));
  }, [extratos]);

  type Dados =
    | { anoAtu: number; anoAnt: number; semAnterior: true }
    | { anoAtu: number; anoAnt: number; semAnterior: false; doAtu: Mes[]; doAnt: Mes[]; doAntTodos: Mes[]; ultimoMes: number };
  const d = useMemo((): Dados | null => {
    if (!todos?.length) return null;
    const meses = todos.map(toMes);
    const anoAtu = Math.max(...meses.map((m) => m.ano));
    const anoAnt = anoAtu - 1;
    const doAtu = meses.filter((m) => m.ano === anoAtu);
    const doAntTodos = meses.filter((m) => m.ano === anoAnt);
    if (!doAntTodos.length) return { anoAtu, anoAnt, semAnterior: true };

    const mesesAtu = new Set(doAtu.map((m) => m.mes));
    const doAnt = base === "periodo" ? doAntTodos.filter((m) => mesesAtu.has(m.mes)) : doAntTodos;
    const ultimoMes = Math.max(...doAtu.map((m) => m.mes));
    return { anoAtu, anoAnt, semAnterior: false, doAtu, doAnt, doAntTodos, ultimoMes };
  }, [todos, base]);

  if (todos === null) {
    return (
      <>
        <PageHeader title="PRESER · Comparativo anual" subtitle="Carregando…" />
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Lendo extratos…
        </div>
      </>
    );
  }
  if (!d) {
    return (
      <>
        <PageHeader title="PRESER · Comparativo anual" />
        <PreserEmptyState semExtrato />
      </>
    );
  }
  if (d.semAnterior) {
    return (
      <>
        <PageHeader title={`PRESER · ${d.anoAnt} × ${d.anoAtu}`} />
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Importe os extratos de {d.anoAnt} para comparar com {d.anoAtu}.
          </CardContent>
        </Card>
      </>
    );
  }

  const dd = d as Extract<Dados, { semAnterior: false }>;
  return <Conteudo {...dd} base={base} setBase={setBase} todos={todos} />;
}

function Conteudo({
  anoAtu,
  anoAnt,
  doAtu,
  doAnt,
  doAntTodos,
  ultimoMes,
  base,
  setBase,
  todos,
}: {
  anoAtu: number;
  anoAnt: number;
  doAtu: Mes[];
  doAnt: Mes[];
  doAntTodos: Mes[];
  ultimoMes: number;
  base: Base;
  setBase: (b: Base) => void;
  todos: PreserExtratoCompleto[];
}) {
  const A = String(anoAnt);
  const B = String(anoAtu);
  const recorte =
    base === "periodo"
      ? `Mesmo período: ${MESES[0]}–${MESES[ultimoMes - 1]} (${doAtu.length} meses de PRESER em ${B} × ${doAnt.length} em ${A})`
      : `${A} completo (${doAnt.length} meses) × ${B} até ${MESES[ultimoMes - 1]} (${doAtu.length} meses)`;

  // ─── KPIs ───────────────────────────────────────────────────────────
  const tot = (ms: Mes[]) => {
    const comissao = soma(ms, (m) => m.comissao);
    const faturamento = soma(ms, (m) => m.faturamento);
    return {
      comissao,
      liquida: soma(ms, (m) => m.liquida),
      faturamento,
      pct: faturamento ? comissao / faturamento : 0,
      drops: soma(ms, (m) => m.drops),
      media: ms.length ? comissao / ms.length : 0,
    };
  };
  const tA = tot(doAnt);
  const tB = tot(doAtu);

  // ─── Série mensal (Jan–Dez, com buracos) ───────────────────────────
  const porMes = (ms: Mes[], m: number) => ms.find((x) => x.mes === m);
  const serie = MESES.map((nome, i) => {
    const a = porMes(doAntTodos, i + 1);
    const b = porMes(doAtu, i + 1);
    return {
      nome,
      mes: i + 1,
      a,
      b,
      comA: a?.comissao ?? null,
      comB: b?.comissao ?? null,
      fatA: a?.faturamento ?? null,
      fatB: b?.faturamento ?? null,
      pctA: a && a.faturamento ? a.comissao / a.faturamento : null,
      pctB: b && b.faturamento ? b.comissao / b.faturamento : null,
    };
  });
  let acA = 0;
  let acB = 0;
  const acumulado = serie.map((s) => {
    acA += s.comA ?? 0;
    acB += s.comB ?? 0;
    return { nome: s.nome, acA: s.comA != null ? acA : null, acB: s.comB != null ? acB : null };
  });

  // ─── Fontes ────────────────────────────────────────────────────────
  const fontes = FONTES.map((f) => {
    const ant = soma(doAnt, (m) => m.fontes[f.key]);
    const atu = soma(doAtu, (m) => m.fontes[f.key]);
    return { ...f, ant, atu, delta: atu - ant };
  }).filter((f) => f.ant !== 0 || f.atu !== 0);
  const totFontesA = fontes.reduce((s, f) => s + f.ant, 0);
  const totFontesB = fontes.reduce((s, f) => s + f.atu, 0);

  // ─── Dimensões ─────────────────────────────────────────────────────
  const metaLinhas = (e: PreserExtratoCompleto): [string, number][] =>
    e.metas.map((m) => [`${m.bu ?? "—"}|${m.tipo ?? "—"}`, m.comissao ?? 0]);
  const metas = comparar(agrupar(doAnt, metaLinhas), agrupar(doAtu, metaLinhas));
  const metasPorTipo = (["VBC", "Cobertura", "Recomendador"] as const).map((t) => ({
    tipo: t,
    ant: metas.filter((r) => r.k.endsWith(`|${t}`)).reduce((s, r) => s + r.ant, 0),
    atu: metas.filter((r) => r.k.endsWith(`|${t}`)).reduce((s, r) => s + r.atu, 0),
  }));

  const divLinhas = (e: PreserExtratoCompleto): [string, number][] =>
    e.skus.map((s) => [normalizarDivisao(s.divisao), s.comissao ?? 0]);
  const divisoes = comparar(agrupar(doAnt, divLinhas), agrupar(doAtu, divLinhas));
  const catLinhas = (e: PreserExtratoCompleto): [string, number][] =>
    e.skus.map((s) => [
      s.categoria_nome ?? CATEGORIA_NOMES[s.categoria as PreserCategoriaCodigo] ?? String(s.categoria),
      s.comissao ?? 0,
    ]);
  const categorias = comparar(agrupar(doAnt, catLinhas), agrupar(doAtu, catLinhas));
  const effLinhas = (e: PreserExtratoCompleto): [string, number][] =>
    e.skus.map((s) => [normalizarDivisao(s.divisao), s.efetivo_total ?? 0]);
  const efetivoDiv = { ant: agrupar(doAnt, effLinhas), atu: agrupar(doAtu, effLinhas) };

  const canalQtd = (e: PreserExtratoCompleto): [string, number][] =>
    e.drops.map((x) => [x.canal_nome, x.qtd_drops ?? 0]);
  const canalCom = (e: PreserExtratoCompleto): [string, number][] =>
    e.drops.map((x) => [x.canal_nome, x.comissao ?? 0]);
  const canais = comparar(agrupar(doAnt, canalQtd), agrupar(doAtu, canalQtd));
  const canaisCom = { ant: agrupar(doAnt, canalCom), atu: agrupar(doAtu, canalCom) };

  const atualizadoEm = todos.reduce((mx, e) => (e.extrato.created_at > mx ? e.extrato.created_at : mx), "");
  const periodos = todos.map((e) => e.extrato.periodo.slice(0, 7)).sort();
  const lbl = (p: string) => `${MESES[parseInt(p.slice(5, 7), 10) - 1]}/${p.slice(0, 4)}`;

  const tick = { fontSize: 11, fill: C_TINTA };
  const brlCurto = (v: number) => fmtBRL(v, { compact: true }).replace("R$", "").trim();

  return (
    <>
      <PageHeader
        title={`PRESER · ${A} × ${B}`}
        subtitle={
          <>
            {recorte}. Cada mês = mês do PRESER (apuração); faturamento de 20 a 19 e bônus de metas referente
            ao mês anterior.
          </>
        }
        actions={
          <div className="flex rounded-lg border border-border bg-card p-0.5 text-xs font-medium">
            {(
              [
                ["periodo", "Mesmo período"],
                ["completo", `${A} completo`],
              ] as const
            ).map(([k, t]) => (
              <button
                key={k}
                onClick={() => setBase(k)}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  base === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi rotulo="Comissão bruta" A={A} B={B} ant={tA.comissao} atu={tB.comissao} fmt={(v) => fmtBRL(v)} />
        <Kpi rotulo="Comissão líquida" A={A} B={B} ant={tA.liquida} atu={tB.liquida} fmt={(v) => fmtBRL(v)} />
        <Kpi rotulo="Faturamento AC" A={A} B={B} ant={tA.faturamento} atu={tB.faturamento} fmt={(v) => fmtBRL(v)} />
        <Kpi
          rotulo="Comissão ÷ faturamento"
          A={A}
          B={B}
          ant={tA.pct}
          atu={tB.pct}
          fmt={(v) => fmtPct(v, 2)}
          pontos
        />
        <Kpi rotulo="Média mensal" A={A} B={B} ant={tA.media} atu={tB.media} fmt={(v) => fmtBRL(v)} />
      </div>

      {/* ── Comissão mensal + acumulado ─────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comissão bruta por mês</CardTitle>
            <CardDescription>
              {A} × {B}, mês a mês do PRESER
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} barGap={2} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={brlCurto} width={52} />
                <Tooltip content={<Dica fmt={(v) => fmtBRL(v)} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="comA" name={A} fill={C_ANT} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="comB" name={B} fill={C_ATU} radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comissão acumulada no ano</CardTitle>
            <CardDescription>
              Em {MESES[ultimoMes - 1]}: {B} {fmtBRL(acumulado[ultimoMes - 1].acB ?? 0, { compact: true })} ×{" "}
              {A} {fmtBRL(acumulado[ultimoMes - 1].acA ?? 0, { compact: true })}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={acumulado} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={brlCurto} width={52} />
                <Tooltip content={<Dica fmt={(v) => fmtBRL(v)} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="acA" name={A} stroke={C_ANT} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                <Line dataKey="acB" name={B} stroke={C_ATU} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Faturamento + % ─────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faturamento AC por mês</CardTitle>
            <CardDescription>Vendas para a Nestlé no período fiscal (20 a 19)</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} barGap={2} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={brlCurto} width={52} />
                <Tooltip content={<Dica fmt={(v) => fmtBRL(v)} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="fatA" name={A} fill={C_ANT} radius={[3, 3, 0, 0]} maxBarSize={22} />
                <Bar dataKey="fatB" name={B} fill={C_ATU} radius={[3, 3, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comissão ÷ faturamento</CardTitle>
            <CardDescription>Quanto do faturamento volta como comissão, por mês</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={tick} axisLine={false} tickLine={false} />
                <YAxis
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => fmtPct(v, 1)}
                  width={48}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<Dica fmt={(v) => fmtPct(v, 2)} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line dataKey="pctA" name={A} stroke={C_ANT} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line dataKey="pctB" name={B} stroke={C_ATU} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabela mês a mês ───────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Mês a mês</CardTitle>
          <CardDescription>Comissão bruta, faturamento e taxa de comissão de cada PRESER</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="tabular-nums">
            <THead>
              <Tr>
                <Th>Mês</Th>
                <Th className="text-right">Comissão {A}</Th>
                <Th className="text-right">Comissão {B}</Th>
                <Th className="text-right">Δ R$</Th>
                <Th className="text-right">Δ %</Th>
                <Th className="text-right">Fat. {A}</Th>
                <Th className="text-right">Fat. {B}</Th>
                <Th className="text-right">Δ %</Th>
                <Th className="text-right">Taxa {A}</Th>
                <Th className="text-right">Taxa {B}</Th>
              </Tr>
            </THead>
            <TBody>
              {serie
                .filter((s) => s.a || s.b)
                .map((s) => (
                  <Tr key={s.mes} className={cn(!s.b && "text-muted-foreground")}>
                    <Td className="font-medium">{s.nome}</Td>
                    <Td className="text-right">{fmtBRL(s.comA)}</Td>
                    <Td className="text-right font-semibold">{fmtBRL(s.comB)}</Td>
                    <DeltaCells ant={s.comA} atu={s.comB} />
                    <Td className="text-right">{fmtBRL(s.fatA)}</Td>
                    <Td className="text-right">{fmtBRL(s.fatB)}</Td>
                    <Td className="text-right">
                      <Pill v={s.fatA != null && s.fatB != null ? varPct(s.fatA, s.fatB) : null} />
                    </Td>
                    <Td className="text-right">{fmtPct(s.pctA, 2)}</Td>
                    <Td className="text-right">{fmtPct(s.pctB, 2)}</Td>
                  </Tr>
                ))}
              <Tr className="bg-secondary/60 font-semibold hover:bg-secondary/60">
                <Td>Total ({base === "periodo" ? "mesmo período" : "como exibido"})</Td>
                <Td className="text-right">{fmtBRL(tA.comissao)}</Td>
                <Td className="text-right">{fmtBRL(tB.comissao)}</Td>
                <DeltaCells ant={tA.comissao} atu={tB.comissao} />
                <Td className="text-right">{fmtBRL(tA.faturamento)}</Td>
                <Td className="text-right">{fmtBRL(tB.faturamento)}</Td>
                <Td className="text-right">
                  <Pill v={varPct(tA.faturamento, tB.faturamento)} />
                </Td>
                <Td className="text-right">{fmtPct(tA.pct, 2)}</Td>
                <Td className="text-right">{fmtPct(tB.pct, 2)}</Td>
              </Tr>
            </TBody>
          </Table>
          {base === "periodo" && (
            <p className="px-5 py-3 text-[11px] text-muted-foreground">
              Meses de {A} sem par em {B} aparecem em cinza e ficam fora do total.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Fontes da comissão ─────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">O que mudou em cada fonte</CardTitle>
            <CardDescription>
              Variação em R$ de {B} contra {A}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={fontes} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={brlCurto} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <ReferenceLine x={0} stroke={C_TINTA} />
                <Tooltip content={<Dica fmt={(v) => fmtBRL(v)} />} />
                <Bar dataKey="delta" name="Variação" radius={3} maxBarSize={20}>
                  {fontes.map((f) => (
                    <Cell key={f.key} fill={f.delta >= 0 ? C_BOM : C_RISCO} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">De onde vem a comissão</CardTitle>
            <CardDescription>Soma das linhas do extrato por natureza, com participação no total</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="tabular-nums">
              <THead>
                <Tr>
                  <Th>Fonte</Th>
                  <Th className="text-right">{A}</Th>
                  <Th className="text-right">{B}</Th>
                  <Th className="text-right">Δ R$</Th>
                  <Th className="text-right">Δ %</Th>
                  <Th className="text-right">Part. {A}</Th>
                  <Th className="text-right">Part. {B}</Th>
                </Tr>
              </THead>
              <TBody>
                {fontes.map((f) => (
                  <Tr key={f.key}>
                    <Td>
                      <div className="font-medium">{f.nome}</div>
                      <div className="text-[11px] text-muted-foreground">{f.desc}</div>
                    </Td>
                    <Td className="text-right">{fmtBRL(f.ant)}</Td>
                    <Td className="text-right font-semibold">{fmtBRL(f.atu)}</Td>
                    <DeltaCells ant={f.ant} atu={f.atu} />
                    <Td className="text-right">{fmtPct(totFontesA ? f.ant / totFontesA : null)}</Td>
                    <Td className="text-right">{fmtPct(totFontesB ? f.atu / totFontesB : null)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Bônus de metas ─────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Bônus de metas por tipo</CardTitle>
            <CardDescription>Pago no PRESER sobre as metas do mês anterior</CardDescription>
          </CardHeader>
          <CardContent className="h-72 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metasPorTipo} barGap={4} margin={{ left: 0, right: 8, top: 4 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="tipo" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tick={tick} axisLine={false} tickLine={false} tickFormatter={brlCurto} width={52} />
                <Tooltip content={<Dica fmt={(v) => fmtBRL(v)} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ant" name={A} fill={C_ANT} radius={[3, 3, 0, 0]} maxBarSize={36} />
                <Bar dataKey="atu" name={B} fill={C_ATU} radius={[3, 3, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Bônus de metas por BU</CardTitle>
            <CardDescription>VBC, Cobertura e Recomendador de cada unidade de negócio</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TabelaComparada
              A={A}
              B={B}
              rotulo="BU · tipo"
              linhas={metas.map((r) => ({ ...r, k: r.k.replace("|", " · ") }))}
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Vendas (SKUs) ──────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comissão de vendas por divisão</CardTitle>
            <CardDescription>Inclui o volume efetivo faturado (base da comissão)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="tabular-nums">
              <THead>
                <Tr>
                  <Th>Divisão</Th>
                  <Th className="text-right">Efetivo {A}</Th>
                  <Th className="text-right">Efetivo {B}</Th>
                  <Th className="text-right">Comissão {A}</Th>
                  <Th className="text-right">Comissão {B}</Th>
                  <Th className="text-right">Δ %</Th>
                </Tr>
              </THead>
              <TBody>
                {divisoes.map((r) => (
                  <Tr key={r.k}>
                    <Td className="font-medium">{r.k}</Td>
                    <Td className="text-right">{fmtBRL(efetivoDiv.ant.get(r.k) ?? 0, { compact: true })}</Td>
                    <Td className="text-right">{fmtBRL(efetivoDiv.atu.get(r.k) ?? 0, { compact: true })}</Td>
                    <Td className="text-right">{fmtBRL(r.ant)}</Td>
                    <Td className="text-right font-semibold">{fmtBRL(r.atu)}</Td>
                    <Td className="text-right">
                      <Pill v={varPct(r.ant, r.atu)} />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comissão de vendas por categoria</CardTitle>
            <CardDescription>Mix Pilar, High Pull, High High Pull e Estratégico</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TabelaComparada A={A} B={B} rotulo="Categoria" linhas={categorias} />
          </CardContent>
        </Card>
      </div>

      {/* ── Drops por canal ────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Drops por canal</CardTitle>
          <CardDescription>
            Entregas e comissão de drops. Total: {fmtNum(tA.drops)} em {A} × {fmtNum(tB.drops)} em {B}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="tabular-nums">
            <THead>
              <Tr>
                <Th>Canal</Th>
                <Th className="text-right">Drops {A}</Th>
                <Th className="text-right">Drops {B}</Th>
                <Th className="text-right">Δ %</Th>
                <Th className="text-right">Comissão {A}</Th>
                <Th className="text-right">Comissão {B}</Th>
                <Th className="text-right">Δ %</Th>
              </Tr>
            </THead>
            <TBody>
              {canais.map((r) => {
                const ca = canaisCom.ant.get(r.k) ?? 0;
                const cb = canaisCom.atu.get(r.k) ?? 0;
                return (
                  <Tr key={r.k}>
                    <Td className="font-medium">{r.k}</Td>
                    <Td className="text-right">{fmtNum(r.ant)}</Td>
                    <Td className="text-right font-semibold">{fmtNum(r.atu)}</Td>
                    <Td className="text-right">
                      <Pill v={varPct(r.ant, r.atu)} />
                    </Td>
                    <Td className="text-right">{fmtBRL(ca)}</Td>
                    <Td className="text-right font-semibold">{fmtBRL(cb)}</Td>
                    <Td className="text-right">
                      <Pill v={varPct(ca, cb)} />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Origem dos dados ───────────────────────────────────────── */}
      <div className="mb-2 flex items-start gap-2.5 rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <Database className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <span className="font-semibold text-foreground">Origem dos dados:</span> extratos PRESER importados neste
          computador (banco local do navegador) · {todos.length} meses, de {lbl(periodos[0])} a{" "}
          {lbl(periodos[periodos.length - 1])} · última importação em{" "}
          {atualizadoEm ? new Date(atualizadoEm).toLocaleString("pt-BR") : "—"}. Purina excluída (broker não opera).
        </p>
      </div>
    </>
  );
}

// ─── Componentes ──────────────────────────────────────────────────────────

function normalizarDivisao(d: string | null): string {
  if (!d) return "Sem divisão";
  const t = d.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function Kpi({
  rotulo,
  A,
  B,
  ant,
  atu,
  fmt,
  pontos,
}: {
  rotulo: string;
  A: string;
  B: string;
  ant: number;
  atu: number;
  fmt: (v: number) => string;
  /** variação em pontos percentuais em vez de % */
  pontos?: boolean;
}) {
  const v = varPct(ant, atu);
  const pp = (atu - ant) * 100;
  const positivo = pontos ? pp >= 0 : (v ?? 0) >= 0;
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{rotulo}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{fmt(atu)}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {B} · em {A}: {fmt(ant)}
        </p>
        <span
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
            positivo ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}
        >
          {positivo ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {pontos
            ? `${pp >= 0 ? "+" : ""}${pp.toFixed(2).replace(".", ",")} p.p.`
            : `${(v ?? 0) >= 0 ? "+" : ""}${fmtPct(v)}`}
        </span>
      </CardContent>
    </Card>
  );
}

function Pill({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
        v >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
      )}
    >
      {v >= 0 ? "+" : ""}
      {fmtPct(v)}
    </span>
  );
}

function DeltaCells({ ant, atu }: { ant: number | null; atu: number | null }) {
  if (ant == null || atu == null) {
    return (
      <>
        <Td className="text-right text-muted-foreground">—</Td>
        <Td className="text-right text-muted-foreground">—</Td>
      </>
    );
  }
  const d = atu - ant;
  return (
    <>
      <Td className={cn("text-right font-medium", d >= 0 ? "text-success" : "text-destructive")}>
        {d >= 0 ? "+" : ""}
        {fmtBRL(d)}
      </Td>
      <Td className="text-right">
        <Pill v={varPct(ant, atu)} />
      </Td>
    </>
  );
}

function TabelaComparada({
  A,
  B,
  rotulo,
  linhas,
}: {
  A: string;
  B: string;
  rotulo: string;
  linhas: { k: string; ant: number; atu: number }[];
}) {
  const tA = linhas.reduce((s, r) => s + r.ant, 0);
  const tB = linhas.reduce((s, r) => s + r.atu, 0);
  return (
    <Table className="tabular-nums">
      <THead>
        <Tr>
          <Th>{rotulo}</Th>
          <Th className="text-right">{A}</Th>
          <Th className="text-right">{B}</Th>
          <Th className="text-right">Δ R$</Th>
          <Th className="text-right">Δ %</Th>
        </Tr>
      </THead>
      <TBody>
        {linhas.map((r) => (
          <Tr key={r.k}>
            <Td className="font-medium">{r.k}</Td>
            <Td className="text-right">{fmtBRL(r.ant)}</Td>
            <Td className="text-right font-semibold">{fmtBRL(r.atu)}</Td>
            <DeltaCells ant={r.ant} atu={r.atu} />
          </Tr>
        ))}
        <Tr className="bg-secondary/60 font-semibold hover:bg-secondary/60">
          <Td>Total</Td>
          <Td className="text-right">{fmtBRL(tA)}</Td>
          <Td className="text-right">{fmtBRL(tB)}</Td>
          <DeltaCells ant={tA} atu={tB} />
        </Tr>
      </TBody>
    </Table>
  );
}

function Dica({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: { name: string; value: number | null; color?: string; fill?: string }[];
  label?: string;
  fmt: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-card">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 tabular-nums">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium text-foreground">{p.value == null ? "—" : fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}
