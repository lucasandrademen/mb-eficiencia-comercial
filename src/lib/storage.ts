import { Dataset, EMPTY_DATASET } from "./types";
import { kvGet, kvSet } from "./localDb";

const KEY = "mb-eficiencia-comercial:dataset:v3";

function normalizar(parsed: Partial<Dataset> | undefined): Dataset {
  if (!parsed) return EMPTY_DATASET;
  return {
    vendedor: parsed.vendedor ?? [],
    carteira: parsed.carteira ?? [],
    folha: parsed.folha ?? [],
    dro: parsed.dro,
    updatedAt: parsed.updatedAt ?? new Date().toISOString(),
  };
}

/**
 * Lê o dataset do banco local (IndexedDB). Na primeira vez, migra o que
 * estava no localStorage (limite ~5MB) e libera esse espaço.
 */
export async function loadDataset(): Promise<Dataset> {
  if (typeof window === "undefined") return EMPTY_DATASET;
  try {
    const salvo = await kvGet<Dataset>(KEY);
    if (salvo) return normalizar(salvo);

    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_DATASET;
    const antigo = normalizar(JSON.parse(raw) as Dataset);
    await kvSet(KEY, antigo);
    localStorage.removeItem(KEY);
    return antigo;
  } catch (err) {
    console.error("Erro ao ler dataset do banco local", err);
    return EMPTY_DATASET;
  }
}

export async function saveDataset(d: Dataset): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    await kvSet(KEY, { ...d, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error("Erro ao salvar dataset no banco local", err);
  }
}
