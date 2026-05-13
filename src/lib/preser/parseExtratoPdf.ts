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

export async function parsePreserExtratoPdf(file: File): Promise<ParsedPreser> {
  const pages = await extractPagesAsLines(file);
  const allText = pages.flatMap((p) => p.lines).join("\n");

  // ── 2.1 Cabeçalho: período ─────────────────────────────────────────────
  // "Apuração: YYYY/M" no PDF refere-se ao CICLO que FECHA dia 19 do mês M.
  // O ciclo PRESER é "mês M-1 dia 20" até "mês M dia 19", então a atividade
  // comercial é do mês M-1. Ex: Apuração 2026/4 = ciclo Mar/20 a Abr/19 =
  // atividade de MARÇO. Salvamos como mês M-1.
  const mApur = allText.match(/Apura[çc][ãa]o:\s*(\d{4})\/\s*(\d{1,2})/);
  let ano = mApur ? parseInt(mApur[1], 10) : 2026;
  let mesNum = mApur ? parseInt(mApur[2], 10) : 1;
  // Recua 1 mês (com virada de ano se preciso)
  mesNum -= 1;
  if (mesNum <= 0) {
    mesNum = 12;
    ano -= 1;
  }
  const mes = String(mesNum).padStart(2, "0");
  const periodo = `${ano}-${mes}-01`;

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
  const metas = parseMetas(criterioSections);

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
  const sec21 = criterioSections.find((c) => c.codigo === 21);
  let faturamento_ac: number | null = null;
  if (sec21) {
    const mEf = sec21.body.match(/Efetivo M[êe]s\s*\(R\$\)\s*([\d\.]+,\d+)/);
    faturamento_ac = mEf ? parseBRL(mEf[1]) : null;
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

function parseMetas(sections: CriterioSection[]) {
  const out: ParsedPreser["metas"] = [];

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
      const mCom = body.match(/Valor total da comiss[ãa]o:\s*([\d\.]+,\d+|-[\d\.]+,\d+)/);
      // Recomendadores usam "." como decimal: "0.550%", "14585831.790"
      if (mAt) pct_atingido = parseFloat(mAt[1].replace(",", ".")) / 100;
      if (mEf) efetivo_mes = parseFloat(mEf[1].replace(",", "."));
      if (mRes) efetivo_fiscal = parseFloat(mRes[1].replace(",", ".")) / 100;
      objetivo_meta = 0.5; // gatilho de 50%
      if (mCom) comissao = parseBRL(mCom[1]);
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
        const mCom = body.match(/Valor total da comiss[ãa]o:\s*(-?[\d\.]+,\d+)/);
        if (mCom) comissao = parseBRL(mCom[1]);
      }
    }

    out.push({
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
    if (vistos.has(sec.codigo)) continue;
    if (PURINA_KEYWORDS.test(sec.nome)) continue; // ignora qualquer "outro" relacionado a Purina

    const body = sec.body;
    const mCom = body.match(/Valor total da comiss[ãa]o:\s*(-?[\d\.]+,\d+)/);
    if (!mCom) continue;
    const comissao = parseBRL(mCom[1]);
    if (comissao === 0 && !/-/.test(mCom[1])) {
      // ignora 0,000 puros sem sinal — geralmente são linhas de cabeçalho
      // mas linhas com comissão 0 e contexto também aparecem; mantém se descrição relevante
    }
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

    out.push({
      criterio_codigo: sec.codigo,
      criterio_nome: sec.nome.slice(0, 200),
      tipo_servico,
      bu: null,
      base_calculo: null,
      base_unidade: null,
      rs_unitario: null,
      comissao,
      observacao,
      contabilizado: !isDemonstrativo,
    });
  }
  return out;
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
