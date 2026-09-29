import { DroDataset, DroMes } from "@/lib/types";
import { DRO_MESES_PREENCHIDOS, DroLinhas, dro2025, dro2026 } from "./logisticaData";

const zeros12 = (): number[] => Array(12).fill(0);

/** Índice do mês (0–11) a partir de "YYYY-MM"; -1 se inválido. */
function mesIdx(periodo: string): number {
  const i = parseInt(periodo.split("-")[1] ?? "", 10) - 1;
  return Number.isFinite(i) && i >= 0 && i <= 11 ? i : -1;
}

/** Converte os meses importados (DroMes[]) no formato de séries (DroLinhas, 12 posições). */
export function linhasFromMeses(meses: DroMes[]): DroLinhas {
  const L: DroLinhas = {
    receitaBruta: zeros12(),
    deducoes: zeros12(),
    receitaLiquida: zeros12(),
    custoServicos: zeros12(),
    despesasTributarias: zeros12(),
    despesasOperacionais: zeros12(),
    ebitda: zeros12(),
    receitasFinanceiras: zeros12(),
    receitasNaoOperacionais: zeros12(),
    despesasFinanceiras: zeros12(),
    irCsll: zeros12(),
    despesasNaoDedutiveis: zeros12(),
    depreciacao: zeros12(),
    resultado: zeros12(),
  };
  for (const m of meses) {
    const i = mesIdx(m.periodo);
    if (i < 0) continue;
    L.receitaBruta[i] = m.receitaBruta;
    L.deducoes[i] = m.deducoes;
    L.receitaLiquida[i] = m.receitaLiquida;
    L.custoServicos[i] = m.custoServicos;
    L.despesasTributarias[i] = m.despTributarias;
    L.despesasOperacionais[i] = m.despOperacionais;
    L.ebitda[i] = m.ebitda;
    L.receitasFinanceiras[i] = m.receitasFinanceiras ?? 0;
    L.receitasNaoOperacionais[i] = m.receitasNaoOperacionais ?? 0;
    L.despesasFinanceiras[i] = m.despesasFinanceiras ?? 0;
    L.irCsll[i] = m.irCsll ?? 0;
    L.despesasNaoDedutiveis[i] = m.despesasNaoDedutiveis ?? 0;
    L.depreciacao[i] = m.depreciacao ?? 0;
    L.resultado[i] = m.resultado;
  }
  return L;
}

export interface FonteDro {
  d2026: DroLinhas;
  d2025: DroLinhas;
  /** Índices dos meses de 2026 com lançamento (ordenados) — chips e séries. */
  mesesIdx: number[];
  /** Índices presentes em 2026 E 2025 — base SAME-PERIOD das comparações vs 2025. */
  mesesComuns: number[];
  /** true = usando o DRO importado; false = DRO embutido (Jan–Abr). */
  importado: boolean;
}

/** Tolerância (R$) para a reconciliação da cascata. */
const TOL = 2;

/**
 * O mês "fecha" a cascata abaixo do EBITDA até o Resultado?
 * (EBITDA + RecFin + RecNaoOp − DespFin − IR/CSLL − DespNaoDed − Deprec = Resultado)
 * Imports antigos (sem as linhas abaixo do EBITDA) NÃO reconciliam → false.
 */
function cascataReconcilia(m: DroMes): boolean {
  if (typeof m.despesasFinanceiras !== "number") return false;
  const abaixo =
    (m.receitasFinanceiras ?? 0) +
    (m.receitasNaoOperacionais ?? 0) -
    (m.despesasFinanceiras ?? 0) -
    (m.irCsll ?? 0) -
    (m.despesasNaoDedutiveis ?? 0) -
    (m.depreciacao ?? 0);
  return Math.abs(m.ebitda + abaixo - m.resultado) <= TOL;
}

const idxComLancamento = (meses: DroMes[]): number[] =>
  meses
    .filter((m) => m.receitaLiquida !== 0)
    .map((m) => mesIdx(m.periodo))
    .filter((i) => i >= 0);

/**
 * Escolhe a fonte do Painel: o DRO IMPORTADO quando todos os meses com lançamento
 * trazem a cascata completa E reconciliada (linhas abaixo do EBITDA fecham o
 * Resultado), senão cai no DRO embutido (Jan–Abr, sempre com a cascata correta).
 * Assim, imports antigos OU planilhas em que a linha abaixo do EBITDA mudou de
 * rótulo (e veio zerada) NÃO substituem o embutido — evita Resultado = EBITDA.
 */
export function montarFonteDro(dro: DroDataset | undefined): FonteDro {
  const com2026 = dro ? dro.meses2026.filter((m) => m.receitaLiquida !== 0) : [];
  const temCascata = !!dro && com2026.length > 0 && com2026.every(cascataReconcilia);

  if (temCascata && dro) {
    const mesesIdx = [...new Set(idxComLancamento(dro.meses2026))].sort((a, b) => a - b);
    const set2025 = new Set(idxComLancamento(dro.meses2025));
    const mesesComuns = mesesIdx.filter((i) => set2025.has(i));
    const idxOk = mesesIdx.length ? mesesIdx : [0, 1, 2, 3];
    return {
      d2026: linhasFromMeses(dro.meses2026),
      d2025: linhasFromMeses(dro.meses2025),
      mesesIdx: idxOk,
      mesesComuns: mesesComuns.length ? mesesComuns : idxOk,
      importado: true,
    };
  }

  const base = Array.from({ length: DRO_MESES_PREENCHIDOS }, (_, i) => i);
  return { d2026: dro2026, d2025: dro2025, mesesIdx: base, mesesComuns: base, importado: false };
}
