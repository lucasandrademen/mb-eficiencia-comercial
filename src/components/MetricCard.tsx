import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  variant?: "default" | "primary" | "accent" | "success" | "warning" | "destructive";
}

const variantClasses: Record<string, string> = {
  default: "bg-card border border-border",
  primary: "gradient-primary border-0 text-primary-foreground",
  accent: "bg-card border border-primary/20",
  success: "bg-card border border-success/30",
  warning: "bg-card border border-warning/30",
  destructive: "bg-card border border-destructive/30",
};

const iconClasses: Record<string, string> = {
  default: "bg-secondary text-muted-foreground",
  primary: "bg-primary-foreground/20 text-primary-foreground",
  accent: "bg-primary/10 text-primary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/15 text-destructive",
};

export function MetricCard({ title, value, subtitle, icon: Icon, variant = "default" }: MetricCardProps) {
  const isPrimary = variant === "primary";
  return (
    <div className={cn("rounded-xl p-5 shadow-card transition-all hover:shadow-elevated", variantClasses[variant])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p
            className={cn(
              "text-[11px] font-medium uppercase tracking-wider",
              isPrimary ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "text-2xl font-bold tracking-tight truncate",
              isPrimary ? "text-primary-foreground" : "text-foreground",
            )}
          >
            {value}
          </p>
          {subtitle && (
            <p
              className={cn(
                "text-xs truncate",
                isPrimary ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
        <div className={cn("rounded-lg p-2.5 shrink-0", iconClasses[variant])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
