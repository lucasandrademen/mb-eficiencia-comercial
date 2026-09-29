import * as pdfjsLib from "pdfjs-dist";
import type { EncargosFolha, VerbaFolha } from "./types";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

export type { VerbaFolha };

export interface ParsedEmployee {
  codigo: string;
  nome: string;
  cargo: string;
  departamento: string;
  centroCusto: string;
  tipo: string; // EMPREGADO | APRENDIZ | SÓCIO ...
  bruto: number;
  descontos: number;
  liquido: number;
  verbas: VerbaFolha[];
  encargos: EncargosFolha;
  admissao?: string; // "YYYY-MM-DD"
  demissao?: string; // "YYYY-MM-DD" (só quando desligado)
}

/** "02/07/2021" → "2021-07-02" */
function dataBR(s: string): string | undefined {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : undefined;
}

// Encargos patronais lidos da coluna "Bases" (custo da empresa). Casados pela
// descrição normalizada — só os valores patronais (não as bases de cálculo).
const ENCARGO_MAP: Record<string, keyof EncargosFolha> = {
  "VALOR FGTS": "fgts",
  "GPS - EMPRESA": "inssEmpresa",
  "GPS - TERCEIROS": "terceiros",
  "GPS - RAT": "rat",
};
const normBase = (s: string) =>
  s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();

/** Converte "1.234,56" → 1234.56 */
function parseBRL(s: string): number {
  return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
}

/** Normaliza string para comparação: maiúsculas, sem acentos, espaços simples */
export function normalizeStr(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NUM_RE = /^\d{1,3}(\.\d{3})*,\d{2}$/;
const isNum = (t: string) => NUM_RE.test(t);

// Início de um bloco de pessoa. A folha lista EMPREGADO, APRENDIZ e SÓCIO (e
// possivelmente outros vínculos). Antes só "EMPREGADO:" era detectado, então
// aprendizes eram colados no colaborador anterior.
const PERSON_RE =
  /^(EMPREGADO|APRENDIZ|S[ÓO]CIO|ESTAGI[ÁA]RIO|DIRETOR|AUT[ÔO]NOMO|PR[ÓO][ -]?LABORE|CONTRIBUINTE|PENSIONISTA|AVULSO|TRABALHADOR)\b.*?:\s*(\d{3,})\s*-\s*(.+)$/;

interface Item {
  str: string;
  x: number;
  y: number;
}

/**
 * Extrai uma verba de uma coluna (Vencimentos ou Descontos).
 * Tokens ex.: ["0001","-","Salário","30,00","1.750,00"] → valor = último número.
 */
function parseEntry(tokens: string[], tipo: "vencimento" | "desconto"): VerbaFolha | null {
  const txt = tokens.join(" ");
  const m = txt.match(/^(\d{3,4})\s*-\s*(.+)$/);
  if (!m) return null;
  const nums = tokens.filter(isNum);
  if (!nums.length) return null;
  const valor = parseBRL(nums[nums.length - 1]);
  if (!valor) return null;
  const descricao = m[2]
    .split(/\s+\d{1,3}(?:\.\d{3})*,\d{2}/)[0]
    .replace(/\s+/g, " ")
    .trim();
  return { tipo, codigo: m[1], descricao, valor };
}

/**
 * Lê a "Listagem Analítica da Folha de Pagamento" (sistema Evo) e devolve, por
 * colaborador: dados cadastrais (cargo, departamento, centro de custo), os
 * totais (bruto/descontos/líquido) e a LISTA DE VERBAS (cada vencimento e cada
 * desconto). O layout tem 3 colunas (Vencimentos | Descontos | Bases) separadas
 * por posição X — por isso a leitura é posicional, agrupando itens por linha (Y)
 * e classificando cada verba pela coluna (X).
 *
 * Validado contra as folhas Jan–Mai/2026: as verbas reconciliam 100% com os
 * totais impressos de cada colaborador.
 */
export async function parseFolhaPdf(file: File): Promise<ParsedEmployee[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  // Agrupa todos os itens de texto em linhas (Y), página a página, de cima p/ baixo.
  const lines: Item[][] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: Item[] = content.items
      .map((it: any) => ({
        str: typeof it.str === "string" ? it.str : "",
        x: it.transform?.[4] ?? 0,
        y: it.transform?.[5] ?? 0,
      }))
      .filter((it) => it.str.trim().length > 0);
    const byY = new Map<number, Item[]>();
    for (const it of items) {
      const k = Math.round(it.y / 2);
      if (!byY.has(k)) byY.set(k, []);
      byY.get(k)!.push(it);
    }
    // pdfjs: Y maior = mais alto na página → ordenar desc p/ ler de cima p/ baixo.
    for (const k of [...byY.keys()].sort((a, b) => b - a)) {
      lines.push(byY.get(k)!.sort((a, b) => a.x - b.x));
    }
  }

  const out: ParsedEmployee[] = [];
  let cur: ParsedEmployee | null = null;
  let mode: "verba" | null = null;
  // Limites de coluna por X (derivados do cabeçalho; defaults do layout Evo).
  let descX = 218;
  let baseX = 410;

  for (const ln of lines) {
    const txt = ln
      .map((i) => i.str.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!txt) continue;

    // A "Listagem Sintética" (totais gerais da empresa) vem depois do último
    // colaborador e tem o mesmo layout — paramos antes p/ não somar no último.
    if (txt.includes("Listagem Sintética") || txt.includes("Listagem Sintetica")) break;

    const pm = txt.match(PERSON_RE);
    if (pm) {
      if (cur) out.push(cur);
      const nome = pm[3]
        .split(/\s+Cargo:|\s+\d{4}\s*-/)[0]
        .replace(/\([^)]*\)/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const cm = pm[3].match(/\d{4}\s*-\s*([^\d]+?)(?:\s*Cargo:|\s*$)/);
      const cargo = cm ? cm[1].replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim() : "";
      cur = {
        codigo: pm[2],
        nome,
        cargo,
        departamento: "",
        centroCusto: "",
        tipo: pm[1].toUpperCase(),
        bruto: 0,
        descontos: 0,
        liquido: 0,
        verbas: [],
        encargos: { fgts: 0, inssEmpresa: 0, terceiros: 0, rat: 0 },
      };
      mode = null;
      continue;
    }
    if (!cur) continue;

    // Cabeçalho do colaborador (antes das verbas): departamento e centro de custo.
    if (mode === null) {
      if (!cur.departamento && txt.includes("Departamento:")) {
        const dm = txt.match(/Departamento:\s*\d+\s*-\s*(.+?)(?:\s+C\.\s*Custo:|\s*$)/);
        if (dm) cur.departamento = dm[1].trim();
      }
      if (!cur.centroCusto) {
        const cc = txt.match(/C\.\s*Custo:\s*\d+\s*-\s*(.+?)\s*$/);
        if (cc) cur.centroCusto = cc[1].trim();
        else {
          const st = txt.match(/^\d{6}\s*-\s*([A-ZÀ-Ú].+?)\s*$/);
          if (st) cur.centroCusto = st[1].trim();
        }
      }
      if (txt.includes("Admiss")) {
        const am = txt.match(/Admiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/);
        if (am && !cur.admissao) cur.admissao = dataBR(am[1]);
        const dm = txt.match(/Demiss[ãa]o:\s*(\d{2}\/\d{2}\/\d{4})/);
        if (dm && !cur.demissao) cur.demissao = dataBR(dm[1]);
      }
    }

    // Cabeçalho das verbas → define limites das colunas e entra em modo verba.
    if (txt.startsWith("Vencimentos") && txt.includes("Descontos")) {
      const d = ln.find((i) => i.str.trim() === "Descontos");
      const b = ln.find((i) => i.str.trim() === "Bases");
      if (d) descX = d.x - 4;
      if (b) baseX = b.x - 4;
      mode = "verba";
      continue;
    }

    // Totais → fecha o colaborador (evita vazamento de linhas seguintes).
    if (txt.startsWith("Total Vencimentos")) {
      const nums = [...txt.matchAll(/\(?(\d{1,3}(?:\.\d{3})*,\d{2})\)?/g)].map((m) => m[1]);
      if (nums.length >= 3) {
        cur.bruto = parseBRL(nums[0]);
        cur.descontos = parseBRL(nums[1]);
        cur.liquido = parseBRL(nums[2]);
      }
      out.push(cur);
      cur = null;
      mode = null;
      continue;
    }

    if (mode === "verba") {
      const vTokens = ln.filter((i) => i.x < descX).map((i) => i.str.trim()).filter(Boolean);
      const dTokens = ln
        .filter((i) => i.x >= descX && i.x < baseX)
        .map((i) => i.str.trim())
        .filter(Boolean);
      const v = parseEntry(vTokens, "vencimento");
      if (v) cur.verbas.push(v);
      const d = parseEntry(dTokens, "desconto");
      if (d) cur.verbas.push(d);
      // Coluna "Bases": captura só os encargos patronais (custo da empresa).
      const bTokens = ln.filter((i) => i.x >= baseX).map((i) => i.str.trim()).filter(Boolean);
      const b = parseEntry(bTokens, "vencimento");
      if (b) {
        const k = ENCARGO_MAP[normBase(b.descricao)];
        if (k) cur.encargos[k] += b.valor;
      }
    }
  }
  if (cur) out.push(cur);

  return out;
}
