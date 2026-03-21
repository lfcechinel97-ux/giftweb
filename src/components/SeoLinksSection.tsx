import { Link } from "react-router-dom";
import { Wine, Coffee, Backpack, Gift, Droplets, ShoppingBag, PenTool, Tag, ArrowRight } from "lucide-react";

const links = [
  { label: "Garrafas Térmicas Personalizadas", href: "/garrafas", icon: Wine },
  { label: "Copos e Canecas Personalizados", href: "/copos", icon: Coffee },
  { label: "Mochilas Personalizadas", href: "/mochilas", icon: Backpack },
  { label: "Kits Corporativos", href: "/kits", icon: Gift },
  { label: "Squeezes Personalizados", href: "/squeezes", icon: Droplets },
  { label: "Bolsas e Sacolas Personalizadas", href: "/bolsas", icon: ShoppingBag },
  { label: "Material de Escritório", href: "/escritorio", icon: PenTool },
  { label: "Brindes Baratos para Empresas", href: "/brindes-baratos", icon: Tag },
];

const SeoLinksSection = () => (
  <section className="py-12" style={{ background: "hsl(222,47%,7%)" }}>
    <div className="container">
      <h2 className="font-extrabold text-[24px] text-white mb-8">
        Categorias <span className="text-highlight italic">populares</span>
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-4 group transition-all duration-200 hover:border-green-cta"
            >
              <Icon className="w-5 h-5 text-white/50 flex-shrink-0" />
              <span className="text-white font-semibold text-[15px] flex-1">{item.label}</span>
              <ArrowRight className="w-4 h-4 text-white/40 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-green-cta flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  </section>
);

export default SeoLinksSection;
