import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <h1 className="text-5xl font-bold tracking-tight">404</h1>
      <p className="mt-2 text-muted-foreground">Página não encontrada.</p>
      <Button asChild className="mt-6">
        <Link to="/">Voltar ao Resumo</Link>
      </Button>
    </div>
  );
}
