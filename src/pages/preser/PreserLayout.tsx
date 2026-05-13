import { Outlet } from "react-router-dom";
import { PreserDataProvider } from "@/contexts/PreserDataContext";

/** Layout wrapper que provê o PreserDataContext para todas as páginas PRESER. */
export default function PreserLayout() {
  return (
    <PreserDataProvider>
      <Outlet />
    </PreserDataProvider>
  );
}
