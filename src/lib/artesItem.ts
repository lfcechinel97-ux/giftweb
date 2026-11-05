/** Artes de personalização (logos) anexadas a um item do pedido.
    Itens antigos só têm `arteAnexoUrl` (uma arte); os novos guardam a lista
    em `artesAnexos` e mantêm `arteAnexoUrl` = primeira arte, que é o campo
    que a vw_pcp / OP terceirizada já liam. */
export type ArteAnexo = { url: string; nome: string };

type ComArtes = { arteAnexoUrl?: string; artesAnexos?: ArteAnexo[] };

export const artesDoItem = (item: ComArtes | null | undefined): ArteAnexo[] => {
  if (!item) return [];
  if (Array.isArray(item.artesAnexos) && item.artesAnexos.length > 0) return item.artesAnexos;
  return item.arteAnexoUrl ? [{ url: item.arteAnexoUrl, nome: "Arte de personalização" }] : [];
};

/** Devolve o item com a lista de artes trocada, sincronizando `arteAnexoUrl`. */
export const comArtes = <T extends ComArtes>(item: T, artes: ArteAnexo[]): T => ({
  ...item,
  artesAnexos: artes,
  arteAnexoUrl: artes[0]?.url,
});
