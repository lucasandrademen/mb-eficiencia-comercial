/**
 * Segmentos da equipe comercial. Cada vendedor é comparado (medianas, quadrantes)
 * só com quem está no mesmo segmento — KA fatura 5–10× mais que o varejo e o
 * NPRO vende outro portfólio.
 */
export type Segmento = "KA" | "Varejo" | "NPRO";

/** Setores de Key Account (definidos pela gestão comercial). */
export const SETORES_KA = new Set(["101", "207", "601", "117"]);

export function segmentoDoSetor(setor: string): Segmento {
  const s = String(setor).trim();
  if (SETORES_KA.has(s)) return "KA";
  if (/^5\d\d$/.test(s)) return "NPRO"; // equipe NPRO (Matheus, setores 5xx)
  return "Varejo";
}
