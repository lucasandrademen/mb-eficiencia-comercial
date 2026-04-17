import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload as UploadIcon,
  FileSpreadsheet,
  Download,
  Check,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useData } from "@/contexts/DataContext";
import {
  downloadTemplate,
  mapBaseCarteira,
  mapBaseComercial,
  mapBaseCusto,
  readSheetRows,
} from "@/lib/parseExcel";
import { fmtNum, periodoLabel } from "@/lib/format";

type Kind = "comercial" | "custo" | "carteira";

const labels: Record<Kind, { title: string; desc: string; campos: string[] }> = {
  comercial: {
    title: "Base Comercial",
    desc: "Faturamento, pedidos e ticket médio por vendedor/período.",
    campos: [
      "periodo",
      "vendedor_id",
      "vendedor_nome",
      "supervisor",
      "regiao",
      "faturamento_realizado",
      "clientes_ativos",
      "pedidos",
      "ticket_medio",
    ],
  },
  custo: {
    title: "Base de Custo Resumido",
    desc: "Custo total por vendedor/período (sem separar fixo e variável).",
    campos: ["periodo", "vendedor_id", "vendedor_nome", "custo_total"],
  },
  carteira: {
    title: "Base de Carteira / Clientes",
    desc: "Detalhamento dos clientes da carteira por vendedor.",
    campos: [
      "periodo",
      "vendedor_id",
      "vendedor_nome",
      "cliente_id",
      "cliente_nome",
      "municipio",
      "setor",
      "faturamento_cliente_mes",
      "faturamento_cliente_3m",
      "pedidos_cliente_mes",
      "pedidos_cliente_3m",
      "status_cliente",
    ],
  },
};

export default function Upload() {
  const { dataset, mergeDataset, reset, periodos } = useData();

  const totals = {
    comercial: dataset.comercial.length,
    custo: dataset.custo.length,
    carteira: dataset.carteira.length,
  };

  return (
    <div>
      <PageHeader
        title="Importação de Dados"
        subtitle="Carregue as três bases para alimentar o dashboard. Os dados ficam salvos no seu navegador (localStorage)."
        actions={
          totals.comercial + totals.custo + totals.carteira > 0 ? (
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

      {/* Resumo de bases */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Linhas — Comercial" value={totals.comercial} />
        <SummaryCard label="Linhas — Custo" value={totals.custo} />
        <SummaryCard label="Linhas — Carteira" value={totals.carteira} />
      </div>

      {periodos.length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-card p-3 text-sm">
          <span className="text-muted-foreground">Períodos disponíveis: </span>
          <span className="font-medium">
            {periodos.map((p) => periodoLabel(p)).join(" • ")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FonteUploader
          kind="comercial"
          onParsed={(rows) => mergeDataset({ comercial: rows as any })}
          mapper={mapBaseComercial}
          existing={dataset.comercial}
        />
        <FonteUploader
          kind="custo"
          onParsed={(rows) => mergeDataset({ custo: rows as any })}
          mapper={mapBaseCusto}
          existing={dataset.custo}
        />
        <FonteUploader
          kind="carteira"
          onParsed={(rows) => mergeDataset({ carteira: rows as any })}
          mapper={mapBaseCarteira}
          existing={dataset.carteira}
        />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Como funciona o cruzamento</CardTitle>
          <CardDescription>
            As três bases são unidas pela chave <code className="text-foreground">periodo + vendedor_id</code>.
            Quando o nome do vendedor diverge entre as bases, o sistema prioriza o id e usa o nome
            mais informativo encontrado.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <span className="font-medium text-foreground">Custo:</span> trabalhamos apenas com{" "}
            <code className="text-foreground">custo_total</code> — sem separar fixo e variável.
          </p>
          <p>
            <span className="font-medium text-foreground">Território:</span> a análise de
            municípios e setores é feita pela base de carteira (não pelo município fixo do
            vendedor).
          </p>
          <p>
            <span className="font-medium text-foreground">Aceitamos:</span> arquivos{" "}
            <code className="text-foreground">.xlsx</code>, <code className="text-foreground">.xls</code>{" "}
            e <code className="text-foreground">.csv</code>. Os nomes de coluna são
            normalizados automaticamente (acentos e caixa não importam).
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

function FonteUploader<T>({
  kind,
  mapper,
  onParsed,
  existing,
}: {
  kind: Kind;
  mapper: (rows: Record<string, any>[]) => T[];
  onParsed: (rows: T[]) => void;
  existing: T[];
}) {
  const meta = labels[kind];
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleFile = async (file: File, append: boolean) => {
    setBusy(true);
    setLastError(null);
    try {
      const raw = await readSheetRows(file);
      const parsed = mapper(raw);
      if (parsed.length === 0) {
        setLastError(
          "Nenhuma linha válida encontrada. Verifique se as colunas obrigatórias (periodo, vendedor_id" +
            (kind === "carteira" ? ", cliente_id" : "") +
            ") estão preenchidas.",
        );
        toast.error("Nenhuma linha válida encontrada.");
        return;
      }
      const next = append ? [...existing, ...parsed] : parsed;
      onParsed(next);
      toast.success(`${parsed.length} linha(s) importada(s) — ${meta.title}.`);
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
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f, false);
          }}
        />

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button onClick={() => inputRef.current?.click()} disabled={busy}>
            <UploadIcon className="h-4 w-4" />
            {busy ? "Lendo arquivo…" : existing.length ? "Substituir base" : "Importar planilha"}
          </Button>
          {existing.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                const inp = document.createElement("input");
                inp.type = "file";
                inp.accept = ".xlsx,.xls,.csv";
                inp.onchange = (ev: any) => {
                  const f = ev.target.files?.[0];
                  if (f) handleFile(f, true);
                };
                inp.click();
              }}
              disabled={busy}
            >
              <UploadIcon className="h-4 w-4" /> Adicionar (mesclar)
            </Button>
          )}
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
