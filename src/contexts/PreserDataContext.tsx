import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  getExtratoPorId,
  getSerieTemporalBroker,
  listExtratos,
} from "@/lib/preser/api";
import type {
  PreserExtrato,
  PreserExtratoCompleto,
  PreserMeta,
} from "@/lib/preser/types";

interface PreserDataContextValue {
  loading: boolean;
  extratos: PreserExtrato[];
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  atual: PreserExtratoCompleto | null;
  serie: { periodo: string; comissao: number; faturamento_ac: number; pct: number }[];
  reload: () => Promise<void>;
}

const PreserDataContext = createContext<PreserDataContextValue | null>(null);

/** Filtra qualquer dado relacionado a Purina (broker não opera) */
export function isPurina(m: { bu?: string | null; criterio_nome?: string | null }): boolean {
  if (m.bu && /purina/i.test(m.bu)) return true;
  if (m.criterio_nome && /purina/i.test(m.criterio_nome)) return true;
  return false;
}

export function filterPurinaMetas(metas: PreserMeta[]): PreserMeta[] {
  return metas.filter((m) => !isPurina(m));
}

export function PreserDataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [extratos, setExtratos] = useState<PreserExtrato[]>([]);
  const [selectedId, setSelectedIdRaw] = useState<string | null>(null);
  const [atual, setAtual] = useState<PreserExtratoCompleto | null>(null);
  const [serie, setSerie] = useState<PreserDataContextValue["serie"]>([]);

  const loadList = useCallback(async () => {
    const [list, s] = await Promise.all([listExtratos(), getSerieTemporalBroker()]);
    setExtratos(list);
    setSerie(s);
    return list;
  }, []);

  const setSelectedId = useCallback(async (id: string) => {
    setSelectedIdRaw(id);
    setLoading(true);
    const data = await getExtratoPorId(id);
    if (data) {
      // filtra Purina em todas as listas
      setAtual({
        extrato: data.extrato,
        skus: data.skus,
        drops: data.drops,
        metas: filterPurinaMetas(data.metas),
        outros: data.outros.filter((o) => !isPurina(o)),
      });
    } else {
      setAtual(null);
    }
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await loadList();
    if (list.length > 0) {
      await setSelectedId(selectedId ?? list[0].id);
    } else {
      setAtual(null);
      setSelectedIdRaw(null);
    }
    setLoading(false);
  }, [loadList, setSelectedId, selectedId]);

  useEffect(() => {
    (async () => {
      const list = await loadList();
      if (list.length > 0) {
        await setSelectedId(list[0].id); // mais recente
      } else {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<PreserDataContextValue>(
    () => ({ loading, extratos, selectedId, setSelectedId, atual, serie, reload }),
    [loading, extratos, selectedId, setSelectedId, atual, serie, reload],
  );

  return <PreserDataContext.Provider value={value}>{children}</PreserDataContext.Provider>;
}

export function usePreserData(): PreserDataContextValue {
  const ctx = useContext(PreserDataContext);
  if (!ctx)
    throw new Error("usePreserData precisa estar dentro de <PreserDataProvider>");
  return ctx;
}
