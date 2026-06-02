-- ============================================================
-- FUNCIONES PARA MÓDULO DE INVENTARIO — La Pastora
-- Ejecutar en el SQL Editor de Supabase (una sola vez)
-- ============================================================

-- ── 1. Ajuste manual atómico ──────────────────────────────────
-- Actualiza inventario Y registra el movimiento en una sola transacción.
-- p_tipo: 'ajuste' | 'merma' | 'caducado' | 'robo' | 'otro'
-- p_delta: positivo = entrada, negativo = salida

CREATE OR REPLACE FUNCTION fn_ajustar_inventario(
  p_producto_id   UUID,
  p_ubicacion     TEXT,
  p_delta         NUMERIC,
  p_tipo          TEXT,
  p_notas         TEXT    DEFAULT NULL,
  p_usuario_id    UUID    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Actualizar cantidad en inventario (nunca baja de 0)
  PERFORM fn_upsert_inventario(p_producto_id, p_ubicacion, p_delta);

  -- 2. Registrar en el ledger de movimientos
  INSERT INTO movimientos_inventario (
    producto_id, ubicacion, delta, tipo, notas, usuario_id
  ) VALUES (
    p_producto_id, p_ubicacion, p_delta, p_tipo, p_notas, p_usuario_id
  );
END;
$$;

-- ── 2. Distribución masiva central → puntos de venta ─────────
-- Recibe un array JSON de items a distribuir.
-- El trigger trg_transferencia_mover_inventario maneja el stock
-- y el registro en movimientos_inventario al insertar en transferencias.
--
-- Formato de p_items:
-- [{"producto_id":"uuid","cantidad_a":5,"cantidad_b":3,"notas":"..."}]

CREATE OR REPLACE FUNCTION fn_distribuir_inventario(
  p_items       JSONB,
  p_usuario_id  UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item       JSONB;
  v_nota       TEXT;
  v_prod_id    UUID;
  v_cant_a     NUMERIC;
  v_cant_b     NUMERIC;
  v_stock_cen  NUMERIC;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_prod_id := (v_item->>'producto_id')::UUID;
    v_cant_a  := COALESCE((v_item->>'cantidad_a')::NUMERIC, 0);
    v_cant_b  := COALESCE((v_item->>'cantidad_b')::NUMERIC, 0);
    v_nota    := COALESCE(v_item->>'notas', 'Distribución de inventario');

    -- Verificar stock disponible en central
    SELECT COALESCE(cantidad, 0) INTO v_stock_cen
    FROM inventario
    WHERE producto_id = v_prod_id AND ubicacion = 'central';

    IF (v_cant_a + v_cant_b) > v_stock_cen THEN
      RAISE EXCEPTION 'Stock insuficiente en central para producto % (disponible: %, solicitado: %)',
        v_prod_id, v_stock_cen, (v_cant_a + v_cant_b);
    END IF;

    -- Insertar transferencias (el trigger mueve el stock automáticamente)
    IF v_cant_a > 0 THEN
      INSERT INTO transferencias (producto_id, cantidad, origen, destino, motivo)
      VALUES (v_prod_id, v_cant_a, 'central', 'punto_a', v_nota);
    END IF;

    IF v_cant_b > 0 THEN
      INSERT INTO transferencias (producto_id, cantidad, origen, destino, motivo)
      VALUES (v_prod_id, v_cant_b, 'central', 'punto_b', v_nota);
    END IF;
  END LOOP;
END;
$$;

-- ── Verificar que las funciones se crearon correctamente ──────
SELECT proname, pronargs
FROM pg_proc
WHERE proname IN ('fn_ajustar_inventario', 'fn_distribuir_inventario');
