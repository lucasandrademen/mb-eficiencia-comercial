import { useMemo, useState } from "react";
import { DollarSign, Users, TrendingDown, Receipt, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { PeriodoFilter } from "@/components/PeriodoFilter";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TBody, THead, Td, Th, Tr } from "@/components/ui/table";
import { useData } from "@/contexts/DataContext";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { BaseFolha } from "@/lib/types";

export default function Folha() {
  const { dataset, periodosSelecionados } = useData();
  const [q, setQ] = useState("");

  const filtroPeriodo = useMemo(() => new Set(periodosSelecionados), [periodosSelecionados]);
  const rows = useMemo(() => {
    const full = dataset.folha ?? [];
    return filtroPeriodo.size === 0 ? full : full.filter((r) => filtroPeriodo.has(r.periodo));
  }, [dataset.folha, filtroPeriodo]);

  const totals = useMemo(() => {
    const bruto = rows.reduce((s, r) => s + r.bruto, 0);
    const descontos = rows.reduce((s, r) => s + r.descontos, 0);
    const liquido = rows.reduce((s, r) => s + r.liquido, 0);
    return {
      bruto,
      descontos,
      liquido,
      headcount: new Set(rows.map((r) => r.codigo)).size,
      pct_desc: bruto > 0 ? descontos / bruto : 0,
    };
  }, [rows]);

  // agrupar por departamento
  const porDepto = useMemo(() => {
    const map = new Map<string, { bruto: number; descontos: number; liquido: number; n: Set<string> }>();
    for (const r of rows) {
      const key = r.departamento || "—";
      if (!map.has(key)) map.set(key, { bruto: 0, descontos: 0, liquido: 0, n: new Set() });
      const v = map.get(key)!;
      v.bruto += r.bruto;
      v.descontos += r.descontos;
      v.liquido += r.liquido;
      v.n.add(r.codigo);
    }
    return [...map.entries()]
      .map(([depto, v]) => ({
        depto,
        bruto: v.bruto,
        descontos: v.descontos,
        liquido: v.liquido,
        colaboradores: v.n.size,
      }))
      .sort((a, b) => b.bruto - a.bruto);
  }, [rows]);

  const rowsFiltered = useMemo(() => {
    if (!q) return rows;
    const needle = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.nome.toLowerCase().includes(needle) ||
        r.cargo.toLowerCase().includes(needle) ||
        r.departamento.toLowerCase().includes(needle) ||
        r.codigo.includes(needle),
    );
  }, [rows, q]);

  if ((dataset.folha ?? []).length === 0) {
    return (
      <>
        <PageHeader title="Folha de Pagamento" subtitle="Consulta detalhada por colaborador." />
        <EmptyState
          title="Nenhuma folha importada"
          description="Importe o PDF da folha de pagamento na aba Importação para visualizar os detalhes."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Folha de Pagamento"
        subtitle={
          periodosSelecionados.length === 0
            ? `Consolidado de ${new Set(rows.map((r) => r.periodo)).size} mês(es).`
            : `${periodosSelecionados.map((p) => periodoLabel(p)).join(" • ")}.`
        }
        actions={<PeriodoFilter />}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          title="Custo bruto total"
          value={fmtBRL(totals.bruto, { compact: true })}
          subtitle={fmtBRL(totals.bruto)}
          icon={DollarSign}
          variant="primary"
        />
        <MetricCard
          title="Descontos"
          value={fmtBRL(totals.descontos, { compact: true })}
          subtitle={`${fmtPct(totals.pct_desc)} do bruto`}
          icon={TrendingDown}
          variant="warning"
        />
        <MetricCard
          title="Líquido total"
          value={fmtBRL(totals.liquido, { compact: true })}
          subtitle={fmtBRL(totals.liquido)}
          icon={Receipt}
          variant="success"
        />
        <MetricCard
          title="Colaboradores"
          value={fmtNum(totals.headcount)}
          subtitle={`${rows.length} linha(s) na folha`}
          icon={Users}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Por departamento</CardTitle>
            <CardDescription>Custo bruto agrupado.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Tr>
                  <Th>Departamento</Th>
                  <Th className="text-right">Colab.</Th>
                  <Th className="text-right">Bruto</Th>
                </Tr>
              </THead>
              <TBody>
                {porDepto.map((d) => (
                  <Tr key={d.depto}>
                    <Td className="truncate max-w-[200px]" title={d.depto}>
                      {d.depto}
                    </Td>
                    <Td className="text-right">{fmtNum(d.colaboradores)}</Td>
                    <Td className="text-right font-medium">
                      {fmtBRL(d.bruto, { compact: true })}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Colaboradores</CardTitle>
                <CardDescription>Detalhamento por linha da folha.</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar nome, cargo, código…"
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead>
                <Tr>
                  <Th>Código</Th>
                  <Th>Nome</Th>
                  <Th>Cargo</Th>
                  <Th>Depto.</Th>
                  <Th>Período</Th>
                  <Th className="text-right">Bruto</Th>
                  <Th className="text-right">Descontos</Th>
                  <Th className="text-right">Líquido</Th>
                </Tr>
              </THead>
              <TBody>
                {rowsFiltered
                  .slice()
                  .sort((a, b) => b.bruto - a.bruto)
                  .map((r, i) => (
                    <LinhaFolha key={`${r.periodo}|${r.codigo}|${i}`} r={r} />
                  ))}
              </TBody>
            </Table>
            {rowsFiltered.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nenhum resultado para "{q}".
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function LinhaFolha({ r }: { r: BaseFolha }) {
  return (
    <Tr>
      <Td className="font-mono text-xs text-muted-foreground">{r.codigo}</Td>
      <Td className="font-medium">{r.nome}</Td>
      <Td className="text-muted-foreground">{r.cargo || "—"}</Td>
      <Td className="text-muted-foreground">{r.departamento || "—"}</Td>
      <Td className="text-muted-foreground">{periodoLabel(r.periodo)}</Td>
      <Td className="text-right font-medium">{fmtBRL(r.bruto, { compact: true })}</Td>
      <Td className="text-right text-muted-foreground">
        {fmtBRL(r.descontos, { compact: true })}
      </Td>
      <Td className="text-right font-medium">{fmtBRL(r.liquido, { compact: true })}</Td>
    </Tr>
  );
}
