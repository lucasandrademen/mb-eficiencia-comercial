import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DRO_MESES, type DroLinhas } from "@/lib/dro/logisticaData";
import type { PreserExtrato } from "@/lib/preser/types";
import { fmtBRL, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Linha {
  rotulo: string;
  venda: number | null;
  recebido: number;
  impostos: number;
  custos: number; // custos dos serviços + despesas tributárias + operacionais
  ebitda: number;
  abaixo: number; // financeiro, não operacional, IR/CSLL, não dedutíveis, depreciação (líquido; negativo = saída)
  lucro: number;
}

const soma = (xs: number[], idx: number[]) => idx.reduce((t, i) => t + (xs[i] ?? 0), 0);

function montar(d: DroLinhas, idx: number[], venda: number | null, rotulo: string): Linha {
  const recebido = soma(d.receitaBruta, idx);
  const custos = soma(d.custoServicos, idx) + soma(d.despesasTributarias, idx) + soma(d.despesasOperacionais, idx);
  const ebitda = soma(d.ebitda, idx);
  const lucro = soma(d.resultado, idx);
  return { rotulo, venda, recebido, impostos: soma(d.deducoes, idx), custos, ebitda, abaixo: lucro - ebitda, lucro };
}

/**
 * "Quanto sobrou": do que a MB recebeu (receita bruta do DRO) tira impostos,
 * custos e despesas operacionais (= sobra operacional / EBITDA) e depois
 * financeiro, IR/CSLL e depreciação (= lucro líquido). Mostra o % que sobrou
 * sobre o recebido e sobre a venda (faturamento para a Nestlé, do PRESER).
 */
export function QuantoSobrou({
  d2026,
  d2025,
  meses,
  mesesComuns,
  extratos,
}: {
  d2026: DroLinhas;
  d2025: DroLinhas;
  meses: number[];
  mesesComuns: number[];
  extratos: PreserExtrato[];
}) {
  const venda = (ano: number, i: number) =>
    extratos.find((e) => e.periodo.startsWith(`${ano}-${String(i + 1).padStart(2, "0")}`))?.faturamento_ac ?? null;
  const vendaSoma = (ano: number, idx: number[]) => {
    const v = idx.map((i) => venda(ano, i));
    return v.every((x) => x != null) ? (v as number[]).reduce((a, b) => a + b, 0) : null;
  };

  const linhas = meses.map((i) => montar(d2026, [i], venda(2026, i), DRO_MESES[i]));
  const acum = montar(d2026, meses, vendaSoma(2026, meses), `Acumulado 2026`);
  const comp26 = montar(d2026, mesesComuns, vendaSoma(2026, mesesComuns), "2026 · mesmo período");
  const comp25 = montar(d2025, mesesComuns, vendaSoma(2025, mesesComuns), "2025 · mesmo período");
  const rot = mesesComuns.length ? `${DRO_MESES[mesesComuns[0]]}–${DRO_MESES[mesesComuns[mesesComuns.length - 1]]}` : "";

  const pct = (a: number | null, b: number | null) => (a != null && b ? a / b : null);
  const Neg = ({ v }: { v: number }) => <span className="text-destructive">−{fmtBRL(Math.abs(v), { compact: true })}</span>;

  const Row = ({ l, destaque, comparacao }: { l: Linha; destaque?: boolean; comparacao?: boolean }) => (
    <Tr className={cn(destaque && "bg-secondary/60 font-semibold hover:bg-secondary/60", comparacao && "text-muted-foreground")}>
      <Td className="font-medium">{l.rotulo}</Td>
      <Td className="text-right">{fmtBRL(l.venda, { compact: true })}</Td>
      <Td className="text-right font-semibold text-foreground">{fmtBRL(l.recebido, { compact: true })}</Td>
      <Td className="text-right text-xs">{fmtPct(pct(l.recebido, l.venda), 2)}</Td>
      <Td className="text-right">
        <Neg v={l.impostos} />
      </Td>
      <Td className="text-right">
        <Neg v={l.custos} />
      </Td>
      <Td className="text-right font-semibold">{fmtBRL(l.ebitda, { compact: true })}</Td>
      <Td className="text-right text-xs">{fmtPct(pct(l.ebitda, l.recebido), 1)}</Td>
      <Td className={cn("text-right", l.abaixo < 0 ? "text-destructive" : "text-success")}>
        {l.abaixo < 0 ? "−" : "+"}
        {fmtBRL(Math.abs(l.abaixo), { compact: true })}
      </Td>
      <Td className={cn("text-right font-bold", l.lucro < 0 ? "text-destructive" : "text-foreground")}>{fmtBRL(l.lucro, { compact: true })}</Td>
      <Td className={cn("text-right font-semibold", l.lucro < 0 ? "text-destructive" : "text-success")}>{fmtPct(pct(l.lucro, l.recebido), 1)}</Td>
      <Td className={cn("text-right", l.lucro < 0 ? "text-destructive" : "")}>{fmtPct(pct(l.lucro, l.venda), 2)}</Td>
    </Tr>
  );

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Quanto sobrou: venda × recebido × lucro líquido</CardTitle>
        <CardDescription>
          Do que a MB recebeu (receita bruta do DRO) saem os impostos sobre a receita, os custos e as despesas operacionais — o que resta é a
          sobra operacional. Depois saem financeiro, IR/CSLL e depreciação — o que resta é o lucro líquido.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="tabular-nums [&_td]:whitespace-nowrap">
          <THead>
            <Tr>
              <Th>Mês</Th>
              <Th className="text-right">Venda Nestlé</Th>
              <Th className="text-right">Recebido</Th>
              <Th className="text-right">Receb. ÷ venda</Th>
              <Th className="text-right">Impostos s/ receita</Th>
              <Th className="text-right">Custos + desp. operac.</Th>
              <Th className="text-right">Sobra operac.</Th>
              <Th className="text-right">% s/ receb.</Th>
              <Th className="text-right">Financ., IR, deprec.</Th>
              <Th className="text-right">Lucro líquido</Th>
              <Th className="text-right">% s/ recebido</Th>
              <Th className="text-right">% s/ venda</Th>
            </Tr>
          </THead>
          <TBody>
            {linhas.map((l) => (
              <Row key={l.rotulo} l={l} />
            ))}
            <Row l={acum} destaque />
            {mesesComuns.length > 0 && (
              <>
                <Tr className="hover:bg-transparent">
                  <Td colSpan={12} className="pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Comparação com 2025 · {rot}
                  </Td>
                </Tr>
                <Row l={comp25} comparacao />
                <Row l={comp26} />
                <Tr className="hover:bg-transparent">
                  <Td className="text-xs font-semibold">Diferença</Td>
                  <Td colSpan={6} />
                  <Td className="text-right text-xs font-semibold">{difPP(pct(comp25.ebitda, comp25.recebido), pct(comp26.ebitda, comp26.recebido))}</Td>
                  <Td />
                  <Td className={cn("text-right text-xs font-semibold", comp26.lucro - comp25.lucro < 0 ? "text-destructive" : "text-success")}>
                    {comp26.lucro - comp25.lucro >= 0 ? "+" : "−"}
                    {fmtBRL(Math.abs(comp26.lucro - comp25.lucro), { compact: true })}
                  </Td>
                  <Td className="text-right text-xs font-semibold">{difPP(pct(comp25.lucro, comp25.recebido), pct(comp26.lucro, comp26.recebido))}</Td>
                  <Td className="text-right text-xs font-semibold">{difPP(pct(comp25.lucro, comp25.venda), pct(comp26.lucro, comp26.venda))}</Td>
                </Tr>
              </>
            )}
          </TBody>
        </Table>
        <p className="px-5 py-3 text-[11px] text-muted-foreground">
          Venda = faturamento AC para a Nestlé no PRESER do mês (período fiscal de 20 a 19); recebido e despesas = DRO da MB Logística no mês
          (competência). Por isso "recebido ÷ venda" é próximo, mas não igual, à taxa de comissão do PRESER.
        </p>
      </CardContent>
    </Card>
  );
}

function difPP(a: number | null, b: number | null) {
  if (a == null || b == null) return "—";
  const d = (b - a) * 100;
  return (
    <span className={d >= 0 ? "text-success" : "text-destructive"}>
      {d >= 0 ? "+" : "−"}
      {Math.abs(d).toFixed(2).replace(".", ",")} p.p.
    </span>
  );
}
