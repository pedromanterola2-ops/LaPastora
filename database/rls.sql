-- ================================================================
-- LA PASTORA — Row Level Security (RLS)
-- ================================================================
-- Ejecutar en: Supabase → SQL Editor → New Query → Run
--
-- Requisito previo: schema.sql, inventario_functions.sql y
-- ventas_cancelacion.sql deben estar ejecutados.
--
-- Este script hace 5 cosas en orden:
--   1. Crea la función auxiliar get_my_rol()
--   2. Convierte las funciones trigger a SECURITY DEFINER
--      (necesario para que punto_a/b puedan registrar ventas)
--   3. Corrige fn_ajustar_inventario (nombres de columna incorrectos)
--   4. Recrea las vistas con security_invoker = true
--   5. Habilita RLS y crea todas las políticas por rol
-- ================================================================


-- ================================================================
-- PASO 1 — Función auxiliar: obtener el rol del usuario en sesión
-- ================================================================
-- SECURITY DEFINER: puede leer la tabla usuarios aunque tenga RLS.
-- STABLE: Postgres puede cachear el resultado dentro de la misma query.

CREATE OR REPLACE FUNCTION get_my_rol()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT rol FROM public.usuarios WHERE email = auth.email()
$$;


-- ================================================================
-- PASO 2 — Funciones trigger → SECURITY DEFINER
-- ================================================================
-- Los triggers corren con los permisos del usuario que disparó la
-- acción. Si punto_a registra una venta, el trigger que baja el
-- inventario fallaría porque punto_a no tiene permisos de escritura
-- en inventario ni movimientos_inventario.
-- Con SECURITY DEFINER los triggers corren como el propietario
-- (postgres), que sí tiene permisos totales.

-- ── fn_upsert_inventario ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_upsert_inventario(
  p_producto_id UUID,
  p_ubicacion   TEXT,
  p_delta       NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO inventario (producto_id, ubicacion, cantidad, ultima_actualizacion)
  VALUES (p_producto_id, p_ubicacion, GREATEST(p_delta, 0), NOW())
  ON CONFLICT (producto_id, ubicacion) DO UPDATE
    SET cantidad             = GREATEST(inventario.cantidad + p_delta, 0),
        ultima_actualizacion = NOW();
END;
$$;

-- ── fn_trg_items_venta_bajar_inventario ──────────────────────────
CREATE OR REPLACE FUNCTION fn_trg_items_venta_bajar_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_punto_venta TEXT;
BEGIN
  SELECT punto_venta INTO v_punto_venta
  FROM ventas
  WHERE id = NEW.venta_id;

  IF v_punto_venta IS NULL THEN
    RAISE EXCEPTION 'No se encontró la venta % al intentar actualizar inventario', NEW.venta_id;
  END IF;

  PERFORM fn_upsert_inventario(NEW.producto_id, v_punto_venta, -NEW.cantidad);

  INSERT INTO movimientos_inventario
    (producto_id, tipo, cantidad, ubicacion_origen, referencia_id, referencia_tipo)
  VALUES
    (NEW.producto_id, 'salida_venta', NEW.cantidad, v_punto_venta, NEW.venta_id, 'venta');

  RETURN NEW;
END;
$$;

-- ── fn_trg_viaje_completado ──────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_trg_viaje_completado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item           RECORD;
  v_total_gastos   NUMERIC;
  v_total_compra   NUMERIC;
  v_costo_traslado NUMERIC;
  v_costo_real     NUMERIC;
BEGIN
  IF (OLD.estado IS DISTINCT FROM 'completado') AND NEW.estado = 'completado' THEN

    v_total_gastos :=
        COALESCE(NEW.gastos_gasolina,  0)
      + COALESCE(NEW.gastos_casetas,   0)
      + COALESCE(NEW.gastos_comida,    0)
      + COALESCE(NEW.gastos_hospedaje, 0)
      + COALESCE(NEW.gastos_otros,     0);

    SELECT COALESCE(SUM(cantidad * precio_unitario_compra), 0)
    INTO   v_total_compra
    FROM   items_viaje
    WHERE  viaje_id = NEW.id;

    FOR v_item IN
      SELECT * FROM items_viaje WHERE viaje_id = NEW.id
    LOOP
      IF v_total_compra > 0 THEN
        v_costo_traslado := v_total_gastos
          * (v_item.cantidad * v_item.precio_unitario_compra / v_total_compra);
      ELSE
        v_costo_traslado := 0;
      END IF;

      IF v_item.cantidad > 0 THEN
        v_costo_real := v_item.precio_unitario_compra
                      + (v_costo_traslado / v_item.cantidad);
      ELSE
        v_costo_real := v_item.precio_unitario_compra;
      END IF;

      UPDATE items_viaje
      SET costo_traslado_asignado = ROUND(v_costo_traslado, 4),
          costo_real_unitario     = ROUND(v_costo_real,     4)
      WHERE id = v_item.id;

      PERFORM fn_upsert_inventario(v_item.producto_id, 'central', v_item.cantidad);

      INSERT INTO movimientos_inventario
        (producto_id, tipo, cantidad, ubicacion_destino, referencia_id, referencia_tipo)
      VALUES
        (v_item.producto_id, 'entrada_compra', v_item.cantidad,
         'central', NEW.id, 'viaje_compra');

    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ── fn_trg_transferencia_mover_inventario ────────────────────────
CREATE OR REPLACE FUNCTION fn_trg_transferencia_mover_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM fn_upsert_inventario(NEW.producto_id, NEW.origen,  -NEW.cantidad);
  PERFORM fn_upsert_inventario(NEW.producto_id, NEW.destino,  NEW.cantidad);

  INSERT INTO movimientos_inventario
    (producto_id, tipo, cantidad,
     ubicacion_origen, ubicacion_destino,
     referencia_id, referencia_tipo, notas)
  VALUES
    (NEW.producto_id, 'transferencia', NEW.cantidad,
     NEW.origen, NEW.destino,
     NEW.id, 'transferencia',
     COALESCE(NEW.motivo, 'Transferencia entre ubicaciones'));

  RETURN NEW;
END;
$$;

-- ── fn_trg_venta_cancelada ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_trg_venta_cancelada()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.estado = 'cancelada' AND OLD.estado <> 'cancelada' THEN

    PERFORM fn_upsert_inventario(iv.producto_id, OLD.punto_venta, iv.cantidad)
    FROM items_venta iv
    WHERE iv.venta_id = NEW.id;

    INSERT INTO movimientos_inventario
      (producto_id, tipo, cantidad, ubicacion_destino, referencia_id, referencia_tipo, notas)
    SELECT
      iv.producto_id,
      'ajuste_conteo',
      iv.cantidad,
      OLD.punto_venta,
      NEW.id,
      'venta',
      'Cancelación: ' || COALESCE(NEW.motivo_cancelacion, 'sin motivo')
    FROM items_venta iv
    WHERE iv.venta_id = NEW.id;

  END IF;
  RETURN NEW;
END;
$$;


-- ================================================================
-- PASO 3 — Corregir fn_ajustar_inventario
-- ================================================================
-- La versión anterior usaba nombres de columna que no existen en
-- movimientos_inventario ('ubicacion', 'delta'). Esta versión usa
-- los nombres correctos del schema ('ubicacion_origen/destino', 'cantidad').

CREATE OR REPLACE FUNCTION fn_ajustar_inventario(
  p_producto_id   UUID,
  p_ubicacion     TEXT,
  p_delta         NUMERIC,
  p_tipo          TEXT,    -- 'ajuste_merma' | 'ajuste_conteo'
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

  -- 2. Registrar movimiento con columnas correctas del schema
  INSERT INTO movimientos_inventario (
    producto_id,
    tipo,
    cantidad,
    ubicacion_origen,
    ubicacion_destino,
    notas,
    usuario_id
  ) VALUES (
    p_producto_id,
    p_tipo,
    ABS(p_delta),
    CASE WHEN p_delta < 0 THEN p_ubicacion ELSE NULL END,
    CASE WHEN p_delta >= 0 THEN p_ubicacion ELSE NULL END,
    p_notas,
    p_usuario_id
  );
END;
$$;

-- ── fn_distribuir_inventario (agregar SECURITY DEFINER) ──────────
-- Necesario para que compras pueda insertar en transferencias
-- cuando tiene RLS activo.
CREATE OR REPLACE FUNCTION fn_distribuir_inventario(
  p_items       JSONB,
  p_usuario_id  UUID DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

    SELECT COALESCE(cantidad, 0) INTO v_stock_cen
    FROM inventario
    WHERE producto_id = v_prod_id AND ubicacion = 'central';

    IF (v_cant_a + v_cant_b) > v_stock_cen THEN
      RAISE EXCEPTION 'Stock insuficiente en central para producto % (disponible: %, solicitado: %)',
        v_prod_id, v_stock_cen, (v_cant_a + v_cant_b);
    END IF;

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


-- ================================================================
-- PASO 4 — Vistas con security_invoker = true
-- ================================================================
-- Hace que la vista aplique el RLS de las tablas subyacentes.
-- Efecto para punto_a: inventario_resumen muestra sus columnas
-- correctas pero stock_central y stock_punto_b quedan en 0
-- (no puede ver esas filas de inventario). Comportamiento correcto.

CREATE OR REPLACE VIEW inventario_resumen
WITH (security_invoker = true)
AS
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
    WHEN COALESCE(SUM(i.cantidad) FILTER (WHERE i.ubicacion = 'punto_a'), 0) < p.existencia_minima
      OR COALESCE(SUM(i.cantidad) FILTER (WHERE i.ubicacion = 'punto_b'), 0) < p.existencia_minima
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

CREATE OR REPLACE VIEW ventas_por_producto_punto
WITH (security_invoker = true)
AS
SELECT
  p.id                                   AS producto_id,
  p.nombre                               AS producto,
  p.categoria,
  v.punto_venta,
  DATE_TRUNC('month', v.fecha)::DATE     AS mes,
  COUNT(DISTINCT v.id)                   AS num_ventas,
  SUM(iv.cantidad)                       AS unidades_vendidas,
  SUM(iv.subtotal)                       AS ingresos_brutos,
  SUM(iv.descuento)                      AS descuentos_aplicados,
  SUM(iv.subtotal) - SUM(iv.descuento)   AS ingresos_netos
FROM items_venta iv
JOIN ventas    v  ON iv.venta_id    = v.id
JOIN productos p  ON iv.producto_id = p.id
GROUP BY
  p.id, p.nombre, p.categoria,
  v.punto_venta,
  DATE_TRUNC('month', v.fecha)
ORDER BY mes DESC, p.nombre, v.punto_venta;


-- ================================================================
-- PASO 5 — Habilitar RLS en las 10 tablas
-- ================================================================

ALTER TABLE usuarios               ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores            ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE viajes_compra          ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_viaje            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventario             ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_venta            ENABLE ROW LEVEL SECURITY;
ALTER TABLE transferencias         ENABLE ROW LEVEL SECURITY;


-- ================================================================
-- PASO 6 — Políticas por tabla
-- ================================================================
-- Convención: USING aplica a SELECT/UPDATE/DELETE (filtra filas existentes).
--             WITH CHECK aplica a INSERT/UPDATE (valida filas nuevas).
--             Usar ambas garantiza coherencia en todas las operaciones.


-- ── USUARIOS ─────────────────────────────────────────────────────
-- Admin: acceso total a todos los usuarios
CREATE POLICY "admin_usuarios_all" ON usuarios
  FOR ALL TO authenticated
  USING     (get_my_rol() = 'admin')
  WITH CHECK (get_my_rol() = 'admin');

-- Todos los roles: pueden leer su propio perfil
-- (AuthContext necesita hacer SELECT WHERE email = auth.email())
CREATE POLICY "self_select_usuarios" ON usuarios
  FOR SELECT TO authenticated
  USING (email = auth.email());


-- ── PROVEEDORES ──────────────────────────────────────────────────
CREATE POLICY "admin_compras_proveedores" ON proveedores
  FOR ALL TO authenticated
  USING     (get_my_rol() IN ('admin', 'compras'))
  WITH CHECK (get_my_rol() IN ('admin', 'compras'));


-- ── PRODUCTOS ────────────────────────────────────────────────────
-- Admin y compras: CRUD completo
CREATE POLICY "admin_compras_productos_all" ON productos
  FOR ALL TO authenticated
  USING     (get_my_rol() IN ('admin', 'compras'))
  WITH CHECK (get_my_rol() IN ('admin', 'compras'));

-- Punto A y B: solo lectura (necesitan el catálogo para el POS)
CREATE POLICY "puntos_productos_select" ON productos
  FOR SELECT TO authenticated
  USING (get_my_rol() IN ('punto_a', 'punto_b'));


-- ── VIAJES_COMPRA ────────────────────────────────────────────────
CREATE POLICY "admin_compras_viajes" ON viajes_compra
  FOR ALL TO authenticated
  USING     (get_my_rol() IN ('admin', 'compras'))
  WITH CHECK (get_my_rol() IN ('admin', 'compras'));


-- ── ITEMS_VIAJE ──────────────────────────────────────────────────
CREATE POLICY "admin_compras_items_viaje" ON items_viaje
  FOR ALL TO authenticated
  USING     (get_my_rol() IN ('admin', 'compras'))
  WITH CHECK (get_my_rol() IN ('admin', 'compras'));


-- ── INVENTARIO ───────────────────────────────────────────────────
-- Admin y compras: ven y modifican todas las ubicaciones
CREATE POLICY "admin_compras_inventario_all" ON inventario
  FOR ALL TO authenticated
  USING     (get_my_rol() IN ('admin', 'compras'))
  WITH CHECK (get_my_rol() IN ('admin', 'compras'));

-- Punto A: solo lectura de su propia ubicación
-- (el POS consulta stock con .eq('ubicacion', 'punto_a'))
CREATE POLICY "punto_a_inventario_select" ON inventario
  FOR SELECT TO authenticated
  USING (get_my_rol() = 'punto_a' AND ubicacion = 'punto_a');

-- Punto B: solo lectura de su propia ubicación
CREATE POLICY "punto_b_inventario_select" ON inventario
  FOR SELECT TO authenticated
  USING (get_my_rol() = 'punto_b' AND ubicacion = 'punto_b');

-- NOTA: Los triggers (SECURITY DEFINER) pueden escribir en inventario
-- sin importar estas políticas. Así funcionan correctamente cuando
-- punto_a registra una venta y el trigger descuenta el stock.


-- ── MOVIMIENTOS_INVENTARIO ───────────────────────────────────────
-- Punto A y B no tienen acceso directo.
-- Todos los registros los crean los triggers (SECURITY DEFINER).

-- Admin: acceso total
CREATE POLICY "admin_movimientos_all" ON movimientos_inventario
  FOR ALL TO authenticated
  USING     (get_my_rol() = 'admin')
  WITH CHECK (get_my_rol() = 'admin');

-- Compras: lectura del historial de movimientos
CREATE POLICY "compras_movimientos_select" ON movimientos_inventario
  FOR SELECT TO authenticated
  USING (get_my_rol() = 'compras');


-- ── VENTAS ───────────────────────────────────────────────────────
-- Admin: ve y modifica ventas de todos los puntos
CREATE POLICY "admin_ventas_all" ON ventas
  FOR ALL TO authenticated
  USING     (get_my_rol() = 'admin')
  WITH CHECK (get_my_rol() = 'admin');

-- Compras: solo lectura para reportes
CREATE POLICY "compras_ventas_select" ON ventas
  FOR SELECT TO authenticated
  USING (get_my_rol() = 'compras');

-- Punto A: CRUD completo, solo ventas de Punto A
CREATE POLICY "punto_a_ventas_all" ON ventas
  FOR ALL TO authenticated
  USING     (get_my_rol() = 'punto_a' AND punto_venta = 'punto_a')
  WITH CHECK (get_my_rol() = 'punto_a' AND punto_venta = 'punto_a');

-- Punto B: CRUD completo, solo ventas de Punto B
CREATE POLICY "punto_b_ventas_all" ON ventas
  FOR ALL TO authenticated
  USING     (get_my_rol() = 'punto_b' AND punto_venta = 'punto_b')
  WITH CHECK (get_my_rol() = 'punto_b' AND punto_venta = 'punto_b');


-- ── ITEMS_VENTA ──────────────────────────────────────────────────
-- Admin: acceso total
CREATE POLICY "admin_items_venta_all" ON items_venta
  FOR ALL TO authenticated
  USING     (get_my_rol() = 'admin')
  WITH CHECK (get_my_rol() = 'admin');

-- Compras: lectura para reportes
CREATE POLICY "compras_items_venta_select" ON items_venta
  FOR SELECT TO authenticated
  USING (get_my_rol() = 'compras');

-- Punto A: CRUD solo en ítems de sus propias ventas
-- El EXISTS verifica que la venta padre pertenezca a punto_a.
-- Al INSERT, la venta ya existe (se inserta primero la cabecera).
CREATE POLICY "punto_a_items_venta_all" ON items_venta
  FOR ALL TO authenticated
  USING (
    get_my_rol() = 'punto_a'
    AND EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = items_venta.venta_id
        AND v.punto_venta = 'punto_a'
    )
  )
  WITH CHECK (
    get_my_rol() = 'punto_a'
    AND EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = items_venta.venta_id
        AND v.punto_venta = 'punto_a'
    )
  );

-- Punto B: CRUD solo en ítems de sus propias ventas
CREATE POLICY "punto_b_items_venta_all" ON items_venta
  FOR ALL TO authenticated
  USING (
    get_my_rol() = 'punto_b'
    AND EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = items_venta.venta_id
        AND v.punto_venta = 'punto_b'
    )
  )
  WITH CHECK (
    get_my_rol() = 'punto_b'
    AND EXISTS (
      SELECT 1 FROM ventas v
      WHERE v.id = items_venta.venta_id
        AND v.punto_venta = 'punto_b'
    )
  );


-- ── TRANSFERENCIAS ───────────────────────────────────────────────
-- Solo admin y compras gestionan transferencias.
-- fn_distribuir_inventario (SECURITY DEFINER) puede insertar
-- transferencias aunque compras no tuviera permiso directo.
CREATE POLICY "admin_compras_transferencias" ON transferencias
  FOR ALL TO authenticated
  USING     (get_my_rol() IN ('admin', 'compras'))
  WITH CHECK (get_my_rol() IN ('admin', 'compras'));


-- ================================================================
-- VERIFICACIÓN POST-EJECUCIÓN
-- ================================================================
-- Corre estas queries en el SQL Editor para confirmar que todo quedó:
--
-- 1. Ver tablas con RLS activo:
--    SELECT tablename, rowsecurity
--    FROM pg_tables
--    WHERE schemaname = 'public' AND rowsecurity = true
--    ORDER BY tablename;
--    → Debe mostrar las 10 tablas
--
-- 2. Ver todas las políticas creadas:
--    SELECT tablename, policyname, cmd
--    FROM pg_policies
--    WHERE schemaname = 'public'
--    ORDER BY tablename, policyname;
--    → Debe mostrar ~17 políticas
--
-- 3. Ver funciones SECURITY DEFINER:
--    SELECT proname, prosecdef
--    FROM pg_proc
--    WHERE proname IN (
--      'get_my_rol', 'fn_upsert_inventario',
--      'fn_trg_items_venta_bajar_inventario', 'fn_trg_viaje_completado',
--      'fn_trg_transferencia_mover_inventario', 'fn_trg_venta_cancelada',
--      'fn_ajustar_inventario', 'fn_distribuir_inventario'
--    );
--    → prosecdef = true para todas
-- ================================================================
