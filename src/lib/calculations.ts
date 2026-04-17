import {
  BaseCarteira,
  BaseComercial,
  BaseCusto,
  Dataset,
  FaixaFaturamento,
  Quadrante,
  VendedorConsolidado,
} from "./types";
import { periodoToTrimestre } from "./format";

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
  periodo?: string; // se vier, filtra; senão consolida tudo
}

export function buildConsolidated(ds: Dataset, opts: BuildOpts = {}): VendedorConsolidado[] {
  const filterPeriodo = opts.periodo;
  const fComercial = filterPeriodo ? ds.comercial.filter((r) => r.periodo === filterPeriodo) : ds.comercial;
  const fCusto = filterPeriodo ? ds.custo.filter((r) => r.periodo === filterPeriodo) : ds.custo;
  const fCarteira = filterPeriodo ? ds.carteira.filter((r) => r.periodo === filterPeriodo) : ds.carteira;

  // chave: periodo|vendedor_id
  const k = (p: string, id: string) => `${p}|${id}`;

  const comercialByKey = new Map<string, BaseComercial>();
  for (const r of fComercial) comercialByKey.set(k(r.periodo, r.vendedor_id), r);

  const custoByKey = new Map<string, BaseCusto>();
  for (const r of fCusto) custoByKey.set(k(r.periodo, r.vendedor_id), r);

  const carteiraByKey = new Map<string, BaseCarteira[]>();
  for (const r of fCarteira) {
    const key = k(r.periodo, r.vendedor_id);
    if (!carteiraByKey.has(key)) carteiraByKey.set(key, []);
    carteiraByKey.get(key)!.push(r);
  }

  // garante linha por par (periodo, vendedor_id) presente em qualquer base
  const allKeys = new Set<string>();
  for (const r of fComercial) allKeys.add(k(r.periodo, r.vendedor_id));
  for (const r of fCusto) allKeys.add(k(r.periodo, r.vendedor_id));
  for (const r of fCarteira) allKeys.add(k(r.periodo, r.vendedor_id));

  // 1) cria linhas básicas
  const rows: VendedorConsolidado[] = [];
  for (const key of allKeys) {
    const [periodo, vendedor_id] = key.split("|");
    const com = comercialByKey.get(key);
    const cus = custoByKey.get(key);
    const cart = carteiraByKey.get(key) ?? [];

    const vendedor_nome =
      com?.vendedor_nome || cus?.vendedor_nome || cart[0]?.vendedor_nome || vendedor_id;

    const faturamento_realizado = com?.faturamento_realizado ?? 0;
    const pedidos = com?.pedidos ?? 0;
    const clientes_ativos = com?.clientes_ativos ?? 0;
    const ticket_medio =
      com?.ticket_medio != null && com.ticket_medio > 0
        ? com.ticket_medio
        : pedidos > 0
        ? faturamento_realizado / pedidos
        : 0;

    const custo_total = cus?.custo_total ?? 0;
    const percentual_custo = faturamento_realizado > 0 ? custo_total / faturamento_realizado : 0;
    const resultado_bruto = faturamento_realizado - custo_total;
    const roi_comercial = custo_total > 0 ? faturamento_realizado / custo_total : 0;

    // ── carteira ──
    const distinctClientes = new Set(cart.map((c) => c.cliente_id));
    const clientesPosMes = new Set(
      cart.filter((c) => (c.faturamento_cliente_mes ?? 0) > 0).map((c) => c.cliente_id),
    );
    const clientesPos3m = new Set(
      cart.filter((c) => (c.faturamento_cliente_3m ?? 0) > 0).map((c) => c.cliente_id),
    );
    const total_clientes_carteira = distinctClientes.size;
    const clientes_positivados_mes = clientesPosMes.size;
    const clientes_positivados_3m = clientesPos3m.size;
    const clientes_sem_compra_3m = Math.max(0, total_clientes_carteira - clientes_positivados_3m);

    const faturamento_total_3m_clientes = cart.reduce(
      (acc, c) => acc + (c.faturamento_cliente_3m ?? 0),
      0,
    );

    const venda_media_por_cliente_mes =
      clientes_positivados_mes > 0 ? faturamento_realizado / clientes_positivados_mes : 0;
    const venda_media_por_cliente_3m =
      clientes_positivados_3m > 0 ? faturamento_total_3m_clientes / clientes_positivados_3m : 0;

    const total_municipios_atendidos = new Set(
      cart.map((c) => (c.municipio || "").trim()).filter(Boolean),
    ).size;
    const total_setores_atendidos = new Set(
      cart.map((c) => (c.setor || "").trim()).filter(Boolean),
    ).size;

    rows.push({
      periodo,
      trimestre: periodoToTrimestre(periodo),
      vendedor_id,
      vendedor_nome,
      supervisor: com?.supervisor ?? "—",
      regiao: com?.regiao ?? "—",

      faturamento_realizado,
      clientes_ativos,
      pedidos,
      ticket_medio,

      custo_total,
      percentual_custo,
      resultado_bruto,
      roi_comercial,

      faixa_faturamento: classifyFaixa(faturamento_realizado),
      faturamento_status: "Baixo",
      custo_status: "Alto",
      quadrante_performance: "—",

      total_clientes_carteira,
      clientes_positivados_mes,
      clientes_positivados_3m,
      clientes_sem_compra_3m,
      venda_media_por_cliente_mes,
      venda_media_por_cliente_3m,
      total_municipios_atendidos,
      total_setores_atendidos,
      faturamento_total_3m_clientes,
    });
  }

  // 2) calcula medianas POR PERÍODO (a divisão é feita no time do período)
  const byPeriodo = new Map<string, VendedorConsolidado[]>();
  for (const r of rows) {
    if (!byPeriodo.has(r.periodo)) byPeriodo.set(r.periodo, []);
    byPeriodo.get(r.periodo)!.push(r);
  }

  for (const [, group] of byPeriodo) {
    const fatList = group.map((r) => r.faturamento_realizado).filter((v) => v > 0);
    const pctList = group.map((r) => r.percentual_custo).filter((v) => v > 0);
    const medFat = median(fatList.length ? fatList : group.map((r) => r.faturamento_realizado));
    const medPct = median(pctList.length ? pctList : group.map((r) => r.percentual_custo));
    for (const r of group) {
      r.faturamento_status = r.faturamento_realizado >= medFat ? "Alto" : "Baixo";
      r.custo_status = r.percentual_custo <= medPct ? "Baixo" : "Alto";
      r.quadrante_performance = classifyQuadrante(
        r.faturamento_realizado,
        r.percentual_custo,
        medFat,
        medPct,
      );
    }
  }

  return rows.sort((a, b) => b.faturamento_realizado - a.faturamento_realizado);
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
  clientes_positivados_mes: number;
  clientes_positivados_3m: number;
  venda_media_cliente: number;
  media_municipios: number;
  resultado_bruto: number;
  mediana_faturamento: number;
  mediana_percentual_custo: number;
  mediana_venda_cliente: number;
}

export function computeTimeMetrics(rows: VendedorConsolidado[]): TimeMetrics {
  const n = rows.length;
  if (n === 0) {
    return {
      faturamento_total: 0,
      custo_total: 0,
      percentual_medio: 0,
      roi_medio: 0,
      vendedores: 0,
      faturamento_medio: 0,
      custo_medio: 0,
      total_clientes_carteira: 0,
      clientes_positivados_mes: 0,
      clientes_positivados_3m: 0,
      venda_media_cliente: 0,
      media_municipios: 0,
      resultado_bruto: 0,
      mediana_faturamento: 0,
      mediana_percentual_custo: 0,
      mediana_venda_cliente: 0,
    };
  }
  const faturamento_total = rows.reduce((s, r) => s + r.faturamento_realizado, 0);
  const custo_total = rows.reduce((s, r) => s + r.custo_total, 0);
  const percentual_medio = faturamento_total > 0 ? custo_total / faturamento_total : 0;
  const roi_medio = custo_total > 0 ? faturamento_total / custo_total : 0;
  const total_clientes_carteira = rows.reduce((s, r) => s + r.total_clientes_carteira, 0);
  const clientes_positivados_mes = rows.reduce((s, r) => s + r.clientes_positivados_mes, 0);
  const clientes_positivados_3m = rows.reduce((s, r) => s + r.clientes_positivados_3m, 0);
  const venda_media_cliente =
    clientes_positivados_mes > 0 ? faturamento_total / clientes_positivados_mes : 0;
  const media_municipios = rows.reduce((s, r) => s + r.total_municipios_atendidos, 0) / n;
  return {
    faturamento_total,
    custo_total,
    percentual_medio,
    roi_medio,
    vendedores: n,
    faturamento_medio: faturamento_total / n,
    custo_medio: custo_total / n,
    total_clientes_carteira,
    clientes_positivados_mes,
    clientes_positivados_3m,
    venda_media_cliente,
    media_municipios,
    resultado_bruto: faturamento_total - custo_total,
    mediana_faturamento: median(rows.map((r) => r.faturamento_realizado)),
    mediana_percentual_custo: median(rows.map((r) => r.percentual_custo).filter((v) => v > 0)),
    mediana_venda_cliente: median(
      rows.map((r) => r.venda_media_por_cliente_mes).filter((v) => v > 0),
    ),
  };
}

export function listPeriodos(ds: Dataset): string[] {
  const s = new Set<string>();
  for (const r of ds.comercial) s.add(r.periodo);
  for (const r of ds.custo) s.add(r.periodo);
  for (const r of ds.carteira) s.add(r.periodo);
  return [...s].sort();
}
