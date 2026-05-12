import { getSupabase } from "./supabase";
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

/** Chama a Edge Function e retorna o JSON parseado */
export async function callParseEdgeFunction(
  file: File,
  supabaseUrl: string,
  anonKey: string,
): Promise<ParsedPreser> {
  const form = new FormData();
  form.append("pdf", file);

  const res = await fetch(`${supabaseUrl}/functions/v1/preser-parse`, {
    method: "POST",
    headers: { Authorization: `Bearer ${anonKey}` },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as ParsedPreser;
}

/** Salva o extrato e todas as linhas no Supabase (5 tabelas) */
export async function savePreser(parsed: ParsedPreser): Promise<string> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase não configurado");

  // 1) Upsert extrato
  const { data: extratoRows, error: errExtrato } = await sb
    .from("preser_extrato")
    .upsert(parsed.extrato, { onConflict: "periodo" })
    .select("id")
    .single();
  if (errExtrato) throw errExtrato;
  const extratoId = extratoRows.id as string;

  // 2) Limpa dados antigos do período
  await Promise.all([
    sb.from("preser_sku").delete().eq("extrato_id", extratoId),
    sb.from("preser_drops").delete().eq("extrato_id", extratoId),
    sb.from("preser_metas").delete().eq("extrato_id", extratoId),
    sb.from("preser_outros").delete().eq("extrato_id", extratoId),
  ]);

  // 3) Insere novos dados
  const withId = <T>(rows: T[]) => rows.map((r) => ({ ...r, extrato_id: extratoId }));

  const [r1, r2, r3, r4] = await Promise.all([
    sb.from("preser_sku").insert(withId(parsed.skus)),
    sb.from("preser_drops").insert(withId(parsed.drops)),
    sb.from("preser_metas").insert(withId(parsed.metas)),
    sb.from("preser_outros").insert(withId(parsed.outros)),
  ]);

  for (const r of [r1, r2, r3, r4]) {
    if (r.error) throw r.error;
  }

  return extratoId;
}
