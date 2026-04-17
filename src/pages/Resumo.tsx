import {
  DollarSign,
  TrendingDown,
  Percent,
  Activity,
  Users,
  UserCheck,
  Calendar,
  MapPin,
  ShoppingBag,
  Briefcase,
  TrendingUp,
  Building2,
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

const quadrantColors: Record<string, string> = {
  Estrela: "success",
  "Trator caro": "warning",
  Potencial: "default",
  "Alerta vermelho": "destructive",
};

export default function Resumo() {
  const { rows, metrics, periodoSelecionado } = useData();

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
        subtitle={
          periodoSelecionado === "ALL"
            ? "Consolidado de todos os períodos importados."
            : `Indicadores de ${periodoLabel(periodoSelecionado)}.`
        }
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
          title="Positivados no mês"
          value={fmtNum(metrics.clientes_positivados_mes)}
          icon={UserCheck}
          variant="success"
        />
        <MetricCard
          title="Positivados em 3M"
          value={fmtNum(metrics.clientes_positivados_3m)}
          icon={Calendar}
        />
        <MetricCard
          title="Venda média/cliente"
          value={fmtBRL(metrics.venda_media_cliente, { compact: true })}
          subtitle={`Mediana: ${fmtBRL(metrics.mediana_venda_cliente, { compact: true })}`}
          icon={ShoppingBag}
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
            <CardTitle>Cobertura territorial</CardTitle>
            <CardDescription>Média por vendedor.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Linha
              icon={<MapPin className="h-4 w-4 text-primary" />}
              label="Municípios atendidos"
              value={fmtNum(metrics.media_municipios, 1)}
            />
            <Linha
              icon={<Building2 className="h-4 w-4 text-primary" />}
              label="Setores atendidos"
              value={fmtNum(rows.reduce((s, r) => s + r.total_setores_atendidos, 0) / rows.length, 1)}
            />
            <Linha
              icon={<Users className="h-4 w-4 text-primary" />}
              label="Clientes/vendedor"
              value={fmtNum(metrics.total_clientes_carteira / rows.length, 1)}
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
