// ⚠️ GERADO a partir de "DRO MB Logistica 2026..xlsx" (aba "MB Logistica").
// IMPORTANTE: todos os acumulados (ytd*) somam APENAS Jan–Abr (DRO_MESES_PREENCHIDOS),
// para 2025 E 2026 — comparacao do MESMO periodo. A planilha tem a coluna de 2025
// com lancamentos espalhados (inclui perdas de Jul–Dez/25) e um lancamento solto em
// Jul/26; somar 12 meses misturaria periodos. Por isso o corte em 4 meses.
// Cascata validada (Jan–Abr): RecLiq − Custo − Desp.Trib − Desp.Op = EBITDA;
// EBITDA + RecFin − DespFin + RecNaoOp − IR/CSLL − DespNaoDed − Deprec = Resultado.

export const DRO_FONTE = "DRO MB Logística 2026";
export const DRO_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;
/** Meses com lancamento completo — base de TODOS os acumulados e comparacoes. */
export const DRO_MESES_PREENCHIDOS = 4; // Jan–Abr

export interface DroLinhas {
  receitaBruta: number[];
  deducoes: number[];
  receitaLiquida: number[];
  custoServicos: number[];
  despesasTributarias: number[];
  despesasOperacionais: number[];
  ebitda: number[];
  receitasFinanceiras: number[];
  receitasNaoOperacionais: number[];
  despesasFinanceiras: number[];
  irCsll: number[];
  despesasNaoDedutiveis: number[];
  depreciacao: number[];
  resultado: number[];
}

export interface DroYtd {
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custoServicos: number;
  despesasTributarias: number;
  despesasOperacionais: number;
  ebitda: number;
  receitasFinanceiras: number;
  receitasNaoOperacionais: number;
  despesasFinanceiras: number;
  irCsll: number;
  despesasNaoDedutiveis: number;
  depreciacao: number;
  resultado: number;
}

export const dro2026: DroLinhas = {
  receitaBruta: [1880188, 2243828, 2282377, 2367552, 0, 0, 0, 0, 0, 0, 0, 0],
  deducoes: [187831, 215782, 267756, 288626, 0, 0, 0, 0, 0, 0, 0, 0],
  receitaLiquida: [1692357, 2028046, 2014621, 2078925, 0, 0, 0, 0, 0, 0, 0, 0],
  custoServicos: [735409, 820378, 761485, 705536, 0, 0, 0, 0, 0, 0, 0, 0],
  despesasTributarias: [1099, 5812, 80357, 1622, 0, 0, 0, 0, 0, 0, 0, 0],
  despesasOperacionais: [455504, 428273, 367695, 354084, 0, 0, 0, 0, 0, 0, 0, 0],
  ebitda: [500345, 773584, 805085, 1017683, 0, 0, 0, 0, 0, 0, 0, 0],
  receitasFinanceiras: [929, 995, 1397, 958, 0, 0, 3699, 0, 0, 0, 0, 0],
  receitasNaoOperacionais: [8766, 11143, 4383, 0, 0, 0, 1470, 0, 0, 0, 0, 0],
  despesasFinanceiras: [108174, 96044, 173821, 66793, 0, 0, 75739, 0, 0, 0, 0, 0],
  irCsll: [0, 0, 683658, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  despesasNaoDedutiveis: [38152, 41456, 53436, 46711, 0, 0, 13212, 0, 0, 0, 0, 0],
  depreciacao: [42996, 33996, 33996, 33996, 0, 0, 42996, 0, 0, 0, 0, 0],
  resultado: [320719, 614226, -134047, 871142, 0, 0, -126779, 0, 0, 0, 0, 0],
};

export const dro2025: DroLinhas = {
  receitaBruta: [1727060, 2036107, 1958493, 2234660, 0, 0, 0, 0, 0, 0, 0, 0],
  deducoes: [168683, 167511, 189860, 218873, 0, 0, 0, 0, 0, 0, 0, 0],
  receitaLiquida: [1558377, 1868596, 1768632, 2015787, 0, 0, 0, 0, 0, 0, 0, 0],
  custoServicos: [712114, 626727, 798859, 707594, 0, 0, 0, 0, 0, 0, 0, 0],
  despesasTributarias: [83471, 1456, 3811, 1449, 0, 0, 0, 3950, 0, 0, 0, 0],
  despesasOperacionais: [345383, 376113, 389233, 345652, 0, 0, 0, 0, 0, 0, 736752, 696890],
  ebitda: [417409, 864301, 576730, 961092, 0, 0, 0, -3950, 0, 0, -736752, -696890],
  receitasFinanceiras: [810, 779, 632, 577, 0, 0, 1006, 790, 496, 744, 755, 18632],
  receitasNaoOperacionais: [0, 0, 17000, 7721, 0, 0, 150000, 100000, 150000, 120000, 148397, 42273],
  despesasFinanceiras: [82106, 96063, 123004, 94482, 0, 0, 99586, 94313, 74497, 197529, 33090, 102151],
  irCsll: [0, 0, 576478, 0, 0, 0, 0, 0, 246891, 246891, 0, 741452],
  despesasNaoDedutiveis: [16157, 19689, 9255, 13869, 0, 0, 11432, 10088, 10678, 14432, 14877, 14696],
  depreciacao: [42996, 42996, 42996, 42996, 0, 0, 47996, 47996, 47996, 47996, 42996, 42996],
  resultado: [276959, 706331, -157371, 818043, 0, 0, -8008, -55558, -229566, -386104, -678563, -1537280],
};

/** Acumulado Jan–Abr 2026. */
export const ytd2026: DroYtd = { receitaBruta: 8773945, deducoes: 959995, receitaLiquida: 7813949, custoServicos: 3022808, despesasTributarias: 88890, despesasOperacionais: 1605556, ebitda: 3096697, receitasFinanceiras: 4279, receitasNaoOperacionais: 24292, despesasFinanceiras: 444832, irCsll: 683658, despesasNaoDedutiveis: 179755, depreciacao: 144984, resultado: 1672040 };

/** Acumulado Jan–Abr 2025 (mesmo periodo, comparavel). */
export const ytd2025: DroYtd = { receitaBruta: 7956320, deducoes: 744927, receitaLiquida: 7211392, custoServicos: 2845294, despesasTributarias: 90187, despesasOperacionais: 1456381, ebitda: 2819532, receitasFinanceiras: 2798, receitasNaoOperacionais: 24721, despesasFinanceiras: 395655, irCsll: 576478, despesasNaoDedutiveis: 58970, depreciacao: 171984, resultado: 1643962 };

export interface CustoBucket { nome: string; valor: number; pctReceita: number; cor: string }

/** Composicao dos custos acima do EBITDA (Jan–Abr 2026), agrupada em baldes. */
export const custoBuckets: CustoBucket[] = [
  { nome: "Pessoal & Encargos", valor: 3556771, pctReceita: 0.4552, cor: "hsl(197 99% 28%)" },
  { nome: "Frota & Operação", valor: 493035, pctReceita: 0.0631, cor: "hsl(38 92% 50%)" },
  { nome: "Tributos", valor: 367247, pctReceita: 0.047, cor: "hsl(280 55% 55%)" },
  { nome: "Estrutura & Administrativo", valor: 300198, pctReceita: 0.0384, cor: "hsl(196 89% 35%)" },
];

export const custosTotais2026 = ytd2026.custoServicos + ytd2026.despesasTributarias + ytd2026.despesasOperacionais;
export const custosTotais2025 = ytd2025.custoServicos + ytd2025.despesasTributarias + ytd2025.despesasOperacionais;

export const margens2026 = {
  ebitda: ytd2026.ebitda / ytd2026.receitaLiquida,
  liquida: ytd2026.resultado / ytd2026.receitaLiquida,
};

/** Variacao ano-a-ano. Sem base (b=0) devolve NaN — o consumidor mostra "—" / "s/ base". */
export function varYoY(a: number, b: number): number { return b !== 0 ? a / b - 1 : NaN; }
export const yoy = {
  receita: varYoY(ytd2026.receitaLiquida, ytd2025.receitaLiquida),
  ebitda: varYoY(ytd2026.ebitda, ytd2025.ebitda),
  resultado: varYoY(ytd2026.resultado, ytd2025.resultado),
  despesasOperacionais: varYoY(ytd2026.despesasOperacionais, ytd2025.despesasOperacionais),
  despesasFinanceiras: varYoY(ytd2026.despesasFinanceiras, ytd2025.despesasFinanceiras),
  irCsll: varYoY(ytd2026.irCsll, ytd2025.irCsll),
};

/** Agrega as linhas do DRO sobre os meses (índices 0–11) escolhidos → um DroYtd. */
export function agregarDro(d: DroLinhas, meses: number[]): DroYtd {
  const s = (arr: number[]) => meses.reduce((acc, i) => acc + (arr[i] || 0), 0);
  return {
    receitaBruta: s(d.receitaBruta),
    deducoes: s(d.deducoes),
    receitaLiquida: s(d.receitaLiquida),
    custoServicos: s(d.custoServicos),
    despesasTributarias: s(d.despesasTributarias),
    despesasOperacionais: s(d.despesasOperacionais),
    ebitda: s(d.ebitda),
    receitasFinanceiras: s(d.receitasFinanceiras),
    receitasNaoOperacionais: s(d.receitasNaoOperacionais),
    despesasFinanceiras: s(d.despesasFinanceiras),
    irCsll: s(d.irCsll),
    despesasNaoDedutiveis: s(d.despesasNaoDedutiveis),
    depreciacao: s(d.depreciacao),
    resultado: s(d.resultado),
  };
}
