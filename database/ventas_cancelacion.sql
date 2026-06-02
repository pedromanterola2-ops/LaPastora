-- ================================================================
-- LA PASTORA — Extensión para cancelación de ventas
-- Ejecutar DESPUÉS de schema.sql (añade columnas y trigger)
-- ================================================================

-- Agrega soporte de estado/cancelación a la tabla ventas
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'completada'
    CHECK (estado IN ('completada', 'cancelada')),
  ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;

CREATE INDEX IF NOT EXISTS idx_ventas_estado ON ventas(estado);

-- ── Trigger: restaurar inventario al cancelar una venta ───────
CREATE OR REPLACE FUNCTION fn_trg_venta_cancelada()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'cancelada' AND OLD.estado <> 'cancelada' THEN

    -- Devolver stock a cada ítem de la venta
    PERFORM fn_upsert_inventario(iv.producto_id, OLD.punto_venta, iv.cantidad)
    FROM items_venta iv
    WHERE iv.venta_id = NEW.id;

    -- Registrar movimientos de devolución
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

DROP TRIGGER IF EXISTS trg_venta_cancelada ON ventas;
CREATE TRIGGER trg_venta_cancelada
  AFTER UPDATE OF estado ON ventas
  FOR EACH ROW
  EXECUTE FUNCTION fn_trg_venta_cancelada();

COMMENT ON FUNCTION fn_trg_venta_cancelada
  IS 'Restaura el inventario en el punto de venta cuando una venta se cancela';
