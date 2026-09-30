import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Info, Loader2, Search, Target } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  BarraPeriodo,
  C_ATENCAO,
  C_ATUAL,
  C_BOM,
  C_GRADE,
  C_RISCO,
  C_TINTA,
  Chip,
  Kpi,
  usePeriodos,
  useExtratosCompletos,
} from "@/components/preser/Filtros";
import type { PreserExtratoCompleto, PreserMeta } from "@/lib/preser/types";
import { cicloPreser } from "@/lib/preser/ciclo";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Cobertura por categoria = critérios 114+ (nova regra a partir de Ago/2026). */
const ehCobCategoria = (m: PreserMeta) => m.tipo === "Cobertura" && (m.criterio_codigo ?? 0) >= 114;
const temCobCategoria = (e: PreserExtratoCompleto) => e.metas.some(ehCobCategoria);

type Faixa = "Ideal" | "Meta" | "Mínimo" | "Abaixo" | "Bateu" | "Não bateu" | "Sem objetivo";
const COR_FAIXA: Record<Faixa, string> = {
  Ideal: "bg-success/15 text-success",
  Meta: "bg-success/15 text-success",
  Mínimo: "bg-warning/15 text-warning",
  Bateu: "bg-success/15 text-success",
  Abaixo: "bg-destructive/15 text-destructive",
  "Não bateu": "bg-destructive/15 text-destructive",
  "Sem objetivo": "bg-muted text-muted-foreground",
};

interface Linha {
  key: string;
  categoria: string;
  sku: string | null;
  clientes: number;
  min: number | null;
  meta: number | null;
  ideal: number | null;
  pMin: number | null;
  pMeta: number | null;
  pIdeal: number | null;
  taxaPaga: number;
  efetivoMes: number;
  comissao: number;
  faixa: Faixa;
  faltamMin: number;
  faltamMeta: number;
  valorMin: number | null; // R$ se chegar ao mínimo
  valorMeta: number | null; // R$ se chegar à meta
  naMesa: number | null; // valorMeta − pago
  rsPorCliente: number | null; // quanto vale cada cliente a mais até o mínimo
  anterior: number | null; // clientes no mês de comparação
}

function montarLinhas(e: PreserExtratoCompleto | null, comp: PreserExtratoCompleto | null): Linha[] {
  if (!e) return [];
  const idxComp = new Map((comp?.metas ?? []).filter(ehCobCategoria).map((m) => [m.bu ?? "", m]));
  return e.metas.filter(ehCobCategoria).map((m) => {
    const [categoria, sku] = (m.bu ?? "—").split(" · ");
    const clientes = m.efetivo_fiscal ?? 0;
    const temFaixas = m.objetivo_minimo != null && m.objetivo_ideal != null;
    const min = temFaixas ? m.objetivo_minimo : m.objetivo_meta;
    const meta = m.objetivo_meta;
    const ideal = temFaixas ? m.objetivo_ideal : null;
    const efMes = m.efetivo_mes ?? 0;
    const pago = m.comissao ?? 0;
    let faixa: Faixa;
    if (!meta) faixa = "Sem objetivo";
    else if (!temFaixas) faixa = clientes >= meta ? "Bateu" : "Não bateu";
    else faixa = clientes >= (ideal ?? Infinity) ? "Ideal" : clientes >= meta ? "Meta" : clientes >= (min ?? Infinity) ? "Mínimo" : "Abaixo";
    const faltamMin = min ? Math.max(0, min - clientes) : 0;
    const faltamMeta = meta ? Math.max(0, meta - clientes) : 0;
    const valorMin = m.pct_minimo != null ? m.pct_minimo * efMes : null;
    const valorMeta = m.pct_meta != null ? m.pct_meta * efMes : null;
    return {
      key: `${m.criterio_codigo}|${m.bu}`,
      categoria: categoria.trim(),
      sku: sku?.trim() ?? null,
      clientes,
      min,
      meta,
      ideal,
      pMin: m.pct_minimo,
      pMeta: m.pct_meta,
      pIdeal: m.pct_ideal,
      taxaPaga: m.pct_atingido ?? 0,
      efetivoMes: efMes,
      comissao: pago,
      faixa,
      faltamMin,
      faltamMeta,
      valorMin,
      valorMeta,
      naMesa: valorMeta != null ? Math.max(0, valorMeta - pago) : null,
      rsPorCliente: faltamMin > 0 && valorMin ? valorMin / faltamMin : null,
      anterior: idxComp.get(m.bu ?? "")?.efetivo_fiscal ?? null,
    };
  });
}

type FiltroFaixa = "todas" | "abaixo" | "minimo" | "bateu";

export default function PreserCobertura() {
  const { todos, periodoSelecionado } = useExtratosCompletos();
  const P = usePeriodos(todos, periodoSelecionado, temCobCategoria);
  const [filtro, setFiltro] = useState<FiltroFaixa>("todas");
  const [busca, setBusca] = useState("");

  const linhas = useMemo(() => montarLinhas(P.exAtual, P.exComp), [P.exAtual, P.exComp]);
  const serie = useMemo(
    () =>
      (todos ?? []).filter(temCobCategoria).map((e) => ({
        p: e.extrato.periodo.slice(0, 7),
        g: new Map(montarLinhas(e, null).map((l) => [l.key.split("|")[1], l])),
      })),
    [todos],
  );

  if (!todos) {
    return (
      <>
        <PageHeader title="Cobertura por Categoria" subtitle="Carregando…" />
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Lendo extratos…
        </div>
      </>
    );
  }
  if (!P.exAtual) {
    return (
      <>
        <PageHeader title="Cobertura por Categoria" subtitle="Nova regra da Nestlé a partir do PRESER de Agosto/2026." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Target className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Nenhum extrato com Cobertura por categoria</p>
            <p className="max-w-md text-sm text-muted-foreground">Importe o PRESER de Agosto/2026 ou posterior (critérios 114 em diante).</p>
          </CardContent>
        </Card>
      </>
    );
  }

  const lA = periodoLabel(P.atual!);
  const lC = P.comp ? periodoLabel(P.comp) : null;
  const ciclo = cicloPreser(P.atual!);

  const visiveis = linhas
    .filter((l) =>
      filtro === "todas"
        ? true
        : filtro === "abaixo"
          ? l.faixa === "Abaixo" || l.faixa === "Não bateu"
          : filtro === "minimo"
            ? l.faixa === "Mínimo"
            : l.faixa === "Meta" || l.faixa === "Ideal" || l.faixa === "Bateu",
    )
    .filter((l) => !busca || `${l.categoria} ${l.sku ?? ""}`.toLowerCase().includes(busca.toLowerCase()))
    .sort((a, b) => (b.naMesa ?? -1) - (a.naMesa ?? -1));

  const pago = linhas.reduce((t, l) => t + l.comissao, 0);
  const potencialMeta = linhas.reduce((t, l) => t + Math.max(l.valorMeta ?? l.comissao, l.comissao), 0);
  const naMesa = linhas.reduce((t, l) => t + (l.naMesa ?? 0), 0);
  const comObjetivo = linhas.filter((l) => l.faixa !== "Sem objetivo");
  const batidas = comObjetivo.filter((l) => l.faixa === "Meta" || l.faixa === "Ideal" || l.faixa === "Bateu").length;
  const noMinimo = comObjetivo.filter((l) => l.faixa === "Mínimo").length;
  const faltamTotal = linhas.reduce((t, l) => t + l.faltamMin, 0);

  // Onde agir primeiro: maior R$ por cliente que falta para o mínimo
  const prioridade = linhas
    .filter((l) => l.rsPorCliente != null && l.faltamMin > 0)
    .sort((a, b) => (b.valorMin ?? 0) - (a.valorMin ?? 0))
    .slice(0, 8);

  // % do mínimo atingido (gráfico)
  const progresso = linhas
    .filter((l) => l.min)
    .map((l) => ({ nome: l.sku ?? l.categoria, pct: l.clientes / (l.min || 1), faixa: l.faixa }))
    .sort((a, b) => a.pct - b.pct);

  const tick = { fontSize: 11, fill: C_TINTA };
  const corBarra = (f: Faixa) => (f === "Abaixo" || f === "Não bateu" ? C_RISCO : f === "Mínimo" ? C_ATENCAO : C_BOM);

  return (
    <>
      <PageHeader
        title="Cobertura por Categoria"
        subtitle={`Nova regra da Nestlé desde o PRESER de Agosto/2026 · ${lA}: clientes positivados de ${ciclo.fiscalInicio} a ${ciclo.fiscalFim}. Paga % da faixa × faturamento da categoria.`}
      />

      <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <p>
          <b>Cobrança a partir de outubro/novembro.</b> Cada categoria tem objetivo de clientes próprio. Abaixo do mínimo, a categoria inteira paga
          zero — mesmo que falte 1 cliente.
        </p>
      </div>

      <BarraPeriodo {...P} setMes={P.setMes} />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Kpi rotulo="Pago no mês" valor={fmtBRL(pago)} sub={`${batidas} de ${comObjetivo.length} categorias na meta`} />
        <Kpi rotulo="Se todas batessem a meta" valor={fmtBRL(potencialMeta)} sub="% da faixa Meta × faturamento (+ o já pago nas medidas por SKU)" />
        <Kpi rotulo="Ficou na mesa" valor={fmtBRL(naMesa)} sub={<span className="font-medium text-destructive">{fmtPct(naMesa / (potencialMeta || 1), 0)} do potencial</span>} />
        <Kpi rotulo="Só no mínimo" valor={fmtNum(noMinimo)} sub="categorias pagando a menor faixa" />
        <Kpi rotulo="Clientes faltando" valor={fmtNum(faltamTotal)} sub="para todas chegarem ao mínimo" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 2xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-primary" /> Onde agir primeiro
            </CardTitle>
            <CardDescription>Categorias abaixo do mínimo, pelo valor que destravam</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="tabular-nums [&_td]:whitespace-nowrap">
              <THead>
                <Tr>
                  <Th>Categoria</Th>
                  <Th className="text-right">Faltam</Th>
                  <Th className="text-right">Destrava</Th>
                  <Th className="text-right">R$/cliente</Th>
                </Tr>
              </THead>
              <TBody>
                {prioridade.map((l) => (
                  <Tr key={l.key}>
                    <Td className="font-medium">{l.sku ?? l.categoria}</Td>
                    <Td className="text-right font-semibold text-destructive">{fmtNum(l.faltamMin)}</Td>
                    <Td className="text-right">{fmtBRL(l.valorMin)}</Td>
                    <Td className="text-right text-muted-foreground">{fmtBRL(l.rsPorCliente)}</Td>
                  </Tr>
                ))}
                {!prioridade.length && (
                  <Tr>
                    <Td colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                      Todas as categorias com faixas definidas estão no mínimo ou acima. 👏
                    </Td>
                  </Tr>
                )}
              </TBody>
            </Table>
            <p className="px-5 py-3 text-[11px] text-muted-foreground">
              Destrava = % da faixa Mínimo × faturamento da categoria no mês. R$/cliente = quanto vale cada cliente a mais até o mínimo.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clientes atingidos ÷ mínimo</CardTitle>
            <CardDescription>Abaixo de 100% a categoria não paga · vermelho = abaixo · amarelo = no mínimo · verde = meta ou mais</CardDescription>
          </CardHeader>
          <CardContent className="pb-4" style={{ height: Math.max(260, progresso.length * 22 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={progresso} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={tick} axisLine={false} tickLine={false} domain={[0.6, "dataMax"]} allowDataOverflow tickFormatter={(v) => fmtPct(v, 0)} />
                <YAxis type="category" dataKey="nome" tick={{ ...tick, fontSize: 10 }} axisLine={false} tickLine={false} width={150} interval={0} />
                <ReferenceLine x={1} stroke={C_ATUAL} strokeDasharray="4 3" />
                <Tooltip formatter={(v: number) => fmtPct(v, 1)} />
                <Bar dataKey="pct" name="Atingido ÷ mínimo" radius={2} maxBarSize={12}>
                  {progresso.map((p, i) => (
                    <Cell key={i} fill={corBarra(p.faixa)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(
          [
            ["todas", "Todas"],
            ["abaixo", "Abaixo do mínimo"],
            ["minimo", "No mínimo"],
            ["bateu", "Na meta ou acima"],
          ] as const
        ).map(([k, t]) => (
          <Chip key={k} ativo={filtro === k} onClick={() => setFiltro(k)}>
            {t}
          </Chip>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar categoria"
            className="w-52 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-base">Categorias em {lA}</CardTitle>
          <CardDescription>Ordenado pelo que ficou na mesa (até a faixa Meta)</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="tabular-nums [&_td]:whitespace-nowrap">
            <THead>
              <Tr>
                <Th>Categoria</Th>
                <Th className="text-right">Clientes</Th>
                {lC && <Th className="text-right">vs {lC}</Th>}
                <Th className="text-right">Mín / Meta / Ideal</Th>
                <Th>Faixa</Th>
                <Th className="text-right">Faltam p/ mín.</Th>
                <Th className="hidden text-right 2xl:table-cell">Taxas (mín/meta/ideal)</Th>
                <Th className="hidden text-right 2xl:table-cell">Faturamento</Th>
                <Th className="text-right">Pago</Th>
                <Th className="text-right">Na mesa</Th>
                <Th>Progresso</Th>
              </Tr>
            </THead>
            <TBody>
              {visiveis.map((l) => {
                const dif = l.anterior != null ? l.clientes - l.anterior : null;
                return (
                  <Tr key={l.key}>
                    <Td>
                      <div className="font-medium">{l.sku ?? l.categoria}</div>
                      {l.sku && <div className="text-[10px] text-muted-foreground">{l.categoria} · medido pelo SKU</div>}
                    </Td>
                    <Td className="text-right font-semibold">{fmtNum(l.clientes)}</Td>
                    {lC && (
                      <Td className={cn("text-right text-xs", dif == null ? "text-muted-foreground" : dif >= 0 ? "text-success" : "text-destructive")}>
                        {dif == null ? "—" : `${dif >= 0 ? "+" : ""}${fmtNum(dif)}`}
                      </Td>
                    )}
                    <Td className="text-right text-xs">
                      {l.ideal != null ? (
                        <>
                          <span className="text-muted-foreground">{fmtNum(l.min)} / </span>
                          <b>{fmtNum(l.meta)}</b>
                          <span className="text-muted-foreground"> / {fmtNum(l.ideal)}</span>
                        </>
                      ) : l.meta ? (
                        <b>{fmtNum(l.meta)}</b>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", COR_FAIXA[l.faixa])}>{l.faixa}</span>
                    </Td>
                    <Td className={cn("text-right", l.faltamMin ? "font-semibold text-destructive" : "text-muted-foreground")}>{l.faltamMin ? fmtNum(l.faltamMin) : "—"}</Td>
                    <Td className="hidden text-right text-xs text-muted-foreground 2xl:table-cell">
                      {l.pMin != null ? `${fmtPct(l.pMin, 2)} / ${fmtPct(l.pMeta, 2)} / ${fmtPct(l.pIdeal, 2)}` : l.taxaPaga ? `pagou ${fmtPct(l.taxaPaga, 2)}` : "—"}
                    </Td>
                    <Td className="hidden text-right text-muted-foreground 2xl:table-cell">{fmtBRL(l.efetivoMes, { compact: true })}</Td>
                    <Td className="text-right font-semibold">{fmtBRL(l.comissao)}</Td>
                    <Td className={cn("text-right", l.naMesa ? "font-semibold text-destructive" : "text-muted-foreground")}>{l.naMesa ? fmtBRL(l.naMesa) : "—"}</Td>
                    <Td>
                      <Progresso l={l} />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
          <p className="flex items-start gap-1.5 px-5 py-3 text-[11px] text-muted-foreground">
            <Info className="mt-px h-3 w-3 shrink-0" />
            Taxas = % paga no Mínimo / Meta / Ideal. Categorias medidas por SKU (Biscoitos, Chocolates, Garoto) não trazem faixas no extrato — só objetivo e % pago.
            Por isso, quando uma delas não bate (ex.: Kit Kat, Baton), o valor perdido não entra no "na mesa". Categorias que a Nestlé marca como não
            aplicáveis (objetivo 999.999.999) ficam de fora.
          </p>
        </CardContent>
      </Card>

      {serie.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução dos clientes por categoria</CardTitle>
            <CardDescription>Clientes atingidos em cada PRESER desde a nova regra · em vermelho, abaixo do mínimo daquele mês</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="tabular-nums [&_td]:whitespace-nowrap">
              <THead>
                <Tr>
                  <Th>Categoria</Th>
                  {serie.map((s) => (
                    <Th key={s.p} className="text-right">
                      {periodoLabel(s.p)}
                    </Th>
                  ))}
                  {serie.map((s) => (
                    <Th key={`pg${s.p}`} className="text-right">
                      Pago {periodoLabel(s.p).split("/")[0].slice(0, 3)}
                    </Th>
                  ))}
                </Tr>
              </THead>
              <TBody>
                {[...new Set(serie.flatMap((s) => [...s.g.keys()]))].map((k) => {
                  const ref = serie.map((s) => s.g.get(k)).find(Boolean)!;
                  return (
                    <Tr key={k}>
                      <Td className="font-medium">{ref.sku ?? ref.categoria}</Td>
                      {serie.map((s) => {
                        const l = s.g.get(k);
                        return (
                          <Td key={s.p} className={cn("text-right", l && l.faltamMin > 0 && "font-semibold text-destructive")}>
                            {l ? `${fmtNum(l.clientes)} / ${l.min ? fmtNum(l.min) : "—"}` : "—"}
                          </Td>
                        );
                      })}
                      {serie.map((s) => (
                        <Td key={`pg${s.p}`} className="text-right text-muted-foreground">
                          {s.g.get(k) ? fmtBRL(s.g.get(k)!.comissao) : "—"}
                        </Td>
                      ))}
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
            <p className="px-5 py-3 text-[11px] text-muted-foreground">Formato: clientes atingidos / mínimo exigido.</p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** Barra de progresso com marcas de Mínimo, Meta e Ideal. */
function Progresso({ l }: { l: Linha }) {
  const topo = Math.max(l.ideal ?? l.meta ?? 0, l.clientes) * 1.05 || 1;
  const pos = (v: number | null) => (v ? `${(v / topo) * 100}%` : null);
  const cor = l.faixa === "Abaixo" || l.faixa === "Não bateu" ? C_RISCO : l.faixa === "Mínimo" ? C_ATENCAO : C_BOM;
  return (
    <div className="relative h-2.5 w-32 rounded-full bg-secondary">
      <div className="h-2.5 rounded-full" style={{ width: `${Math.min(100, (l.clientes / topo) * 100)}%`, background: cor }} />
      {[l.min !== l.meta ? l.min : null, l.meta, l.ideal].map((v, i) =>
        pos(v) ? <span key={i} className="absolute -top-0.5 h-3.5 w-px bg-foreground/60" style={{ left: pos(v)! }} /> : null,
      )}
    </div>
  );
}
