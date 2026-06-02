# La Pastora — Progreso del Proyecto
*Última actualización: 2026-06-01*

---

## Estado general: 🟡 En construcción — Módulos principales listos

---

## ✅ Completado

### 1. Proyecto base (React + Vite)
- **Stack:** React 19 · Vite 8 · Tailwind CSS 4 · React Router v6
- **Dependencias instaladas:** `react-router-dom`, `@supabase/supabase-js`, `react-hot-toast`, `lucide-react`
- **Carpeta:** `app/`
- **Arrancar:** `cd app && npm install && npm run dev` → `http://localhost:5173`

### 2. Estructura de carpetas
```
app/
├── src/
│   ├── components/layout/
│   │   ├── Layout.jsx       ← wrapper con <Outlet>
│   │   ├── Sidebar.jsx      ← colapsable desktop / drawer móvil
│   │   └── Header.jsx       ← selector de sucursal + usuario
│   ├── lib/
│   │   └── supabase.js      ← cliente listo, espera .env
│   └── pages/
│       ├── Dashboard.jsx
│       ├── Proveedores.jsx
│       ├── ViajesDeCompra.jsx
│       ├── Inventario.jsx
│       ├── Ventas.jsx
│       ├── Transferencias.jsx
│       └── Reportes.jsx
├── database/
│   └── schema.sql           ← script completo para Supabase
├── .env.example             ← copiar a .env y agregar keys
└── .gitignore               ← .env excluido del repo
```

### 3. Layout y navegación
- Sidebar con 7 secciones: Dashboard, Proveedores, Viajes de Compra, Inventario, Ventas, Transferencias, Reportes
- Colapsable en desktop (botón `‹`), drawer deslizable en móvil
- Header con selector de punto de venta (Punto A / Punto B) y avatar de usuario
- Rutas configuradas y funcionales con React Router
- Toasts globales con `react-hot-toast`

### 4. Módulo Proveedores
- Lista responsive con buscador, estrellitas, badge activo, alerta visita vencida
- Formulario crear/editar con StarPicker, validación y toasts
- Vista detalle con historial últimos 5 viajes
- Rutas: `/proveedores`, `/proveedores/nuevo`, `/proveedores/:id`, `/proveedores/:id/editar`

### 5. Módulo Viajes de Compra
- Lista con chips de resumen, filtros por estado y proveedor
- Asistente 4 pasos: info → gastos → productos con costo real → resumen
- Planificación: semáforo de días de stock por producto
- Detalle con acciones según estado (planear / en curso / completado)
- Recepción: ajuste de cantidades, caducidad opcional → trigger actualiza inventario central
- Rutas: `/viajes`, `/viajes/nuevo`, `/viajes/:id`, `/viajes/:id/planificacion`, `/viajes/:id/recepcion`

### 6. Módulo Inventario
- Vista general: tabla + cards + semáforo + filtros
- Ajuste de conteo con confirmación modal
- Historial paginado con filtros y exportación CSV
- Distribución masiva central → puntos con validación y modal de confirmación
- Alertas de stock bajo, próximos a caducar y productos estancados integradas en Dashboard
- `database/inventario_functions.sql` — ✅ ejecutado en Supabase

### 7. Módulo Ventas de Mostrador
- POS pantalla completa mobile-first con selector de punto de venta (guarda en localStorage)
- Buscador de productos con debounce, carrito con +/−, descuento por % o monto fijo
- Cobro: efectivo (cambio automático + botones de billetes), tarjeta, transferencia
- Pantalla de éxito + ticket de impresión (popup monospace)
- Corte de caja: total, desglose por método, productos vendidos, utilidad estimada, imprimir
- Historial: filtros por fecha y punto, tabla desktop / cards mobile
- Detalle de venta + cancelación con motivo (restaura inventario vía trigger)
- `database/ventas_cancelacion.sql` — ✅ ejecutado en Supabase

### 8. Módulo Productos
- Lista con buscador, filtros por categoría y estado, alertas de stock bajo
- Tabla desktop con stock desglosado por Central / Pto. A / Pto. B
- Cards mobile compactas con stock por punto
- Toggle activo/inactivo en línea
- Formulario crear/editar: nombre, categoría (autocompletar), unidad, precio, existencia mínima, días caducidad, activo
- Rutas: `/productos`, `/productos/nuevo`, `/productos/:id/editar`

### 9. Base de datos (Supabase)
- Script en `app/database/schema.sql` — listo para copiar y ejecutar en SQL Editor
- **10 tablas:** `usuarios`, `proveedores`, `productos`, `viajes_compra`, `items_viaje`, `inventario`, `movimientos_inventario`, `ventas`, `items_venta`, `transferencias`
- **20 índices** en columnas de búsqueda frecuente
- **2 vistas:** `inventario_resumen`, `ventas_por_producto_punto`
- **3 triggers automáticos:**
  - `trg_items_venta_bajar_inventario` → descuenta stock al vender
  - `trg_viaje_completado` → sube stock central + prorratea gastos al completar viaje
  - `trg_transferencia_mover_inventario` → mueve stock entre ubicaciones

---

## 🔲 Pendiente (próximos pasos sugeridos)

### Prioridad alta
- [ ] Módulo Transferencias: mover mercancía entre central y puntos de venta (tabla ya existe, falta UI)
- [ ] Módulo Reportes: conectar vistas `inventario_resumen` y `ventas_por_producto_punto`

### Prioridad media
- [ ] Autenticación con Supabase Auth (login, roles por usuario)
- [ ] Row Level Security (RLS) en Supabase según rol

### Prioridad baja / futuro
- [ ] Dashboard con métricas reales (gráficas)
- [ ] PWA / modo offline básico para ventas
- [ ] Deploy (Vercel o Netlify)

---

## Decisiones técnicas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Framework | React + Vite | Velocidad de desarrollo, ecosistema |
| Estilos | Tailwind CSS v4 | Utility-first, mobile-first natural |
| Base de datos | Supabase (PostgreSQL) | Auth + API REST gratis, triggers reales |
| Routing | React Router v6 | Estándar, soporte de layouts anidados |
| Iconos | Lucide React | Ligero, consistente, tree-shakeable |
| Notificaciones | react-hot-toast | Simple, no invasivo |
| UUIDs | `gen_random_uuid()` | Nativo en Postgres 13+, sin extensiones |
| Inventario | Tabla con UNIQUE (producto, ubicacion) | Upserts seguros, un registro por celda |
| Gastos de viaje | Prorrata por valor | Más justo que prorrata por cantidad |

---

## Estructura de la base de datos

```
usuarios ──────────────────────────────────────────────┐
proveedores ──────────┐                                 │
                      ▼                                 │
productos ──── viajes_compra ──── items_viaje           │
    │                │                                  │
    ├──── inventario ◄──── movimientos_inventario ◄─────┤
    │                                                   │
    ├──── ventas ──── items_venta ───────────────────── ┘
    │         │
    └──── transferencias
```

---

## Cómo retomar el desarrollo

```bash
# 1. Ir a la carpeta del proyecto
cd ~/Documents/La\ Pastora/app

# 2. Instalar dependencias (solo la primera vez o si se borró node_modules)
npm install

# 3. Configurar Supabase
cp .env.example .env
# Editar .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY

# 4. Arrancar
npm run dev
```

### Variables de entorno necesarias
```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```
*(Las encuentras en: Supabase → tu proyecto → Settings → API)*
