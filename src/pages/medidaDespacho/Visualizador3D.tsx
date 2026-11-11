import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AlertTriangle, X } from "lucide-react";
import type { Caixa, Volume } from "@/lib/medidaDespacho/calculo";
import { encaixar, type Forma, type ResultadoEncaixe } from "@/lib/medidaDespacho/empacotamento";
import { fmtCaixa } from "@/lib/medidaDespacho/resumo";
import { AZUL_ESCURO } from "./ui";

/* Visualização 3D ilustrativa (carregada só ao clicar em "Ver em 3D").
   Um InstancedMesh por SKU: aguenta milhares de unidades sem travar. */

const CORES = ["#1464D2", "#19A84A", "#F59E0B", "#DC2626", "#7C3AED", "#0891B2", "#DB2777", "#65A30D", "#EA580C", "#475569"];

interface Props {
  volumes: Volume[];
  caixa: Caixa;
  formas: Map<string, Forma>;
  rotulos: Map<string, string>;
  onFechar: () => void;
}

const chaveConteudo = (v: Volume) => v.conteudo.map((c) => `${c.id}:${c.qtd}`).join("|");

export default function Visualizador3D({ volumes, caixa, formas, rotulos, onFechar }: Props) {
  const [indice, setIndice] = useState(0);
  const montagem = useRef<HTMLDivElement>(null);
  const cena = useRef<{ scene: THREE.Scene; grupo: THREE.Group; render: () => void } | null>(null);

  const ids = useMemo(() => [...new Set(volumes.flatMap((v) => v.conteudo.map((c) => c.id)))], [volumes]);
  const corDe = useMemo(() => new Map(ids.map((id, i) => [id, CORES[i % CORES.length]])), [ids]);

  // Encaixe de cada volume (volumes com o mesmo conteúdo são calculados uma vez só)
  const encaixes = useMemo(() => {
    const cache = new Map<string, ResultadoEncaixe>();
    return volumes.map((v) => {
      const k = chaveConteudo(v);
      if (!cache.has(k)) {
        cache.set(k, encaixar(
          v.conteudo.filter((c) => formas.has(c.id)).map((c) => ({ id: c.id, qtd: c.qtd, dims: formas.get(c.id)!.dims })),
          caixa,
        ));
      }
      return cache.get(k)!;
    });
  }, [volumes, formas, caixa]);
  const inconsistentes = encaixes.map((e, i) => (e.colocadas < e.esperadas ? i + 1 : 0)).filter(Boolean);
  const atual = encaixes[indice];
  const volume = volumes[indice];

  // Cena (uma vez)
  useEffect(() => {
    const el = montagem.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#F8FAFC");
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight("#ffffff", 0.75));
    const sol = new THREE.DirectionalLight("#ffffff", 0.9);
    sol.position.set(1, 2, 1.5);
    scene.add(sol);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 5000);
    const raio = Math.max(caixa.largura, caixa.altura, caixa.comprimento);
    camera.position.set(raio * 1.3, raio * 1.0, raio * 1.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    const grupo = new THREE.Group();
    scene.add(grupo);

    const render = () => renderer.render(scene, camera);
    controls.addEventListener("change", render);
    const ajustar = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    ajustar();
    cena.current = { scene, grupo, render };
    return () => {
      ro.disconnect();
      controls.dispose();
      limpar(grupo);
      renderer.dispose();
      el.removeChild(renderer.domElement);
      cena.current = null;
    };
  }, [caixa]);

  // Conteúdo do volume escolhido
  useEffect(() => {
    const c = cena.current;
    if (!c || !atual) return;
    limpar(c.grupo);
    c.grupo.position.set(-caixa.largura / 2, -caixa.altura / 2, -caixa.comprimento / 2);

    const geoCaixa = new THREE.BoxGeometry(caixa.largura, caixa.altura, caixa.comprimento);
    const arestas = new THREE.LineSegments(new THREE.EdgesGeometry(geoCaixa), new THREE.LineBasicMaterial({ color: AZUL_ESCURO }));
    geoCaixa.dispose();
    arestas.position.set(caixa.largura / 2, caixa.altura / 2, caixa.comprimento / 2);
    c.grupo.add(arestas);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), esc = new THREE.Vector3();
    for (const [id, lista] of atual.porItem) {
      if (!lista.length) continue;
      const mat = new THREE.MeshStandardMaterial({ color: corDe.get(id), roughness: 0.6 });
      const inst = new THREE.InstancedMesh(geo, mat, lista.length);
      lista.forEach((p, i) => {
        const g = Math.min(0.3, Math.min(p.w, p.h, p.d) * 0.06); // folga visual entre unidades
        pos.set(p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2);
        esc.set(Math.max(p.w - g, 0.01), Math.max(p.h - g, 0.01), Math.max(p.d - g, 0.01));
        m.compose(pos, q, esc);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      c.grupo.add(inst);
    }
    c.render();
  }, [atual, caixa, corDe]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-6" role="dialog" aria-modal="true">
      <div className="flex h-full max-h-[760px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-extrabold" style={{ color: AZUL_ESCURO }}>Encaixe em 3D</h2>
          <select value={indice} onChange={(e) => setIndice(Number(e.target.value))} className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[14px] text-slate-900 outline-none focus:border-[#1464D2]">
            {volumes.map((v, i) => (
              <option key={v.numero} value={i}>Volume {v.numero} de {volumes.length}{encaixes[i].colocadas < encaixes[i].esperadas ? " ⚠" : ""}</option>
            ))}
          </select>
          <span className="text-[13px] text-slate-500">caixa {fmtCaixa(caixa)} cm</span>
          <button type="button" onClick={onFechar} className="ml-auto flex h-10 w-10 items-center justify-center rounded-lg hover:bg-slate-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative min-h-0 flex-1">
          <div ref={montagem} className="absolute inset-0" />
          <p className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[12px] font-bold text-slate-700 shadow-sm">
            Ilustrativo — valida se faz sentido, não substitui a medição real.
          </p>
          <p className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-white/80 px-2 py-1 text-[11px] text-slate-500">
            arraste para girar · role para zoom
          </p>
        </div>

        <div className="space-y-2 border-t border-slate-200 px-4 py-3 text-[13px]">
          {atual && atual.colocadas < atual.esperadas && (
            <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              O encaixe 3D coube {atual.colocadas.toLocaleString("pt-BR")} de {atual.esperadas.toLocaleString("pt-BR")} unidades; a estimativa pode estar otimista.
              O cálculo por volume continua sendo o resultado oficial.
            </p>
          )}
          {inconsistentes.length > 0 && (
            <p className="text-[12px] text-slate-500">Volumes em que o 3D coube menos: {inconsistentes.slice(0, 30).join(", ")}{inconsistentes.length > 30 ? "…" : ""}</p>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {volume?.conteudo.map((c) => (
              <li key={c.id} className="flex items-center gap-1.5 text-slate-700">
                <span className="h-3 w-3 rounded-sm" style={{ background: corDe.get(c.id) }} />
                {c.qtd.toLocaleString("pt-BR")} × {rotulos.get(c.id) ?? c.id}
                {formas.get(c.id)?.aproximada && <span className="rounded bg-slate-100 px-1.5 text-[11px] text-slate-500">forma aproximada</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function limpar(grupo: THREE.Group) {
  for (const o of [...grupo.children]) {
    grupo.remove(o);
    const obj = o as THREE.Mesh;
    obj.geometry?.dispose();
    const mat = obj.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  }
}
