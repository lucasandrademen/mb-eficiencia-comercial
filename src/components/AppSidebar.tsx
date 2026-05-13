import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  Trophy,
  Layers,
  Grid3x3,
  AlertTriangle,
  TrendingUp,
  ChevronsLeft,
  ChevronsRight,
  Briefcase,
  Receipt,
  Building2,
  Handshake,
  Package,
  Truck,
  Target,
  Zap,
  GitCompare,
  BarChart3,
  BookOpen,
} from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
};

const nav: NavItem[] = [
  { to: "/", label: "Resumo Executivo", icon: LayoutDashboard, end: true },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/faixas", label: "Faixas de Faturamento", icon: Layers },
  { to: "/matriz", label: "Matriz de Performance", icon: Grid3x3 },
  { to: "/alertas", label: "Alertas e Exceções", icon: AlertTriangle },
  { to: "/evolucao", label: "Evolução Mensal", icon: TrendingUp },
  { to: "/upload", label: "Importação", icon: Upload },
];

const custosNav: NavItem[] = [
  { to: "/custos-setor", label: "Custos por Setor", icon: Building2 },
  { to: "/folha", label: "Folha de Pagamento", icon: Receipt },
];

const preserNav: NavItem[] = [
  { to: "/preser", label: "Dashboard PRESER", icon: Handshake, end: true },
  { to: "/preser/comparativo", label: "Comparativo Mensal", icon: GitCompare },
  { to: "/preser/oportunidades", label: "Oportunidades", icon: Zap },
  { to: "/preser/detalhada", label: "Análise Detalhada", icon: BarChart3 },
  { to: "/preser/sku", label: "Análise por SKU", icon: Package },
  { to: "/preser/canais", label: "Canais / Drops", icon: Truck },
  { to: "/preser/metas", label: "Metas e Gaps", icon: Target },
  { to: "/preser/regras", label: "Regras PRESER", icon: BookOpen },
  { to: "/preser/importar", label: "Importar Extrato", icon: Upload },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`hidden h-screen shrink-0 flex-col gradient-dark border-r border-sidebar-border lg:flex sticky top-0 transition-all duration-200 ${
        collapsed ? "w-[60px]" : "w-60"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2.5 px-3 py-4 ${collapsed ? "justify-center" : ""}`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-elevated shrink-0">
          <Briefcase className="h-4 w-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-xs font-bold text-sidebar-foreground tracking-tight truncate">
              Eficiência Comercial
            </h1>
            <p className="text-[10px] text-sidebar-foreground/50">MB Logística</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-1 overflow-y-auto">
        {nav.map((item) => {
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

        {!collapsed && (
          <div className="px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Custos & Folha
          </div>
        )}
        {collapsed && <div className="my-2 border-t border-sidebar-border" />}

        {custosNav.map((item) => {
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

        {!collapsed && (
          <div className="px-2.5 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            Remuneração Broker
          </div>
        )}
        {collapsed && <div className="my-2 border-t border-sidebar-border" />}

        {preserNav.map((item) => {
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
      </nav>

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
