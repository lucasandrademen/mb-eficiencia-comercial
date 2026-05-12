import * as pdfjsLib from "pdfjs-dist";
import { BaseVendedor } from "./types";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

/** Converte "1.234.567,89" → 1234567.89 */
function parseBRL(s: string): number {
  const clean = s.replace(/R\$/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

interface TextItem {
  str: string;
  x: number;
  y: number;
}

/**
 * Lê um PDF do "Consolidado Preser - Equipe Comercial".
 *
 * Estratégia: agrupa os fragmentos de texto por linha (Y) e, em cada linha,
 * procura o padrão:
 *   SETOR (3 dígitos)  NOME (palavras)  R$ OBJETIVO  R$ FATURAMENTO  %  R$ COMISSÃO  %
 *
 * Só extrai SETOR, NOME e FATURAMENTO (2º valor R$ da linha).
 * Ignora linhas cujo SETOR não é numérico (FERISTA, PROSPECTOR, cabeçalho, totais).
 */
export async function parsePreserPdf(file: File, periodo: string): Promise<BaseVendedor[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;

  const rows: BaseVendedor[] = [];
  const vistos = new Set<string>();

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items: TextItem[] = content.items
      .map((it: any) => ({
        str: typeof it.str === "string" ? it.str : "",
        x: it.transform?.[4] ?? 0,
        y: it.transform?.[5] ?? 0,
      }))
      .filter((it) => it.str.trim().length > 0);

    // Agrupa itens por linha (quantiza Y em passos de 2 unidades pra tolerar ruído).
    const linhas = new Map<number, TextItem[]>();
    for (const it of items) {
      const key = Math.round(it.y / 2);
      if (!linhas.has(key)) linhas.set(key, []);
      linhas.get(key)!.push(it);
    }

    // Processa cada linha (ordenada de cima pra baixo; a ordem entre linhas não importa).
    for (const [, linha] of linhas) {
      linha.sort((a, b) => a.x - b.x);
      const tokens = linha.map((it) => it.str.trim()).filter(Boolean);
      if (tokens.length === 0) continue;

      // Texto concatenado da linha (com espaço único entre tokens).
      const texto = tokens.join(" ").replace(/\s+/g, " ").trim();

      // SETOR: primeiros caracteres numéricos de 1-4 dígitos.
      const mSetor = texto.match(/^(\d{1,4})\s+(.+)$/);
      if (!mSetor) continue;
      const setor = mSetor[1];
      let resto = mSetor[2];

      // Em seguida vem o NOME até o primeiro "R$".
      const idxRS = resto.search(/R\$/);
      if (idxRS < 0) continue;
      // Remove anotações entre parênteses — ex.: "(FÉRIAS)", "(TRABALHOU 8 DIAS)".
      const nome = resto
        .slice(0, idxRS)
        .replace(/\([^)]*\)/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!nome || nome.length < 3) continue;

      // Captura todos os valores "R$ ..." da linha.
      const valores = [...resto.matchAll(/R\$\s*([\d\.]+,\d{2}|-)/g)].map((m) =>
        m[1] === "-" ? 0 : parseBRL(m[1]),
      );
      // Ordem de colunas na planilha: OBJETIVO, FATURAMENTO, COMISSÃO.
      // Faturamento = 2º valor (índice 1). Se só vier 1 valor, descarta (linha de total).
      if (valores.length < 2) continue;
      const faturamento = valores[1];
      if (faturamento <= 0) continue;

      const key = `${setor}|${nome.toUpperCase()}`;
      if (vistos.has(key)) continue;
      vistos.add(key);

      rows.push({
        periodo,
        vendedor_id: setor,
        vendedor_nome: nome,
        supervisor: "",
        faturamento,
        custo: 0,
      });
    }
  }

  return rows;
}
