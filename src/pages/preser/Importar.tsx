import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Upload,
  CheckCircle,
  AlertCircle,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtBRL, fmtPct, periodoLabel } from "@/lib/format";
import { usePreserData } from "@/contexts/PreserDataContext";
import { supabaseConfigured } from "@/lib/preser/supabase";
import { savePreser, type ParsedPreser } from "@/lib/preser/importar";
import { deletePreserExtrato } from "@/lib/preser/api";
import { parsePreserExtratoPdf } from "@/lib/preser/parseExtratoPdf";
import { PreserEmptyState } from "./PreserEmptyState";

const MESES_CURTOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Step = "idle" | "parsing" | "preview" | "saving" | "done";

export default function PreserImportar() {
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const { extratos, reload } = usePreserData();

  const [step, setStep] = useState<Step>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedPreser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  // mapa "YYYY-MM" → extrato já importado
  const importados = useMemo(() => {
    const m = new Map<string, (typeof extratos)[number]>();
    for (const e of extratos) m.set(e.periodo.slice(0, 7), e);
    return m;
  }, [extratos]);

  // ano exibido no grid de cards (default: ano mais recente importado, ou 2026)
  const anoMaisRecente = useMemo(() => {
    const anos = extratos.map((e) => parseInt(e.periodo.slice(0, 4), 10)).filter(Boolean);
    return anos.length ? Math.max(...anos) : 2026;
  }, [extratos]);
  const [ano, setAno] = useState<number>(anoMaisRecente);

  // mês escolhido no card que está sendo importado ("YYYY-MM")
  const [mesAlvo, setMesAlvo] = useState<string>("");

  // confirmação/execução de exclusão de um mês importado
  const [aExcluir, setAExcluir] = useState<{ id: string; label: string } | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // campos editáveis do extrato
  const [periodo, setPeriodo] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [valorContabilizado, setValorContabilizado] = useState("");

  if (!supabaseConfigured) {
    return (
      <>
        <PageHeader title="Importar extrato PRESER" />
        <PreserEmptyState />
      </>
    );
  }

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Selecione um arquivo PDF.");
      return;
    }
    if (f.size > 12_000_000) {
      toast.error("PDF maior que 12MB.");
      return;
    }
    setFile(f);
    setError(null);
    setStep("parsing");

    try {
      const data = await parsePreserExtratoPdf(f);
      setParsed(data);
      // Se o usuário escolheu um mês pelo card, ele manda; senão usa o que o
      // parser detectou ("YYYY-MM-DD" → "YYYY-MM").
      setPeriodo(mesAlvo || (data.extrato.periodo ?? "").slice(0, 7));
      setValorTotal(String(data.extrato.valor_total_comissao ?? ""));
      setValorContabilizado(String(data.extrato.valor_total_contabilizado ?? ""));
      setStep("preview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep("idle");
    }
  }, [mesAlvo]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  // Clique num card de mês → fixa o mês e abre o seletor de arquivo
  const escolherMes = (mesKey: string) => {
    setMesAlvo(mesKey);
    setError(null);
    inputRef.current?.click();
  };

  // Confirma e executa a exclusão de um mês importado
  const confirmarExclusao = async () => {
    if (!aExcluir) return;
    setExcluindo(true);
    try {
      await deletePreserExtrato(aExcluir.id);
      await reload();
      toast.success(`${aExcluir.label} removido.`);
      setAExcluir(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro ao excluir: ${msg}`);
    } finally {
      setExcluindo(false);
    }
  };

  const onConfirm = async () => {
    if (!parsed) return;
    if (!/^\d{4}-\d{2}$/.test(periodo)) {
      toast.error("Selecione o mês de referência antes de confirmar.");
      return;
    }
    setStep("saving");
    try {
      const patched: ParsedPreser = {
        ...parsed,
        extrato: {
          ...parsed.extrato,
          // grava sempre o primeiro dia do mês escolhido
          periodo: `${periodo}-01`,
          valor_total_comissao: parseFloat(valorTotal) || null,
          valor_total_contabilizado: parseFloat(valorContabilizado) || null,
        },
      };
      await savePreser(patched);
      // atualiza a lista de meses importados (os cards) em segundo plano
      reload().catch(() => {});
      setStep("done");
      toast.success("Extrato PRESER importado com sucesso!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep("preview");
    }
  };

  const reset = () => {
    setStep("idle");
    setFile(null);
    setParsed(null);
    setError(null);
    setMesAlvo("");
    if (inputRef.current) inputRef.current.value = "";
  };

  if (step === "done") {
    return (
      <>
        <PageHeader title="Importar extrato PRESER" />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <CheckCircle className="h-12 w-12 text-success" />
            <div>
              <p className="text-lg font-semibold">Importação concluída!</p>
              <p className="text-sm text-muted-foreground">
                {periodoLabel(periodo)} salvo com sucesso nas 5 tabelas.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => nav("/preser")}>Ver Dashboard</Button>
              <Button variant="outline" onClick={reset}>
                Importar outro
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Importar extrato PRESER"
        subtitle="Upload do PDF mensal enviado pela Nestlé. O parser local extrai os 11 grupos de critérios (sem API externa)."
      />

      {error && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Erro ao processar</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{error}</p>
            </div>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* input de arquivo (compartilhado por todos os cards e pelo drag&drop) */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {/* Grid de cards por mês */}
      {step === "idle" && (
        <div className="space-y-4">
          {/* Resumo + navegação de ano */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAno((a) => a - 1)}
                className="rounded-md border border-border bg-card p-1.5 hover:bg-secondary"
                aria-label="Ano anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-lg font-bold">{ano}</span>
              <button
                onClick={() => setAno((a) => a + 1)}
                className="rounded-md border border-border bg-card p-1.5 hover:bg-secondary"
                aria-label="Próximo ano"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-success/70" /> Importado
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm border border-dashed border-border" />{" "}
                Pendente
              </span>
              <Badge variant="muted">
                {Array.from({ length: 12 }).filter((_, i) =>
                  importados.has(`${ano}-${String(i + 1).padStart(2, "0")}`),
                ).length}
                /12 importados
              </Badge>
            </div>
          </div>

          {/* Cards */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={`grid grid-cols-2 gap-3 rounded-lg sm:grid-cols-3 lg:grid-cols-4 ${
              drag ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
            }`}
          >
            {MESES_CURTOS.map((nome, i) => {
              const mesKey = `${ano}-${String(i + 1).padStart(2, "0")}`;
              const ex = importados.get(mesKey);
              return (
                <MonthCard
                  key={mesKey}
                  nome={nome}
                  ano={ano}
                  comissao={ex?.valor_total_comissao ?? null}
                  importado={Boolean(ex)}
                  onClick={() => escolherMes(mesKey)}
                  onDelete={
                    ex
                      ? () => setAExcluir({ id: ex.id, label: `${nome}/${ano}` })
                      : undefined
                  }
                />
              );
            })}
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Clique no mês para enviar o PDF — ou arraste o arquivo sobre os cards.
            {drag && " Solte para importar."}
          </p>
        </div>
      )}

      {/* Parsing */}
      {step === "parsing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="font-medium">Lendo PDF…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {file?.name} • Extraindo SKUs, drops, metas e critérios
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {step === "preview" && parsed && (
        <div className="space-y-4">
          <Card className="border-success/30 bg-success/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle className="h-4 w-4 text-success" />
                PDF processado — revise antes de confirmar
              </CardTitle>
              <CardDescription>
                {file?.name} · {parsed.skus.length} SKUs · {parsed.drops.length} canais ·{" "}
                {parsed.metas.length} metas · {parsed.outros.length} outros critérios
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Cabeçalho editável */}
          <Card>
            <CardHeader>
              <CardTitle>Cabeçalho do extrato</CardTitle>
              <CardDescription>Corrija campos se o parser errou.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MonthField label="Mês de referência" value={periodo} onChange={setPeriodo} />
              <Field
                label="Receita broker total (R$)"
                value={valorTotal}
                onChange={setValorTotal}
              />
              <Field
                label="Valor contabilizado (R$)"
                value={valorContabilizado}
                onChange={setValorContabilizado}
              />
              <ReadField
                label="Faturamento AC (R$)"
                value={fmtBRL(parsed.extrato.faturamento_ac)}
              />
              <ReadField
                label="IRRF retido"
                value={fmtBRL(parsed.extrato.irrf_retido)}
              />
              <ReadField
                label="PIS + COFINS + CSLL"
                value={fmtBRL(
                  (parsed.extrato.pis_retido ?? 0) +
                    (parsed.extrato.cofins_retido ?? 0) +
                    (parsed.extrato.csll_retido ?? 0),
                )}
              />
            </CardContent>
          </Card>

          {/* Resumo por tabela */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard
              title="Receita Comercial (SKUs)"
              value={fmtBRL(parsed.skus.reduce((s, r) => s + (r.comissao ?? 0), 0))}
              sub={`${parsed.skus.length} produtos`}
            />
            <SummaryCard
              title="Receita Drops"
              value={fmtBRL(parsed.drops.reduce((s, r) => s + (r.comissao ?? 0), 0))}
              sub={`${parsed.drops.length} canais`}
            />
            <SummaryCard
              title="Metas (VBC/Cob./Rec.)"
              value={fmtBRL(parsed.metas.reduce((s, r) => s + (r.comissao ?? 0), 0))}
              sub={`${parsed.metas.length} critérios`}
            />
            <SummaryCard
              title="Outros Critérios"
              value={fmtBRL(parsed.outros.filter((r) => r.contabilizado).reduce((s, r) => s + (r.comissao ?? 0), 0))}
              sub={`${parsed.outros.length} lançamentos`}
            />
          </div>

          {/* Alertas de metas críticas */}
          {parsed.metas.filter(
            (m) => m.tipo === "Recomendador" && (m.efetivo_fiscal ?? 0) < 0.5 && (m.comissao ?? 0) === 0,
          ).length > 0 && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    Recomendador(es) abaixo do gatilho de 50%
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {parsed.metas
                      .filter(
                        (m) =>
                          m.tipo === "Recomendador" &&
                          (m.efetivo_fiscal ?? 0) < 0.5 &&
                          (m.comissao ?? 0) === 0,
                      )
                      .map((m) => (
                        <li key={m.criterio_codigo}>
                          {m.bu} — {fmtPct(m.efetivo_fiscal ?? 0)} atingido (gatilho: 50%) →{" "}
                          comissão zerada
                        </li>
                      ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela SKUs (top 10) */}
          <Card>
            <CardHeader>
              <CardTitle>Top 10 SKUs por comissão</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-secondary/50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SKU</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Categoria</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Comissão</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">%</th>
                  </tr>
                </thead>
                <tbody>
                  {[...parsed.skus]
                    .sort((a, b) => (b.comissao ?? 0) - (a.comissao ?? 0))
                    .slice(0, 10)
                    .map((r, i) => (
                      <tr key={i} className="border-b border-border hover:bg-secondary/30">
                        <td className="max-w-[260px] truncate px-4 py-2">{r.grupo_nome}</td>
                        <td className="px-4 py-2">
                          <Badge variant={
                            r.categoria === 4 ? "default" :
                            r.categoria === 1 ? "success" :
                            r.categoria === 2 ? "warning" : "muted"
                          }>
                            {r.categoria_nome}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{fmtBRL(r.comissao)}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {fmtPct(r.pct_comissao ?? 0, 3)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button onClick={onConfirm} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Confirmar Importação
            </Button>
            <Button variant="outline" onClick={reset} className="gap-2">
              <X className="h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Saving */}
      {step === "saving" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="font-medium">Salvando no Supabase…</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Inserindo nas 5 tabelas. Aguarde.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmação de exclusão */}
      <Dialog
        open={Boolean(aExcluir)}
        onClose={() => !excluindo && setAExcluir(null)}
        title="Excluir mês importado"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm">
              Tem certeza que deseja excluir <strong>{aExcluir?.label}</strong>? Todos os dados
              importados desse mês (SKUs, drops, metas e demais critérios) serão apagados. Esta
              ação não pode ser desfeita.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setAExcluir(null)}
              disabled={excluindo}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarExclusao}
              disabled={excluindo}
              className="gap-2"
            >
              {excluindo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {excluindo ? "Excluindo…" : "Excluir mês"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

function MonthCard({
  nome,
  ano,
  comissao,
  importado,
  onClick,
  onDelete,
}: {
  nome: string;
  ano: number;
  comissao: number | null;
  importado: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={`group relative rounded-lg border transition-all hover:shadow-md ${
        importado
          ? "border-success/40 bg-success/5 hover:border-success"
          : "border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5"
      }`}
    >
      {importado && onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute right-2 top-2 z-10 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100"
          aria-label={`Excluir ${nome}`}
          title="Excluir este mês"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <button
        onClick={onClick}
        className="flex w-full flex-col items-start gap-1 p-4 text-left"
      >
        <div className="flex w-full items-center justify-between pr-6">
          <span className="text-sm font-semibold">{nome}</span>
          <span className="text-[11px] text-muted-foreground">{ano}</span>
        </div>

        {importado ? (
          <>
            <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-success">
              <CheckCircle className="h-3.5 w-3.5" /> Importado
            </span>
            <span className="text-base font-bold">{fmtBRL(comissao, { compact: true })}</span>
            <span className="text-[10px] text-muted-foreground">
              comissão · clique p/ reimportar
            </span>
          </>
        ) : (
          <>
            <span className="mt-1 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              <Plus className="h-3.5 w-3.5" /> Pendente
            </span>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground group-hover:text-primary">
              <Upload className="h-4 w-4" /> Importar PDF
            </span>
          </>
        )}
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}

function MonthField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <input
        type="month"
        lang="pt-BR"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {value && (
        <p className="mt-1 text-[11px] capitalize text-muted-foreground">
          {periodoLabel(value)}
        </p>
      )}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <p className="mt-1 text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
