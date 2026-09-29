import { DroDataset } from "@/lib/types";
import { dro2025, dro2026 } from "./logisticaData";

/**
 * Receita Líquida da MB Logística num mês — "quanto de fato entrou no caixa".
 * Prefere o DRO IMPORTADO pelo usuário; cai no DRO embutido (Jan–Abr) como fallback.
 */
export function receitaLiquidaMes(dro: DroDataset | undefined, periodo: string): number {
  if (dro) {
    const arr = periodo.startsWith("2026")
      ? dro.meses2026
      : periodo.startsWith("2025")
      ? dro.meses2025
      : [];
    const m = arr.find((x) => x.periodo === periodo);
    if (m) return m.receitaLiquida;
  }
  const [ano, mm] = periodo.split("-");
  const i = parseInt(mm, 10) - 1;
  if (i < 0 || i > 11) return 0;
  if (ano === "2026") return dro2026.receitaLiquida[i] || 0;
  if (ano === "2025") return dro2025.receitaLiquida[i] || 0;
  return 0;
}
