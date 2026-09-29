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

export function somarFontes(e: PreserExtratoCompleto): Record<FonteKey, number> {
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
    const cod = o.criterio_codigo ?? 0;
    const com = o.comissao ?? 0;
    if (cod === 22 || cod === 23 || cod === 24 || cod === 25) out.transporte += com;
    else if (cod === 21) out.garantia += com;
    else if (cod === 17 || cod === 19 || cod === 65 || cod === 94) out.visitas += com;
    else if (cod === 98 || cod === 101 || cod === 108) out.seguros += com;
    else out.pontuais += com;
  }
  return out;
}
