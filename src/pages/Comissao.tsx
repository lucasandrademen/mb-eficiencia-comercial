import { useMemo, useState } from "react";
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
import {
  BadgeDollarSign,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  DollarSign,
  Percent,
  Trophy,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { Quadrante, QUADRANTES_ORDER } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Configuração de taxas de comissão por quadrante ──────────────────────

const TAXA_PADRAO = 0.02; // 2% padrão sobre faturamento

const TAXA_POR_QUADRANTE: Record<Quadrante, number> = {
  Estrela: 0.025,
  "Trator caro": 0.02,
  Potencial: 0.02,
  "Alerta vermelho": 0.015,
  "—": 0.02,
};

const QUADRANTE_COLORS: Record<Quadrante, string> = {
  Estrela: "hsl(152 60% 42%)",
  "Trator caro": "hsl(38 92% 50%)",
  Potencial: "hsl(215 80% 48%)",
  "Alerta vermelho": "hsl(0 72% 55%)",
  "—": "hsl(220 10% 50%)",
};

const QUADRANTE_BADGE: Record<Quadrante, "success" | "warning" | "default" | "destructive" | "muted"> = {
  Estrela: "success",
  "Trator caro": "warning",
  Potencial: "default",
  "Alerta vermelho": "destructive",
  "—": "muted",
};

type SortKey = "vendedor_nome" | "faturamento" | "taxa" | "comissao" | "quadrante" | "supervisor";
type Dir = "asc" | "desc";

export default function Comissao() {
  const { rows, periodosSelecionados } = useData();
  const [taxaGlobal, setTaxaGlobal] = useState<string>(""); // vazio = usa por quadrante
  const [usarTaxaGlobal, setUsarTaxaGlobal] = useState(false);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("comissao");
  const [dir, setDir] = useState<Dir>("desc");

  const taxaNum = useMemo(() => {
    if (!usarTaxaGlobal) return null;
    const v = parseFloat(taxaGlobal.replace(",", ".")) / 100;
    return isNaN(v) || v < 0 ? null : v;
  }, [usarTaxaGlobal, taxaGlobal]);

  // ─── Linhas com comissão calculada ──────────────────────────────────────
  const linhas = useMemo(() => {
    return rows
      .filter((r) => !r.is_supervisor)
      .map((r) => {
        const taxa =
          taxaNum !== null ? taxaNum : TAXA_POR_QUADRANTE[r.quadrante_performance] ?? TAXA_PADRAO;
        const comissao = r.faturamento * taxa;
        return { ...r, taxa, comissao };
      });
  }, [rows, taxaNum]);

  // ─── KPIs ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = linhas.reduce((s, r) => s + r.comissao, 0);
    const fatTotal = linhas.reduce((s, r) => s + r.faturamento, 0);
    const media = linhas.length ? total / linhas.length : 0;
    const melhor = [...linhas].sort((a, b) => b.comissao - a.comissao)[0] ?? null;
    const taxaEfetiva = fatTotal > 0 ? total / fatTotal : 0;
    return { total, media, melhor, taxaEfetiva, n: linhas.length };
  }, [linhas]);

  // ─── Por quadrante ───────────────────────────────────────────────────────
  const porQuadrante = useMemo(() => {
    return QUADRANTES_ORDER.map((q) => {
      const sub = linhas.filter((r) => r.quadrante_performance === q);
      return {
        quadrante: q,
        vendedores: sub.length,
        faturamento: sub.reduce((s, r) => s + r.faturamento, 0),
        comissao: sub.reduce((s, r) => s + r.comissao, 0),
        taxa: TAXA_POR_QUADRANTE[q],
      };
    }).filter((r) => r.vendedores > 0);
  }, [linhas]);

  // ─── Filtro + sort ───────────────────────────────────────────────────────
  const linhasFiltradas = useMemo(() => {
    let out = linhas;
    if (q) {
      const needle = q.toLowerCase();
      out = out.filter(
        (r) =>
          r.vendedor_nome.toLowerCase().includes(needle) ||
          r.supervisor.toLowerCase().includes(needle) ||
          r.quadrante_performance.toLowerCase().includes(needle),
      );
    }
    return [...out].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case "vendedor_nome": av = a.vendedor_nome; bv = b.vendedor_nome; break;
        case "supervisor":    av = a.supervisor;    bv = b.supervisor;    break;
        case "quadrante":     av = a.quadrante_performance; bv = b.quadrante_performance; break;
        case "faturamento":   av = a.faturamento;   bv = b.faturamento;   break;
        case "taxa":          av = a.taxa;           bv = b.taxa;          break;
        case "comissao":      av = a.comissao;       bv = b.comissao;      break;
        default:              av = a.comissao;       bv = b.comissao;
      }
      if (typeof av === "string") return dir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [linhas, q, sortKey, dir]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setDir(["vendedor_nome", "supervisor", "quadrante"].includes(key) ? "asc" : "desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronsUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />;
    return dir === "asc"
      ? <ChevronUp className="ml-1 inline h-3 w-3 text-primary" />
      : <ChevronDown className="ml-1 inline h-3 w-3 text-primary" />;
  };

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Comissão" subtitle="Cálculo de comissão variável por vendedor." />
        <EmptyState
          title="Nenhum dado importado"
          description="Importe as planilhas de vendedores e carteira na aba Importação para calcular as comissões."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Comissão Variável"
        subtitle={
          periodosSelecionados.length === 0
            ? `Consolidado de ${new Set(rows.map((r) => r.periodo)).size} mês(es) • ${kpis.n} vendedores`
            : `${periodosSelecionados.map((p) => periodoLabel(p)).join(" • ")} • ${kpis.n} vendedores`
        }
        actions={<PeriodoFilter />}
      />

      {/* ── Taxa configurável ──────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Modo de taxa:</span>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              checked={!usarTaxaGlobal}
              onChange={() => setUsarTaxaGlobal(false)}
              className="accent-primary"
            />
            <span>Por quadrante</span>
            <span className="text-xs text-muted-foreground">
              (Estrela 2,5% · Trator/Potencial 2% · Alerta 1,5%)
            </span>
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              checked={usarTaxaGlobal}
              onChange={() => setUsarTaxaGlobal(true)}
              className="accent-primary"
            />
            <span>Taxa global</span>
          </label>

          {usarTaxaGlobal && (
            <div className="flex items-center gap-1.5">
              <Input
                value={taxaGlobal}
                onChange={(e) => setTaxaGlobal(e.target.value)}
                placeholder="2,00"
                className="w-24 text-right"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── KPIs ──────────────────────────────────────────────────────────── */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          title="Total de comissões"
          value={fmtBRL(kpis.total, { compact: true })}
          subtitle={fmtBRL(kpis.total)}
          icon={BadgeDollarSign}
          variant="primary"
        />
        <MetricCard
          title="Taxa efetiva média"
          value={fmtPct(kpis.taxaEfetiva, 2)}
          subtitle="sobre faturamento total"
          icon={Percent}
          variant="success"
        />
        <MetricCard
          title="Média por vendedor"
          value={fmtBRL(kpis.media, { compact: true })}
          subtitle={`${fmtNum(kpis.n)} vendedores`}
          icon={Users}
          variant="default"
        />
        {kpis.melhor && (
          <MetricCard
            title="Maior comissão"
            value={fmtBRL(kpis.melhor.comissao, { compact: true })}
            subtitle={kpis.melhor.vendedor_nome}
            icon={Trophy}
            variant="warning"
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* ── Gráfico por quadrante ────────────────────────────────────────── */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Comissão por quadrante</CardTitle>
            <CardDescription>Total pago por categoria de performance.</CardDescription>
          </CardHeader>
          <CardContent className="pb-2">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porQuadrante} layout="vertical" margin={{ left: 0, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => fmtBRL(v, { compact: true })}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="quadrante"
                  width={105}
                  tick={{ fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [fmtBRL(v), "Comissão"]}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="comissao" radius={[0, 4, 4, 0]}>
                  {porQuadrante.map((entry) => (
                    <Cell
                      key={entry.quadrante}
                      fill={QUADRANTE_COLORS[entry.quadrante as Quadrante]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legenda de taxas */}
            <div className="mt-2 space-y-1 border-t border-border pt-3">
              {porQuadrante.map((r) => (
                <div key={r.quadrante} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: QUADRANTE_COLORS[r.quadrante as Quadrante] }}
                    />
                    <span className="text-muted-foreground">{r.quadrante}</span>
                    <span className="text-muted-foreground/60">
                      ({fmtNum(r.vendedores)} vend. · {fmtPct(usarTaxaGlobal && taxaNum !== null ? taxaNum : r.taxa, 2)})
                    </span>
                  </div>
                  <span className="font-medium">{fmtBRL(r.comissao, { compact: true })}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Tabela ranking ───────────────────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Ranking por comissão</CardTitle>
                <CardDescription>Comissão variável por vendedor no período.</CardDescription>
              </div>
              <div className="relative w-56">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar vendedor…"
                  className="pl-3 pr-3"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[520px] overflow-y-auto">
              <Table>
                <THead>
                  <Tr>
                    <Th className="w-8">#</Th>
                    <Th
                      className="cursor-pointer select-none"
                      onClick={() => onSort("vendedor_nome")}
                    >
                      Vendedor <SortIcon k="vendedor_nome" />
                    </Th>
                    <Th
                      className="cursor-pointer select-none"
                      onClick={() => onSort("quadrante")}
                    >
                      Quadrante <SortIcon k="quadrante" />
                    </Th>
                    <Th
                      className="cursor-pointer select-none text-right"
                      onClick={() => onSort("faturamento")}
                    >
                      Faturamento <SortIcon k="faturamento" />
                    </Th>
                    <Th
                      className="cursor-pointer select-none text-right"
                      onClick={() => onSort("taxa")}
                    >
                      Taxa <SortIcon k="taxa" />
                    </Th>
                    <Th
                      className="cursor-pointer select-none text-right"
                      onClick={() => onSort("comissao")}
                    >
                      Comissão <SortIcon k="comissao" />
                    </Th>
                  </Tr>
                </THead>
                <TBody>
                  {linhasFiltradas.map((r, i) => {
                    const rank =
                      sortKey === "comissao" && dir === "desc" ? i + 1 : null;
                    return (
                      <Tr key={`${r.periodo}|${r.vendedor_id}`}>
                        <Td className="text-center text-xs text-muted-foreground">
                          {rank ?? "—"}
                        </Td>
                        <Td>
                          <div className="font-medium leading-tight">{r.vendedor_nome}</div>
                          {r.supervisor !== "—" && (
                            <div className="text-xs text-muted-foreground">
                              {r.supervisor}
                            </div>
                          )}
                        </Td>
                        <Td>
                          <Badge variant={QUADRANTE_BADGE[r.quadrante_performance]}>
                            {r.quadrante_performance}
                          </Badge>
                        </Td>
                        <Td className="text-right text-muted-foreground">
                          {fmtBRL(r.faturamento, { compact: true })}
                        </Td>
                        <Td className="text-right font-mono text-xs">
                          {fmtPct(r.taxa, 2)}
                        </Td>
                        <Td
                          className={cn(
                            "text-right font-semibold",
                            i === 0 && sortKey === "comissao" && dir === "desc"
                              ? "text-success"
                              : "",
                          )}
                        >
                          {fmtBRL(r.comissao)}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
              {linhasFiltradas.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum resultado para "{q}".
                </p>
              )}
            </div>
            {/* Footer totals */}
            <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-4 py-2.5 text-sm">
              <span className="font-semibold text-muted-foreground">
                Total ({fmtNum(linhasFiltradas.length)} vendedores)
              </span>
              <div className="flex items-center gap-6 text-right">
                <span className="text-muted-foreground">
                  {fmtBRL(
                    linhasFiltradas.reduce((s, r) => s + r.faturamento, 0),
                    { compact: true },
                  )}
                </span>
                <span className="font-bold text-primary">
                  {fmtBRL(linhasFiltradas.reduce((s, r) => s + r.comissao, 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
