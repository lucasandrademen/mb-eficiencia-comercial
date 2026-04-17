import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, fmtROI, periodoLabel } from "@/lib/format";
import { computeTimeMetrics } from "@/lib/calculations";
import { VendedorConsolidado } from "@/lib/types";

type Agrupamento = "time" | "vendedor" | "supervisor" | "regiao";

export default function Evolucao() {
  const { rowsAll, periodos } = useData();
  const [agrupamento, setAgrupamento] = useState<Agrupamento>("time");
  const [filtro, setFiltro] = useState<string>("__all__");

  const opcoesFiltro = useMemo(() => {
    if (agrupamento === "time") return [];
    const set = new Set<string>();
    for (const r of rowsAll) {
      const key =
        agrupamento === "vendedor"
          ? r.vendedor_nome
          : agrupamento === "supervisor"
          ? r.supervisor || "—"
          : r.regiao || "—";
      set.add(key);
    }
    return [...set].sort();
  }, [rowsAll, agrupamento]);

  const seriesTime = useMemo(() => {
    return periodos.map((p) => {
      const sub = rowsAll.filter((r) => r.periodo === p);
      const m = computeTimeMetrics(sub);
      return {
        periodo: p,
        label: periodoLabel(p),
        faturamento: m.faturamento_total,
        custo: m.custo_total,
        pct: m.percentual_medio,
        roi: m.roi_medio,
        clientes_pos: m.clientes_positivados_mes,
        venda_cliente: m.venda_media_cliente,
        municipios: Math.round(m.media_municipios * 10) / 10,
      };
    });
  }, [rowsAll, periodos]);

  const seriesFiltrada = useMemo(() => {
    if (agrupamento === "time" || filtro === "__all__") return seriesTime;
    return periodos.map((p) => {
      const sub = rowsAll.filter((r) => {
        if (r.periodo !== p) return false;
        if (agrupamento === "vendedor") return r.vendedor_nome === filtro;
        if (agrupamento === "supervisor") return (r.supervisor || "—") === filtro;
        return (r.regiao || "—") === filtro;
      });
      const m = computeTimeMetrics(sub);
      return {
        periodo: p,
        label: periodoLabel(p),
        faturamento: m.faturamento_total,
        custo: m.custo_total,
        pct: m.percentual_medio,
        roi: m.roi_medio,
        clientes_pos: m.clientes_positivados_mes,
        venda_cliente: m.venda_media_cliente,
        municipios: Math.round(m.media_municipios * 10) / 10,
      };
    });
  }, [rowsAll, periodos, agrupamento, filtro, seriesTime]);

  // Mudanças de quadrante / faixa por vendedor entre períodos consecutivos
  const mudancas = useMemo(() => {
    if (periodos.length < 2) return [];
    const out: { vendedor: string; periodoA: string; periodoB: string; campo: string; de: string; para: string }[] = [];
    for (let i = 1; i < periodos.length; i++) {
      const pA = periodos[i - 1];
      const pB = periodos[i];
      const mapA = new Map(rowsAll.filter((r) => r.periodo === pA).map((r) => [r.vendedor_id, r] as const));
      const mapB = new Map(rowsAll.filter((r) => r.periodo === pB).map((r) => [r.vendedor_id, r] as const));
      for (const [id, b] of mapB) {
        const a = mapA.get(id);
        if (!a) continue;
        if (a.quadrante_performance !== b.quadrante_performance) {
          out.push({
            vendedor: b.vendedor_nome,
            periodoA: pA,
            periodoB: pB,
            campo: "Quadrante",
            de: a.quadrante_performance,
            para: b.quadrante_performance,
          });
        }
        if (a.faixa_faturamento !== b.faixa_faturamento) {
          out.push({
            vendedor: b.vendedor_nome,
            periodoA: pA,
            periodoB: pB,
            campo: "Faixa",
            de: a.faixa_faturamento,
            para: b.faixa_faturamento,
          });
        }
      }
    }
    return out;
  }, [rowsAll, periodos]);

  if (rowsAll.length === 0) {
    return (
      <>
        <PageHeader title="Evolução Mensal" />
        <EmptyState />
      </>
    );
  }

  if (periodos.length < 2) {
    return (
      <>
        <PageHeader title="Evolução Mensal" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Importe dados de pelo menos dois períodos para visualizar a evolução.
          </CardContent>
        </Card>
      </>
    );
  }

  const last = seriesFiltrada[seriesFiltrada.length - 1];
  const prev = seriesFiltrada[seriesFiltrada.length - 2];

  return (
    <>
      <PageHeader
        title="Evolução Mensal"
        subtitle="Comparação mês a mês de faturamento, custo, ROI e carteira."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={agrupamento}
              onChange={(e) => {
                setAgrupamento(e.target.value as Agrupamento);
                setFiltro("__all__");
              }}
              className="w-[140px]"
            >
              <option value="time">Time inteiro</option>
              <option value="vendedor">Por vendedor</option>
              <option value="supervisor">Por supervisor</option>
              <option value="regiao">Por região</option>
            </Select>
            {agrupamento !== "time" && (
              <Select
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
                className="w-[200px]"
              >
                <option value="__all__">Todos</option>
                {opcoesFiltro.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Variacao label="Faturamento" prev={prev?.faturamento} curr={last?.faturamento} format={(v) => fmtBRL(v, { compact: true })} positiveIsGood />
        <Variacao label="% Custo" prev={prev?.pct} curr={last?.pct} format={(v) => fmtPct(v)} positiveIsGood={false} />
        <Variacao label="ROI" prev={prev?.roi} curr={last?.roi} format={fmtROI} positiveIsGood />
        <Variacao label="Pos. clientes" prev={prev?.clientes_pos} curr={last?.clientes_pos} format={(v) => fmtNum(v)} positiveIsGood />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Faturamento × Custo" subtitle="Evolução em R$">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={seriesFiltrada} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tickFormatter={(v) => fmtBRL(v, { compact: true })}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip formatter={(v: any) => fmtBRL(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke="hsl(215 80% 48%)" strokeWidth={2} dot />
              <Line type="monotone" dataKey="custo" name="Custo" stroke="hsl(0 72% 55%)" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="% de custo médio" subtitle="Quanto menor, melhor">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={seriesFiltrada} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tickFormatter={(v) => fmtPct(v, 0)}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip formatter={(v: any) => fmtPct(Number(v))} />
              <Line type="monotone" dataKey="pct" name="% Custo" stroke="hsl(38 92% 50%)" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="ROI comercial" subtitle="Faturamento ÷ custo">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={seriesFiltrada} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tickFormatter={(v) => `${v.toFixed(1)}x`}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip formatter={(v: any) => fmtROI(Number(v))} />
              <Line type="monotone" dataKey="roi" name="ROI" stroke="hsl(152 60% 42%)" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Clientes positivados × venda média" subtitle="Carteira em movimento">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={seriesFiltrada} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                yAxisId="L"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                yAxisId="R"
                orientation="right"
                tickFormatter={(v) => fmtBRL(v, { compact: true })}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line
                yAxisId="L"
                type="monotone"
                dataKey="clientes_pos"
                name="Clientes positivados"
                stroke="hsl(200 70% 45%)"
                strokeWidth={2}
                dot
              />
              <Line
                yAxisId="R"
                type="monotone"
                dataKey="venda_cliente"
                name="Venda/cliente"
                stroke="hsl(280 60% 50%)"
                strokeWidth={2}
                dot
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Mudanças relevantes entre períodos</CardTitle>
          <CardDescription>
            Vendedores que mudaram de quadrante ou faixa de faturamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {mudancas.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Nenhuma mudança de quadrante ou faixa entre os períodos importados.
            </p>
          ) : (
            <Table>
              <THead>
                <Tr>
                  <Th>Vendedor</Th>
                  <Th>Mudança</Th>
                  <Th>De</Th>
                  <Th>Para</Th>
                  <Th>Período</Th>
                </Tr>
              </THead>
              <TBody>
                {mudancas.map((m, i) => (
                  <Tr key={i}>
                    <Td className="font-medium">{m.vendedor}</Td>
                    <Td>
                      <Badge variant="outline">{m.campo}</Badge>
                    </Td>
                    <Td className="text-muted-foreground">{m.de}</Td>
                    <Td className="font-medium">{m.para}</Td>
                    <Td className="text-muted-foreground">
                      {periodoLabel(m.periodoA)} → {periodoLabel(m.periodoB)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {subtitle && <CardDescription>{subtitle}</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">{children}</div>
      </CardContent>
    </Card>
  );
}

function Variacao({
  label,
  prev,
  curr,
  format,
  positiveIsGood,
}: {
  label: string;
  prev: number | undefined;
  curr: number | undefined;
  format: (v: number) => string;
  positiveIsGood: boolean;
}) {
  const valor = curr ?? 0;
  let delta = 0;
  if (prev != null && prev !== 0 && curr != null) delta = (curr - prev) / Math.abs(prev);
  const isUp = delta > 0.001;
  const isDown = delta < -0.001;
  const good = (isUp && positiveIsGood) || (isDown && !positiveIsGood);
  const Icon = isUp ? ArrowUp : isDown ? ArrowDown : ArrowRight;
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{format(valor)}</p>
      {prev != null && curr != null && (
        <p
          className={`mt-1 inline-flex items-center gap-1 text-xs font-medium ${
            good ? "text-success" : isUp || isDown ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          <Icon className="h-3 w-3" />
          {(delta * 100).toFixed(1).replace(".", ",")}% vs. mês anterior
        </p>
      )}
    </div>
  );
}
