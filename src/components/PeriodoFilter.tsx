import { useData } from "@/contexts/DataContext";
import { periodoLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PeriodoFilter() {
  const {
    periodos,
    periodosSelecionados,
    togglePeriodo,
    selectAll,
    selectTrimestre,
    anos,
    ano,
    setAno,
  } = useData();

  if (periodos.length === 0) return null;

  const isAll = periodosSelecionados.length === 0;
  const sel = new Set(periodosSelecionados);

  // quais trimestres existem nos dados
  const trimestresDisponiveis = new Set<string>();
  for (const p of periodos) {
    const m = parseInt(p.split("-")[1], 10);
    if (m <= 3) trimestresDisponiveis.add("Q1");
    else if (m <= 6) trimestresDisponiveis.add("Q2");
    else if (m <= 9) trimestresDisponiveis.add("Q3");
    else trimestresDisponiveis.add("Q4");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {anos.length > 1 && (
        <div className="mr-1 flex rounded-full border border-border bg-card p-0.5">
          {anos.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAno(a)}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
                a === ano ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {a}
            </button>
          ))}
        </div>
      )}
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
        Período
      </span>

      <Chip active={isAll} onClick={selectAll}>
        Ano todo
      </Chip>

      {(["Q1", "Q2", "Q3", "Q4"] as const).map((q) =>
        trimestresDisponiveis.has(q) ? (
          <Chip key={q} variant="outline" onClick={() => selectTrimestre(q)}>
            {q}
          </Chip>
        ) : null,
      )}

      <span className="mx-1 h-4 w-px bg-border" />

      {periodos.map((p) => (
        <Chip
          key={p}
          active={!isAll && sel.has(p)}
          onClick={() => togglePeriodo(p)}
        >
          {periodoLabel(p)}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  children,
  active,
  variant,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  variant?: "outline";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors border",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : variant === "outline"
          ? "bg-transparent border-border text-muted-foreground hover:bg-secondary"
          : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/70",
      )}
    >
      {children}
    </button>
  );
}

/** Seletor de ano (2025 | 2026) para telas que têm a própria lista de meses. */
export function AnoToggle() {
  const { anos, ano, setAno } = useData();
  if (anos.length < 2) return null;
  return (
    <div className="flex rounded-full border border-border bg-card p-0.5">
      {anos.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => setAno(a)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
            a === ano ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
