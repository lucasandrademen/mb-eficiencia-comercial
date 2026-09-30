import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { useData } from "@/contexts/DataContext";
import { custoFolha, custoFolhaRecorrente } from "@/lib/calculations";
import type { BaseFolha } from "@/lib/types";
import { fmtBRL, fmtNum, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
type Base = "recorrente" | "total";

const custo = (f: BaseFolha, base: Base) => (base === "total" ? custoFolha(f) : custoFolhaRecorrente(f).recorrente);

function Delta({ a, b, inverso }: { a: number | null; b: number | null; inverso?: boolean }) {
  if (a == null || b == null || !a) return <span className="text-muted-foreground">—</span>;
  const v = (b - a) / Math.abs(a);
  // para custo, subir é ruim (vermelho); para receita, bom
  const bom = inverso ? v <= 0 : v >= 0;
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", bom ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>
      {v >= 0 ? "+" : ""}
      {fmtPct(v)}
    </span>
  );
}

/**
 * Folha do ano selecionado × mesmo mês do ano anterior: pessoas, custo e custo
 * por pessoa, mês a mês e por setor (só meses que existem nos dois anos).
 */
export function FolhaComparativoAnual() {
  const { datasetCompleto, ano } = useData();
  const [base, setBase] = useState<Base>("recorrente");
  const anoAnt = String(parseInt(ano, 10) - 1);

  const d = useMemo(() => {
    const folha = datasetCompleto.folha ?? [];
    const doMes = (p: string) => folha.filter((f) => f.periodo === p);
    const meses = MESES.map((nome, i) => {
      const mm = String(i + 1).padStart(2, "0");
      const a = doMes(`${anoAnt}-${mm}`);
      const b = doMes(`${ano}-${mm}`);
      const tot = (xs: BaseFolha[]) => (xs.length ? xs.reduce((t, f) => t + custo(f, base), 0) : null);
      return { nome, mm, pa: a.length || null, pb: b.length || null, ca: tot(a), cb: tot(b) };
    }).filter((m) => m.pa || m.pb);
    const comuns = meses.filter((m) => m.pa && m.pb).map((m) => m.mm);
    const porSetor = new Map<string, { a: number; b: number; pa: Set<string>; pb: Set<string> }>();
    for (const f of folha) {
      const [y, mm] = f.periodo.split("-");
      if (!comuns.includes(mm) || (y !== ano && y !== anoAnt)) continue;
      const k = (f.departamento || "Sem setor").trim();
      const s = porSetor.get(k) ?? { a: 0, b: 0, pa: new Set(), pb: new Set() };
      if (y === anoAnt) {
        s.a += custo(f, base);
        s.pa.add(`${f.periodo}|${f.codigo}`);
      } else {
        s.b += custo(f, base);
        s.pb.add(`${f.periodo}|${f.codigo}`);
      }
      porSetor.set(k, s);
    }
    const n = comuns.length || 1;
    const setores = [...porSetor.entries()]
      .map(([k, s]) => ({ k, a: s.a, b: s.b, pa: s.pa.size / n, pb: s.pb.size / n }))
      .sort((x, y) => y.b - x.b);
    return { meses, comuns, setores };
  }, [datasetCompleto.folha, ano, anoAnt, base]);

  if (!d.meses.some((m) => m.pa) || !d.meses.some((m) => m.pb)) return null;

  const tA = d.setores.reduce((t, s) => t + s.a, 0);
  const tB = d.setores.reduce((t, s) => t + s.b, 0);
  const pA = d.setores.reduce((t, s) => t + s.pa, 0);
  const pB = d.setores.reduce((t, s) => t + s.pb, 0);
  const rot = d.comuns.map((mm) => MESES[parseInt(mm, 10) - 1]).join(", ");

  return (
    <Card className="mb-6">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">
            Folha {ano} × {anoAnt}
          </CardTitle>
          <CardDescription>
            {base === "recorrente"
              ? "Custo recorrente (bruto + encargos, sem 13º, férias indenizadas, rescisões e retroativos) — compara o custo 'normal' de cada mês."
              : "Custo total do mês (bruto + encargos, com 13º, rescisões e tudo)."}
          </CardDescription>
        </div>
        <div className="flex rounded-lg border border-border bg-background p-0.5 text-xs font-medium">
          {(
            [
              ["recorrente", "Recorrente"],
              ["total", "Total"],
            ] as const
          ).map(([k, t]) => (
            <button key={k} onClick={() => setBase(k)} className={cn("rounded-md px-3 py-1", base === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {t}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-5 p-0 2xl:grid-cols-2">
        <Table className="tabular-nums [&_td]:whitespace-nowrap">
          <THead>
            <Tr>
              <Th>Mês</Th>
              <Th className="text-right">Pessoas {anoAnt}</Th>
              <Th className="text-right">Pessoas {ano}</Th>
              <Th className="text-right">Custo {anoAnt}</Th>
              <Th className="text-right">Custo {ano}</Th>
              <Th className="text-right">Δ custo</Th>
              <Th className="text-right">Por pessoa {ano}</Th>
              <Th className="text-right">Δ por pessoa</Th>
            </Tr>
          </THead>
          <TBody>
            {d.meses.map((m) => (
              <Tr key={m.mm} className={cn(!(m.pa && m.pb) && "text-muted-foreground")}>
                <Td className="font-medium">{m.nome}</Td>
                <Td className="text-right">{fmtNum(m.pa)}</Td>
                <Td className="text-right font-semibold">{fmtNum(m.pb)}</Td>
                <Td className="text-right">{fmtBRL(m.ca, { compact: true })}</Td>
                <Td className="text-right font-semibold">{fmtBRL(m.cb, { compact: true })}</Td>
                <Td className="text-right">
                  <Delta a={m.ca} b={m.cb} inverso />
                </Td>
                <Td className="text-right">{m.cb && m.pb ? fmtBRL(m.cb / m.pb) : "—"}</Td>
                <Td className="text-right">
                  <Delta a={m.ca && m.pa ? m.ca / m.pa : null} b={m.cb && m.pb ? m.cb / m.pb : null} inverso />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>

        <Table className="tabular-nums [&_td]:whitespace-nowrap">
          <THead>
            <Tr>
              <Th>Setor · {rot}</Th>
              <Th className="text-right">Pessoas/mês {anoAnt}</Th>
              <Th className="text-right">{ano}</Th>
              <Th className="text-right">Custo {anoAnt}</Th>
              <Th className="text-right">Custo {ano}</Th>
              <Th className="text-right">Δ</Th>
            </Tr>
          </THead>
          <TBody>
            {d.setores.map((s) => (
              <Tr key={s.k}>
                <Td className="font-medium">{s.k}</Td>
                <Td className="text-right">{fmtNum(s.pa, 1)}</Td>
                <Td className="text-right font-semibold">{fmtNum(s.pb, 1)}</Td>
                <Td className="text-right">{fmtBRL(s.a, { compact: true })}</Td>
                <Td className="text-right font-semibold">{fmtBRL(s.b, { compact: true })}</Td>
                <Td className="text-right">
                  <Delta a={s.a} b={s.b} inverso />
                </Td>
              </Tr>
            ))}
            <Tr className="bg-secondary/60 font-semibold hover:bg-secondary/60">
              <Td>Total</Td>
              <Td className="text-right">{fmtNum(pA, 1)}</Td>
              <Td className="text-right">{fmtNum(pB, 1)}</Td>
              <Td className="text-right">{fmtBRL(tA, { compact: true })}</Td>
              <Td className="text-right">{fmtBRL(tB, { compact: true })}</Td>
              <Td className="text-right">
                <Delta a={tA} b={tB} inverso />
              </Td>
            </Tr>
          </TBody>
        </Table>
      </CardContent>
      <p className="px-5 pb-4 pt-2 text-[11px] text-muted-foreground">
        Por setor: só os meses que existem nos dois anos ({rot}). Meses em cinza não têm par no outro ano. Pessoas/mês = média de colaboradores na folha.
      </p>
    </Card>
  );
}
