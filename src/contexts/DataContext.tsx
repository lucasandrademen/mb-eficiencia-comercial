import { Loader2 } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Dataset, EMPTY_DATASET, VendedorConsolidado } from "@/lib/types";
import { loadDataset, saveDataset } from "@/lib/storage";
import { buildConsolidated, computeTimeMetrics, listPeriodos, TimeMetrics } from "@/lib/calculations";

interface DataContextValue {
  /** Dados do ANO selecionado (vendedores, carteira e folha filtrados; DRO inteiro). */
  dataset: Dataset;
  /** Todos os anos — use para comparações entre anos e para importar (não perder outro ano). */
  datasetCompleto: Dataset;
  anos: string[];
  ano: string;
  setAno: (a: string) => void;
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
  const [pronto, setPronto] = useState(false);
  const [anoEscolhido, setAnoEscolhido] = useState<string | null>(null);

  // Anos com vendedores ou folha; padrão = o mais recente.
  const anos = useMemo(() => [...new Set(listPeriodos(dataset).map((p) => p.slice(0, 4)))].sort(), [dataset]);
  const ano = anoEscolhido && anos.includes(anoEscolhido) ? anoEscolhido : anos[anos.length - 1] ?? String(new Date().getFullYear());
  const setAno = useCallback((a: string) => {
    setAnoEscolhido(a);
    setPeriodosSelecionadosState([]);
  }, []);
  // Tudo que as telas veem é do ano selecionado — "Ano todo" nunca soma dois anos.
  const datasetAno = useMemo<Dataset>(
    () => ({
      ...dataset,
      vendedor: dataset.vendedor.filter((r) => r.periodo.startsWith(ano)),
      carteira: dataset.carteira.filter((r) => r.periodo.startsWith(ano)),
      folha: (dataset.folha ?? []).filter((r) => r.periodo.startsWith(ano)),
    }),
    [dataset, ano],
  );

  useEffect(() => {
    loadDataset().then((d) => {
      setDatasetState(d);
      setPronto(true);
    });
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
        dro: partial.dro ?? dataset.dro,
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

  const periodos = useMemo(() => listPeriodos(datasetAno), [datasetAno]);

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

  const rowsAll = useMemo(() => buildConsolidated(datasetAno), [datasetAno]);
  const rows = useMemo(
    () =>
      periodosSelecionados.length === 0
        ? rowsAll
        : buildConsolidated(datasetAno, { periodos: periodosSelecionados }),
    [datasetAno, periodosSelecionados, rowsAll],
  );
  const metrics = useMemo(() => computeTimeMetrics(rows), [rows]);

  const value: DataContextValue = {
    dataset: datasetAno,
    datasetCompleto: dataset,
    anos,
    ano,
    setAno,
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

  // só renderiza depois de ler o banco local (evita tela vazia e sobrescrever dados)
  if (!pronto)
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando dados deste computador…
      </div>
    );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData fora de DataProvider");
  return ctx;
}
