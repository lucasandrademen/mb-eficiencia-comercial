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
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  DollarSign,
  Scale,
  Search,
  Users,
  UserX,
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
import { fmtBRL, fmtNum, fmtPct } from "@/lib/format";
import { Quadrante } from "@/lib/types";
import { cn } from "@/lib/utils";

type Escopo = "vendedores" | "supervisores";

type MatchStatus = "codigo" | "nome_exato" | "nome_fuzzy" | "sem_match" | "sem_folha";

const MATCH_LABEL: Record<MatchStatus, { label: string; variant: "success" | "warning" | "destructive" | "muted" }> = {
  codigo: { label: "folha ok", variant: "success" },
  nome_exato: { label: "folha ok", variant: "success" },
  nome_fuzzy: { label: "folha ~nome", variant: "warning" },
  sem_match: { label: "sem folha", variant: "destructive" },
  sem_folha: { label: "folha não importada", variant: "muted" },
};

const QUADRANT_VARIANT: Record<Quadrante, "success" | "warning" | "default" | "destructive" | "muted"> = {
  Estrela: "success",
  "Trator caro": "warning",
  Potencial: "default",
  "Alerta vermelho": "destructive",
  "—": "muted",
};

type SortKey = "nome" | "faturamento" | "custo" | "custoPorMil" | "pctCusto";
type Dir = "asc" | "desc";

export default function EquipeGasto() {
  const { rows } = useData();
  const [escopo, setEscopo] = useState<Escopo>("vendedores");
  const [busca, setBusca] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("custoPorMil");
  const [dir, setDir] = useState<Dir>("desc");

  // ─── Consolida por colaborador (períodos já filtrados em rows) ────────────
  const equipe = useMemo(() => {
    const base = rows.filter((r) => (escopo === "supervisores" ? r.is_supervisor : !r.is_supervisor));
    const byId = new Map<
      string,
      {
        id: string;
        nome: string;
        supervisor: string;
        faturamento: number;
        custo: number;
        meses: number;
        quadrante: Quadrante;
        matchStatus: MatchStatus;
      }
    >();
    for (const r of base) {
      const cur = byId.get(r.vendedor_id);
      if (!cur) {
        byId.set(r.vendedor_id, {
          id: r.vendedor_id,
          nome: r.vendedor_nome,
          supervisor: r.supervisor,
          faturamento: r.faturamento,
          custo: r.custo,
          meses: 1,
          quadrante: r.quadrante_performance,
          matchStatus: r.folha_match_status,
        });
      } else {
        cur.faturamento += r.faturamento;
        cur.custo += r.custo;
        cur.meses += 1;
        // status mais recente prevalece (rows vêm ordenadas por período)
        cur.quadrante = r.quadrante_performance;
        cur.matchStatus = r.folha_match_status;
      }
    }
    return [...byId.values()].map((v) => ({
      ...v,
      pctCusto: v.faturamento > 0 ? v.custo / v.faturamento : 0,
      custoPorMil: v.faturamento > 0 ? (v.custo / v.faturamento) * 1000 : 0,
    }));
  }, [rows, escopo]);

  // ─── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const faturamento = equipe.reduce((s, v) => s + v.faturamento, 0);
    const custo = equipe.reduce((s, v) => s + v.custo, 0);
    const custoPorMil = faturamento > 0 ? (custo / faturamento) * 1000 : 0;
    const semMatch = equipe.filter(
      (v) => v.matchStatus === "sem_match" || v.matchStatus === "sem_folha",
    );
    return { faturamento, custo, custoPorMil, colaboradores: equipe.length, semMatch };
  }, [equipe]);

  // ─── Ranking de eficiência (custo por R$ 1.000) ───────────────────────────
  const rankingEficiencia = useMemo(
    () =>
      equipe
        .filter((v) => v.faturamento > 0 && v.custo > 0)
        .sort((a, b) => b.custoPorMil - a.custoPorMil)
        .slice(0, 15),
    [equipe],
  );

  const mediaCustoPorMil = useMemo(() => {
    const comCusto = equipe.filter((v) => v.faturamento > 0 && v.custo > 0);
    if (comCusto.length === 0) return 0;
    return comCusto.reduce((s, v) => s + v.custoPorMil, 0) / comCusto.length;
  }, [equipe]);

  // ─── Tabela ordenada + busca ───────────────────────────────────────────────
  const tabela = useMemo(() => {
    let out = equipe;
    if (busca) {
      const needle = busca.toLowerCase();
      out = out.filter(
        (v) => v.nome.toLowerCase().includes(needle) || v.supervisor.toLowerCase().includes(needle),
      );
    }
    return [...out].sort((a, b) => {
      let av: number | string, bv: number | string;
      switch (sortKey) {
        case "nome": av = a.nome; bv = b.nome; break;
        case "faturamento": av = a.faturamento; bv = b.faturamento; break;
        case "custo": av = a.custo; bv = b.custo; break;
        case "custoPorMil": av = a.custoPorMil; bv = b.custoPorMil; break;
        case "pctCusto": av = a.pctCusto; bv = b.pctCusto; break;
      }
      if (typeof av === "string")
        return dir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [equipe, busca, sortKey, dir]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setDir(k === "nome" ? "asc" : "desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k
      ? <ChevronsUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />
      : dir === "asc"
        ? <ChevronUp className="ml-1 inline h-3 w-3 text-primary" />
        : <ChevronDown className="ml-1 inline h-3 w-3 text-primary" />;

  if (rows.length === 0) {
    return (
      <>
        <PageHeader
          title="Equipe de Vendas × Gasto"
          subtitle="Quanto cada colaborador custa pelo que intermedeia."
        />
        <EmptyState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Equipe de Vendas × Gasto"
        subtitle={
          <>
            Custo individual (folha + encargos) confrontado com o{" "}
            <strong>faturamento intermediado</strong> de cada colaborador.
          </>
        }
        actions={<PeriodoFilter />}
      />

      {/* Escopo */}
      <div className="mb-4 inline-flex rounded-lg border border-border bg-card p-1">
        {(["vendedores", "supervisores"] as Escopo[]).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEscopo(e)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              escopo === e
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {e}
          </button>
        ))}
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Faturamento Intermediado"
          value={fmtBRL(kpis.faturamento, { compact: true })}
          subtitle={`${fmtNum(kpis.colaboradores)} colaborador(es) no escopo`}
          icon={DollarSign}
          variant="primary"
        />
        <MetricCard
          title="Custo da Equipe"
          value={fmtBRL(kpis.custo, { compact: true })}
          subtitle="Folha + encargos dos colaboradores com match"
          icon={Users}
          variant="destructive"
        />
        <MetricCard
          title="Custo por R$ 1.000"
          value={fmtBRL(kpis.custoPorMil)}
          subtitle="Agregado do escopo — quanto menor, melhor"
          icon={Scale}
          variant="accent"
        />
        <MetricCard
          title="Sem Custo na Folha"
          value={fmtNum(kpis.semMatch.length)}
          subtitle={
            kpis.semMatch.length > 0
              ? "Colaboradores com custo invisível — veja abaixo"
              : "Todos com folha vinculada"
          }
          icon={UserX}
          variant={kpis.semMatch.length > 0 ? "warning" : "success"}
        />
      </div>

      {/* ── Alerta: custo invisível ────────────────────────────────── */}
      {kpis.semMatch.length > 0 && (
        <div className="mb-5 rounded-xl border border-warning/40 bg-warning/10 p-3">
          <div className="flex items-start gap-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <div>
              <p className="font-semibold text-warning">
                {kpis.semMatch.length} colaborador(es) sem vínculo com a folha — o custo deles está
                zerado nos números acima:
              </p>
              <p className="mt-0.5 text-muted-foreground">
                {kpis.semMatch.map((v) => v.nome).join(" · ")}
              </p>
              <p className="mt-1 text-muted-foreground">
                Confira o nome/código na folha importada ou reimporte o período correspondente em
                Importação.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Ranking: mais caros por R$ 1.000 ───────────────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-warning" />
            Custo por R$ 1.000 intermediado — 15 maiores
          </CardTitle>
          <CardDescription>
            Quem custa mais caro pelo que intermedeia. Média do escopo:{" "}
            <strong>{fmtBRL(mediaCustoPorMil)}</strong> por R$ 1.000.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rankingEficiencia.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Sem colaboradores com faturamento e custo no escopo.
            </p>
          ) : (
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rankingEficiencia} layout="vertical" margin={{ left: 0, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => fmtBRL(v)}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis type="category" dataKey="nome" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [fmtBRL(v), "Custo / R$ 1.000"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="custoPorMil" radius={[0, 4, 4, 0]}>
                    {rankingEficiencia.map((v, i) => (
                      <Cell
                        key={i}
                        fill={
                          v.custoPorMil <= mediaCustoPorMil
                            ? "hsl(152 60% 42%)"
                            : v.custoPorMil <= mediaCustoPorMil * 1.5
                              ? "hsl(38 92% 50%)"
                              : "hsl(0 72% 55%)"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tabela completa ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Colaborador a colaborador</CardTitle>
              <CardDescription>
                Faturamento intermediado, custo real (folha × 1,6746) e eficiência.
              </CardDescription>
            </div>
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome ou supervisor…"
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <THead>
                <Tr>
                  <Th className="cursor-pointer select-none" onClick={() => onSort("nome")}>
                    Nome <SortIcon k="nome" />
                  </Th>
                  <Th>Supervisor</Th>
                  <Th className="cursor-pointer select-none text-right" onClick={() => onSort("faturamento")}>
                    Faturamento <SortIcon k="faturamento" />
                  </Th>
                  <Th className="cursor-pointer select-none text-right" onClick={() => onSort("custo")}>
                    Custo <SortIcon k="custo" />
                  </Th>
                  <Th className="cursor-pointer select-none text-right" onClick={() => onSort("custoPorMil")}>
                    Custo / R$ 1.000 <SortIcon k="custoPorMil" />
                  </Th>
                  <Th className="cursor-pointer select-none text-right" onClick={() => onSort("pctCusto")}>
                    % Custo <SortIcon k="pctCusto" />
                  </Th>
                  <Th>Quadrante</Th>
                  <Th>Folha</Th>
                </Tr>
              </THead>
              <TBody>
                {tabela.map((v) => {
                  const match = MATCH_LABEL[v.matchStatus];
                  return (
                    <Tr key={v.id}>
                      <Td className="font-medium">{v.nome}</Td>
                      <Td className="text-xs text-muted-foreground">{v.supervisor || "—"}</Td>
                      <Td className="text-right font-semibold">
                        {fmtBRL(v.faturamento, { compact: true })}
                      </Td>
                      <Td className="text-right text-destructive">
                        {v.custo > 0 ? fmtBRL(v.custo, { compact: true }) : "—"}
                      </Td>
                      <Td className="text-right">
                        {v.custo > 0 && v.faturamento > 0 ? (
                          <span
                            className={cn(
                              "font-mono text-xs font-bold",
                              v.custoPorMil <= mediaCustoPorMil
                                ? "text-success"
                                : v.custoPorMil <= mediaCustoPorMil * 1.5
                                  ? "text-warning"
                                  : "text-destructive",
                            )}
                          >
                            {fmtBRL(v.custoPorMil)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td className="text-right font-mono text-xs">
                        {v.custo > 0 && v.faturamento > 0 ? fmtPct(v.pctCusto) : "—"}
                      </Td>
                      <Td>
                        <Badge variant={QUADRANT_VARIANT[v.quadrante]} className="text-[10px]">
                          {v.quadrante}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge variant={match.variant} className="text-[10px]">
                          {match.label}
                        </Badge>
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
            {tabela.length === 0 && (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Nenhum colaborador corresponde à busca.
              </div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-4 py-2.5 text-sm">
            <span className="font-semibold text-muted-foreground">
              {fmtNum(tabela.length)} colaborador(es)
            </span>
            <div className="flex items-center gap-6 text-right text-xs">
              <span>
                Faturamento: <strong>{fmtBRL(tabela.reduce((s, v) => s + v.faturamento, 0))}</strong>
              </span>
              <span>
                Custo:{" "}
                <strong className="text-destructive">
                  {fmtBRL(tabela.reduce((s, v) => s + v.custo, 0))}
                </strong>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
