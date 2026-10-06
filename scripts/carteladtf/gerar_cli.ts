/* Gera uma cartela pela linha de comando com o MESMO código da página web
   (para validação contra a referência em Python).
   npx vite-node scripts/carteladtf/gerar_cli.ts -- logo.pdf saida.pdf '{"larguraCm":7,"qtd":30}' */
import { readFileSync, writeFileSync } from "node:fs";
import { gerarCartela, lerLogo, SPOT_PADRAO, CMYK_PADRAO, DISTANCIA_PADRAO_MM, type OpcoesCartela } from "../../src/lib/cartelaDtf/gerarCartela";
import { CM } from "../../src/lib/cartelaDtf/layout";

const args = process.argv.slice(2).filter((a) => a !== "--");
const [entrada, saida, json] = args;
const bytes = new Uint8Array(readFileSync(entrada));
const o: OpcoesCartela = {
  larguraCm: 7, qtd: 30, espacoCm: 1, folhaMaxCm: 57, margemCm: 0.5, distribuicao: "equilibrada",
  modo: "uv", contrair: false, distanciaMm: DISTANCIA_PADRAO_MM, spot: SPOT_PADRAO, cmyk: CMYK_PADRAO,
  ...JSON.parse(json || "{}"),
};
try {
  await lerLogo(bytes);
  const c = await gerarCartela(bytes, o);
  writeFileSync(saida, c.pdf);
  const L = c.layout;
  console.log(JSON.stringify({
    nome: c.nome, cols: L.cols, linhas: L.linhas,
    folhaCm: [+(L.larguraFolha / CM).toFixed(2), +(L.alturaFolha / CM).toFixed(2)],
    logoCm: [o.larguraCm, +(L.H / CM).toFixed(2)],
    posicoes: L.posicoes.map((p) => [+p.x.toFixed(4), +p.y.toFixed(4)]),
    avisos: c.avisos,
    contracao: c.contracao && { vazio: c.contracao.vazio, finas: c.contracao.perdeuPartesFinas, area: [c.contracao.areaOriginalMm2, c.contracao.areaContraidaMm2] },
  }));
} catch (e) {
  console.log(JSON.stringify({ erro: (e as Error).message }));
}
