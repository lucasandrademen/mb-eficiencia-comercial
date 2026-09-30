import * as XLSX from "xlsx";
import { DroDataset, DroMes } from "./types";

const norm = (s: unknown) =>
  String(s ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Lê o DRO da MB Logística (Excel "DRO MB Logistica ..xlsx", aba "MB Logistica").
 * Layout: meses em blocos de 6 colunas a partir de B; cabeçalho (linha ~6) marca
 * o ano (2025 / 2026) de cada coluna. As linhas são encontradas pelo rótulo na
 * coluna A (robusto a pequenas mudanças de layout).
 *
 * Devolve a Receita Líquida (e demais linhas) por mês — "quanto de fato entrou
 * no caixa da MB".
 */
export async function parseDroExcel(file: File): Promise<DroDataset> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  // Aba da MB Logística (ignora GRUPO MB, ACUMULADOS, Participações, Broker...).
  const sheetName =
    wb.SheetNames.find((n) => {
      const nn = norm(n);
      return nn.includes("LOGISTICA") && !nn.includes("GRUPO");
    }) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true });

  // Colunas de cada ano: onde o cabeçalho tem 2026 / 2025 (em ordem = Jan..Dez).
  let headerRow = aoa.findIndex((r) => Array.isArray(r) && r.some((c) => c === 2026 || c === 2025));
  if (headerRow < 0) headerRow = 5;
  const header = (aoa[headerRow] ?? []) as unknown[];
  const cols2026: number[] = [];
  const cols2025: number[] = [];
  for (let c = 0; c < header.length; c++) {
    if (header[c] === 2026) cols2026.push(c);
    if (header[c] === 2025) cols2025.push(c);
  }

  // Linhas pelas etiquetas da coluna A.
  const findRow = (...pats: string[]) => {
    for (let r = 0; r < aoa.length; r++) {
      const a = norm((aoa[r] as unknown[])?.[0]);
      if (a && pats.some((p) => a === p || a.startsWith(p))) return r;
    }
    return -1;
  };
  const R = {
    receitaBruta: findRow("RECEITA PRESTACAO DE SERVICOS", "RECEITA OPERACIONAL BRUTA"),
    deducoes: findRow("ENCARGOS SOBRE VENDAS", "DEDUCOES"),
    receitaLiquida: findRow("RECEITA LIQUIDA"),
    custoServicos: findRow("CUSTO DOS SERVICOS"),
    despTributarias: findRow("DESPESAS TRIBUTARIAS"),
    despOperacionais: findRow("DESPESAS OPERACIONAIS"),
    ebitda: findRow("EBITDA"),
    // Abaixo do EBITDA (fecham a cascata até o Resultado).
    receitasFinanceiras: findRow("RECEITA FINANCEIRAS", "RECEITAS FINANCEIRAS"),
    receitasNaoOperacionais: findRow("RECEITAS NAO OPERACIONAIS"),
    despesasFinanceiras: findRow("DESPESAS FINANCEIRAS"),
    irCsll: findRow("IR E CSLL", "IR CSLL"),
    despesasNaoDedutiveis: findRow("DESPESAS NAO DEDUTIVEIS"),
    depreciacao: findRow("DEPRECIACOES E AMORTIZACOES", "DEPRECIAC"),
    resultado: findRow("RESULTADO DO EXERCICIO", "RESULTADO DO EXERC"),
  };

  const num = (r: number, c: number): number => {
    if (r < 0) return 0;
    const v = (aoa[r] as unknown[])?.[c];
    return typeof v === "number" && !isNaN(v) ? v : 0;
  };

  const build = (cols: number[], ano: number): DroMes[] => {
    const out: DroMes[] = [];
    for (let i = 0; i < cols.length && i < 12; i++) {
      const c = cols[i];
      const m: DroMes = {
        periodo: `${ano}-${String(i + 1).padStart(2, "0")}`,
        receitaBruta: num(R.receitaBruta, c),
        deducoes: num(R.deducoes, c),
        receitaLiquida: num(R.receitaLiquida, c),
        custoServicos: num(R.custoServicos, c),
        despTributarias: num(R.despTributarias, c),
        despOperacionais: num(R.despOperacionais, c),
        ebitda: num(R.ebitda, c),
        receitasFinanceiras: num(R.receitasFinanceiras, c),
        receitasNaoOperacionais: num(R.receitasNaoOperacionais, c),
        despesasFinanceiras: num(R.despesasFinanceiras, c),
        irCsll: num(R.irCsll, c),
        despesasNaoDedutiveis: num(R.despesasNaoDedutiveis, c),
        depreciacao: num(R.depreciacao, c),
        resultado: num(R.resultado, c),
      };
      if (m.receitaLiquida !== 0) out.push(m);
    }
    return out;
  };

  return {
    empresa: sheetName.trim(),
    meses2026: build(cols2026, 2026),
    meses2025: build(cols2025, 2025),
    atualizadoEm: new Date().toISOString(),
  };
}
