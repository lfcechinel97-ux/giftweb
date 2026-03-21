interface ProductCardProps {
  name: string;
  color: string;
  price: string;
  badge?: string;
}

const ProductCard = ({ name, color, price, badge }: ProductCardProps) => (
  <div
    className="rounded-[16px] bg-card border border-border overflow-hidden group transition-all duration-200 hover:-translate-y-1 hover:border-green-cta"
    style={{ boxShadow: "0 2px 8px hsl(200 57% 27% / 0.05)" }}
    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 8px 20px hsl(200 57% 27% / 0.10)")}
    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px hsl(200 57% 27% / 0.05)")}
  >
    <div className="relative aspect-square bg-secondary flex items-center justify-center">
      <span className="text-muted-foreground text-sm">Imagem do produto</span>
      {badge && (
        <span className="absolute top-3 left-3 rounded-md bg-green-cta px-2 py-0.5 text-xs font-bold text-primary-foreground uppercase">
          {badge}
        </span>
      )}
    </div>
    <div className="p-4 flex flex-col gap-1.5">
      <h4 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{name}</h4>
      <span className="text-xs text-muted-foreground">Cor: {color}</span>
      <span className="text-green-cta font-bold text-sm">{price}</span>
      <button className="mt-2 w-full rounded-[10px] bg-green-cta text-primary-foreground py-2 text-sm font-bold hover:brightness-110 transition-all duration-200">
        Ver Produto
      </button>
    </div>
  </div>
);

interface ProductSectionProps {
  title: string;
  badge?: string;
}

const products = [
  { name: "Squeeze Plástico 900ml Personalizado", color: "Azul", price: "A partir de R$ 19,90" },
  { name: "Ecobag Algodão Estampada", color: "Natural", price: "A partir de R$ 14,50" },
  { name: "Caderno Capa Dura 100 Folhas", color: "Preto", price: "A partir de R$ 22,00" },
  { name: "Caneca Cerâmica 350ml", color: "Branca", price: "A partir de R$ 12,90" },
];

const ProductsSection = ({ title, badge }: ProductSectionProps) => (
  <section className="py-10">
    <div className="container">
      <h2 className="text-foreground mb-6">
        {title.split(" ").slice(0, -1).join(" ")}{" "}
        <span className="text-highlight">{title.split(" ").slice(-1)}</span>
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map((p, i) => (
          <ProductCard key={i} {...p} badge={badge} />
        ))}
      </div>
    </div>
  </section>
);

export default ProductsSection;
