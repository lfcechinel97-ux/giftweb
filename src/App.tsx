import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useEffect, lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { SiteContentProvider } from "@/contexts/SiteContentContext";
import { QuotationProvider } from "@/contexts/QuotationContext";

// Lazy-loaded routes
const AdminSync = lazy(() => import("./pages/AdminSync.tsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.tsx"));
const CategoryPage = lazy(() => import("./pages/CategoryPage.tsx"));
const AllProducts = lazy(() => import("./pages/AllProducts.tsx"));
const SearchPage = lazy(() => import("./pages/SearchPage.tsx"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin.tsx"));
const AdminLayout = lazy(() => import("./pages/admin/AdminLayout.tsx"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts.tsx"));
const AdminProductEdit = lazy(() => import("./pages/admin/AdminProductEdit.tsx"));
const AdminCategories = lazy(() => import("./pages/AdminCategories.tsx"));
const AdminPricing = lazy(() => import("./pages/admin/AdminPricing.tsx"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners.tsx"));
const AdminCategoryImages = lazy(() => import("./pages/admin/AdminCategoryImages.tsx"));
const AdminVitrine = lazy(() => import("./pages/admin/AdminVitrine.tsx"));
const AdminCatalogs = lazy(() => import("./pages/admin/AdminCatalogs.tsx"));
const AdminClientes = lazy(() => import("./pages/admin/AdminClientes.tsx"));
const AdminFooter = lazy(() => import("./pages/admin/AdminFooter.tsx"));
const AdminGuard = lazy(() => import("./components/admin/AdminGuard.tsx"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage.tsx"));
const TermsPage = lazy(() => import("./pages/TermsPage.tsx"));
const SecurityPage = lazy(() => import("./pages/SecurityPage.tsx"));
const TrocasDevolucoesPage = lazy(() => import("./pages/TrocasDevolucoesPage.tsx"));
const CatalogPage = lazy(() => import("./pages/CatalogPage.tsx"));
const CatalogProductDetail = lazy(() => import("./pages/CatalogProductDetail.tsx"));

const queryClient = new QueryClient();

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const Loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <HelmetProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <QuotationProvider>
        <SiteContentProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin" element={<AdminGuard><AdminLayout /></AdminGuard>}>
                <Route path="sync" element={<AdminSync />} />
                <Route path="produtos" element={<AdminProducts />} />
                <Route path="produtos/:id" element={<AdminProductEdit />} />
                <Route path="categorias" element={<AdminCategories />} />
                <Route path="precificacao" element={<AdminPricing />} />
                <Route path="banners" element={<AdminBanners />} />
                <Route path="categorias-imagens" element={<AdminCategoryImages />} />
                <Route path="vitrine" element={<AdminVitrine />} />
                <Route path="catalogos" element={<AdminCatalogs />} />
                <Route path="clientes" element={<AdminClientes />} />
                <Route path="rodape" element={<AdminFooter />} />
                <Route path="destaques" element={<div className="text-muted-foreground">Página de Destaques (em breve)</div>} />
              </Route>
              <Route path="/categoria/:slug" element={<CategoryPage />} />
              <Route path="/produto/:slug" element={<ProductDetail />} />
              <Route path="/produtos" element={<AllProducts />} />
              <Route path="/catalogo" element={<CatalogPage />} />
              <Route path="/catalogo/produto/:slug" element={<CatalogProductDetail />} />
              <Route path="/busca" element={<SearchPage />} />
              {/* Legacy redirects */}
              <Route path="/garrafas" element={<Navigate to="/categoria/garrafas-e-squeezes" replace />} />
              <Route path="/copos" element={<Navigate to="/categoria/copos-e-canecas" replace />} />
              <Route path="/mochilas" element={<Navigate to="/categoria/mochilas-e-sacochilas" replace />} />
              <Route path="/bolsas" element={<Navigate to="/categoria/bolsas" replace />} />
              <Route path="/escritorio" element={<Navigate to="/categoria/canetas" replace />} />
              <Route path="/kits" element={<Navigate to="/categoria/kits" replace />} />
              <Route path="/squeezes" element={<Navigate to="/categoria/garrafas-e-squeezes" replace />} />
              <Route path="/brindes-baratos" element={<Navigate to="/produtos" replace />} />
              <Route path="/politica-de-privacidade" element={<PrivacyPage />} />
              <Route path="/termos-de-uso" element={<TermsPage />} />
              <Route path="/seguranca" element={<SecurityPage />} />
              <Route path="/politica-de-trocas-e-devolucoes" element={<TrocasDevolucoesPage />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </SiteContentProvider>
        </QuotationProvider>
      </TooltipProvider>
    </HelmetProvider>
  </QueryClientProvider>
);

export default App;
