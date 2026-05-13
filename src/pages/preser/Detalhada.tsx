import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Layers,
  TrendingDown,
  TrendingUp,
  Box,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PreserPeriodoFilter } from "@/components/PreserPeriodoFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { usePreserData } from "@/contexts/PreserDataContext";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PreserEmptyState } from "./PreserEmptyState";

const CORES = [
  "hsl(215 80% 48%)",
  "hsl(152 60% 42%)",
  "hsl(38 92% 50%)",
  "hsl(271 60% 56%)",
  "hsl(0 72% 55%)",
  "hsl(185 60% 42%)",
  "hsl(330 70% 50%)",
];

const CATEGORIA_CORES: Record<string, string> = {
  "Mix Pilar": "hsl(215 80% 48%)",
  "High Pull": "hsl(38 92% 50%)",
  "High High Pull": "hsl(271 60% 56%)",
  "Estratégico": "hsl(152 60% 42%)",
};

export default function PreserDetalhada() {
  const { loading, atual, extratos } = usePreserData();
  const [aba, setAba] = useState<"composicao" | "skus" | "drops" | "metas" | "kpis">("composicao");

  // ─── COMPOSIÇÃO geral ────────────────────────────────────────────────
  const composicao = useMemo(() => {
    if (!atual) return [];
    const totalSku = atual.skus.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const totalDrops = atual.drops.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const totalMetas = atual.metas.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const totalOutrosContab = atual.outros
      .filter((o) => o.contabilizado)
      .reduce((s, r) => s + (r.comissao ?? 0), 0);
    const totalOutrosDemo = atual.outros
      .filter((o) => !o.contabilizado)
      .reduce((s, r) => s + (r.comissao ?? 0), 0);

    return [
      { name: "SKUs (Crit 1)", value: totalSku, cor: CORES[0] },
      { name: "Drops (Crit 20)", value: totalDrops, cor: CORES[1] },
      { name: "Metas (VBC/Cob./Rec.)", value: totalMetas, cor: CORES[2] },
      { name: "Outros contabilizados", value: totalOutrosContab, cor: CORES[3] },
      { name: "Outros demonstrativos", value: totalOutrosDemo, cor: CORES[5] },
    ].filter((d) => d.value !== 0);
  }, [atual]);

  // ─── SKU: por categoria + por divisão ────────────────────────────────
  const skuPorCategoria = useMemo(() => {
    if (!atual) return [];
    const map = new Map<string, { nome: string; comissao: number; qtd: number; volume: number }>();
    for (const s of atual.skus) {
      const k = s.categoria_nome ?? "—";
      const v = map.get(k) ?? { nome: k, comissao: 0, qtd: 0, volume: 0 };
      v.comissao += s.comissao ?? 0;
      v.qtd += 1;
      v.volume += s.efetivo_total ?? 0;
      map.set(k, v);
    }
    return [...map.values()].sort((a, b) => b.comissao - a.comissao);
  }, [atual]);

  const skuPorDivisao = useMemo(() => {
    if (!atual) return [];
    const map = new Map<string, { nome: string; comissao: number; qtd: number; volume: number }>();
    for (const s of atual.skus) {
      const k = s.divisao ?? "—";
      const v = map.get(k) ?? { nome: k, comissao: 0, qtd: 0, volume: 0 };
      v.comissao += s.comissao ?? 0;
      v.qtd += 1;
      v.volume += s.efetivo_total ?? 0;
      map.set(k, v);
    }
    return [...map.values()].sort((a, b) => b.comissao - a.comissao);
  }, [atual]);

  // ─── KPIs avançados ──────────────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!atual) return null;
    const skus = atual.skus;
    const skusComCom = skus.filter((s) => (s.comissao ?? 0) > 0);
    const skusNegativos = skus.filter((s) => (s.comissao ?? 0) < 0);
    const totalSkus = skusComCom.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const totalNegativo = skusNegativos.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const mediaSku = skusComCom.length > 0 ? totalSkus / skusComCom.length : 0;

    // mediana
    const valores = skusComCom.map((s) => s.comissao ?? 0).sort((a, b) => a - b);
    const medianaSku = valores.length > 0
      ? valores.length % 2 === 0
        ? (valores[valores.length / 2 - 1] + valores[valores.length / 2]) / 2
        : valores[Math.floor(valores.length / 2)]
      : 0;

    const totalDrops = atual.drops.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const totalQtdDrops = atual.drops.reduce((s, r) => s + (r.qtd_drops ?? 0), 0);
    const rsMedioDrop = totalQtdDrops > 0 ? totalDrops / totalQtdDrops : 0;

    const totalMetas = atual.metas.reduce((s, r) => s + (r.comissao ?? 0), 0);
    const metasComComissao = atual.metas.filter((m) => (m.comissao ?? 0) > 0).length;
    const metasZeradas = atual.metas.filter((m) => (m.comissao ?? 0) === 0).length;

    const totalReceita = atual.extrato.valor_total_contabilizado ?? 0;
    const totalImpostos =
      (atual.extrato.irrf_retido ?? 0) +
      (atual.extrato.pis_retido ?? 0) +
      (atual.extrato.cofins_retido ?? 0) +
      (atual.extrato.csll_retido ?? 0);
    const totalLiquido = totalReceita - totalImpostos;
    const faturamentoAC = atual.extrato.faturamento_ac ?? 0;
    const pctEfetiva = faturamentoAC > 0 ? totalLiquido / faturamentoAC : 0;

    return {
      // Geral
      totalReceita,
      totalImpostos,
      totalLiquido,
      pctEfetiva,
      faturamentoAC,
      // SKUs
      qtdSkus: skus.length,
      qtdSkusAtivos: skusComCom.length,
      qtdSkusNegativos: skusNegativos.length,
      totalSkus,
      totalNegativoSku: totalNegativo,
      mediaSku,
      medianaSku,
      maiorSku: skusComCom.sort((a, b) => (b.comissao ?? 0) - (a.comissao ?? 0))[0] ?? null,
      menorSku: skusComCom.sort((a, b) => (a.comissao ?? 0) - (b.comissao ?? 0))[0] ?? null,
      // Drops
      qtdCanais: atual.drops.length,
      totalDrops,
      totalQtdDrops,
      rsMedioDrop,
      // Metas
      qtdMetas: atual.metas.length,
      totalMetas,
      metasComComissao,
      metasZeradas,
    };
  }, [atual]);

  if (loading) return <PageHeader title="Análise Detalhada" subtitle="Carregando…" />;
  if (extratos.length === 0 || !atual || !kpis) {
    return (
      <>
        <PageHeader title="Análise Detalhada" subtitle="Métricas e KPIs em profundidade" />
        <PreserEmptyState semExtrato />
      </>
    );
  }

  const totalComissao = atual.extrato.valor_total_comissao ?? 0;

  return (
    <>
      <PageHeader
        title="Análise Detalhada"
        subtitle={`${periodoLabel(atual.extrato.periodo.slice(0, 7))} • Todas as métricas e cortes`}
        actions={<PreserPeriodoFilter />}
      />

      {/* ── Tabs de abas internas ──────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { k: "composicao", l: "Composição Geral", icon: Layers },
          { k: "skus", l: "SKUs", icon: Box },
          { k: "drops", l: "Drops", icon: BarChart3 },
          { k: "metas", l: "Metas", icon: TrendingUp },
          { k: "kpis", l: "KPIs Avançados", icon: TrendingDown },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.k}
              onClick={() => setAba(t.k as typeof aba)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                aba === t.k
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.l}
            </button>
          );
        })}
      </div>

      {/* ── Aba: COMPOSIÇÃO ─────────────────────────────────────────── */}
      {aba === "composicao" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Comissão por seção</CardTitle>
              <CardDescription>De onde vem cada R$ no extrato.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={composicao}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {composicao.map((d, i) => (
                        <Cell key={i} fill={d.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [fmtBRL(v), ""]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Detalhamento</CardTitle>
              <CardDescription>Cada parcela com valor e participação no total.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <Tr>
                    <Th>Seção</Th>
                    <Th className="text-right">Comissão (R$)</Th>
                    <Th className="text-right">% do total</Th>
                  </Tr>
                </THead>
                <TBody>
                  {composicao.map((d) => (
                    <Tr key={d.name}>
                      <Td>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.cor }} />
                          {d.name}
                        </div>
                      </Td>
                      <Td className="text-right font-semibold">{fmtBRL(d.value)}</Td>
                      <Td className="text-right text-muted-foreground">
                        {fmtPct(totalComissao > 0 ? d.value / totalComissao : 0)}
                      </Td>
                    </Tr>
                  ))}
                  <Tr>
                    <Td className="font-bold">Total</Td>
                    <Td className="text-right font-bold">{fmtBRL(totalComissao)}</Td>
                    <Td className="text-right font-bold">100%</Td>
                  </Tr>
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Aba: SKUS ──────────────────────────────────────────────── */}
      {aba === "skus" && (
        <div className="grid grid-cols-1 gap-4">
          {/* Por categoria */}
          <Card>
            <CardHeader>
              <CardTitle>Por categoria de produto</CardTitle>
              <CardDescription>
                Mix Pilar (2,5%) · High Pull (1,15%) · High High Pull (0,25%) · Estratégico (4%)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <Tr>
                    <Th>Categoria</Th>
                    <Th className="text-right">Qtd SKUs</Th>
                    <Th className="text-right">Volume (R$)</Th>
                    <Th className="text-right">Comissão</Th>
                    <Th className="text-right">% efetiva</Th>
                  </Tr>
                </THead>
                <TBody>
                  {skuPorCategoria.map((d) => {
                    const pctEf = d.volume > 0 ? d.comissao / d.volume : 0;
                    return (
                      <Tr key={d.nome}>
                        <Td>
                          <Badge style={{ background: `${CATEGORIA_CORES[d.nome]}33`, color: CATEGORIA_CORES[d.nome], border: "none" }}>
                            {d.nome}
                          </Badge>
                        </Td>
                        <Td className="text-right">{fmtNum(d.qtd)}</Td>
                        <Td className="text-right text-muted-foreground">{fmtBRL(d.volume, { compact: true })}</Td>
                        <Td className="text-right font-bold">{fmtBRL(d.comissao)}</Td>
                        <Td className="text-right font-mono text-xs">{fmtPct(pctEf, 3)}</Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          {/* Por divisão */}
          <Card>
            <CardHeader>
              <CardTitle>Por divisão</CardTitle>
              <CardDescription>Linha Seca · Garoto · Professional.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={skuPorDivisao} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => fmtBRL(v, { compact: true })} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number, name) => [fmtBRL(v), name]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    />
                    <Bar dataKey="comissao" radius={[4, 4, 0, 0]} fill={CORES[0]} name="Comissão" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Top 10 + Bottom 5 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 SKUs por comissão</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <THead>
                    <Tr>
                      <Th>#</Th>
                      <Th>SKU</Th>
                      <Th className="text-right">Comissão</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {[...atual.skus]
                      .sort((a, b) => (b.comissao ?? 0) - (a.comissao ?? 0))
                      .slice(0, 10)
                      .map((s, i) => (
                        <Tr key={s.id}>
                          <Td className="text-xs text-muted-foreground">#{i + 1}</Td>
                          <Td className="max-w-[300px] truncate" title={s.grupo_nome}>
                            {s.grupo_nome}
                          </Td>
                          <Td className="text-right font-semibold">
                            {fmtBRL(s.comissao, { compact: true })}
                          </Td>
                        </Tr>
                      ))}
                  </TBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SKUs com comissão negativa</CardTitle>
                <CardDescription>Devoluções/ajustes que descontaram da comissão.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <THead>
                    <Tr>
                      <Th>SKU</Th>
                      <Th className="text-right">Comissão</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {[...atual.skus]
                      .filter((s) => (s.comissao ?? 0) < 0)
                      .sort((a, b) => (a.comissao ?? 0) - (b.comissao ?? 0))
                      .slice(0, 10)
                      .map((s) => (
                        <Tr key={s.id}>
                          <Td className="max-w-[300px] truncate text-xs" title={s.grupo_nome}>
                            {s.grupo_nome}
                          </Td>
                          <Td className="text-right font-semibold text-destructive">
                            {fmtBRL(s.comissao)}
                          </Td>
                        </Tr>
                      ))}
                    {atual.skus.filter((s) => (s.comissao ?? 0) < 0).length === 0 && (
                      <Tr>
                        <Td colSpan={2} className="text-center text-sm text-muted-foreground">
                          Sem comissões negativas.
                        </Td>
                      </Tr>
                    )}
                  </TBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── Aba: DROPS ─────────────────────────────────────────────── */}
      {aba === "drops" && (
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumo de Drops</CardTitle>
              <CardDescription>
                {fmtNum(kpis.totalQtdDrops)} drops · R$ médio:{" "}
                <strong>{fmtBRL(kpis.rsMedioDrop)}/drop</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...atual.drops].sort(
                      (a, b) => (b.comissao ?? 0) - (a.comissao ?? 0),
                    )}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis
                      dataKey="canal_nome"
                      tick={{ fontSize: 10 }}
                      angle={-30}
                      textAnchor="end"
                      height={70}
                    />
                    <YAxis tickFormatter={(v) => fmtBRL(v, { compact: true })} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: number) => [fmtBRL(v), "Comissão"]}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                    />
                    <Bar dataKey="comissao" radius={[4, 4, 0, 0]} fill={CORES[1]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <Tr>
                    <Th>Canal</Th>
                    <Th className="text-right">Qtd</Th>
                    <Th className="text-right">R$/drop base</Th>
                    <Th className="text-right">R$/drop calc.</Th>
                    <Th className="text-right">Comissão</Th>
                  </Tr>
                </THead>
                <TBody>
                  {[...atual.drops]
                    .sort((a, b) => (b.comissao ?? 0) - (a.comissao ?? 0))
                    .map((d) => (
                      <Tr key={d.id}>
                        <Td className="font-medium">{d.canal_nome}</Td>
                        <Td className="text-right">{fmtNum(d.qtd_drops)}</Td>
                        <Td className="text-right text-muted-foreground">{fmtBRL(d.rs_por_drop)}</Td>
                        <Td className="text-right text-muted-foreground">{fmtBRL(d.rs_calculado)}</Td>
                        <Td className="text-right font-semibold">{fmtBRL(d.comissao)}</Td>
                      </Tr>
                    ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Aba: METAS ──────────────────────────────────────────────── */}
      {aba === "metas" && (
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Resumo de Metas</CardTitle>
              <CardDescription>
                {kpis.qtdMetas} critérios · {kpis.metasComComissao} com comissão ·{" "}
                <span className="text-destructive font-semibold">{kpis.metasZeradas}</span> zeradas
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <Tr>
                    <Th>Cód.</Th>
                    <Th>Tipo</Th>
                    <Th>BU</Th>
                    <Th>Critério</Th>
                    <Th className="text-right">% Atingido</Th>
                    <Th className="text-right">Comissão</Th>
                  </Tr>
                </THead>
                <TBody>
                  {[...atual.metas]
                    .sort((a, b) => (b.comissao ?? 0) - (a.comissao ?? 0))
                    .map((m) => {
                      const com = m.comissao ?? 0;
                      return (
                        <Tr key={m.id}>
                          <Td className="font-mono text-xs text-muted-foreground">{m.criterio_codigo}</Td>
                          <Td>
                            <Badge variant="muted">{m.tipo}</Badge>
                          </Td>
                          <Td className="font-medium">{m.bu}</Td>
                          <Td className="max-w-[250px] truncate text-xs text-muted-foreground" title={m.criterio_nome ?? ""}>
                            {m.criterio_nome}
                          </Td>
                          <Td className="text-right font-mono text-xs">
                            {m.tipo === "Recomendador"
                              ? fmtPct(m.efetivo_fiscal ?? 0)
                              : fmtPct(
                                  m.objetivo_meta && m.objetivo_meta > 0
                                    ? (m.efetivo_fiscal ?? 0) / m.objetivo_meta
                                    : 0,
                                )}
                          </Td>
                          <Td className={cn("text-right font-semibold", com === 0 && "text-destructive", com > 0 && "text-success")}>
                            {fmtBRL(com)}
                          </Td>
                        </Tr>
                      );
                    })}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Aba: KPIS AVANÇADOS ─────────────────────────────────────── */}
      {aba === "kpis" && (
        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Métricas Gerais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Receita Bruta" value={fmtBRL(kpis.totalReceita)} />
              <Metric label="Total Impostos" value={fmtBRL(kpis.totalImpostos)} variant="destructive" />
              <Metric label="Receita Líquida" value={fmtBRL(kpis.totalLiquido)} variant="success" />
              <Metric label="% Efetiva s/ Fat." value={fmtPct(kpis.pctEfetiva, 3)} />
              <Metric label="Faturamento Nestlé" value={fmtBRL(kpis.faturamentoAC)} />
              <Metric label="Carga Tributária" value={fmtPct(kpis.totalReceita > 0 ? kpis.totalImpostos / kpis.totalReceita : 0, 2)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Métricas SKUs</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Total SKUs" value={fmtNum(kpis.qtdSkus)} />
              <Metric label="SKUs Ativos" value={fmtNum(kpis.qtdSkusAtivos)} variant="success" />
              <Metric label="SKUs Negativos" value={fmtNum(kpis.qtdSkusNegativos)} variant="destructive" />
              <Metric label="Comissão Negativa" value={fmtBRL(kpis.totalNegativoSku)} variant="destructive" />
              <Metric label="Média/SKU" value={fmtBRL(kpis.mediaSku)} />
              <Metric label="Mediana/SKU" value={fmtBRL(kpis.medianaSku)} />
              {kpis.maiorSku && <Metric label="Maior SKU" value={fmtBRL(kpis.maiorSku.comissao)} subValue={kpis.maiorSku.grupo_nome} />}
              {kpis.menorSku && <Metric label="Menor SKU positivo" value={fmtBRL(kpis.menorSku.comissao)} subValue={kpis.menorSku.grupo_nome} />}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Métricas Drops</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Total Drops" value={fmtNum(kpis.totalQtdDrops)} />
              <Metric label="Canais Ativos" value={fmtNum(kpis.qtdCanais)} />
              <Metric label="Comissão Drops" value={fmtBRL(kpis.totalDrops)} />
              <Metric label="R$ Médio/Drop" value={fmtBRL(kpis.rsMedioDrop)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Métricas Metas</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Total Metas" value={fmtNum(kpis.qtdMetas)} />
              <Metric label="Com Comissão" value={fmtNum(kpis.metasComComissao)} variant="success" />
              <Metric label="Zeradas" value={fmtNum(kpis.metasZeradas)} variant="destructive" />
              <Metric label="Comissão Total Metas" value={fmtBRL(kpis.totalMetas)} />
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function Metric({
  label,
  value,
  subValue,
  variant,
}: {
  label: string;
  value: string;
  subValue?: string;
  variant?: "success" | "destructive";
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-bold",
          variant === "success" && "text-success",
          variant === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
      {subValue && (
        <p className="text-[10px] text-muted-foreground truncate" title={subValue}>
          {subValue}
        </p>
      )}
    </div>
  );
}
