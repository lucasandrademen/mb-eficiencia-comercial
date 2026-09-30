import { useState } from "react";
import { NavLink } from "react-router-dom";
import { BackupLocal } from "./BackupLocal";
import {
  Gauge,
  LayoutDashboard,
  Upload,
  Trophy,
  Layers,
  Grid3x3,
  AlertTriangle,
  TrendingUp,
  ChevronsLeft,
  ChevronsRight,
  Receipt,
  Building2,
  Handshake,
  Package,
  Truck,
  Target,
  Zap,
  GitCompare,
  Scale,
  Users,
  BarChart3,
  BookOpen,
  CalendarRange,
  Crosshair,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
};

type NavSection = { label: string | null; items: NavItem[] };

const sections: NavSection[] = [
  {
    label: null, // Visão geral — topo, sem rótulo
    items: [
      { to: "/", label: "Painel Operacional", icon: Gauge, end: true },
      { to: "/resumo", label: "Resumo Executivo", icon: LayoutDashboard },
      { to: "/preser-folha", label: "PRESER × Folha", icon: Scale },
    ],
  },
  {
    label: "Equipe Comercial",
    items: [
      { to: "/equipe-gasto", label: "Equipe × Gasto", icon: Users },
      { to: "/ranking", label: "Ranking", icon: Trophy },
      { to: "/faixas", label: "Faixas de Faturamento", icon: Layers },
      { to: "/matriz", label: "Matriz de Performance", icon: Grid3x3 },
      { to: "/alertas", label: "Alertas e Exceções", icon: AlertTriangle },
      { to: "/evolucao", label: "Evolução Mensal", icon: TrendingUp },
    ],
  },
  {
    label: "Custos & Folha",
    items: [
      { to: "/eficiencia-operacional", label: "Eficiência Operacional", icon: Gauge },
      { to: "/custos-setor", label: "Folha por Setor", icon: Building2 },
      { to: "/folha-colaborador", label: "Detalhe por Colaborador", icon: Users },
      { to: "/folha", label: "Folha Detalhada", icon: Receipt },
    ],
  },
  {
    label: "Receita · PRESER",
    items: [
      { to: "/preser", label: "Dashboard PRESER", icon: Handshake, end: true },
      { to: "/preser/comparativo", label: "Comparativo Mensal", icon: GitCompare },
      { to: "/preser/anual", label: "Comparativo 2025 × 2026", icon: CalendarRange },
      { to: "/preser/oportunidades", label: "Oportunidades", icon: Zap },
      { to: "/preser/detalhada", label: "Análise Detalhada", icon: BarChart3 },
      { to: "/preser/sku", label: "Análise por SKU", icon: Package },
      { to: "/preser/canais", label: "Canais / Drops", icon: Truck },
      { to: "/preser/cobertura", label: "Cobertura por Categoria", icon: Crosshair },
      { to: "/preser/metas", label: "Metas e Gaps", icon: Target },
      { to: "/preser/regras", label: "Regras PRESER", icon: BookOpen },
    ],
  },
  {
    label: "Importação",
    items: [
      { to: "/upload", label: "Consolidado + Folha", icon: Upload },
      { to: "/preser/importar", label: "Extrato PRESER", icon: Upload },
    ],
  },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden h-screen shrink-0 flex-col gradient-dark border-r border-sidebar-border lg:flex sticky top-0 transition-all duration-200 ${
        collapsed ? "w-[60px]" : "w-60"
      }`}
    >
      {/* Logomarca MB · padrão MB */}
      <div className={`flex items-center px-3 py-5 ${collapsed ? "justify-center" : ""}`}>
        {collapsed ? (
          <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-xl bg-white shadow-elevated">
            <span className="text-sm font-extrabold leading-none tracking-tight text-sidebar-background">MB</span>
            <span className="mt-0.5 h-[2.5px] w-4 rounded-full bg-accent" />
          </div>
        ) : (
          <div className="min-w-0">
            <img src="/logo-mb.png" alt="MB Logística" className="h-9 w-auto max-w-full object-contain" />
            <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
              Eficiência Comercial
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-1 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={section.label ?? si}>
            {section.label &&
              (!collapsed ? (
                <div className="px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {section.label}
                </div>
              ) : (
                <div className="my-2 border-t border-sidebar-border" />
              ))}
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors ${
                      collapsed ? "justify-center" : ""
                    } ${
                      isActive
                        ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-card"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                    }`
                  }
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="px-2 pb-1">
        <BackupLocal collapsed={collapsed} />
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="mx-2 mb-2 flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
      >
        {collapsed ? (
          <ChevronsRight className="h-3.5 w-3.5" />
        ) : (
          <>
            <ChevronsLeft className="h-3.5 w-3.5" />
            <span>Minimizar</span>
          </>
        )}
      </button>
    </aside>
  );
}
