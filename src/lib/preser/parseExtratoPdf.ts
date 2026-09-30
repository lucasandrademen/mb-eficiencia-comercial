import * as pdfjsLib from "pdfjs-dist";
import type { ParsedPreser } from "./importar";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

/** "1.234.567,89" → 1234567.89  (também "1.234,567" → 1234.567) */
function parseBRL(s: string): number {
  if (!s) return 0;
  const clean = s
    .replace(/R\$/g, "")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/** "2,500%" → 0.025  ;  "0,397%" → 0.00397 */
function parsePctBR(s: string): number {
  const n = parseBRL(s);
  return n / 100;
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
}

interface PageLines {
  pageNum: number;
  lines: string[];
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Extração bruta: cada página → array de linhas (concatenadas por Y)
// ──────────────────────────────────────────────────────────────────────────

async function extractPagesAsLines(file: File): Promise<PageLines[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const out: PageLines[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items: PositionedItem[] = content.items
      .map((it: any) => ({
        str: typeof it.str === "string" ? it.str : "",
        x: it.transform?.[4] ?? 0,
        y: it.transform?.[5] ?? 0,
      }))
      .filter((it) => it.str.length > 0);

    // Agrupar por Y (quantizado em passos de 2 pra tolerar ruído)
    const byY = new Map<number, PositionedItem[]>();
    for (const it of items) {
      const key = Math.round(it.y / 2);
      if (!byY.has(key)) byY.set(key, []);
      byY.get(key)!.push(it);
    }

    // Ordena por Y desc (topo da página primeiro) e dentro de cada linha por X
    const sortedYKeys = [...byY.keys()].sort((a, b) => b - a);
    const lines: string[] = [];
    for (const yk of sortedYKeys) {
      const row = byY.get(yk)!;
      row.sort((a, b) => a.x - b.x);
      const txt = row
        .map((it) => it.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (txt) lines.push(txt);
    }
    out.push({ pageNum: p, lines });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Parser principal
// ──────────────────────────────────────────────────────────────────────────

/**
 * Em alguns extratos, a ordenação por coordenada inverte o cabeçalho do
 * critério, gerando "<código> <Nome do critério>\nCritério:" em vez de
 * "Critério: <código> <Nome>". Sem normalizar, splitByCriterio PERDE esses
 * critérios inteiros (bug que zerava BRL1/Recomendador e dezenas de "Outros").
 */
function normalizeCriterioInvertido(text: string): string {
  return text.replace(
    /^(\d{1,3})\s+([A-Za-zÀ-ÿ][^\n]*?)\s*\n(Crit[ée]rio:)\s*$/gm,
    "Critério: $1 $2",
  );
}

export async function parsePreserExtratoPdf(file: File): Promise<ParsedPreser> {
  const pages = await extractPagesAsLines(file);
  const allText = normalizeCriterioInvertido(pages.flatMap((p) => p.lines).join("\n"));

  // ── 2.1 Cabeçalho: período ─────────────────────────────────────────────
  // "Apuração: YYYY/M" no PDF = MÊS DO PRESER (é assim que o extrato é salvo).
  // Ciclo: faturamento de 20/(M-1) a 19/M; bônus de metas = metas do mês M-1.
  // Ex: Apuração 2026/9 = PRESER de Setembro (fat. 20/08–19/09, metas de Agosto).
  // Ver src/lib/preser/ciclo.ts.
  // Formato A: "Apuração: 2026/4"   (ano/mês logo após o rótulo)
  // Formato B: "Mês Ano  4 2026  / Apuração:"  (valores antes do rótulo)
  // (o PDF traz espaços antes da barra: "Apuração:   2026   / 7")
  const mA = allText.match(/Apura[çc][ãa]o:\s*(\d{4})\s*\/\s*(\d{1,2})/);
  const mB = allText.match(/M[êe]s\s+Ano\s+(\d{1,2})\s+(\d{4})\s*\/\s*Apura[çc][ãa]o/i);

  let ano: number | null = null;
  let mesNum: number | null = null;
  if (mA) {
    ano = parseInt(mA[1], 10);
    mesNum = parseInt(mA[2], 10);
  } else if (mB) {
    mesNum = parseInt(mB[1], 10);
    ano = parseInt(mB[2], 10);
  }

  // Se o parser NÃO detectar o período, deixa vazio para o usuário escolher
  // no seletor de mês (antes isto chutava 2025-12 e gerava dados errados).
  let periodo = "";
  if (ano !== null && mesNum !== null && mesNum >= 1 && mesNum <= 12) {
    periodo = `${ano}-${String(mesNum).padStart(2, "0")}-01`;
  }

  // ── 2.2 Split por critério ─────────────────────────────────────────────
  // "Critério: 1Representação Comercial..."  OU  "Critério:108Seguro..."
  const criterioSections = splitByCriterio(allText);

  // ── 2.3 SKUs (Critério 1) ──────────────────────────────────────────────
  const sec1 = criterioSections.find((c) => c.codigo === 1 && /Representa/.test(c.nome));
  const skus = sec1 ? parseSkus(sec1.body) : [];

  // ── 2.4 Drops (Critério 20) ────────────────────────────────────────────
  const sec20 = criterioSections.find((c) => c.codigo === 20);
  const drops = sec20 ? parseDrops(sec20.body) : [];

  // ── 2.5 Metas (Recomendadores + VBC + Cobertura) ───────────────────────
  const metas = [...parseMetas(criterioSections), ...parseCoberturasCategoria(criterioSections)];

  // ── 2.6 Outros (todos os demais critérios com "Valor total da comissão")
  const outros = parseOutros(criterioSections);

  // ── 2.7 Totais do cabeçalho ────────────────────────────────────────────
  // valor_total_comissao: soma de tudo (skus + drops + metas + outros contabilizados)
  const totalSkus = skus.reduce((s, r) => s + (r.comissao ?? 0), 0);
  const totalDrops = drops.reduce((s, r) => s + (r.comissao ?? 0), 0);
  const totalMetas = metas.reduce((s, r) => s + (r.comissao ?? 0), 0);
  const totalOutrosContab = outros
    .filter((r) => r.contabilizado)
    .reduce((s, r) => s + (r.comissao ?? 0), 0);
  const valor_total_comissao = totalSkus + totalDrops + totalMetas + totalOutrosContab;

  // valor_total_contabilizado: vem do PDF (página 8)
  const mTotContab = allText.match(/Valor total contabilizado\s+([\d\.]+,\d+)/);
  const valor_total_contabilizado = mTotContab ? parseBRL(mTotContab[1]) : null;

  // faturamento_ac: Efetivo Mês do Critério 21 (Garantia de crédito)
  // O regex tolera variações: espaço, NBSP, quebras entre "(R$)" e o valor.
  const sec21 = criterioSections.find((c) => c.codigo === 21);
  let faturamento_ac: number | null = null;
  if (sec21) {
    // Tentativas em ordem de especificidade
    const regexes = [
      /Efetivo\s*M[êe]s\s*\(?\s*R\$\s*\)?\s*([\d\.]+,\d+)/i,
      /Efetivo\s*M[êe]s[^0-9]*?([\d\.]+,\d+)/i,
      /([\d\.]+,\d+)\s*%\s*de\s*Garantia/i, // último recurso: o número antes de "% de Garantia"
    ];
    for (const re of regexes) {
      const m = sec21.body.match(re);
      if (m && m[1]) {
        const v = parseBRL(m[1]);
        if (v > 1000) {
          // sanity check: faturamento AC é sempre milhões
          faturamento_ac = v;
          break;
        }
      }
    }
  }

  // IRRF/PIS/COFINS/CSLL — soma de todas as ocorrências na seção Contabilização (pág 8)
  const { irrf, pis, cofins, csll } = parseRetencoes(allText);

  return {
    extrato: {
      periodo,
      broker: "35 BROK MB",
      planta: "2858",
      regional: "NE",
      valor_total_comissao: Math.round(valor_total_comissao * 100) / 100,
      valor_total_contabilizado,
      faturamento_ac,
      irrf_retido: irrf,
      pis_retido: pis,
      cofins_retido: cofins,
      csll_retido: csll,
    },
    skus,
    drops,
    metas,
    outros,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 3. Helpers: split por critério
// ──────────────────────────────────────────────────────────────────────────

interface CriterioSection {
  codigo: number;
  nome: string;
  body: string;
}

function splitByCriterio(text: string): CriterioSection[] {
  // O PDF gera "Critério: 1Representação..." (sem espaço entre número e nome às vezes)
  const re = /Crit[ée]rio:\s*(\d+)\s*([^\n]*)/g;
  const matches: { idx: number; codigo: number; nome: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push({ idx: m.index, codigo: parseInt(m[1], 10), nome: m[2].trim() });
  }
  const sections: CriterioSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].idx;
    const end = i + 1 < matches.length ? matches[i + 1].idx : text.length;
    const body = text.slice(start, end);
    sections.push({ codigo: matches[i].codigo, nome: matches[i].nome, body });
  }
  return sections;
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Parser SKUs (Critério 1)
// ──────────────────────────────────────────────────────────────────────────

const CATEGORIA_MAP: Record<string, number> = {
  "Mix Pilar": 1,
  "High Pull": 2,
  "High High Pull": 3,
  "Estratégico": 4,
  "Estrategico": 4,
};

function parseSkus(body: string) {
  // Padrão:
  // <grupo_codigo> - <divisao> - <grupo_nome> <cat_cod> - <cat_nome> <efetivo> <efet_adic> <efet_total> <pct>% <comissao>
  // Exemplo:
  //   "4 - Linha seca - NESCAU LATA 200G 1 - Mix Pilar 97.212,290 0,000 97.212,290 2,500% 2.430,307"
  const re =
    /^(\d+)\s*-\s*([A-Za-zÀ-ÿ ]+?)\s*-\s*(.+?)\s+(\d)\s*-\s*(Mix Pilar|High Pull|High High Pull|Estrat[ée]gico)\s+(-?[\d\.]+,\d+)\s+(-?[\d\.]+,\d+)\s+(-?[\d\.]+,\d+)\s+(-?[\d\.]+,\d+)%\s+(-?[\d\.]+,\d+)\s*$/;

  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: ParsedPreser["skus"] = [];
  const vistos = new Set<string>();

  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const grupo_codigo = parseInt(m[1], 10);
    const divisao = m[2].trim();
    const grupo_nome = m[3].trim();
    const cat_cod = parseInt(m[4], 10);
    const cat_nome = m[5].replace("Estrategico", "Estratégico");
    const efetivo = parseBRL(m[6]);
    const efetivo_adicional = parseBRL(m[7]);
    const efetivo_total = parseBRL(m[8]);
    const pct_comissao = parsePctBR(m[9]);
    const comissao = parseBRL(m[10]);

    const key = `${grupo_codigo}|${grupo_nome}`;
    if (vistos.has(key)) continue;
    vistos.add(key);

    out.push({
      grupo_codigo,
      grupo_nome,
      divisao,
      categoria: cat_cod as 1 | 2 | 3 | 4,
      categoria_nome: cat_nome,
      efetivo,
      efetivo_adicional,
      efetivo_total,
      pct_comissao,
      comissao,
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// 5. Parser Drops (Critério 20)
// ──────────────────────────────────────────────────────────────────────────

function parseDrops(body: string) {
  // "1 - Trad Outros 1995 57,310 86,000% 109,000% 53,722 107.176,176"
  const re =
    /^(\d+)\s*-\s*(.+?)\s+(\d+)\s+([\d\.]+,\d+)\s+([\d\.]+,\d+)%\s+([\d\.]+,\d+)%\s+([\d\.]+,\d+)\s+([\d\.]+,\d+)\s*$/;
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const out: ParsedPreser["drops"] = [];
  const vistos = new Set<number>();

  for (const line of lines) {
    if (/Fator 1|Total|Comiss/.test(line) && !/^\d/.test(line)) continue;
    const m = line.match(re);
    if (!m) continue;
    const canal_codigo = parseInt(m[1], 10);
    if (canal_codigo < 1 || canal_codigo > 99) continue;
    if (vistos.has(canal_codigo)) continue;
    vistos.add(canal_codigo);

    out.push({
      canal_codigo,
      canal_nome: m[2].trim(),
      qtd_drops: parseInt(m[3], 10),
      rs_por_drop: parseBRL(m[4]),
      fator_regionalizacao: parsePctBR(m[5]),
      fator_deslocamento: parsePctBR(m[6]),
      rs_calculado: parseBRL(m[7]),
      comissao: parseBRL(m[8]),
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// 6. Parser Metas (Recomendadores + VBC + Cobertura)
// ──────────────────────────────────────────────────────────────────────────

const META_INFO: Record<
  number,
  { tipo: "VBC" | "Cobertura" | "Recomendador"; bu: string }
> = {
  // Purina (60, 61, 9, 59, 72) excluída — broker não opera Purina
  2: { tipo: "Recomendador", bu: "BRL1" },
  67: { tipo: "Recomendador", bu: "Farma" },
  70: { tipo: "Recomendador", bu: "BRN2" },
  71: { tipo: "Recomendador", bu: "BRN8" },
  3: { tipo: "VBC", bu: "BRL1" },
  5: { tipo: "VBC", bu: "BRL1" },
  11: { tipo: "VBC", bu: "BRN2" },
  62: { tipo: "VBC", bu: "BRN8" },
  14: { tipo: "VBC", bu: "Farma" },
  76: { tipo: "VBC", bu: "NESPRESSO" },
  4: { tipo: "Cobertura", bu: "BRL1" },
  6: { tipo: "Cobertura", bu: "BRL1" },
  12: { tipo: "Cobertura", bu: "BRN2" },
  63: { tipo: "Cobertura", bu: "BRN8" },
  77: { tipo: "Cobertura", bu: "NESPRESSO" },
};

/**
 * Extrai "Valor total da comissão" de um trecho. No PDF da Nestlé, o valor às
 * vezes vem DEPOIS do rótulo ("Valor total da comissão: 11.332,420") e às vezes
 * ANTES ("67.344,240 \n Valor total da comissão:") — dependendo do alinhamento
 * por coordenada. Tenta os dois para não perder comissões (bug do BRL1/Maio).
 */
function extractComissaoTotal(body: string): number | null {
  const depois = body.match(/Valor total da comiss[ãa]o:\s*(-?[\d\.]+,\d+)/);
  if (depois) return parseBRL(depois[1]);
  const antes = body.match(/(-?[\d\.]+,\d+)\s*Valor total da comiss[ãa]o:/);
  if (antes) return parseBRL(antes[1]);
  return null;
}

function parseMetas(sections: CriterioSection[]) {
  // Map por chave (codigo|bu|tipo) — duplicatas (ex: critério aparece na seção
  // de cálculo E na seção textual de "Informações Adicionais") são merged
  // preferindo a entrada com mais dados não-nulos.
  const byKey = new Map<string, ParsedPreser["metas"][number]>();

  for (const sec of sections) {
    const info = META_INFO[sec.codigo];
    if (!info) continue;
    const body = sec.body;

    let efetivo_fiscal: number | null = null;
    let efetivo_mes: number | null = null;
    let pct_atingido: number | null = null;
    let objetivo_meta: number | null = null;
    let comissao: number | null = null;

    if (info.tipo === "Recomendador") {
      // "Recomendador Abril/2026 - % Atingimento = 0.550% - VBC Efetivo = R$ 14585831.790"
      const mAt = body.match(/%\s*Atingimento\s*=\s*([\d\.,]+)%/);
      const mEf = body.match(/VBC Efetivo\s*=\s*R?\$?\s*([\d\.,]+)/);
      const mRes = body.match(/Resultado Recomendador[^-]*-\s*([\d\.,]+)%/);
      // Recomendadores usam "." como decimal: "0.550%", "14585831.790"
      if (mAt) pct_atingido = parseFloat(mAt[1].replace(",", ".")) / 100;
      if (mEf) efetivo_mes = parseFloat(mEf[1].replace(",", "."));
      if (mRes) efetivo_fiscal = parseFloat(mRes[1].replace(",", ".")) / 100;
      objetivo_meta = 0.5; // gatilho de 50%
      comissao = extractComissaoTotal(body); // pega valor antes OU depois do rótulo
    } else {
      // VBC / Cobertura: linha de números após o header da tabela
      // VBC: "Objetivo (R$) Efetivo Fiscal (R$) % Atingido Efetivo Mês (R$) Comissão"
      //      "13.865.796,776 12.147.729,160 0,397% 13.327.728,220 52.911,081"
      // Cobertura: "Objetivo Efetivo (Fiscal) % Atingido Efetivo Mês (R$) Comissão"
      //            "3289 3310 0,519% 13.327.728,220 69.170,909"
      const reNumLine =
        /([\d\.]+,?\d*)\s+([\d\.]+,?\d*)\s+([\d\.]+,\d+)%\s+([\d\.]+,\d+)\s+(-?[\d\.]+,\d+)/;
      const mNum = body.match(reNumLine);
      if (mNum) {
        objetivo_meta = parseBRL(mNum[1]);
        efetivo_fiscal = parseBRL(mNum[2]);
        pct_atingido = parsePctBR(mNum[3]);
        efetivo_mes = parseBRL(mNum[4]);
        comissao = parseBRL(mNum[5]);
      } else {
        comissao = extractComissaoTotal(body);
      }
    }

    const key = `${sec.codigo}|${info.bu}|${info.tipo}`;
    const novo = {
      criterio_codigo: sec.codigo,
      criterio_nome: sec.nome.slice(0, 200),
      bu: info.bu,
      tipo: info.tipo,
      objetivo_minimo: null,
      objetivo_meta,
      objetivo_ideal: null,
      pct_minimo: info.tipo === "VBC" ? 0.0035 : null,
      pct_meta: info.tipo === "VBC" ? 0.005 : null,
      pct_ideal: info.tipo === "VBC" ? 0.0065 : null,
      efetivo_fiscal,
      efetivo_mes,
      pct_atingido,
      comissao,
    };
    const existente = byKey.get(key);
    if (!existente) {
      byKey.set(key, novo);
    } else {
      // Merge: prefere valores não-nulos da nova entrada
      byKey.set(key, {
        ...existente,
        efetivo_fiscal: existente.efetivo_fiscal ?? novo.efetivo_fiscal,
        efetivo_mes: existente.efetivo_mes ?? novo.efetivo_mes,
        pct_atingido: existente.pct_atingido ?? novo.pct_atingido,
        comissao: existente.comissao ?? novo.comissao,
        objetivo_meta: existente.objetivo_meta ?? novo.objetivo_meta,
      });
    }
  }
  return Array.from(byKey.values());
}

// ──────────────────────────────────────────────────────────────────────────
// 6b. Cobertura por CATEGORIA (a partir de Ago/2026: critérios 114, 115, …)
// ──────────────────────────────────────────────────────────────────────────

/**
 * A Nestlé trocou a Cobertura por BU (crit. 4/6/12/63) por uma Cobertura por
 * categoria ("Cobertura Total - BISCOITOS", "… - MAGGI"…), cada uma com
 * objetivo de clientes e faixas próprias (Mínimo/Meta/Ideal e % de cada faixa).
 * Paga % atingido × Efetivo Mês da categoria.
 */
function ehCoberturaCategoria(sec: CriterioSection): boolean {
  return (
    !COBERTOS.has(sec.codigo) &&
    /^Cobertura Total\s*-/i.test(sec.nome) &&
    !PURINA_KEYWORDS.test(sec.nome)
  );
}

function parseCoberturasCategoria(sections: CriterioSection[]) {
  const porCodigo = new Map<number, CriterioSection[]>();
  for (const sec of sections) {
    if (!ehCoberturaCategoria(sec)) continue;
    const l = porCodigo.get(sec.codigo) ?? [];
    l.push(sec);
    porCodigo.set(sec.codigo, l);
  }

  const out: ParsedPreser["metas"] = [];
  for (const [codigo, secs] of porCodigo) {
    const valor = secs.find((s) => /Valor total da comiss[ãa]o:/.test(s.body)) ?? secs[0];
    const body = valor.body;
    const nome = valor.nome.slice(0, 200);
    const categoria = nome.replace(/^Cobertura Total\s*-\s*/i, "").replace(/^\d+\s*-\s*/, "").trim();

    // Faixas: "Estipulado 1689 1757 1790" + "0,700% 1,000% 1,300%" (ordem embaralhada no PDF)
    let fx: { min: number; meta: number; ideal: number; pMin: number; pMeta: number; pIdeal: number } | null = null;
    for (const sec of secs) {
      const i = sec.body.search(/Estipulado/);
      if (i < 0) continue;
      const trecho = sec.body.slice(i, i + 160);
      const ints = [...trecho.matchAll(/(?:^|\s)(\d{1,3}(?:\.\d{3})*|\d+)(?=\s|$)/g)].map((m) => parseInt(m[1].replace(/\./g, ""), 10));
      const pcts = [...trecho.matchAll(/([\d.]+,\d+)%/g)].map((m) => parsePctBR(m[1]));
      if (ints.length >= 3 && pcts.length >= 3) {
        const [a, b2, c] = ints.slice(0, 3).sort((x, y) => x - y);
        const [pa, pb, pc] = pcts.slice(0, 3).sort((x, y) => x - y);
        fx = { min: a, meta: b2, ideal: c, pMin: pa, pMeta: pb, pIdeal: pc };
        break;
      }
    }

    // Formato por SKU (Biscoitos, Chocolates, Garoto…): uma linha por SKU, cada uma
    // com objetivo e % próprios, pagos sobre o Efetivo Mês da categoria.
    //   "Efetivo Mês (R$) 1.033.411,410"
    //   "59 - Linha seca - KIT KAT 4 FINGERS 891 675 0,000% 0,000"
    if (/Categoria\s+Objetivo\s+Efetivo/.test(body)) {
      const mEfCat = body.match(/Efetivo M[êe]s \(R\$\)\s*([\d.]+,\d+)/);
      const efCat = mEfCat ? parseBRL(mEfCat[1]) : null;
      // Quebra de linha/página às vezes sobe um dos números sozinho para a linha de cima:
      //   "769" + "300 - Garoto - BATON 880 0,000% 0,000"  → junta os dois
      const linhasSku = body.split("\n");
      for (let i = 1; i < linhasSku.length; i++) {
        if (/^\d[\d.]*$/.test(linhasSku[i - 1].trim()) &&
            /^\d+\s*-\s*.+?\s\d[\d.]*\s+[\d.]+,\d+%\s+-?[\d.]+,\d+\s*$/.test(linhasSku[i]) &&
            !/^\d+\s*-\s*.+?\s\d[\d.]*\s+\d[\d.]*\s+[\d.]+,\d+%/.test(linhasSku[i])) {
          linhasSku[i] = "§" + linhasSku[i].replace(/\s(\d[\d.]*)(\s+[\d.]+,\d+%)/, ` ${linhasSku[i - 1].trim()} $1$2`);
          linhasSku[i - 1] = "";
        }
      }
      const reSku = /^(§?)(\d+)\s*-\s*(.+?)\s+(\d[\d.]*)\s+(\d[\d.]*)\s+([\d.]+,\d+)%\s+(-?[\d.]+,\d+)\s*$/gm;
      for (const r of linhasSku.join("\n").matchAll(reSku)) {
        const remontada = r[1] === "§";
        const sku = r[3].replace(/^(Linha seca|Garoto|Professional[^-]*)\s*-\s*/i, "").trim();
        const n1 = parseBRL(r[4]);
        const n2 = parseBRL(r[5]);
        const pctSku = parsePctBR(r[6]);
        // linha remontada da quebra: a ordem pode ter invertido; se não pagou,
        // o menor número é o efetivo. Linha íntegra: Objetivo, Efetivo.
        const [objSku, efSku] = remontada && !pctSku ? [Math.max(n1, n2), Math.min(n1, n2)] : [n1, n2];
        out.push({
          criterio_codigo: codigo,
          criterio_nome: `${nome} · ${sku}`.slice(0, 200),
          bu: `${categoria} · ${sku}`,
          tipo: "Cobertura",
          objetivo_minimo: null,
          objetivo_meta: objSku,
          objetivo_ideal: null,
          pct_minimo: null,
          pct_meta: null,
          pct_ideal: null,
          efetivo_fiscal: efSku,
          efetivo_mes: efCat,
          pct_atingido: pctSku,
          comissao: parseBRL(r[7]),
        });
      }
      continue;
    }

    let objetivo: number | null = null;
    let efetivo: number | null = null;
    let pct: number | null = null;
    let efetivoMes: number | null = null;

    // Formato A: "220 226 0,520% 1.529.629,100 7.954,071" (às vezes quebrado em 2 linhas)
    const mA = body.match(/(\d[\d.]*)\s+(\d[\d.]*)\s+([\d.]+,\d+)%\s+([\d.]+,\d+)\s+(-?[\d.]+,\d+)/);
    // Formato B (por SKU): "Efetivo Mês (R$) 1.719.450,080" + "531 - … 951 984 1,300% 22.352,851"
    const mEfMes = body.match(/Efetivo M[êe]s \(R\$\)\s*([\d.]+,\d+)/);
    const mB = body.match(/(\d[\d.]*)\s+(\d[\d.]*)\s+([\d.]+,\d+)%\s+(-?[\d.]+,\d+)\s*(?:\n|$)/);
    let x1: number | null = null;
    let x2: number | null = null;
    if (mA) {
      x1 = parseBRL(mA[1]);
      x2 = parseBRL(mA[2]);
      pct = parsePctBR(mA[3]);
      efetivoMes = parseBRL(mA[4]);
    } else if (mB) {
      x1 = parseBRL(mB[1]);
      x2 = parseBRL(mB[2]);
      pct = parsePctBR(mB[3]);
      efetivoMes = mEfMes ? parseBRL(mEfMes[1]) : null;
    }
    if (x1 != null && x2 != null) {
      if (fx && (x1 === fx.meta || x2 === fx.meta)) {
        // a faixa "Meta" identifica qual número é o objetivo
        objetivo = fx.meta;
        efetivo = x1 === fx.meta ? x2 : x1;
      } else if (!pct) {
        // não pagou → o efetivo ficou abaixo do objetivo
        objetivo = Math.max(x1, x2);
        efetivo = Math.min(x1, x2);
      } else {
        objetivo = x1;
        efetivo = x2;
      }
    }

    const comissao = extractComissaoTotal(body) ?? 0;
    // Categorias que não se aplicam vêm com objetivo 999.999.999 e nada pago
    if ((objetivo ?? 0) >= 999_999_999 && !comissao) continue;

    out.push({
      criterio_codigo: codigo,
      criterio_nome: nome,
      bu: categoria,
      tipo: "Cobertura",
      objetivo_minimo: fx?.min ?? null,
      objetivo_meta: objetivo,
      objetivo_ideal: fx?.ideal ?? null,
      pct_minimo: fx?.pMin ?? null,
      pct_meta: fx?.pMeta ?? null,
      pct_ideal: fx?.pIdeal ?? null,
      efetivo_fiscal: efetivo,
      efetivo_mes: efetivoMes,
      pct_atingido: pct,
      comissao,
    });
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// 7. Parser Outros (qualquer crit. com "Valor total da comissão")
// ──────────────────────────────────────────────────────────────────────────

// Critérios já cobertos por SKUs/Drops/Metas (NÃO incluir em "outros")
const COBERTOS = new Set([
  1, 20, 75, // SKUs
  2, 67, 70, 71, 72, // Recomendadores (72 Purina ignorada)
  3, 5, 11, 14, 60, 61, 62, 76, // VBC (60, 61 Purina ignoradas)
  4, 6, 9, 12, 59, 63, 77, // Cobertura (9, 59 Purina ignoradas)
]);

/** BUs/categorias relacionadas a Purina — broker não opera Purina, ignoramos */
const PURINA_KEYWORDS = /purina|nestle\s*purina/i;

function parseOutros(sections: CriterioSection[]) {
  const out: ParsedPreser["outros"] = [];
  const vistos = new Set<number>();

  for (const sec of sections) {
    if (COBERTOS.has(sec.codigo)) continue;
    if (ehCoberturaCategoria(sec)) continue; // tratado como meta (Cobertura por categoria)
    if (vistos.has(sec.codigo)) continue;
    if (PURINA_KEYWORDS.test(sec.nome)) continue; // ignora qualquer "outro" relacionado a Purina

    const body = sec.body;
    if (!/Valor total da comiss[ãa]o:/.test(body)) continue;
    const comissao = extractComissaoTotal(body) ?? 0;
    vistos.add(sec.codigo);

    const isDemonstrativo = /SOMENTE DEMONSTRATIVO/i.test(body);

    // Tipo de serviço:
    let tipo_servico = "Outros";
    if (/Garantia de cr[ée]dito/i.test(sec.nome)) tipo_servico = "Garantia de Crédito";
    else if (/RC-DC|Seguro/i.test(sec.nome)) tipo_servico = "Prestação Fixa";
    else if (/Armazenagem|Refrigerado|Prestação de Serviço Fixa|Entrega|Operação Logística/i.test(sec.nome))
      tipo_servico = "Prestação Fixa";
    else if (/Merchandising|Visitas|Representação Comercial/i.test(sec.nome))
      tipo_servico = "Representação Comercial";

    // Tentativa de extrair observação textual (1ª linha do corpo após o cabeçalho)
    const linhas = body.split("\n").map((l) => l.trim()).filter(Boolean);
    const observacao =
      linhas.length > 2
        ? linhas[1].slice(0, 200) // descrição textual logo após "Critério: X..."
        : null;

    const base = extrairBase(linhas);

    out.push({
      criterio_codigo: sec.codigo,
      criterio_nome: sec.nome.slice(0, 200),
      tipo_servico,
      bu: null,
      base_calculo: base?.base ?? null,
      base_unidade: base?.unidade ?? null,
      rs_unitario: base?.rs ?? null,
      comissao,
      observacao: base?.obs ?? observacao,
      contabilizado: !isDemonstrativo,
    });
  }
  return out;
}

const NUM_BR = /^-?[\d.]+,\d+$/;
const INT_BR = /^\d[\d.]*$/;
const toInt = (t: string) => parseInt(t.replace(/\./g, ""), 10);

/**
 * Base de cálculo de um critério "outros", lida das linhas do corpo:
 * faturamento (Garantia/Seguro), peso (Entrega), pallets (Armazenagem/Refrigerado),
 * visitas (Farma/PAC/RiV/Prospectores) e merchandisers. null se não reconhecer.
 */
function extrairBase(
  linhas: string[],
): { base: number; unidade: string; rs: number | null; obs?: string } | null {
  const txt = linhas.join("\n");

  // Garantia de crédito / Seguros: "Efetivo Mês (R$) 13.352.990,400 % de Garantia 0,600%"
  // (alguns meses trazem os rótulos numa linha e os valores na seguinte)
  const mEf =
    txt.match(/Efetivo M[êe]s \(R\$\)\s*([\d.]+,\d+)\s*%\s*de\s*\w+\s*([\d.]+,\d+)%/) ??
    txt.match(/Efetivo M[êe]s \(R\$\)\s*%\s*de\s*\w+\s*\n\s*([\d.]+,\d+)\s+([\d.]+,\d+)%/);
  if (mEf) return { base: parseBRL(mEf[1]), unidade: "R$", rs: parseBRL(mEf[2]) / 100 };

  // Entrega: "Peso Bruto 411.051,244 R$/Kg: 0,524"
  const mPeso =
    txt.match(/Peso Bruto\s*([\d.]+,\d+)\s*R\$\/Kg:?\s*([\d.]+,\d+)/i) ??
    txt.match(/Peso Bruto\s*R\$\/Kg:?\s*\n\s*([\d.]+,\d+)\s+([\d.]+,\d+)/i);
  if (mPeso) return { base: parseBRL(mPeso[1]), unidade: "kg", rs: parseBRL(mPeso[2]) };

  const iHead = linhas.findIndex((l) => /Pallets/.test(l) && /Calc\.\s*Comiss/.test(l));
  if (iHead >= 0) {
    // Linhas de pallets: "89,430% 250 666,140 ..." (Armazenagem) ou "45 98,060 ..." (Refrigerado)
    let pallets = 0;
    for (const l of linhas.slice(iHead + 1)) {
      if (/^(Valor total|\*|Crit)/.test(l)) break;
      const t = l.split(" ");
      if (t.length < 4 || !NUM_BR.test(t[t.length - 1])) continue;
      const q = /%$/.test(t[0]) ? t[1] : t[0];
      if (INT_BR.test(q)) pallets += toInt(q);
    }
    if (pallets > 0) return { base: pallets, unidade: "pallets", rs: null };
  }

  const iVis = linhas.findIndex((l) => /Canal\s+Objetivo\s+Efetivo/.test(l));
  if (iVis >= 0) {
    // "11 - Farma Curva B 16 16 100,000% ..." → objetivo, efetivo
    let obj = 0;
    let ef = 0;
    for (const l of linhas.slice(iVis + 1)) {
      if (/^(Valor total|\*|Crit)/.test(l)) break;
      const m = l.match(/^\d+\s*-\s*.+?\s(\d[\d.]*)\s+(\d[\d.]*)\s+[\d.]+,\d+%/);
      if (m) {
        obj += toInt(m[1]);
        ef += toInt(m[2]);
      }
    }
    if (obj || ef) return { base: ef, unidade: "visitas", rs: null, obs: `Objetivo ${obj} visitas · efetivo ${ef}` };
  }

  // Merchandising: "28 28 5.157,510 144.410,280 1 1 13.027,390 13.027,390" (Qtd. Max, Qtd. Cons., …)
  const iMer = linhas.findIndex((l) => /Qtd\.\s*Max/.test(l) && /Total Pago/.test(l));
  if (iMer >= 0 && linhas[iMer + 1]) {
    let cons = 0;
    const t = linhas[iMer + 1].split(" ");
    if (INT_BR.test(t[0])) {
      for (let i = 0; i + 3 < t.length; i += 4) if (INT_BR.test(t[i + 1])) cons += toInt(t[i + 1]);
    } else if (linhas[iMer + 2]) {
      // valores numa linha e quantidades na seguinte: "24 24 1 1" (Max, Cons, Max, Cons)
      const q = linhas[iMer + 2].split(" ");
      for (let i = 1; i < q.length; i += 2) if (INT_BR.test(q[i])) cons += toInt(q[i]);
    }
    if (cons > 0) return { base: cons, unidade: "pessoas", rs: null };
  }
  return null;
}

// ──────────────────────────────────────────────────────────────────────────
// 8. Retenções de impostos (página 8)
// ──────────────────────────────────────────────────────────────────────────

function parseRetencoes(text: string): {
  irrf: number;
  pis: number;
  cofins: number;
  csll: number;
} {
  let irrf = 0,
    pis = 0,
    cofins = 0,
    csll = 0;
  const reIrrf = /IRRF\s+[\d\.]+,\d+%\s+([\d\.]+,\d+)/g;
  const rePis = /PIS\s+[\d\.]+,\d+%\s+([\d\.]+,\d+)/g;
  const reCof = /COFINS\s+[\d\.]+,\d+%\s+([\d\.]+,\d+)/g;
  const reCsll = /CSLL\s+[\d\.]+,\d+%\s+([\d\.]+,\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = reIrrf.exec(text)) !== null) irrf += parseBRL(m[1]);
  while ((m = rePis.exec(text)) !== null) pis += parseBRL(m[1]);
  while ((m = reCof.exec(text)) !== null) cofins += parseBRL(m[1]);
  while ((m = reCsll.exec(text)) !== null) csll += parseBRL(m[1]);
  return {
    irrf: Math.round(irrf * 100) / 100,
    pis: Math.round(pis * 100) / 100,
    cofins: Math.round(cofins * 100) / 100,
    csll: Math.round(csll * 100) / 100,
  };
}
