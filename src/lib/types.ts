// ─── Bases de origem ─────────────────────────────────────────────────────────

export interface BaseComercial {
  periodo: string; // "YYYY-MM"
  vendedor_id: string;
  vendedor_nome: string;
  supervisor?: string;
  regiao?: string;
  faturamento_realizado: number;
  clientes_ativos?: number;
  pedidos?: number;
  ticket_medio?: number;
}

export interface BaseCusto {
  periodo: string;
  vendedor_id: string;
  vendedor_nome?: string;
  custo_total: number;
}

export interface BaseCarteira {
  periodo: string;
  vendedor_id: string;
  vendedor_nome?: string;
  cliente_id: string;
  cliente_nome?: string;
  municipio?: string;
  setor?: string;
  faturamento_cliente_mes?: number;
  faturamento_cliente_3m?: number;
  pedidos_cliente_mes?: number;
  pedidos_cliente_3m?: number;
  status_cliente?: string;
}

// ─── Quadrante / faixa ───────────────────────────────────────────────────────

export type Quadrante = "Estrela" | "Trator caro" | "Potencial" | "Alerta vermelho" | "—";

export type FaixaFaturamento =
  | "Até 200 mil"
  | "200 mil a 500 mil"
  | "500 mil a 1 mi"
  | "1 mi a 2 mi"
  | "Acima de 2 mi";

export const FAIXAS_ORDER: FaixaFaturamento[] = [
  "Até 200 mil",
  "200 mil a 500 mil",
  "500 mil a 1 mi",
  "1 mi a 2 mi",
  "Acima de 2 mi",
];

export const QUADRANTES_ORDER: Quadrante[] = [
  "Estrela",
  "Trator caro",
  "Potencial",
  "Alerta vermelho",
];

// ─── Linha consolidada ───────────────────────────────────────────────────────

export interface VendedorConsolidado {
  periodo: string;
  trimestre: string;
  vendedor_id: string;
  vendedor_nome: string;
  supervisor: string;
  regiao: string;

  faturamento_realizado: number;
  clientes_ativos: number;
  pedidos: number;
  ticket_medio: number;

  custo_total: number;
  percentual_custo: number;
  resultado_bruto: number;
  roi_comercial: number;

  faixa_faturamento: FaixaFaturamento;
  faturamento_status: "Alto" | "Baixo";
  custo_status: "Alto" | "Baixo";
  quadrante_performance: Quadrante;

  total_clientes_carteira: number;
  clientes_positivados_mes: number;
  clientes_positivados_3m: number;
  clientes_sem_compra_3m: number;
  venda_media_por_cliente_mes: number;
  venda_media_por_cliente_3m: number;
  total_municipios_atendidos: number;
  total_setores_atendidos: number;
  faturamento_total_3m_clientes: number;
}

// ─── Dataset persistido ──────────────────────────────────────────────────────

export interface Dataset {
  comercial: BaseComercial[];
  custo: BaseCusto[];
  carteira: BaseCarteira[];
  updatedAt: string;
}

export const EMPTY_DATASET: Dataset = {
  comercial: [],
  custo: [],
  carteira: [],
  updatedAt: new Date().toISOString(),
};
