import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AdminSync from "./pages/AdminSync.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import CategoryPage from "./pages/CategoryPage.tsx";
import AllProducts from "./pages/AllProducts.tsx";
import SearchPage from "./pages/SearchPage.tsx";
import SqueezesPage from "./pages/SqueezesPage.tsx";
import BrindesBaratosPage from "./pages/BrindesBaratosPage.tsx";
import AdminLogin from "./pages/admin/AdminLogin.tsx";
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminProducts from "./pages/admin/AdminProducts.tsx";
import AdminProductEdit from "./pages/admin/AdminProductEdit.tsx";
import AdminCategories from "./pages/AdminCategories.tsx";
import AdminBanners from "./pages/admin/AdminBanners.tsx";
import AdminCategoryImages from "./pages/admin/AdminCategoryImages.tsx";
import AdminVitrine from "./pages/admin/AdminVitrine.tsx";
import AdminCatalogs from "./pages/admin/AdminCatalogs.tsx";
import AdminGuard from "./components/admin/AdminGuard.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
              <Route path="sync" element={<AdminSync />} />
              <Route path="produtos" element={<AdminProducts />} />
              <Route path="produtos/:id" element={<AdminProductEdit />} />
              <Route path="categorias" element={<AdminCategories />} />
              <Route path="banners" element={<AdminBanners />} />
              <Route path="categorias-imagens" element={<AdminCategoryImages />} />
              <Route path="vitrine" element={<AdminVitrine />} />
              <Route path="destaques" element={<div className="text-muted-foreground">Página de Destaques (em breve)</div>} />
            </Route>
            <Route path="/categoria/:slug" element={<CategoryPage />} />
            <Route path="/produto/:slug" element={<ProductDetail />} />
            <Route path="/produtos" element={<AllProducts />} />
            <Route path="/busca" element={<SearchPage />} />
            <Route path="/copos" element={<CategoryPage category="copos" />} />
            <Route path="/garrafas" element={<CategoryPage category="garrafas" />} />
            <Route path="/mochilas" element={<CategoryPage category="mochilas" />} />
            <Route path="/bolsas" element={<CategoryPage category="bolsas" />} />
            <Route path="/escritorio" element={<CategoryPage category="escritorio" />} />
            <Route path="/kits" element={<CategoryPage category="kits" />} />
            <Route path="/squeezes" element={<SqueezesPage />} />
            <Route path="/brindes-baratos" element={<BrindesBaratosPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
