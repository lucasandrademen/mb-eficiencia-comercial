import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload as UploadIcon,
  FileText,
  Check,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { useData } from "@/contexts/DataContext";
import { parsePreserPdf } from "@/lib/parsePreserPdf";
import { parseFolhaPdf } from "@/lib/parseFolhaPdf";
import { fmtNum, periodoLabel } from "@/lib/format";
import { BaseFolha, BaseVendedor } from "@/lib/types";

function mesesPicker(): string[] {
  const out: string[] = [];
  const hoje = new Date();
  const anoAtual = hoje.getFullYear();
  for (const ano of [anoAtual - 1, anoAtual, anoAtual + 1]) {
    for (let m = 1; m <= 12; m++) {
      out.push(`${ano}-${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

const defaultMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function Upload() {
  const { dataset, mergeDataset, reset, periodos } = useData();

  const totals = {
    vendedor: dataset.vendedor.length,
    folha: dataset.folha.length,
  };

  return (
    <div>
      <PageHeader
        title="Importação de Dados"
        subtitle="Carregue os 2 PDFs do mês: Consolidado Preser (faturamento) e Folha de Pagamento (custo com encargos)."
        actions={
          totals.vendedor + totals.folha > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Limpar todos os dados importados?")) {
                  reset();
                  toast.success("Bases limpas com sucesso.");
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Limpar tudo
            </Button>
          ) : null
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryCard label="Vendedores (Preser)" value={totals.vendedor} />
        <SummaryCard label="Colaboradores (Folha)" value={totals.folha} />
      </div>

      {periodos.length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-card p-3 text-sm">
          <span className="text-muted-foreground">Meses disponíveis: </span>
          <span className="font-medium">
            {periodos.map((p) => periodoLabel(p)).join(" • ")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PreserUploader
          existing={dataset.vendedor}
          onParsed={(rows) => mergeDataset({ vendedor: rows })}
        />
        <FolhaUploader
          existing={dataset.folha}
          onParsed={(rows) => mergeDataset({ folha: rows })}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Como funciona</CardTitle>
          <CardDescription>
            Cada mês tem dois PDFs: o <strong>Consolidado Preser</strong> (traz SETOR, VENDEDOR e
            FATURAMENTO) e a <strong>Folha de Pagamento</strong> (traz o salário bruto). O custo real
            de cada vendedor é calculado como <code className="text-foreground">bruto × 1,6746</code> —
            incluindo encargos patronais (FGTS, INSS, 13º, férias e provisões).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <span className="font-medium text-foreground">Cruzamento:</span> o match entre os dois PDFs
            é feito pelo <strong>código do vendedor</strong> e, se falhar, pelo <strong>nome</strong>
            (tolerante a maiúsculas, acentos e pequenas variações). Vendedores sem match são
            sinalizados na página Resumo.
          </p>
          <p>
            <span className="font-medium text-foreground">Supervisores:</span> identificados
            automaticamente pelo nome (Amadeu, Anderson Santiago, Frank, Lilian, Ricardo, Matheus) —
            aparecem em aba separada na Matriz de Performance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold">{fmtNum(value)}</p>
    </div>
  );
}

function PreserUploader({
  existing,
  onParsed,
}: {
  existing: BaseVendedor[];
  onParsed: (rows: BaseVendedor[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mesSel, setMesSel] = useState<string>(defaultMes());
  const meses = mesesPicker();

  const handleFile = async (file: File) => {
    setBusy(true);
    setLastError(null);
    try {
      const parsed = await parsePreserPdf(file, mesSel);
      if (parsed.length === 0) {
        setLastError(
          "Nenhum vendedor encontrado no PDF. Verifique se o arquivo é o Consolidado Preser.",
        );
        toast.error("Nenhum vendedor encontrado.");
        return;
      }
      // Substitui todas as linhas do período (re-upload do mesmo mês).
      const base = existing.filter((r) => r.periodo !== mesSel);
      onParsed([...base, ...parsed]);
      toast.success(
        `${parsed.length} vendedor(es) importado(s) — Preser (${periodoLabel(mesSel)}).`,
      );
    } catch (e: any) {
      setLastError(e?.message || "Erro ao ler PDF.");
      toast.error("Erro ao ler PDF.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Consolidado Preser (PDF)
            </CardTitle>
            <CardDescription className="mt-1">
              PDF do "Consolidado Preser - Equipe Comercial". Extrai setor, vendedor e faturamento.
            </CardDescription>
          </div>
          {existing.length > 0 && (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" /> {fmtNum(existing.length)} linhas
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            O que é extraído
          </p>
          <div className="flex flex-wrap gap-1">
            {["setor (código)", "vendedor (nome)", "faturamento"].map((c) => (
              <Badge key={c} variant="outline" className="font-mono text-[10px]">
                {c}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Linhas sem setor numérico (FERISTA, PROSPECTOR, totais) são ignoradas.
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mês de referência
          </p>
          <Select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="w-full">
            {meses.map((m) => (
              <option key={m} value={m}>
                {periodoLabel(m)}
              </option>
            ))}
          </Select>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            <UploadIcon className="h-4 w-4" />
            {busy ? "Lendo PDF…" : `Importar Preser ${periodoLabel(mesSel)}`}
          </Button>
        </div>

        {lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{lastError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FolhaUploader({
  existing,
  onParsed,
}: {
  existing: BaseFolha[];
  onParsed: (rows: BaseFolha[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mesSel, setMesSel] = useState<string>(defaultMes());
  const meses = mesesPicker();

  const handleFile = async (file: File) => {
    setBusy(true);
    setLastError(null);
    try {
      const employees = await parseFolhaPdf(file);
      if (employees.length === 0) {
        setLastError("Nenhum funcionário encontrado no PDF. Verifique o formato do arquivo.");
        toast.error("Nenhum funcionário encontrado.");
        return;
      }
      const parsed: BaseFolha[] = employees.map((e) => ({
        periodo: mesSel,
        codigo: e.codigo,
        nome: e.nome,
        cargo: e.cargo,
        departamento: e.departamento,
        bruto: e.bruto,
        descontos: e.descontos,
        liquido: e.liquido,
      }));
      const base = existing.filter((r) => r.periodo !== mesSel);
      onParsed([...base, ...parsed]);
      toast.success(
        `${parsed.length} colaborador(es) importado(s) — Folha (${periodoLabel(mesSel)}).`,
      );
    } catch (e: any) {
      setLastError(e?.message || "Erro ao ler PDF.");
      toast.error("Erro ao ler PDF.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Folha de Pagamento (PDF)
            </CardTitle>
            <CardDescription className="mt-1">
              Traz o salário bruto — o custo real vira <code>bruto × 1,6746</code> (com encargos).
            </CardDescription>
          </div>
          {existing.length > 0 && (
            <Badge variant="success" className="gap-1">
              <Check className="h-3 w-3" /> {fmtNum(existing.length)} colab.
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            O que é extraído
          </p>
          <div className="flex flex-wrap gap-1">
            {["codigo", "nome", "cargo", "departamento", "bruto", "descontos", "liquido"].map((c) => (
              <Badge key={c} variant="outline" className="font-mono text-[10px]">
                {c}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Match com o Preser por código ou nome (tolerante a acentos e variações).
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mês de referência
          </p>
          <Select value={mesSel} onChange={(e) => setMesSel(e.target.value)} className="w-full">
            {meses.map((m) => (
              <option key={m} value={m}>
                {periodoLabel(m)}
              </option>
            ))}
          </Select>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            <UploadIcon className="h-4 w-4" />
            {busy ? "Lendo PDF…" : `Importar folha de ${periodoLabel(mesSel)}`}
          </Button>
        </div>

        {lastError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p>{lastError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
