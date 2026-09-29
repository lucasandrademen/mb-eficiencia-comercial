/**
 * Banco de dados LOCAL do app (IndexedDB do navegador).
 * Tudo fica salvo só nesta máquina/navegador — nada vai para servidor.
 *
 * Stores:
 *  - kv:     chave → valor (ex.: dataset de vendedor/carteira/folha/DRO)
 *  - preser: um registro por mês importado (PreserExtratoCompleto), chave = extrato.id
 */
import type { PreserExtratoCompleto } from "./preser/types";

const DB_NAME = "mb-eficiencia-comercial";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("preser")) db.createObjectStore("preser");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
    // pede ao navegador para não apagar os dados sozinho quando faltar espaço
    navigator.storage?.persist?.().catch(() => {});
  }
  return dbPromise;
}

type StoreName = "kv" | "preser";

async function run<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    tx.oncomplete = () => resolve(req ? req.result : (undefined as T));
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ─── kv ──────────────────────────────────────────────────────────────────────
export const kvGet = <T>(key: string) => run<T | undefined>("kv", "readonly", (s) => s.get(key));
export const kvSet = (key: string, value: unknown) =>
  run<IDBValidKey>("kv", "readwrite", (s) => s.put(value, key));
export const kvDelete = (key: string) => run<undefined>("kv", "readwrite", (s) => s.delete(key));

// ─── preser ──────────────────────────────────────────────────────────────────
export const preserAll = () =>
  run<PreserExtratoCompleto[]>("preser", "readonly", (s) => s.getAll());
export const preserPut = (e: PreserExtratoCompleto) =>
  run<IDBValidKey>("preser", "readwrite", (s) => s.put(e, e.extrato.id));
export const preserDelete = (id: string) =>
  run<undefined>("preser", "readwrite", (s) => s.delete(id));

// ─── backup (arquivo .json) ─────────────────────────────────────────────────
export interface BackupFile {
  app: "mb-eficiencia-comercial";
  versao: 1;
  geradoEm: string;
  kv: Record<string, unknown>;
  preser: PreserExtratoCompleto[];
}

export async function exportarBackup(): Promise<BackupFile> {
  const db = await openDb();
  const kv = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const out: Record<string, unknown> = {};
    const tx = db.transaction("kv", "readonly");
    const req = tx.objectStore("kv").openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) {
        out[String(c.key)] = c.value;
        c.continue();
      }
    };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
  return {
    app: "mb-eficiencia-comercial",
    versao: 1,
    geradoEm: new Date().toISOString(),
    kv,
    preser: await preserAll(),
  };
}

/**
 * Restaura um backup JUNTANDO com o que já existe (nunca apaga):
 * - PRESER: cada mês do arquivo substitui o mesmo mês no app; meses que não
 *   estão no arquivo continuam.
 * - Demais dados (Folha, DRO, vendedores): só as chaves presentes no arquivo
 *   são gravadas.
 * Retorna quantos meses entraram/foram atualizados.
 */
export async function importarBackup(b: BackupFile): Promise<{ meses: number; kv: number }> {
  if (b?.app !== "mb-eficiencia-comercial" || !Array.isArray(b.preser)) {
    throw new Error("Arquivo não é um backup deste app.");
  }
  const existentes = await preserAll();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(["kv", "preser"], "readwrite");
    const kv = tx.objectStore("kv");
    const pr = tx.objectStore("preser");
    const periodos = new Set(b.preser.map((e) => e.extrato.periodo));
    for (const e of existentes) if (periodos.has(e.extrato.periodo)) pr.delete(e.extrato.id);
    for (const [k, v] of Object.entries(b.kv ?? {})) kv.put(v, k);
    for (const e of b.preser) pr.put(e, e.extrato.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return { meses: b.preser.length, kv: Object.keys(b.kv ?? {}).length };
}
