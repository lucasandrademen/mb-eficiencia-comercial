// ─── Bases de origem ───────────────────────────────────────────────────────

/** Indicadores de uma força de venda (planilhas "Acompanhamento 2026"). */
export interface ForcaVendedor {
  vbc: number;
  vbc_objetivo?: number;
  cobertura?: number;
  cobertura_objetivo?: number;
  positivacao?: number; // 0–1
  comissao: number; // PRESER pago ao vendedor por essa força
}

export interface BaseVendedor {
  periodo: string; // "YYYY-MM"
  vendedor_id: string;
  vendedor_nome: string;
  supervisor?: string;
  faturamento: number;
  custo: number;
  /** Detalhe por força de venda (opcional; vem do Acompanhamento anual). */
  forcas?: Partial<Record<"nestle" | "garoto" | "npro", ForcaVendedor>>;
  /** PRESER pago ao vendedor somando as forças. */
  comissao_preser?: number;
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

export interface VerbaFolha {
  tipo: "vencimento" | "desconto";
  codigo: string;
  descricao: string;
  valor: number;
}

/** Encargos patronais (custo da EMPRESA, lidos da coluna "Bases" da folha). */
export interface EncargosFolha {
  fgts: number; // Valor FGTS (depósito 8%)
  inssEmpresa: number; // GPS - Empresa (INSS patronal)
  terceiros: number; // GPS - Terceiros (Sistema S)
  rat: number; // GPS - RAT/SAT
}

export interface BaseFolha {
  periodo: string;
  codigo: string;
  nome: string;
  cargo: string;
  departamento: string;
  bruto: number;
  descontos: number;
  liquido: number;
  // Adicionados ao detalhar a folha por verba (opcionais p/ compatibilidade com
  // dados já salvos pela versão antiga, que só tinha os totais).
  centroCusto?: string;
  tipo?: string; // EMPREGADO | APRENDIZ | SÓCIO ...
  verbas?: VerbaFolha[];
  encargos?: EncargosFolha;
  admissao?: string; // "YYYY-MM-DD"
  demissao?: string; // "YYYY-MM-DD" (só quando desligado)
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
  /** Clientes da carteira que compraram no mês. */
  clientes_positivados?: number;
  total_municipios_atendidos: number;
  ticket_medio: number; // faturamento / total_clientes_carteira
  custo_por_cliente_carteira: number;

  // Diagnóstico do match com a folha
  folha_match_status: "codigo" | "nome_exato" | "nome_fuzzy" | "sem_match" | "sem_folha";
  folha_match_nome?: string;
  /** Verbas que não são do mês de trabalho (rescisão, 1/3 férias, 13º, retroativos) + encargos — fora do `custo`. */
  custo_nao_recorrente?: number;
  /** Desligado no mês (tem data de demissão na folha). */
  desligado?: boolean;
  /** KA, Varejo ou NPRO — medianas e quadrantes são calculados dentro do segmento. */
  segmento?: "KA" | "Varejo" | "NPRO";

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

// ─── DRO (financeiro real — o que de fato entrou no caixa da MB) ────────────

export interface DroMes {
  periodo: string; // "YYYY-MM"
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number; // ⭐ quanto a MB faturou líquido (entrou no caixa)
  custoServicos: number;
  despTributarias: number;
  despOperacionais: number;
  ebitda: number;
  // Linhas abaixo do EBITDA — opcionais porque imports antigos não as tinham.
  // Quando presentes, fecham a cascata até o Resultado (RecFin − DespFin + RecNaoOp
  // − IR/CSLL − DespNaoDed − Deprec).
  receitasFinanceiras?: number;
  receitasNaoOperacionais?: number;
  despesasFinanceiras?: number;
  irCsll?: number;
  despesasNaoDedutiveis?: number;
  depreciacao?: number;
  resultado: number;
}

export interface DroDataset {
  empresa: string;
  meses2026: DroMes[];
  meses2025: DroMes[];
  atualizadoEm: string;
}

// ─── Dataset persistido ──────────────────────────────────────────────────────

export interface Dataset {
  vendedor: BaseVendedor[];
  carteira: BaseCarteira[];
  folha: BaseFolha[];
  dro?: DroDataset; // financeiro importado (DRO)
  updatedAt: string;
}

export const EMPTY_DATASET: Dataset = {
  vendedor: [],
  carteira: [],
  folha: [],
  updatedAt: new Date().toISOString(),
};
