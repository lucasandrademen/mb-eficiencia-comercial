import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

export interface ParsedEmployee {
  codigo: string;
  nome: string;
  cargo: string;
  departamento: string;
  bruto: number;
  descontos: number;
  liquido: number;
}

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

/**
 * Extrai funcionários do texto gerado pelo pdfjs.
 *
 * O pdfjs gera texto numa ordem diferente do pdfplumber.
 * Formato observado para cada bloco de funcionário:
 *
 *   EMPREGADO: 000908 - ADEMILSON DOS ANJOS  Departamento: Cargo: Admissão:
 *   000008 - VENDAS EXTERNAS 0041 - VENDEDOR (A) 02/07/2021 ...
 *   ... linhas de vencimentos/descontos/bases ...
 *   7.175,88   (6.432,20)   743,68 Total Vencimentos   Total Descontos   Salário Líquido
 *
 * Os VALORES dos totais vêm ANTES dos rótulos.
 */
function parseEmployees(text: string): ParsedEmployee[] {
  const employees: ParsedEmployee[] = [];

  // Divide o texto por bloco de empregado
  const blocks = text.split(/EMPREGADO:\s*/);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // ── Código e Nome ──
    // "000908 - ADEMILSON DOS ANJOS  Departamento:"
    const empMatch = block.match(/^(\d+)\s*-\s*(.+?)\s+Departamento:/s);
    if (!empMatch) continue;

    const codigo = empMatch[1].trim();
    const nome = empMatch[2].trim();

    // ── Departamento e Cargo ──
    // pdfjs: "Departamento: Cargo: Admissão: 000008 - VENDAS EXTERNAS 0041 - VENDEDOR (A) 02/07/2021"
    // ou     "Departamento: Cargo: Admissão: 000008 - VENDAS EXTERNAS 0041 - VENDEDOR (A) 02/07/2021"
    let departamento = "";
    let cargo = "";

    const deptCargoMatch = block.match(
      /Departamento:\s*Cargo:\s*Admiss.o:\s*\d+\s*-\s*(.+?)\s+(\d{4})\s*-\s*(.+?)\s+\d{2}\/\d{2}\/\d{4}/s
    );
    if (deptCargoMatch) {
      departamento = deptCargoMatch[1].trim();
      cargo = deptCargoMatch[3].trim();
    } else {
      // Fallback: tenta pegar só departamento
      const deptOnly = block.match(/Departamento:\s*Cargo:.*?\d+\s*-\s*(.+?)\s+\d{4}\s*-\s*(.+?)\s/s);
      if (deptOnly) {
        departamento = deptOnly[1].trim();
        cargo = deptOnly[2].trim();
      }
    }

    // ── Totais ──
    // pdfjs coloca valores ANTES dos rótulos:
    // "7.175,88   (6.432,20)   743,68 Total Vencimentos   Total Descontos   Salário Líquido"
    // Quando descontos = 0,00, o PDF não usa parênteses: "147,84  0,00  147,84 Total..."
    const totalsMatch = block.match(
      /([\d.,]+)\s+\(?([\d.,]+)\)?\s+([\d.,]+)\s+Total Vencimentos\s+Total Descontos\s+Sal[aá]rio L[ií]quido/
    );

    if (!totalsMatch) {
      // Fallback: tenta o formato com rótulos ANTES (como pdfplumber gera)
      const totalsAlt = block.match(
        /Total Vencimentos\s+([\d.,]+)\s+Total Descontos\s+\(([\d.,]+)\)\s+Sal[aá]rio L[ií]quido\s+([\d.,]+)/
      );
      if (!totalsAlt) continue;

      employees.push({
        codigo,
        nome,
        cargo,
        departamento,
        bruto: parseBRL(totalsAlt[1]),
        descontos: parseBRL(totalsAlt[2]),
        liquido: parseBRL(totalsAlt[3]),
      });
      continue;
    }

    employees.push({
      codigo,
      nome,
      cargo,
      departamento,
      bruto: parseBRL(totalsMatch[1]),
      descontos: parseBRL(totalsMatch[2]),
      liquido: parseBRL(totalsMatch[3]),
    });
  }

  return employees;
}

/** Extrai texto de todas as páginas do PDF e retorna funcionários parseados */
export async function parseFolhaPdf(file: File): Promise<ParsedEmployee[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    // Junta todos os itens de texto com espaço
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  return parseEmployees(fullText);
}
