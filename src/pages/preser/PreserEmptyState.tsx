import { Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function PreserEmptyState({ semExtrato }: { semExtrato?: boolean }) {
  if (semExtrato) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhum extrato PRESER importado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Importe um PDF mensal para começar a ver dashboards e análises.
            </p>
          </div>
          <Button asChild>
            <Link to="/preser/importar">Importar extrato</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  return null;
}
