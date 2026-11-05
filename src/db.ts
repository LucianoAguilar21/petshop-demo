import type { Product, Sale, StockMovement } from "./types";

const DB_NAME = "petshop-manager";
const DB_VERSION = 2;
const PRODUCT_STORE = "products";
const SALE_STORE = "sales";
const MOVEMENT_STORE = "movements";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("Este navegador no admite IndexedDB."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PRODUCT_STORE)) {
        const store = db.createObjectStore(PRODUCT_STORE, { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
      }
      if (!db.objectStoreNames.contains(SALE_STORE)) {
        const store = db.createObjectStore(SALE_STORE, { keyPath: "id" });
        store.createIndex("date", "date", { unique: false });
      }
      if (!db.objectStoreNames.contains(MOVEMENT_STORE)) {
        const store = db.createObjectStore(MOVEMENT_STORE, { keyPath: "id" });
        store.createIndex("productId", "productId", { unique: false });
        store.createIndex("date", "date", { unique: false });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error ?? new Error("No se pudo abrir IndexedDB."));
    request.onblocked = () => reject(new Error("La base de datos está ocupada en otra pestaña. Cerrá las otras pestañas de PetShop Manager e intentá nuevamente."));
  });
}

function transactionError(tx: IDBTransaction): Error {
  return tx.error ?? new Error("La operación sobre la base de datos no pudo completarse.");
}

export async function getProducts(): Promise<Product[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRODUCT_STORE, "readonly");
    const request = tx.objectStore(PRODUCT_STORE).getAll();
    let result: Product[] = [];
    request.onsuccess = () => { result = (request.result as Product[]).sort((a,b) => a.name.localeCompare(b.name,"es")); };
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(transactionError(tx)); };
    tx.onerror = () => { db.close(); reject(transactionError(tx)); };
  });
}

export async function saveProduct(product: Product): Promise<void> {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(PRODUCT_STORE,"readwrite");
    tx.objectStore(PRODUCT_STORE).put(product);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(transactionError(tx)); };
    tx.onerror = () => { db.close(); reject(transactionError(tx)); };
  });
}

export async function deleteProduct(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(PRODUCT_STORE,"readwrite");
    tx.objectStore(PRODUCT_STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(transactionError(tx)); };
    tx.onerror = () => { db.close(); reject(transactionError(tx)); };
  });
}

export async function replaceProducts(products: Product[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(PRODUCT_STORE,"readwrite");
    const store = tx.objectStore(PRODUCT_STORE);
    store.clear(); products.forEach(product => store.put(product));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(transactionError(tx)); };
    tx.onerror = () => { db.close(); reject(transactionError(tx)); };
  });
}

export async function getSales(): Promise<Sale[]> {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(SALE_STORE,"readonly");
    const request = tx.objectStore(SALE_STORE).getAll();
    let sales: Sale[] = [];
    request.onsuccess = () => { sales = request.result as Sale[]; };
    tx.oncomplete = () => { db.close(); resolve(sales.sort((a,b) => b.date.localeCompare(a.date))); };
    tx.onabort = () => { db.close(); reject(transactionError(tx)); };
    tx.onerror = () => { db.close(); reject(transactionError(tx)); };
  });
}

export async function getMovements(): Promise<StockMovement[]> {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction(MOVEMENT_STORE,"readonly");
    const request = tx.objectStore(MOVEMENT_STORE).getAll();
    let movements: StockMovement[] = [];
    request.onsuccess = () => { movements = request.result as StockMovement[]; };
    tx.oncomplete = () => { db.close(); resolve(movements.sort((a,b) => b.date.localeCompare(a.date))); };
    tx.onabort = () => { db.close(); reject(transactionError(tx)); };
    tx.onerror = () => { db.close(); reject(transactionError(tx)); };
  });
}

/** Guarda venta, descuenta stock y registra movimientos en una única transacción atómica. */
export async function completeSale(sale: Sale): Promise<void> {
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction([PRODUCT_STORE,SALE_STORE,MOVEMENT_STORE],"readwrite");
    const products = tx.objectStore(PRODUCT_STORE);
    const sales = tx.objectStore(SALE_STORE);
    const movements = tx.objectStore(MOVEMENT_STORE);
    let failed = false;
    const fail = (message: string) => {
      if (failed) return;
      failed = true;
      try { tx.abort(); } catch { /* transaction may already be inactive */ }
      reject(new Error(message));
    };
    const pending = sale.items.length;
    let completed = 0;
    if (!pending) { fail("La venta no contiene productos."); return; }
    sale.items.forEach((item,index) => {
      const request = products.get(item.productId);
      request.onerror = () => fail("No se pudo verificar el stock del producto.");
      request.onsuccess = () => {
        if (failed) return;
        const product = request.result as Product | undefined;
        if (!product || !product.active) { fail(`El producto ${item.productName} ya no está disponible.`); return; }
        if (product.type !== item.productType) { fail(`Cambió la modalidad del producto ${item.productName}.`); return; }
        if (!Number.isSafeInteger(item.quantityBase) || item.quantityBase <= 0 || product.stock < item.quantityBase) {
          fail(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}.`); return;
        }
        const before = product.stock;
        product.stock -= item.quantityBase;
        product.updatedAt = sale.date;
        products.put(product);
        const movement: StockMovement = {
          id: `${sale.id}-${index}`, productId: product.id, productName: product.name, productType: product.type,
          date: sale.date, type: "SALE", quantity: -item.quantityBase,
          stockBefore: before, stockAfter: product.stock,
          reason: "Salida por venta", referenceId: sale.id
        };
        movements.put(movement);
        completed += 1;
        if (completed === pending) sales.add(sale);
      };
    });
    tx.oncomplete = () => { db.close(); if (!failed) resolve(); };
    tx.onabort = () => { db.close(); if (!failed) reject(transactionError(tx)); };
    tx.onerror = () => { db.close(); if (!failed) reject(transactionError(tx)); };
  });
}

/** Ajusta stock manualmente y registra la trazabilidad en una única transacción. */
export async function adjustStock(productId: string, quantityDelta: number, reason: string): Promise<void> {
  if (!Number.isSafeInteger(quantityDelta) || quantityDelta === 0) throw new Error("La cantidad del ajuste debe ser un número entero distinto de cero.");
  if (!reason.trim()) throw new Error("Ingresá el motivo del ajuste.");
  const db = await openDB();
  return new Promise((resolve,reject) => {
    const tx = db.transaction([PRODUCT_STORE,MOVEMENT_STORE],"readwrite");
    const products = tx.objectStore(PRODUCT_STORE);
    const movements = tx.objectStore(MOVEMENT_STORE);
    let failed = false;
    const fail = (message: string) => {
      if (failed) return;
      failed = true;
      try { tx.abort(); } catch { /* transaction may already be inactive */ }
      reject(new Error(message));
    };
    const request = products.get(productId);
    request.onerror = () => fail("No se pudo leer el producto para ajustar el stock.");
    request.onsuccess = () => {
      if (failed) return;
      const product = request.result as Product | undefined;
      if (!product || !product.active) { fail("El producto no existe o está inactivo."); return; }
      const nextStock = product.stock + quantityDelta;
      if (!Number.isSafeInteger(nextStock) || nextStock < 0) { fail("El ajuste dejaría el stock en un valor negativo o inválido."); return; }
      const date = new Date().toISOString();
      const before = product.stock;
      product.stock = nextStock;
      product.updatedAt = date;
      products.put(product);
      movements.add({
        id: `adjust-${crypto.randomUUID()}`, productId: product.id, productName: product.name,
        productType: product.type, date, type: "ADJUSTMENT", quantity: quantityDelta,
        stockBefore: before, stockAfter: nextStock, reason: reason.trim(), referenceId: `ADJ-${crypto.randomUUID()}`
      } satisfies StockMovement);
    };
    tx.oncomplete = () => { db.close(); if (!failed) resolve(); };
    tx.onabort = () => { db.close(); if (!failed) reject(transactionError(tx)); };
    tx.onerror = () => { db.close(); if (!failed) reject(transactionError(tx)); };
  });
}
