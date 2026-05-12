import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
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
  | "vendedor_nome"
  | "supervisor"
  | "cidade_principal"
  | "faturamento"
  | "custo"
  | "percentual_custo"
  | "resultado_bruto"
  | "roi_comercial"
  | "total_clientes_carteira"
  | "total_municipios_atendidos"
  | "ticket_medio";

type Dir = "asc" | "desc";

const quadrantBadge: Record<string, "success" | "warning" | "default" | "destructive" | "muted"> = {
  Estrela: "success",
  "Trator caro": "warning",
  Potencial: "default",
  "Alerta vermelho": "destructive",
  "—": "muted",
};

export default function Ranking() {
  const { rows } = useData();
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("faturamento");
  const [dir, setDir] = useState<Dir>("desc");

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) setDir(dir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      // Numéricos default desc, textos default asc
      const isNumeric = [
        "faturamento",
        "custo",
        "percentual_custo",
        "resultado_bruto",
        "roi_comercial",
        "total_clientes_carteira",
        "total_municipios_atendidos",
        "ticket_medio",
      ].includes(key);
      setDir(isNumeric ? "desc" : "asc");
    }
  };

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
      const va = a[sortKey] as number | string;
      const vb = b[sortKey] as number | string;
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "pt-BR");
      return dir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, dir, q]);

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
        subtitle={`${fmtNum(sorted.length)} vendedor(es) — clique no cabeçalho de qualquer coluna pra ordenar.`}
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
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Ordenando por</span>
            <Badge variant="default" className="gap-1">
              {sortLabels[sortKey]}
              {dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <THead>
            <Tr>
              <Th className="w-[44px]">#</Th>
              <SortTh label="Vendedor" k="vendedor_nome" sortKey={sortKey} dir={dir} onClick={onHeaderClick} />
              <SortTh label="Supervisor" k="supervisor" sortKey={sortKey} dir={dir} onClick={onHeaderClick} />
              <SortTh label="Região" k="cidade_principal" sortKey={sortKey} dir={dir} onClick={onHeaderClick} />
              <SortTh label="Faturamento" k="faturamento" sortKey={sortKey} dir={dir} onClick={onHeaderClick} align="right" />
              <SortTh label="Custo" k="custo" sortKey={sortKey} dir={dir} onClick={onHeaderClick} align="right" />
              <SortTh label="% Custo" k="percentual_custo" sortKey={sortKey} dir={dir} onClick={onHeaderClick} align="right" />
              <SortTh label="Result. Bruto" k="resultado_bruto" sortKey={sortKey} dir={dir} onClick={onHeaderClick} align="right" />
              <SortTh label="ROI" k="roi_comercial" sortKey={sortKey} dir={dir} onClick={onHeaderClick} align="right" />
              <Th>Faixa</Th>
              <Th>Quadrante</Th>
              <SortTh label="Clientes" k="total_clientes_carteira" sortKey={sortKey} dir={dir} onClick={onHeaderClick} align="right" />
              <SortTh label="Cidades" k="total_municipios_atendidos" sortKey={sortKey} dir={dir} onClick={onHeaderClick} align="right" />
              <SortTh label="Ticket médio" k="ticket_medio" sortKey={sortKey} dir={dir} onClick={onHeaderClick} align="right" />
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

const sortLabels: Record<SortKey, string> = {
  vendedor_nome: "Vendedor",
  supervisor: "Supervisor",
  cidade_principal: "Região",
  faturamento: "Faturamento",
  custo: "Custo",
  percentual_custo: "% Custo",
  resultado_bruto: "Result. Bruto",
  roi_comercial: "ROI",
  total_clientes_carteira: "Clientes",
  total_municipios_atendidos: "Cidades",
  ticket_medio: "Ticket médio",
};

function SortTh({
  label,
  k,
  sortKey,
  dir,
  onClick,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  dir: Dir;
  onClick: (k: SortKey) => void;
  align?: "right";
}) {
  const active = sortKey === k;
  return (
    <Th className={align === "right" ? "text-right" : ""}>
      <button
        type="button"
        onClick={() => onClick(k)}
        className={cn(
          "inline-flex items-center gap-1 text-inherit hover:text-foreground transition-colors",
          align === "right" && "flex-row-reverse",
          active && "text-primary",
        )}
      >
        {label}
        {active ? (
          dir === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </Th>
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
