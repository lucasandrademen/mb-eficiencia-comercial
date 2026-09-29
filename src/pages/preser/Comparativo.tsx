import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Equal, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { usePreserData } from "@/contexts/PreserDataContext";
import { listExtratosCompletos } from "@/lib/preser/api";
import { cicloPreser } from "@/lib/preser/ciclo";
import { FONTES, fonteDoOutro, somarFontes, type FonteKey } from "@/lib/preser/fontes";
import { grupoCanonico, nomesAntigos } from "@/lib/preser/renomeados";
import {
  CATEGORIA_NOMES,
  type PreserCategoriaCodigo,
  type PreserExtratoCompleto,
  type PreserMeta,
} from "@/lib/preser/types";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

// Padrão MB (variante App)
const C_BASE = "#5FB0CE";
const C_COMP = "#016690";
const C_BOM = "#1F9D6B";
const C_RISCO = "#D64545";
const C_GRADE = "#DCE6F2";
const C_TINTA = "#5B7299";

const NOME_FONTE = Object.fromEntries(FONTES.map((f) => [f.key, f.nome])) as Record<FonteKey, string>;

/**
 * Um item comparável do extrato (linha de SKU, canal de drop, meta ou critério),
 * somado por chave nos dois meses.
 */
interface Item {
  key: string;
  fonte: FonteKey;
  nome: string;
  detalhe: string;
  a: number;
  b: number;
  delta: number;
  motivo: string;
  /** false = linha fora do total do extrato (ex.: Entrega NiM via CT-e) */
  noTotal: boolean;
}

// ─── Motivos ──────────────────────────────────────────────────────────────

const pctTxt = (v: number) => fmtPct(v, 1);
const brlC = (v: number) => fmtBRL(v, { compact: true });
function variacao(a: number, b: number) {
  if (!a) return b ? "novo" : "";
  const p = (b - a) / Math.abs(a);
  return `${p >= 0 ? "+" : ""}${fmtPct(p)}`;
}

function faixaMeta(m: PreserMeta | undefined): { txt: string; pct: number | null } {
  if (!m) return { txt: "sem meta", pct: null };
  const ef = m.efetivo_fiscal ?? 0;
  if (m.tipo === "Recomendador") return { txt: pctTxt(ef), pct: ef };
  const meta = m.objetivo_meta ?? 0;
  const pct = meta > 0 ? ef / meta : null;
  // Faixa pela taxa paga no extrato (0,35% mínimo · 0,50% meta · 0,65% ideal)
  const taxa = m.pct_atingido ?? 0;
  const faixa = !taxa || !(m.comissao ?? 0) ? "não pagou" : `taxa ${fmtPct(taxa, 2)}`;
  return { txt: `${pct != null ? pctTxt(pct) : "—"} da meta (${faixa})`, pct };
}

// ─── Montagem dos itens ───────────────────────────────────────────────────

type Linha = { key: string; fonte: FonteKey; nome: string; detalhe: string; noTotal: boolean; com: number };

function montarItens(A: PreserExtratoCompleto, B: PreserExtratoCompleto): Item[] {
  const itens: Item[] = [];

  // Soma linhas por chave e compara
  const cruzar = <T,>(
    rsA: T[],
    rsB: T[],
    linha: (r: T) => Linha,
    motivo: (a: T[], b: T[]) => string,
  ) => {
    const grupos = new Map<string, { l: Linha; a: T[]; b: T[] }>();
    for (const [lado, rs] of [
      ["a", rsA],
      ["b", rsB],
    ] as const) {
      for (const r of rs) {
        const l = linha(r);
        const g = grupos.get(l.key) ?? { l, a: [], b: [] };
        g[lado].push(r);
        grupos.set(l.key, g);
      }
    }
    for (const { l, a, b } of grupos.values()) {
      const va = a.reduce((s, r) => s + linha(r).com, 0);
      const vb = b.reduce((s, r) => s + linha(r).com, 0);
      if (Math.abs(vb - va) < 0.005 && va === 0) continue;
      itens.push({
        key: l.key,
        fonte: l.fonte,
        nome: l.nome,
        detalhe: l.detalhe,
        a: va,
        b: vb,
        delta: vb - va,
        motivo: va > 0 && vb === 0 && b.length ? `Zerou · ${motivo(a, b)}` : motivo(a, b),
        noTotal: l.noTotal,
      });
    }
  };

  // Vendas (SKU): efeito volume × efeito taxa
  cruzar(
    A.skus,
    B.skus,
    (s) => {
      // grupos renomeados pela Nestlé somam no nome atual (ex.: Nescafé 40G → Nescafé Sachet)
      const nome = grupoCanonico(s.grupo_nome);
      const antigos = nomesAntigos(nome);
      const cat = s.categoria_nome ?? CATEGORIA_NOMES[s.categoria as PreserCategoriaCodigo] ?? s.categoria;
      return {
      // chave só pelo nome: o grupo renomeado pode ter mudado de categoria (ex.: Estratégico → Mix Pilar)
      key: `sku|${nome}`,
      fonte: "vendas",
      nome,
      detalhe: antigos.length
        ? `${s.divisao ?? "—"} · inclui ${antigos.join(", ")} (nome anterior)`
        : `${s.divisao ?? "—"} · ${cat}`,
      noTotal: true,
      com: s.comissao ?? 0,
      };
    },
    (a, b) => {
      const efA = a.reduce((s, r) => s + (r.efetivo_total ?? 0), 0);
      const efB = b.reduce((s, r) => s + (r.efetivo_total ?? 0), 0);
      const pA = a[0]?.pct_comissao ?? null;
      const pB = b[0]?.pct_comissao ?? null;
      let t = `Efetivo ${brlC(efA)} → ${brlC(efB)} (${variacao(efA, efB)})`;
      if (pA != null && pB != null && Math.abs(pA - pB) > 1e-6) t += ` · taxa ${fmtPct(pA, 2)} → ${fmtPct(pB, 2)}`;
      return t;
    },
  );

  // Drops: quantidade × R$/drop
  cruzar(
    A.drops,
    B.drops,
    (d) => ({
      key: `drop|${d.canal_nome}`,
      fonte: "drops",
      nome: d.canal_nome,
      detalhe: "Drops (Crit. 20)",
      noTotal: true,
      com: d.comissao ?? 0,
    }),
    (a, b) => {
      const qA = a.reduce((s, r) => s + (r.qtd_drops ?? 0), 0);
      const qB = b.reduce((s, r) => s + (r.qtd_drops ?? 0), 0);
      const rA = a[0]?.rs_calculado ?? a[0]?.rs_por_drop ?? 0;
      const rB = b[0]?.rs_calculado ?? b[0]?.rs_por_drop ?? 0;
      const dq = qB - qA;
      let t = `${fmtNum(qA)} → ${fmtNum(qB)} drops (${dq >= 0 ? "+" : ""}${fmtNum(dq)})`;
      if (Math.abs(rA - rB) > 0.005) t += ` · R$/drop ${fmtBRL(rA)} → ${fmtBRL(rB)}`;
      else if (rB) t += ` × ${fmtNum(rB, 2)} R$/drop`;
      return t;
    },
  );

  // Bônus de metas: atingimento e faixa
  cruzar(
    A.metas,
    B.metas,
    (m) => ({
      key: `meta|${m.criterio_codigo}|${m.bu}|${m.tipo}`,
      fonte: "metas",
      nome: `${m.bu ?? "—"} · ${m.tipo ?? "—"}`,
      detalhe: m.criterio_nome ?? "",
      noTotal: true,
      com: m.comissao ?? 0,
    }),
    (a, b) => {
      const fa = faixaMeta(a[0]);
      const fb = faixaMeta(b[0]);
      let t = `Atingimento ${fa.txt} → ${fb.txt}`;
      const m = b[0] ?? a[0];
      if (m && m.tipo !== "Recomendador") {
        const eA = a[0]?.efetivo_fiscal ?? 0;
        const eB = b[0]?.efetivo_fiscal ?? 0;
        const f = (v: number) => (m.tipo === "VBC" ? brlC(v) : fmtNum(v));
        t += ` · efetivo ${f(eA)} → ${f(eB)} (${variacao(eA, eB)})`;
      }
      return t;
    },
  );

  // Demais critérios: base de cálculo × R$ unitário
  cruzar(
    A.outros,
    B.outros,
    (o) => ({
      key: `out|${o.criterio_codigo}|${o.bu ?? ""}|${o.contabilizado === false ? "nc" : "c"}`,
      fonte: fonteDoOutro(o.criterio_codigo),
      nome: `${o.criterio_codigo ?? ""} · ${o.criterio_nome ?? "—"}`,
      detalhe: [o.bu, o.tipo_servico].filter(Boolean).join(" · "),
      noTotal: o.contabilizado !== false,
      com: o.comissao ?? 0,
    }),
    (a, b) => {
      if (!a.length) return `Não veio no PRESER base`;
      if (!b.length) return `Não veio no PRESER comparado`;
      const ra = a[0];
      const rb = b[0];
      const un = rb.base_unidade ?? ra.base_unidade;
      const bA = a.reduce((s, r) => s + (r.base_calculo ?? 0), 0);
      const bB = b.reduce((s, r) => s + (r.base_calculo ?? 0), 0);
      if (!un || (ra.base_calculo == null && rb.base_calculo == null)) {
        const obs = rb.observacao && rb.observacao !== ra.observacao ? rb.observacao : "";
        return obs ? `Obs.: ${obs.slice(0, 90)}` : "Valor lançado pela Nestlé (sem base no extrato)";
      }
      const v = variacao(bA, bB);
      if (un === "R$") {
        const t = `Faturamento ${brlC(bA)} → ${brlC(bB)} (${v})`;
        const pa = ra.rs_unitario;
        const pb = rb.rs_unitario;
        return pb != null && pa != null && Math.abs(pa - pb) > 1e-7
          ? `${t} · taxa ${fmtPct(pa, 3)} → ${fmtPct(pb, 3)}`
          : `${t} × ${fmtPct(pb ?? pa, 3)}`;
      }
      if (un === "kg") {
        const t = `Peso ${fmtNum(bA / 1000, 1)} t → ${fmtNum(bB / 1000, 1)} t (${v})`;
        const pa = ra.rs_unitario ?? 0;
        const pb = rb.rs_unitario ?? 0;
        return Math.abs(pa - pb) > 1e-4 ? `${t} · R$/kg ${fmtNum(pa, 3)} → ${fmtNum(pb, 3)}` : `${t} × R$ ${fmtNum(pb, 3)}/kg`;
      }
      const porUn = (com: number, base: number) => (base ? com / base : 0);
      const cA = a.reduce((s, r) => s + (r.comissao ?? 0), 0);
      const cB = b.reduce((s, r) => s + (r.comissao ?? 0), 0);
      const d = bB - bA;
      let t = `${fmtNum(bA)} → ${fmtNum(bB)} ${un} (${d >= 0 ? "+" : ""}${fmtNum(d)})`;
      if (un === "pallets" && bA && bB) t += ` · ${fmtBRL(porUn(cA, bA))} → ${fmtBRL(porUn(cB, bB))} por pallet`;
      if (un === "visitas") {
        const obj = (x: typeof rb) => x.observacao?.match(/Objetivo (\d+)/)?.[1];
        if (obj(ra) || obj(rb)) t += ` · objetivo ${obj(ra) ?? "—"} → ${obj(rb) ?? "—"}`;
      }
      return t;
    },
  );

  return itens;
}

// ─── Página ───────────────────────────────────────────────────────────────

export default function PreserComparativo() {
  const { extratos, selectedId } = usePreserData();
  const [params, setParams] = useSearchParams();
  const [todos, setTodos] = useState<PreserExtratoCompleto[] | null>(null);

  useEffect(() => {
    listExtratosCompletos().then(setTodos).catch(() => setTodos([]));
  }, [extratos]);

  // períodos "YYYY-MM" disponíveis, do mais recente para o mais antigo
  const periodos = useMemo(
    () => (todos ?? []).map((e) => e.extrato.periodo.slice(0, 7)).sort().reverse(),
    [todos],
  );

  // Padrão: mês selecionado no PRESER (ou o mais recente) × o mês anterior importado
  const padraoB =
    extratos.find((e) => e.id === selectedId)?.periodo.slice(0, 7) ?? periodos[0] ?? "";
  const b = params.get("b") && periodos.includes(params.get("b")!) ? params.get("b")! : padraoB;
  const padraoA = periodos[periodos.indexOf(b) + 1] ?? "";
  const a = params.get("a") && periodos.includes(params.get("a")!) ? params.get("a")! : padraoA;

  const setAB = (na: string, nb: string) => setParams({ a: na, b: nb }, { replace: true });

  if (todos === null) {
    return (
      <>
        <PageHeader title="Comparativo Mensal" subtitle="Carregando…" />
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Lendo extratos…
        </div>
      </>
    );
  }

  if (periodos.length < 2) {
    return (
      <>
        <PageHeader title="Comparativo Mensal" subtitle="Compara dois meses do PRESER, item a item." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Equal className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Importe pelo menos 2 meses para comparar</p>
          </CardContent>
        </Card>
      </>
    );
  }

  const exA = todos.find((e) => e.extrato.periodo.startsWith(a));
  const exB = todos.find((e) => e.extrato.periodo.startsWith(b));
  const anoPassado = `${parseInt(b.slice(0, 4), 10) - 1}${b.slice(4)}`;

  return (
    <>
      <PageHeader
        title="Comparativo Mensal"
        subtitle="Compare quaisquer dois meses do PRESER e veja, item a item, onde perdeu e onde ganhou."
      />

      {/* ── Filtro ─────────────────────────────────────────────────── */}
      <Card className="mb-5">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <MesSelect rotulo="Mês base" valor={a} periodos={periodos} onChange={(v) => setAB(v, b)} cor={C_BASE} />
          <button
            onClick={() => setAB(b, a)}
            title="Inverter"
            className="mb-0.5 rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <MesSelect
            rotulo="Comparar com"
            valor={b}
            periodos={periodos}
            onChange={(v) => setAB(a, v)}
            cor={C_COMP}
          />
          <div className="flex flex-wrap gap-2 pb-0.5">
            <Atalho
              ativo={a === periodos[periodos.indexOf(b) + 1]}
              disabled={!periodos[periodos.indexOf(b) + 1]}
              onClick={() => setAB(periodos[periodos.indexOf(b) + 1], b)}
            >
              vs mês anterior
            </Atalho>
            <Atalho
              ativo={a === anoPassado}
              disabled={!periodos.includes(anoPassado)}
              onClick={() => setAB(anoPassado, b)}
            >
              vs mesmo mês de {anoPassado.slice(0, 4)}
            </Atalho>
          </div>
        </CardContent>
      </Card>

      {!exA || !exB ? null : a === b ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Escolha dois meses diferentes.
          </CardContent>
        </Card>
      ) : (
        <Comparacao A={exA} B={exB} />
      )}
    </>
  );
}

function Comparacao({ A, B }: { A: PreserExtratoCompleto; B: PreserExtratoCompleto }) {
  const lA = periodoLabel(A.extrato.periodo.slice(0, 7));
  const lB = periodoLabel(B.extrato.periodo.slice(0, 7));
  const cA = cicloPreser(A.extrato.periodo);
  const cB = cicloPreser(B.extrato.periodo);

  const itens = useMemo(() => montarItens(A, B), [A, B]);
  const [fonteFiltro, setFonteFiltro] = useState<FonteKey | "all">("all");
  const [busca, setBusca] = useState("");
  const [verTodasPerdas, setVerTodasPerdas] = useState(false);
  const [verTodosGanhos, setVerTodosGanhos] = useState(false);

  const totA = A.extrato.valor_total_comissao ?? 0;
  const totB = B.extrato.valor_total_comissao ?? 0;
  const delta = totB - totA;

  const noTotal = itens.filter((i) => i.noTotal);
  const foraTotal = itens.filter((i) => !i.noTotal && Math.abs(i.delta) >= 0.5);
  const perdasTot = noTotal.filter((i) => i.delta < 0).reduce((s, i) => s + i.delta, 0);
  const ganhosTot = noTotal.filter((i) => i.delta > 0).reduce((s, i) => s + i.delta, 0);

  const filtra = (i: Item) =>
    (fonteFiltro === "all" || i.fonte === fonteFiltro) &&
    (!busca || `${i.nome} ${i.detalhe}`.toLowerCase().includes(busca.toLowerCase()));
  const perdas = noTotal.filter((i) => i.delta <= -0.5 && filtra(i)).sort((x, y) => x.delta - y.delta);
  const ganhos = noTotal.filter((i) => i.delta >= 0.5 && filtra(i)).sort((x, y) => y.delta - x.delta);

  // ── por fonte (só o que entra no total → fecha com o total do extrato)
  const fA = somarFontes(A, { soContabilizado: true });
  const fB = somarFontes(B, { soContabilizado: true });
  const porFonte = FONTES.map((f) => {
    const its = noTotal.filter((i) => i.fonte === f.key);
    return {
      ...f,
      a: fA[f.key],
      b: fB[f.key],
      delta: fB[f.key] - fA[f.key],
      perdas: its.filter((i) => i.delta < 0).reduce((s, i) => s + i.delta, 0),
      ganhos: its.filter((i) => i.delta > 0).reduce((s, i) => s + i.delta, 0),
      nPerdas: its.filter((i) => i.delta <= -0.5).length,
    };
  }).filter((f) => f.a !== 0 || f.b !== 0);

  // ── ponte (waterfall): total A → variação de cada fonte → total B
  let corrente = totA;
  const ponte = [
    { nome: lA.replace("/20", "/"), base: 0, valor: totA, tipo: "total" as const, delta: totA },
    ...porFonte
      .filter((f) => Math.abs(f.delta) >= 1)
      .map((f) => {
        const base = f.delta >= 0 ? corrente : corrente + f.delta;
        corrente += f.delta;
        return { nome: f.nome, base, valor: Math.abs(f.delta), tipo: f.delta >= 0 ? ("ganho" as const) : ("perda" as const), delta: f.delta };
      }),
    { nome: lB.replace("/20", "/"), base: 0, valor: totB, tipo: "total" as const, delta: totB },
  ];
  const vals = ponte.flatMap((p) => (p.tipo === "total" ? [p.valor] : [p.base, p.base + p.valor]));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const folga = (hi - lo) * 0.25 || hi * 0.05;

  const tick = { fontSize: 11, fill: C_TINTA };

  return (
    <>
      {/* ── Resumo ─────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ResumoCard titulo={`PRESER ${lA}`} valor={fmtBRL(totA)} sub={`Metas de ${cA.mesMetas} · fat. ${cA.fiscalInicio.slice(0, 5)}–${cA.fiscalFim.slice(0, 5)}`} cor={C_BASE} />
        <ResumoCard titulo={`PRESER ${lB}`} valor={fmtBRL(totB)} sub={`Metas de ${cB.mesMetas} · fat. ${cB.fiscalInicio.slice(0, 5)}–${cB.fiscalFim.slice(0, 5)}`} cor={C_COMP} />
        <ResumoCard
          titulo="Resultado"
          valor={`${delta >= 0 ? "+" : ""}${fmtBRL(delta)}`}
          sub={`${delta >= 0 ? "+" : ""}${fmtPct(totA ? delta / totA : 0)} na comissão`}
          tom={delta >= 0 ? "bom" : "risco"}
        />
        <Card>
          <CardContent className="p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Perdas × ganhos</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-destructive">{fmtBRL(perdasTot)}</p>
            <p className="text-lg font-bold tabular-nums text-success">+{fmtBRL(ganhosTot)}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {perdas.length} itens caíram · {ganhos.length} subiram
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Ponte + por fonte ──────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 2xl:grid-cols-5">
        <Card className="2xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">
              De {lA} para {lB}: o que mudou em cada fonte
            </CardTitle>
            <CardDescription>
              Começa no total de {lA}, soma o que subiu (verde), tira o que caiu (vermelho) e chega em {lB}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-80 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ponte} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={tick} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={56} />
                <YAxis
                  tick={tick}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                  domain={[Math.max(0, lo - folga), hi + folga * 0.4]}
                  allowDataOverflow
                  tickFormatter={(v) => brlC(v).replace("R$", "").trim()}
                />
                <Tooltip
                  cursor={{ fill: "hsl(199 44% 94% / 0.6)" }}
                  content={({ active, payload }) => {
                    const p = active && payload?.[0]?.payload;
                    if (!p) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-card">
                        <p className="font-semibold">{p.nome}</p>
                        <p className={cn("tabular-nums", p.tipo === "perda" ? "text-destructive" : p.tipo === "ganho" ? "text-success" : "")}>
                          {p.tipo === "total" ? fmtBRL(p.valor) : `${p.delta >= 0 ? "+" : ""}${fmtBRL(p.delta)}`}
                        </p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="base" stackId="p" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="valor" stackId="p" radius={[3, 3, 0, 0]} maxBarSize={48}>
                  {ponte.map((p, i) => (
                    <Cell key={i} fill={p.tipo === "total" ? (i === 0 ? C_BASE : C_COMP) : p.tipo === "ganho" ? C_BOM : C_RISCO} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="2xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Por fonte</CardTitle>
            <CardDescription>Clique numa fonte para filtrar as listas abaixo</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="tabular-nums [&_td.text-right]:whitespace-nowrap">
              <THead>
                <Tr>
                  <Th>Fonte</Th>
                  <Th className="text-right">{lA}</Th>
                  <Th className="text-right">{lB}</Th>
                  <Th className="text-right">Δ R$</Th>
                </Tr>
              </THead>
              <TBody>
                {porFonte.map((f) => (
                  <Tr
                    key={f.key}
                    onClick={() => setFonteFiltro(fonteFiltro === f.key ? "all" : f.key)}
                    className={cn("cursor-pointer", fonteFiltro === f.key && "bg-primary/10 hover:bg-primary/10")}
                  >
                    <Td>
                      <div className="font-medium">{f.nome}</div>
                      {f.nPerdas > 0 && (
                        <div className="whitespace-nowrap text-[11px] text-destructive">
                          ↓ {f.nPerdas} {f.nPerdas === 1 ? "item" : "itens"} · {fmtBRL(f.perdas)}
                        </div>
                      )}
                    </Td>
                    <Td className="text-right">{fmtBRL(f.a)}</Td>
                    <Td className="text-right">{fmtBRL(f.b)}</Td>
                    <Td className={cn("text-right font-semibold", f.delta >= 0 ? "text-success" : "text-destructive")}>
                      {f.delta >= 0 ? "+" : ""}
                      {fmtBRL(f.delta)}
                    </Td>
                  </Tr>
                ))}
                <Tr className="bg-secondary/60 font-semibold hover:bg-secondary/60">
                  <Td>Total do extrato</Td>
                  <Td className="text-right">{fmtBRL(totA)}</Td>
                  <Td className="text-right">{fmtBRL(totB)}</Td>
                  <Td className={cn("text-right", delta >= 0 ? "text-success" : "text-destructive")}>
                    {delta >= 0 ? "+" : ""}
                    {fmtBRL(delta)}
                  </Td>
                </Tr>
              </TBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* ── Filtros das listas ─────────────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Atalho ativo={fonteFiltro === "all"} onClick={() => setFonteFiltro("all")}>
          Todas as fontes
        </Atalho>
        {porFonte.map((f) => (
          <Atalho key={f.key} ativo={fonteFiltro === f.key} onClick={() => setFonteFiltro(f.key)}>
            {f.nome}
          </Atalho>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item (ex.: KA, BRL1, Nescau)"
            className="w-64 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* ── Onde perdi ─────────────────────────────────────────────── */}
      <ListaItens
        titulo="Onde perdi"
        descricao={`Itens que pagaram menos em ${lB} do que em ${lA}, do maior para o menor prejuízo`}
        itens={perdas}
        verTodos={verTodasPerdas}
        setVerTodos={setVerTodasPerdas}
        lA={lA}
        lB={lB}
        tom="risco"
        totalRef={perdasTot}
      />

      {/* ── Onde ganhei ────────────────────────────────────────────── */}
      <ListaItens
        titulo="Onde ganhei"
        descricao={`Itens que pagaram mais em ${lB} do que em ${lA}`}
        itens={ganhos}
        verTodos={verTodosGanhos}
        setVerTodos={setVerTodosGanhos}
        lA={lA}
        lB={lB}
        tom="bom"
        totalRef={ganhosTot}
      />

      {foraTotal.length > 0 && (
        <Card className="mb-5 border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">Fora do total do extrato</CardTitle>
            <CardDescription>
              Linhas que vêm no PDF mas não entram no valor total da comissão (pagas à parte, ex.: Entrega NiM via CT-e)
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="tabular-nums [&_td.text-right]:whitespace-nowrap">
              <TBody>
                {foraTotal.map((i) => (
                  <Tr key={i.key}>
                    <Td className="font-medium">{i.nome}</Td>
                    <Td className="text-xs text-muted-foreground">{i.motivo}</Td>
                    <Td className="text-right">{fmtBRL(i.a)}</Td>
                    <Td className="text-right">{fmtBRL(i.b)}</Td>
                    <Td className={cn("text-right font-semibold", i.delta >= 0 ? "text-success" : "text-destructive")}>
                      {i.delta >= 0 ? "+" : ""}
                      {fmtBRL(i.delta)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="mb-2 text-[11px] text-muted-foreground">
        A soma de perdas e ganhos por item fecha exatamente com a diferença do valor total da comissão
        ({fmtBRL(perdasTot + ganhosTot)} = {fmtBRL(delta)}). Bônus de metas de {lA} refere-se às metas de {cA.mesMetas};
        de {lB}, às metas de {cB.mesMetas}.
      </p>
    </>
  );
}

// ─── Componentes ──────────────────────────────────────────────────────────

function ListaItens({
  titulo,
  descricao,
  itens,
  verTodos,
  setVerTodos,
  lA,
  lB,
  tom,
  totalRef,
}: {
  titulo: string;
  descricao: string;
  itens: Item[];
  verTodos: boolean;
  setVerTodos: (v: boolean) => void;
  lA: string;
  lB: string;
  tom: "bom" | "risco";
  totalRef: number;
}) {
  const LIM = 15;
  const mostrados = verTodos ? itens : itens.slice(0, LIM);
  const soma = itens.reduce((s, i) => s + i.delta, 0);
  const maxAbs = Math.max(...itens.map((i) => Math.abs(i.delta)), 1);
  const cor = tom === "risco" ? C_RISCO : C_BOM;
  const Icone = tom === "risco" ? ArrowDownRight : ArrowUpRight;

  return (
    <Card className="mb-5">
      <CardHeader className="flex-row items-start justify-between space-y-0 gap-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Icone className="h-4 w-4" style={{ color: cor }} />
            {titulo}
            <span className="font-bold tabular-nums" style={{ color: cor }}>
              {tom === "bom" ? "+" : ""}
              {fmtBRL(soma)}
            </span>
          </CardTitle>
          <CardDescription>{descricao}</CardDescription>
        </div>
        <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          {itens.length} {itens.length === 1 ? "item" : "itens"}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        {itens.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">Nenhum item com esse filtro.</p>
        ) : (
          <Table className="tabular-nums [&_td.text-right]:whitespace-nowrap">
            <THead>
              <Tr>
                <Th className="w-8">#</Th>
                <Th>Item</Th>
                <Th>O que mudou</Th>
                <Th className="text-right">{lA}</Th>
                <Th className="text-right">{lB}</Th>
                <Th className="text-right">{tom === "risco" ? "Perda" : "Ganho"}</Th>
                <Th className="w-28">Peso</Th>
              </Tr>
            </THead>
            <TBody>
              {mostrados.map((i, idx) => (
                <Tr key={i.key}>
                  <Td className="text-xs text-muted-foreground">{idx + 1}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {NOME_FONTE[i.fonte]}
                      </span>
                      <span className="font-medium">{i.nome}</span>
                    </div>
                    {i.detalhe && <div className="mt-0.5 text-[11px] text-muted-foreground">{i.detalhe}</div>}
                  </Td>
                  <Td className="text-xs text-muted-foreground">{i.motivo}</Td>
                  <Td className="text-right">{fmtBRL(i.a)}</Td>
                  <Td className="text-right">{fmtBRL(i.b)}</Td>
                  <Td className="text-right font-semibold" style={{ color: cor }}>
                    {i.delta >= 0 ? "+" : ""}
                    {fmtBRL(i.delta)}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 flex-1 rounded-full bg-secondary">
                        <div
                          className="h-1.5 rounded-full"
                          style={{ width: `${(Math.abs(i.delta) / maxAbs) * 100}%`, background: cor }}
                        />
                      </div>
                      <span className="w-9 text-right text-[10px] text-muted-foreground">
                        {totalRef ? fmtPct(i.delta / totalRef, 0) : ""}
                      </span>
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
        {itens.length > LIM && (
          <button
            onClick={() => setVerTodos(!verTodos)}
            className="w-full border-t border-border py-2.5 text-xs font-medium text-primary hover:bg-secondary/50"
          >
            {verTodos ? "Mostrar só os 15 maiores" : `Ver todos os ${itens.length} itens`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

function MesSelect({
  rotulo,
  valor,
  periodos,
  onChange,
  cor,
}: {
  rotulo: string;
  valor: string;
  periodos: string[];
  onChange: (v: string) => void;
  cor: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />
        {rotulo}
      </span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[210px] rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {periodos.map((p) => (
          <option key={p} value={p}>
            PRESER {periodoLabel(p)} · metas {cicloPreser(p).mesMetasCurto}
          </option>
        ))}
      </select>
    </label>
  );
}

function Atalho({
  ativo,
  disabled,
  onClick,
  children,
}: {
  ativo?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-40",
        ativo
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ResumoCard({
  titulo,
  valor,
  sub,
  cor,
  tom,
}: {
  titulo: string;
  valor: string;
  sub: string;
  cor?: string;
  tom?: "bom" | "risco";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {cor && <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />}
          {titulo}
        </p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold tabular-nums",
            tom === "bom" && "text-success",
            tom === "risco" && "text-destructive",
          )}
        >
          {valor}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
