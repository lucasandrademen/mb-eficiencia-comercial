import * as XLSX from "xlsx";
import { BaseCarteira, BaseVendedor } from "./types";

// ─── helpers ────────────────────────────────────────────────────────────────

const norm = (s: string) =>
  s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();

function pick(row: Record<string, any>, ...candidates: string[]): any {
  const map: Record<string, any> = {};
  for (const k of Object.keys(row)) map[norm(k)] = row[k];
  for (const c of candidates) {
    const v = map[norm(c)];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

const toNum = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  const s = String(v).trim().replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

const toStr = (v: any): string => (v == null ? "" : String(v).trim());

export function normalizePeriodo(v: any): string {
  if (v == null || v === "") return "";
  if (typeof v === "number" && v > 10000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}`;
  }
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const m1 = s.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (m1) return `${m1[1]}-${m1[2]}`;
  const m2 = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[2]}-${m2[1].padStart(2, "0")}`;
  const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[2].padStart(2, "0")}`;
  const meses: Record<string, string> = {
    janeiro: "01", fevereiro: "02", marco: "03", março: "03", abril: "04",
    maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09",
    outubro: "10", novembro: "11", dezembro: "12",
    jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
    jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
  };
  const m4 = s.toLowerCase().match(/([a-zç]+)[\/\s\-]+(\d{4})/);
  if (m4 && meses[m4[1]]) return `${m4[2]}-${meses[m4[1]]}`;
  return s;
}

// ─── parse XLSX/CSV ─────────────────────────────────────────────────────────

export async function readSheetRows(file: File): Promise<Record<string, any>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
}

// ─── mappers ────────────────────────────────────────────────────────────────

/**
 * Base Vendedor: 1 linha por vendedor. Se `defaultPeriodo` for informado, é
 * usado quando a coluna `periodo` estiver vazia (upload mensal).
 */
export function mapBaseVendedor(
  rows: Record<string, any>[],
  defaultPeriodo?: string,
): BaseVendedor[] {
  return rows
    .map((r) => {
      const periodoRaw = pick(r, "periodo", "período", "mes", "mês", "competencia", "competência", "data");
      const periodo = periodoRaw ? normalizePeriodo(periodoRaw) : (defaultPeriodo ?? "");
      const vendedor_id = toStr(pick(r, "vendedor_id", "id_vendedor", "codigo_vendedor", "código_vendedor", "cod_vendedor"));
      const vendedor_nome = toStr(pick(r, "vendedor_nome", "vendedor", "nome_vendedor", "nome"));
      if (!periodo || !vendedor_id) return null;
      return {
        periodo,
        vendedor_id,
        vendedor_nome,
        supervisor: toStr(pick(r, "supervisor", "gestor", "lider", "líder")),
        faturamento: toNum(pick(r, "faturamento", "faturamento_realizado", "venda", "vendas", "valor")),
        custo: toNum(pick(r, "custo", "custo_total", "total_custo", "custo_geral")),
      } as BaseVendedor;
    })
    .filter(Boolean) as BaseVendedor[];
}

export function mapBaseCarteira(
  rows: Record<string, any>[],
  defaultPeriodo?: string,
): BaseCarteira[] {
  return rows
    .map((r) => {
      const periodoRaw = pick(r, "periodo", "período", "mes", "mês", "competencia", "competência", "data");
      const periodo = periodoRaw ? normalizePeriodo(periodoRaw) : (defaultPeriodo ?? "");
      const vendedor_id = toStr(pick(r, "vendedor_id", "id_vendedor", "codigo_vendedor", "código_vendedor"));
      const cliente_id = toStr(pick(r, "cliente_id", "id_cliente", "codigo_cliente", "código_cliente", "cnpj", "cpf_cnpj"));
      if (!periodo || !vendedor_id || !cliente_id) return null;
      return {
        periodo,
        vendedor_id,
        cliente_id,
        cliente_nome: toStr(pick(r, "cliente_nome", "cliente", "razao_social", "razão_social")),
        cidade: toStr(pick(r, "cidade", "municipio", "município")),
        faturamento_cliente: toNum(pick(r, "faturamento_cliente", "faturamento", "valor", "venda", "fat_mes", "faturamento_mes")),
      } as BaseCarteira;
    })
    .filter(Boolean) as BaseCarteira[];
}

// ─── template downloads ────────────────────────────────────────────────────

export function downloadTemplate(kind: "vendedor" | "carteira") {
  let headers: string[] = [];
  let example: any[] = [];
  if (kind === "vendedor") {
    headers = ["periodo", "vendedor_id", "vendedor_nome", "supervisor", "faturamento", "custo"];
    example = [
      ["2026-01", "V001", "João Silva", "Carlos Lima", 850000, 95000],
      ["2026-01", "V002", "Maria Souza", "Carlos Lima", 620000, 78000],
    ];
  } else {
    headers = ["periodo", "vendedor_id", "cliente_id", "cliente_nome", "cidade", "faturamento_cliente"];
    example = [
      ["2026-01", "V001", "C100", "Padaria do João", "Caxias do Sul", 12500],
      ["2026-01", "V001", "C101", "Mercado Central", "Bento Gonçalves", 8300],
      ["2026-01", "V001", "C102", "Restaurante Bella", "Caxias do Sul", 0],
    ];
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, `modelo_${kind}.xlsx`);
}
