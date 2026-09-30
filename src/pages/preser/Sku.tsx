import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  BarraPeriodo,
  C_ATUAL,
  C_COMP,
  C_GRADE,
  C_TINTA,
  Chip,
  Kpi,
  Pill,
  Sparkline,
  usePeriodos,
  useExtratosCompletos,
  variacao,
} from "@/components/preser/Filtros";
import { CATEGORIA_NOMES, type PreserCategoriaCodigo, type PreserExtratoCompleto } from "@/lib/preser/types";
import { grupoCanonico, nomesAntigos } from "@/lib/preser/renomeados";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PreserEmptyState } from "./PreserEmptyState";

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotuloMes = (p: string) => `${MESES_CURTOS[parseInt(p.slice(5, 7), 10) - 1]}/${p.slice(2, 4)}`;
const normDiv = (d: string | null) => {
  const t = (d ?? "Sem divisão").trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const nomeCat = (c: number, nome?: string | null) => nome ?? CATEGORIA_NOMES[c as PreserCategoriaCodigo] ?? String(c);

interface LinhaSku {
  nome: string;
  divisao: string;
  categoria: number;
  categoriaNome: string;
  efetivo: number;
  comissao: number;
  taxa: number | null;
}

/** Soma as linhas de SKU de um extrato por grupo (nome atual, juntando renomeados). */
function agruparSkus(e: PreserExtratoCompleto | null): Map<string, LinhaSku> {
  const m = new Map<string, LinhaSku>();
  if (!e) return m;
  for (const s of e.skus) {
    const nome = grupoCanonico(s.grupo_nome);
    const l = m.get(nome) ?? {
      nome,
      divisao: normDiv(s.divisao),
      categoria: s.categoria,
      categoriaNome: nomeCat(s.categoria, s.categoria_nome),
      efetivo: 0,
      comissao: 0,
      taxa: null,
    };
    l.efetivo += s.efetivo_total ?? 0;
    l.comissao += s.comissao ?? 0;
    l.taxa = s.pct_comissao ?? l.taxa;
    m.set(nome, l);
  }
  return m;
}

type Ordem = "comissao" | "efetivo" | "delta" | "deltaPct" | "nome";
type Sentido = "todos" | "queda" | "alta";

export default function PreserSku() {
  const { todos, periodoSelecionado } = useExtratosCompletos();
  const P = usePeriodos(todos, periodoSelecionado);
  const [divisao, setDivisao] = useState("");
  const [categoria, setCategoria] = useState<number | 0>(0);
  const [busca, setBusca] = useState("");
  const [sentido, setSentido] = useState<Sentido>("todos");
  const [ordem, setOrdem] = useState<Ordem>("comissao");
  const [limite, setLimite] = useState(50);

  const atual = useMemo(() => agruparSkus(P.exAtual), [P.exAtual]);
  const comp = useMemo(() => agruparSkus(P.exComp), [P.exComp]);
  // série dos últimos 12 meses (para tendência e evolução)
  const serieMeses = useMemo(() => {
    if (!todos || !P.atual) return [];
    const ate = todos.findIndex((e) => e.extrato.periodo.startsWith(P.atual!));
    return todos.slice(Math.max(0, ate - 11), ate + 1).map((e) => ({ p: e.extrato.periodo.slice(0, 7), g: agruparSkus(e) }));
  }, [todos, P.atual]);

  const divisoes = useMemo(() => [...new Set([...atual.values()].map((l) => l.divisao))].sort(), [atual]);
  const passaFiltro = (l: LinhaSku) =>
    (!divisao || l.divisao === divisao) &&
    (!categoria || l.categoria === categoria) &&
    (!busca || l.nome.toLowerCase().includes(busca.toLowerCase()));

  const linhas = useMemo(() => {
    const nomes = new Set([...atual.keys(), ...(P.exComp ? comp.keys() : [])]);
    return [...nomes]
      .map((n) => {
        const a = atual.get(n);
        const c = comp.get(n);
        const base = a ?? c!;
        return {
          ...base,
          efetivo: a?.efetivo ?? 0,
          comissao: a?.comissao ?? 0,
          taxa: a?.taxa ?? c?.taxa ?? null,
          compComissao: P.exComp ? c?.comissao ?? 0 : null,
          compEfetivo: P.exComp ? c?.efetivo ?? 0 : null,
          delta: P.exComp ? (a?.comissao ?? 0) - (c?.comissao ?? 0) : null,
          tendencia: serieMeses.map((s) => s.g.get(n)?.comissao ?? 0),
          antigos: nomesAntigos(n),
        };
      })
      .filter(passaFiltro)
      .filter((l) => sentido === "todos" || (l.delta != null && (sentido === "queda" ? l.delta < -0.5 : l.delta > 0.5)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual, comp, P.exComp, serieMeses, divisao, categoria, busca, sentido]);

  const ordenadas = useMemo(() => {
    const k = (l: (typeof linhas)[number]) =>
      ordem === "comissao" ? l.comissao : ordem === "efetivo" ? l.efetivo : ordem === "delta" ? l.delta ?? 0 : ordem === "deltaPct" ? variacao(l.compComissao, l.comissao) ?? 0 : 0;
    return [...linhas].sort((a, b) => (ordem === "nome" ? a.nome.localeCompare(b.nome) : ordem === "delta" || ordem === "deltaPct" ? k(a) - k(b) : k(b) - k(a)));
  }, [linhas, ordem]);

  if (!todos) {
    return (
      <>
        <PageHeader title="Análise por SKU" subtitle="Carregando…" />
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Lendo extratos…
        </div>
      </>
    );
  }
  if (!P.exAtual) {
    return (
      <>
        <PageHeader title="Análise por SKU" />
        <PreserEmptyState semExtrato />
      </>
    );
  }

  // ── totais do recorte filtrado
  const soma = (f: (l: LinhaSku) => number, g: Map<string, LinhaSku>) => [...g.values()].filter(passaFiltro).reduce((t, l) => t + f(l), 0);
  const comA = soma((l) => l.comissao, atual);
  const efA = soma((l) => l.efetivo, atual);
  const comC = P.exComp ? soma((l) => l.comissao, comp) : null;
  const efC = P.exComp ? soma((l) => l.efetivo, comp) : null;
  const totalGeral = [...atual.values()].reduce((t, l) => t + l.comissao, 0);
  const emQueda = linhas.filter((l) => (l.delta ?? 0) < -0.5);

  // ── por categoria (respeita divisão e busca)
  const porCategoria = [1, 2, 3, 4].map((c) => {
    const f = (g: Map<string, LinhaSku>) =>
      [...g.values()].filter((l) => l.categoria === c && (!divisao || l.divisao === divisao) && (!busca || l.nome.toLowerCase().includes(busca.toLowerCase()))).reduce((t, l) => t + l.comissao, 0);
    return { nome: ["", "Mix Pilar", "High Pull", "H. High Pull", "Estratégico"][c], atual: f(atual), comp: P.exComp ? f(comp) : null };
  });
  const evolucao = serieMeses.map((s) => ({
    mes: rotuloMes(s.p),
    comissao: [...s.g.values()].filter(passaFiltro).reduce((t, l) => t + l.comissao, 0),
    efetivo: [...s.g.values()].filter(passaFiltro).reduce((t, l) => t + l.efetivo, 0) / 1000,
  }));
  const top = [...linhas].sort((a, b) => b.comissao - a.comissao).slice(0, 10).map((l) => ({ nome: l.nome.length > 24 ? l.nome.slice(0, 23) + "…" : l.nome, atual: l.comissao, comp: l.compComissao }));
  const tick = { fontSize: 11, fill: C_TINTA };
  const lA = periodoLabel(P.atual!);
  const lC = P.comp ? periodoLabel(P.comp) : "";

  return (
    <>
      <PageHeader
        title="Análise por SKU"
        subtitle={`Comissão de vendas (critério 1) por grupo de SKU · ${atual.size} grupos em ${lA}. Grupos renomeados pela Nestlé aparecem somados ao nome atual.`}
      />

      <BarraPeriodo {...P} setMes={P.setMes} />

      {/* ── Filtros ─────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={divisao} onChange={(e) => setDivisao(e.target.value)} className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-sm">
          <option value="">Todas as divisões</option>
          {divisoes.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <Chip ativo={!categoria} onClick={() => setCategoria(0)}>
          Todas as categorias
        </Chip>
        {[4, 1, 2, 3].map((c) => (
          <Chip key={c} ativo={categoria === c} onClick={() => setCategoria(categoria === c ? 0 : c)}>
            {CATEGORIA_NOMES[c as PreserCategoriaCodigo]} · {fmtPct([0, 0.025, 0.0115, 0.0025, 0.04][c], c === 3 ? 2 : 1)}
          </Chip>
        ))}
        {P.exComp && (
          <>
            <span className="mx-1 h-5 w-px bg-border" />
            <Chip ativo={sentido === "queda"} onClick={() => setSentido(sentido === "queda" ? "todos" : "queda")}>
              Só quedas
            </Chip>
            <Chip ativo={sentido === "alta"} onClick={() => setSentido(sentido === "alta" ? "todos" : "alta")}>
              Só altas
            </Chip>
          </>
        )}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar SKU (ex.: Nescau, Baton)"
            className="w-60 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* ── KPIs ────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi rotulo="Comissão de vendas" valor={fmtBRL(comA)} delta={P.exComp ? variacao(comC, comA) : undefined} sub={comC != null ? `em ${lC}: ${fmtBRL(comC)}` : `${fmtPct(comA / (totalGeral || 1))} do total de SKUs`} />
        <Kpi rotulo="Efetivo faturado" valor={fmtBRL(efA, { compact: true })} delta={P.exComp ? variacao(efC, efA) : undefined} sub={efC != null ? `em ${lC}: ${fmtBRL(efC, { compact: true })}` : undefined} />
        <Kpi
          rotulo="Taxa média"
          valor={fmtPct(efA ? comA / efA : 0, 2)}
          delta={P.exComp && efC ? comA / (efA || 1) - (comC ?? 0) / efC : undefined}
          pontos
          sub="comissão ÷ efetivo (mix de categorias)"
        />
        <Kpi
          rotulo={P.exComp ? "SKUs em queda" : "SKUs com venda"}
          valor={P.exComp ? fmtNum(emQueda.length) : fmtNum(linhas.filter((l) => l.comissao).length)}
          sub={P.exComp ? <span className="font-medium text-destructive">{fmtBRL(emQueda.reduce((t, l) => t + (l.delta ?? 0), 0))}</span> : undefined}
        />
      </div>

      {/* ── Gráficos ────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comissão por categoria</CardTitle>
            <CardDescription>Estratégico paga 4%, Mix Pilar 2,5%</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCategoria} margin={{ left: 0, right: 8 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="nome" tick={{ ...tick, fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                <YAxis tick={tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => fmtBRL(v, { compact: true }).replace("R$", "").trim()} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {P.exComp && <Bar dataKey="comp" name={lC} fill={C_COMP} radius={[3, 3, 0, 0]} maxBarSize={28} />}
                <Bar dataKey="atual" name={lA} fill={C_ATUAL} radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução no recorte</CardTitle>
            <CardDescription>Comissão de vendas dos últimos meses, com os filtros aplicados</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evolucao} margin={{ left: 0, right: 8 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tick={tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => fmtBRL(v, { compact: true }).replace("R$", "").trim()} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                <Line dataKey="comissao" name="Comissão" stroke={C_ATUAL} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">10 maiores SKUs</CardTitle>
            <CardDescription>Comissão em {lA}{P.exComp ? ` × ${lC}` : ""}</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => fmtBRL(v, { compact: true }).replace("R$", "").trim()} />
                <YAxis type="category" dataKey="nome" tick={{ ...tick, fontSize: 10 }} axisLine={false} tickLine={false} width={130} interval={0} />
                <Tooltip formatter={(v: number) => fmtBRL(v)} />
                {P.exComp && <Bar dataKey="comp" name={lC} fill={C_COMP} radius={2} maxBarSize={9} />}
                <Bar dataKey="atual" name={lA} fill={C_ATUAL} radius={2} maxBarSize={9} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabela ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">SKUs · {fmtNum(ordenadas.length)} no recorte</CardTitle>
            <CardDescription>Tendência = comissão dos últimos {serieMeses.length} meses</CardDescription>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Ordenar por
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as Ordem)} className="rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground">
              <option value="comissao">Comissão</option>
              <option value="efetivo">Efetivo</option>
              {P.exComp && <option value="delta">Maior queda (R$)</option>}
              {P.exComp && <option value="deltaPct">Maior queda (%)</option>}
              <option value="nome">Nome</option>
            </select>
          </label>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="tabular-nums [&_td.text-right]:whitespace-nowrap">
            <THead>
              <Tr>
                <Th>SKU</Th>
                <Th>Divisão · categoria</Th>
                <Th className="text-right">Efetivo</Th>
                {P.exComp && <Th className="text-right">Δ efetivo</Th>}
                <Th className="text-right">Taxa</Th>
                <Th className="text-right">Comissão</Th>
                {P.exComp && <Th className="text-right">{lC}</Th>}
                {P.exComp && <Th className="text-right">Δ R$</Th>}
                {P.exComp && <Th className="text-right">Δ %</Th>}
                <Th className="text-right">% do total</Th>
                <Th>Tendência</Th>
              </Tr>
            </THead>
            <TBody>
              {ordenadas.slice(0, limite).map((l) => (
                <Tr key={l.nome}>
                  <Td>
                    <div className="max-w-[260px] truncate font-medium" title={l.nome}>
                      {l.nome}
                    </div>
                    {l.antigos.length > 0 && <div className="text-[10px] text-muted-foreground">inclui {l.antigos.join(", ")}</div>}
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {l.divisao} · {l.categoriaNome}
                  </Td>
                  <Td className="text-right">{fmtBRL(l.efetivo, { compact: true })}</Td>
                  {P.exComp && (
                    <Td className="text-right">
                      <Pill v={variacao(l.compEfetivo, l.efetivo)} />
                    </Td>
                  )}
                  <Td className="text-right text-muted-foreground">{l.taxa != null ? fmtPct(l.taxa, 2) : "—"}</Td>
                  <Td className="text-right font-semibold">{fmtBRL(l.comissao)}</Td>
                  {P.exComp && <Td className="text-right text-muted-foreground">{fmtBRL(l.compComissao)}</Td>}
                  {P.exComp && (
                    <Td className={cn("text-right font-medium", (l.delta ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                      {(l.delta ?? 0) >= 0 ? "+" : ""}
                      {fmtBRL(l.delta)}
                    </Td>
                  )}
                  {P.exComp && (
                    <Td className="text-right">
                      <Pill v={variacao(l.compComissao, l.comissao)} />
                    </Td>
                  )}
                  <Td className="text-right text-muted-foreground">{fmtPct(l.comissao / (totalGeral || 1))}</Td>
                  <Td>
                    <Sparkline valores={l.tendencia} />
                  </Td>
                </Tr>
              ))}
              {ordenadas.length === 0 && (
                <Tr>
                  <Td colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum SKU com esses filtros.
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
          {ordenadas.length > limite && (
            <button onClick={() => setLimite(limite + 100)} className="w-full border-t border-border py-2.5 text-xs font-medium text-primary hover:bg-secondary/50">
              Mostrar mais ({ordenadas.length - limite} restantes)
            </button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
