-- ═══════════════════════════════════════════════════════════════
--  Solicitudes de Reabastecimiento — La Pastora
--  Ejecutar en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── Tabla principal ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes_reabastecimiento (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha         timestamptz NOT NULL    DEFAULT now(),
  solicitante_id uuid       NOT NULL    REFERENCES usuarios(id),
  punto_venta   text        NOT NULL    CHECK (punto_venta IN ('punto_a', 'punto_b')),
  estado        text        NOT NULL    DEFAULT 'pendiente'
                            CHECK (estado IN ('pendiente', 'revisada', 'aprobada', 'rechazada')),
  notas         text,                   -- Notas del solicitante
  notas_admin   text,                   -- Respuesta / notas del admin
  updated_at    timestamptz NOT NULL    DEFAULT now()
);

-- ─── Items de cada solicitud ───────────────────────────────────
CREATE TABLE IF NOT EXISTS items_solicitud (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id        uuid    NOT NULL    REFERENCES solicitudes_reabastecimiento(id) ON DELETE CASCADE,
  producto_id         uuid    NOT NULL    REFERENCES productos(id),
  cantidad_solicitada numeric NOT NULL    CHECK (cantidad_solicitada > 0),
  cantidad_aprobada   numeric,           -- null = aún no revisada
  notas               text
);

-- ─── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado        ON solicitudes_reabastecimiento(estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_punto_venta   ON solicitudes_reabastecimiento(punto_venta);
CREATE INDEX IF NOT EXISTS idx_solicitudes_solicitante   ON solicitudes_reabastecimiento(solicitante_id);
CREATE INDEX IF NOT EXISTS idx_items_solicitud_solicitud ON items_solicitud(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_items_solicitud_producto  ON items_solicitud(producto_id);

-- ─── Trigger updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_solicitudes_updated_at ON solicitudes_reabastecimiento;
CREATE TRIGGER trg_solicitudes_updated_at
  BEFORE UPDATE ON solicitudes_reabastecimiento
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ─── RLS (Row Level Security) ─────────────────────────────────
-- Habilitar RLS
ALTER TABLE solicitudes_reabastecimiento ENABLE ROW LEVEL SECURITY;
ALTER TABLE items_solicitud              ENABLE ROW LEVEL SECURITY;

-- Política: admin ve todo
CREATE POLICY "admin_all_solicitudes" ON solicitudes_reabastecimiento
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
  );

CREATE POLICY "admin_all_items_solicitud" ON items_solicitud
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid() AND rol = 'admin' AND activo = true
    )
  );

-- Política: punto_a/punto_b solo ve sus propias solicitudes
CREATE POLICY "punto_own_solicitudes" ON solicitudes_reabastecimiento
  FOR ALL USING (solicitante_id = auth.uid());

CREATE POLICY "punto_own_items_solicitud" ON items_solicitud
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM solicitudes_reabastecimiento s
      WHERE s.id = solicitud_id AND s.solicitante_id = auth.uid()
    )
  );
