import {
  DollarSign,
  TrendingDown,
  Percent,
  Activity,
  Users,
  MapPin,
  ShoppingBag,
  Briefcase,
  TrendingUp,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, fmtROI, periodoLabel } from "@/lib/format";
import { QUADRANTES_ORDER } from "@/lib/types";

function descrPeriodos(periodos: string[], todos: number): string {
  if (periodos.length === 0) return `Consolidado de ${todos} mês(es) importado(s).`;
  if (periodos.length === 1) return `Indicadores de ${periodoLabel(periodos[0])}.`;
  return `Consolidado de ${periodos.length} meses selecionados.`;
}

const quadrantColors: Record<string, string> = {
  Estrela: "success",
  "Trator caro": "warning",
  Potencial: "default",
  "Alerta vermelho": "destructive",
};

export default function Resumo() {
  const { rows, metrics, periodosSelecionados, periodos } = useData();

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Resumo Executivo" subtitle="Visão geral da eficiência comercial." />
        <EmptyState />
      </>
    );
  }

  const quadrantCounts = QUADRANTES_ORDER.reduce<Record<string, number>>((acc, q) => {
    acc[q] = rows.filter((r) => r.quadrante_performance === q).length;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Resumo Executivo"
        subtitle={descrPeriodos(periodosSelecionados, periodos.length)}
        actions={<PeriodoFilter />}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Faturamento do time"
          value={fmtBRL(metrics.faturamento_total, { compact: true })}
          subtitle={fmtBRL(metrics.faturamento_total)}
          icon={DollarSign}
          variant="primary"
        />
        <MetricCard
          title="Custo total"
          value={fmtBRL(metrics.custo_total, { compact: true })}
          subtitle={fmtBRL(metrics.custo_total)}
          icon={TrendingDown}
          variant="destructive"
        />
        <MetricCard
          title="% de custo médio"
          value={fmtPct(metrics.percentual_medio)}
          subtitle={`Mediana: ${fmtPct(metrics.mediana_percentual_custo)}`}
          icon={Percent}
          variant="warning"
        />
        <MetricCard
          title="ROI comercial médio"
          value={fmtROI(metrics.roi_medio)}
          subtitle={`Resultado bruto: ${fmtBRL(metrics.resultado_bruto, { compact: true })}`}
          icon={Activity}
          variant="success"
        />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard title="Vendedores" value={fmtNum(metrics.vendedores)} icon={Briefcase} />
        <MetricCard
          title="Faturamento médio/vendedor"
          value={fmtBRL(metrics.faturamento_medio, { compact: true })}
          icon={TrendingUp}
        />
        <MetricCard
          title="Custo médio/vendedor"
          value={fmtBRL(metrics.custo_medio, { compact: true })}
          icon={DollarSign}
        />
        <MetricCard
          title="Mediana faturamento"
          value={fmtBRL(metrics.mediana_faturamento, { compact: true })}
          subtitle="Corte da matriz 2x2"
          icon={Activity}
        />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Carteira do time
      </h2>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          title="Clientes na carteira"
          value={fmtNum(metrics.total_clientes_carteira)}
          icon={Users}
        />
        <MetricCard
          title="Municípios atendidos"
          value={fmtNum(metrics.media_municipios, 1)}
          subtitle="Média por vendedor"
          icon={MapPin}
        />
        <MetricCard
          title="Ticket médio do time"
          value={fmtBRL(metrics.ticket_medio_time, { compact: true })}
          subtitle={`Mediana: ${fmtBRL(metrics.mediana_ticket, { compact: true })}`}
          icon={ShoppingBag}
        />
        <MetricCard
          title="Clientes/vendedor"
          value={fmtNum(rows.length ? metrics.total_clientes_carteira / rows.length : 0, 1)}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Distribuição por quadrante</CardTitle>
            <CardDescription>Posicionamento dos vendedores na matriz 2x2 de performance.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {QUADRANTES_ORDER.map((q) => (
                <div
                  key={q}
                  className="rounded-lg border border-border bg-secondary/30 p-4 text-center"
                >
                  <Badge variant={quadrantColors[q] as any}>{q}</Badge>
                  <p className="mt-3 text-3xl font-bold">{quadrantCounts[q] ?? 0}</p>
                  <p className="text-xs text-muted-foreground">vendedores</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carteira do time</CardTitle>
            <CardDescription>Médias por vendedor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Linha
              icon={<Users className="h-4 w-4 text-primary" />}
              label="Clientes/vendedor"
              value={fmtNum(rows.length ? metrics.total_clientes_carteira / rows.length : 0, 1)}
            />
            <Linha
              icon={<MapPin className="h-4 w-4 text-primary" />}
              label="Municípios/vendedor"
              value={fmtNum(metrics.media_municipios, 1)}
            />
            <Linha
              icon={<ShoppingBag className="h-4 w-4 text-primary" />}
              label="Ticket médio"
              value={fmtBRL(metrics.ticket_medio_time, { compact: true })}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Linha({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
