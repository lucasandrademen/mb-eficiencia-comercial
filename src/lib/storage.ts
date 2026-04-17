import { Dataset, EMPTY_DATASET } from "./types";

const KEY = "mb-eficiencia-comercial:dataset:v1";

export function loadDataset(): Dataset {
  if (typeof window === "undefined") return EMPTY_DATASET;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_DATASET;
    const parsed = JSON.parse(raw) as Dataset;
    return {
      comercial: parsed.comercial ?? [],
      custo: parsed.custo ?? [],
      carteira: parsed.carteira ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return EMPTY_DATASET;
  }
}

export function saveDataset(d: Dataset) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify({ ...d, updatedAt: new Date().toISOString() }));
}

export function clearDataset() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}
