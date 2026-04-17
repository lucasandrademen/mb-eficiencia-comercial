import * as XLSX from "xlsx";
import { BaseCarteira, BaseComercial, BaseCusto } from "./types";

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

function normalizePeriodo(v: any): string {
  if (v == null || v === "") return "";
  // Excel date number
  if (typeof v === "number" && v > 10000) {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}`;
  }
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  // YYYY-MM-DD
  const m1 = s.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (m1) return `${m1[1]}-${m1[2]}`;
  // MM/YYYY
  const m2 = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m2) return `${m2[2]}-${m2[1].padStart(2, "0")}`;
  // DD/MM/YYYY
  const m3 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m3) return `${m3[3]}-${m3[2].padStart(2, "0")}`;
  // mês por nome
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

export function mapBaseComercial(rows: Record<string, any>[]): BaseComercial[] {
  return rows
    .map((r) => {
      const periodo = normalizePeriodo(pick(r, "periodo", "período", "mes", "mês", "competencia", "competência", "data"));
      const vendedor_id = toStr(pick(r, "vendedor_id", "id_vendedor", "codigo_vendedor", "código_vendedor", "cod_vendedor"));
      const vendedor_nome = toStr(pick(r, "vendedor_nome", "vendedor", "nome_vendedor", "nome"));
      if (!periodo || !vendedor_id) return null;
      return {
        periodo,
        vendedor_id,
        vendedor_nome,
        supervisor: toStr(pick(r, "supervisor", "gestor", "lider", "líder")),
        regiao: toStr(pick(r, "regiao", "região", "area", "área")),
        faturamento_realizado: toNum(pick(r, "faturamento_realizado", "faturamento", "venda", "vendas", "valor")),
        clientes_ativos: toNum(pick(r, "clientes_ativos", "qtd_clientes", "clientes")),
        pedidos: toNum(pick(r, "pedidos", "qtd_pedidos", "n_pedidos")),
        ticket_medio: toNum(pick(r, "ticket_medio", "ticket_médio")),
      } as BaseComercial;
    })
    .filter(Boolean) as BaseComercial[];
}

export function mapBaseCusto(rows: Record<string, any>[]): BaseCusto[] {
  return rows
    .map((r) => {
      const periodo = normalizePeriodo(pick(r, "periodo", "período", "mes", "mês", "competencia", "competência", "data"));
      const vendedor_id = toStr(pick(r, "vendedor_id", "id_vendedor", "codigo_vendedor", "código_vendedor"));
      if (!periodo || !vendedor_id) return null;
      return {
        periodo,
        vendedor_id,
        vendedor_nome: toStr(pick(r, "vendedor_nome", "vendedor", "nome_vendedor", "nome")),
        custo_total: toNum(pick(r, "custo_total", "custo", "total_custo", "custo_geral")),
      } as BaseCusto;
    })
    .filter(Boolean) as BaseCusto[];
}

export function mapBaseCarteira(rows: Record<string, any>[]): BaseCarteira[] {
  return rows
    .map((r) => {
      const periodo = normalizePeriodo(pick(r, "periodo", "período", "mes", "mês", "competencia", "competência", "data"));
      const vendedor_id = toStr(pick(r, "vendedor_id", "id_vendedor", "codigo_vendedor", "código_vendedor"));
      const cliente_id = toStr(pick(r, "cliente_id", "id_cliente", "codigo_cliente", "código_cliente", "cnpj", "cpf_cnpj"));
      if (!periodo || !vendedor_id || !cliente_id) return null;
      return {
        periodo,
        vendedor_id,
        vendedor_nome: toStr(pick(r, "vendedor_nome", "vendedor", "nome_vendedor")),
        cliente_id,
        cliente_nome: toStr(pick(r, "cliente_nome", "cliente", "razao_social", "razão_social")),
        municipio: toStr(pick(r, "municipio", "município", "cidade")),
        setor: toStr(pick(r, "setor", "segmento", "categoria")),
        faturamento_cliente_mes: toNum(pick(r, "faturamento_cliente_mes", "faturamento_mes", "venda_mes", "fat_mes")),
        faturamento_cliente_3m: toNum(pick(r, "faturamento_cliente_3m", "faturamento_3m", "venda_3m", "fat_3m")),
        pedidos_cliente_mes: toNum(pick(r, "pedidos_cliente_mes", "pedidos_mes")),
        pedidos_cliente_3m: toNum(pick(r, "pedidos_cliente_3m", "pedidos_3m")),
        status_cliente: toStr(pick(r, "status_cliente", "status", "situacao", "situação")),
      } as BaseCarteira;
    })
    .filter(Boolean) as BaseCarteira[];
}

// ─── template downloads ────────────────────────────────────────────────────

export function downloadTemplate(kind: "comercial" | "custo" | "carteira") {
  let headers: string[] = [];
  let example: any[] = [];
  if (kind === "comercial") {
    headers = ["periodo", "vendedor_id", "vendedor_nome", "supervisor", "regiao", "faturamento_realizado", "clientes_ativos", "pedidos", "ticket_medio"];
    example = [["2026-01", "V001", "João Silva", "Carlos Lima", "Sul", 850000, 42, 320, 2656]];
  } else if (kind === "custo") {
    headers = ["periodo", "vendedor_id", "vendedor_nome", "custo_total"];
    example = [["2026-01", "V001", "João Silva", 95000]];
  } else {
    headers = ["periodo", "vendedor_id", "vendedor_nome", "cliente_id", "cliente_nome", "municipio", "setor", "faturamento_cliente_mes", "faturamento_cliente_3m", "pedidos_cliente_mes", "pedidos_cliente_3m", "status_cliente"];
    example = [["2026-01", "V001", "João Silva", "C100", "Padaria do João", "Caxias do Sul", "Alimentos", 12500, 38000, 4, 11, "Ativo"]];
  }
  const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Modelo");
  XLSX.writeFile(wb, `modelo_${kind}.xlsx`);
}
