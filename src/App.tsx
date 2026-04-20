import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";

const Resumo = lazy(() => import("./pages/Resumo"));
const UploadPage = lazy(() => import("./pages/Upload"));
const Ranking = lazy(() => import("./pages/Ranking"));
const Faixas = lazy(() => import("./pages/Faixas"));
const Matriz = lazy(() => import("./pages/Matriz"));
const Alertas = lazy(() => import("./pages/Alertas"));
const Evolucao = lazy(() => import("./pages/Evolucao"));
const Folha = lazy(() => import("./pages/Folha"));
const NotFound = lazy(() => import("./pages/NotFound"));

const Fallback = () => (
  <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
    <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Carregando…
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Resumo />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/faixas" element={<Faixas />} />
          <Route path="/matriz" element={<Matriz />} />
          <Route path="/alertas" element={<Alertas />} />
          <Route path="/evolucao" element={<Evolucao />} />
          <Route path="/folha" element={<Folha />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
