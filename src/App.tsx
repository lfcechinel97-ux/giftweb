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
import { SistemaProvider } from "@/contexts/SistemaContext";

/**
 * Importa chunks de rota com tolerância a deploys: se o arquivo com hash antigo
 * sumiu (novo build publicado), tenta de novo e, em último caso, recarrega a
 * página uma única vez para pegar o index atualizado — evita tela em branco.
 */
const lazyRetry = (factory: () => Promise<{ default: React.ComponentType<any> }>) =>
  lazy(() =>
    factory().catch(async (err) => {
      try {
        return await factory();
      } catch {
        const KEY = "chunk_reload_at";
        const last = Number(sessionStorage.getItem(KEY) || 0);
        if (Date.now() - last > 15000) {
          sessionStorage.setItem(KEY, String(Date.now()));
          window.location.reload();
          return new Promise<never>(() => {});
        }
        throw err;
      }
    }),
  );

// Lazy-loaded routes
const AdminSync = lazyRetry(() => import("./pages/AdminSync.tsx"));
const ProductDetail = lazyRetry(() => import("./pages/ProductDetail.tsx"));
const CategoryPage = lazyRetry(() => import("./pages/CategoryPage.tsx"));
const AllProducts = lazyRetry(() => import("./pages/AllProducts.tsx"));
const SearchPage = lazyRetry(() => import("./pages/SearchPage.tsx"));
const AdminLogin = lazyRetry(() => import("./pages/admin/AdminLogin.tsx"));
const AdminLayout = lazyRetry(() => import("./pages/admin/AdminLayout.tsx"));
const AdminProducts = lazyRetry(() => import("./pages/admin/AdminProducts.tsx"));
const AdminProductEdit = lazyRetry(() => import("./pages/admin/AdminProductEdit.tsx"));
const AdminCategories = lazyRetry(() => import("./pages/AdminCategories.tsx"));
const AdminPricing = lazyRetry(() => import("./pages/admin/AdminPricing.tsx"));
const AdminBanners = lazyRetry(() => import("./pages/admin/AdminBanners.tsx"));
const AdminCategoryImages = lazyRetry(() => import("./pages/admin/AdminCategoryImages.tsx"));
const AdminVitrine = lazyRetry(() => import("./pages/admin/AdminVitrine.tsx"));
const AdminCatalogs = lazyRetry(() => import("./pages/admin/AdminCatalogs.tsx"));
const AdminClientes = lazyRetry(() => import("./pages/admin/AdminClientes.tsx"));
const AdminFooter = lazyRetry(() => import("./pages/admin/AdminFooter.tsx"));
const AdminTopProdutos = lazyRetry(() => import("./pages/admin/AdminTopProdutos.tsx"));
const AdminCatalogoClientes = lazyRetry(() => import("./pages/admin/AdminCatalogoClientes.tsx"));
const AdminTopProdutosCategorias = lazyRetry(() => import("./pages/admin/AdminTopProdutosCategorias.tsx"));
const AdminGuard = lazyRetry(() => import("./components/admin/AdminGuard.tsx"));
const PrivacyPage = lazyRetry(() => import("./pages/PrivacyPage.tsx"));
const TermsPage = lazyRetry(() => import("./pages/TermsPage.tsx"));
const SecurityPage = lazyRetry(() => import("./pages/SecurityPage.tsx"));
const TrocasDevolucoesPage = lazyRetry(() => import("./pages/TrocasDevolucoesPage.tsx"));
const WhatsAppPrivacyPage = lazyRetry(() => import("./pages/WhatsAppPrivacyPage.tsx"));
const WhatsAppTermsPage = lazyRetry(() => import("./pages/WhatsAppTermsPage.tsx"));
const DataDeletionPage = lazyRetry(() => import("./pages/DataDeletionPage.tsx"));
const CatalogPage = lazyRetry(() => import("./pages/CatalogPage.tsx"));
const CatalogoClientes = lazyRetry(() => import("./pages/CatalogoClientes.tsx"));
const CatalogProductDetail = lazyRetry(() => import("./pages/CatalogProductDetail.tsx"));
const TopProdutos = lazyRetry(() => import("./pages/TopProdutos.tsx"));
const Top10Produtos = lazyRetry(() => import("./pages/Top10Produtos.tsx"));
const SistemaLayout = lazyRetry(() => import("./pages/sistema/SistemaLayout.tsx"));
const SistemaOrcamentos = lazyRetry(() => import("./pages/sistema/Orcamentos.tsx"));
const SistemaOrcamentoForm = lazyRetry(() => import("./pages/sistema/OrcamentoForm.tsx"));
const SistemaPedidos = lazyRetry(() => import("./pages/sistema/Pedidos.tsx"));
const SistemaPedidoForm = lazyRetry(() => import("./pages/sistema/PedidoForm.tsx"));
const SistemaPCP = lazyRetry(() => import("./pages/sistema/PCP.tsx"));
const SistemaEstoque = lazyRetry(() => import("./pages/sistema/Estoque.tsx"));
const SistemaProdutos = lazyRetry(() => import("./pages/sistema/ProdutosCatalogo.tsx"));
const SistemaClientes = lazyRetry(() => import("./pages/sistema/Clientes.tsx"));
const SistemaConfiguracoes = lazyRetry(() => import("./pages/sistema/Configuracoes.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache: rotas já visitadas servem do cache e revalidam em segundo plano
      staleTime: 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      retry: 1,
      placeholderData: (prev: unknown) => prev,
    },
  },
});

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
                <Route path="topprodutos" element={<AdminTopProdutos />} />
                <Route path="catalogo-clientes" element={<AdminCatalogoClientes />} />
                <Route path="topprodutos/categorias" element={<AdminTopProdutosCategorias />} />
                <Route path="destaques" element={<div className="text-muted-foreground">Página de Destaques (em breve)</div>} />
              </Route>
              <Route path="/categoria/:slug" element={<CategoryPage />} />
              <Route path="/produto/:slug" element={<ProductDetail />} />
              <Route path="/produtos" element={<AllProducts />} />
              <Route path="/catalogo" element={<CatalogPage />} />
              <Route path="/catalogo-clientes" element={<CatalogoClientes />} />
              <Route path="/catalogo/produto/:slug" element={<CatalogProductDetail />} />
              <Route path="/topprodutos" element={<TopProdutos />} />
              <Route path="/top10produtos" element={<Top10Produtos />} />
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
              <Route path="/politica-de-privacidade-whatsapp" element={<WhatsAppPrivacyPage />} />
              <Route path="/termos-de-servico-whatsapp" element={<WhatsAppTermsPage />} />
              <Route path="/exclusao-de-dados" element={<DataDeletionPage />} />
              <Route path="/sistema" element={<AdminGuard><SistemaProvider><SistemaLayout /></SistemaProvider></AdminGuard>}>
                <Route index element={<SistemaOrcamentos />} />
                <Route path="orcamentos" element={<SistemaOrcamentos />} />
                <Route path="orcamentos/novo" element={<SistemaOrcamentoForm />} />
                <Route path="orcamentos/:id" element={<SistemaOrcamentoForm />} />
                <Route path="pedidos" element={<SistemaPedidos />} />
                <Route path="pedidos/:id" element={<SistemaPedidoForm />} />
                <Route path="pcp" element={<SistemaPCP />} />
                <Route path="estoque" element={<SistemaEstoque />} />
                <Route path="produtos" element={<SistemaProdutos />} />
                <Route path="clientes" element={<SistemaClientes />} />
                <Route path="configuracoes" element={<SistemaConfiguracoes />} />
              </Route>
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
