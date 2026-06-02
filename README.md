# La Pastora — Sistema de Gestión

Aplicación web para gestión de inventario, compras, ventas y reportes de La Pastora. Construida con React + Vite + Tailwind CSS + Supabase.

---

## Requisitos

- Node.js 18 o superior
- npm 9 o superior
- Una cuenta en [Supabase](https://supabase.com) con el proyecto ya configurado (schema ejecutado)

---

## 1. Configurar variables de entorno

Copia el archivo de ejemplo y llena tus credenciales de Supabase:

```bash
cp .env.example .env
```

Abre `.env` y completa los valores:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

> **¿Dónde encuentro estas credenciales?**
> En el panel de Supabase: **Project Settings → API**.
> Copia la *Project URL* y la *anon / public key*.

---

## 2. Instalar dependencias

```bash
npm install
```

---

## 3. Correr en desarrollo

```bash
npm run dev
```

La app abre en `http://localhost:5173` por defecto.

---

## 4. Primer usuario (admin)

Antes de poder iniciar sesión necesitas crear el primer usuario administrador:

1. Ve a tu proyecto en [supabase.com](https://supabase.com).
2. Entra a **Authentication → Users** y crea un usuario con email y contraseña.
3. Luego ve a **Table Editor → usuarios** e inserta una fila:

   | campo   | valor                         |
   |---------|-------------------------------|
   | nombre  | Tu nombre                     |
   | email   | el mismo email del paso 2     |
   | rol     | `admin`                       |
   | activo  | `true`                        |

4. Ahora puedes entrar en la app con esas credenciales.

> Una vez dentro, puedes crear más usuarios desde **Menú de usuario → Administrar usuarios**.

---

## 5. Build de producción

```bash
npm run build
```

Los archivos optimizados quedan en la carpeta `dist/`.

Para probar el build localmente antes de desplegar:

```bash
npm run preview
```

---

## 6. Desplegar en Netlify

### Opción A — Drag & Drop (más rápido)

1. Corre `npm run build`.
2. Ve a [app.netlify.com](https://app.netlify.com) → **Add new site → Deploy manually**.
3. Arrastra la carpeta `dist/` al área indicada.
4. Una vez desplegado, ve a **Site configuration → Environment variables** y agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Vuelve a hacer deploy (o agrega las variables antes del primer build en CI).

### Opción B — Conectar repositorio Git

1. Sube el proyecto a GitHub / GitLab.
2. En Netlify: **Add new site → Import an existing project**.
3. Selecciona el repositorio.
4. Configura el build:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Agrega las variables de entorno en **Site configuration → Environment variables**.
6. Netlify redesplegará automáticamente en cada `git push`.

### Configurar rutas en Netlify (importante para React Router)

Crea el archivo `public/_redirects` con el siguiente contenido:

```
/*  /index.html  200
```

Esto evita errores 404 al recargar la página en rutas como `/ventas` o `/inventario`.

---

## Estructura del proyecto

```
src/
├── context/
│   └── AuthContext.jsx       ← Sesión Supabase + perfil de usuario
├── lib/
│   ├── supabase.js           ← Cliente Supabase
│   ├── permissions.js        ← Roles y control de acceso
│   ├── format.js             ← Utilidades de formato
│   ├── productos.js
│   ├── inventario.js
│   ├── ventas.js
│   ├── transferencias.js
│   └── reportes.js
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.jsx
│   ├── layout/
│   │   ├── Layout.jsx
│   │   ├── Header.jsx
│   │   ├── Sidebar.jsx
│   │   └── Breadcrumbs.jsx
│   └── inventario/
│       └── AlertasInventario.jsx
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── Proveedores.jsx / ProveedorDetalle.jsx / ProveedorForm.jsx
│   ├── ViajesDeCompra.jsx / ViajeNuevo.jsx / ViajeDetalle.jsx / ...
│   ├── Inventario.jsx / InventarioDistribucion.jsx
│   ├── Productos.jsx / ProductoForm.jsx
│   ├── Ventas.jsx
│   ├── Transferencias.jsx
│   ├── Reportes.jsx
│   └── Usuarios.jsx
└── App.jsx
```

---

## Roles de usuario

| Rol       | Acceso                                                                 |
|-----------|------------------------------------------------------------------------|
| `admin`   | Todo, incluida la administración de usuarios                           |
| `compras` | Proveedores, Viajes, Inventario, Productos, Transferencias, Reportes   |
| `punto_a` | Ventas (Punto A) e Inventario (solo lectura Punto A)                   |
| `punto_b` | Ventas (Punto B) e Inventario (solo lectura Punto B)                   |

---

## Base de datos

El schema SQL completo está en `database/schema.sql`. Las funciones adicionales (inventario y ventas) están en:

- `database/inventario_functions.sql`
- `database/ventas_cancelacion.sql`

Ejecútalos en orden en **Supabase → SQL Editor** si es un proyecto nuevo.
