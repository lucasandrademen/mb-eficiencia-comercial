import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { fmtBRL, fmtPct, periodoLabel } from "@/lib/format";
import { supabaseConfigured } from "@/lib/preser/supabase";
import {
  callParseEdgeFunction,
  savePreser,
  type ParsedPreser,
} from "@/lib/preser/importar";
import { PreserEmptyState } from "./PreserEmptyState";

type Step = "idle" | "parsing" | "preview" | "saving" | "done";

export default function PreserImportar() {
  const nav = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedPreser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

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

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    try {
      const data = await callParseEdgeFunction(f, supabaseUrl, anonKey);
      setParsed(data);
      setPeriodo(data.extrato.periodo ?? "");
      setValorTotal(String(data.extrato.valor_total_comissao ?? ""));
      setValorContabilizado(String(data.extrato.valor_total_contabilizado ?? ""));
      setStep("preview");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setStep("idle");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDrag(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const onConfirm = async () => {
    if (!parsed) return;
    setStep("saving");
    try {
      const patched: ParsedPreser = {
        ...parsed,
        extrato: {
          ...parsed.extrato,
          periodo,
          valor_total_comissao: parseFloat(valorTotal) || null,
          valor_total_contabilizado: parseFloat(valorContabilizado) || null,
        },
      };
      await savePreser(patched);
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
                {periodoLabel(periodo.slice(0, 7))} salvo com sucesso nas 5 tabelas.
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
        subtitle="Upload do PDF mensal enviado pela Nestlé. O parser (Claude AI) extrai os 11 grupos de critérios."
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

      {/* Upload zone */}
      {step === "idle" && (
        <Card
          className={`cursor-pointer border-2 border-dashed transition-colors ${
            drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Arraste o PDF aqui ou clique para selecionar</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Extrato PRESER — Nestlé do Brasil • máx 12MB
              </p>
            </div>
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
          </CardContent>
        </Card>
      )}

      {/* Parsing */}
      {step === "parsing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div>
              <p className="font-medium">Processando com Claude AI…</p>
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
              <Field label="Período (YYYY-MM-DD)" value={periodo} onChange={setPeriodo} />
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
    </>
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
