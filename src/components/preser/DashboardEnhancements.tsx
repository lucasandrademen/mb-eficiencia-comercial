import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowRight,
  GitCompare,
  Target,
  Sparkles,
  Package,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtBRL, fmtPct, fmtNum, periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  PreserExtratoCompleto,
  PreserMeta,
  PreserSku,
} from "@/lib/preser/types";

// ═══════════════════════════════════════════════════════════════════════
// 1. MODAL DE DRILL-DOWN — Detalhes de uma célula do heatmap
// ═══════════════════════════════════════════════════════════════════════

interface DrillDownProps {
  open: boolean;
  onClose: () => void;
  bu: string;
  tipo: "VBC" | "Cobertura" | "Recomendador";
  metas: PreserMeta[];
}

export function MetaDrillModal({ open, onClose, bu, tipo, metas }: DrillDownProps) {
  const filtradas = useMemo(
    () => metas.filter((m) => m.bu === bu && m.tipo === tipo),
    [metas, bu, tipo],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`${bu} · ${tipo}`}
      description={`${filtradas.length} critério(s) nessa BU/tipo`}
      size="lg"
    >
      <div className="space-y-4">
        {filtradas.map((m) => {
          const ef = m.efetivo_fiscal ?? 0;
          const meta = m.objetivo_meta ?? 0;
          const com = m.comissao ?? 0;
          const efMes = m.efetivo_mes ?? 0;
          const pctAt = m.pct_atingido ?? 0;

          // Regra simplificada: o que importa é a COMISSÃO ganha.
          // - comissao > 0 → ganhou (verde)
          // - comissao = 0 → perdeu (vermelho), oportunidade clara
          const ganhou = com > 0;
          let pctDisplay = 0;
          let gap = 0;
          let detalhe = "";

          if (tipo === "Recomendador") {
            // Para Recomendador, exibimos o "Resultado Recomendador" (efetivo_fiscal é a %)
            pctDisplay = ef;
            if (!ganhou) {
              // Estimativa de quanto ganharia se atingisse a faixa mínima
              gap = (m.pct_meta ?? 0.005) * efMes;
              detalhe = `Atingimento ${fmtPct(ef)} — comissão zerada. Estimativa de ganho ao atingir a próxima faixa: ${fmtBRL(gap)}.`;
            } else {
              detalhe = `Faixa paga: ${fmtPct(pctAt, 3)} sobre VBC = ${fmtBRL(com)}.`;
            }
          } else {
            pctDisplay = meta > 0 ? ef / meta : 0;
            if (!ganhou || ef < meta) {
              gap = Math.max(0, (m.pct_ideal ?? 0.0065) * efMes - com);
              const falta = meta - ef;
              detalhe =
                falta > 0
                  ? `Faltam ${tipo === "Cobertura" ? fmtNum(falta) + " clientes" : fmtBRL(falta)} pra bater meta.`
                  : `Meta batida. ${fmtPct(pctDisplay)} de atingimento.`;
            } else {
              detalhe = `Meta batida. ${fmtPct(pctDisplay)} de atingimento.`;
            }
          }

          const cor = ganhou ? "hsl(152 60% 42%)" : "hsl(0 72% 55%)";

          return (
            <div
              key={m.id}
              className="rounded-xl border p-4"
              style={{ borderColor: `${cor}44`, background: `${cor}0a` }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Critério {m.criterio_codigo}
                  </p>
                  <p className="text-base font-bold leading-tight mt-0.5">
                    {m.criterio_nome}
                  </p>
                </div>
                <Badge variant={ganhou ? "success" : "destructive"} className="shrink-0">
                  {ganhou ? "✓ " : "× "}
                  {fmtPct(pctDisplay)}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <Stat
                  label={tipo === "Recomendador" ? "Resultado Rec." : "Efetivo Fiscal"}
                  value={
                    tipo === "Recomendador"
                      ? fmtPct(ef)
                      : tipo === "Cobertura"
                        ? fmtNum(ef)
                        : fmtBRL(ef)
                  }
                />
                <Stat
                  label="Objetivo Meta"
                  value={
                    tipo === "Recomendador"
                      ? "50% (gatilho)"
                      : tipo === "Cobertura"
                        ? fmtNum(meta)
                        : fmtBRL(meta)
                  }
                />
                <Stat label="Efetivo Mês" value={fmtBRL(efMes, { compact: true })} />
                <Stat
                  label="Comissão"
                  value={fmtBRL(com)}
                  highlight={ganhou ? "success" : "destructive"}
                />
              </div>

              <p className="text-sm" style={{ color: cor }}>
                {detalhe}
              </p>

              {!ganhou && gap > 100 && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-md bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
                  <ArrowDownRight className="h-3 w-3" />
                  Gap estimado: {fmtBRL(gap)} de comissão perdida
                </div>
              )}
            </div>
          );
        })}

        {filtradas.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nenhum critério registrado para essa combinação.
          </p>
        )}
      </div>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "success" | "destructive";
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "text-sm font-bold mt-0.5",
          highlight === "success" && "text-success",
          highlight === "destructive" && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 2. BANNER COMPARATIVO AUTOMÁTICO — Mostra delta vs mês anterior
// ═══════════════════════════════════════════════════════════════════════

export function ComparativoBanner({
  atual,
  anterior,
}: {
  atual: PreserExtratoCompleto;
  anterior: PreserExtratoCompleto;
}) {
  const lblAtu = periodoLabel(atual.extrato.periodo.slice(0, 7));
  const lblAnt = periodoLabel(anterior.extrato.periodo.slice(0, 7));

  const comAtu = atual.extrato.valor_total_comissao ?? 0;
  const comAnt = anterior.extrato.valor_total_comissao ?? 0;
  const delta = comAtu - comAnt;
  const pct = comAnt > 0 ? delta / comAnt : 0;
  const positivo = delta >= 0;

  // 3 mudanças mais impactantes nas metas
  const topMudancas = useMemo(() => {
    const keyOf = (m: PreserMeta) =>
      `${m.criterio_codigo ?? "?"}|${m.bu ?? "?"}|${m.tipo ?? "?"}`;
    const idxAnt = new Map(anterior.metas.map((m) => [keyOf(m), m]));
    const mudancas: { label: string; delta: number; tipo: string }[] = [];
    for (const m of atual.metas) {
      const ant = idxAnt.get(keyOf(m));
      if (!ant) continue;
      const d = (m.comissao ?? 0) - (ant.comissao ?? 0);
      if (Math.abs(d) < 500) continue;
      mudancas.push({
        label: `${m.bu} · ${m.tipo}`,
        delta: d,
        tipo: m.tipo ?? "",
      });
    }
    return mudancas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
  }, [atual, anterior]);

  return (
    <div className="mb-5">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-5 shadow-card",
          positivo
            ? "border-success/40 bg-gradient-to-br from-success/15 via-success/5 to-card"
            : "border-destructive/40 bg-gradient-to-br from-destructive/15 via-destructive/5 to-card",
        )}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-2xl",
                positivo ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive",
              )}
            >
              <GitCompare className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {lblAnt} → {lblAtu}
              </p>
              <p className="mt-0.5 text-2xl font-bold leading-tight">
                {positivo ? "+" : ""}
                {fmtBRL(delta, { compact: true })}{" "}
                <span
                  className={cn(
                    "text-base font-medium",
                    positivo ? "text-success" : "text-destructive",
                  )}
                >
                  ({positivo ? "+" : ""}
                  {fmtPct(pct)})
                </span>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Receita {positivo ? "subiu" : "caiu"} vs mês anterior
              </p>
            </div>
          </div>

          {topMudancas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topMudancas.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-xs",
                    m.delta >= 0
                      ? "border-success/30 bg-success/10"
                      : "border-destructive/30 bg-destructive/10",
                  )}
                >
                  <div className="font-semibold">{m.label}</div>
                  <div
                    className={cn(
                      "flex items-center gap-1 font-mono font-bold",
                      m.delta >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {m.delta >= 0 ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {fmtBRL(Math.abs(m.delta), { compact: true })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <Link
            to="/preser/comparativo"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Comparativo completo <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 3. RECOMENDAÇÕES DE SKUs — Quais Estratégicos da BRL1 promover
// ═══════════════════════════════════════════════════════════════════════

export function SkuRecommendations({
  skus,
  metas,
}: {
  skus: PreserSku[];
  metas: PreserMeta[];
}) {
  const recomendacoes = useMemo(() => {
    // 1. Identifica os gaps de VBC (quais BUs estão abaixo da meta)
    const gapsPorDivisao = new Map<string, { faltam: number; bu: string }>();
    for (const m of metas) {
      if (m.tipo !== "VBC" || !m.objetivo_meta || !m.efetivo_fiscal) continue;
      const gap = m.objetivo_meta - m.efetivo_fiscal;
      if (gap <= 0) continue;
      // mapeia BU → divisão de SKU
      const divisao =
        m.bu === "BRL1" && /Linha Seca/i.test(m.criterio_nome ?? "")
          ? "Linha seca"
          : m.bu === "BRL1" && /Garoto/i.test(m.criterio_nome ?? "")
            ? "Garoto"
            : m.bu === "BRN2" || m.bu === "BRN8"
              ? "Professional"
              : null;
      if (!divisao) continue;
      const existente = gapsPorDivisao.get(divisao);
      if (!existente || gap > existente.faltam) {
        gapsPorDivisao.set(divisao, { faltam: gap, bu: m.bu });
      }
    }

    if (gapsPorDivisao.size === 0) return [];

    // 2. Para cada gap, lista os top SKUs Estratégicos (categoria 4) da divisão
    //    que NÃO estão na faixa "alta" — esses são os melhores pra promover
    const out: Array<{
      divisao: string;
      bu: string;
      faltam: number;
      skus: Array<{ nome: string; efetivo: number; comissao: number; potencial: number }>;
    }> = [];

    for (const [divisao, info] of gapsPorDivisao) {
      const candidatos = skus
        .filter((s) => s.divisao === divisao)
        .filter((s) => s.categoria === 4 || s.categoria === 1) // Estratégicos e Mix Pilar
        .filter((s) => (s.efetivo_total ?? 0) > 0)
        .sort((a, b) => (b.efetivo_total ?? 0) - (a.efetivo_total ?? 0))
        .slice(0, 5)
        .map((s) => {
          const efetivo = s.efetivo_total ?? 0;
          const incremento = info.faltam * (efetivo / 1000000); // heurística: proporcional ao tamanho
          const potencial = incremento * (s.pct_comissao ?? 0);
          return {
            nome: s.grupo_nome,
            efetivo,
            comissao: s.comissao ?? 0,
            potencial: Math.max(potencial, 0),
          };
        });

      if (candidatos.length > 0) {
        out.push({
          divisao,
          bu: info.bu,
          faltam: info.faltam,
          skus: candidatos,
        });
      }
    }

    return out;
  }, [skus, metas]);

  if (recomendacoes.length === 0) return null;

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          SKUs sugeridos pra fechar gaps de meta
        </CardTitle>
        <CardDescription>
          Estratégicos e Mix Pilar das BUs que estão abaixo da meta — promover esses tem maior
          impacto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {recomendacoes.map((rec) => (
            <div key={rec.divisao}>
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="warning">{rec.bu}</Badge>
                <span className="text-sm font-medium">{rec.divisao}</span>
                <span className="text-xs text-muted-foreground">
                  · Faltam <strong className="text-destructive">{fmtBRL(rec.faltam, { compact: true })}</strong> pra
                  bater meta
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Rank
                      </th>
                      <th className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        SKU
                      </th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Efetivo atual
                      </th>
                      <th className="px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Comissão atual
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.skus.map((s, i) => (
                      <tr key={s.nome} className="border-b border-border/50 hover:bg-secondary/30">
                        <td className="px-3 py-2 text-xs text-muted-foreground">#{i + 1}</td>
                        <td className="px-3 py-2 max-w-[300px] truncate" title={s.nome}>
                          {s.nome}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground">
                          {fmtBRL(s.efetivo, { compact: true })}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {fmtBRL(s.comissao)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-lg bg-secondary/30 p-3 text-xs text-muted-foreground">
          💡 <strong>Heurística</strong>: SKUs Estratégicos (4%) e Mix Pilar (2,5%) com maior volume
          atual são os mais sensíveis a incremento — pequenas vendas extras se traduzem em
          comissão proporcionalmente maior.
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// 4. MATRIZ ESFORÇO × IMPACTO — Scatter de oportunidades
// ═══════════════════════════════════════════════════════════════════════

interface OportunidadeMatriz {
  nome: string;
  esforco: number; // 1=baixo, 5=alto
  impacto: number; // R$
  categoria: "Quick Win" | "Estratégico" | "Manutenção" | "Pouca Prioridade";
  cor: string;
}

export function EsforcoImpactoMatrix({
  metas,
  drops,
}: {
  metas: PreserMeta[];
  drops: PreserSku[]; // simplificado; na realidade usaria PreserDrops
}) {
  const oportunidades = useMemo<OportunidadeMatriz[]>(() => {
    const out: OportunidadeMatriz[] = [];

    // Recomendadores < 50%
    for (const m of metas) {
      if (m.tipo === "Recomendador" && (m.efetivo_fiscal ?? 0) < 0.5 && (m.comissao ?? 0) === 0) {
        const gap = 0.5 - (m.efetivo_fiscal ?? 0);
        const impacto = (m.pct_meta ?? 0.005) * (m.efetivo_mes ?? 0);
        if (impacto < 100) continue;
        // esforço proporcional ao gap: 0.1 gap = 2, 0.5 gap = 5
        const esforco = Math.min(5, Math.max(1, Math.round(gap * 10)));
        out.push({
          nome: `${m.bu} Rec.`,
          esforco,
          impacto,
          categoria: classificar(esforco, impacto),
          cor: corCategoria(classificar(esforco, impacto)),
        });
      }
    }

    // VBC e Cobertura abaixo
    for (const m of metas) {
      if ((m.tipo !== "VBC" && m.tipo !== "Cobertura") || !m.objetivo_meta) continue;
      const ef = m.efetivo_fiscal ?? 0;
      const meta = m.objetivo_meta;
      if (ef >= meta) continue;
      const pct = ef / meta;
      const impacto = (m.pct_ideal ?? 0.0065) * (m.efetivo_mes ?? 0) - (m.comissao ?? 0);
      if (impacto < 500) continue;
      // esforço inversamente proporcional ao % de atingimento (mais perto da meta = menos esforço)
      const esforco = Math.min(5, Math.max(1, Math.round((1 - pct) * 10)));
      out.push({
        nome: `${m.bu} ${m.tipo}`,
        esforco,
        impacto,
        categoria: classificar(esforco, impacto),
        cor: corCategoria(classificar(esforco, impacto)),
      });
    }

    return out;
  }, [metas]);

  if (oportunidades.length === 0) return null;

  return (
    <Card className="mb-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Matriz Esforço × Impacto
        </CardTitle>
        <CardDescription>
          Priorize pelo quadrante: Quick Wins (canto inferior-direito) → muito ganho, pouco esforço.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 60 }}>
              {/* Quadrantes */}
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis
                type="number"
                dataKey="esforco"
                name="Esforço"
                domain={[0, 6]}
                tick={{ fontSize: 11 }}
                ticks={[1, 2, 3, 4, 5]}
                label={{
                  value: "Esforço (1=fácil, 5=difícil)",
                  position: "bottom",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                }}
              />
              <YAxis
                type="number"
                dataKey="impacto"
                name="Impacto"
                tickFormatter={(v) => fmtBRL(v, { compact: true })}
                tick={{ fontSize: 11 }}
                label={{
                  value: "Impacto (R$)",
                  angle: -90,
                  position: "left",
                  fontSize: 11,
                  fill: "hsl(var(--muted-foreground))",
                  offset: 30,
                }}
              />
              <ZAxis type="number" range={[60, 400]} dataKey="impacto" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => {
                  if (name === "Impacto") return [fmtBRL(value), name];
                  return [value, name];
                }}
                labelFormatter={(_, items) => {
                  const item = items?.[0]?.payload;
                  return item ? `${item.nome} — ${item.categoria}` : "";
                }}
              />
              <Scatter data={oportunidades}>
                {oportunidades.map((o, i) => (
                  <Cell key={i} fill={o.cor} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {/* Legenda dos quadrantes */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
          <QuadrantLegend label="🎯 Quick Win" desc="Fácil + alto impacto" cor="hsl(152 60% 42%)" />
          <QuadrantLegend label="💎 Estratégico" desc="Difícil + alto impacto" cor="hsl(215 80% 48%)" />
          <QuadrantLegend label="🔧 Manutenção" desc="Fácil + baixo impacto" cor="hsl(38 92% 50%)" />
          <QuadrantLegend label="⏸️ Pouca prioridade" desc="Difícil + baixo impacto" cor="hsl(220 10% 50%)" />
        </div>
      </CardContent>
    </Card>
  );
}

function classificar(esforco: number, impacto: number): OportunidadeMatriz["categoria"] {
  const baixoEsforco = esforco <= 2;
  const altoImpacto = impacto >= 10000;
  if (baixoEsforco && altoImpacto) return "Quick Win";
  if (!baixoEsforco && altoImpacto) return "Estratégico";
  if (baixoEsforco && !altoImpacto) return "Manutenção";
  return "Pouca Prioridade";
}

function corCategoria(c: OportunidadeMatriz["categoria"]): string {
  switch (c) {
    case "Quick Win": return "hsl(152 60% 42%)";
    case "Estratégico": return "hsl(215 80% 48%)";
    case "Manutenção": return "hsl(38 92% 50%)";
    case "Pouca Prioridade": return "hsl(220 10% 50%)";
  }
}

function QuadrantLegend({ label, desc, cor }: { label: string; desc: string; cor: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 px-2.5 py-1.5">
      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: cor }} />
      <div className="min-w-0">
        <p className="font-semibold leading-tight">{label}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{desc}</p>
      </div>
    </div>
  );
}
