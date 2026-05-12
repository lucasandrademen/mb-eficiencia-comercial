import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { fmtBRL, fmtPct } from "@/lib/format";
import { getExtratoMaisRecente } from "@/lib/preser/api";
import { CATEGORIA_NOMES } from "@/lib/preser/types";
import type { PreserExtratoCompleto } from "@/lib/preser/types";
import { PreserEmptyState } from "./PreserEmptyState";

export default function PreserSku() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PreserExtratoCompleto | null>(null);
  const [filtroCategoria, setFiltroCategoria] = useState<string>("");
  const [filtroDivisao, setFiltroDivisao] = useState<string>("");
  const [busca, setBusca] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setData(await getExtratoMaisRecente());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalComissao = useMemo(
    () => data?.skus.reduce((s, r) => s + (r.comissao ?? 0), 0) ?? 0,
    [data],
  );

  const filtradas = useMemo(() => {
    if (!data) return [];
    return data.skus.filter((r) => {
      if (filtroCategoria && String(r.categoria) !== filtroCategoria) return false;
      if (filtroDivisao && r.divisao !== filtroDivisao) return false;
      if (busca && !r.grupo_nome.toLowerCase().includes(busca.toLowerCase())) return false;
      return true;
    });
  }, [data, filtroCategoria, filtroDivisao, busca]);

  const divisoes = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.skus.map((s) => s.divisao).filter(Boolean) as string[])).sort();
  }, [data]);

  if (loading) {
    return <PageHeader title="Análise por SKU" subtitle="Carregando…" />;
  }
  if (!data) {
    return (
      <>
        <PageHeader title="Análise por SKU" />
        <PreserEmptyState semExtrato />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Análise por SKU"
        subtitle={`${data.skus.length} SKUs no extrato • Comissão total: ${fmtBRL(totalComissao)}`}
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap gap-2 p-3">
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">Todas as categorias</option>
            {[1, 2, 3, 4].map((c) => (
              <option key={c} value={c}>
                {CATEGORIA_NOMES[c as 1 | 2 | 3 | 4]}
              </option>
            ))}
          </select>
          <select
            value={filtroDivisao}
            onChange={(e) => setFiltroDivisao(e.target.value)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="">Todas as divisões</option>
            {divisoes.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar SKU…"
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>SKU</Th>
                <Th>Categoria</Th>
                <Th>Divisão</Th>
                <Th className="text-right">Efetivo total</Th>
                <Th className="text-right">% comissão</Th>
                <Th className="text-right">Comissão</Th>
                <Th className="text-right">% do total</Th>
              </Tr>
            </THead>
            <TBody>
              {filtradas.map((r) => (
                <Tr key={r.id}>
                  <Td className="max-w-[280px] truncate">{r.grupo_nome}</Td>
                  <Td>{r.categoria_nome ?? CATEGORIA_NOMES[r.categoria as 1]}</Td>
                  <Td>{r.divisao ?? "—"}</Td>
                  <Td className="text-right">{fmtBRL(r.efetivo_total)}</Td>
                  <Td className="text-right">{fmtPct(r.pct_comissao ?? 0, 3)}</Td>
                  <Td className="text-right font-semibold">{fmtBRL(r.comissao)}</Td>
                  <Td className="text-right text-muted-foreground">
                    {fmtPct((r.comissao ?? 0) / (totalComissao || 1))}
                  </Td>
                </Tr>
              ))}
              {filtradas.length === 0 && (
                <Tr>
                  <Td colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhum SKU corresponde aos filtros.
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
