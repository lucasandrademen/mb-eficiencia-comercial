/**
 * Grupos de SKU que a Nestlé renomeou no extrato. Nas comparações entre meses,
 * o nome antigo é somado ao novo para o item não aparecer zerado de um lado.
 */
export const GRUPOS_RENOMEADOS: Record<string, string> = {
  "NESCAFE 40G": "NESCAFE SACHET",
  "MUCILON SACHET ATE 230G": "MUCILON SACHET 180G",
  "BISCOITOS CHOCOBISCUIT": "BISCOITOS COBERTOS",
};

const normalizar = (nome: string) => nome.trim().toUpperCase().replace(/\s+/g, " ");

/** Nome atual do grupo (o próprio nome se não foi renomeado). */
export function grupoCanonico(nome: string): string {
  const n = normalizar(nome);
  return GRUPOS_RENOMEADOS[n] ?? n;
}

/** Nomes antigos que foram somados a este grupo. */
export function nomesAntigos(nomeCanonico: string): string[] {
  return Object.entries(GRUPOS_RENOMEADOS)
    .filter(([, novo]) => novo === nomeCanonico)
    .map(([antigo]) => antigo);
}
