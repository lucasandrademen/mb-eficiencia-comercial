import type { PreserExtratoCompleto } from "./types";

/** Fontes de receita do PRESER (soma das linhas do extrato, por natureza). */
export const FONTES = [
  { key: "vendas", nome: "Vendas", desc: "SKUs (Crit. 1)" },
  { key: "drops", nome: "Drops", desc: "Entregas por canal (Crit. 20)" },
  { key: "metas", nome: "Bônus Meta", desc: "VBC + Cobertura + Recomendador" },
  { key: "transporte", nome: "Transporte", desc: "Armazenagem + Refrigerado + Entrega" },
  { key: "garantia", nome: "Garantia Crédito", desc: "0,6% s/ faturamento (Crit. 21)" },
  { key: "visitas", nome: "Visitas / Mercha", desc: "Farma + PAC + Merchandising" },
  { key: "seguros", nome: "Seguros", desc: "RC-DC + Seguro Patrimonial" },
  { key: "pontuais", nome: "Bônus Pontuais", desc: "Ressarcimentos, incentivos" },
] as const;

export type FonteKey = (typeof FONTES)[number]["key"];

/** Fonte de uma linha "outros" pelo código do critério. */
export function fonteDoOutro(cod: number | null): FonteKey {
  const c = cod ?? 0;
  if (c === 22 || c === 23 || c === 24 || c === 25) return "transporte";
  if (c === 21) return "garantia";
  if (c === 17 || c === 19 || c === 65 || c === 94) return "visitas";
  if (c === 98 || c === 101 || c === 108) return "seguros";
  return "pontuais";
}

/**
 * Soma por fonte. Com `soContabilizado`, ignora linhas fora do total do extrato
 * (ex.: Entrega NiM paga via CT-e) — aí a soma fecha com valor_total_comissao.
 */
export function somarFontes(
  e: PreserExtratoCompleto,
  { soContabilizado = false }: { soContabilizado?: boolean } = {},
): Record<FonteKey, number> {
  const soma = <T extends { comissao: number | null }>(rs: T[]) =>
    rs.reduce((s, r) => s + (r.comissao ?? 0), 0);
  const out: Record<FonteKey, number> = {
    vendas: soma(e.skus),
    drops: soma(e.drops),
    metas: soma(e.metas),
    transporte: 0,
    garantia: 0,
    visitas: 0,
    seguros: 0,
    pontuais: 0,
  };
  for (const o of e.outros) {
    if (soContabilizado && o.contabilizado === false) continue;
    out[fonteDoOutro(o.criterio_codigo)] += o.comissao ?? 0;
  }
  return out;
}
