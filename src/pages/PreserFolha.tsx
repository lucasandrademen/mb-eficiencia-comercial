import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Briefcase,
  HandCoins,
  Percent,
  Receipt,
  Scale,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { ENCARGOS_PCT } from "@/lib/calculations";
import { listExtratos } from "@/lib/preser/api";
import type { PreserExtrato } from "@/lib/preser/types";
import { cn } from "@/lib/utils";

// Receita líquida = valor contabilizado − impostos retidos (IRRF + PIS + COFINS + CSLL)
function receitaLiquidaDoExtrato(ex: PreserExtrato): { bruta: number; impostos: number; liquida: number } {
  const bruta = ex.valor_total_contabilizado ?? ex.valor_total_comissao ?? 0;
  const impostos =
    (ex.irrf_retido ?? 0) +
    (ex.pis_retido ?? 0) +
    (ex.cofins_retido ?? 0) +
    (ex.csll_retido ?? 0);
  return { bruta, impostos, liquida: bruta - impostos };
}

type MesDRE = {
  periodo: string; // "YYYY-MM"
  label: string;
  receitaBruta: number;
  impostos: number;
  receitaLiquida: number;
  folhaComercial: number;
  folhaSuporte: number;
  folhaTotal: number;
  headcount: number;
  resultado: number;
  margem: number;
  temPreser: boolean;
  temFolha: boolean;
};

export default function PreserFolha() {
  const { dataset, rowsAll, periodosSelecionados } = useData();

  const [extratos, setExtratos] = useState<PreserExtrato[]>([]);
  const [carregandoPreser, setCarregandoPreser] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        setExtratos(await listExtratos());
      } catch {
        setExtratos([]);
      } finally {
        setCarregandoPreser(false);
      }
    })();
  }, []);

  // ─── Classificação comercial × suporte (cruza folha com vendedores) ──────
  const idsComerciais = useMemo(() => {
    const codigos = new Set<string>();
    const nomes = new Set<string>();
    for (const r of rowsAll) {
      codigos.add(r.vendedor_id);
      nomes.add(normaliza(r.vendedor_nome));
    }
    return { codigos, nomes };
  }, [rowsAll]);

  // ─── DRE mensal: união dos meses com folha e/ou PRESER ───────────────────
  const dreMensal = useMemo<MesDRE[]>(() => {
    const map = new Map<string, MesDRE>();
    const get = (periodo: string): MesDRE => {
      let v = map.get(periodo);
      if (!v) {
        v = {
          periodo,
          label: periodoLabel(periodo),
          receitaBruta: 0,
          impostos: 0,
          receitaLiquida: 0,
          folhaComercial: 0,
          folhaSuporte: 0,
          folhaTotal: 0,
          headcount: 0,
          resultado: 0,
          margem: 0,
          temPreser: false,
          temFolha: false,
        };
        map.set(periodo, v);
      }
      return v;
    };

    for (const ex of extratos) {
      const v = get(ex.periodo.slice(0, 7));
      const r = receitaLiquidaDoExtrato(ex);
      v.receitaBruta += r.bruta;
      v.impostos += r.impostos;
      v.receitaLiquida += r.liquida;
      v.temPreser = true;
    }

    for (const f of dataset.folha ?? []) {
      const v = get(f.periodo);
      const custo = f.bruto * (1 + ENCARGOS_PCT);
      const eComercial =
        idsComerciais.codigos.has(f.codigo) || idsComerciais.nomes.has(normaliza(f.nome));
      if (eComercial) v.folhaComercial += custo;
      else v.folhaSuporte += custo;
      v.folhaTotal += custo;
      v.headcount += 1;
      v.temFolha = true;
    }

    return [...map.values()]
      .map((v) => ({
        ...v,
        resultado: v.receitaLiquida - v.folhaTotal,
        margem: v.receitaLiquida > 0 ? (v.receitaLiquida - v.folhaTotal) / v.receitaLiquida : 0,
      }))
      .sort((a, b) => a.periodo.localeCompare(b.periodo));
  }, [extratos, dataset.folha, idsComerciais]);

  // ─── KPIs do período selecionado (vazio = todos os meses) ────────────────
  const mesesEscopo = useMemo(() => {
    if (periodosSelecionados.length === 0) return dreMensal;
    const set = new Set(periodosSelecionados);
    return dreMensal.filter((m) => set.has(m.periodo));
  }, [dreMensal, periodosSelecionados]);

  const kpis = useMemo(() => {
    const receitaLiquida = mesesEscopo.reduce((s, m) => s + m.receitaLiquida, 0);
    const receitaBruta = mesesEscopo.reduce((s, m) => s + m.receitaBruta, 0);
    const impostos = mesesEscopo.reduce((s, m) => s + m.impostos, 0);
    const folhaTotal = mesesEscopo.reduce((s, m) => s + m.folhaTotal, 0);
    const folhaComercial = mesesEscopo.reduce((s, m) => s + m.folhaComercial, 0);
    const folhaSuporte = mesesEscopo.reduce((s, m) => s + m.folhaSuporte, 0);
    const resultado = receitaLiquida - folhaTotal;
    const margem = receitaLiquida > 0 ? resultado / receitaLiquida : 0;
    const semPreser = !mesesEscopo.some((m) => m.temPreser);
    const semFolha = !mesesEscopo.some((m) => m.temFolha);
    return { receitaLiquida, receitaBruta, impostos, folhaTotal, folhaComercial, folhaSuporte, resultado, margem, semPreser, semFolha };
  }, [mesesEscopo]);

  // Meses incompletos no escopo (falta PRESER ou folha)
  const incompletos = useMemo(
    () => mesesEscopo.filter((m) => !m.temPreser || !m.temFolha),
    [mesesEscopo],
  );

  if (!carregandoPreser && extratos.length === 0 && (dataset.folha?.length ?? 0) === 0) {
    return (
      <>
        <PageHeader
          title="PRESER × Folha"
          subtitle="Resultado real da operação: comissão recebida menos folha completa."
        />
        <EmptyState
          title="Faltam dados"
          description="Importe a folha de pagamento (Importação) e os extratos PRESER (Importar Extrato) para ver o resultado real."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="PRESER × Folha"
        subtitle={
          <>
            Resultado real da operação — <strong>comissão líquida de impostos</strong> menos{" "}
            <strong>folha completa com encargos</strong>.
          </>
        }
        actions={<PeriodoFilter />}
      />

      {/* ── Alerta: meses incompletos ──────────────────────────────── */}
      {incompletos.length > 0 && (
        <div className="mb-4 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <div className="flex items-start gap-2 text-xs">
            <span className="text-warning">⚠️</span>
            <div>
              <p className="font-semibold text-warning">Meses com dados incompletos no escopo:</p>
              <p className="mt-0.5 text-muted-foreground">
                {incompletos
                  .map(
                    (m) =>
                      `${m.label} (falta ${[!m.temPreser && "extrato PRESER", !m.temFolha && "folha"]
                        .filter(Boolean)
                        .join(" e ")})`,
                  )
                  .join(" · ")}
                {" — "}o resultado desses meses fica distorcido até a importação.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO: o DRE em 4 números ───────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Receita PRESER (líquida)"
          value={kpis.semPreser ? "—" : fmtBRL(kpis.receitaLiquida, { compact: true })}
          subtitle={
            kpis.semPreser
              ? "Sem extrato PRESER no período"
              : `Contabilizado ${fmtBRL(kpis.receitaBruta, { compact: true })} − impostos ${fmtBRL(kpis.impostos, { compact: true })}`
          }
          icon={HandCoins}
          variant={kpis.semPreser ? "warning" : "primary"}
        />
        <MetricCard
          title="Folha Total (c/ encargos)"
          value={fmtBRL(kpis.folhaTotal, { compact: true })}
          subtitle={`Comercial ${fmtBRL(kpis.folhaComercial, { compact: true })} + Estrutura ${fmtBRL(kpis.folhaSuporte, { compact: true })}`}
          icon={Receipt}
          variant="destructive"
        />
        <MetricCard
          title="Resultado Real"
          value={kpis.semPreser || kpis.semFolha ? "—" : fmtBRL(kpis.resultado, { compact: true })}
          subtitle={
            kpis.semPreser || kpis.semFolha
              ? "Importe PRESER e folha do período"
              : "Receita líquida − folha completa"
          }
          icon={Scale}
          variant={
            kpis.semPreser || kpis.semFolha
              ? "warning"
              : kpis.resultado >= 0
                ? "success"
                : "destructive"
          }
        />
        <MetricCard
          title="Margem"
          value={kpis.receitaLiquida > 0 ? fmtPct(kpis.margem) : "—"}
          subtitle={
            kpis.receitaLiquida > 0
              ? `Folha consome ${fmtPct(kpis.folhaTotal / kpis.receitaLiquida, 0)} da comissão`
              : "Sem PRESER no período"
          }
          icon={Percent}
          variant={kpis.margem >= 0.2 ? "success" : kpis.margem >= 0 ? "warning" : "destructive"}
        />
      </div>

      {/* ── Receita × Folha por mês + Margem ───────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              Receita × Folha por mês
            </CardTitle>
            <CardDescription>
              Comissão líquida recebida vs. custo total da folha — a linha é o resultado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dreMensal.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dreMensal} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      tickFormatter={(v) => fmtBRL(v, { compact: true })}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip content={<DreTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar
                      dataKey="receitaLiquida"
                      name="Receita líquida"
                      fill="hsl(215 80% 48%)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="folhaTotal"
                      name="Folha total"
                      fill="hsl(0 72% 55%)"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      type="monotone"
                      dataKey="resultado"
                      name="Resultado"
                      stroke="hsl(152 60% 42%)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-success" />
              Margem por mês
            </CardTitle>
            <CardDescription>% da comissão que sobra após a folha.</CardDescription>
          </CardHeader>
          <CardContent>
            {dreMensal.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Sem dados.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dreMensal.filter((m) => m.temPreser)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis
                      tickFormatter={(v) => fmtPct(v, 0)}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      formatter={(v: number) => [fmtPct(v), "Margem"]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="margem"
                      stroke="hsl(152 60% 42%)"
                      strokeWidth={2.5}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Composição da folha: comercial × estrutura ─────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Composição da folha por mês
          </CardTitle>
          <CardDescription>
            <strong>Equipe comercial</strong> = colaboradores com vendas no Consolidado Preser ·{" "}
            <strong>Estrutura</strong> = administrativo, logística e demais setores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dreMensal.filter((m) => m.temFolha).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Sem folha importada.
            </p>
          ) : (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={dreMensal.filter((m) => m.temFolha)}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis
                    tickFormatter={(v) => fmtBRL(v, { compact: true })}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [fmtBRL(v), name]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="folhaComercial"
                    name="Equipe comercial"
                    stackId="folha"
                    fill="hsl(215 80% 48%)"
                  />
                  <Bar
                    dataKey="folhaSuporte"
                    name="Estrutura"
                    stackId="folha"
                    fill="hsl(38 92% 50%)"
                    radius={[4, 4, 0, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tabela: DRE mês a mês ──────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            DRE simplificado mês a mês
          </CardTitle>
          <CardDescription>
            Receita PRESER líquida de impostos, folha completa (bruto × {fmtNum(1 + ENCARGOS_PCT, 4)}) e resultado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>Mês</Th>
                <Th className="text-right">Receita líquida</Th>
                <Th className="text-right">Folha comercial</Th>
                <Th className="text-right">Folha estrutura</Th>
                <Th className="text-right">Folha total</Th>
                <Th className="text-right">Resultado</Th>
                <Th className="text-right">Margem</Th>
                <Th className="text-right">Status</Th>
              </Tr>
            </THead>
            <TBody>
              {dreMensal.map((m) => (
                <Tr key={m.periodo}>
                  <Td className="font-medium">{m.label}</Td>
                  <Td className="text-right">
                    {m.temPreser ? fmtBRL(m.receitaLiquida, { compact: true }) : "—"}
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    {m.temFolha ? fmtBRL(m.folhaComercial, { compact: true }) : "—"}
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    {m.temFolha ? fmtBRL(m.folhaSuporte, { compact: true }) : "—"}
                  </Td>
                  <Td className="text-right font-semibold text-destructive">
                    {m.temFolha ? fmtBRL(m.folhaTotal, { compact: true }) : "—"}
                  </Td>
                  <Td
                    className={cn(
                      "text-right font-bold",
                      m.temPreser && m.temFolha
                        ? m.resultado >= 0
                          ? "text-success"
                          : "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {m.temPreser && m.temFolha ? fmtBRL(m.resultado, { compact: true }) : "—"}
                  </Td>
                  <Td className="text-right">
                    {m.temPreser && m.temFolha ? (
                      <span
                        className={cn(
                          "font-mono text-xs font-bold",
                          m.margem >= 0.2 ? "text-success" : m.margem >= 0 ? "text-warning" : "text-destructive",
                        )}
                      >
                        {fmtPct(m.margem)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td className="text-right">
                    {m.temPreser && m.temFolha ? (
                      <Badge variant="success" className="text-[10px]">completo</Badge>
                    ) : (
                      <Badge variant="muted" className="text-[10px]">
                        falta {[!m.temPreser && "PRESER", !m.temFolha && "folha"].filter(Boolean).join(" e ")}
                      </Badge>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {mesesEscopo.length > 0 && (
            <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-4 py-2.5 text-sm">
              <span className="font-bold text-muted-foreground">
                Total {periodosSelecionados.length === 0 ? "(todos os meses)" : "(escopo)"}
              </span>
              <div className="flex items-center gap-6 text-right text-xs">
                <span>Receita: <strong>{fmtBRL(kpis.receitaLiquida)}</strong></span>
                <span>Folha: <strong className="text-destructive">{fmtBRL(kpis.folhaTotal)}</strong></span>
                <span
                  className={cn("font-bold", kpis.resultado >= 0 ? "text-success" : "text-destructive")}
                >
                  Resultado: {fmtBRL(kpis.resultado)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── Subcomponents / helpers ─────────────────────────────────────────

function DreTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as MesDRE;
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-xs shadow-elevated">
      <div className="mb-2 font-semibold">{label}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Receita líquida:</span>
        <span className="text-right font-medium">{d.temPreser ? fmtBRL(d.receitaLiquida) : "sem PRESER"}</span>
        <span className="text-muted-foreground">Folha total:</span>
        <span className="text-right font-medium">{d.temFolha ? fmtBRL(d.folhaTotal) : "sem folha"}</span>
        <span className="text-muted-foreground">Resultado:</span>
        <span className={cn("text-right font-medium", d.resultado < 0 && "text-destructive")}>
          {d.temPreser && d.temFolha ? fmtBRL(d.resultado) : "—"}
        </span>
        <span className="text-muted-foreground">Margem:</span>
        <span className="text-right font-medium">
          {d.temPreser && d.temFolha ? fmtPct(d.margem) : "—"}
        </span>
      </div>
    </div>
  );
}

function normaliza(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
