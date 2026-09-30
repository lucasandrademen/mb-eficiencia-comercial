import { useRef, useState } from "react";
import { Download, HardDrive, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { exportarBackup, importarBackup, type BackupFile } from "@/lib/localDb";

const btn =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground disabled:opacity-50";

/** Backup do banco local: baixa/restaura um arquivo .json com todos os dados. */
export function BackupLocal({ collapsed }: { collapsed: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);

  const salvarArquivo = (b: BackupFile, sufixo = "") => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(b)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-eficiencia-comercial-${b.geradoEm.slice(0, 16).replace(/[T:]/g, "-")}${sufixo}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const baixar = async () => {
    setOcupado(true);
    try {
      const b = await exportarBackup();
      salvarArquivo(b);
      toast.success(`Backup salvo (${b.preser.length} meses PRESER${Object.keys(b.kv).length ? " + Folha/DRO" : ""}).`);
    } catch (err) {
      toast.error(`Erro ao gerar backup: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setOcupado(false);
    }
  };

  const restaurar = async (f: File) => {
    let b: BackupFile;
    try {
      b = JSON.parse(await f.text()) as BackupFile;
    } catch {
      toast.error("Arquivo inválido.");
      return;
    }
    const meses = (b.preser ?? []).map((e) => e.extrato.periodo.slice(0, 7)).sort();
    const faixa = meses.length ? `${meses[0]} a ${meses[meses.length - 1]}` : "nenhum mês";
    if (
      !confirm(
        `Este backup tem ${meses.length} mês(es) do PRESER (${faixa})` +
          `${Object.keys(b.kv ?? {}).length ? " e dados de Folha/DRO" : ""}.\n\n` +
          "Os dados dele serão JUNTADOS aos do app: meses iguais são atualizados, os demais continuam. " +
          "Antes, uma cópia do que está no app será baixada. Continuar?",
      )
    )
      return;
    setOcupado(true);
    try {
      // cópia de segurança do estado atual, antes de mexer
      salvarArquivo(await exportarBackup(), "-antes-de-restaurar");
      const r = await importarBackup(b);
      toast.success(`Backup restaurado (${r.meses} meses). Recarregando…`);
      setTimeout(() => location.reload(), 900);
    } catch (err) {
      toast.error(`Erro ao restaurar: ${err instanceof Error ? err.message : String(err)}`);
      setOcupado(false);
    }
  };

  if (collapsed) {
    return (
      <button onClick={baixar} disabled={ocupado} title="Baixar backup dos dados" className={`${btn} justify-center`}>
        <HardDrive className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="border-t border-sidebar-border px-0 pt-2">
      <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
        Dados · só neste computador
      </p>
      <button onClick={baixar} disabled={ocupado} className={btn}>
        <Download className="h-3.5 w-3.5 shrink-0" /> Baixar backup
      </button>
      <button onClick={() => inputRef.current?.click()} disabled={ocupado} className={btn}>
        <UploadCloud className="h-3.5 w-3.5 shrink-0" /> Restaurar backup
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) restaurar(f);
        }}
      />
    </div>
  );
}
