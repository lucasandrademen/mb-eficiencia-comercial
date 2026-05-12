import {
  BaseFolha,
  BaseVendedor,
  Dataset,
  FaixaFaturamento,
  Quadrante,
  SUPERVISOR_NAME_PREFIXES,
  VendedorConsolidado,
} from "./types";
import { periodoToTrimestre } from "./format";

// Encargos patronais (FGTS + INSS + 13º + férias + provisões).
// Mesma taxa usada no relatório de folha mensal (mb-payroll-insights).
export const ENCARGOS_PCT = 0.6746;

// ─── Folha: índice por período+código e por período+nome normalizado ───────

function normalizeNome(s: string): string {
  return s
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Preposições comuns em nomes — descartadas na comparação por token.
const STOPWORDS = new Set(["DA", "DE", "DO", "DAS", "DOS", "E", "DI", "DU"]);

export function isSupervisorNome(nome: string): boolean {
  const norm = normalizeNome(nome);
  if (!norm) return false;
  return (SUPERVISOR_NAME_PREFIXES as readonly string[]).some(
    (pref) => norm === pref || norm.startsWith(pref + " "),
  );
}

function tokenize(nome: string): string[] {
  return normalizeNome(nome)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

interface FolhaIndex {
  byCodigoPeriodo: Map<string, BaseFolha>;
  byNomePeriodo: Map<string, BaseFolha>;
  porPeriodo: Map<string, BaseFolha[]>;
}

function buildFolhaIndex(folha: BaseFolha[]): FolhaIndex {
  const byCodigoPeriodo = new Map<string, BaseFolha>();
  const byNomePeriodo = new Map<string, BaseFolha>();
  const porPeriodo = new Map<string, BaseFolha[]>();
  for (const f of folha) {
    byCodigoPeriodo.set(`${f.periodo}|${f.codigo}`, f);
    byNomePeriodo.set(`${f.periodo}|${normalizeNome(f.nome)}`, f);
    if (!porPeriodo.has(f.periodo)) porPeriodo.set(f.periodo, []);
    porPeriodo.get(f.periodo)!.push(f);
  }
  return { byCodigoPeriodo, byNomePeriodo, porPeriodo };
}

type MatchType = "codigo" | "nome_exato" | "nome_fuzzy" | "sem_match";
export interface FolhaLookupResult {
  folha: BaseFolha | null;
  matchType: MatchType;
}

function lookupCustoFolha(
  idx: FolhaIndex,
  periodo: string,
  vendedor_id: string,
  vendedor_nome: string,
): FolhaLookupResult {
  // 1. Match exato por código (periodo + vendedor_id)
  const byCod = idx.byCodigoPeriodo.get(`${periodo}|${vendedor_id}`);
  if (byCod) return { folha: byCod, matchType: "codigo" };

  // 2. Match exato por nome normalizado
  const nome = normalizeNome(vendedor_nome);
  if (nome) {
    const byNome = idx.byNomePeriodo.get(`${periodo}|${nome}`);
    if (byNome) return { folha: byNome, matchType: "nome_exato" };
  }

  // 3. Match fuzzy por tokens (primeiro + último nome, ou ≥2 tokens em comum)
  const vendTokens = tokenize(vendedor_nome);
  if (vendTokens.length === 0) return { folha: null, matchType: "sem_match" };

  const candidatos = idx.porPeriodo.get(periodo) ?? [];
  let melhor: { folha: BaseFolha; score: number } | null = null;

  for (const f of candidatos) {
    const folhaTokens = tokenize(f.nome);
    if (folhaTokens.length === 0) continue;

    const comuns = vendTokens.filter((t) => folhaTokens.includes(t));
    const firstMatch = vendTokens[0] === folhaTokens[0];
    const lastMatch =
      vendTokens[vendTokens.length - 1] === folhaTokens[folhaTokens.length - 1];

    let score = 0;
    if (firstMatch && lastMatch) score = 100 + comuns.length;
    else if (comuns.length >= 2) score = 50 + comuns.length;
    else if (firstMatch && comuns.length >= 1) score = 30;

    if (score > 0 && (!melhor || score > melhor.score)) {
      melhor = { folha: f, score };
    }
  }

  if (melhor) return { folha: melhor.folha, matchType: "nome_fuzzy" };
  return { folha: null, matchType: "sem_match" };
}

// ─── Faixas e quadrantes ────────────────────────────────────────────────────

export function classifyFaixa(faturamento: number): FaixaFaturamento {
  if (faturamento <= 200_000) return "Até 200 mil";
  if (faturamento <= 500_000) return "200 mil a 500 mil";
  if (faturamento <= 1_000_000) return "500 mil a 1 mi";
  if (faturamento <= 2_000_000) return "1 mi a 2 mi";
  return "Acima de 2 mi";
}

export function classifyQuadrante(
  faturamento: number,
  percentualCusto: number,
  medianFat: number,
  medianPct: number,
): Quadrante {
  const fatHigh = faturamento >= medianFat;
  const pctLow = percentualCusto <= medianPct;
  if (fatHigh && pctLow) return "Estrela";
  if (fatHigh && !pctLow) return "Trator caro";
  if (!fatHigh && pctLow) return "Potencial";
  return "Alerta vermelho";
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

// ─── Consolidação por (período, vendedor_id) ───────────────────────────────

interface BuildOpts {
  periodos?: string[];
}

export function buildConsolidated(ds: Dataset, opts: BuildOpts = {}): VendedorConsolidado[] {
  const filterSet = opts.periodos && opts.periodos.length ? new Set(opts.periodos) : null;
  const fVendedor = filterSet ? ds.vendedor.filter((r) => filterSet.has(r.periodo)) : ds.vendedor;
  const fCarteira = filterSet ? ds.carteira.filter((r) => filterSet.has(r.periodo)) : ds.carteira;

  const folhaIdx = buildFolhaIndex(ds.folha ?? []);
  const k = (p: string, id: string) => `${p}|${id}`;

  const vendedorByKey = new Map<string, BaseVendedor>();
  for (const r of fVendedor) vendedorByKey.set(k(r.periodo, r.vendedor_id), r);

  const carteiraByKey = new Map<string, typeof fCarteira>();
  for (const r of fCarteira) {
    const key = k(r.periodo, r.vendedor_id);
    if (!carteiraByKey.has(key)) carteiraByKey.set(key, []);
    carteiraByKey.get(key)!.push(r);
  }

  const allKeys = new Set<string>();
  for (const r of fVendedor) allKeys.add(k(r.periodo, r.vendedor_id));
  for (const r of fCarteira) allKeys.add(k(r.periodo, r.vendedor_id));

  const rows: VendedorConsolidado[] = [];
  for (const key of allKeys) {
    const [periodo, vendedor_id] = key.split("|");
    const vend = vendedorByKey.get(key);
    const cart = carteiraByKey.get(key) ?? [];

    const vendedor_nome = (vend?.vendedor_nome || vendedor_id)
      .replace(/\([^)]*\)/g, " ")
      .replace(/\([^)]*$/g, " ") // parênteses órfãos
      .replace(/\s+/g, " ")
      .trim();

    const faturamento = vend?.faturamento ?? cart.reduce((s, c) => s + c.faturamento_cliente, 0);
    const temFolha = (ds.folha ?? []).some((f) => f.periodo === periodo);
    const { folha: folhaMatch, matchType } = lookupCustoFolha(
      folhaIdx,
      periodo,
      vendedor_id,
      vendedor_nome,
    );
    // Custo real para a empresa = salário bruto + encargos patronais.
    const custo = folhaMatch ? folhaMatch.bruto * (1 + ENCARGOS_PCT) : (vend?.custo ?? 0);
    const folha_match_status: VendedorConsolidado["folha_match_status"] = !temFolha
      ? "sem_folha"
      : matchType;
    const percentual_custo = faturamento > 0 ? custo / faturamento : 0;
    const resultado_bruto = faturamento - custo;
    const roi_comercial = custo > 0 ? faturamento / custo : 0;

    const distinctClientes = new Set(cart.map((c) => c.cliente_id));
    const total_clientes_carteira = distinctClientes.size;

    const cidadesList = cart.map((c) => (c.cidade || "").trim()).filter(Boolean);
    const total_municipios_atendidos = new Set(cidadesList).size;

    // cidade principal = cidade com mais clientes distintos
    const clientesPorCidade = new Map<string, Set<string>>();
    for (const c of cart) {
      const cidade = (c.cidade || "").trim();
      if (!cidade) continue;
      if (!clientesPorCidade.has(cidade)) clientesPorCidade.set(cidade, new Set());
      clientesPorCidade.get(cidade)!.add(c.cliente_id);
    }
    let cidade_principal = "—";
    let maxClientes = 0;
    for (const [c, set] of clientesPorCidade) {
      if (set.size > maxClientes) {
        cidade_principal = c;
        maxClientes = set.size;
      }
    }

    const ticket_medio = total_clientes_carteira > 0 ? faturamento / total_clientes_carteira : 0;
    const custo_por_cliente_carteira =
      total_clientes_carteira > 0 ? custo / total_clientes_carteira : 0;

    rows.push({
      periodo,
      trimestre: periodoToTrimestre(periodo),
      vendedor_id,
      vendedor_nome,
      supervisor: vend?.supervisor ?? "—",
      cidade_principal,

      faturamento,
      custo,
      resultado_bruto,
      percentual_custo,
      roi_comercial,

      faixa_faturamento: classifyFaixa(faturamento),
      faturamento_status: "Baixo",
      custo_status: "Alto",
      quadrante_performance: "—",

      total_clientes_carteira,
      total_municipios_atendidos,
      ticket_medio,
      custo_por_cliente_carteira,

      folha_match_status,
      folha_match_nome: folhaMatch?.nome,

      is_supervisor: isSupervisorNome(vendedor_nome),
    });
  }

  // medianas POR PERÍODO
  const byPeriodo = new Map<string, VendedorConsolidado[]>();
  for (const r of rows) {
    if (!byPeriodo.has(r.periodo)) byPeriodo.set(r.periodo, []);
    byPeriodo.get(r.periodo)!.push(r);
  }
  for (const [, group] of byPeriodo) {
    const fatList = group.map((r) => r.faturamento).filter((v) => v > 0);
    const pctList = group.map((r) => r.percentual_custo).filter((v) => v > 0);
    const medFat = median(fatList.length ? fatList : group.map((r) => r.faturamento));
    const medPct = median(pctList.length ? pctList : group.map((r) => r.percentual_custo));
    for (const r of group) {
      r.faturamento_status = r.faturamento >= medFat ? "Alto" : "Baixo";
      r.custo_status = r.percentual_custo <= medPct ? "Baixo" : "Alto";
      r.quadrante_performance = classifyQuadrante(r.faturamento, r.percentual_custo, medFat, medPct);
    }
  }

  return rows.sort((a, b) => b.faturamento - a.faturamento);
}

// ─── Métricas de time ──────────────────────────────────────────────────────

export interface TimeMetrics {
  faturamento_total: number;
  custo_total: number;
  percentual_medio: number;
  roi_medio: number;
  vendedores: number;
  faturamento_medio: number;
  custo_medio: number;
  total_clientes_carteira: number;
  ticket_medio_time: number;
  media_municipios: number;
  resultado_bruto: number;
  mediana_faturamento: number;
  mediana_percentual_custo: number;
  mediana_ticket: number;
}

export function computeTimeMetrics(rows: VendedorConsolidado[]): TimeMetrics {
  const n = rows.length;
  const empty: TimeMetrics = {
    faturamento_total: 0, custo_total: 0, percentual_medio: 0, roi_medio: 0, vendedores: 0,
    faturamento_medio: 0, custo_medio: 0, total_clientes_carteira: 0,
    ticket_medio_time: 0, media_municipios: 0,
    resultado_bruto: 0,
    mediana_faturamento: 0, mediana_percentual_custo: 0, mediana_ticket: 0,
  };
  if (n === 0) return empty;
  const faturamento_total = rows.reduce((s, r) => s + r.faturamento, 0);
  const custo_total = rows.reduce((s, r) => s + r.custo, 0);
  const percentual_medio = faturamento_total > 0 ? custo_total / faturamento_total : 0;
  const roi_medio = custo_total > 0 ? faturamento_total / custo_total : 0;
  const total_clientes_carteira = rows.reduce((s, r) => s + r.total_clientes_carteira, 0);
  const ticket_medio_time =
    total_clientes_carteira > 0 ? faturamento_total / total_clientes_carteira : 0;
  const media_municipios = rows.reduce((s, r) => s + r.total_municipios_atendidos, 0) / n;
  return {
    faturamento_total, custo_total, percentual_medio, roi_medio, vendedores: n,
    faturamento_medio: faturamento_total / n, custo_medio: custo_total / n,
    total_clientes_carteira, ticket_medio_time,
    media_municipios,
    resultado_bruto: faturamento_total - custo_total,
    mediana_faturamento: median(rows.map((r) => r.faturamento)),
    mediana_percentual_custo: median(rows.map((r) => r.percentual_custo).filter((v) => v > 0)),
    mediana_ticket: median(rows.map((r) => r.ticket_medio).filter((v) => v > 0)),
  };
}

export function listPeriodos(ds: Dataset): string[] {
  const s = new Set<string>();
  for (const r of ds.vendedor) s.add(r.periodo);
  for (const r of ds.carteira) s.add(r.periodo);
  for (const r of ds.folha ?? []) s.add(r.periodo);
  return [...s].sort();
}
