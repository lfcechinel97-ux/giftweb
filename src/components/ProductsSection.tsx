interface ProductCardProps {
  name: string;
  color: string;
  price: string;
  badge?: string;
}

const ProductCard = ({ name, color, price, badge }: ProductCardProps) => (
  <div className="rounded-xl bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
    <div className="relative aspect-square bg-muted flex items-center justify-center">
      <span className="text-text-meta text-sm">Imagem do produto</span>
      {badge && (
        <span className="absolute top-3 left-3 rounded-md bg-green-cta px-2 py-0.5 text-xs font-bold text-accent-foreground uppercase">
          {badge}
        </span>
      )}
    </div>
    <div className="p-4 flex flex-col gap-1.5">
      <h4 className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{name}</h4>
      <span className="text-xs text-text-meta">Cor: {color}</span>
      <span className="text-green-cta font-bold text-sm">{price}</span>
      <button className="mt-2 w-full rounded-lg border-2 border-green-cta text-green-cta py-2 text-sm font-semibold hover:bg-green-cta hover:text-accent-foreground transition-colors">
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
      <h2 className="text-2xl md:text-3xl text-navy mb-6">{title}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {products.map((p, i) => (
          <ProductCard key={i} {...p} badge={badge} />
        ))}
      </div>
    </div>
  </section>
);

export default ProductsSection;
