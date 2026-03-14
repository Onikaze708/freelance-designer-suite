# Freelance Designer Suite

MVP fullstack para un diseñador gráfico freelance. Permite:

- gestionar clientes y servicios
- calcular cotizaciones con reglas configurables
- convertir cotizaciones en facturas
- generar PDF de cotizaciones y facturas
- generar código QR desde un enlace de PayPal o PayPal.Me
- guardar todo localmente en JSON

## Stack

- Frontend: React + Vite + Tailwind CSS
- Backend: Node.js + Express
- Persistencia: JSON local
- PDF: `jspdf` + `jspdf-autotable`
- QR: `qrcode`

## Estructura

```text
freelance-designer-suite/
  client/   # app React
  server/   # API Express + almacenamiento local
```

## Instalación

Abre dos terminales en la carpeta del proyecto.

### 1. Instalar dependencias

```bash
npm run install:all
```

Si prefieres hacerlo por separado:

```bash
npm install --prefix server
npm install --prefix client
```

### 2. Iniciar backend

```bash
npm run dev:server
```

El backend queda en `http://localhost:4100`.

### 3. Iniciar frontend

```bash
npm run dev:client
```

La web queda en `http://localhost:5173`.

## Producción local

```bash
npm run build
npm run start
```

## Despliegue en subcarpeta

La configuración actual de Vite ya queda preparada para publicar la app en:

- `https://miamicreativelabs.com/studio`

Valor configurado de base path:

- `APP_BASE_PATH=/studio/`
- valor por defecto actual: `/studio/`

Si alguna vez quieres publicarla en otra subcarpeta, por ejemplo `/app`, puedes generar el build así:

```bash
APP_BASE_PATH=/app/ npm run build
```

En Windows PowerShell:

```powershell
$env:APP_BASE_PATH='/app/'
npm run build
```

### Build final

```bash
npm run build
```

La carpeta lista para subir al hosting es:

- `client/dist`

### Dónde subirla

Si la URL final será:

- `https://miamicreativelabs.com/studio`

entonces sube el contenido de `client/dist` dentro de:

- `public_html/studio`

No subas la carpeta `dist` completa como una subcarpeta adicional. Sube su contenido interno.

### .htaccess

Se incluye un archivo listo para Apache en:

- `client/public/.htaccess`

Ese archivo se copiará automáticamente al build final dentro de `client/dist/.htaccess`.

Su función es:

- respetar archivos reales y assets
- servir `index.html` dentro de `/studio`
- evitar errores si en el futuro agregas rutas internas del lado cliente

## API en producción

El frontend usa por defecto:

- `/api`

También puede configurarse con:

- `VITE_API_BASE_URL`

Ejemplo si tu backend queda en otro origen o ruta:

```bash
VITE_API_BASE_URL=https://miamicreativelabs.com/api npm run build
```

En la configuración actual, si frontend y backend viven bajo el mismo dominio y la API responde en `/api`, no necesitas cambiar nada.

## Privacidad de la carpeta /studio

Si quieres que la aplicación sea privada a nivel de hosting, puedes proteger `public_html/studio` con contraseña desde cPanel o el panel de tu hosting.

Normalmente aparece como alguna de estas opciones:

- `Directory Privacy`
- `Password Protect Directories`
- `Protección por contraseña`

Eso crea autenticación básica antes de cargar la app. Es una capa rápida y útil para un sistema interno.

## Datos locales

- Datos semilla: `server/data/seed-data.json`
- Datos runtime: `server/data/runtime-app-data.json`

El archivo runtime se crea automáticamente en el primer arranque.
