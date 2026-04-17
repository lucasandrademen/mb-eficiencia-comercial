export const fmtBRL = (n: number | null | undefined, opts?: { compact?: boolean }) => {
  if (n == null || isNaN(n)) return "—";
  if (opts?.compact) {
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      notation: "compact",
      maximumFractionDigits: 1,
    });
  }
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
};

export const fmtPct = (n: number | null | undefined, digits = 1) => {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits).replace(".", ",")}%`;
};

export const fmtNum = (n: number | null | undefined, digits = 0) => {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
};

export const fmtROI = (n: number | null | undefined) => {
  if (n == null || isNaN(n) || !isFinite(n)) return "—";
  return `${n.toFixed(2).replace(".", ",")}x`;
};

export const PERIODO_LABELS: Record<string, string> = {
  "2026-01": "Janeiro/2026",
  "2026-02": "Fevereiro/2026",
  "2026-03": "Março/2026",
  "2026-04": "Abril/2026",
  "2026-05": "Maio/2026",
  "2026-06": "Junho/2026",
  "2026-07": "Julho/2026",
  "2026-08": "Agosto/2026",
  "2026-09": "Setembro/2026",
  "2026-10": "Outubro/2026",
  "2026-11": "Novembro/2026",
  "2026-12": "Dezembro/2026",
};

export const periodoLabel = (p: string) => {
  if (PERIODO_LABELS[p]) return PERIODO_LABELS[p];
  const [y, m] = p.split("-");
  const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  if (y && m) return `${meses[parseInt(m, 10) - 1]}/${y}`;
  return p;
};

export const periodoToTrimestre = (periodo: string): string => {
  const [, m] = periodo.split("-");
  const month = parseInt(m, 10);
  if (month <= 3) return "Q1";
  if (month <= 6) return "Q2";
  if (month <= 9) return "Q3";
  return "Q4";
};
