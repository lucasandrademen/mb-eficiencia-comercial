export type PreserCategoriaCodigo = 1 | 2 | 3 | 4;

export const CATEGORIA_NOMES: Record<PreserCategoriaCodigo, string> = {
  1: "Mix Pilar",
  2: "High Pull",
  3: "High High Pull",
  4: "Estratégico",
};

export const CATEGORIA_PCT: Record<PreserCategoriaCodigo, number> = {
  1: 0.025,
  2: 0.0115,
  3: 0.0025,
  4: 0.04,
};

export const CANAIS_RS_DROP: Record<string, number> = {
  "Trad Outros": 57.31,
  "Trad Bronze": 68.55,
  "AS Regular": 78.77,
  "AS Prata": 78.77,
  "AS Ouro": 137.08,
  "Distribuidor": 78.77,
  "KA Distribuidor": 259.87,
  "KA": 259.87,
  "KA Top": 259.87,
  "Farma B": 0,
  "Farma C": 35.82,
  "Professional": 64.64,
};

export interface PreserExtrato {
  id: string;
  periodo: string; // YYYY-MM-DD
  broker: string | null;
  planta: string | null;
  regional: string | null;
  valor_total_comissao: number | null;
  valor_total_contabilizado: number | null;
  faturamento_ac: number | null;
  pct_remuneracao_sobre_fat: number | null;
  irrf_retido: number | null;
  pis_retido: number | null;
  cofins_retido: number | null;
  csll_retido: number | null;
  created_at: string;
}

export interface PreserSku {
  id: string;
  extrato_id: string;
  grupo_codigo: number;
  grupo_nome: string;
  divisao: string | null;
  categoria: PreserCategoriaCodigo;
  categoria_nome: string | null;
  efetivo: number | null;
  efetivo_adicional: number | null;
  efetivo_total: number | null;
  pct_comissao: number | null;
  comissao: number | null;
}

export interface PreserDrops {
  id: string;
  extrato_id: string;
  canal_codigo: number;
  canal_nome: string;
  qtd_drops: number | null;
  rs_por_drop: number | null;
  fator_regionalizacao: number | null;
  fator_deslocamento: number | null;
  rs_calculado: number | null;
  comissao: number | null;
}

export type PreserMetaTipo = "VBC" | "Cobertura" | "Recomendador";

export interface PreserMeta {
  id: string;
  extrato_id: string;
  criterio_codigo: number | null;
  criterio_nome: string | null;
  bu: string | null;
  tipo: PreserMetaTipo | null;
  objetivo_minimo: number | null;
  objetivo_meta: number | null;
  objetivo_ideal: number | null;
  pct_minimo: number | null;
  pct_meta: number | null;
  pct_ideal: number | null;
  efetivo_fiscal: number | null;
  efetivo_mes: number | null;
  pct_atingido: number | null;
  comissao: number | null;
  pct_realizacao: number | null;
}

export interface PreserOutro {
  id: string;
  extrato_id: string;
  criterio_codigo: number | null;
  criterio_nome: string | null;
  tipo_servico: string | null;
  bu: string | null;
  base_calculo: number | null;
  base_unidade: string | null;
  rs_unitario: number | null;
  comissao: number | null;
  observacao: string | null;
  contabilizado: boolean;
}

export interface PreserExtratoCompleto {
  extrato: PreserExtrato;
  skus: PreserSku[];
  drops: PreserDrops[];
  metas: PreserMeta[];
  outros: PreserOutro[];
}
