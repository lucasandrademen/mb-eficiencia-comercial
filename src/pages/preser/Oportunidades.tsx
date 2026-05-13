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
  Target,
  TrendingUp,
  DollarSign,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
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

interface Oportunidade {
  id: string;
  fonte: "Meta VBC" | "Recomendador" | "Cobertura" | "Drops" | "SKU";
  bu_canal: string;
  descricao: string;
  realizado: number; // R$ ou unidades
  meta: number;
  pct_atingimento: number;
  comissao_atual: number;
  comissao_potencial: number;
  gap_rs: number; // quanto está perdendo (R$)
  prioridade: "Crítico" | "Alto" | "Médio" | "Baixo";
}

type SortKey = "gap_rs" | "pct_atingimento" | "comissao_atual" | "fonte" | "bu_canal";
type Dir = "asc" | "desc";

const PRIORIDADE_BADGE: Record<Oportunidade["prioridade"], "destructive" | "warning" | "default" | "muted"> = {
  Crítico: "destructive",
  Alto: "warning",
  Médio: "default",
  Baixo: "muted",
};

const FONTE_COLORS: Record<Oportunidade["fonte"], string> = {
  "Meta VBC": "hsl(215 80% 48%)",
  "Recomendador": "hsl(0 72% 55%)",
  "Cobertura": "hsl(38 92% 50%)",
  "Drops": "hsl(152 60% 42%)",
  "SKU": "hsl(271 60% 56%)",
};

export default function PreserOportunidades() {
  const { loading, atual, extratos } = usePreserData();
  const [filtroFonte, setFiltroFonte] = useState<string>("all");
  const [filtroBU, setFiltroBU] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("gap_rs");
  const [dir, setDir] = useState<Dir>("desc");

  const oportunidades = useMemo<Oportunidade[]>(() => {
    if (!atual) return [];
    const out: Oportunidade[] = [];

    // ─── 1. Recomendadores abaixo do gatilho ────────────────────────────
    for (const m of atual.metas) {
      if (m.tipo !== "Recomendador") continue;
      const ef = m.efetivo_fiscal ?? 0;
      const atingiu = ef >= 0.5;
      if (atingiu) continue; // já bateu, sem oportunidade
      // Quanto ele teria ganhado se tivesse atingido
      const pctMeta = m.pct_meta ?? 0.005;
      const efMes = m.efetivo_mes ?? 0;
      const comissaoPot = pctMeta * efMes;
      const gap = comissaoPot - (m.comissao ?? 0);
      if (gap <= 0) continue;
      out.push({
        id: `rec-${m.id}`,
        fonte: "Recomendador",
        bu_canal: m.bu ?? "—",
        descricao: m.criterio_nome ?? "Recomendador",
        realizado: ef,
        meta: 0.5,
        pct_atingimento: ef / 0.5,
        comissao_atual: m.comissao ?? 0,
        comissao_potencial: comissaoPot,
        gap_rs: gap,
        prioridade: gap > 50000 ? "Crítico" : gap > 20000 ? "Alto" : gap > 5000 ? "Médio" : "Baixo",
      });
    }

    // ─── 2. VBC abaixo da meta ──────────────────────────────────────────
    for (const m of atual.metas) {
      if (m.tipo !== "VBC") continue;
      const ef = m.efetivo_fiscal ?? 0;
      const meta = m.objetivo_meta ?? 0;
      if (!meta || ef >= meta) continue;
      const pctIdeal = m.pct_ideal ?? 0.0065;
      const efMes = m.efetivo_mes ?? 0;
      const comissaoIdeal = pctIdeal * efMes;
      const gap = Math.max(0, comissaoIdeal - (m.comissao ?? 0));
      if (gap < 100) continue;
      out.push({
        id: `vbc-${m.id}`,
        fonte: "Meta VBC",
        bu_canal: m.bu ?? "—",
        descricao: m.criterio_nome ?? "VBC",
        realizado: ef,
        meta,
        pct_atingimento: ef / meta,
        comissao_atual: m.comissao ?? 0,
        comissao_potencial: comissaoIdeal,
        gap_rs: gap,
        prioridade: gap > 30000 ? "Crítico" : gap > 10000 ? "Alto" : gap > 2000 ? "Médio" : "Baixo",
      });
    }

    // ─── 3. Cobertura abaixo da meta ────────────────────────────────────
    for (const m of atual.metas) {
      if (m.tipo !== "Cobertura") continue;
      const ef = m.efetivo_fiscal ?? 0;
      const meta = m.objetivo_meta ?? 0;
      if (!meta || ef >= meta) continue;
      const pctIdeal = m.pct_ideal ?? 0.0065;
      const efMes = m.efetivo_mes ?? 0;
      const comissaoIdeal = pctIdeal * efMes;
      const gap = Math.max(0, comissaoIdeal - (m.comissao ?? 0));
      if (gap < 100) continue;
      out.push({
        id: `cob-${m.id}`,
        fonte: "Cobertura",
        bu_canal: m.bu ?? "—",
        descricao: m.criterio_nome ?? "Cobertura",
        realizado: ef,
        meta,
        pct_atingimento: ef / meta,
        comissao_atual: m.comissao ?? 0,
        comissao_potencial: comissaoIdeal,
        gap_rs: gap,
        prioridade: gap > 30000 ? "Crítico" : gap > 10000 ? "Alto" : gap > 2000 ? "Médio" : "Baixo",
      });
    }

    // ─── 4. Drops zerados ou com fator baixo ────────────────────────────
    // Identifica canais com volume baixo de drops vs. potencial (média do dataset)
    if (atual.drops.length > 0) {
      const mediaDrops =
        atual.drops.reduce((s, d) => s + (d.qtd_drops ?? 0), 0) / atual.drops.length;
      for (const d of atual.drops) {
        const qtd = d.qtd_drops ?? 0;
        const rsCalc = d.rs_calculado ?? 0;
        if (qtd === 0 && rsCalc > 0) {
          // Canal completamente vazio mas com rate definido — oportunidade clara
          const potencialMin = mediaDrops * 0.3 * rsCalc;
          if (potencialMin > 500) {
            out.push({
              id: `drops-${d.id}`,
              fonte: "Drops",
              bu_canal: d.canal_nome,
              descricao: `Canal ${d.canal_nome} sem drops (R$/drop: ${fmtBRL(rsCalc)})`,
              realizado: 0,
              meta: mediaDrops * 0.3,
              pct_atingimento: 0,
              comissao_atual: 0,
              comissao_potencial: potencialMin,
              gap_rs: potencialMin,
              prioridade: potencialMin > 20000 ? "Alto" : "Médio",
            });
          }
        }
      }
    }

    return out.sort((a, b) => b.gap_rs - a.gap_rs);
  }, [atual]);

  const bus = useMemo(
    () => Array.from(new Set(oportunidades.map((o) => o.bu_canal))).sort(),
    [oportunidades],
  );

  const filtradas = useMemo(() => {
    let out = oportunidades;
    if (filtroFonte !== "all") out = out.filter((o) => o.fonte === filtroFonte);
    if (filtroBU !== "all") out = out.filter((o) => o.bu_canal === filtroBU);
    return [...out].sort((a, b) => {
      let av: string | number, bv: string | number;
      switch (sortKey) {
        case "gap_rs": av = a.gap_rs; bv = b.gap_rs; break;
        case "pct_atingimento": av = a.pct_atingimento; bv = b.pct_atingimento; break;
        case "comissao_atual": av = a.comissao_atual; bv = b.comissao_atual; break;
        case "fonte": av = a.fonte; bv = b.fonte; break;
        case "bu_canal": av = a.bu_canal; bv = b.bu_canal; break;
      }
      if (typeof av === "string") return dir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return dir === "asc" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [oportunidades, filtroFonte, filtroBU, sortKey, dir]);

  const totais = useMemo(() => {
    return {
      total: filtradas.reduce((s, o) => s + o.gap_rs, 0),
      criticas: filtradas.filter((o) => o.prioridade === "Crítico").length,
      qtd: filtradas.length,
      maior: filtradas[0] ?? null,
    };
  }, [filtradas]);

  const porFonte = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of filtradas) {
      map.set(o.fonte, (map.get(o.fonte) ?? 0) + o.gap_rs);
    }
    return [...map.entries()]
      .map(([fonte, valor]) => ({ fonte, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [filtradas]);

  const porBU = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of filtradas) {
      map.set(o.bu_canal, (map.get(o.bu_canal) ?? 0) + o.gap_rs);
    }
    return [...map.entries()]
      .map(([bu, valor]) => ({ bu, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [filtradas]);

  const onSort = (k: SortKey) => {
    if (sortKey === k) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setDir(["fonte", "bu_canal"].includes(k) ? "asc" : "desc");
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey !== k
      ? <ChevronsUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/50" />
      : dir === "asc"
        ? <ChevronUp className="ml-1 inline h-3 w-3 text-primary" />
        : <ChevronDown className="ml-1 inline h-3 w-3 text-primary" />;

  if (loading) return <PageHeader title="Oportunidades & Perdas" subtitle="Carregando…" />;
  if (extratos.length === 0 || !atual) {
    return (
      <>
        <PageHeader
          title="Oportunidades & Perdas"
          subtitle="Quanto a MB está deixando na mesa por gaps em metas, canais e categorias."
        />
        <PreserEmptyState semExtrato />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Oportunidades & Perdas"
        subtitle={`${periodoLabel(atual.extrato.periodo.slice(0, 7))} • ${totais.qtd} oportunidades identificadas`}
        actions={<PreserPeriodoFilter />}
      />

      {/* ── KPIs ────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Perda total potencial"
          value={fmtBRL(totais.total, { compact: true })}
          sub={fmtBRL(totais.total)}
          icon={DollarSign}
          accent="destructive"
        />
        <KpiCard
          label="Oportunidades críticas"
          value={fmtNum(totais.criticas)}
          sub="acima de R$30k cada"
          icon={AlertTriangle}
          accent="warning"
        />
        <KpiCard
          label="Maior gap individual"
          value={totais.maior ? fmtBRL(totais.maior.gap_rs, { compact: true }) : "—"}
          sub={totais.maior?.bu_canal ?? ""}
          icon={Target}
          accent="primary"
        />
        <KpiCard
          label="Potencial recuperável"
          value={fmtBRL(totais.total * 0.6, { compact: true })}
          sub="se recuperar 60% dos gaps"
          icon={TrendingUp}
          accent="success"
        />
      </div>

      {/* ── Filtros ─────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fonte:</span>
            <select
              value={filtroFonte}
              onChange={(e) => setFiltroFonte(e.target.value)}
              className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todas</option>
              <option value="Meta VBC">Meta VBC</option>
              <option value="Recomendador">Recomendador</option>
              <option value="Cobertura">Cobertura</option>
              <option value="Drops">Drops</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Canal/BU:</span>
            <select
              value={filtroBU}
              onChange={(e) => setFiltroBU(e.target.value)}
              className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="all">Todos</option>
              {bus.map((bu) => (
                <option key={bu} value={bu}>{bu}</option>
              ))}
            </select>
          </div>
          {(filtroFonte !== "all" || filtroBU !== "all") && (
            <button
              onClick={() => { setFiltroFonte("all"); setFiltroBU("all"); }}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Charts ──────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perda por fonte</CardTitle>
            <CardDescription>Onde estão os maiores gaps.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porFonte} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => fmtBRL(v, { compact: true })}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis type="category" dataKey="fonte" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [fmtBRL(v), "Perda"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {porFonte.map((d) => (
                      <Cell key={d.fonte} fill={FONTE_COLORS[d.fonte as Oportunidade["fonte"]]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Perda por canal / BU</CardTitle>
            <CardDescription>Top canais com mais comissão na mesa.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porBU} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => fmtBRL(v, { compact: true })}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis type="category" dataKey="bu" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [fmtBRL(v), "Perda"]}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 12 }}
                  />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]} fill="hsl(0 72% 55%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Tabela detalhada ────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhe das oportunidades</CardTitle>
          <CardDescription>
            Ordene clicando nas colunas. Prioridade = tamanho do gap.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <THead>
                <Tr>
                  <Th className="cursor-pointer select-none" onClick={() => onSort("fonte")}>
                    Fonte <SortIcon k="fonte" />
                  </Th>
                  <Th className="cursor-pointer select-none" onClick={() => onSort("bu_canal")}>
                    BU/Canal <SortIcon k="bu_canal" />
                  </Th>
                  <Th>Descrição</Th>
                  <Th className="cursor-pointer select-none text-right" onClick={() => onSort("pct_atingimento")}>
                    Atingimento <SortIcon k="pct_atingimento" />
                  </Th>
                  <Th className="cursor-pointer select-none text-right" onClick={() => onSort("comissao_atual")}>
                    Recebido <SortIcon k="comissao_atual" />
                  </Th>
                  <Th className="text-right">Potencial</Th>
                  <Th className="cursor-pointer select-none text-right" onClick={() => onSort("gap_rs")}>
                    Gap (R$) <SortIcon k="gap_rs" />
                  </Th>
                  <Th>Prioridade</Th>
                </Tr>
              </THead>
              <TBody>
                {filtradas.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{
                          background: `${FONTE_COLORS[o.fonte]}22`,
                          color: FONTE_COLORS[o.fonte],
                        }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: FONTE_COLORS[o.fonte] }} />
                        {o.fonte}
                      </span>
                    </Td>
                    <Td className="font-medium">{o.bu_canal}</Td>
                    <Td className="max-w-[280px] truncate text-xs text-muted-foreground" title={o.descricao}>
                      {o.descricao}
                    </Td>
                    <Td className="text-right">
                      <span className={cn(
                        "font-mono text-xs font-semibold",
                        o.pct_atingimento >= 1 ? "text-success"
                        : o.pct_atingimento >= 0.7 ? "text-warning"
                        : "text-destructive",
                      )}>
                        {fmtPct(o.pct_atingimento)}
                      </span>
                    </Td>
                    <Td className="text-right text-muted-foreground">
                      {fmtBRL(o.comissao_atual, { compact: true })}
                    </Td>
                    <Td className="text-right text-muted-foreground">
                      {fmtBRL(o.comissao_potencial, { compact: true })}
                    </Td>
                    <Td className="text-right font-bold text-destructive">
                      {fmtBRL(o.gap_rs)}
                    </Td>
                    <Td>
                      <Badge variant={PRIORIDADE_BADGE[o.prioridade]}>{o.prioridade}</Badge>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            {filtradas.length === 0 && (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Nenhuma oportunidade identificada para os filtros atuais.
              </div>
            )}
          </div>
          {/* Footer total */}
          {filtradas.length > 0 && (
            <div className="flex items-center justify-between border-t border-border bg-secondary/30 px-4 py-2.5 text-sm">
              <span className="font-semibold text-muted-foreground">
                Total ({fmtNum(filtradas.length)} oportunidades)
              </span>
              <span className="font-bold text-destructive">
                {fmtBRL(filtradas.reduce((s, o) => s + o.gap_rs, 0))} potencial
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ─── KpiCard reutilizado ─────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "primary" | "destructive" | "success" | "warning";
}) {
  const accentBg: Record<string, string> = {
    primary: "from-primary/15 to-primary/0",
    destructive: "from-destructive/15 to-destructive/0",
    success: "from-success/15 to-success/0",
    warning: "from-warning/15 to-warning/0",
  };
  const accentText: Record<string, string> = {
    primary: "text-primary",
    destructive: "text-destructive",
    success: "text-success",
    warning: "text-warning",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", accentBg[accent])} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={cn("h-5 w-5", accentText[accent])} />
        </div>
        <p className="mt-3 text-3xl font-bold leading-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}
