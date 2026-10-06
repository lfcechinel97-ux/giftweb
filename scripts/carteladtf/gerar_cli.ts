/* Gera uma cartela pela linha de comando com o MESMO código da página web
   (para validação contra a referência em Python).
   npx vite-node scripts/carteladtf/gerar_cli.ts -- logo.pdf saida.pdf '{"larguraCm":7,"qtd":30}'
   Várias logos (uma embaixo da outra):
   npx vite-node scripts/carteladtf/gerar_cli.ts -- - saida.pdf '{"itens":[{"logo":"a.pdf","larguraCm":7,"qtd":10},{"logo":"b.pdf","larguraCm":4,"qtd":20}]}' */
import { readFileSync, writeFileSync } from "node:fs";
import { gerarCartela, lerLogo, SPOT_PADRAO, CMYK_PADRAO, DISTANCIA_PADRAO_MM, type OpcoesCartela } from "../../src/lib/cartelaDtf/gerarCartela";
import { CM } from "../../src/lib/cartelaDtf/layout";

const args = process.argv.slice(2).filter((a) => a !== "--");
const [entrada, saida, json] = args;
const cfg = JSON.parse(json || "{}");
const o: OpcoesCartela = {
  espacoCm: 1, folhaMaxCm: 57, margemCm: 0.5, distribuicao: "equilibrada",
  modo: "uv", contrair: false, distanciaMm: DISTANCIA_PADRAO_MM, spot: SPOT_PADRAO, cmyk: CMYK_PADRAO,
  ...cfg,
};
const defs: { logo: string; larguraCm: number; qtd: number }[] =
  cfg.itens ?? [{ logo: entrada, larguraCm: cfg.larguraCm ?? 7, qtd: cfg.qtd ?? 30 }];
try {
  const itens = [];
  for (const d of defs) {
    const bytes = new Uint8Array(readFileSync(d.logo));
    await lerLogo(bytes);
    itens.push({ bytes, larguraCm: d.larguraCm, qtd: d.qtd });
  }
  const c = await gerarCartela(itens, o);
  writeFileSync(saida, c.pdf);
  const L = c.layout;
  const r = (v: number) => +(v / CM).toFixed(2);
  console.log(JSON.stringify({
    nome: c.nome,
    folhaCm: [r(L.larguraFolha), r(L.alturaFolha)],
    itens: L.itens.map((it, i) => ({
      cols: it.cols, linhas: it.linhas, logoCm: [defs[i].larguraCm, r(it.H)],
      posicoes: it.posicoes.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4)]),
    })),
    avisos: c.avisos,
    contracoes: c.contracoes.map((x) => x && { vazio: x.vazio, finas: x.perdeuPartesFinas, area: [x.areaOriginalMm2, x.areaContraidaMm2] }),
  }));
} catch (e) {
  console.log(JSON.stringify({ erro: (e as Error).message }));
}
