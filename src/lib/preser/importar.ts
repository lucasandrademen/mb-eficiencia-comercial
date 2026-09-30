import { preserAll, preserPut } from "@/lib/localDb";
import { invalidatePreserCache } from "./api";
import type {
  PreserExtrato,
  PreserSku,
  PreserDrops,
  PreserMeta,
  PreserOutro,
} from "./types";

export interface ParsedPreser {
  extrato: Omit<PreserExtrato, "id" | "pct_remuneracao_sobre_fat" | "created_at">;
  skus: Omit<PreserSku, "id" | "extrato_id">[];
  drops: Omit<PreserDrops, "id" | "extrato_id">[];
  metas: Omit<PreserMeta, "id" | "extrato_id" | "pct_realizacao">[];
  outros: Omit<PreserOutro, "id" | "extrato_id">[];
}

const novoId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const div = (a: number | null | undefined, b: number | null | undefined) =>
  a != null && b ? a / b : null;

/** Salva o extrato no banco local. Reimportar o mesmo mês substitui o anterior. */
export async function savePreser(parsed: ParsedPreser): Promise<string> {
  const existente = (await preserAll()).find((e) => e.extrato.periodo === parsed.extrato.periodo);
  const id = existente?.extrato.id ?? novoId();
  const comId = <T>(rows: T[]) => rows.map((r) => ({ ...r, id: novoId(), extrato_id: id }));

  await preserPut({
    extrato: {
      ...parsed.extrato,
      id,
      // antes eram colunas calculadas no Postgres
      pct_remuneracao_sobre_fat: div(parsed.extrato.valor_total_comissao, parsed.extrato.faturamento_ac),
      created_at: existente?.extrato.created_at ?? new Date().toISOString(),
    },
    skus: comId(parsed.skus),
    drops: comId(parsed.drops),
    metas: comId(parsed.metas).map((m) => ({
      ...m,
      pct_realizacao: div(m.efetivo_fiscal, m.objetivo_meta),
    })),
    outros: comId(parsed.outros),
  });
  invalidatePreserCache();
  return id;
}
