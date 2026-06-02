-- ================================================================
-- LA PASTORA — Schema completo para Supabase
-- Tienda de reventa | 2 puntos de venta: Punto A y Punto B
-- ================================================================
-- Ejecutar en: Supabase → SQL Editor → New Query → Paste → Run
-- ================================================================


-- ================================================================
-- 1. TABLAS
-- ================================================================

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT        NOT NULL,
  email         TEXT        NOT NULL UNIQUE,
  rol           TEXT        NOT NULL DEFAULT 'punto_a'
                            CHECK (rol IN ('admin', 'compras', 'punto_a', 'punto_b')),
  activo        BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  usuarios          IS 'Usuarios del sistema con sus roles de acceso';
COMMENT ON COLUMN usuarios.rol      IS 'admin=acceso total | compras=viajes y proveedores | punto_a/punto_b=ventas de su sucursal';

-- ------------------------------------------------------------
-- proveedores
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proveedores (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                   TEXT        NOT NULL,
  ciudad                   TEXT,
  tipo_productos            TEXT,
  frecuencia_visita_dias   INTEGER     CHECK (frecuencia_visita_dias > 0),
  condiciones_pago         TEXT,
  tiempo_traslado_horas    NUMERIC(5,1) CHECK (tiempo_traslado_horas >= 0),
  calificacion             SMALLINT    CHECK (calificacion BETWEEN 1 AND 5),
  notas                    TEXT,
  activo                   BOOLEAN     NOT NULL DEFAULT true,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE proveedores IS 'Proveedores externos de mercancía';

-- ------------------------------------------------------------
-- productos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS productos (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre                  TEXT        NOT NULL,
  categoria               TEXT,
  unidad_venta            TEXT        NOT NULL DEFAULT 'pieza',
  precio_venta            NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (precio_venta >= 0),
  existencia_minima       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (existencia_minima >= 0),
  dias_caducidad_estimado INTEGER     CHECK (dias_caducidad_estimado > 0),
  activo                  BOOLEAN     NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  productos                       IS 'Catálogo de productos para reventa';
COMMENT ON COLUMN productos.existencia_minima     IS 'Umbral de alerta de stock bajo por ubicación';
COMMENT ON COLUMN productos.dias_caducidad_estimado IS 'Días de vida útil estimados desde la compra';

-- ------------------------------------------------------------
-- viajes_compra
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS viajes_compra (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha             DATE        NOT NULL DEFAULT CURRENT_DATE,
  proveedor_id      UUID        NOT NULL REFERENCES proveedores(id) ON DELETE RESTRICT,
  gastos_gasolina   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gastos_gasolina >= 0),
  gastos_casetas    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gastos_casetas >= 0),
  gastos_comida     NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gastos_comida >= 0),
  gastos_hospedaje  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gastos_hospedaje >= 0),
  gastos_otros      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (gastos_otros >= 0),
  estado            TEXT        NOT NULL DEFAULT 'planeado'
                                CHECK (estado IN ('planeado', 'en_curso', 'completado')),
  notas             TEXT,
  usuario_id        UUID        REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  viajes_compra          IS 'Viajes de compra a proveedores (incluye gastos de traslado)';
COMMENT ON COLUMN viajes_compra.estado   IS 'planeado→en_curso→completado. Al pasar a completado se actualizan inventarios';

-- ------------------------------------------------------------
-- items_viaje
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items_viaje (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  viaje_id                UUID          NOT NULL REFERENCES viajes_compra(id) ON DELETE CASCADE,
  producto_id             UUID          NOT NULL REFERENCES productos(id)     ON DELETE RESTRICT,
  cantidad                NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario_compra  NUMERIC(10,2) NOT NULL CHECK (precio_unitario_compra >= 0),
  -- Calculados automáticamente por trigger al completar el viaje:
  costo_traslado_asignado NUMERIC(12,4) NOT NULL DEFAULT 0,
  costo_real_unitario     NUMERIC(12,4) NOT NULL DEFAULT 0
);

COMMENT ON TABLE  items_viaje                         IS 'Detalle de productos comprados en cada viaje';
COMMENT ON COLUMN items_viaje.costo_traslado_asignado IS 'Porción de gastos del viaje asignada a este item (prorrata por valor)';
COMMENT ON COLUMN items_viaje.costo_real_unitario     IS 'precio_unitario_compra + costo_traslado por unidad';

-- ------------------------------------------------------------
-- inventario
-- El par (producto_id, ubicacion) es único → permite upserts seguros
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventario (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id          UUID          NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  ubicacion            TEXT          NOT NULL DEFAULT 'central'
                                     CHECK (ubicacion IN ('central', 'punto_a', 'punto_b')),
  cantidad             NUMERIC(10,2) NOT NULL DEFAULT 0,
  ultima_actualizacion TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (producto_id, ubicacion)
);

COMMENT ON TABLE inventario IS 'Existencias actuales por producto y ubicación. Se actualiza vía triggers.';

-- ------------------------------------------------------------
-- movimientos_inventario
-- Ledger inmutable de todos los cambios de inventario
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS movimientos_inventario (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id      UUID          NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  tipo             TEXT          NOT NULL
                                 CHECK (tipo IN (
                                   'entrada_compra',
                                   'salida_venta',
                                   'transferencia',
                                   'ajuste_merma',
                                   'ajuste_conteo',
                                   'distribucion'
                                 )),
  cantidad         NUMERIC(10,2) NOT NULL,  -- positivo=entrada, negativo=salida
  ubicacion_origen TEXT          CHECK (ubicacion_origen IN ('central', 'punto_a', 'punto_b')),
  ubicacion_destino TEXT         CHECK (ubicacion_destino IN ('central', 'punto_a', 'punto_b')),
  referencia_id    UUID,           -- id del documento origen (venta, viaje, transferencia…)
  referencia_tipo  TEXT,           -- 'venta' | 'viaje_compra' | 'transferencia' | 'ajuste'
  fecha            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  usuario_id       UUID          REFERENCES usuarios(id) ON DELETE SET NULL,
  notas            TEXT
);

COMMENT ON TABLE  movimientos_inventario          IS 'Registro histórico e inmutable de todos los movimientos de stock';
COMMENT ON COLUMN movimientos_inventario.cantidad IS 'Cantidad movida (siempre positiva; la dirección la indica tipo+origen/destino)';

-- ------------------------------------------------------------
-- ventas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ventas (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  punto_venta    TEXT          NOT NULL CHECK (punto_venta IN ('punto_a', 'punto_b')),
  subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  descuento_total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (descuento_total >= 0),
  total          NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  metodo_pago    TEXT          NOT NULL DEFAULT 'efectivo'
                               CHECK (metodo_pago IN ('efectivo', 'tarjeta', 'transferencia')),
  usuario_id     UUID          REFERENCES usuarios(id) ON DELETE SET NULL,
  notas          TEXT,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ventas IS 'Cabecera de cada transacción de venta en un punto de venta';

-- ------------------------------------------------------------
-- items_venta
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items_venta (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id       UUID          NOT NULL REFERENCES ventas(id)    ON DELETE CASCADE,
  producto_id    UUID          NOT NULL REFERENCES productos(id)  ON DELETE RESTRICT,
  cantidad       NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  descuento      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0)
);

COMMENT ON TABLE items_venta IS 'Líneas de detalle de cada venta. El trigger descuenta inventario automáticamente al insertar.';

-- ------------------------------------------------------------
-- transferencias
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transferencias (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  producto_id UUID          NOT NULL REFERENCES productos(id) ON DELETE RESTRICT,
  cantidad    NUMERIC(10,2) NOT NULL CHECK (cantidad > 0),
  origen      TEXT          NOT NULL CHECK (origen  IN ('central', 'punto_a', 'punto_b')),
  destino     TEXT          NOT NULL CHECK (destino IN ('central', 'punto_a', 'punto_b')),
  motivo      TEXT,
  usuario_id  UUID          REFERENCES usuarios(id) ON DELETE SET NULL,
  notas       TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CHECK (origen <> destino)   -- no se puede transferir a la misma ubicación
);

COMMENT ON TABLE transferencias IS 'Movimientos de mercancía entre ubicaciones. El trigger actualiza inventarios automáticamente.';


-- ================================================================
-- 2. ÍNDICES
-- ================================================================

-- items_viaje
CREATE INDEX IF NOT EXISTS idx_items_viaje_viaje_id    ON items_viaje(viaje_id);
CREATE INDEX IF NOT EXISTS idx_items_viaje_producto_id ON items_viaje(producto_id);

-- viajes_compra
CREATE INDEX IF NOT EXISTS idx_viajes_fecha            ON viajes_compra(fecha);
CREATE INDEX IF NOT EXISTS idx_viajes_proveedor_id     ON viajes_compra(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_viajes_estado           ON viajes_compra(estado);

-- inventario
CREATE INDEX IF NOT EXISTS idx_inventario_producto_id  ON inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_inventario_ubicacion    ON inventario(ubicacion);

-- movimientos_inventario
CREATE INDEX IF NOT EXISTS idx_mov_producto_id         ON movimientos_inventario(producto_id);
CREATE INDEX IF NOT EXISTS idx_mov_fecha               ON movimientos_inventario(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_mov_tipo                ON movimientos_inventario(tipo);
CREATE INDEX IF NOT EXISTS idx_mov_referencia          ON movimientos_inventario(referencia_id) WHERE referencia_id IS NOT NULL;

-- ventas
CREATE INDEX IF NOT EXISTS idx_ventas_fecha            ON ventas(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_punto_venta      ON ventas(punto_venta);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha_punto      ON ventas(fecha DESC, punto_venta);

-- items_venta
CREATE INDEX IF NOT EXISTS idx_items_venta_venta_id    ON items_venta(venta_id);
CREATE INDEX IF NOT EXISTS idx_items_venta_producto_id ON items_venta(producto_id);

-- transferencias
CREATE INDEX IF NOT EXISTS idx_transf_fecha            ON transferencias(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_transf_producto_id      ON transferencias(producto_id);
CREATE INDEX IF NOT EXISTS idx_transf_origen           ON transferencias(origen);
CREATE INDEX IF NOT EXISTS idx_transf_destino          ON transferencias(destino);


-- ================================================================
-- 3. VISTAS
-- ================================================================

-- ------------------------------------------------------------
-- inventario_resumen
-- Stock por producto desglosado por ubicación + alertas de mínimo
-- ------------------------------------------------------------
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
  -- Alerta: alguna ubicación no-central está bajo mínimo
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

COMMENT ON VIEW inventario_resumen IS 'Existencias actuales por producto y ubicación, con alerta de stock bajo';

-- ------------------------------------------------------------
-- ventas_por_producto_punto
-- Cuánto se vendió de cada producto por punto y por mes
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW ventas_por_producto_punto AS
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

COMMENT ON VIEW ventas_por_producto_punto IS 'Resumen mensual de ventas por producto y punto de venta';


-- ================================================================
-- 4. FUNCIONES AUXILIARES
-- ================================================================

-- ------------------------------------------------------------
-- fn_upsert_inventario
-- Incrementa (delta > 0) o decrementa (delta < 0) el stock.
-- Si no existe la fila la crea; nunca deja cantidad < 0.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_upsert_inventario(
  p_producto_id UUID,
  p_ubicacion   TEXT,
  p_delta       NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO inventario (producto_id, ubicacion, cantidad, ultima_actualizacion)
  VALUES (p_producto_id, p_ubicacion, GREATEST(p_delta, 0), NOW())
  ON CONFLICT (producto_id, ubicacion) DO UPDATE
    SET cantidad             = GREATEST(inventario.cantidad + p_delta, 0),
        ultima_actualizacion = NOW();
END;
$$;

COMMENT ON FUNCTION fn_upsert_inventario IS 'Upsert seguro de inventario: crea la fila si no existe y nunca baja de 0';


-- ================================================================
-- 5. TRIGGERS
-- ================================================================

-- ── Trigger 1: items_venta ────────────────────────────────────
-- Al insertar una línea de venta → baja el stock en el punto
-- correspondiente y registra el movimiento.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_trg_items_venta_bajar_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_punto_venta TEXT;
BEGIN
  -- Leer el punto de venta de la cabecera
  SELECT punto_venta INTO v_punto_venta
  FROM ventas
  WHERE id = NEW.venta_id;

  IF v_punto_venta IS NULL THEN
    RAISE EXCEPTION 'No se encontró la venta % al intentar actualizar inventario', NEW.venta_id;
  END IF;

  -- Descontar stock
  PERFORM fn_upsert_inventario(NEW.producto_id, v_punto_venta, -NEW.cantidad);

  -- Registrar movimiento
  INSERT INTO movimientos_inventario
    (producto_id, tipo, cantidad, ubicacion_origen, referencia_id, referencia_tipo)
  VALUES
    (NEW.producto_id, 'salida_venta', NEW.cantidad, v_punto_venta, NEW.venta_id, 'venta');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_items_venta_bajar_inventario
  AFTER INSERT ON items_venta
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_items_venta_bajar_inventario();

COMMENT ON FUNCTION fn_trg_items_venta_bajar_inventario IS 'Trigger: descuenta inventario en el punto de venta al registrar una línea de venta';


-- ── Trigger 2: viajes_compra ──────────────────────────────────
-- Al pasar el estado a "completado" →
--   a) Prorratea los gastos de viaje entre los items
--   b) Calcula costo_real_unitario de cada item
--   c) Sube el stock en bodega central
--   d) Registra los movimientos de entrada
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_trg_viaje_completado()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
  v_item           RECORD;
  v_total_gastos   NUMERIC;
  v_total_compra   NUMERIC;
  v_costo_traslado NUMERIC;
  v_costo_real     NUMERIC;
BEGIN
  -- Solo actuar cuando el estado cambia a 'completado'
  IF (OLD.estado IS DISTINCT FROM 'completado') AND NEW.estado = 'completado' THEN

    -- 1. Total de gastos del viaje
    v_total_gastos :=
        COALESCE(NEW.gastos_gasolina,  0)
      + COALESCE(NEW.gastos_casetas,   0)
      + COALESCE(NEW.gastos_comida,    0)
      + COALESCE(NEW.gastos_hospedaje, 0)
      + COALESCE(NEW.gastos_otros,     0);

    -- 2. Valor total de la compra (base para la prorrata)
    SELECT COALESCE(SUM(cantidad * precio_unitario_compra), 0)
    INTO   v_total_compra
    FROM   items_viaje
    WHERE  viaje_id = NEW.id;

    -- 3. Procesar cada item
    FOR v_item IN
      SELECT * FROM items_viaje WHERE viaje_id = NEW.id
    LOOP
      -- Prorrateo: qué porción de los gastos corresponde a este item
      IF v_total_compra > 0 THEN
        v_costo_traslado := v_total_gastos
          * (v_item.cantidad * v_item.precio_unitario_compra / v_total_compra);
      ELSE
        v_costo_traslado := 0;
      END IF;

      -- Costo real por unidad = compra + traslado / unidades
      IF v_item.cantidad > 0 THEN
        v_costo_real := v_item.precio_unitario_compra
                      + (v_costo_traslado / v_item.cantidad);
      ELSE
        v_costo_real := v_item.precio_unitario_compra;
      END IF;

      -- Guardar costos calculados en el item
      UPDATE items_viaje
      SET costo_traslado_asignado = ROUND(v_costo_traslado, 4),
          costo_real_unitario     = ROUND(v_costo_real,     4)
      WHERE id = v_item.id;

      -- Aumentar stock en bodega central
      PERFORM fn_upsert_inventario(v_item.producto_id, 'central', v_item.cantidad);

      -- Registrar entrada en el historial
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

CREATE TRIGGER trg_viaje_completado
  AFTER UPDATE OF estado ON viajes_compra
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_viaje_completado();

COMMENT ON FUNCTION fn_trg_viaje_completado IS 'Trigger: al completar un viaje prorratea gastos, actualiza costos y sube stock en central';


-- ── Trigger 3: transferencias ─────────────────────────────────
-- Al insertar una transferencia → descuenta en origen,
-- suma en destino y registra el movimiento.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_trg_transferencia_mover_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  -- Bajar en origen
  PERFORM fn_upsert_inventario(NEW.producto_id, NEW.origen,  -NEW.cantidad);

  -- Subir en destino
  PERFORM fn_upsert_inventario(NEW.producto_id, NEW.destino,  NEW.cantidad);

  -- Registrar movimiento
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

CREATE TRIGGER trg_transferencia_mover_inventario
  AFTER INSERT ON transferencias
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_transferencia_mover_inventario();

COMMENT ON FUNCTION fn_trg_transferencia_mover_inventario IS 'Trigger: al registrar una transferencia mueve stock entre ubicaciones automáticamente';


-- ================================================================
-- 6. DATOS SEMILLA (opcionales, borrar si no se necesitan)
-- ================================================================

-- Usuario administrador inicial
INSERT INTO usuarios (nombre, email, rol)
VALUES ('Administrador', 'admin@lapastora.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ================================================================
-- FIN DEL SCRIPT
-- ================================================================
-- Verificación rápida post-ejecución:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
--
--   SELECT viewname FROM pg_views WHERE schemaname = 'public';
--
--   SELECT trigger_name, event_manipulation, event_object_table
--   FROM information_schema.triggers WHERE trigger_schema = 'public'
--   ORDER BY event_object_table;
-- ================================================================
