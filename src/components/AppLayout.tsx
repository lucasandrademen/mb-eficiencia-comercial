import { Outlet, useSearchParams } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Toaster } from "sonner";
import { DataProvider } from "@/contexts/DataContext";

export function AppLayout() {
  const [params] = useSearchParams();
  const embed = params.get("embed") === "1";

  return (
    <DataProvider>
      <div className="flex min-h-screen bg-background">
        {!embed && <AppSidebar />}
        <main className="flex-1 overflow-x-hidden">
          <div className={`mx-auto max-w-[1600px] ${embed ? "px-3 py-3" : "px-4 py-4 lg:px-6 lg:py-5"}`}>
            <Outlet />
          </div>
        </main>
        <Toaster position="top-right" richColors />
      </div>
    </DataProvider>
  );
}
