import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Percent } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { C_ATUAL, C_COMP, C_GRADE, C_TINTA, Pill, useExtratosCompletos } from "@/components/preser/Filtros";
import type { PreserExtrato } from "@/lib/preser/types";
import { fmtBRL, fmtPct, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
type Base = "liquido" | "bruto";

/** Comissão do extrato: líquida (contabilizado − impostos retidos) ou bruta. */
function comissao(e: PreserExtrato, base: Base): number {
  if (base === "bruto") return e.valor_total_comissao ?? 0;
  const impostos = (e.irrf_retido ?? 0) + (e.pis_retido ?? 0) + (e.cofins_retido ?? 0) + (e.csll_retido ?? 0);
  return (e.valor_total_contabilizado ?? 0) - impostos;
}

/**
 * "Quanto ganhamos sobre o que vendemos": comissão ÷ faturamento AC, mês a mês,
 * ano atual × ano anterior. Mesmo cálculo do "Ganho s/ Venda" do topo do Dashboard.
 */
export function GanhoSobreVenda({ periodo }: { periodo: string }) {
  const { todos } = useExtratosCompletos();
  const [base, setBase] = useState<Base>("liquido");

  const d = useMemo(() => {
    if (!todos?.length) return null;
    const ano = parseInt(periodo.slice(0, 4), 10);
    const anoAnt = ano - 1;
    const mesSel = parseInt(periodo.slice(5, 7), 10);
    const get = (a: number, m: number) => todos.find((e) => e.extrato.periodo.startsWith(`${a}-${String(m).padStart(2, "0")}`))?.extrato ?? null;
    const linha = (e: PreserExtrato | null) =>
      e ? { fat: e.faturamento_ac ?? 0, com: comissao(e, base), pct: e.faturamento_ac ? comissao(e, base) / e.faturamento_ac : null } : null;
    const meses = MESES.map((nome, i) => ({ nome, m: i + 1, ant: linha(get(anoAnt, i + 1)), atu: linha(get(ano, i + 1)) }));
    const soma = (ls: ({ fat: number; com: number } | null)[]) => {
      const v = ls.filter(Boolean) as { fat: number; com: number }[];
      const fat = v.reduce((t, x) => t + x.fat, 0);
      const com = v.reduce((t, x) => t + x.com, 0);
      return { fat, com, pct: fat ? com / fat : null, n: v.length };
    };
    // acumulado: só meses que existem nos DOIS anos, até o mês selecionado
    const comuns = meses.filter((x) => x.m <= mesSel && x.ant && x.atu);
    const acAtu = soma(comuns.map((x) => x.atu));
    const acAnt = soma(comuns.map((x) => x.ant));
    const anoAntCheio = soma(meses.map((x) => x.ant));
    const doAno = meses.filter((x) => x.atu?.pct != null);
    const melhor = [...doAno].sort((a, b) => (b.atu!.pct ?? 0) - (a.atu!.pct ?? 0))[0];
    const pior = [...doAno].sort((a, b) => (a.atu!.pct ?? 0) - (b.atu!.pct ?? 0))[0];
    const sel = meses[mesSel - 1];
    return { ano, anoAnt, mesSel, meses, acAtu, acAnt, anoAntCheio, melhor, pior, sel, nComuns: comuns.length };
  }, [todos, periodo, base]);

  if (!d) return null;
  const temAnterior = d.meses.some((x) => x.ant);
  const serie = d.meses.map((x) => ({ mes: x.nome, ant: x.ant?.pct != null ? x.ant.pct * 100 : null, atu: x.atu?.pct != null ? x.atu.pct * 100 : null }));
  const pp = (a: number | null | undefined, b: number | null | undefined) => (a == null || b == null ? null : b - a);
  const lSel = periodoLabel(periodo.slice(0, 7));
  const lSelAnt = periodoLabel(`${d.anoAnt}-${periodo.slice(5, 7)}`);
  const ultimoComum = d.meses.filter((x) => x.m <= d.mesSel && x.ant && x.atu).pop();

  return (
    <Card className="mb-6">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Percent className="h-4 w-4 text-primary" /> Quanto ganhamos sobre o que vendemos · {d.ano} × {d.anoAnt}
          </CardTitle>
          <CardDescription>
            Comissão {base === "liquido" ? "líquida (o que cai na conta, após impostos retidos)" : "bruta (valor total do extrato)"} ÷ faturamento AC
            para a Nestlé. Cada mês = mês do PRESER.
          </CardDescription>
        </div>
        <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs font-medium">
          {(
            [
              ["liquido", "Líquido"],
              ["bruto", "Bruto"],
            ] as const
          ).map(([k, t]) => (
            <button key={k} onClick={() => setBase(k)} className={cn("rounded-md px-3 py-1", base === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {!temAnterior ? (
          <p className="text-sm text-muted-foreground">Importe os extratos de {d.anoAnt} para comparar.</p>
        ) : (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Mini
                rotulo={lSel}
                valor={fmtPct(d.sel.atu?.pct, 2)}
                sub={`${lSelAnt}: ${fmtPct(d.sel.ant?.pct, 2)}`}
                delta={pp(d.sel.ant?.pct, d.sel.atu?.pct)}
              />
              <Mini
                rotulo={`Acumulado ${d.ano}${ultimoComum ? ` (jan–${MESES[ultimoComum.m - 1].toLowerCase()})` : ""}`}
                valor={fmtPct(d.acAtu.pct, 2)}
                sub={`${d.anoAnt} mesmo período: ${fmtPct(d.acAnt.pct, 2)}`}
                delta={pp(d.acAnt.pct, d.acAtu.pct)}
              />
              <Mini
                rotulo={`${d.anoAnt} fechado (${d.anoAntCheio.n} meses)`}
                valor={fmtPct(d.anoAntCheio.pct, 2)}
                sub={`${fmtBRL(d.anoAntCheio.com, { compact: true })} ÷ ${fmtBRL(d.anoAntCheio.fat, { compact: true })}`}
              />
              <Mini
                rotulo={`Melhor e pior mês de ${d.ano}`}
                valor={`${fmtPct(d.melhor?.atu?.pct, 2)} · ${fmtPct(d.pior?.atu?.pct, 2)}`}
                sub={`${d.melhor?.nome ?? "—"} · ${d.pior?.nome ?? "—"}`}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={serie} margin={{ left: 0, right: 12, top: 4 }}>
                    <CartesianGrid stroke={C_GRADE} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11, fill: C_TINTA }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: C_TINTA }}
                      axisLine={false}
                      tickLine={false}
                      width={48}
                      domain={["auto", "auto"]}
                      tickFormatter={(v) => `${Number(v).toFixed(1).replace(".", ",")}%`}
                    />
                    <Tooltip formatter={(v: number) => `${v.toFixed(2).replace(".", ",")}%`} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line dataKey="ant" name={String(d.anoAnt)} stroke={C_COMP} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                    <Line dataKey="atu" name={String(d.ano)} stroke={C_ATUAL} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <Table className="tabular-nums [&_td]:whitespace-nowrap">
                <THead>
                  <Tr>
                    <Th>Mês</Th>
                    <Th className="text-right">Fat. {d.anoAnt}</Th>
                    <Th className="text-right">% {d.anoAnt}</Th>
                    <Th className="text-right">Fat. {d.ano}</Th>
                    <Th className="text-right">Comissão {d.ano}</Th>
                    <Th className="text-right">% {d.ano}</Th>
                    <Th className="text-right">Δ</Th>
                  </Tr>
                </THead>
                <TBody>
                  {d.meses
                    .filter((x) => x.ant || x.atu)
                    .map((x) => (
                      <Tr key={x.m} className={cn(x.m === d.mesSel && "bg-primary/5 font-semibold")}>
                        <Td>{x.nome}</Td>
                        <Td className="text-right text-muted-foreground">{fmtBRL(x.ant?.fat, { compact: true })}</Td>
                        <Td className="text-right text-muted-foreground">{fmtPct(x.ant?.pct, 2)}</Td>
                        <Td className="text-right">{fmtBRL(x.atu?.fat, { compact: true })}</Td>
                        <Td className="text-right">{fmtBRL(x.atu?.com, { compact: true })}</Td>
                        <Td className="text-right font-semibold">{fmtPct(x.atu?.pct, 2)}</Td>
                        <Td className="text-right">
                          <Pill v={pp(x.ant?.pct, x.atu?.pct)} pontos />
                        </Td>
                      </Tr>
                    ))}
                  <Tr className="bg-secondary/60 font-semibold hover:bg-secondary/60">
                    <Td>Acumulado</Td>
                    <Td className="text-right">{fmtBRL(d.acAnt.fat, { compact: true })}</Td>
                    <Td className="text-right">{fmtPct(d.acAnt.pct, 2)}</Td>
                    <Td className="text-right">{fmtBRL(d.acAtu.fat, { compact: true })}</Td>
                    <Td className="text-right">{fmtBRL(d.acAtu.com, { compact: true })}</Td>
                    <Td className="text-right">{fmtPct(d.acAtu.pct, 2)}</Td>
                    <Td className="text-right">
                      <Pill v={pp(d.acAnt.pct, d.acAtu.pct)} pontos />
                    </Td>
                  </Tr>
                </TBody>
              </Table>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Acumulado = só os meses que existem nos dois anos, até {lSel}. Δ em pontos percentuais: +0,50 p.p. = R$ 0,50 a mais a cada R$ 100 vendidos.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ rotulo, valor, sub, delta }: { rotulo: string; valor: string; sub: string; delta?: number | null }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{rotulo}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{valor}</p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
        {delta !== undefined && <Pill v={delta} pontos />}
        <span>{sub}</span>
      </div>
    </div>
  );
}
