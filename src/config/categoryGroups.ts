export interface CategoryItem {
  name: string;
  slug: string;
}

export interface CategoryGroup {
  title: string;
  items: CategoryItem[];
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    title: "Copos, Garrafas e Canecas",
    items: [
      { name: "Copos", slug: "copos" },
      { name: "Garrafas Térmicas / Squeezes", slug: "garrafas-termicas" },
      { name: "Garrafas de Inox / Alumínio", slug: "garrafas-inox-aluminio" },
      { name: "Canecas", slug: "canecas" },
    ],
  },
  {
    title: "Mochilas, Bolsas Térmicas e Malas",
    items: [
      { name: "Mochilas e Sacochilas", slug: "mochilas-e-sacochilas" },
      { name: "Bolsas Térmicas", slug: "bolsas" },
      { name: "Malas de Viagem", slug: "malas" },
    ],
  },
  {
    title: "Necessaires, Porta Joias e Kit Manicure",
    items: [
      { name: "Necessaires", slug: "necessaires" },
      { name: "Porta Joias", slug: "porta-joias" },
      { name: "Kit Manicure", slug: "kit-manicure" },
    ],
  },
  {
    title: "Cadernetas, Agendas, Blocos e Canetas",
    items: [
      { name: "Cadernetas", slug: "cadernetas" },
      { name: "Agendas", slug: "agendas" },
      { name: "Blocos de Anotações", slug: "blocos" },
      { name: "Canetas", slug: "canetas" },
    ],
  },
  {
    title: "Chaveiros, Mouse Pad e Kit Executivo",
    items: [
      { name: "Chaveiros", slug: "chaveiros" },
      { name: "Mouse Pad", slug: "mouse-pads" },
      { name: "Kit Executivo", slug: "kit-executivo" },
    ],
  },
  {
    title: "Caixas de Som, Fones e Power Bank",
    items: [
      { name: "Caixas de Som", slug: "caixas-de-som" },
      { name: "Fones de Ouvido", slug: "fones" },
      { name: "Power Banks", slug: "power-banks" },
    ],
  },
  {
    title: "Sacola de Algodão e TNT",
    items: [{ name: "Sacolas de Algodão e TNT", slug: "sacolas" }],
  },
  {
    title: "Kit Churrasco e Kit Vinho",
    items: [
      { name: "Kit Churrasco", slug: "kit-churrasco" },
      { name: "Kit Vinho", slug: "kit-vinho" },
    ],
  },
  {
    title: "Marmitas e Tábuas de Madeira",
    items: [
      { name: "Marmitas", slug: "marmitas" },
      { name: "Tábuas e Petisqueiras", slug: "tabuas-petisqueiras" },
    ],
  },
  {
    title: "Guarda-Chuvas",
    items: [{ name: "Guarda-Chuvas", slug: "guarda-chuvas" }],
  },
];
