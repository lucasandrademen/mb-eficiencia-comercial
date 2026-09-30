import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
import type { PreserExtratoCompleto } from "@/lib/preser/types";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PreserEmptyState } from "./PreserEmptyState";

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const GRUPOS = ["Tradicional", "Auto-serviço", "Key Account", "Distribuidor", "Farma", "Professional"] as const;
type Grupo = (typeof GRUPOS)[number];
function grupoDoCanal(nome: string): Grupo {
  const n = nome.toLowerCase();
  if (n.startsWith("trad")) return "Tradicional";
  if (n.startsWith("ka")) return "Key Account";
  if (n.startsWith("as ") || n.startsWith("as") && /prata|ouro|regular/.test(n)) return "Auto-serviço";
  if (n.includes("farma")) return "Farma";
  if (n.includes("professional") || n.includes("especializado")) return "Professional";
  return "Distribuidor";
}

interface LinhaCanal {
  codigo: number;
  nome: string;
  grupo: Grupo;
  qtd: number;
  comissao: number;
  rsBase: number | null;
  fatorReg: number | null;
  fatorDesl: number | null;
  rsCalc: number | null;
}

function agruparCanais(e: PreserExtratoCompleto | null): Map<number, LinhaCanal> {
  const m = new Map<number, LinhaCanal>();
  if (!e) return m;
  for (const d of e.drops) {
    const l = m.get(d.canal_codigo) ?? {
      codigo: d.canal_codigo,
      nome: d.canal_nome,
      grupo: grupoDoCanal(d.canal_nome),
      qtd: 0,
      comissao: 0,
      rsBase: d.rs_por_drop,
      fatorReg: d.fator_regionalizacao,
      fatorDesl: d.fator_deslocamento,
      rsCalc: d.rs_calculado,
    };
    l.qtd += d.qtd_drops ?? 0;
    l.comissao += d.comissao ?? 0;
    m.set(d.canal_codigo, l);
  }
  return m;
}

type Metrica = "qtd" | "comissao";

export default function PreserCanais() {
  const { todos, periodoSelecionado } = useExtratosCompletos();
  const P = usePeriodos(todos, periodoSelecionado);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [busca, setBusca] = useState("");
  const [metrica, setMetrica] = useState<Metrica>("qtd");
  const [ordem, setOrdem] = useState<"comissao" | "qtd" | "rsCalc" | "delta">("comissao");

  const atual = useMemo(() => agruparCanais(P.exAtual), [P.exAtual]);
  const comp = useMemo(() => agruparCanais(P.exComp), [P.exComp]);
  const passa = (l: { nome: string; grupo: Grupo }) =>
    (!grupos.length || grupos.includes(l.grupo)) && (!busca || l.nome.toLowerCase().includes(busca.toLowerCase()));

  // série por mês (todas as competências importadas)
  const porMes = useMemo(() => (todos ?? []).map((e) => ({ p: e.extrato.periodo.slice(0, 7), g: agruparCanais(e) })), [todos]);

  if (!todos) {
    return (
      <>
        <PageHeader title="Canais / Drops" subtitle="Carregando…" />
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Lendo extratos…
        </div>
      </>
    );
  }
  if (!P.exAtual) {
    return (
      <>
        <PageHeader title="Canais / Drops" />
        <PreserEmptyState semExtrato />
      </>
    );
  }

  const lA = periodoLabel(P.atual!);
  const lC = P.comp ? periodoLabel(P.comp) : "";
  const anoA = P.atual!.slice(0, 4);
  const anoAnt = String(parseInt(anoA, 10) - 1);
  const mesA = parseInt(P.atual!.slice(5, 7), 10);

  const somaG = (g: Map<number, LinhaCanal>, f: (l: LinhaCanal) => number) => [...g.values()].filter(passa).reduce((t, l) => t + f(l), 0);
  const qA = somaG(atual, (l) => l.qtd);
  const cA = somaG(atual, (l) => l.comissao);
  const qC = P.exComp ? somaG(comp, (l) => l.qtd) : null;
  const cC = P.exComp ? somaG(comp, (l) => l.comissao) : null;
  const totalGeral = [...atual.values()].reduce((t, l) => t + l.comissao, 0);
  const totalExtrato = P.exAtual.extrato.valor_total_comissao ?? 0;

  // acumulado do ano até o mês × mesmo período do ano anterior
  const acum = (ano: string) =>
    porMes
      .filter((x) => x.p.startsWith(ano) && parseInt(x.p.slice(5, 7), 10) <= mesA)
      .reduce((t, x) => ({ q: t.q + somaG(x.g, (l) => l.qtd), c: t.c + somaG(x.g, (l) => l.comissao) }), { q: 0, c: 0 });
  const acA = acum(anoA);
  const acAnt = acum(anoAnt);
  const temAnoAnt = porMes.some((x) => x.p.startsWith(anoAnt));

  // gráfico mês a mês: ano atual × ano anterior
  const mesAMes = MESES_CURTOS.map((m, i) => {
    const pk = (ano: string) => `${ano}-${String(i + 1).padStart(2, "0")}`;
    const val = (ano: string) => {
      const x = porMes.find((y) => y.p === pk(ano));
      return x ? somaG(x.g, (l) => (metrica === "qtd" ? l.qtd : l.comissao)) : null;
    };
    return { mes: m, ant: val(anoAnt), atual: val(anoA) };
  });

  const linhas = [...new Set([...atual.keys(), ...(P.exComp ? comp.keys() : [])])]
    .map((k) => {
      const a = atual.get(k);
      const c = comp.get(k);
      const base = a ?? c!;
      return {
        ...base,
        qtd: a?.qtd ?? 0,
        comissao: a?.comissao ?? 0,
        compQtd: P.exComp ? c?.qtd ?? 0 : null,
        compComissao: P.exComp ? c?.comissao ?? 0 : null,
        delta: P.exComp ? (a?.comissao ?? 0) - (c?.comissao ?? 0) : null,
        tendencia: porMes.slice(-12).map((x) => x.g.get(k)?.[metrica] ?? 0),
      };
    })
    .filter(passa)
    .sort((x, y) => (ordem === "delta" ? (x.delta ?? 0) - (y.delta ?? 0) : (y[ordem] ?? 0) - (x[ordem] ?? 0)));

  const porCanal = linhas.map((l) => ({ nome: l.nome, atual: l[metrica], comp: metrica === "qtd" ? l.compQtd : l.compComissao }));

  // matriz canal × mês do ano atual
  const mesesAno = porMes.filter((x) => x.p.startsWith(anoA));
  const matriz = [...new Set(mesesAno.flatMap((x) => [...x.g.keys()]))]
    .map((k) => {
      const ref = mesesAno.map((x) => x.g.get(k)).find(Boolean)!;
      const vals = mesesAno.map((x) => x.g.get(k)?.[metrica] ?? 0);
      return { k, nome: ref.nome, grupo: ref.grupo, vals, total: vals.reduce((a, b) => a + b, 0) };
    })
    .filter(passa)
    .sort((a, b) => b.total - a.total);
  const totMes = mesesAno.map((_, i) => matriz.reduce((t, r) => t + r.vals[i], 0));
  const fmtM = (v: number) => (metrica === "qtd" ? fmtNum(v) : fmtBRL(v));
  const tick = { fontSize: 11, fill: C_TINTA };
  const melhorRs = [...atual.values()].filter((l) => l.rsCalc).sort((a, b) => (b.rsCalc ?? 0) - (a.rsCalc ?? 0))[0];

  return (
    <>
      <PageHeader
        title="Canais / Drops"
        subtitle={`Drops (critério 20): R$ por entrega em cada canal × fator de regionalização × fator de deslocamento. Em ${lA}, drops foram ${fmtPct(totalGeral / (totalExtrato || 1))} da comissão.`}
      />

      <BarraPeriodo {...P} setMes={P.setMes}>
        <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs font-medium">
          {(
            [
              ["qtd", "Quantidade"],
              ["comissao", "R$"],
            ] as const
          ).map(([k, t]) => (
            <button key={k} onClick={() => setMetrica(k)} className={cn("rounded-md px-3 py-1", metrica === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </BarraPeriodo>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Chip ativo={!grupos.length} onClick={() => setGrupos([])}>
          Todos os canais
        </Chip>
        {GRUPOS.map((g) => (
          <Chip key={g} ativo={grupos.includes(g)} onClick={() => setGrupos(grupos.includes(g) ? grupos.filter((x) => x !== g) : [...grupos, g])}>
            {g}
          </Chip>
        ))}
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar canal"
            className="w-48 rounded-lg border border-border bg-card py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi rotulo="Drops no mês" valor={fmtNum(qA)} delta={P.exComp ? variacao(qC, qA) : undefined} sub={qC != null ? `em ${lC}: ${fmtNum(qC)}` : undefined} />
        <Kpi rotulo="Comissão de drops" valor={fmtBRL(cA)} delta={P.exComp ? variacao(cC, cA) : undefined} sub={cC != null ? `em ${lC}: ${fmtBRL(cC)}` : undefined} />
        <Kpi
          rotulo="R$ médio por drop"
          valor={fmtBRL(qA ? cA / qA : 0)}
          delta={P.exComp && qC ? variacao((cC ?? 0) / qC, cA / (qA || 1)) : undefined}
          sub={melhorRs ? `maior: ${melhorRs.nome} ${fmtBRL(melhorRs.rsCalc)}` : undefined}
        />
        <Kpi
          rotulo={`Acumulado ${anoA} (jan–${MESES_CURTOS[mesA - 1].toLowerCase()})`}
          valor={metrica === "qtd" ? `${fmtNum(acA.q)} drops` : fmtBRL(acA.c)}
          delta={temAnoAnt ? variacao(metrica === "qtd" ? acAnt.q : acAnt.c, metrica === "qtd" ? acA.q : acA.c) : undefined}
          sub={temAnoAnt ? `${anoAnt}: ${metrica === "qtd" ? fmtNum(acAnt.q) : fmtBRL(acAnt.c)}` : undefined}
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{metrica === "qtd" ? "Drops" : "Comissão de drops"} mês a mês</CardTitle>
            <CardDescription>
              {anoA}
              {temAnoAnt ? ` × ${anoAnt}` : ""}, com os filtros aplicados
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mesAMes} margin={{ left: 0, right: 8 }} barGap={2}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="mes" tick={tick} axisLine={false} tickLine={false} />
                <YAxis tick={tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => (metrica === "qtd" ? fmtNum(v) : fmtBRL(v, { compact: true }).replace("R$", "").trim())} />
                <Tooltip formatter={(v: number) => fmtM(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {temAnoAnt && <Bar dataKey="ant" name={anoAnt} fill={C_COMP} radius={[3, 3, 0, 0]} maxBarSize={18} />}
                <Bar dataKey="atual" name={anoA} fill={C_ATUAL} radius={[3, 3, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por canal em {lA}</CardTitle>
            <CardDescription>{P.exComp ? `Comparado com ${lC}` : "Sem comparação"}</CardDescription>
          </CardHeader>
          <CardContent className="h-64 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porCanal} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={tick} axisLine={false} tickLine={false} tickFormatter={(v) => (metrica === "qtd" ? fmtNum(v) : fmtBRL(v, { compact: true }).replace("R$", "").trim())} />
                <YAxis type="category" dataKey="nome" tick={{ ...tick, fontSize: 10 }} axisLine={false} tickLine={false} width={140} interval={0} />
                <Tooltip formatter={(v: number) => fmtM(v)} />
                {P.exComp && <Bar dataKey="comp" name={lC} fill={C_COMP} radius={2} maxBarSize={8} />}
                <Bar dataKey="atual" name={lA} fill={C_ATUAL} radius={2} maxBarSize={8} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Canais em {lA}</CardTitle>
            <CardDescription>R$ calculado = R$ base × fator de regionalização × fator de deslocamento</CardDescription>
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            Ordenar por
            <select value={ordem} onChange={(e) => setOrdem(e.target.value as typeof ordem)} className="rounded-lg border border-border bg-card px-2 py-1 text-sm text-foreground">
              <option value="comissao">Comissão</option>
              <option value="qtd">Quantidade</option>
              <option value="rsCalc">R$ por drop</option>
              {P.exComp && <option value="delta">Maior queda</option>}
            </select>
          </label>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="tabular-nums [&_td.text-right]:whitespace-nowrap">
            <THead>
              <Tr>
                <Th>Canal</Th>
                <Th className="text-right">Drops</Th>
                {P.exComp && <Th className="text-right">{lC}</Th>}
                {P.exComp && <Th className="text-right">Δ drops</Th>}
                <Th className="text-right">R$ base</Th>
                <Th className="text-right">Fatores</Th>
                <Th className="text-right">R$/drop</Th>
                <Th className="text-right">Comissão</Th>
                {P.exComp && <Th className="text-right">Δ R$</Th>}
                <Th className="text-right">% drops</Th>
                <Th>Tendência</Th>
              </Tr>
            </THead>
            <TBody>
              {linhas.map((l) => (
                <Tr key={l.codigo}>
                  <Td>
                    <div className="font-medium">{l.nome}</div>
                    <div className="text-[10px] text-muted-foreground">{l.grupo}</div>
                  </Td>
                  <Td className="text-right font-semibold">{fmtNum(l.qtd)}</Td>
                  {P.exComp && <Td className="text-right text-muted-foreground">{fmtNum(l.compQtd)}</Td>}
                  {P.exComp && (
                    <Td className="text-right">
                      <span className={cn("mr-1.5", l.qtd - (l.compQtd ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                        {l.qtd - (l.compQtd ?? 0) >= 0 ? "+" : ""}
                        {fmtNum(l.qtd - (l.compQtd ?? 0))}
                      </span>
                      <Pill v={variacao(l.compQtd, l.qtd)} />
                    </Td>
                  )}
                  <Td className="text-right text-muted-foreground">{fmtBRL(l.rsBase)}</Td>
                  <Td className="text-right text-xs text-muted-foreground">
                    {fmtPct(l.fatorReg ?? 0, 0)} × {fmtPct(l.fatorDesl ?? 0, 0)}
                  </Td>
                  <Td className={cn("text-right", !l.rsCalc && "font-semibold text-destructive")}>{l.rsCalc ? fmtBRL(l.rsCalc) : "R$ 0 *"}</Td>
                  <Td className="text-right font-semibold">{fmtBRL(l.comissao)}</Td>
                  {P.exComp && (
                    <Td className={cn("text-right font-medium", (l.delta ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                      {(l.delta ?? 0) >= 0 ? "+" : ""}
                      {fmtBRL(l.delta)}
                    </Td>
                  )}
                  <Td className="text-right text-muted-foreground">{fmtPct(l.comissao / (totalGeral || 1))}</Td>
                  <Td>
                    <Sparkline valores={l.tendencia} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {linhas.some((l) => !l.rsCalc) && (
            <p className="px-5 py-3 text-[11px] text-muted-foreground">* Canal com R$ 0,00 por drop no extrato (ex.: Farma Curva B) — vale confirmar a tarifa com a Nestlé.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {metrica === "qtd" ? "Drops" : "Comissão"} por canal · mês a mês de {anoA}
          </CardTitle>
          <CardDescription>Use o botão Quantidade / R$ no topo para trocar a métrica</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table className="tabular-nums [&_td]:whitespace-nowrap">
            <THead>
              <Tr>
                <Th>Canal</Th>
                {mesesAno.map((x) => (
                  <Th key={x.p} className={cn("text-right", x.p === P.atual && "text-primary")}>
                    {MESES_CURTOS[parseInt(x.p.slice(5, 7), 10) - 1]}
                  </Th>
                ))}
                <Th className="text-right">Total</Th>
              </Tr>
            </THead>
            <TBody>
              {matriz.map((r) => (
                <Tr key={r.k}>
                  <Td className="font-medium">{r.nome}</Td>
                  {r.vals.map((v, i) => {
                    const ant = i ? r.vals[i - 1] : null;
                    return (
                      <Td key={i} className={cn("text-right", ant != null && v < ant && "text-destructive", mesesAno[i].p === P.atual && "bg-primary/5 font-semibold")}>
                        {fmtM(v)}
                      </Td>
                    );
                  })}
                  <Td className="text-right font-semibold">{fmtM(r.total)}</Td>
                </Tr>
              ))}
              <Tr className="bg-secondary/60 font-semibold hover:bg-secondary/60">
                <Td>Total</Td>
                {totMes.map((v, i) => (
                  <Td key={i} className="text-right">
                    {fmtM(v)}
                  </Td>
                ))}
                <Td className="text-right">{fmtM(totMes.reduce((a, b) => a + b, 0))}</Td>
              </Tr>
            </TBody>
          </Table>
          <p className="px-5 py-3 text-[11px] text-muted-foreground">Em vermelho: mês abaixo do mês anterior.</p>
        </CardContent>
      </Card>
    </>
  );
}
