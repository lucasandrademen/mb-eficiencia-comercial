import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Dataset, EMPTY_DATASET, VendedorConsolidado } from "@/lib/types";
import { loadDataset, saveDataset } from "@/lib/storage";
import { buildConsolidated, computeTimeMetrics, listPeriodos, TimeMetrics } from "@/lib/calculations";

interface DataContextValue {
  dataset: Dataset;
  setDataset: (d: Dataset) => void;
  mergeDataset: (partial: Partial<Dataset>) => void;
  reset: () => void;

  periodos: string[];
  periodoSelecionado: string | "ALL";
  setPeriodoSelecionado: (p: string | "ALL") => void;

  rows: VendedorConsolidado[]; // consolidado conforme período selecionado
  rowsAll: VendedorConsolidado[]; // tudo
  metrics: TimeMetrics;
}

const Ctx = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [dataset, setDatasetState] = useState<Dataset>(EMPTY_DATASET);
  const [periodoSelecionado, setPeriodoSelecionado] = useState<string | "ALL">("ALL");

  useEffect(() => {
    setDatasetState(loadDataset());
  }, []);

  const setDataset = useCallback((d: Dataset) => {
    setDatasetState(d);
    saveDataset(d);
  }, []);

  const mergeDataset = useCallback(
    (partial: Partial<Dataset>) => {
      const next: Dataset = {
        comercial: partial.comercial ?? dataset.comercial,
        custo: partial.custo ?? dataset.custo,
        carteira: partial.carteira ?? dataset.carteira,
        updatedAt: new Date().toISOString(),
      };
      setDatasetState(next);
      saveDataset(next);
    },
    [dataset],
  );

  const reset = useCallback(() => {
    setDatasetState(EMPTY_DATASET);
    saveDataset(EMPTY_DATASET);
  }, []);

  const periodos = useMemo(() => listPeriodos(dataset), [dataset]);

  // ajusta seleção se o período sumir
  useEffect(() => {
    if (periodoSelecionado !== "ALL" && !periodos.includes(periodoSelecionado)) {
      setPeriodoSelecionado(periodos.length ? periodos[periodos.length - 1] : "ALL");
    }
  }, [periodos, periodoSelecionado]);

  const rowsAll = useMemo(() => buildConsolidated(dataset), [dataset]);
  const rows = useMemo(
    () =>
      periodoSelecionado === "ALL"
        ? rowsAll
        : buildConsolidated(dataset, { periodo: periodoSelecionado }),
    [dataset, periodoSelecionado, rowsAll],
  );
  const metrics = useMemo(() => computeTimeMetrics(rows), [rows]);

  const value: DataContextValue = {
    dataset,
    setDataset,
    mergeDataset,
    reset,
    periodos,
    periodoSelecionado,
    setPeriodoSelecionado,
    rows,
    rowsAll,
    metrics,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData fora de DataProvider");
  return ctx;
}
