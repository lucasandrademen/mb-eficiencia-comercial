import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/ui/table";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/format";
import { getExtratoMaisRecente } from "@/lib/preser/api";
import type { PreserExtratoCompleto } from "@/lib/preser/types";
import { PreserEmptyState } from "./PreserEmptyState";

export default function PreserCanais() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PreserExtratoCompleto | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await getExtratoMaisRecente());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      />

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
              {data.drops.map((r) => (
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
