# PROMPT DE CONTINUACIÓN — PETSHOP MANAGER 0.3.0

## Rol

Actuá como ingeniero senior especializado en React, TypeScript, IndexedDB y sistemas de gestión comercial. Continuá sobre el repositorio existente. No reconstruyas el proyecto desde cero ni elimines funcionalidades que ya funcionan.

## 1. Inspección obligatoria

Antes de modificar archivos:

1. Leé `README.md` completo.
2. Revisá `package.json` y todos los archivos de `src`.
3. Inspeccioná la versión real de IndexedDB y sus stores.
4. Ejecutá `npm install` y `npm run build` si el entorno tiene acceso a dependencias.
5. Compará documentación y código; si hay diferencias, informalas y tomá el código real como fuente de verdad.
6. Conservá los productos y las ventas ya existentes. No limpies IndexedDB ni reemplaces datos del usuario durante una migración.

## 2. Decisiones que no se deben cambiar

- React 18, TypeScript, Vite, CSS propio y Lucide React.
- Aplicación responsive en español y moneda ARS.
- Sin login, backend ni sincronización externa.
- IndexedDB como almacenamiento local.
- BULK: stock en gramos enteros, precio y costo por kilogramo.
- UNIT: stock en unidades enteras, precio y costo por unidad.
- No permitir stock negativo.

## 3. Estado funcional de la versión 0.3.0

Ya están implementados:

- Navegación responsive y dashboard.
- CRUD y búsqueda de productos.
- IndexedDB v2 con stores `products`, `sales` y `movements`.
- POS con ventas BULK por importe o kg y UNIT por unidades.
- Carrito, medios de pago, costos y ganancia bruta estimada.
- Confirmación de venta atómica: venta, descuento de stock y movimientos.
- Historial de ventas.
- Reportes de ventas con rango de fechas, facturación, costo, ganancia bruta, cantidad de ventas, ticket promedio, productos más vendidos, medios de pago y exportación CSV.
- Consulta de movimientos de stock generados por ventas y ajustes manuales, filtros y exportación CSV.
- Ajustes manuales positivos/negativos con motivo obligatorio, validación de stock no negativo y persistencia atómica.

No afirmes que están implementadas funciones que solo tienen una pantalla placeholder. Compras y proveedores siguen pendientes. Los movimientos por ahora son únicamente las salidas generadas por ventas. El JSON actual respalda solo catálogo y configuración.

## 4. Próxima etapa: compras y proveedores

Implementá el módulo de compras y proveedores como siguiente objetivo principal.

### Proveedores

Crear CRUD de proveedores con:

- ID estable.
- Nombre comercial/razón social.
- Contacto y teléfono opcionales.
- Dirección opcional.
- Notas opcionales.
- Estado activo/inactivo.
- Fecha de creación y actualización.

No borrar físicamente proveedores vinculados a compras históricas; permitir desactivarlos.

### Compras

Crear registro de compras con:

- Fecha y hora.
- Proveedor (opcional para compras sin proveedor identificado).
- Número o referencia de factura/remito opcional.
- Detalle de productos.
- Cantidad comprada.
- Costo unitario de compra.
- Subtotal por línea y total de compra.
- Notas.

Para BULK, permitir cantidad en kg con conversión a gramos enteros. Para UNIT, cantidad entera.

Al confirmar la compra:

1. Validar todos los datos.
2. Volver a leer productos y stock/costos desde IndexedDB dentro de la transacción.
3. Incrementar stock.
4. Recalcular costo promedio ponderado.
5. Guardar compra y detalle con snapshots.
6. Registrar movimiento de entrada por producto.
7. Confirmar compra, productos y movimientos en una única transacción IndexedDB.
8. Si cualquier paso falla, abortar toda la transacción.

### Costo promedio ponderado

Usar como regla inicial:

`nuevoCostoPromedio = ((stockAnterior * costoAnterior) + (cantidadComprada * costoCompra)) / (stockAnterior + cantidadComprada)`

Para BULK, stock en gramos y costo por kg; normalizar unidades de forma consistente antes del cálculo. Para UNIT, unidades y costo por unidad.

Si el stock anterior es cero, el nuevo costo promedio debe ser el costo de la compra. Redondear el costo almacenado con precisión suficiente y evitar errores de coma flotante.

## 5. Movimientos

Ampliar la pantalla actual para mostrar entradas de compras además de salidas de ventas. Preparar ajustes positivos/negativos y devoluciones, pero no permitir ajustes sin motivo.

Conservar los movimientos históricos. No reconstruir ni modificar movimientos de ventas ya registrados.

## 6. Reportes

Después de compras, ampliar reportes para incluir:

- Total comprado por período.
- Compras por proveedor.
- Costos de compra por producto.
- Evolución del costo promedio.
- Comparación ventas/compras por período.
- Margen bruto estimado con snapshots de costo.

Distinguir claramente ganancia bruta de utilidad neta. No presentar utilidad neta sin datos de gastos, impuestos y comisiones.

## 7. Respaldo integral

Luego de incorporar compras y proveedores, ampliar JSON para incluir:

- Productos.
- Ventas y detalles.
- Movimientos.
- Proveedores.
- Compras y detalles.
- Configuración y versión de esquema.

La importación debe validar todo el archivo antes de escribir. Restaurar en una transacción atómica cuando sea viable; no dejar bases parcialmente reemplazadas. Mostrar confirmación y advertir que la restauración reemplaza datos. Mantener compatibilidad con el respaldo de catálogo anterior o implementar una migración explícita.

## 8. Pruebas

Agregar pruebas para:

- Cálculo de costo promedio con stock previo.
- Compra con stock inicial cero.
- Conversión BULK kg a gramos.
- Cantidades UNIT enteras.
- Actualización de stock y movimiento en una misma transacción.
- Abortado atómico ante stock/producto inválido o error de persistencia.
- Reportes de compras y ventas por período.
- Importación/exportación integral y validación de JSON.

Ejecutar `npm run build` y las pruebas disponibles. No inventar resultados si el entorno no permite instalar dependencias.

## 9. Forma de trabajo

Separá tipos, lógica de dominio, persistencia y UI. Evitá concentrar toda la lógica en `App.tsx` si se puede extraer a módulos pequeños. Mantené el diseño visual existente y responsive.

Trabajá en etapas pequeñas y verificables. No borres datos ni cambies el significado de los campos existentes. Actualizá `README.md` con el estado real.

## 10. Entrega

Al terminar, informá:

- Archivos creados y modificados.
- Funciones implementadas realmente.
- Migraciones de IndexedDB.
- Pruebas y comandos ejecutados con sus resultados.
- Limitaciones conocidas.
- Pasos manuales para probar compras, movimientos, costo promedio y reportes.

No marques una función como implementada si solo tiene interfaz visual.

## Objetivo general

Completar progresivamente un sistema local-first confiable para el pet shop. La prioridad inmediata es registrar compras y proveedores, actualizar stock y costo promedio ponderado, y dejar cada operación auditada en movimientos. Después, completar el respaldo integral y fortalecer pruebas.
