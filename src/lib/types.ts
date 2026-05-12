// ─── Bases de origem ───────────────────────────────────────────────────────

export interface BaseVendedor {
  periodo: string; // "YYYY-MM"
  vendedor_id: string;
  vendedor_nome: string;
  supervisor?: string;
  faturamento: number;
  custo: number;
}

export interface BaseCarteira {
  periodo: string;
  vendedor_id: string;
  cliente_id: string;
  cliente_nome?: string;
  cidade?: string;
  faturamento_cliente: number;
}

// ─── Folha de pagamento (extraída do PDF) ──────────────────────────────────

export interface BaseFolha {
  periodo: string;
  codigo: string;
  nome: string;
  cargo: string;
  departamento: string;
  bruto: number;
  descontos: number;
  liquido: number;
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

// ─── Linha consolidada (1 por vendedor/período) ─────────────────────────────

export interface VendedorConsolidado {
  periodo: string;
  trimestre: string;
  vendedor_id: string;
  vendedor_nome: string;
  supervisor: string;
  cidade_principal: string;

  faturamento: number;
  custo: number;
  resultado_bruto: number;
  percentual_custo: number;
  roi_comercial: number;

  faixa_faturamento: FaixaFaturamento;
  faturamento_status: "Alto" | "Baixo";
  custo_status: "Alto" | "Baixo";
  quadrante_performance: Quadrante;

  // Carteira
  total_clientes_carteira: number;
  total_municipios_atendidos: number;
  ticket_medio: number; // faturamento / total_clientes_carteira
  custo_por_cliente_carteira: number;

  // Diagnóstico do match com a folha
  folha_match_status: "codigo" | "nome_exato" | "nome_fuzzy" | "sem_match" | "sem_folha";
  folha_match_nome?: string;

  // Supervisor comercial (identificado pelo primeiro nome na planilha Preser)
  is_supervisor: boolean;
}

// Lista de supervisores comerciais (match por prefixo do nome normalizado).
// Cada entrada é comparada com as N primeiras palavras do nome do vendedor —
// permite distinguir "Anderson Santiago" (supervisor) de outros "Anderson" (vendedores).
export const SUPERVISOR_NAME_PREFIXES = [
  "AMADEU",
  "ANDERSON SANTIAGO",
  "FRANK",
  "LILIAN",
  "RICARDO",
  "MATHEUS",
] as const;

// ─── Dataset persistido ──────────────────────────────────────────────────────

export interface Dataset {
  vendedor: BaseVendedor[];
  carteira: BaseCarteira[];
  folha: BaseFolha[];
  updatedAt: string;
}

export const EMPTY_DATASET: Dataset = {
  vendedor: [],
  carteira: [],
  folha: [],
  updatedAt: new Date().toISOString(),
};
