/**
 * Estilos do catálogo de clientes.
 *
 * Ficam num <style> proprio (prefixo gwc-) em vez de Tailwind porque essa
 * pagina e uma reproducao 1:1 do catalogo que ja foi validado com o cliente,
 * com tokens e medidas proprios que nao existem no design system do site.
 */

export const WHATSAPP_NUMERO = "5548996652844";

export const ESTILO_CATALOGO = `
.gwc{--navy-800:#07253f;--navy-700:#0b3159;--navy-600:#0f4a80;
  --green-600:#12862f;--green-700:#0d6b25;--green-500:#2fae2e;
  --amber:#B45309;--amber-bg:#FEF3C7;
  --line:#e2e9f1;--ink:#0f2438;--ink-2:#3c5165;--muted:#66798e;
  --r:14px;--h:56px;
  background:#fff;color:var(--ink);min-height:100vh;
  font:400 15px/1.5 'Manrope',system-ui,-apple-system,'Segoe UI',sans-serif}
.gwc *{box-sizing:border-box}
.gwc img{display:block;max-width:100%}
/* :where() zera a especificidade do reset. Sem isso, ".gwc button" (0,1,1)
   sobrescrevia ".gwc-add" (0,1,0) e o botao verde saia transparente. */
.gwc :where(button){font:inherit;cursor:pointer;border:0;background:none;color:inherit}
.gwc h1,.gwc h2,.gwc h3{letter-spacing:-.02em;margin:0}

.gwc-header{position:fixed;top:0;left:0;right:0;z-index:60;background:var(--navy-800);
  padding:0 12px;padding-top:env(safe-area-inset-top);box-shadow:0 2px 10px rgba(4,24,43,.18)}
.gwc-hrow{height:var(--h);display:flex;align-items:center;gap:10px;max-width:1280px;margin:0 auto}
.gwc-brand{display:flex;align-items:center;gap:8px;flex:none}
.gwc-brand img{width:32px;height:32px;border-radius:50%}
.gwc-brand b{color:#fff;font-size:15px;font-weight:800;display:none}
@media(min-width:560px){.gwc-brand b{display:block}}
.gwc-search{flex:1;min-width:0}
.gwc-search input{width:100%;height:38px;border-radius:10px;border:0;padding:0 12px;
  font-size:14px;font-family:inherit;background:#fff;color:var(--ink);outline:0}
.gwc-main{padding-top:calc(var(--h) + env(safe-area-inset-top));max-width:1280px;margin:0 auto}

.gwc-bwrap{margin:10px 12px 0;border-radius:var(--r);overflow:hidden;background:#000c20;
  box-shadow:0 1px 2px rgba(9,36,60,.06),0 4px 14px rgba(9,36,60,.07)}
.gwc-bwrap img{width:100%;height:auto;aspect-ratio:1774/887;object-fit:cover}
@media(min-width:760px){
  .gwc-bwrap{display:flex;align-items:center;justify-content:center}
  .gwc-bwrap img{aspect-ratio:auto;height:clamp(200px,23vw,300px);width:auto;max-width:100%;object-fit:contain}
}
.gwc-cursivo{font-family:'CaveatGW','Segoe Script',cursive;font-size:clamp(21px,4.6vw,27px);
  color:var(--muted);text-align:right;margin:14px 16px 2px;line-height:1;font-weight:500}

.gwc-stwrap{position:relative}
.gwc-stories{display:flex;gap:10px;overflow-x:auto;padding:20px 12px 10px;scrollbar-width:none;
  scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.gwc-stories::-webkit-scrollbar{display:none}
.gwc-st{flex:none;width:98px;text-align:center;scroll-snap-align:center}
.gwc-circ{position:relative;width:86px;height:86px;margin:0 auto 8px}
.gwc-circ::before{content:'';position:absolute;inset:0;border-radius:50%;background:#eef2f7;
  transition:background .2s,transform .2s,box-shadow .2s}
.gwc-st:active .gwc-circ::before{transform:scale(.94)}
.gwc-circ img{position:absolute;left:50%;top:50%;transform:translate(-50%,-56%);
  width:138%;height:138%;object-fit:contain;filter:drop-shadow(0 5px 10px rgba(9,36,60,.18))}
.gwc-st span{font-size:11.5px;line-height:1.3;color:var(--ink);font-weight:600;display:block}
.gwc-st.on .gwc-circ::before{background:#dbe7f5;box-shadow:0 0 0 2.5px var(--green-500)}
.gwc-stfade{position:absolute;top:0;bottom:0;right:0;width:34px;pointer-events:none;
  background:linear-gradient(90deg,rgba(255,255,255,0),#fff)}

.gwc-filtro{display:flex;align-items:center;gap:9px;margin:4px 12px 0;padding:9px 12px;
  background:#eef2f7;border-radius:10px;font-size:13px;color:var(--navy-800);font-weight:600}
.gwc-filtro button{margin-left:auto;color:var(--navy-600);font-size:12px;font-weight:700}

.gwc section{margin:20px 0 0}
/* Barra verde antes do titulo: da ritmo a rolagem e marca onde comeca cada
   secao sem precisar de linha divisoria. */
.gwc-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:0 12px 11px}
.gwc-head h2{font-size:clamp(16px,3.7vw,20px);font-weight:800;color:var(--navy-800);
  display:flex;align-items:center;gap:9px}
.gwc-head h2::before{content:'';width:4px;height:1em;border-radius:2px;background:var(--green-500);
  flex:none}
.gwc-head span{font-size:12px;color:var(--muted);white-space:nowrap}

.gwc-carowrap{position:relative}
.gwc-caro{display:flex;gap:11px;overflow-x:auto;padding:2px 12px 8px;
  scroll-snap-type:x mandatory;scrollbar-width:none}
.gwc-caro::-webkit-scrollbar{display:none}
.gwc-caro .gwc-card{flex:0 0 68%;scroll-snap-align:start}
@media(min-width:560px){.gwc-caro .gwc-card{flex-basis:33%}}
@media(min-width:900px){.gwc-caro .gwc-card{flex-basis:24%}}
.gwc-caroarrow{position:absolute;top:34%;width:36px;height:36px;border-radius:50%;background:#fff;
  color:var(--navy-700);display:none;place-items:center;z-index:5;font-size:22px;line-height:1;
  box-shadow:0 1px 2px rgba(9,36,60,.06),0 4px 14px rgba(9,36,60,.12)}
.gwc-caroarrow.l{left:4px}.gwc-caroarrow.r{right:4px}
@media(min-width:900px){.gwc-caroarrow{display:grid}}

.gwc-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:11px;padding:0 12px}
@media(min-width:640px){.gwc-grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:900px){.gwc-grid{grid-template-columns:repeat(4,1fr)}}
@media(min-width:1120px){.gwc-grid{grid-template-columns:repeat(5,1fr)}}

/* Card como objeto tocavel: sombra suave em vez de borda chapada, e leve
   elevacao no hover. Cartao chapado em fundo branco some da tela. */
.gwc-card{background:#fff;border:1px solid #edf1f6;border-radius:var(--r);overflow:hidden;
  display:flex;flex-direction:column;position:relative;
  box-shadow:0 1px 2px rgba(9,36,60,.05),0 3px 10px rgba(9,36,60,.05);
  transition:box-shadow .18s,transform .18s}
@media(hover:hover){
  .gwc-card:hover{box-shadow:0 2px 6px rgba(9,36,60,.08),0 10px 24px rgba(9,36,60,.10);
    transform:translateY(-2px)}
}
/* fundo levissimo na foto pra produto branco nao sumir no card branco */
.gwc-ph{position:relative;aspect-ratio:1;background:#fafbfd;padding:9px;overflow:hidden}
.gwc-ph img{width:100%;height:100%;object-fit:contain}
/* Segunda foto sobreposta em cross-fade. A opacidade de .f1/.f2 vem inline do
   React (ver Card), aqui fica so o posicionamento e a transicao. */
.gwc-ph.tem2{cursor:pointer}
.gwc-ph .f1,.gwc-ph .f2{transition:opacity .28s ease}
.gwc-ph .f2{position:absolute;inset:9px;width:calc(100% - 18px);height:calc(100% - 18px)}
/* selo discreto avisando que existe uma segunda foto - sem ele o toque no
   celular seria uma funcao escondida */
.gwc-lupa{position:absolute;right:7px;bottom:7px;z-index:2;display:flex;align-items:center;gap:3px;
  background:rgba(255,255,255,.92);color:var(--navy-600);border:1px solid var(--line);
  border-radius:20px;padding:2px 7px 2px 5px;font-size:10px;font-weight:800;
  box-shadow:0 1px 3px rgba(9,36,60,.10);transition:opacity .2s}
.gwc-lupa svg{width:11px;height:11px}
@media(hover:hover){.gwc-card:hover .gwc-lupa{opacity:0}}
/* Badge em ambar, nao em verde: o verde fica reservado so pra acao (Adicionar).
   Duas coisas no mesmo verde competem e nenhuma se destaca. */
.gwc-tag{position:absolute;top:8px;left:8px;background:var(--amber-bg);color:var(--amber);
  font-size:9.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;
  padding:3px 7px;border-radius:5px;z-index:2;border:1px solid rgba(180,83,9,.18)}
.gwc-info{padding:10px 11px 11px;display:flex;flex-direction:column;flex:1;gap:7px}
.gwc-info h3{font-size:12.5px;font-weight:500;line-height:1.35;color:var(--ink-2);min-height:2.7em;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
/* Bolinhas maiores e com anel branco + sombra: a 13px chapadas elas sumiam
   no card. O anel separa a cor do fundo e vale principalmente pras claras
   (branco, off white), que antes ficavam invisiveis. */
.gwc-cores{display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-height:19px}
.gwc-cores i{width:18px;height:18px;border-radius:50%;flex:none;
  box-shadow:0 0 0 2px #fff inset,0 0 0 1px rgba(9,36,60,.22),0 1px 3px rgba(9,36,60,.20);
  transition:transform .15s}
@media(hover:hover){.gwc-cores i:hover{transform:scale(1.18)}}
.gwc-cores u{font-size:10.5px;color:var(--ink-2);text-decoration:none;font-weight:800;
  background:#eef2f7;border-radius:20px;padding:2px 6px;line-height:1.1}
/* Preco e o elemento mais escaneado do card: maior, mais escuro e com o
   "A partir de" bem apagado, pra hierarquia ficar obvia num relance. */
.gwc-price{display:flex;align-items:baseline;gap:5px;flex-wrap:wrap;margin-top:1px}
.gwc-price small{font-size:10px;color:var(--muted);white-space:nowrap;font-weight:500}
.gwc-price b{font-size:19px;font-weight:800;color:var(--navy-800);letter-spacing:-.035em;
  line-height:1.1}
.gwc-actions{margin-top:auto;display:flex;flex-direction:column;gap:6px}
.gwc-chips{display:flex;gap:5px}
.gwc-chips button{flex:1;height:27px;border-radius:7px;background:#f4f7fb;border:1px solid var(--line);
  color:var(--navy-600);font-size:11px;font-weight:700;transition:.15s}
@media(hover:hover){.gwc-chips button:hover{border-color:var(--navy-600)}}
.gwc-chips button.on{background:var(--navy-600);border-color:var(--navy-600);color:#fff}
.gwc-qty{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);
  border-radius:9px;height:34px;padding:0 2px}
.gwc-qty button{width:32px;height:30px;display:grid;place-items:center;color:var(--navy-600);
  font-size:17px;font-weight:700;border-radius:7px}
.gwc-qty span{font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;
  min-width:4ch;text-align:center}
.gwc-qty span i{font-style:normal;font-size:10px;color:var(--muted);font-weight:600}
.gwc-add{height:38px;border-radius:9px;background:var(--green-600);color:#fff;font-size:13px;
  font-weight:800;display:grid;place-items:center;transition:background .15s,transform .12s,box-shadow .15s;
  box-shadow:0 1px 2px rgba(18,134,47,.28),0 3px 8px rgba(18,134,47,.20);letter-spacing:.01em}
@media(hover:hover){.gwc-add:hover{background:var(--green-700)}}
.gwc-add:active{transform:scale(.97)}
.gwc-add.ok{background:var(--navy-600);box-shadow:none}

.gwc-benband{margin:24px 12px 0;background:#fff;border:1px solid var(--line);
  border-radius:var(--r);overflow:hidden}
.gwc-bh{background:linear-gradient(100deg,var(--navy-800),var(--navy-600));color:#fff;
  padding:13px 18px;font-weight:800;font-size:13px;letter-spacing:.02em}
.gwc-bens{display:grid;grid-template-columns:repeat(2,1fr)}
@media(min-width:800px){.gwc-bens{grid-template-columns:repeat(4,1fr)}}
.gwc-ben{padding:15px 14px;border-top:1px solid var(--line)}
.gwc-ben:nth-child(even){border-left:1px solid var(--line)}
@media(min-width:800px){.gwc-ben{border-left:1px solid var(--line)}.gwc-ben:first-child{border-left:0}}
.gwc-ben strong{display:block;font-size:12.5px;font-weight:700;color:var(--navy-800);
  line-height:1.3;margin-bottom:2px}
.gwc-ben span{font-size:11px;color:var(--muted);line-height:1.4}

.gwc-fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:65;
  height:56px;padding:0 20px 0 17px;border-radius:30px;background:var(--green-600);color:#fff;
  display:flex;align-items:center;gap:10px;box-shadow:0 6px 22px rgba(27,127,27,.42);
  font-size:14px;font-weight:700;transition:transform .18s}
.gwc-fab:active{transform:scale(.95)}
.gwc-fab svg{width:23px;height:23px}
.gwc-fab .fc{background:#fff;color:var(--green-600);min-width:24px;height:24px;border-radius:12px;
  display:grid;place-items:center;font-size:12.5px;font-weight:800;padding:0 6px}
.gwc-fab.zero{padding:0;width:56px;justify-content:center}
.gwc-fab.zero .fc,.gwc-fab.zero .fl{display:none}

.gwc-ov{position:fixed;inset:0;background:rgba(4,24,43,.5);opacity:0;pointer-events:none;
  transition:.25s;z-index:70}
.gwc-ov.on{opacity:1;pointer-events:auto}
.gwc-drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,90vw);background:#f6f8fb;z-index:80;
  transform:translateX(101%);transition:transform .3s cubic-bezier(.4,0,.2,1);
  display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(4,24,43,.2)}
.gwc-drawer.on{transform:none}
.gwc-dh{background:var(--navy-800);color:#fff;padding:16px;
  padding-top:calc(16px + env(safe-area-inset-top));display:flex;align-items:center;justify-content:space-between}
.gwc-dh h2{font-size:16px;font-weight:800}
.gwc-ditems{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:9px}
.gwc-ci{background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px;display:flex;gap:10px}
.gwc-ci img{width:58px;height:58px;object-fit:contain;flex:none;border-radius:7px}
.gwc-ci .d{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.gwc-ci h4{margin:0;font-size:12px;font-weight:600;line-height:1.3;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gwc-ci .r{display:flex;align-items:center;justify-content:space-between;gap:8px}
.gwc-ci .q{display:flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:7px}
.gwc-ci .q button{width:26px;height:26px;display:grid;place-items:center;color:var(--navy-600);font-size:15px}
.gwc-ci .q span{font-size:12px;font-weight:700;min-width:3ch;text-align:center;font-variant-numeric:tabular-nums}
.gwc-ci .rm{font-size:10.5px;color:#b3261e;text-decoration:underline}
.gwc-empty{text-align:center;color:var(--muted);padding:50px 20px;font-size:13.5px}
.gwc-df{border-top:1px solid var(--line);background:#fff;padding:14px;
  padding-bottom:calc(14px + env(safe-area-inset-bottom))}
.gwc-resumo{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:11px}
.gwc-resumo span{font-size:12.5px;color:var(--ink-2)}
.gwc-resumo b{font-size:19px;color:var(--navy-800);font-weight:800}
.gwc-wa{width:100%;height:47px;border-radius:11px;background:var(--green-600);color:#fff;
  font-size:14.5px;font-weight:700;display:flex;align-items:center;justify-content:center;
  gap:9px;text-decoration:none}
.gwc-wa[aria-disabled="true"]{background:var(--line);color:var(--muted);pointer-events:none}
.gwc-hint{font-size:10.5px;color:var(--muted);text-align:center;margin:8px 0 0;line-height:1.5}

.gwc-ob{position:fixed;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;
  padding:18px;background:rgba(4,24,43,.62)}
.gwc-obc{background:#fff;border-radius:20px;max-width:400px;width:100%;overflow:hidden;
  box-shadow:0 20px 60px rgba(4,24,43,.4);max-height:92vh;display:flex;flex-direction:column}
.gwc-obh{background:linear-gradient(125deg,var(--navy-800),var(--navy-600));color:#fff;
  padding:22px 22px 20px;text-align:center}
.gwc-obh img{width:52px;height:52px;border-radius:50%;margin:0 auto 11px}
.gwc-obh h2{font-size:19px;font-weight:800;margin-bottom:5px}
.gwc-obh p{margin:0;font-size:12.5px;opacity:.88;line-height:1.45}
.gwc-obb{padding:8px 20px 4px;overflow-y:auto}
.gwc-step{display:flex;gap:13px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line)}
.gwc-step:last-child{border-bottom:0}
.gwc-step .n{flex:none;width:32px;height:32px;border-radius:50%;background:#eef2f7;
  color:var(--navy-700);display:grid;place-items:center;font-weight:800;font-size:14px}
.gwc-step h3{font-size:13.5px;font-weight:700;color:var(--navy-800);margin-bottom:3px}
.gwc-step p{margin:0;font-size:12px;color:var(--ink-2);line-height:1.5}
.gwc-mini{display:inline-flex;align-items:center;gap:4px;background:#eef2f7;border:1px solid var(--line);
  border-radius:6px;padding:2px 7px;font-size:11px;font-weight:700;color:var(--navy-700);margin-top:6px}
.gwc-mini.g{background:var(--green-600);border-color:var(--green-600);color:#fff}
.gwc-obf{padding:14px 20px 20px}
.gwc-obf button{width:100%;height:48px;border-radius:12px;background:var(--green-600);
  color:#fff;font-size:15px;font-weight:700}

.gwc-estado{text-align:center;padding:44px 20px;color:var(--muted);font-size:14px}
.gwc-footer{text-align:center;padding:30px 20px calc(96px + env(safe-area-inset-bottom));
  color:var(--muted);font-size:11.5px;line-height:1.7;border-top:1px solid var(--line);margin-top:28px}
.gwc-footer b{color:var(--navy-700);display:block;font-size:13px;margin-bottom:3px;font-weight:800}
.gwc-toast{position:fixed;left:50%;bottom:88px;transform:translateX(-50%);background:var(--navy-800);
  color:#fff;padding:11px 18px;border-radius:11px;font-size:13px;font-weight:600;z-index:90;
  box-shadow:0 8px 24px rgba(4,24,43,.3)}
`;
