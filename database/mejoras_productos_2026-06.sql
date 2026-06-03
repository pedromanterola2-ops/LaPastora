-- ================================================================
-- LA PASTORA — Mejoras al módulo de Productos (junio 2026)
-- ================================================================
-- Ejecutar en: Supabase → SQL Editor → New Query → Pegar → Run
--
-- Qué hace este script:
--   1. Agrega columnas nuevas a `productos`:
--        sku             → código corto único del producto
--        costo           → cuánto te cuesta comprarlo (para margen)
--        contenido       → cantidad por presentación (ej. 2 = "2 kg")
--        fecha_caducidad → fecha fija de caducidad del producto
--   2. Índice único de SKU (ignora nulos/vacíos, no distingue mayúsculas).
--   3. fn_crear_producto    → crea un producto y, si hay cantidad inicial,
--                             sube ese stock a CENTRAL y lo deja en el historial.
--   4. fn_importar_productos → versión masiva de lo anterior (varios de golpe).
--
-- Es seguro ejecutarlo varias veces (IF NOT EXISTS / CREATE OR REPLACE).
-- ================================================================


-- ================================================================
-- 1. COLUMNAS NUEVAS EN productos
-- ================================================================
ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku             TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS costo           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (costo >= 0);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS contenido       NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK (contenido > 0);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS fecha_caducidad DATE;

COMMENT ON COLUMN productos.sku             IS 'Código corto único para identificar el producto (ej. QOX-01)';
COMMENT ON COLUMN productos.costo           IS 'Costo de compra por unidad de venta. Base para el margen de ganancia';
COMMENT ON COLUMN productos.contenido       IS 'Cantidad por presentación junto a la unidad (ej. contenido=2, unidad=kg → "2 kg")';
COMMENT ON COLUMN productos.fecha_caducidad IS 'Fecha fija de caducidad del producto (opcional)';


-- ================================================================
-- 2. ÍNDICE ÚNICO DE SKU
--    Solo aplica a SKUs no vacíos; insensible a mayúsculas.
-- ================================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_sku_unico
  ON productos (lower(sku))
  WHERE sku IS NOT NULL AND btrim(sku) <> '';


-- ================================================================
-- 3. fn_crear_producto — crea producto + stock inicial en Central
-- ================================================================
-- Devuelve la fila del producto como jsonb (incluye id).
-- Si p_cantidad_inicial > 0, sube ese stock a 'central' y registra
-- el movimiento en el ledger como 'ajuste_conteo'.
-- ================================================================
CREATE OR REPLACE FUNCTION fn_crear_producto(
  p_nombre            TEXT,
  p_categoria         TEXT    DEFAULT NULL,
  p_sku               TEXT    DEFAULT NULL,
  p_unidad_venta      TEXT    DEFAULT 'pieza',
  p_contenido         NUMERIC DEFAULT 1,
  p_costo             NUMERIC DEFAULT 0,
  p_precio_venta      NUMERIC DEFAULT 0,
  p_fecha_caducidad   DATE    DEFAULT NULL,
  p_existencia_minima NUMERIC DEFAULT 0,
  p_cantidad_inicial  NUMERIC DEFAULT 0,
  p_activo            BOOLEAN DEFAULT TRUE,
  p_usuario_id        UUID    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row productos%ROWTYPE;
BEGIN
  INSERT INTO productos (
    nombre, categoria, sku, unidad_venta, contenido,
    costo, precio_venta, fecha_caducidad, existencia_minima, activo
  ) VALUES (
    btrim(p_nombre),
    NULLIF(btrim(COALESCE(p_categoria, '')), ''),
    NULLIF(btrim(COALESCE(p_sku, '')), ''),
    COALESCE(NULLIF(btrim(COALESCE(p_unidad_venta, '')), ''), 'pieza'),
    COALESCE(NULLIF(p_contenido, 0), 1),
    GREATEST(COALESCE(p_costo, 0), 0),
    GREATEST(COALESCE(p_precio_venta, 0), 0),
    p_fecha_caducidad,
    GREATEST(COALESCE(p_existencia_minima, 0), 0),
    COALESCE(p_activo, TRUE)
  )
  RETURNING * INTO v_row;

  -- Stock inicial → bodega central
  IF COALESCE(p_cantidad_inicial, 0) > 0 THEN
    PERFORM fn_upsert_inventario(v_row.id, 'central', p_cantidad_inicial);

    INSERT INTO movimientos_inventario (
      producto_id, tipo, cantidad, ubicacion_destino,
      referencia_tipo, notas, usuario_id
    ) VALUES (
      v_row.id, 'ajuste_conteo', p_cantidad_inicial, 'central',
      'ajuste', 'Stock inicial al crear el producto', p_usuario_id
    );
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION fn_crear_producto IS 'Crea un producto y, si hay cantidad inicial, sube stock a central con su movimiento';


-- ================================================================
-- 4. fn_importar_productos — alta masiva con stock inicial
-- ================================================================
-- p_rows: arreglo jsonb. Cada elemento admite las mismas claves que
-- fn_crear_producto: nombre, categoria, sku, unidad_venta, contenido,
-- costo, precio_venta, fecha_caducidad, existencia_minima,
-- cantidad_inicial, activo.
-- Devuelve la cantidad de productos creados.
-- ================================================================
CREATE OR REPLACE FUNCTION fn_importar_productos(
  p_rows       JSONB,
  p_usuario_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item  JSONB;
  v_count INTEGER := 0;
BEGIN
  IF p_rows IS NULL OR jsonb_array_length(p_rows) = 0 THEN
    RAISE EXCEPTION 'No hay productos para importar';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    PERFORM fn_crear_producto(
      p_nombre            => v_item->>'nombre',
      p_categoria         => v_item->>'categoria',
      p_sku               => v_item->>'sku',
      p_unidad_venta      => COALESCE(v_item->>'unidad_venta', 'pieza'),
      p_contenido         => COALESCE((v_item->>'contenido')::numeric, 1),
      p_costo             => COALESCE((v_item->>'costo')::numeric, 0),
      p_precio_venta      => COALESCE((v_item->>'precio_venta')::numeric, 0),
      p_fecha_caducidad   => NULLIF(v_item->>'fecha_caducidad', '')::date,
      p_existencia_minima => COALESCE((v_item->>'existencia_minima')::numeric, 0),
      p_cantidad_inicial  => COALESCE((v_item->>'cantidad_inicial')::numeric, 0),
      p_activo            => COALESCE((v_item->>'activo')::boolean, TRUE),
      p_usuario_id        => p_usuario_id
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION fn_importar_productos IS 'Alta masiva de productos con stock inicial a central; devuelve cuántos se crearon';


-- ================================================================
-- 5. PERMISOS DE EJECUCIÓN
-- ================================================================
GRANT EXECUTE ON FUNCTION fn_crear_producto(
  TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, DATE, NUMERIC, NUMERIC, BOOLEAN, UUID
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION fn_importar_productos(JSONB, UUID) TO anon, authenticated;


-- ================================================================
-- Verificación rápida
-- ================================================================
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'productos' ORDER BY ordinal_position;
-- SELECT proname FROM pg_proc
--   WHERE proname IN ('fn_crear_producto','fn_importar_productos');
-- ================================================================
