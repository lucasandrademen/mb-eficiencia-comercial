import { Inbox } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title = "Nenhum dado importado",
  description = "Importe as bases Vendedor e Carteira para visualizar os indicadores.",
}: { title?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <div className="rounded-full bg-secondary p-4 mb-4">
        <Inbox className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button asChild className="mt-6">
        <Link to="/upload">Ir para importação</Link>
      </Button>
    </div>
  );
}
