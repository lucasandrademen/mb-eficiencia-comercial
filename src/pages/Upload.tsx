import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  FileText,
  Download,
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
import {
  downloadTemplate,
  mapBaseCarteira,
  mapBaseVendedor,
  readSheetRows,
} from "@/lib/parseExcel";
import { parseFolhaPdf } from "@/lib/parseFolhaPdf";
import { fmtNum, periodoLabel } from "@/lib/format";
import { BaseCarteira, BaseFolha, BaseVendedor } from "@/lib/types";

type Kind = "vendedor" | "carteira";

const labels: Record<Kind, { title: string; desc: string; campos: string[] }> = {
  vendedor: {
    title: "Base Vendedor",
    desc: "Uma linha por vendedor no mês: faturamento total e custo total.",
    campos: ["periodo*", "vendedor_id", "vendedor_nome", "supervisor", "faturamento", "custo"],
  },
  carteira: {
    title: "Base Carteira",
    desc: "Uma linha por cliente no mês — gera qtd de clientes, cidades e ticket médio.",
    campos: [
      "periodo*",
      "vendedor_id",
      "cliente_id",
      "cliente_nome",
      "cidade",
      "faturamento_cliente",
    ],
  },
};

// gera lista de meses 2025/2026 + ano atual
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

export default function Upload() {
  const { dataset, mergeDataset, reset, periodos } = useData();

  const totals = {
    vendedor: dataset.vendedor.length,
    carteira: dataset.carteira.length,
    folha: dataset.folha.length,
  };

  return (
    <div>
      <PageHeader
        title="Importação de Dados"
        subtitle="Carregue uma planilha por mês. As bases ficam salvas no seu navegador (localStorage)."
        actions={
          totals.vendedor + totals.carteira + totals.folha > 0 ? (
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

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Linhas — Vendedor" value={totals.vendedor} />
        <SummaryCard label="Linhas — Carteira" value={totals.carteira} />
        <SummaryCard label="Linhas — Folha" value={totals.folha} />
      </div>

      {periodos.length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-card p-3 text-sm">
          <span className="text-muted-foreground">Meses disponíveis: </span>
          <span className="font-medium">
            {periodos.map((p) => periodoLabel(p)).join(" • ")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FonteUploader
          kind="vendedor"
          mapper={mapBaseVendedor}
          existing={dataset.vendedor}
          onParsed={(rows) => mergeDataset({ vendedor: rows })}
        />
        <FonteUploader
          kind="carteira"
          mapper={mapBaseCarteira}
          existing={dataset.carteira}
          onParsed={(rows) => mergeDataset({ carteira: rows })}
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
            Cada planilha representa um <strong>mês específico</strong>. Selecione o mês antes de
            importar — se a planilha trouxer a coluna <code className="text-foreground">periodo</code>,
            ela tem prioridade; caso contrário, vale o mês selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <span className="font-medium text-foreground">Cruzamento:</span> as bases são unidas pela
            chave <code className="text-foreground">periodo + vendedor_id</code>. Da carteira saem
            quantidade de clientes, cidades atendidas e ticket médio (faturamento ÷ clientes).
          </p>
          <p>
            <span className="font-medium text-foreground">Cliente sem compra:</span> pode incluir a
            linha com <code className="text-foreground">faturamento_cliente = 0</code> — entra no
            total da carteira do vendedor.
          </p>
          <p>
            <span className="font-medium text-foreground">Aceitamos:</span>{" "}
            <code className="text-foreground">.xlsx</code>, <code className="text-foreground">.xls</code>,{" "}
            <code className="text-foreground">.csv</code> — nomes de coluna são normalizados (acentos
            e caixa não importam).
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

function FonteUploader<T extends BaseVendedor | BaseCarteira>({
  kind,
  mapper,
  onParsed,
  existing,
}: {
  kind: Kind;
  mapper: (rows: Record<string, any>[], defaultPeriodo?: string) => T[];
  onParsed: (rows: T[]) => void;
  existing: T[];
}) {
  const meta = labels[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const meses = mesesPicker();
  const defaultMes = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const [mesSel, setMesSel] = useState<string>(defaultMes);

  const handleFile = async (file: File, append: boolean) => {
    setBusy(true);
    setLastError(null);
    try {
      const raw = await readSheetRows(file);
      const parsed = mapper(raw, mesSel);
      if (parsed.length === 0) {
        setLastError(
          "Nenhuma linha válida encontrada. Verifique se vendedor_id" +
            (kind === "carteira" ? " e cliente_id" : "") +
            " estão preenchidos.",
        );
        toast.error("Nenhuma linha válida encontrada.");
        return;
      }
      // se append: remove linhas existentes do mesmo período antes de mesclar (re-upload do mesmo mês substitui)
      const periodosNovos = new Set(parsed.map((r: any) => r.periodo));
      const base = append ? existing.filter((r: any) => !periodosNovos.has(r.periodo)) : [];
      const next = [...base, ...parsed];
      onParsed(next);
      toast.success(
        `${parsed.length} linha(s) importada(s) — ${meta.title} (${periodoLabel(mesSel)}).`,
      );
    } catch (e: any) {
      setLastError(e?.message || "Erro ao ler arquivo.");
      toast.error("Erro ao ler arquivo.");
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
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              {meta.title}
            </CardTitle>
            <CardDescription className="mt-1">{meta.desc}</CardDescription>
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
            Campos esperados
          </p>
          <div className="flex flex-wrap gap-1">
            {meta.campos.map((c) => (
              <Badge key={c} variant="outline" className="font-mono text-[10px]">
                {c}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            * <code>periodo</code> é opcional na planilha — usa o mês selecionado abaixo se faltar.
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mês de referência
          </p>
          <Select
            value={mesSel}
            onChange={(e) => setMesSel(e.target.value)}
            className="w-full"
          >
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
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f, true);
          }}
        />

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            <UploadIcon className="h-4 w-4" />
            {busy ? "Lendo arquivo…" : `Importar ${periodoLabel(mesSel)}`}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => downloadTemplate(kind)}>
            <Download className="h-4 w-4" /> Baixar modelo .xlsx
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

  const meses = mesesPicker();
  const defaultMes = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  })();
  const [mesSel, setMesSel] = useState<string>(defaultMes);

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
      // substitui o mês importado
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
              Importe o PDF da folha — o custo de cada vendedor é preenchido automaticamente.
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
            Match com vendedor por <code>código</code> ou nome. O <code>bruto</code> vira o custo.
          </p>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mês de referência
          </p>
          <Select
            value={mesSel}
            onChange={(e) => setMesSel(e.target.value)}
            className="w-full"
          >
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
