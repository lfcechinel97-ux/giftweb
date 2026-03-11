import { GlassWater, Wine, Backpack, Briefcase, PenLine, Gift } from "lucide-react";

const cats = [
  { icon: GlassWater, name: "Copos", count: 42 },
  { icon: Wine, name: "Garrafas", count: 38 },
  { icon: Backpack, name: "Mochilas", count: 24 },
  { icon: Briefcase, name: "Bolsas", count: 31 },
  { icon: PenLine, name: "Escritório", count: 56 },
  { icon: Gift, name: "Kit Corporativo", count: 18 },
];

const CategoriesSection = () => (
  <section id="categorias" className="py-12 bg-surface-alt">
    <div className="container">
      <h2 className="text-center text-foreground mb-8">
        Nossas <span className="text-highlight">Categorias</span>
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cats.map(({ icon: Icon, name, count }) => (
          <button
            key={name}
            className="flex flex-col items-center gap-3 rounded-[16px] bg-card border border-border p-6 transition-all duration-250 group hover:-translate-y-1 hover:border-green-cta"
            style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 8px 40px rgba(0,212,170,0.15)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.4)")}
          >
            <div className="w-16 h-16 rounded-full bg-green-cta/10 flex items-center justify-center group-hover:bg-green-cta/20 transition-colors duration-200">
              <Icon size={28} className="text-green-teal" strokeWidth={1.5} />
            </div>
            <span className="font-semibold text-foreground text-sm">{name}</span>
            <span className="text-xs text-muted-foreground">{count} produtos</span>
          </button>
        ))}
      </div>
    </div>
  </section>
);

export default CategoriesSection;
