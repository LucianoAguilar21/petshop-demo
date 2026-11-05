# PetShop Manager

**Versión:** 0.3.0  
**Estado:** demo navegable con catálogo, punto de venta, reportes de ventas y consulta de movimientos generados por ventas.  
**Moneda:** pesos argentinos (ARS)

PetShop Manager es una aplicación web local para administrar un pet shop pequeño. Contempla alimentos vendidos a granel por importe o peso y artículos vendidos por unidad.

## 1. Decisiones del proyecto

- Aplicación web responsive para computadora y celular.
- Interfaz en español y moneda ARS.
- Sin inicio de sesión, registro, backend ni servidor de aplicación.
- Persistencia local mediante IndexedDB.
- Productos `BULK` (a granel) y `UNIT` (por unidad).
- Respaldo JSON/CSV: actualmente el JSON cubre solo catálogo y configuración; CSV está disponible para productos, ventas y movimientos mediante sus respectivas pantallas cuando corresponda.

## 2. Tecnologías

- React 18
- TypeScript 5
- Vite 6
- CSS propio
- Lucide React
- IndexedDB API del navegador

## 3. Funcionalidades implementadas

### Interfaz y navegación

- Diseño responsive con menú lateral y navegación móvil.
- Dashboard, Nueva venta, Productos e inventario, Compras y proveedores, Reportes, Movimientos y Configuración.
- Compras y proveedores continúa siendo una pantalla informativa pendiente de desarrollo.

### Dashboard

- Productos activos y productos con stock bajo.
- Valor estimado del inventario a costo.
- Lista resumida de productos que necesitan reposición.
- Ventas del día y ganancia bruta estimada del día, calculadas desde las ventas registradas.

### Productos e inventario

- Alta, edición, búsqueda y eliminación de productos.
- Categorías iniciales: alimento para perros, alimento para gatos, accesorios, higiene, juguetes y otros.
- Campos: nombre, categoría, modalidad, costo, precio de venta, stock y stock mínimo.
- Indicador de stock bajo cuando `stock <= minimumStock`.
- La modalidad de venta no se puede cambiar después de crear el producto.
- Para `BULK`, costo y precio se expresan por kg; stock y mínimo se almacenan en gramos enteros.
- Para `UNIT`, costo y precio se expresan por unidad; stock y mínimo son unidades enteras.

### Punto de venta

- Búsqueda de productos activos.
- Carrito que agrupa líneas del mismo producto.
- Venta BULK por importe en pesos: calcula y redondea la cantidad a gramos enteros.
- Venta BULK por cantidad en kilogramos.
- Venta UNIT por cantidad entera.
- Ajuste de cantidad desde el carrito: pasos de 100 g para granel y 1 unidad para artículos.
- Medios de pago: efectivo, transferencia, débito, crédito y otro.
- Cálculo de subtotal, costo estimado y ganancia bruta estimada.
- Historial persistente de ventas.
- Cada detalle conserva nombre, tipo, cantidad, precio y costo de la operación.

### Movimientos de stock

- Consulta del historial de movimientos generados automáticamente al confirmar ventas.
- Registro de producto, tipo, fecha, cantidad, stock anterior, stock posterior, motivo y referencia de venta.
- Filtros por texto, tipo de movimiento y período.
- Formulario de ajustes manuales positivos y negativos, con motivo obligatorio y validación para impedir stock negativo.
- Cada ajuste actualiza el producto y crea su movimiento en una transacción IndexedDB.
- Exportación CSV del resultado filtrado.
- Se conserva el tipo de producto en los movimientos nuevos para interpretar cantidades aunque el producto ya no esté en el catálogo.
- **Alcance actual:** todavía no hay entradas por compras ni devoluciones. Los ajustes manuales sí están disponibles y quedan auditados.

### Reportes

- Filtro de fechas desde/hasta, con accesos rápidos a hoy y este mes.
- Ventas totales, costo de mercadería, ganancia bruta estimada y cantidad de ventas.
- Productos más vendidos ordenados por facturación.
- Ventas por medio de pago.
- Ticket promedio.
- Facturación diaria de hasta siete días con ventas dentro del período.
- Resumen del inventario actual: productos activos, stock bajo y margen bruto del período.
- Exportación CSV del detalle de ventas filtradas.
- La ganancia informada es bruta estimada; no descuenta gastos fijos, impuestos, comisiones ni otros costos operativos.
- Los reportes de compras y rentabilidad integral quedan pendientes hasta implementar compras y gastos.

### Persistencia local

- Base IndexedDB `petshop-manager`, versión 2.
- Object stores: `products`, `sales` y `movements`.
- Índices por nombre de producto, fecha de venta, producto de movimiento y fecha de movimiento.
- Migración desde versión 1 que conserva el catálogo y agrega los stores de ventas y movimientos.
- Carga inicial de cuatro productos ficticios solo si el catálogo está vacío.

### Operación atómica de venta

Al confirmar una venta, IndexedDB abre una transacción `readwrite` sobre productos, ventas y movimientos. El stock se vuelve a leer desde la base de datos, se valida disponibilidad, se descuenta, se guarda la venta y se crean los movimientos. La operación se confirma completa o se aborta.

### Importación y exportación

- Exportación JSON de productos y configuración.
- Importación JSON de catálogo con validación básica de campos, cantidades, precios e IDs duplicados antes de reemplazar productos.
- Exportación CSV del catálogo.
- Exportación CSV de ventas filtradas desde Reportes.
- Exportación CSV de movimientos filtrados desde Movimientos.
- **Importante:** el JSON actual no es un respaldo integral; todavía no incluye ventas, movimientos, compras ni proveedores.

## 4. Estructura del proyecto

```text
petshop-manager/
├── index.html
├── package.json
├── README.md
├── PROMPT_CONTINUACION_OPENCODE.md
├── .gitignore
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── db.ts
    ├── main.tsx
    ├── styles.css
    └── types.ts
```

## 5. Modelo de producto

```ts
export type ProductType = "BULK" | "UNIT";

export interface Product {
  id: string;
  name: string;
  category: string;
  type: ProductType;
  costPrice: number;    // ARS/kg si BULK; ARS/unidad si UNIT
  salePrice: number;    // ARS/kg si BULK; ARS/unidad si UNIT
  stock: number;        // gramos si BULK; unidades si UNIT
  minimumStock: number; // gramos si BULK; unidades si UNIT
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
```

## 6. Modelo de ventas y movimientos

Las ventas almacenan fecha, productos, cantidades base, precio, costo, subtotal, costo total, ganancia bruta y medio de pago. Los valores de cada línea son snapshots de la operación y no deben recalcularse al cambiar el producto.

Los movimientos almacenan cantidad con signo (negativa para salidas y positiva para entradas), stock anterior y posterior, motivo y referencia a la operación. `productType` es opcional para mantener compatibilidad con movimientos creados en la versión 0.2.0; los nuevos movimientos lo incluyen.

## 7. Instalación y ejecución

Requisitos: Node.js 20 o superior y npm.

```bash
npm install
npm run dev
```

Compilar y previsualizar:

```bash
npm run build
npm run preview
```

Abrir la dirección local que informa Vite, normalmente `http://localhost:5173`.

## 8. Datos y precauciones

IndexedDB queda asociado al navegador, perfil y dispositivo donde se usa la aplicación. No hay sincronización automática entre equipos. Borrar los datos del sitio o perder el dispositivo puede hacer que la información deje de estar disponible.

Antes de cargar información comercial real, conservar copias externas y recordar que el JSON actual solo respalda el catálogo. No se debe interpretar la ganancia bruta como utilidad neta.

Los productos iniciales son ficticios; editarlos o eliminarlos antes de utilizar el sistema con datos reales.

## 9. Pendientes y próximos pasos

1. **Compras y proveedores:** alta de proveedores, registro de compras, detalle de artículos, costos, fecha y actualización de existencias.
2. **Costo promedio ponderado:** actualizar el costo de cada producto a partir de stock y compras nuevas.
3. **Movimientos completos:** entradas por compras, ajustes positivos/negativos con motivo, devoluciones y filtros ampliados.
4. **Respaldo integral JSON:** exportar y restaurar productos, ventas, movimientos, compras, proveedores e información de configuración con validación y confirmación.
5. **CSV por entidad:** exportaciones separadas de compras, proveedores y otros registros.
6. **Mejoras del POS:** edición libre de cantidades, descuentos, pagos mixtos, cambio, impresión de ticket y anulación/devolución controlada.
7. **Pruebas automatizadas:** cálculos, conversiones, persistencia, transacciones, migraciones y reportes.
8. **Seguridad operativa:** desactivación en lugar de borrado definitivo cuando existan operaciones históricas vinculadas a un producto.

## 10. Reglas de negocio

- Stock BULK en gramos enteros; precios y costos BULK por kg.
- Stock UNIT en unidades enteras; precios y costos UNIT por unidad.
- No permitir stock negativo.
- Toda venta descuenta stock y genera movimientos en la misma transacción.
- Las ventas conservan snapshots históricos.
- Las compras deberán incrementar stock y generar movimientos en una transacción atómica.
- Los ajustes manuales deberán exigir un motivo.
- El costo promedio ponderado se recalculará al registrar compras.
- No insertar ventas o compras ficticias como operaciones reales.

## 11. Estado de verificación de la versión 0.3.0

Se verificó la transpilación sintáctica de TSX y el chequeo estricto de los módulos `db.ts` y `types.ts`. No se pudo completar `npm install` en el entorno de preparación por timeout de descarga; el intento offline confirmó que las dependencias no están en caché. Por ese motivo no se pudo ejecutar `npm run build` ni probar la interfaz en navegador en este entorno. Ejecutar `npm install` y `npm run build` localmente antes de considerar esta versión validada para uso real.

---

**Historial de versiones**

- **0.1.1:** base visual, navegación, dashboard, CRUD de productos, IndexedDB y exportación/importación inicial del catálogo.
- **0.2.0:** punto de venta inicial, historial, descuento de stock y movimientos automáticos por venta.
- **0.3.0:** reportes de ventas, consulta filtrable/exportable de movimientos y ajustes manuales auditados.
