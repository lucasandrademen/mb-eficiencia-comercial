import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { PreserPeriodoFilter } from "@/components/PreserPeriodoFilter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/format";
import { usePreserData } from "@/contexts/PreserDataContext";
import { PreserEmptyState } from "./PreserEmptyState";

export default function PreserCanais() {
  const { loading, atual: data } = usePreserData();
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<"comissao" | "rs_calculado" | "qtd_drops">("comissao");

  const insight = useMemo(() => {
    if (!data?.drops.length) return null;
    const melhor = [...data.drops].sort(
      (a, b) => (b.rs_calculado ?? 0) - (a.rs_calculado ?? 0),
    )[0];
    if (!melhor || !melhor.rs_calculado) return null;
    return {
      canal: melhor.canal_nome,
      ganhoPor100: melhor.rs_calculado * 100,
    };
  }, [data]);

  if (loading) return <PageHeader title="Análise por Canal" subtitle="Carregando…" />;
  if (!data) {
    return (
      <>
        <PageHeader title="Análise por Canal" />
        <PreserEmptyState semExtrato />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Análise por Canal / Drops"
        subtitle="Remuneração por pedido (drop) em cada canal de distribuição."
        actions={<PreserPeriodoFilter />}
      />

      {/* Filtros + ordenação */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar canal…"
            className="w-56"
          />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ordenar por:
            </span>
            <select
              value={ordem}
              onChange={(e) => setOrdem(e.target.value as typeof ordem)}
              className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="comissao">Comissão (maior → menor)</option>
              <option value="rs_calculado">R$ por drop</option>
              <option value="qtd_drops">Quantidade de drops</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {insight && (
        <Card className="mb-4 border-success/40 bg-success/5">
          <CardHeader>
            <CardTitle className="text-base">💡 Oportunidade</CardTitle>
            <CardDescription>
              Adicionar 100 drops em <strong>{insight.canal}</strong> = +
              {fmtBRL(insight.ganhoPor100)} de comissão.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>Canal</Th>
                <Th className="text-right">Qtd drops</Th>
                <Th className="text-right">R$/drop</Th>
                <Th className="text-right">Fator regional.</Th>
                <Th className="text-right">Fator desloc.</Th>
                <Th className="text-right">R$ calculado</Th>
                <Th className="text-right">Comissão</Th>
              </Tr>
            </THead>
            <TBody>
              {[...data.drops]
                .filter((r) => !busca || r.canal_nome.toLowerCase().includes(busca.toLowerCase()))
                .sort((a, b) => (b[ordem] ?? 0) - (a[ordem] ?? 0))
                .map((r) => (
                  <Tr key={r.id}>
                    <Td>{r.canal_nome}</Td>
                    <Td className="text-right">{fmtNum(r.qtd_drops)}</Td>
                    <Td className="text-right">{fmtBRL(r.rs_por_drop)}</Td>
                    <Td className="text-right">{fmtPct(r.fator_regionalizacao ?? 0)}</Td>
                    <Td className="text-right">{fmtPct(r.fator_deslocamento ?? 0)}</Td>
                    <Td className="text-right">{fmtBRL(r.rs_calculado)}</Td>
                    <Td className="text-right font-semibold">{fmtBRL(r.comissao)}</Td>
                  </Tr>
                ))}
              {data.drops.length === 0 && (
                <Tr>
                  <Td colSpan={7} className="text-center text-sm text-muted-foreground">
                    Sem dados de canais neste extrato.
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
