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
  <section id="categorias" className="py-12">
    <div className="container">
      <h2 className="text-2xl md:text-3xl text-center text-navy mb-8">Categorias</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cats.map(({ icon: Icon, name, count }) => (
          <button
            key={name}
            className="flex flex-col items-center gap-3 rounded-xl bg-card p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all group"
          >
            <div className="w-16 h-16 rounded-full bg-green-cta/10 flex items-center justify-center group-hover:bg-green-cta/20 transition-colors">
              <Icon size={28} className="text-green-cta" strokeWidth={1.5} />
            </div>
            <span className="font-semibold text-foreground text-sm">{name}</span>
            <span className="text-xs text-text-meta">{count} produtos</span>
          </button>
        ))}
      </div>
    </div>
  </section>
);

export default CategoriesSection;
