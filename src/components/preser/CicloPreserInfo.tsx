import { CalendarRange, FileText, Target } from "lucide-react";
import { cicloPreser } from "@/lib/preser/ciclo";

/** Faixa que deixa claro a que período cada parte do PRESER se refere. */
export function CicloPreserInfo({ periodo, className = "mb-6" }: { periodo: string; className?: string }) {
  const c = cicloPreser(periodo);
  const itens = [
    { icon: FileText, rotulo: "Extrato PRESER", valor: c.mesPreser, nota: "mês da apuração" },
    {
      icon: CalendarRange,
      rotulo: "Faturamento (período fiscal)",
      valor: `${c.fiscalInicio} a ${c.fiscalFim}`,
      nota: "base de vendas, drops e serviços",
    },
    {
      icon: Target,
      rotulo: "Bônus de metas",
      valor: `ref. ${c.mesMetas}`,
      nota: "VBC · Cobertura · Recomendador do mês anterior",
      destaque: true,
    },
  ];

  return (
    <div className={`grid grid-cols-1 gap-2 sm:grid-cols-3 ${className}`}>
      {itens.map(({ icon: Icon, rotulo, valor, nota, destaque }) => (
        <div
          key={rotulo}
          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 ${
            destaque ? "border-warning/40 bg-warning/10" : "border-border bg-card"
          }`}
        >
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${destaque ? "text-warning" : "text-primary"}`} />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{rotulo}</p>
            <p className="text-sm font-bold text-foreground">{valor}</p>
            <p className="text-[11px] text-muted-foreground">{nota}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
