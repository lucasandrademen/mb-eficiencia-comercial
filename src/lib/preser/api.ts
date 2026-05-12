import { getSupabase } from "./supabase";
import type {
  PreserExtrato,
  PreserSku,
  PreserDrops,
  PreserMeta,
  PreserOutro,
  PreserExtratoCompleto,
} from "./types";

export async function listExtratos(): Promise<PreserExtrato[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("preser_extrato")
    .select("*")
    .order("periodo", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PreserExtrato[];
}

export async function getExtratoPorId(id: string): Promise<PreserExtratoCompleto | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: extrato, error } = await sb
    .from("preser_extrato")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !extrato) return null;

  const [skus, drops, metas, outros] = await Promise.all([
    sb.from("preser_sku").select("*").eq("extrato_id", id),
    sb.from("preser_drops").select("*").eq("extrato_id", id),
    sb.from("preser_metas").select("*").eq("extrato_id", id),
    sb.from("preser_outros").select("*").eq("extrato_id", id),
  ]);

  return {
    extrato: extrato as PreserExtrato,
    skus: (skus.data ?? []) as PreserSku[],
    drops: (drops.data ?? []) as PreserDrops[],
    metas: (metas.data ?? []) as PreserMeta[],
    outros: (outros.data ?? []) as PreserOutro[],
  };
}

export async function getExtratoMaisRecente(): Promise<PreserExtratoCompleto | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("preser_extrato")
    .select("id")
    .order("periodo", { ascending: false })
    .limit(1);
  const id = (data ?? [])[0]?.id as string | undefined;
  if (!id) return null;
  return getExtratoPorId(id);
}

/** Série temporal agregada: uma linha por extrato */
export async function getSerieTemporalBroker(): Promise<
  { periodo: string; comissao: number; faturamento_ac: number; pct: number }[]
> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from("preser_extrato")
    .select("periodo, valor_total_comissao, faturamento_ac, pct_remuneracao_sobre_fat")
    .order("periodo", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: Record<string, unknown>) => ({
    periodo: (r.periodo as string).slice(0, 7),
    comissao: (r.valor_total_comissao as number) ?? 0,
    faturamento_ac: (r.faturamento_ac as number) ?? 0,
    pct: (r.pct_remuneracao_sobre_fat as number) ?? 0,
  }));
}

/** Para o bar chart de atingimento por BU no mês atual */
export async function getMetasDoMesRecente(): Promise<PreserMeta[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data: extratos } = await sb
    .from("preser_extrato")
    .select("id")
    .order("periodo", { ascending: false })
    .limit(1);
  const id = (extratos ?? [])[0]?.id as string | undefined;
  if (!id) return [];
  const { data } = await sb
    .from("preser_metas")
    .select("*")
    .eq("extrato_id", id)
    .in("tipo", ["VBC", "Cobertura"]);
  return (data ?? []) as PreserMeta[];
}
