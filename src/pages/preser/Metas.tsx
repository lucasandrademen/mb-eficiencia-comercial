import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, TrendingUp, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { fmtBRL, fmtPct } from "@/lib/format";
import { getExtratoMaisRecente } from "@/lib/preser/api";
import type { PreserExtratoCompleto, PreserMeta } from "@/lib/preser/types";
import { PreserEmptyState } from "./PreserEmptyState";

const C_OK = "hsl(152 60% 42%)";
const C_WARN = "hsl(38 92% 50%)";
const C_BAD = "hsl(0 72% 55%)";

interface Oportunidade {
  meta: PreserMeta;
  faixaAtual: "abaixo" | "minimo" | "meta" | "ideal";
  pctRealiz: number;
  proximaFaixa: string;
  gap: number;
  ganhoExtra: number;
}

function classificar(meta: PreserMeta): Oportunidade | null {
  const real = meta.efetivo_fiscal ?? 0;
  const min = meta.objetivo_minimo ?? 0;
  const alvo = meta.objetivo_meta ?? 0;
  const ideal = meta.objetivo_ideal ?? 0;

  if (meta.tipo === "Recomendador") {
    const pctRealiz = alvo > 0 ? real / alvo : 0;
    if (real < 0.5) {
      return {
        meta,
        faixaAtual: "abaixo",
        pctRealiz: real,
        proximaFaixa: "Gatilho 50% (recupera comissão inteira)",
        gap: 0.5 - real,
        ganhoExtra: alvo > 0 ? alvo * (meta.pct_meta ?? 0.005) : 0,
      };
    }
    return null; // recomendador batido — sem gap
  }

  const pctRealiz = alvo > 0 ? real / alvo : 0;
  if (real < min) {
    return {
      meta,
      faixaAtual: "abaixo",
      pctRealiz,
      proximaFaixa: "Mínimo",
      gap: min - real,
      ganhoExtra: min * (meta.pct_minimo ?? 0.0035),
    };
  }
  if (real < alvo) {
    return {
      meta,
      faixaAtual: "minimo",
      pctRealiz,
      proximaFaixa: "Meta",
      gap: alvo - real,
      ganhoExtra: alvo * ((meta.pct_meta ?? 0.005) - (meta.pct_minimo ?? 0.0035)),
    };
  }
  if (ideal > 0 && real < ideal) {
    return {
      meta,
      faixaAtual: "meta",
      pctRealiz,
      proximaFaixa: "Ideal",
      gap: ideal - real,
      ganhoExtra: ideal * ((meta.pct_ideal ?? 0.0065) - (meta.pct_meta ?? 0.005)),
    };
  }
  return null; // já no ideal
}

function statusColor(faixa: Oportunidade["faixaAtual"]) {
  return faixa === "ideal" ? C_OK : faixa === "meta" ? C_WARN : C_BAD;
}

function faixaBadgeVariant(faixa: Oportunidade["faixaAtual"]) {
  return faixa === "ideal"
    ? "success"
    : faixa === "meta"
    ? "warning"
    : faixa === "minimo"
    ? "warning"
    : "destructive";
}

export default function PreserMetas() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PreserExtratoCompleto | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await getExtratoMaisRecente());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const oportunidades = useMemo(() => {
    if (!data) return [];
    return data.metas
      .map(classificar)
      .filter((o): o is Oportunidade => o !== null)
      .sort((a, b) => b.ganhoExtra - a.ganhoExtra);
  }, [data]);

  const perdaTotal = useMemo(
    () => oportunidades.reduce((s, o) => s + o.ganhoExtra, 0),
    [oportunidades],
  );

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.metas
      .filter((m) => m.tipo === "VBC" && m.objetivo_meta && (m.objetivo_meta ?? 0) < 999_000_000)
      .map((m) => ({
        label: (m.bu ?? m.criterio_nome ?? "").slice(0, 12),
        pct: Math.round(((m.efetivo_fiscal ?? 0) / (m.objetivo_meta ?? 1)) * 1000) / 10,
        comissao: m.comissao ?? 0,
        meta: m,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [data]);

  const recomendadores = useMemo(
    () => data?.metas.filter((m) => m.tipo === "Recomendador" && (m.objetivo_meta ?? 0) < 1) ?? [],
    [data],
  );

  if (loading) return <PageHeader title="Metas e Gaps" subtitle="Carregando…" />;
  if (!data) {
    return (
      <>
        <PageHeader title="Metas e Gaps" />
        <PreserEmptyState semExtrato />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Metas e Gaps"
        subtitle="Quanto você está deixando na mesa por não bater cada faixa."
      />

      {/* Hero card: perda total */}
      {perdaTotal > 0 ? (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Você está deixando{" "}
              <span className="text-destructive">{fmtBRL(perdaTotal)}</span> na mesa este mês
            </CardTitle>
            <CardDescription>
              Soma do ganho adicional se cada meta abaixo subir à próxima faixa.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <Card className="mb-4 border-success/40 bg-success/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" />
              Todas as metas na faixa Ideal — parabéns!
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Chart atingimento VBC + Cards Recomendador */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>% Atingimento VBC por BU</CardTitle>
            <CardDescription>100% = Meta. Acima = Ideal. Abaixo = Mínimo ou Crítico.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sem metas VBC.</p>
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 4, right: 32, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v}%`}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                    <Tooltip
                      formatter={(v: number, _name, props) => [
                        `${v.toFixed(1)}% — Comissão: ${fmtBRL(props.payload.comissao)}`,
                        "Atingimento",
                      ]}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                    />
                    {/* Linha de 100% como referência */}
                    <Bar dataKey="pct" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {chartData.map((d, i) => (
                        <Cell
                          key={i}
                          fill={d.pct >= 100 ? C_OK : d.pct >= 87 ? C_WARN : C_BAD}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">Recomendadores</p>
          {recomendadores.map((m) => {
            const pct = m.efetivo_fiscal ?? 0;
            const ok = pct >= 0.5;
            return (
              <Card
                key={m.id}
                className={ok ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">{m.bu}</p>
                    <Badge variant={ok ? "success" : "destructive"}>
                      {ok ? "Pago" : "Zerado"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-2xl font-bold">{fmtPct(pct)}</p>
                  <p className="text-xs text-muted-foreground">
                    {ok ? "Acima do gatilho 50%" : "Abaixo do gatilho 50%"}
                  </p>
                  {/* Barra de progresso */}
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(pct * 100 * 2, 100)}%`,
                        background: ok ? C_OK : C_BAD,
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>Gatilho 50%</span>
                    <span>100%</span>
                  </div>
                  <p className="mt-2 text-sm font-medium">
                    {ok ? fmtBRL(m.comissao) : "R$ 0 — perdeu " + fmtBRL((m.efetivo_mes ?? 0) * (m.pct_meta ?? 0.005))}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tabela de oportunidades */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success" />
            Top oportunidades — ordenado por ganho potencial
          </CardTitle>
          <CardDescription>
            Critérios abaixo da faixa máxima. Clique em qualquer linha para detalhar.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>Critério</Th>
                <Th>BU</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Realizado</Th>
                <Th className="text-right">% da Meta</Th>
                <Th>Faixa atual</Th>
                <Th>Próxima faixa</Th>
                <Th className="text-right">Gap</Th>
                <Th className="text-right">Ganho extra</Th>
              </Tr>
            </THead>
            <TBody>
              {oportunidades.map((o) => (
                <Tr key={o.meta.id}>
                  <Td className="max-w-[200px] truncate">{o.meta.criterio_nome ?? "—"}</Td>
                  <Td>{o.meta.bu ?? "—"}</Td>
                  <Td>
                    <Badge variant="outline">{o.meta.tipo}</Badge>
                  </Td>
                  <Td className="text-right">
                    {o.meta.tipo === "Recomendador"
                      ? fmtPct(o.meta.efetivo_fiscal ?? 0)
                      : fmtBRL(o.meta.efetivo_fiscal)}
                  </Td>
                  <Td className="text-right">
                    <span
                      style={{
                        color: statusColor(o.faixaAtual),
                        fontWeight: 600,
                      }}
                    >
                      {fmtPct(o.pctRealiz)}
                    </span>
                  </Td>
                  <Td>
                    <Badge variant={faixaBadgeVariant(o.faixaAtual) as "success" | "warning" | "destructive" | "outline"}>
                      {o.faixaAtual}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-muted-foreground">{o.proximaFaixa}</Td>
                  <Td className="text-right text-muted-foreground">
                    {o.meta.tipo === "Recomendador"
                      ? `${fmtPct(o.gap)} p.p.`
                      : fmtBRL(o.gap)}
                  </Td>
                  <Td className="text-right font-semibold text-success">
                    +{fmtBRL(o.ganhoExtra)}
                  </Td>
                </Tr>
              ))}
              {oportunidades.length === 0 && (
                <Tr>
                  <Td colSpan={9} className="text-center text-sm text-muted-foreground">
                    Todas as metas na faixa Ideal.
                  </Td>
                </Tr>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tabela de metas VBC/Cobertura completa */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Todas as metas — Mínimo / Meta / Ideal</CardTitle>
          <CardDescription>Com objetivos e valores pagos.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead>
              <Tr>
                <Th>Critério</Th>
                <Th>BU</Th>
                <Th className="text-right">Mínimo</Th>
                <Th className="text-right">Meta</Th>
                <Th className="text-right">Ideal</Th>
                <Th className="text-right">Realizado</Th>
                <Th>Progresso</Th>
                <Th className="text-right">Comissão paga</Th>
              </Tr>
            </THead>
            <TBody>
              {data.metas
                .filter((m) => m.tipo !== "Recomendador" && (m.objetivo_meta ?? 0) < 999_000_000)
                .sort((a, b) => (b.comissao ?? 0) - (a.comissao ?? 0))
                .map((m) => {
                  const pct = m.objetivo_meta
                    ? Math.min((m.efetivo_fiscal ?? 0) / m.objetivo_meta, 1.5)
                    : 0;
                  const cor = pct >= 1 ? C_OK : pct >= 0.7 ? C_WARN : C_BAD;
                  return (
                    <Tr key={m.id}>
                      <Td className="max-w-[200px] truncate">{m.criterio_nome ?? "—"}</Td>
                      <Td>{m.bu ?? "—"}</Td>
                      <Td className="text-right text-xs text-muted-foreground">
                        {m.tipo === "Cobertura"
                          ? m.objetivo_minimo?.toLocaleString("pt-BR")
                          : fmtBRL(m.objetivo_minimo, { compact: true })}
                      </Td>
                      <Td className="text-right text-xs">
                        {m.tipo === "Cobertura"
                          ? m.objetivo_meta?.toLocaleString("pt-BR")
                          : fmtBRL(m.objetivo_meta, { compact: true })}
                      </Td>
                      <Td className="text-right text-xs text-muted-foreground">
                        {m.tipo === "Cobertura"
                          ? m.objetivo_ideal?.toLocaleString("pt-BR")
                          : fmtBRL(m.objetivo_ideal, { compact: true })}
                      </Td>
                      <Td className="text-right font-medium">
                        {m.tipo === "Cobertura"
                          ? (m.efetivo_fiscal ?? 0).toLocaleString("pt-BR")
                          : fmtBRL(m.efetivo_fiscal, { compact: true })}
                      </Td>
                      <Td style={{ minWidth: 100 }}>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.min(pct * 100, 100)}%`, background: cor }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {fmtPct(m.pct_realizacao ?? 0)}
                        </span>
                      </Td>
                      <Td className="text-right font-semibold">{fmtBRL(m.comissao)}</Td>
                    </Tr>
                  );
                })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
