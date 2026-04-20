import { useMemo } from "react";
import { AlertTriangle, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, fmtROI, periodoLabel } from "@/lib/format";
import { VendedorConsolidado } from "@/lib/types";

interface Alerta {
  vendedor: VendedorConsolidado;
  motivo: string;
  indicador: string;
  valor: string;
  severidade: "alta" | "media";
}

export default function Alertas() {
  const { rows, metrics } = useData();

  const alertas: Alerta[] = useMemo(() => {
    if (rows.length === 0) return [];
    const list: Alerta[] = [];
    for (const r of rows) {
      if (r.percentual_custo > 0.12) {
        list.push({
          vendedor: r,
          motivo: "% de custo acima de 12%",
          indicador: "% Custo",
          valor: fmtPct(r.percentual_custo),
          severidade: "alta",
        });
      }
      if (r.faturamento > 0 && r.faturamento < 200_000) {
        list.push({
          vendedor: r,
          motivo: "Faturamento abaixo de R$ 200 mil",
          indicador: "Faturamento",
          valor: fmtBRL(r.faturamento),
          severidade: "alta",
        });
      }
      if (r.quadrante_performance === "Alerta vermelho") {
        list.push({
          vendedor: r,
          motivo: "Posicionado no quadrante Alerta vermelho",
          indicador: "Quadrante",
          valor: r.quadrante_performance,
          severidade: "alta",
        });
      }
      if (r.roi_comercial > 0 && r.roi_comercial < 5) {
        list.push({
          vendedor: r,
          motivo: "ROI comercial abaixo de 5x",
          indicador: "ROI",
          valor: fmtROI(r.roi_comercial),
          severidade: "media",
        });
      }
      if (
        r.percentual_custo > metrics.mediana_percentual_custo &&
        r.faturamento < metrics.mediana_faturamento
      ) {
        list.push({
          vendedor: r,
          motivo: "Custo alto e faturamento abaixo da mediana do time",
          indicador: "Custo vs. Mediana",
          valor: `${fmtPct(r.percentual_custo)} / ${fmtBRL(r.faturamento, { compact: true })}`,
          severidade: "media",
        });
      }
      if (
        r.ticket_medio > 0 &&
        metrics.mediana_ticket > 0 &&
        r.ticket_medio < metrics.mediana_ticket
      ) {
        list.push({
          vendedor: r,
          motivo: "Ticket médio abaixo da mediana do time",
          indicador: "Ticket médio",
          valor: fmtBRL(r.ticket_medio, { compact: true }),
          severidade: "media",
        });
      }
    }
    return list.sort((a, b) => {
      if (a.severidade !== b.severidade) return a.severidade === "alta" ? -1 : 1;
      return a.vendedor.vendedor_nome.localeCompare(b.vendedor.vendedor_nome);
    });
  }, [rows, metrics]);

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Alertas e Exceções" />
        <EmptyState />
      </>
    );
  }

  const altaCount = alertas.filter((a) => a.severidade === "alta").length;
  const mediaCount = alertas.filter((a) => a.severidade === "media").length;
  const vendedoresUnicos = new Set(alertas.map((a) => a.vendedor.vendedor_id)).size;

  return (
    <>
      <PageHeader
        title="Alertas e Exceções"
        subtitle={`${fmtNum(alertas.length)} alerta(s) em ${fmtNum(vendedoresUnicos)} vendedor(es).`}
        actions={<PeriodoFilter />}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Alertas críticos"
          value={fmtNum(altaCount)}
          icon={<AlertCircle className="h-5 w-5 text-destructive" />}
          color="destructive"
        />
        <Stat
          label="Alertas de atenção"
          value={fmtNum(mediaCount)}
          icon={<AlertTriangle className="h-5 w-5 text-warning" />}
          color="warning"
        />
        <Stat
          label="Vendedores com alerta"
          value={`${fmtNum(vendedoresUnicos)} / ${fmtNum(rows.length)}`}
          icon={<AlertTriangle className="h-5 w-5 text-muted-foreground" />}
          color="default"
        />
      </div>

      {alertas.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum alerta no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <THead>
              <Tr>
                <Th>Severidade</Th>
                <Th>Vendedor</Th>
                <Th>Período</Th>
                <Th>Motivo</Th>
                <Th>Indicador</Th>
                <Th className="text-right">Valor</Th>
              </Tr>
            </THead>
            <TBody>
              {alertas.map((a, i) => (
                <Tr key={i}>
                  <Td>
                    <Badge variant={a.severidade === "alta" ? "destructive" : "warning"}>
                      {a.severidade === "alta" ? "Crítico" : "Atenção"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="font-medium">{a.vendedor.vendedor_nome}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.vendedor.supervisor || "—"} • {a.vendedor.cidade_principal || "—"}
                    </div>
                  </Td>
                  <Td className="text-muted-foreground">{periodoLabel(a.vendedor.periodo)}</Td>
                  <Td>{a.motivo}</Td>
                  <Td className="text-muted-foreground">{a.indicador}</Td>
                  <Td className="text-right font-medium">{a.valor}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: "destructive" | "warning" | "default";
}) {
  const cls =
    color === "destructive"
      ? "border-destructive/30"
      : color === "warning"
      ? "border-warning/30"
      : "border-border";
  return (
    <div className={`rounded-xl border ${cls} bg-card p-4 shadow-card flex items-center gap-3`}>
      <div className="rounded-lg bg-secondary p-2.5">{icon}</div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}
