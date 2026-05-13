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
  Building2,
  DollarSign,
  Percent,
  Search,
  Users,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { ENCARGOS_PCT } from "@/lib/calculations";
import { cn } from "@/lib/utils";

const CORES_DEPT = [
  "hsl(215 80% 48%)",
  "hsl(152 60% 42%)",
  "hsl(38 92% 50%)",
  "hsl(271 60% 56%)",
  "hsl(0 72% 55%)",
  "hsl(185 60% 42%)",
  "hsl(330 70% 50%)",
  "hsl(45 80% 55%)",
  "hsl(195 70% 45%)",
  "hsl(255 60% 55%)",
];

type SortKey =
  | "departamento"
  | "qtd"
  | "custoTotal"
  | "faturamento"
  | "pctCustoSobreFatTotal"
  | "pctCustoSobreFatDept";

type Dir = "asc" | "desc";

export default function CustosSetor() {
  const { dataset, rows, periodosSelecionados } = useData();
  const [filtroDept, setFiltroDept] = useState<string>("all");
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("custoTotal");
  const [dir, setDir] = useState<Dir>("desc");

  // ─── Filtra folha pelos períodos selecionados ─────────────────────
  const folhaFiltrada = useMemo(() => {
    if (periodosSelecionados.length === 0) return dataset.folha ?? [];
    return (dataset.folha ?? []).filter((f) => periodosSelecionados.includes(f.periodo));
  }, [dataset.folha, periodosSelecionados]);

  // ─── Mapa de faturamento por NOME (cruza folha → vendedor) ────────
  const faturamentoPorCodigoNome = useMemo(() => {
    const byCodigo = new Map<string, number>();
    const byNome = new Map<string, number>();
    for (const v of rows) {
      byCodigo.set(v.vendedor_id, (byCodigo.get(v.vendedor_id) ?? 0) + v.faturamento);
      const k = normaliza(v.vendedor_nome);
      byNome.set(k, (byNome.get(k) ?? 0) + v.faturamento);
    }
    return { byCodigo, byNome };
  }, [rows]);

  // ─── Folha enriquecida: adiciona faturamento de cada funcionário ──
  const folhaEnriquecida = useMemo(() => {
    return folhaFiltrada.map((f) => {
      const encargos = f.bruto * ENCARGOS_PCT;
      const custoTotal = f.bruto + encargos;
      const fatPorCodigo = faturamentoPorCodigoNome.byCodigo.get(f.codigo) ?? 0;
      const fatPorNome = faturamentoPorCodigoNome.byNome.get(normaliza(f.nome)) ?? 0;
      const faturamento = fatPorCodigo > 0 ? fatPorCodigo : fatPorNome;
      const pctCustoSobreFat = faturamento > 0 ? custoTotal / faturamento : 0;
      return {
        ...f,
        encargos,
        custoTotal,
        faturamento,
        pctCustoSobreFat,
        eVendedor: faturamento > 0,
      };
    });
  }, [folhaFiltrada, faturamentoPorCodigoNome]);

  // ─── Faturamento total (independente de match) ────────────────────
  const faturamentoTotal = useMemo(
    () => rows.reduce((s, r) => s + r.faturamento, 0),
    [rows],
  );

  // ─── Agrupado por departamento ────────────────────────────────────
  const porDepartamento = useMemo(() => {
    const map = new Map<
      string,
      {
        departamento: string;
        qtd: number;
        bruto: number;
        encargos: number;
        custoTotal: number;
        faturamento: number;
        vendedores: number;
      }
    >();
    for (const f of folhaEnriquecida) {
      const k = f.departamento || "—";
      const v = map.get(k) ?? {
        departamento: k,
        qtd: 0,
        bruto: 0,
        encargos: 0,
        custoTotal: 0,
        faturamento: 0,
        vendedores: 0,
      };
      v.qtd += 1;
      v.bruto += f.bruto;
      v.encargos += f.encargos;
      v.custoTotal += f.custoTotal;
      v.faturamento += f.faturamento;
      if (f.eVendedor) v.vendedores += 1;
      map.set(k, v);
    }
    return [...map.values()].map((d) => ({
      ...d,
      pctCustoSobreFatTotal: faturamentoTotal > 0 ? d.custoTotal / faturamentoTotal : 0,
      pctCustoSobreFatDept: d.faturamento > 0 ? d.custoTotal / d.faturamento : 0,
    }));
  }, [folhaEnriquecida, faturamentoTotal]);

  // ─── Tabela ordenada ──────────────────────────────────────────────
  const deptOrdenado = useMemo(() => {
    return [...porDepartamento].sort((a, b) => {
      let av: number | string, bv: number | string;
      switch (sortKey) {
        case "departamento": av = a.departamento; bv = b.departamento; break;
        case "qtd": av = a.qtd; bv = b.qtd; break;
        case "custoTotal": av = a.custoTotal; bv = b.custoTotal; break;
        case "faturamento": av = a.faturamento; bv = b.faturamento; break;
        case "pctCustoSobreFatTotal": av = a.pctCustoSobreFatTotal; bv = b.pctCustoSobreFatTotal; break;
        case "pctCustoSobreFatDept": av = a.pctCustoSobreFatDept; bv = b.pctCustoSobreFatDept; break;
      }
      if (typeof av === "string") return dir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [porDepartamento, sortKey, dir]);

  // ─── Funcionários filtrados ──────────────────────────────────────
  const funcionariosFiltrados = useMemo(() => {
    let out = folhaEnriquecida;
    if (filtroDept !== "all") out = out.filter((f) => (f.departamento || "—") === filtroDept);
    if (busca) {
      const needle = busca.toLowerCase();
      out = out.filter(
        (f) =>
          f.nome.toLowerCase().includes(needle) ||
          f.cargo.toLowerCase().includes(needle) ||
          f.codigo.includes(needle),
      );
    }
    return out.sort((a, b) => b.custoTotal - a.custoTotal);
  }, [folhaEnriquecida, filtroDept, busca]);

  // ─── KPIs ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const custoBruto = folhaEnriquecida.reduce((s, f) => s + f.bruto, 0);
    const custoEncargos = folhaEnriquecida.reduce((s, f) => s + f.encargos, 0);
    const custoTotal = folhaEnriquecida.reduce((s, f) => s + f.custoTotal, 0);
    const headcount = folhaEnriquecida.length;
    const pctCustoFat = faturamentoTotal > 0 ? custoTotal / faturamentoTotal : 0;
    const resultadoBruto = faturamentoTotal - custoTotal;
    return { custoBruto, custoEncargos, custoTotal, headcount, pctCustoFat, resultadoBruto };
  }, [folhaEnriquecida, faturamentoTotal]);

  const depts = useMemo(
    () => Array.from(new Set((folhaEnriquecida).map((f) => f.departamento || "—"))).sort(),
    [folhaEnriquecida],
  );

  const onSort = (k: SortKey) => {
    if (sortKey === k) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setDir(k === "departamento" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k
      ? <ChevronsUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />
      : dir === "asc"
        ? <ChevronUp className="ml-1 inline h-3 w-3 text-primary" />
        : <ChevronDown className="ml-1 inline h-3 w-3 text-primary" />;

  if ((dataset.folha?.length ?? 0) === 0 || rows.length === 0) {
    return (
      <>
        <PageHeader
          title="Custos por Setor"
          subtitle="Confronto entre folha de pagamento e faturamento gerado."
        />
        <EmptyState
          title="Faltam dados"
          description="Importe a folha de pagamento E o Consolidado Preser na aba Importação para ver a análise."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Custos por Setor"
        subtitle={`Quanto cada setor custa sobre o faturamento ${
          periodosSelecionados.length === 0
            ? `(${new Set(folhaEnriquecida.map((f) => f.periodo)).size} mês(es))`
            : periodosSelecionados.map((p) => periodoLabel(p)).join(" • ")
        }`}
        actions={<PeriodoFilter />}
      />

      {/* ── HERO: 4 KPIs ─────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Faturamento Total"
          value={fmtBRL(faturamentoTotal, { compact: true })}
          subtitle={fmtBRL(faturamentoTotal)}
          icon={TrendingUp}
          variant="primary"
        />
        <MetricCard
          title="Custo Total (c/ encargos)"
          value={fmtBRL(kpis.custoTotal, { compact: true })}
          subtitle={`Bruto ${fmtBRL(kpis.custoBruto, { compact: true })} + Encargos ${fmtBRL(kpis.custoEncargos, { compact: true })}`}
          icon={DollarSign}
          variant="destructive"
        />
        <MetricCard
          title="% Custo / Faturamento"
          value={fmtPct(kpis.pctCustoFat, 2)}
          subtitle={
            kpis.pctCustoFat < 0.15
              ? "Saudável (< 15%)"
              : kpis.pctCustoFat < 0.25
                ? "Médio (15-25%)"
                : "Alto (> 25%)"
          }
          icon={Percent}
          variant={
            kpis.pctCustoFat < 0.15 ? "success" : kpis.pctCustoFat < 0.25 ? "warning" : "destructive"
          }
        />
        <MetricCard
          title="Resultado Bruto"
          value={fmtBRL(kpis.resultadoBruto, { compact: true })}
          subtitle={`${fmtNum(kpis.headcount)} colaboradores`}
          icon={Users}
          variant={kpis.resultadoBruto > 0 ? "success" : "destructive"}
        />
      </div>

      {/* ── 2 charts lado a lado ─────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Pizza: distribuição do custo por dept */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Distribuição do custo por setor
            </CardTitle>
            <CardDescription>Quem consome cada R$ da folha.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={deptOrdenado}
                    dataKey="custoTotal"
                    nameKey="departamento"
                    innerRadius={50}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {deptOrdenado.map((_, i) => (
                      <Cell key={i} fill={CORES_DEPT[i % CORES_DEPT.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => [fmtBRL(v), "Custo"]}
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

        {/* Barra: % custo sobre faturamento total */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-4 w-4 text-warning" />
              % Custo sobre Faturamento Total
            </CardTitle>
            <CardDescription>Quanto cada setor pesa no resultado da empresa.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[...deptOrdenado].sort(
                    (a, b) => b.pctCustoSobreFatTotal - a.pctCustoSobreFatTotal,
                  )}
                  layout="vertical"
                  margin={{ left: 0, right: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="departamento"
                    width={140}
                    tick={{ fontSize: 11 }}
                  />
                  <Tooltip
                    formatter={(v: number) => [fmtPct(v, 2), "% sobre faturamento"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="pctCustoSobreFatTotal" radius={[0, 4, 4, 0]}>
                    {deptOrdenado.map((d, i) => (
                      <Cell
                        key={i}
                        fill={
                          d.pctCustoSobreFatTotal < 0.05
                            ? "hsl(152 60% 42%)"
                            : d.pctCustoSobreFatTotal < 0.10
                              ? "hsl(38 92% 50%)"
                              : "hsl(0 72% 55%)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabela por departamento ────────────────────────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Análise por Departamento</CardTitle>
          <CardDescription>
            <strong>% Total</strong> = custo do setor sobre faturamento total da empresa ·{" "}
            <strong>% Setor</strong> = custo do setor sobre faturamento gerado pelo próprio setor
            (aplicável a setores comerciais).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th className="cursor-pointer select-none" onClick={() => onSort("departamento")}>
                  Departamento <SortIcon k="departamento" />
                </Th>
                <Th className="cursor-pointer select-none text-right" onClick={() => onSort("qtd")}>
                  Pessoas <SortIcon k="qtd" />
                </Th>
                <Th className="cursor-pointer select-none text-right" onClick={() => onSort("custoTotal")}>
                  Custo Total <SortIcon k="custoTotal" />
                </Th>
                <Th className="cursor-pointer select-none text-right" onClick={() => onSort("faturamento")}>
                  Faturamento Setor <SortIcon k="faturamento" />
                </Th>
                <Th className="cursor-pointer select-none text-right" onClick={() => onSort("pctCustoSobreFatTotal")}>
                  % Total <SortIcon k="pctCustoSobreFatTotal" />
                </Th>
                <Th className="cursor-pointer select-none text-right" onClick={() => onSort("pctCustoSobreFatDept")}>
                  % Setor <SortIcon k="pctCustoSobreFatDept" />
                </Th>
              </Tr>
            </THead>
            <TBody>
              {deptOrdenado.map((d, i) => (
                <Tr key={d.departamento}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: CORES_DEPT[i % CORES_DEPT.length] }}
                      />
                      <span className="font-medium">{d.departamento}</span>
                    </div>
                  </Td>
                  <Td className="text-right">
                    {fmtNum(d.qtd)}
                    {d.vendedores > 0 && (
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        ({d.vendedores} vend.)
                      </span>
                    )}
                  </Td>
                  <Td className="text-right font-semibold">
                    {fmtBRL(d.custoTotal, { compact: true })}
                  </Td>
                  <Td className="text-right text-muted-foreground">
                    {d.faturamento > 0 ? fmtBRL(d.faturamento, { compact: true }) : "—"}
                  </Td>
                  <Td className="text-right">
                    <span
                      className={cn(
                        "font-mono text-xs font-bold",
                        d.pctCustoSobreFatTotal < 0.05
                          ? "text-success"
                          : d.pctCustoSobreFatTotal < 0.10
                            ? "text-warning"
                            : "text-destructive",
                      )}
                    >
                      {fmtPct(d.pctCustoSobreFatTotal, 2)}
                    </span>
                  </Td>
                  <Td className="text-right">
                    {d.faturamento > 0 ? (
                      <span
                        className={cn(
                          "font-mono text-xs font-bold",
                          d.pctCustoSobreFatDept < 0.5
                            ? "text-success"
                            : d.pctCustoSobreFatDept < 0.8
                              ? "text-warning"
                              : "text-destructive",
                        )}
                      >
                        {fmtPct(d.pctCustoSobreFatDept, 1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-4 py-2.5 text-sm">
            <span className="font-bold text-muted-foreground">Total</span>
            <div className="flex items-center gap-6 text-right text-xs">
              <span>{fmtNum(kpis.headcount)} pessoas</span>
              <span className="font-bold">{fmtBRL(kpis.custoTotal)}</span>
              <span className="font-bold">{fmtBRL(faturamentoTotal)}</span>
              <span
                className={cn(
                  "font-mono font-bold",
                  kpis.pctCustoFat < 0.15 ? "text-success" : kpis.pctCustoFat < 0.25 ? "text-warning" : "text-destructive",
                )}
              >
                {fmtPct(kpis.pctCustoFat, 2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Filtros + Tabela detalhada por funcionário ─────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Análise por Funcionário</CardTitle>
              <CardDescription>
                Custo individual com encargos e faturamento gerado (se vendedor).
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar nome, cargo, código…"
                  className="pl-8"
                />
              </div>
              <select
                value={filtroDept}
                onChange={(e) => setFiltroDept(e.target.value)}
                className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">Todos setores</option>
                {depts.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              {(filtroDept !== "all" || busca) && (
                <button
                  onClick={() => { setFiltroDept("all"); setBusca(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Cód.</Th>
                  <Th>Nome</Th>
                  <Th>Cargo</Th>
                  <Th>Departamento</Th>
                  <Th className="text-right">Bruto</Th>
                  <Th className="text-right">Custo c/ encargos</Th>
                  <Th className="text-right">Faturamento</Th>
                  <Th className="text-right">% Custo/Fat.</Th>
                </Tr>
              </THead>
              <TBody>
                {funcionariosFiltrados.map((f, i) => (
                  <Tr key={`${f.periodo}|${f.codigo}|${i}`}>
                    <Td className="font-mono text-xs text-muted-foreground">{f.codigo}</Td>
                    <Td className="font-medium">
                      {f.nome}
                      {f.eVendedor && (
                        <Badge variant="success" className="ml-1.5 text-[10px]">
                          vendedor
                        </Badge>
                      )}
                    </Td>
                    <Td className="text-muted-foreground text-xs">{f.cargo || "—"}</Td>
                    <Td className="text-muted-foreground text-xs">{f.departamento || "—"}</Td>
                    <Td className="text-right">{fmtBRL(f.bruto, { compact: true })}</Td>
                    <Td className="text-right font-semibold text-destructive">
                      {fmtBRL(f.custoTotal, { compact: true })}
                    </Td>
                    <Td className="text-right text-muted-foreground">
                      {f.faturamento > 0 ? fmtBRL(f.faturamento, { compact: true }) : "—"}
                    </Td>
                    <Td className="text-right">
                      {f.eVendedor ? (
                        <span
                          className={cn(
                            "font-mono text-xs font-bold",
                            f.pctCustoSobreFat < 0.1 ? "text-success" :
                            f.pctCustoSobreFat < 0.3 ? "text-warning" :
                            "text-destructive",
                          )}
                        >
                          {fmtPct(f.pctCustoSobreFat, 1)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            {funcionariosFiltrados.length === 0 && (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Nenhum funcionário corresponde aos filtros.
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-4 py-2.5 text-sm">
            <span className="font-semibold text-muted-foreground">
              {fmtNum(funcionariosFiltrados.length)} funcionário(s)
            </span>
            <span className="font-bold">
              Custo: {fmtBRL(funcionariosFiltrados.reduce((s, f) => s + f.custoTotal, 0))}
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Helper ─────────────────────────────────────────────────────────
function normaliza(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
