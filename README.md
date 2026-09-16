# Presupuesto Familiar PWA

Aplicación web tipo app (PWA) para gestionar finanzas familiares, cuentas bancarias, presupuestos y movimientos, con almacenamiento local en el dispositivo a través de IndexedDB.

## Características

- Diseño adaptado a móvil y escritorio.
- PWA instalable en iPhone/Android.
- Almacenamiento local con IndexedDB.
- Cálculo de presupuesto, gastos, ingresos y proyección de ahorro.
- Compatibilidad con GitHub Pages mediante Vite y despliegue con GitHub Actions.

## Requisitos

- Node.js 20+
- npm

## Desarrollo local

```bash
npm install
npm run dev
```

## Producción

```bash
npm run build
npm run preview
```

## Despliegue en GitHub Pages

1. Sube este repositorio a GitHub.
2. En la configuración del repositorio, activa GitHub Pages con la fuente de "GitHub Actions".
3. Haz push a la rama `main`.
4. La acción en `.github/workflows/deploy-pages.yml` compilará la app y la desplegará automáticamente.

## Nota

La app guarda los datos directamente en la base local del navegador (IndexedDB), por lo que cada dispositivo mantiene su propia información.
