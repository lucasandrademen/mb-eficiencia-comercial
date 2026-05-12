import { Database, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabaseConfigured } from "@/lib/preser/supabase";

export function PreserEmptyState({ semExtrato }: { semExtrato?: boolean }) {
  if (!supabaseConfigured) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <Database className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Supabase não configurado</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Defina <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code>{" "}
              e{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>{" "}
              em <code className="rounded bg-muted px-1 py-0.5 text-xs">.env</code> e rode a
              migração{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                supabase/migrations/0001_preser.sql
              </code>
              .
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
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
