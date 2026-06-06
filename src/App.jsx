import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Layout from './components/layout/Layout'

// Auth
import Login from './pages/Login'

// Dashboard
import Dashboard from './pages/Dashboard'

// Proveedores
import Proveedores      from './pages/Proveedores'
import ProveedorDetalle from './pages/ProveedorDetalle'
import ProveedorForm    from './pages/ProveedorForm'

// Viajes de Compra
import ViajesDeCompra     from './pages/ViajesDeCompra'
import ViajeNuevo         from './pages/ViajeNuevo'
import ViajeDetalle       from './pages/ViajeDetalle'
import ViajePlanificacion from './pages/ViajePlanificacion'
import ViajeRecepcion     from './pages/ViajeRecepcion'

// Inventario
import Inventario             from './pages/Inventario'
import InventarioDistribucion from './pages/InventarioDistribucion'

// Productos
import Productos    from './pages/Productos'
import ProductoForm from './pages/ProductoForm'

// Módulos
import Ventas        from './pages/Ventas'
import Transferencias from './pages/Transferencias'
import Reportes      from './pages/Reportes'
import Usuarios      from './pages/Usuarios'

// Solicitudes de reabastecimiento
import Solicitudes       from './pages/Solicitudes'
import SolicitudNueva    from './pages/SolicitudNueva'
import SolicitudDetalle  from './pages/SolicitudDetalle'

const toastOptions = {
  duration: 3500,
  style: {
    fontSize: '14px',
    borderRadius: '10px',
    background: '#1e293b',
    color: '#f8fafc',
  },
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={toastOptions} />
        <Routes>
          {/* ── Pública ── */}
          <Route path="/login" element={<Login />} />

          {/* ── Protegidas (requieren sesión + rol) ── */}
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />

            {/* Proveedores */}
            <Route path="proveedores"            element={<Proveedores />} />
            <Route path="proveedores/nuevo"      element={<ProveedorForm />} />
            <Route path="proveedores/:id"        element={<ProveedorDetalle />} />
            <Route path="proveedores/:id/editar" element={<ProveedorForm />} />

            {/* Viajes de Compra */}
            <Route path="viajes"                   element={<ViajesDeCompra />} />
            <Route path="viajes/nuevo"             element={<ViajeNuevo />} />
            <Route path="viajes/:id"               element={<ViajeDetalle />} />
            <Route path="viajes/:id/planificacion" element={<ViajePlanificacion />} />
            <Route path="viajes/:id/recepcion"     element={<ViajeRecepcion />} />

            {/* Inventario */}
            <Route path="inventario"              element={<Inventario />} />
            <Route path="inventario/distribucion" element={<InventarioDistribucion />} />

            {/* Productos */}
            <Route path="productos"            element={<Productos />} />
            <Route path="productos/nuevo"      element={<ProductoForm />} />
            <Route path="productos/:id/editar" element={<ProductoForm />} />

            {/* Módulos */}
            <Route path="ventas"         element={<Ventas />} />
            <Route path="transferencias" element={<Transferencias />} />
            <Route path="reportes"       element={<Reportes />} />

            {/* Usuarios (solo admin — el ProtectedRoute verifica el rol en la ruta) */}
            <Route path="usuarios" element={<Usuarios />} />

            {/* Solicitudes de reabastecimiento */}
            <Route path="solicitudes"          element={<Solicitudes />} />
            <Route path="solicitudes/nueva"    element={<SolicitudNueva />} />
            <Route path="solicitudes/:id"      element={<SolicitudDetalle />} />
          </Route>

          {/* Cualquier ruta desconocida → inicio */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
