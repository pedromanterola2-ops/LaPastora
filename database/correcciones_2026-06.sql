-- ================================================================
-- LA PASTORA — Correcciones (junio 2026)
-- ================================================================
-- Ejecutar en: Supabase → SQL Editor → New Query → Pegar → Run
--
-- Este script aplica 3 correcciones derivadas de la auditoría:
--   1. fn_ajustar_inventario  → usa las columnas correctas del schema
--                               (la versión vieja insertaba en columnas
--                                inexistentes 'ubicacion'/'delta')
--   2. fn_registrar_venta     → registra la venta y sus ítems de forma
--                               ATÓMICA (una sola transacción)
--   3. inventario_resumen     → alerta de stock bajo más precisa
--                               (evita falsos positivos masivos)
--
-- Es seguro ejecutarlo varias veces (CREATE OR REPLACE).
-- Si ya corriste database/rls.sql, los puntos 1 y 3 ya están incluidos
-- allí; este archivo los repite para entornos que aún no aplican RLS.
-- ================================================================


-- ================================================================
-- 1. fn_ajustar_inventario — columnas correctas
-- ================================================================
CREATE OR REPLACE FUNCTION fn_ajustar_inventario(
  p_producto_id   UUID,
  p_ubicacion     TEXT,
  p_delta         NUMERIC,
  p_tipo          TEXT,    -- 'ajuste_conteo' | 'ajuste_merma'
  p_notas         TEXT    DEFAULT NULL,
  p_usuario_id    UUID    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Actualizar stock (nunca baja de 0)
  PERFORM fn_upsert_inventario(p_producto_id, p_ubicacion, p_delta);

  -- 2. Registrar movimiento con las columnas reales del schema
  INSERT INTO movimientos_inventario (
    producto_id, tipo, cantidad,
    ubicacion_origen, ubicacion_destino,
    notas, usuario_id
  ) VALUES (
    p_producto_id,
    p_tipo,
    ABS(p_delta),
    CASE WHEN p_delta <  0 THEN p_ubicacion ELSE NULL END,
    CASE WHEN p_delta >= 0 THEN p_ubicacion ELSE NULL END,
    p_notas,
    p_usuario_id
  );
END;
$$;

COMMENT ON FUNCTION fn_ajustar_inventario IS 'Ajuste atómico de inventario + registro en el ledger (columnas correctas del schema)';


-- ================================================================
-- 2. fn_registrar_venta — cabecera + ítems en una sola transacción
-- ================================================================
-- Evita ventas huérfanas: si falla la inserción de algún ítem, se
-- revierte también la cabecera. El trigger trg_items_venta_bajar_inventario
-- descuenta el stock al insertar cada ítem (igual que antes).
--
-- p_venta:  { punto_venta, subtotal, descuento_total, total,
--             metodo_pago, fecha?, usuario_id?, notas? }
-- p_items:  [ { producto_id, cantidad, precio_unitario, descuento?, subtotal } ]
-- Devuelve: la fila de la venta insertada (jsonb), incluye id y fecha.
-- ================================================================
CREATE OR REPLACE FUNCTION fn_registrar_venta(
  p_venta JSONB,
  p_items JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row   ventas%ROWTYPE;
  v_item  JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene productos';
  END IF;

  -- Cabecera
  INSERT INTO ventas (
    fecha, punto_venta, subtotal, descuento_total, total,
    metodo_pago, usuario_id, notas
  ) VALUES (
    COALESCE((p_venta->>'fecha')::timestamptz, NOW()),
    p_venta->>'punto_venta',
    COALESCE((p_venta->>'subtotal')::numeric, 0),
    COALESCE((p_venta->>'descuento_total')::numeric, 0),
    COALESCE((p_venta->>'total')::numeric, 0),
    COALESCE(p_venta->>'metodo_pago', 'efectivo'),
    NULLIF(p_venta->>'usuario_id', '')::uuid,
    p_venta->>'notas'
  )
  RETURNING * INTO v_row;

  -- Ítems (el trigger descuenta inventario en cada inserción)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO items_venta (
      venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal
    ) VALUES (
      v_row.id,
      (v_item->>'producto_id')::uuid,
      (v_item->>'cantidad')::numeric,
      (v_item->>'precio_unitario')::numeric,
      COALESCE((v_item->>'descuento')::numeric, 0),
      (v_item->>'subtotal')::numeric
    );
  END LOOP;

  RETURN to_jsonb(v_row);
END;
$$;

COMMENT ON FUNCTION fn_registrar_venta IS 'Registra una venta y sus ítems de forma atómica; devuelve la venta como jsonb';

-- Permiso de ejecución para los roles de la app (anon/authenticated)
GRANT EXECUTE ON FUNCTION fn_registrar_venta(JSONB, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION fn_ajustar_inventario(UUID, TEXT, NUMERIC, TEXT, TEXT, UUID) TO anon, authenticated;


-- ================================================================
-- 3. inventario_resumen — alerta de stock bajo más precisa
-- ================================================================
-- Antes: marcaba alerta si CUALQUIER punto (A u B) estaba por debajo
-- del mínimo, aunque el producto no se manejara ahí → casi todo el
-- catálogo aparecía en alerta.
-- Ahora: alerta solo si existe un mínimo (> 0) y el stock TOTAL cae
-- por debajo de ese mínimo. Señal mucho más útil.
-- ================================================================
CREATE OR REPLACE VIEW inventario_resumen AS
SELECT
  p.id                                                              AS producto_id,
  p.nombre,
  p.categoria,
  p.unidad_venta,
  p.precio_venta,
  p.existencia_minima,
  COALESCE(SUM(i.cantidad) FILTER (WHERE i.ubicacion = 'central'),  0) AS stock_central,
  COALESCE(SUM(i.cantidad) FILTER (WHERE i.ubicacion = 'punto_a'),  0) AS stock_punto_a,
  COALESCE(SUM(i.cantidad) FILTER (WHERE i.ubicacion = 'punto_b'),  0) AS stock_punto_b,
  COALESCE(SUM(i.cantidad), 0)                                         AS stock_total,
  CASE
    WHEN p.existencia_minima > 0
     AND COALESCE(SUM(i.cantidad), 0) < p.existencia_minima
    THEN true
    ELSE false
  END                                                               AS alerta_stock_bajo
FROM productos p
LEFT JOIN inventario i ON p.id = i.producto_id
WHERE p.activo = true
GROUP BY
  p.id, p.nombre, p.categoria, p.unidad_venta,
  p.precio_venta, p.existencia_minima
ORDER BY p.categoria, p.nombre;

COMMENT ON VIEW inventario_resumen IS 'Existencias por producto/ubicación; alerta de stock bajo sobre el stock total';


-- ================================================================
-- Verificación rápida
-- ================================================================
-- SELECT proname FROM pg_proc WHERE proname IN
--   ('fn_ajustar_inventario','fn_registrar_venta');
-- SELECT * FROM inventario_resumen LIMIT 5;
-- ================================================================
