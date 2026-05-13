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
  ArrowDownRight,
  ArrowUpRight,
  Equal,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PreserPeriodoFilter } from "@/components/PreserPeriodoFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { usePreserData } from "@/contexts/PreserDataContext";
import { fmtBRL, fmtPct, periodoLabel } from "@/lib/format";
import type { PreserMeta } from "@/lib/preser/types";
import { cn } from "@/lib/utils";
import { PreserEmptyState } from "./PreserEmptyState";

type MetaComparada = {
  key: string;
  criterio_codigo: number | null;
  criterio_nome: string;
  bu: string;
  tipo: "VBC" | "Cobertura" | "Recomendador";
  // mês anterior
  efetivo_ant: number;
  meta_ant: number;
  pct_ant: number;
  comissao_ant: number;
  // mês atual
  efetivo_atu: number;
  meta_atu: number;
  pct_atu: number;
  comissao_atu: number;
  // deltas
  delta_pct: number; // delta de % atingimento (pp)
  delta_comissao: number; // delta R$ (positivo = ganhou mais)
  delta_meta: number; // delta R$ do objetivo
  status: "melhorou" | "piorou" | "estavel" | "nova_meta" | "perdeu_meta";
};

const TIPO_COLORS = {
  VBC: "hsl(215 80% 48%)",
  Cobertura: "hsl(38 92% 50%)",
  Recomendador: "hsl(0 72% 55%)",
};

export default function PreserComparativo() {
  const { loading, atual, anterior, extratos } = usePreserData();
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [filtroBU, setFiltroBU] = useState<string>("all");
  const [filtroStatus, setFiltroStatus] = useState<string>("all");

  const metasComparadas = useMemo<MetaComparada[]>(() => {
    if (!atual || !anterior) return [];

    // Indexa por (codigo, bu, tipo) — chave que identifica a mesma meta entre meses
    const keyOf = (m: PreserMeta) =>
      `${m.criterio_codigo ?? "?"}|${m.bu ?? "?"}|${m.tipo ?? "?"}`;

    const idxAnt = new Map<string, PreserMeta>();
    for (const m of anterior.metas) idxAnt.set(keyOf(m), m);

    const idxAtu = new Map<string, PreserMeta>();
    for (const m of atual.metas) idxAtu.set(keyOf(m), m);

    // União de todas as chaves
    const todas = new Set<string>([...idxAnt.keys(), ...idxAtu.keys()]);

    const out: MetaComparada[] = [];
    for (const k of todas) {
      const mAnt = idxAnt.get(k);
      const mAtu = idxAtu.get(k);
      const ref = mAtu ?? mAnt!;
      if (!ref.tipo) continue;

      const ef_a = mAnt?.efetivo_fiscal ?? 0;
      const ef_t = mAtu?.efetivo_fiscal ?? 0;
      const met_a = mAnt?.objetivo_meta ?? 0;
      const met_t = mAtu?.objetivo_meta ?? 0;

      // % atingimento depende do tipo
      let pct_a = 0;
      let pct_t = 0;
      if (ref.tipo === "Recomendador") {
        pct_a = ef_a; // já é uma %
        pct_t = ef_t;
      } else {
        pct_a = met_a > 0 ? ef_a / met_a : 0;
        pct_t = met_t > 0 ? ef_t / met_t : 0;
      }

      const com_a = mAnt?.comissao ?? 0;
      const com_t = mAtu?.comissao ?? 0;

      const delta_comissao = com_t - com_a;
      const delta_pct = pct_t - pct_a;

      let status: MetaComparada["status"];
      if (!mAnt) status = "nova_meta";
      else if (!mAtu) status = "perdeu_meta";
      else if (Math.abs(delta_comissao) < 100 && Math.abs(delta_pct) < 0.01) status = "estavel";
      else if (delta_comissao > 0) status = "melhorou";
      else status = "piorou";

      out.push({
        key: k,
        criterio_codigo: ref.criterio_codigo,
        criterio_nome: (ref.criterio_nome ?? "").slice(0, 80),
        bu: ref.bu ?? "—",
        tipo: ref.tipo as "VBC" | "Cobertura" | "Recomendador",
        efetivo_ant: ef_a,
        meta_ant: met_a,
        pct_ant: pct_a,
        comissao_ant: com_a,
        efetivo_atu: ef_t,
        meta_atu: met_t,
        pct_atu: pct_t,
        comissao_atu: com_t,
        delta_pct,
        delta_comissao,
        delta_meta: met_t - met_a,
        status,
      });
    }

    return out.sort((a, b) => Math.abs(b.delta_comissao) - Math.abs(a.delta_comissao));
  }, [atual, anterior]);

  const filtradas = useMemo(() => {
    return metasComparadas.filter((m) => {
      if (filtroTipo !== "all" && m.tipo !== filtroTipo) return false;
      if (filtroBU !== "all" && m.bu !== filtroBU) return false;
      if (filtroStatus !== "all" && m.status !== filtroStatus) return false;
      return true;
    });
  }, [metasComparadas, filtroTipo, filtroBU, filtroStatus]);

  const bus = useMemo(
    () => Array.from(new Set(metasComparadas.map((m) => m.bu))).sort(),
    [metasComparadas],
  );

  const totais = useMemo(() => {
    const comAnt = atual && anterior
      ? (anterior.extrato.valor_total_comissao ?? 0)
      : 0;
    const comAtu = atual ? (atual.extrato.valor_total_comissao ?? 0) : 0;
    const delta = comAtu - comAnt;
    const deltaPct = comAnt > 0 ? delta / comAnt : 0;

    const melhoraram = metasComparadas.filter((m) => m.status === "melhorou");
    const pioraram = metasComparadas.filter((m) => m.status === "piorou");

    const ganhoMetas = melhoraram.reduce((s, m) => s + m.delta_comissao, 0);
    const perdaMetas = pioraram.reduce((s, m) => s + m.delta_comissao, 0);

    return { comAnt, comAtu, delta, deltaPct, melhoraram, pioraram, ganhoMetas, perdaMetas };
  }, [metasComparadas, atual, anterior]);

  // Top 8 metas com maior variação (positiva ou negativa)
  const topVariacao = useMemo(() => {
    return [...metasComparadas]
      .sort((a, b) => Math.abs(b.delta_comissao) - Math.abs(a.delta_comissao))
      .slice(0, 8)
      .map((m) => ({
        label: `${m.bu} - ${m.tipo}`,
        delta: m.delta_comissao,
        positivo: m.delta_comissao >= 0,
      }));
  }, [metasComparadas]);

  if (loading) return <PageHeader title="Comparativo Mensal" subtitle="Carregando…" />;
  if (extratos.length < 2 || !atual || !anterior) {
    return (
      <>
        <PageHeader
          title="Comparativo Mensal"
          subtitle="Compara o mês atual com o mês anterior."
          actions={<PreserPeriodoFilter />}
        />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Equal className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Importe pelo menos 2 meses para comparar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {extratos.length === 0
                  ? "Nenhum extrato importado ainda."
                  : `Só temos ${periodoLabel(atual?.extrato.periodo.slice(0, 7) ?? "")}. Importe o mês anterior na aba Importar.`}
              </p>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  const lblAtu = periodoLabel(atual.extrato.periodo.slice(0, 7));
  const lblAnt = periodoLabel(anterior.extrato.periodo.slice(0, 7));

  return (
    <>
      <PageHeader
        title="Comparativo Mensal"
        subtitle={`${lblAnt} → ${lblAtu}`}
        actions={<PreserPeriodoFilter />}
      />

      {/* ── KPIs ─────────────────────────────────────────────────────── */}
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiDelta
          label="Receita Total"
          atual={totais.comAtu}
          anterior={totais.comAnt}
          icon={DollarSign}
        />
        <KpiCard
          label="Metas que melhoraram"
          value={`${totais.melhoraram.length}`}
          sub={`+${fmtBRL(totais.ganhoMetas, { compact: true })} em comissão`}
          icon={TrendingUp}
          accent="success"
        />
        <KpiCard
          label="Metas que pioraram"
          value={`${totais.pioraram.length}`}
          sub={`${fmtBRL(totais.perdaMetas, { compact: true })} em comissão`}
          icon={TrendingDown}
          accent="destructive"
        />
        <KpiCard
          label="Balanço líquido"
          value={fmtBRL(totais.ganhoMetas + totais.perdaMetas, { compact: true })}
          sub={`Ganhos − perdas em metas`}
          icon={Target}
          accent={
            totais.ganhoMetas + totais.perdaMetas >= 0 ? "success" : "destructive"
          }
        />
      </div>

      {/* ── Chart: top variações ────────────────────────────────────── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Top 8 variações entre {lblAnt} e {lblAtu}</CardTitle>
          <CardDescription>
            Verde = ganhou mais comissão · Vermelho = perdeu comissão
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topVariacao} layout="vertical" margin={{ left: 0, right: 24 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                <XAxis
                  type="number"
                  tickFormatter={(v) => fmtBRL(v, { compact: true })}
                  tick={{ fontSize: 11 }}
                />
                <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [fmtBRL(v), "Delta"]}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
                  {topVariacao.map((d, i) => (
                    <Cell
                      key={i}
                      fill={d.positivo ? "hsl(152 60% 42%)" : "hsl(0 72% 55%)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Filtros ─────────────────────────────────────────────────── */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <FilterSelect
            label="Tipo"
            value={filtroTipo}
            onChange={setFiltroTipo}
            options={[
              { v: "all", l: "Todos" },
              { v: "VBC", l: "VBC" },
              { v: "Cobertura", l: "Cobertura" },
              { v: "Recomendador", l: "Recomendador" },
            ]}
          />
          <FilterSelect
            label="BU"
            value={filtroBU}
            onChange={setFiltroBU}
            options={[{ v: "all", l: "Todas" }, ...bus.map((b) => ({ v: b, l: b }))]}
          />
          <FilterSelect
            label="Status"
            value={filtroStatus}
            onChange={setFiltroStatus}
            options={[
              { v: "all", l: "Todos" },
              { v: "melhorou", l: "Melhorou" },
              { v: "piorou", l: "Piorou" },
              { v: "estavel", l: "Estável" },
              { v: "nova_meta", l: "Nova" },
              { v: "perdeu_meta", l: "Removida" },
            ]}
          />
          {(filtroTipo !== "all" || filtroBU !== "all" || filtroStatus !== "all") && (
            <button
              onClick={() => {
                setFiltroTipo("all");
                setFiltroBU("all");
                setFiltroStatus("all");
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </CardContent>
      </Card>

      {/* ── Tabela ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhe das metas — {lblAnt} vs {lblAtu}</CardTitle>
          <CardDescription>Ordenado por maior variação absoluta.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <THead>
                <Tr>
                  <Th>Status</Th>
                  <Th>Tipo</Th>
                  <Th>BU</Th>
                  <Th>Critério</Th>
                  <Th className="text-right">% Atingido<br/><span className="text-muted-foreground font-normal text-[10px]">{lblAnt}</span></Th>
                  <Th className="text-right">% Atingido<br/><span className="text-muted-foreground font-normal text-[10px]">{lblAtu}</span></Th>
                  <Th className="text-right">Δ %</Th>
                  <Th className="text-right">Comissão<br/><span className="text-muted-foreground font-normal text-[10px]">{lblAnt}</span></Th>
                  <Th className="text-right">Comissão<br/><span className="text-muted-foreground font-normal text-[10px]">{lblAtu}</span></Th>
                  <Th className="text-right">Δ R$</Th>
                </Tr>
              </THead>
              <TBody>
                {filtradas.map((m) => (
                  <Tr key={m.key}>
                    <Td>
                      <StatusBadge status={m.status} />
                    </Td>
                    <Td>
                      <span
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          background: `${TIPO_COLORS[m.tipo]}22`,
                          color: TIPO_COLORS[m.tipo],
                        }}
                      >
                        {m.tipo}
                      </span>
                    </Td>
                    <Td className="font-medium">{m.bu}</Td>
                    <Td className="max-w-[240px] truncate text-xs text-muted-foreground" title={m.criterio_nome}>
                      {m.criterio_nome}
                    </Td>
                    <Td className="text-right text-muted-foreground">
                      {m.status === "nova_meta" ? "—" : fmtPct(m.pct_ant)}
                    </Td>
                    <Td className="text-right">
                      <span className={cn(
                        "font-mono text-xs font-semibold",
                        m.pct_atu >= 1 ? "text-success" : m.pct_atu >= 0.7 ? "text-warning" : "text-destructive",
                      )}>
                        {m.status === "perdeu_meta" ? "—" : fmtPct(m.pct_atu)}
                      </span>
                    </Td>
                    <Td className="text-right">
                      <DeltaInline value={m.delta_pct} type="pct" />
                    </Td>
                    <Td className="text-right text-muted-foreground">
                      {m.status === "nova_meta" ? "—" : fmtBRL(m.comissao_ant, { compact: true })}
                    </Td>
                    <Td className="text-right font-medium">
                      {m.status === "perdeu_meta" ? "—" : fmtBRL(m.comissao_atu, { compact: true })}
                    </Td>
                    <Td className="text-right">
                      <DeltaInline value={m.delta_comissao} type="brl" />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
            {filtradas.length === 0 && (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Nenhuma meta corresponde aos filtros.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────────────────

function KpiDelta({
  label,
  atual,
  anterior,
  icon: Icon,
}: {
  label: string;
  atual: number;
  anterior: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const delta = atual - anterior;
  const pct = anterior > 0 ? delta / anterior : 0;
  const positivo = delta >= 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80",
          positivo ? "from-success/15 to-success/0" : "from-destructive/15 to-destructive/0",
        )}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={cn("h-5 w-5", positivo ? "text-success" : "text-destructive")} />
        </div>
        <p className="mt-3 text-3xl font-bold leading-tight">{fmtBRL(atual, { compact: true })}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Anterior: {fmtBRL(anterior, { compact: true })}
        </p>
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            positivo ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
          )}
        >
          {positivo ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {fmtBRL(Math.abs(delta), { compact: true })} ({fmtPct(Math.abs(pct))})
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "success" | "destructive";
}) {
  const accentBg = accent === "success" ? "from-success/15 to-success/0" : "from-destructive/15 to-destructive/0";
  const accentText = accent === "success" ? "text-success" : "text-destructive";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-80", accentBg)} />
      <div className="relative">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className={cn("h-5 w-5", accentText)} />
        </div>
        <p className="mt-3 text-3xl font-bold leading-tight">{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function FilterSelect({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

function StatusBadge({ status }: { status: MetaComparada["status"] }) {
  const cfg: Record<MetaComparada["status"], { v: "success" | "destructive" | "default" | "warning" | "muted"; l: string }> = {
    melhorou: { v: "success", l: "↑ Melhorou" },
    piorou: { v: "destructive", l: "↓ Piorou" },
    estavel: { v: "muted", l: "= Estável" },
    nova_meta: { v: "default", l: "✨ Nova" },
    perdeu_meta: { v: "warning", l: "× Removida" },
  };
  const c = cfg[status];
  return <Badge variant={c.v}>{c.l}</Badge>;
}

function DeltaInline({ value, type }: { value: number; type: "brl" | "pct" }) {
  if (Math.abs(value) < (type === "brl" ? 1 : 0.001)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const positivo = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-xs font-bold",
        positivo ? "text-success" : "text-destructive",
      )}
    >
      {positivo ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {type === "brl"
        ? fmtBRL(Math.abs(value), { compact: true })
        : `${(Math.abs(value) * 100).toFixed(1)}pp`}
    </span>
  );
}
