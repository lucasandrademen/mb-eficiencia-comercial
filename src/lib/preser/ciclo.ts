/**
 * Ciclo do PRESER.
 *
 * O extrato é identificado pelo MÊS DO PRESER (= mês da "Apuração: YYYY/M" no PDF).
 * Ex.: PRESER de Setembro/2026
 *  - Faturamento (período fiscal): 20/08/2026 a 19/09/2026
 *  - Bônus de metas (VBC, Cobertura, Recomendador): pago pelas metas batidas em Agosto/2026
 */
import { periodoLabel } from "@/lib/format";

const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export interface CicloPreser {
  /** "Setembro/2026" */
  mesPreser: string;
  /** "20/08/2026" */
  fiscalInicio: string;
  /** "19/09/2026" */
  fiscalFim: string;
  /** "Agosto/2026" — mês das metas que geram o bônus */
  mesMetas: string;
  /** "Ago/2026" */
  mesMetasCurto: string;
}

/** Aceita "YYYY-MM" ou "YYYY-MM-DD" (mês do PRESER). */
export function cicloPreser(periodo: string): CicloPreser {
  const ano = parseInt(periodo.slice(0, 4), 10);
  const mes = parseInt(periodo.slice(5, 7), 10);
  const antAno = mes === 1 ? ano - 1 : ano;
  const antMes = mes === 1 ? 12 : mes - 1;
  const mm = (m: number) => String(m).padStart(2, "0");
  const ant = `${antAno}-${mm(antMes)}`;
  return {
    mesPreser: periodoLabel(`${ano}-${mm(mes)}`),
    fiscalInicio: `20/${mm(antMes)}/${antAno}`,
    fiscalFim: `19/${mm(mes)}/${ano}`,
    mesMetas: periodoLabel(ant),
    mesMetasCurto: `${MESES_CURTOS[antMes - 1]}/${antAno}`,
  };
}
