/**
 * PRESER — leitura/escrita no banco LOCAL (IndexedDB, ver src/lib/localDb.ts).
 * Mantém as mesmas assinaturas da antiga versão Supabase.
 */
import { preserAll, preserDelete } from "@/lib/localDb";
import type { PreserExtrato, PreserExtratoCompleto, PreserMeta } from "./types";

/** Cache em memória: o IndexedDB é lido uma vez por carregamento de página. */
let cache: Promise<PreserExtratoCompleto[]> | null = null;

export function invalidatePreserCache() {
  cache = null;
}

async function todos(): Promise<PreserExtratoCompleto[]> {
  if (!cache) {
    cache = preserAll().catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}

const porPeriodoDesc = (a: PreserExtratoCompleto, b: PreserExtratoCompleto) =>
  a.extrato.periodo < b.extrato.periodo ? 1 : a.extrato.periodo > b.extrato.periodo ? -1 : 0;

/** Todos os extratos completos, do mais antigo para o mais recente. */
export async function listExtratosCompletos(): Promise<PreserExtratoCompleto[]> {
  return (await todos()).slice().sort(porPeriodoDesc).reverse();
}

export async function listExtratos(): Promise<PreserExtrato[]> {
  return (await todos()).slice().sort(porPeriodoDesc).map((e) => e.extrato);
}

/** Apaga um extrato (mês) e todas as suas linhas */
export async function deletePreserExtrato(id: string): Promise<void> {
  await preserDelete(id);
  invalidatePreserCache();
}

export async function getExtratoPorId(id: string): Promise<PreserExtratoCompleto | null> {
  return (await todos()).find((e) => e.extrato.id === id) ?? null;
}

export async function getExtratoMaisRecente(): Promise<PreserExtratoCompleto | null> {
  return (await todos()).slice().sort(porPeriodoDesc)[0] ?? null;
}

/** Série temporal agregada: uma linha por extrato */
export async function getSerieTemporalBroker(): Promise<
  { periodo: string; comissao: number; faturamento_ac: number; pct: number }[]
> {
  return (await todos())
    .slice()
    .sort(porPeriodoDesc)
    .reverse()
    .map(({ extrato: r }) => ({
      periodo: r.periodo.slice(0, 7),
      comissao: r.valor_total_comissao ?? 0,
      faturamento_ac: r.faturamento_ac ?? 0,
      pct: r.pct_remuneracao_sobre_fat ?? 0,
    }));
}

/** Para o bar chart de atingimento por BU no mês atual */
export async function getMetasDoMesRecente(): Promise<PreserMeta[]> {
  const e = await getExtratoMaisRecente();
  return (e?.metas ?? []).filter((m) => m.tipo === "VBC" || m.tipo === "Cobertura");
}
