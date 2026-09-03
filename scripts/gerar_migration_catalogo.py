#!/usr/bin/env python
"""Gera a migration que cria e popula a tabela catalogo_clientes.

A partir daqui o catalogo deixa de ser arquivo estatico: o admin edita a
tabela e a pagina publica le dela.
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.gerar_catalogo_html import (
    CATEGORIA_FALTANTE, CUSTOS_FALTANTES, CSV_IN, MULTIPLICADOR, ROTULO_SECAO,
    carregar_produtos,
)
from scripts.xbz_feed.cores import cores_do_produto
from scripts.xbz_feed.story_groups import GRUPOS, slug

RAIZ = Path(__file__).resolve().parent.parent
SAIDA = RAIZ / "supabase" / "migrations"


def sql_txt(v) -> str:
    if v is None or v == "":
        return "NULL"
    return "'" + str(v).replace("'", "''") + "'"


def main():
    # URLs publicas das imagens (ja hospedadas no Supabase Storage)
    with open(CSV_IN, encoding="utf-8-sig") as f:
        imagens = {r["codigo"]: (r["image_url"], r["image_url_secundaria"])
                   for r in csv.DictReader(f)}

    produtos, categorias = carregar_produtos()
    rotulo_grupo = {slug(rot): rot for rot, _s, _c in GRUPOS}

    linhas = []
    for ordem, p in enumerate(produtos, start=1):
        img, img2 = imagens.get(p["id"], ("", ""))
        cores = cores_do_produto(RAIZ / "data" / "raw" / f"{p['id']}.json")
        linhas.append(
            "  (" + ", ".join([
                sql_txt(p["id"]),
                sql_txt(p["n"]),
                sql_txt(p["c"]),
                sql_txt(ROTULO_SECAO.get(p["c"], p["c"].title())),
                sql_txt(p["s"]),
                sql_txt(p["g"]),
                sql_txt(rotulo_grupo.get(p["g"], "")),
                f"{p['p']:.2f}",
                sql_txt(img),
                sql_txt(img2),
                sql_txt(json.dumps(cores, ensure_ascii=False)) + "::jsonb",
                "true" if p["top"] else "false",
                str(ordem),
            ]) + ")"
        )

    sql = f"""-- Catalogo Clientes: a lista curada que vai no link enviado por WhatsApp.
-- Antes isso vivia num CSV + HTML estatico gerado por script; agora mora aqui
-- para poder ser editada pelo /admin/catalogo-clientes sem depender de deploy.

CREATE TABLE IF NOT EXISTS public.catalogo_clientes (
  id            UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo        TEXT NOT NULL UNIQUE,
  nome          TEXT NOT NULL,
  categoria     TEXT NOT NULL,
  categoria_rotulo TEXT,
  subcategoria  TEXT,
  grupo         TEXT,
  grupo_rotulo  TEXT,
  preco         NUMERIC(10,2),
  imagem_url    TEXT,
  imagem_secundaria_url TEXT,
  cores         JSONB NOT NULL DEFAULT '[]'::jsonb,
  destaque      BOOLEAN NOT NULL DEFAULT false,
  ordem         INTEGER NOT NULL DEFAULT 0,
  ativo         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_catalogo_clientes_ordem ON public.catalogo_clientes(ativo, ordem);
CREATE INDEX IF NOT EXISTS idx_catalogo_clientes_grupo ON public.catalogo_clientes(grupo);

GRANT SELECT ON public.catalogo_clientes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.catalogo_clientes TO authenticated;
GRANT ALL ON public.catalogo_clientes TO service_role;

ALTER TABLE public.catalogo_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read catalogo clientes" ON public.catalogo_clientes;
CREATE POLICY "Public can read catalogo clientes"
  ON public.catalogo_clientes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can insert catalogo clientes" ON public.catalogo_clientes;
CREATE POLICY "Admins can insert catalogo clientes"
  ON public.catalogo_clientes FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins can update catalogo clientes" ON public.catalogo_clientes;
CREATE POLICY "Admins can update catalogo clientes"
  ON public.catalogo_clientes FOR UPDATE TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP POLICY IF EXISTS "Admins can delete catalogo clientes" ON public.catalogo_clientes;
CREATE POLICY "Admins can delete catalogo clientes"
  ON public.catalogo_clientes FOR DELETE TO authenticated
  USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.catalogo_clientes_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_catalogo_clientes_updated_at ON public.catalogo_clientes;
CREATE TRIGGER trg_catalogo_clientes_updated_at
  BEFORE UPDATE ON public.catalogo_clientes
  FOR EACH ROW EXECUTE FUNCTION public.catalogo_clientes_set_updated_at();

-- Carga inicial: os {len(produtos)} produtos ja curados. ON CONFLICT evita duplicar
-- se a migration rodar duas vezes, e preserva o que ja foi editado no admin.
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, subcategoria, grupo, grupo_rotulo,
   preco, imagem_url, imagem_secundaria_url, cores, destaque, ordem)
VALUES
{",\n".join(linhas)}
ON CONFLICT (codigo) DO NOTHING;
"""

    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    destino = SAIDA / f"{ts}_catalogo_clientes.sql"
    destino.write_text(sql, encoding="utf-8")
    print(f"[MIGRATION] {len(produtos)} produtos -> {destino}")
    print(f"[MIGRATION] {destino.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
