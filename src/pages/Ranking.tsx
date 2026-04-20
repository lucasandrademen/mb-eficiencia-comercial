import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, fmtROI } from "@/lib/format";
import { VendedorConsolidado } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey =
  | "faturamento"
  | "percentual_custo"
  | "roi_comercial"
  | "resultado_bruto"
  | "ticket_medio"
  | "total_clientes_carteira";

const sortOptions: { key: SortKey; label: string; dir: "asc" | "desc" }[] = [
  { key: "faturamento", label: "Maior faturamento", dir: "desc" },
  { key: "percentual_custo", label: "Menor % de custo", dir: "asc" },
  { key: "roi_comercial", label: "Maior ROI", dir: "desc" },
  { key: "resultado_bruto", label: "Maior resultado bruto", dir: "desc" },
  { key: "ticket_medio", label: "Maior ticket médio", dir: "desc" },
  { key: "total_clientes_carteira", label: "Mais clientes", dir: "desc" },
];

const quadrantBadge: Record<string, "success" | "warning" | "default" | "destructive" | "muted"> = {
  Estrela: "success",
  "Trator caro": "warning",
  Potencial: "default",
  "Alerta vermelho": "destructive",
  "—": "muted",
};

export default function Ranking() {
  const { rows } = useData();
  const [sortIdx, setSortIdx] = useState(0);
  const [q, setQ] = useState("");

  const sortConf = sortOptions[sortIdx];

  const sorted = useMemo(() => {
    const filtered = q
      ? rows.filter(
          (r) =>
            r.vendedor_nome.toLowerCase().includes(q.toLowerCase()) ||
            r.supervisor.toLowerCase().includes(q.toLowerCase()) ||
            r.cidade_principal.toLowerCase().includes(q.toLowerCase()),
        )
      : rows;
    const arr = [...filtered].sort((a, b) => {
      const va = a[sortConf.key] as number;
      const vb = b[sortConf.key] as number;
      return sortConf.dir === "desc" ? vb - va : va - vb;
    });
    return arr;
  }, [rows, sortConf, q]);

  if (rows.length === 0) {
    return (
      <>
        <PageHeader title="Ranking de Vendedores" />
        <EmptyState />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Ranking de Vendedores"
        subtitle={`${fmtNum(sorted.length)} vendedor(es) — ordenado por ${sortConf.label.toLowerCase()}.`}
        actions={<PeriodoFilter />}
      />

      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar vendedor, supervisor ou região…"
              className="pl-8"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sortOptions.map((opt, i) => (
              <button
                key={opt.key + opt.dir}
                onClick={() => setSortIdx(i)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1",
                  i === sortIdx
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                )}
              >
                {opt.label}
                {opt.dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <THead>
            <Tr>
              <Th className="w-[44px]">#</Th>
              <Th>Vendedor</Th>
              <Th>Supervisor</Th>
              <Th>Região</Th>
              <Th className="text-right">Faturamento</Th>
              <Th className="text-right">Custo</Th>
              <Th className="text-right">% Custo</Th>
              <Th className="text-right">Result. Bruto</Th>
              <Th className="text-right">ROI</Th>
              <Th>Faixa</Th>
              <Th>Quadrante</Th>
              <Th className="text-right">Clientes</Th>
              <Th className="text-right">Cidades</Th>
              <Th className="text-right">Ticket médio</Th>
            </Tr>
          </THead>
          <TBody>
            {sorted.map((r, i) => (
              <RankRow key={`${r.periodo}|${r.vendedor_id}`} idx={i + 1} r={r} />
            ))}
          </TBody>
        </Table>
      </Card>
    </>
  );
}

function RankRow({ idx, r }: { idx: number; r: VendedorConsolidado }) {
  return (
    <Tr>
      <Td className="text-muted-foreground font-mono text-xs">{idx}</Td>
      <Td>
        <div className="font-medium">{r.vendedor_nome}</div>
        <div className="text-[11px] text-muted-foreground">{r.periodo}</div>
      </Td>
      <Td className="text-muted-foreground">{r.supervisor || "—"}</Td>
      <Td className="text-muted-foreground">{r.cidade_principal || "—"}</Td>
      <Td className="text-right font-medium">{fmtBRL(r.faturamento, { compact: true })}</Td>
      <Td className="text-right">{fmtBRL(r.custo, { compact: true })}</Td>
      <Td className="text-right">
        <span className={r.percentual_custo > 0.12 ? "text-destructive font-medium" : ""}>
          {fmtPct(r.percentual_custo)}
        </span>
      </Td>
      <Td className="text-right">
        <span className={r.resultado_bruto < 0 ? "text-destructive font-medium" : ""}>
          {fmtBRL(r.resultado_bruto, { compact: true })}
        </span>
      </Td>
      <Td className="text-right font-medium">{fmtROI(r.roi_comercial)}</Td>
      <Td>
        <Badge variant="muted" className="text-[10px]">
          {r.faixa_faturamento}
        </Badge>
      </Td>
      <Td>
        <Badge variant={quadrantBadge[r.quadrante_performance]} className="text-[10px]">
          {r.quadrante_performance}
        </Badge>
      </Td>
      <Td className="text-right">{fmtNum(r.total_clientes_carteira)}</Td>
      <Td className="text-right">{fmtNum(r.total_municipios_atendidos)}</Td>
      <Td className="text-right">{fmtBRL(r.ticket_medio, { compact: true })}</Td>
    </Tr>
  );
}
