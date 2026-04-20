import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Dataset, EMPTY_DATASET, VendedorConsolidado } from "@/lib/types";
import { loadDataset, saveDataset } from "@/lib/storage";
import { buildConsolidated, computeTimeMetrics, listPeriodos, TimeMetrics } from "@/lib/calculations";

interface DataContextValue {
  dataset: Dataset;
  setDataset: (d: Dataset) => void;
  mergeDataset: (partial: Partial<Dataset>) => void;
  reset: () => void;

  periodos: string[]; // todos disponíveis (ordenados)
  periodosSelecionados: string[]; // [] = todos
  setPeriodosSelecionados: (p: string[]) => void;
  togglePeriodo: (p: string) => void;
  selectAll: () => void;
  selectTrimestre: (q: "Q1" | "Q2" | "Q3" | "Q4") => void;

  rows: VendedorConsolidado[]; // consolidado dos períodos selecionados
  rowsAll: VendedorConsolidado[]; // tudo
  metrics: TimeMetrics;
}

const Ctx = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [dataset, setDatasetState] = useState<Dataset>(EMPTY_DATASET);
  const [periodosSelecionados, setPeriodosSelecionadosState] = useState<string[]>([]);

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
        vendedor: partial.vendedor ?? dataset.vendedor,
        carteira: partial.carteira ?? dataset.carteira,
        folha: partial.folha ?? dataset.folha,
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
    setPeriodosSelecionadosState([]);
  }, []);

  const periodos = useMemo(() => listPeriodos(dataset), [dataset]);

  // limpa seleções inválidas
  useEffect(() => {
    setPeriodosSelecionadosState((sel) => sel.filter((p) => periodos.includes(p)));
  }, [periodos]);

  const setPeriodosSelecionados = useCallback((p: string[]) => {
    setPeriodosSelecionadosState(p);
  }, []);

  const togglePeriodo = useCallback((p: string) => {
    setPeriodosSelecionadosState((sel) =>
      sel.includes(p) ? sel.filter((x) => x !== p) : [...sel, p],
    );
  }, []);

  const selectAll = useCallback(() => setPeriodosSelecionadosState([]), []);

  const selectTrimestre = useCallback(
    (q: "Q1" | "Q2" | "Q3" | "Q4") => {
      const range: Record<string, [number, number]> = {
        Q1: [1, 3], Q2: [4, 6], Q3: [7, 9], Q4: [10, 12],
      };
      const [lo, hi] = range[q];
      const sel = periodos.filter((p) => {
        const m = parseInt(p.split("-")[1], 10);
        return m >= lo && m <= hi;
      });
      setPeriodosSelecionadosState(sel);
    },
    [periodos],
  );

  const rowsAll = useMemo(() => buildConsolidated(dataset), [dataset]);
  const rows = useMemo(
    () =>
      periodosSelecionados.length === 0
        ? rowsAll
        : buildConsolidated(dataset, { periodos: periodosSelecionados }),
    [dataset, periodosSelecionados, rowsAll],
  );
  const metrics = useMemo(() => computeTimeMetrics(rows), [rows]);

  const value: DataContextValue = {
    dataset,
    setDataset,
    mergeDataset,
    reset,
    periodos,
    periodosSelecionados,
    setPeriodosSelecionados,
    togglePeriodo,
    selectAll,
    selectTrimestre,
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
