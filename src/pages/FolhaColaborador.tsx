import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Coins,
  DollarSign,
  Receipt,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { receitaLiquidaMes } from "@/lib/dro/receita";
import { fmtBRL, fmtNum, fmtPct, periodoLabel } from "@/lib/format";
import { BaseFolha } from "@/lib/types";
import { cn } from "@/lib/utils";

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const encTotal = (e?: { fgts: number; inssEmpresa: number; terceiros: number; rat: number }) =>
  e ? e.fgts + e.inssEmpresa + e.terceiros + e.rat : 0;

export default function FolhaColaborador() {
  const { dataset } = useData();
  const folha = dataset.folha ?? [];

  const periodos = useMemo(
    () => [...new Set(folha.map((f) => f.periodo))].sort(),
    [folha],
  );
  const [mes, setMes] = useState("");
  const mesAtivo = mes && periodos.includes(mes) ? mes : periodos[periodos.length - 1] ?? "";
  const [q, setQ] = useState("");
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [setoresFechados, setSetoresFechados] = useState<Set<string>>(new Set());
  const [totaisAberto, setTotaisAberto] = useState(true);

  const doMes = useMemo(() => folha.filter((f) => f.periodo === mesAtivo), [folha, mesAtivo]);
  const temVerbas = useMemo(() => doMes.some((f) => (f.verbas?.length ?? 0) > 0), [doMes]);
  const temEncargos = useMemo(() => doMes.some((f) => encTotal(f.encargos) > 0), [doMes]);
  const receitaMB = useMemo(() => receitaLiquidaMes(dataset.dro, mesAtivo), [dataset.dro, mesAtivo]);

  const filtrados = useMemo(() => {
    if (!q.trim()) return doMes;
    const n = norm(q);
    return doMes.filter(
      (f) => norm(f.nome).includes(n) || norm(f.cargo || "").includes(n) || f.codigo.includes(q),
    );
  }, [doMes, q]);

  const totais = useMemo(() => {
    const bruto = filtrados.reduce((s, f) => s + f.bruto, 0);
    const liquido = filtrados.reduce((s, f) => s + f.liquido, 0);
    const encargos = filtrados.reduce((s, f) => s + encTotal(f.encargos), 0);
    return {
      bruto,
      liquido,
      encargos,
      custoTotal: bruto + encargos,
      headcount: new Set(filtrados.map((f) => f.codigo)).size,
    };
  }, [filtrados]);

  // Totais da EMPRESA por verba no mês (soma de cada linha entre todos os
  // colaboradores). Agrupa por descrição normalizada (junta variações de caixa,
  // ex.: "Vale transporte" e "Vale Transporte").
  const verbaTotais = useMemo(() => {
    type Acc = { descricao: string; total: number; colab: Set<string> };
    const venc = new Map<string, Acc>();
    const desc = new Map<string, Acc>();
    for (const f of doMes) {
      for (const v of f.verbas ?? []) {
        const m = v.tipo === "vencimento" ? venc : desc;
        const key = norm(v.descricao).replace(/\s+/g, " ").trim();
        if (!m.has(key)) m.set(key, { descricao: v.descricao, total: 0, colab: new Set() });
        const e = m.get(key)!;
        e.total += v.valor;
        e.colab.add(f.codigo);
      }
    }
    const totalVenc = doMes.reduce((s, f) => s + f.bruto, 0);
    const totalDesc = doMes.reduce((s, f) => s + f.descontos, 0);
    const arr = (m: Map<string, Acc>, base: number) =>
      [...m.values()]
        .map((e) => ({
          descricao: e.descricao,
          total: e.total,
          colaboradores: e.colab.size,
          pct: base > 0 ? e.total / base : 0,
        }))
        .sort((a, b) => b.total - a.total);
    const enc = doMes.reduce(
      (a, f) => {
        const e = f.encargos;
        if (e) {
          a.fgts += e.fgts;
          a.inssEmpresa += e.inssEmpresa;
          a.terceiros += e.terceiros;
          a.rat += e.rat;
        }
        return a;
      },
      { fgts: 0, inssEmpresa: 0, terceiros: 0, rat: 0 },
    );
    const encTotalEmpresa = enc.fgts + enc.inssEmpresa + enc.terceiros + enc.rat;
    return {
      vencimentos: arr(venc, totalVenc),
      descontos: arr(desc, totalDesc),
      totalVenc,
      totalDesc,
      totalLiq: doMes.reduce((s, f) => s + f.liquido, 0),
      encargos: enc,
      encTotalEmpresa,
      custoTotal: totalVenc + encTotalEmpresa,
    };
  }, [doMes]);

  // Agrupa por setor (departamento), ordenado por bruto; colaboradores por bruto.
  const setores = useMemo(() => {
    const map = new Map<string, BaseFolha[]>();
    for (const f of filtrados) {
      const key = f.departamento?.trim() || "Sem setor";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return [...map.entries()]
      .map(([setor, pessoas]) => ({
        setor,
        pessoas: pessoas.slice().sort((a, b) => b.bruto - a.bruto),
        bruto: pessoas.reduce((s, p) => s + p.bruto, 0),
        liquido: pessoas.reduce((s, p) => s + p.liquido, 0),
      }))
      .sort((a, b) => b.bruto - a.bruto);
  }, [filtrados]);

  if (folha.length === 0) {
    return (
      <>
        <PageHeader title="Folha por Colaborador" subtitle="O que cada colaborador recebeu no mês." />
        <EmptyState
          title="Nenhuma folha importada"
          description="Importe o PDF da folha de pagamento em Importação para ver o detalhamento."
        />
      </>
    );
  }

  const toggle = (cod: string) =>
    setAbertos((s) => {
      const n = new Set(s);
      n.has(cod) ? n.delete(cod) : n.add(cod);
      return n;
    });
  const toggleSetor = (setor: string) =>
    setSetoresFechados((s) => {
      const n = new Set(s);
      n.has(setor) ? n.delete(setor) : n.add(setor);
      return n;
    });

  return (
    <>
      <PageHeader
        title="Folha por Colaborador"
        subtitle={`MB Logística · ${periodoLabel(mesAtivo)} · ${fmtNum(totais.headcount)} colaboradores · o que cada um recebeu (e custou).`}
        actions={
          <Select value={mesAtivo} onChange={(e) => setMes(e.target.value)} className="w-44">
            {periodos.map((p) => (
              <option key={p} value={p}>
                {periodoLabel(p)}
              </option>
            ))}
          </Select>
        }
      />

      {!temVerbas && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <p className="font-semibold text-warning">Detalhe das verbas indisponível neste mês.</p>
          <p className="mt-0.5 text-muted-foreground">
            A folha deste mês foi importada pela versão antiga (só totais).{" "}
            <Link to="/upload" className="underline hover:text-foreground">
              Reimporte o PDF da folha
            </Link>{" "}
            para ver salário, Preser, reembolsos e descontos de cada colaborador.
          </p>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard title="Bruto do mês" value={fmtBRL(totais.bruto, { compact: true })} subtitle={fmtBRL(totais.bruto)} icon={DollarSign} variant="primary" />
        {temEncargos ? (
          <>
            <MetricCard title="Encargos patronais" value={fmtBRL(totais.encargos, { compact: true })} subtitle={`${fmtPct(totais.bruto > 0 ? totais.encargos / totais.bruto : 0, 0)} do bruto`} icon={Coins} variant="warning" />
            <MetricCard title="Custo total empresa" value={fmtBRL(totais.custoTotal, { compact: true })} subtitle="Bruto + encargos" icon={Receipt} variant="destructive" />
          </>
        ) : (
          <>
            <MetricCard title="Colaboradores" value={fmtNum(totais.headcount)} subtitle={`${fmtNum(setores.length)} setor(es)`} icon={Users} />
            <MetricCard title="Setores" value={fmtNum(setores.length)} subtitle="Departamentos na folha" icon={Building2} />
          </>
        )}
        <MetricCard title="Líquido pago" value={fmtBRL(totais.liquido, { compact: true })} subtitle={fmtBRL(totais.liquido)} icon={Wallet} variant="success" />
      </div>

      {/* ─── Totais da empresa por verba ─────────────────────────────────── */}
      {temVerbas && (
        <Card className="mb-5 overflow-hidden">
          <button
            type="button"
            onClick={() => setTotaisAberto((v) => !v)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/40"
          >
            <span className="flex items-center gap-2 font-semibold">
              {totaisAberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Totais da empresa por verba
              <span className="text-xs font-normal text-muted-foreground">· soma de cada linha no mês</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Bruto <span className="font-semibold text-foreground">{fmtBRL(verbaTotais.totalVenc, { compact: true })}</span>
              {temEncargos && (
                <>
                  {" "}· Custo total{" "}
                  <span className="font-semibold text-destructive">{fmtBRL(verbaTotais.custoTotal, { compact: true })}</span>
                </>
              )}{" "}
              · Líquido <span className="font-semibold text-foreground">{fmtBRL(verbaTotais.totalLiq, { compact: true })}</span>
            </span>
          </button>
          {totaisAberto && (
            <CardContent className="grid grid-cols-1 gap-4 border-t border-border pt-4 md:grid-cols-2">
              <VerbaTotalTabela
                titulo="Vencimentos"
                cor="text-success"
                itens={verbaTotais.vencimentos}
                total={verbaTotais.totalVenc}
                totalLabel="Total de vencimentos"
              />
              <VerbaTotalTabela
                titulo="Descontos"
                cor="text-destructive"
                itens={verbaTotais.descontos}
                total={verbaTotais.totalDesc}
                totalLabel="Total de descontos"
                sinal="−"
              />

              {temEncargos && (
                <div className="md:col-span-2">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning">
                    Encargos patronais (custo da empresa)
                  </p>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                    <EncLinha label="FGTS" valor={verbaTotais.encargos.fgts} />
                    <EncLinha label="INSS Empresa" valor={verbaTotais.encargos.inssEmpresa} />
                    <EncLinha label="Terceiros" valor={verbaTotais.encargos.terceiros} />
                    <EncLinha label="RAT" valor={verbaTotais.encargos.rat} />
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-secondary/50 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-muted-foreground">
                      Bruto {fmtBRL(verbaTotais.totalVenc)} + Encargos {fmtBRL(verbaTotais.encTotalEmpresa)} ({fmtPct(verbaTotais.totalVenc > 0 ? verbaTotais.encTotalEmpresa / verbaTotais.totalVenc : 0, 0)})
                    </span>
                    <span className="text-base font-bold">
                      Custo total da empresa: <span className="text-destructive">{fmtBRL(verbaTotais.custoTotal)}</span>
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar colaborador, cargo ou código…" className="pl-8" />
      </div>

      <div className="space-y-3">
        {setores.map((s) => {
          const aberto = !setoresFechados.has(s.setor);
          return (
            <Card key={s.setor} className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleSetor(s.setor)}
                className="flex w-full items-center justify-between gap-3 bg-secondary/40 px-4 py-3 text-left hover:bg-secondary/60"
              >
                <span className="flex items-center gap-2 font-semibold">
                  {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Building2 className="h-4 w-4 text-primary" />
                  {s.setor}
                  <span className="rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {fmtNum(s.pessoas.length)}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Bruto <span className="font-semibold text-foreground">{fmtBRL(s.bruto, { compact: true })}</span>{" "}
                  · Líquido <span className="font-semibold text-foreground">{fmtBRL(s.liquido, { compact: true })}</span>
                </span>
              </button>

              {aberto && (
                <CardContent className="p-0">
                  <ul className="divide-y divide-border">
                    {s.pessoas.map((p) => (
                      <ColaboradorLinha
                        key={p.codigo}
                        p={p}
                        receitaMB={receitaMB}
                        aberto={abertos.has(p.codigo)}
                        onToggle={() => toggle(p.codigo)}
                      />
                    ))}
                  </ul>
                </CardContent>
              )}
            </Card>
          );
        })}
        {setores.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum colaborador para "{q}".</p>
        )}
      </div>
    </>
  );
}

function ColaboradorLinha({
  p,
  receitaMB,
  aberto,
  onToggle,
}: {
  p: BaseFolha;
  receitaMB: number;
  aberto: boolean;
  onToggle: () => void;
}) {
  const verbas = p.verbas ?? [];
  const vencimentos = verbas.filter((v) => v.tipo === "vencimento");
  const descontos = verbas.filter((v) => v.tipo === "desconto");
  const temDetalhe = verbas.length > 0;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        disabled={!temDetalhe}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
          temDetalhe ? "hover:bg-secondary/40" : "cursor-default",
        )}
      >
        {temDetalhe ? (
          aberto ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-4 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{p.nome}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {[p.cargo, p.centroCusto].filter(Boolean).join(" · ") || "—"}
            {p.tipo && p.tipo !== "EMPREGADO" ? ` · ${p.tipo}` : ""}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-[11px] text-muted-foreground">Bruto {fmtBRL(p.bruto, { compact: true })}</div>
          <div className="font-semibold">{fmtBRL(p.liquido, { compact: true })}</div>
        </div>
      </button>

      {aberto && temDetalhe && (
        <div className="grid grid-cols-1 gap-4 bg-secondary/20 px-4 py-3 md:grid-cols-2">
          <ListaVerbas titulo="Vencimentos" cor="text-success" itens={vencimentos} total={p.bruto} totalLabel="Total vencimentos" />
          <ListaVerbas titulo="Descontos" cor="text-destructive" itens={descontos} total={p.descontos} totalLabel="Total descontos" sinal="−" />
          <div className="md:col-span-2 flex items-center justify-between rounded-lg bg-card px-3 py-2 text-sm ring-1 ring-border">
            <span className="font-semibold">Salário líquido (recebe)</span>
            <span className="text-lg font-bold text-primary">{fmtBRL(p.liquido)}</span>
          </div>
          {p.encargos && encTotal(p.encargos) > 0 && (
            <div className="md:col-span-2 rounded-lg bg-card px-3 py-2.5 text-sm ring-1 ring-border">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-warning">
                Encargos da empresa (sobre este colaborador)
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
                <EncLinha label="FGTS" valor={p.encargos.fgts} />
                <EncLinha label="INSS Empresa" valor={p.encargos.inssEmpresa} />
                <EncLinha label="Terceiros" valor={p.encargos.terceiros} />
                <EncLinha label="RAT" valor={p.encargos.rat} />
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
                <span className="font-semibold">Custo total p/ a empresa (bruto + encargos)</span>
                <span className="text-lg font-bold text-destructive">{fmtBRL(p.bruto + encTotal(p.encargos))}</span>
              </div>
              {receitaMB > 0 && (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Peso sobre a Receita Líquida da MB (DRO)</span>
                  <span className="font-semibold text-primary">
                    {fmtPct((p.bruto + encTotal(p.encargos)) / receitaMB, 2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function EncLinha({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{fmtBRL(valor)}</span>
    </div>
  );
}

function VerbaTotalTabela({
  titulo,
  cor,
  itens,
  total,
  totalLabel,
  sinal = "",
}: {
  titulo: string;
  cor: string;
  itens: { descricao: string; total: number; colaboradores: number; pct: number }[];
  total: number;
  totalLabel: string;
  sinal?: string;
}) {
  return (
    <div>
      <div className={cn("mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider", cor)}>
        <span>{titulo}</span>
        <span className="text-muted-foreground">{itens.length} linha(s)</span>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {itens.map((v) => (
            <tr key={v.descricao} className="border-b border-border/60 last:border-0">
              <td className="py-1.5 pr-2">
                <span className="truncate" title={v.descricao}>{v.descricao}</span>
              </td>
              <td className="py-1.5 px-2 text-right text-[11px] text-muted-foreground whitespace-nowrap">
                {fmtNum(v.colaboradores)} colab · {fmtPct(v.pct, 0)}
              </td>
              <td className="py-1.5 pl-2 text-right font-medium tabular-nums whitespace-nowrap">
                {sinal}
                {fmtBRL(v.total)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-border font-bold">
            <td className="py-2 pr-2">{totalLabel}</td>
            <td />
            <td className="py-2 pl-2 text-right tabular-nums whitespace-nowrap">
              {sinal}
              {fmtBRL(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ListaVerbas({
  titulo,
  cor,
  itens,
  total,
  totalLabel,
  sinal = "",
}: {
  titulo: string;
  cor: string;
  itens: { codigo: string; descricao: string; valor: number }[];
  total: number;
  totalLabel: string;
  sinal?: string;
}) {
  return (
    <div className="rounded-lg bg-card p-3 ring-1 ring-border">
      <p className={cn("mb-2 text-[11px] font-semibold uppercase tracking-wider", cor)}>{titulo}</p>
      {itens.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {itens.map((v, i) => (
            <li key={`${v.codigo}-${i}`} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground" title={v.descricao}>
                {v.descricao}
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {sinal}
                {fmtBRL(v.valor)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
        <span>{totalLabel}</span>
        <span className="tabular-nums">
          {sinal}
          {fmtBRL(total)}
        </span>
      </div>
    </div>
  );
}
