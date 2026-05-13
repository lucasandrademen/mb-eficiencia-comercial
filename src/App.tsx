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
const PreserLayout = lazy(() => import("./pages/preser/PreserLayout"));
const PreserDashboard = lazy(() => import("./pages/preser/Dashboard"));
const PreserImportar = lazy(() => import("./pages/preser/Importar"));
const PreserSku = lazy(() => import("./pages/preser/Sku"));
const PreserCanais = lazy(() => import("./pages/preser/Canais"));
const PreserMetas = lazy(() => import("./pages/preser/Metas"));
const PreserOportunidades = lazy(() => import("./pages/preser/Oportunidades"));
const PreserComparativo = lazy(() => import("./pages/preser/Comparativo"));
const PreserDetalhada = lazy(() => import("./pages/preser/Detalhada"));
const PreserRegras = lazy(() => import("./pages/preser/Regras"));
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
          <Route element={<PreserLayout />}>
            <Route path="/preser" element={<PreserDashboard />} />
            <Route path="/preser/importar" element={<PreserImportar />} />
            <Route path="/preser/sku" element={<PreserSku />} />
            <Route path="/preser/canais" element={<PreserCanais />} />
            <Route path="/preser/metas" element={<PreserMetas />} />
            <Route path="/preser/oportunidades" element={<PreserOportunidades />} />
            <Route path="/preser/comparativo" element={<PreserComparativo />} />
            <Route path="/preser/detalhada" element={<PreserDetalhada />} />
            <Route path="/preser/regras" element={<PreserRegras />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
