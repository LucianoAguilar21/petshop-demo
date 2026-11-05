import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, BarChart3,
  Bone, Boxes, ChevronDown, CircleDollarSign, ClipboardList, LayoutDashboard,
  Menu, Package, PawPrint, Plus, Search, Settings, ShoppingCart, Truck, X,
  Pencil, Trash2, Wallet, FileDown, CalendarDays, TrendingUp, ArrowUpRight
} from "lucide-react";
import { adjustStock, completeSale, deleteProduct, getMovements, getProducts, getSales, replaceProducts, saveProduct } from "./db";
import { formatARS, formatStock, isLowStock, type BackupData, type Product, type ProductType, type Sale, type SaleItem, type PaymentMethod, type StockMovement } from "./types";

type Page = "dashboard" | "products" | "sales" | "purchases" | "reports" | "movements" | "settings";
const nav: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "sales", label: "Nueva venta", icon: ShoppingCart },
  { id: "products", label: "Productos e inventario", icon: Package },
  { id: "purchases", label: "Compras y proveedores", icon: Truck },
  { id: "reports", label: "Reportes", icon: BarChart3 },
  { id: "movements", label: "Movimientos", icon: Activity },
  { id: "settings", label: "Configuración", icon: Settings },
];
const seed: Product[] = [
  { id: "seed-1", name: "Pedigree Cachorros", category: "Alimento para perros", type: "BULK", costPrice: 5200, salePrice: 8000, stock: 19375, minimumStock: 5000, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "seed-2", name: "Alimento gato adulto", category: "Alimento para gatos", type: "BULK", costPrice: 4100, salePrice: 6500, stock: 12000, minimumStock: 4000, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "seed-3", name: "Collar mediano", category: "Accesorios", type: "UNIT", costPrice: 2000, salePrice: 3500, stock: 12, minimumStock: 3, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: "seed-4", name: "Correa reforzada", category: "Accesorios", type: "UNIT", costPrice: 3800, salePrice: 6200, stock: 2, minimumStock: 3, active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
];

function newId() { return crypto.randomUUID(); }

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [notice, setNotice] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    const [nextProducts, nextSales, nextMovements] = await Promise.all([getProducts(), getSales(), getMovements()]);
    setProducts(nextProducts); setSales(nextSales); setMovements(nextMovements);
  }
  useEffect(() => {
    (async () => {
      const existing = await getProducts();
      if (existing.length === 0) await replaceProducts(seed);
      await refresh();
      setLoading(false);
    })().catch(() => { setNotice("No se pudo abrir el almacenamiento local."); setLoading(false); });
  }, []);

  const active = products.filter(p => p.active);
  const low = active.filter(isLowStock);
  const filtered = active.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
  const estimatedValue = active.reduce((sum, p) => sum + p.stock * p.costPrice / (p.type === "BULK" ? 1000 : 1), 0);
  const go = (id: Page) => { setPage(id); setMobileNav(false); };

  async function handleSave(data: Omit<Product, "id" | "createdAt" | "updatedAt" | "active">, id?: string) {
    const old = products.find(p => p.id === id);
    const product: Product = {
      ...data, id: id ?? newId(), active: old?.active ?? true,
      createdAt: old?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    await saveProduct(product); await refresh(); setModal(false); setEditing(null);
    setNotice(id ? "Producto actualizado." : "Producto agregado.");
  }
  async function handleDelete(product: Product) {
    if (!confirm(`¿Eliminar "${product.name}" del catálogo?`)) return;
    await deleteProduct(product.id); await refresh(); setNotice("Producto eliminado.");
  }
  function exportJSON() {
    const backup: BackupData = { app: "PetShop Manager", schemaVersion: 1, exportedAt: new Date().toISOString(), products, settings: { currency: "ARS", schemaVersion: 1 } };
    downloadFile(JSON.stringify(backup, null, 2), "petshop-manager-catalogo-v1.json", "application/json");
  }
  async function importJSON(file?: File) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()) as BackupData;
      if (data.app !== "PetShop Manager" || data.schemaVersion !== 1 || !Array.isArray(data.products) ||
        data.settings?.currency !== "ARS" || data.settings?.schemaVersion !== 1) {
        throw new Error("El archivo no corresponde a un respaldo compatible de PetShop Manager.");
      }
      const ids = new Set<string>();
      for (const product of data.products) {
        const valid = product &&
          typeof product.id === "string" && product.id.trim().length > 0 &&
          typeof product.name === "string" && product.name.trim().length > 0 &&
          typeof product.category === "string" && product.category.trim().length > 0 &&
          (product.type === "BULK" || product.type === "UNIT") &&
          Number.isFinite(product.costPrice) && product.costPrice > 0 &&
          Number.isFinite(product.salePrice) && product.salePrice > 0 &&
          Number.isSafeInteger(product.stock) && product.stock >= 0 &&
          Number.isSafeInteger(product.minimumStock) && product.minimumStock >= 0 &&
          typeof product.active === "boolean" &&
          typeof product.createdAt === "string" &&
          typeof product.updatedAt === "string";
        if (!valid) throw new Error("El respaldo contiene un producto con datos inválidos.");
        if (ids.has(product.id)) throw new Error(`El respaldo contiene un ID duplicado: ${product.id}`);
        ids.add(product.id);
      }
      if (!confirm(`Se reemplazarán los ${products.length} productos actuales por ${data.products.length} del respaldo. ¿Continuar?`)) return;
      await replaceProducts(data.products);
      await refresh();
      setNotice("Catálogo restaurado correctamente.");
    } catch (e) {
      alert(`No se pudo importar el archivo: ${e instanceof Error ? e.message : "error"}`);
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }
  function exportCSV() {
    const headers = ["id", "nombre", "categoria", "tipo", "costo_ars", "precio_ars", "stock_base", "stock_minimo_base", "activo"];
    const rows = products.map(p => [p.id, p.name, p.category, p.type, p.costPrice, p.salePrice, p.stock, p.minimumStock, p.active]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    downloadFile("\uFEFF" + csv, "productos.csv", "text/csv;charset=utf-8");
  }

  if (loading) return <div className="loading">Cargando PetShop Manager…</div>;
  const title = nav.find(n => n.id === page)?.label ?? "Dashboard";
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
      <div className="brand"><div className="brand-mark"><PawPrint size={22} /></div><div><strong>PETSHOP</strong><small>Sistema de gestión</small></div><button className="mobile-close" onClick={() => setMobileNav(false)}><X /></button></div>
      <div className="demo-tag">ENTORNO DEMO</div>
      <nav>{nav.map(item => <button key={item.id} className={`nav-item ${page === item.id ? "selected" : ""}`} onClick={() => go(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === "products" && low.length > 0 && <b className="nav-count">{low.length}</b>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="local-status"><span className="status-dot" /> Datos guardados en este navegador</div><small>PetShop Manager · v0.3.0</small></div>
    </aside>
    {mobileNav && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMobileNav(false)} />}
    <main className="main">
      <header className="topbar"><button className="menu-toggle" onClick={() => setMobileNav(true)}><Menu /></button><div className="breadcrumb">PetShop <span>/</span> {title}</div><div className="top-actions"><span className="local-pill"><span className="status-dot" /> Local</span><div className="avatar">PS</div></div></header>
      <div className="content">
        {notice && <div className="toast"><span>{notice}</span><button onClick={() => setNotice("")}><X size={16} /></button></div>}
        {page === "dashboard" && <Dashboard products={active} low={low} estimatedValue={estimatedValue} sales={sales} onProducts={() => go("products")} onSales={() => go("sales")} />}
        {page === "sales" && <SalesPage products={active} sales={sales} onComplete={async sale => { await completeSale(sale); await refresh(); setNotice("Venta registrada y stock actualizado."); }} />}
        {page === "reports" && <ReportsPage sales={sales} products={active} />}
        {page === "movements" && <MovementsPage movements={movements} products={products} onAdjust={async (productId, delta, reason) => { await adjustStock(productId, delta, reason); await refresh(); setNotice("Ajuste registrado y stock actualizado."); }} />}
        {page === "products" && <section>
          <div className="page-heading"><div><div className="eyebrow">CATÁLOGO Y EXISTENCIAS</div><h1>Productos e inventario</h1><p>Administrá los productos, sus precios y las cantidades disponibles.</p></div><button className="primary" onClick={() => { setEditing(null); setModal(true) }}><Plus size={17} /> Nuevo producto</button></div>
          <div className="stats-row"><Stat icon={<Boxes />} label="Productos activos" value={String(active.length)} /><Stat icon={<AlertTriangle />} label="Stock bajo" value={String(low.length)} tone={low.length ? "warning" : "normal"} /><Stat icon={<Wallet />} label="Valor de inventario (costo)" value={formatARS(estimatedValue)} /></div>
          <div className="panel"><div className="table-toolbar"><div><h2>Listado de productos</h2><p>{active.length} productos en catálogo</p></div><div className="searchbox"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar producto…" /></div></div>
            <div className="table-wrap"><table><thead><tr><th>PRODUCTO</th><th>CATEGORÍA</th><th>TIPO</th><th>STOCK</th><th>COSTO</th><th>PRECIO VENTA</th><th>ESTADO</th><th></th></tr></thead><tbody>
              {filtered.map(p => <tr key={p.id}><td><strong>{p.name}</strong><small className="subcell">Actualizado {new Date(p.updatedAt).toLocaleDateString("es-AR")}</small></td><td>{p.category}</td><td><span className="type-chip">{p.type === "BULK" ? "A granel" : "Por unidad"}</span></td><td><strong>{formatStock(p)}</strong></td><td>{formatARS(p.costPrice)}<small className="subcell">{p.type === "BULK" ? "por kg" : "por unidad"}</small></td><td>{formatARS(p.salePrice)}<small className="subcell">{p.type === "BULK" ? "por kg" : "por unidad"}</small></td><td><span className={`status ${isLowStock(p) ? "warning" : "good"}`}><i />{isLowStock(p) ? "Stock bajo" : "Disponible"}</span></td><td><div className="row-actions"><button title="Editar" onClick={() => { setEditing(p); setModal(true) }}><Pencil size={16} /></button><button title="Eliminar" onClick={() => handleDelete(p)}><Trash2 size={16} /></button></div></td></tr>)}
              {filtered.length === 0 && <tr><td colSpan={8} className="empty">No se encontraron productos.</td></tr>}
            </tbody></table></div>
          </div>
          <p className="footnote">Los productos a granel almacenan el stock en gramos y muestran las cantidades en kilogramos. Los costos y precios se expresan por kilogramo.</p>
        </section>}
        {page === "settings" && <section><div className="page-heading"><div><div className="eyebrow">DATOS Y PREFERENCIAS</div><h1>Respaldo y configuración</h1><p>Exportá una copia de seguridad o restaurá los datos en este navegador.</p></div></div>
          <div className="settings-grid"><div className="panel setting-card"><div className="setting-icon"><ArrowDownToLine /></div><h2>Exportar catálogo JSON</h2><p>Descargá los productos y la configuración actual en un archivo JSON.</p><button className="primary" onClick={exportJSON}>Descargar catálogo JSON</button></div>
            <div className="panel setting-card"><div className="setting-icon"><ArrowUpFromLine /></div><h2>Importar catálogo</h2><p>Restaurá un archivo JSON compatible. Esta acción reemplaza los productos actuales.</p><button className="secondary" onClick={() => importRef.current?.click()}>Seleccionar archivo JSON</button><input ref={importRef} hidden type="file" accept="application/json,.json" onChange={e => importJSON(e.target.files?.[0])} /></div>
            <div className="panel setting-card"><div className="setting-icon"><ClipboardList /></div><h2>Exportar productos CSV</h2><p>Descargá el catálogo para abrirlo en Excel o una planilla de cálculo.</p><button className="secondary" onClick={exportCSV}>Exportar productos.csv</button></div></div>
          <div className="info-box"><AlertTriangle size={18} /><p><strong>Alcance del respaldo actual:</strong> el JSON disponible respalda únicamente productos y configuración. Las ventas y sus movimientos se guardan localmente, pero todavía no están incluidos en un respaldo integral. Compras y proveedores siguen pendientes. Conservá copias externas periódicas.</p></div>
        </section>}
        {["purchases"].includes(page) && <section><div className="page-heading"><div><div className="eyebrow">PRÓXIMO MÓDULO</div><h1>{title}</h1><p>La estructura de navegación está preparada. Este módulo se implementará en la siguiente etapa.</p></div></div><div className="panel coming"><div className="coming-icon"><Bone size={28} /></div><h2>{title}</h2><p>Estamos preparando esta sección para conectar sus operaciones con el inventario local.</p><span className="type-chip">En desarrollo</span></div></section>}
      </div>
    </main>
    {modal && <ProductModal initial={editing} onClose={() => { setModal(false); setEditing(null) }} onSave={handleSave} />}
  </div>;
}

function downloadFile(content: string, name: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

function Stat({ icon, label, value, tone = "normal" }: { icon: ReactNode; label: string; value: string; tone?: "normal" | "warning" }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong className={tone === "warning" ? "warning-text" : ""}>{value}</strong></div></div>;
}
function Dashboard({ products, low, estimatedValue, sales, onProducts, onSales }: { products: Product[]; low: Product[]; estimatedValue: number; sales: Sale[]; onProducts: () => void; onSales: () => void }) {
  const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const today = localDateKey(new Date());
  const todaySales = sales.filter(s => localDateKey(new Date(s.date)) === today);
  const revenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const profit = todaySales.reduce((sum, s) => sum + s.grossProfit, 0);
  return <section><div className="page-heading"><div><div className="eyebrow">RESUMEN GENERAL</div><h1>Dashboard</h1><p>Una vista rápida del estado actual del negocio.</p></div><span className="date-label">{new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></div>
    <div className="stats-row dashboard-stats"><Stat icon={<CircleDollarSign />} label="Ventas de hoy" value={formatARS(revenue)} /><Stat icon={<Wallet />} label="Ganancia bruta" value={formatARS(profit)} /><Stat icon={<Package />} label="Productos activos" value={String(products.length)} /><Stat icon={<AlertTriangle />} label="Stock bajo" value={String(low.length)} tone={low.length ? "warning" : "normal"} /></div>
    <div className="dashboard-grid"><div className="panel"><div className="panel-heading"><div><h2>Estado del inventario</h2><p>Resumen de existencias actuales</p></div><button className="text-button" onClick={onProducts}>Ver productos <ChevronDown size={15} /></button></div><div className="inventory-summary"><div><span>Productos en catálogo</span><strong>{products.length}</strong></div><div><span>Valor del inventario (costo)</span><strong>{formatARS(estimatedValue)}</strong></div><div><span>Requieren reposición</span><strong className={low.length ? "warning-text" : ""}>{low.length}</strong></div></div>{low.length > 0 ? <div className="alert-list"><div className="alert-title"><AlertTriangle size={16} /> Atención: stock bajo</div>{low.slice(0, 4).map(p => <div className="alert-row" key={p.id}><div><strong>{p.name}</strong><small>{p.category}</small></div><span>{formatStock(p)} / mínimo {p.type === "BULK" ? `${(p.minimumStock / 1000).toLocaleString("es-AR")} kg` : `${p.minimumStock} u.`}</span></div>)}</div> : <div className="success-note">No hay productos por debajo del stock mínimo.</div>}</div>
      <div className="panel quick-panel"><h2>Accesos rápidos</h2><p>Operaciones frecuentes</p><button onClick={onSales}><span className="quick-icon"><ShoppingCart /></span><span><strong>Nueva venta</strong><small>Registrar una operación y descontar stock</small></span><ChevronDown className="quick-arrow" /></button><button onClick={onProducts}><span className="quick-icon"><Plus /></span><span><strong>Agregar producto</strong><small>Cargar un producto al catálogo</small></span><ChevronDown className="quick-arrow" /></button><button onClick={onProducts}><span className="quick-icon"><Boxes /></span><span><strong>Revisar inventario</strong><small>Consultar cantidades y alertas</small></span><ChevronDown className="quick-arrow" /></button><div className="local-note"><span className="status-dot" /> Los cambios se guardan localmente</div></div></div>
    <div className="demo-disclaimer">Las ventas y ganancias se calculan con las operaciones registradas. Los productos de ejemplo pueden editarse o eliminarse.</div>
  </section>;
}
type CartLine = SaleItem;
function roundMoney(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function SalesPage({ products, sales, onComplete }: { products: Product[]; sales: Sale[]; onComplete: (sale: Sale) => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<"AMOUNT" | "WEIGHT">("AMOUNT");
  const [entry, setEntry] = useState("5000");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>("CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"new" | "history">("new");
  const selectedProduct = products.find(p => p.id === selected);
  const results = products.filter(p => `${p.name} ${p.category}`.toLowerCase().includes(search.toLowerCase())).slice(0, 8);
  const total = roundMoney(cart.reduce((sum, line) => sum + line.subtotal, 0));
  const cost = roundMoney(cart.reduce((sum, line) => sum + line.costTotal, 0));
  const profit = roundMoney(total - cost);
  function addSelected() {
    setError("");
    const p = selectedProduct;
    const value = Number(entry);
    if (!p || !Number.isFinite(value) || value <= 0) { setError("Seleccioná un producto e ingresá una cantidad válida."); return; }
    let quantityBase: number;
    if (p.type === "BULK") quantityBase = mode === "AMOUNT" ? Math.round((value / p.salePrice) * 1000) : Math.round(value * 1000);
    else quantityBase = Math.round(value);
    if (!Number.isSafeInteger(quantityBase) || quantityBase <= 0 || (p.type === "UNIT" && !Number.isInteger(value))) { setError("La cantidad debe ser válida. Los productos por unidad requieren cantidades enteras."); return; }
    const available = p.stock - cart.filter(line => line.productId === p.id).reduce((sum, line) => sum + line.quantityBase, 0);
    if (quantityBase > available) { setError(`Stock insuficiente. Disponible para agregar: ${p.type === "BULK" ? `${(available / 1000).toLocaleString("es-AR")} kg` : `${available} unidades`}.`); return; }
    const subtotal = roundMoney(p.type === "BULK" ? p.salePrice * quantityBase / 1000 : p.salePrice * quantityBase);
    const costTotal = roundMoney(p.type === "BULK" ? p.costPrice * quantityBase / 1000 : p.costPrice * quantityBase);
    const item: CartLine = { productId: p.id, productName: p.name, productType: p.type, quantityBase, displayUnit: p.type === "BULK" ? "g" : "unit", unitPrice: p.salePrice, unitCost: p.costPrice, subtotal, costTotal, grossProfit: roundMoney(subtotal - costTotal) };
    setCart(current => {
      const existing = current.find(line => line.productId === p.id);
      if (!existing) return [...current, item];
      const quantity = existing.quantityBase + item.quantityBase;
      const nextSubtotal = roundMoney(existing.subtotal + item.subtotal);
      const nextCost = roundMoney(existing.costTotal + item.costTotal);
      return current.map(line => line.productId === p.id ? { ...line, quantityBase: quantity, subtotal: nextSubtotal, costTotal: nextCost, grossProfit: roundMoney(nextSubtotal - nextCost) } : line);
    });
    setSearch(""); setSelected(""); setEntry(p.type === "BULK" ? "5000" : "1");
  }
  function removeLine(productId: string) { setCart(current => current.filter(line => line.productId !== productId)); }
  function adjustLine(line: CartLine, direction: -1 | 1) {
    const step = line.productType === "BULK" ? 100 : 1;
    const nextQuantity = line.quantityBase + step * direction;
    if (nextQuantity <= 0) { removeLine(line.productId); return; }
    const product = products.find(p => p.id === line.productId);
    if (direction > 0 && product && nextQuantity > product.stock) { setError(`Stock insuficiente para ${line.productName}.`); return; }
    const nextSubtotal = roundMoney(line.productType === "BULK" ? line.unitPrice * nextQuantity / 1000 : line.unitPrice * nextQuantity);
    const nextCost = roundMoney(line.productType === "BULK" ? line.unitCost * nextQuantity / 1000 : line.unitCost * nextQuantity);
    setCart(current => current.map(item => item.productId === line.productId ? { ...item, quantityBase: nextQuantity, subtotal: nextSubtotal, costTotal: nextCost, grossProfit: roundMoney(nextSubtotal - nextCost) } : item));
    setError("");
  }
  async function confirmSale() {
    if (!cart.length) { setError("Agregá al menos un producto."); return; }
    if (!confirm(`¿Confirmar la venta por ${formatARS(total)}? Se descontará el stock.`)) return;
    setBusy(true); setError("");
    const date = new Date().toISOString();
    const sale: Sale = { id: crypto.randomUUID(), date, items: cart, subtotal: total, total, totalCost: cost, grossProfit: profit, paymentMethod: payment };
    try { await onComplete(sale); setCart([]); setTab("history"); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar la venta."); }
    finally { setBusy(false); }
  }
  return <section>
    <div className="page-heading"><div><div className="eyebrow">OPERACIONES COMERCIALES</div><h1>Nueva venta</h1><p>Vendé alimento por importe o peso y accesorios por unidad.</p></div><div className="sales-tabs"><button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}>Nueva venta</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Historial ({sales.length})</button></div></div>
    {tab === "new" ? <div className="sales-layout">
      <div className="panel sale-builder"><div className="table-toolbar"><div><h2>Agregar productos</h2><p>Buscá en el catálogo activo</p></div></div>
        <div className="sale-search"><Search size={17} /><input value={search} onChange={e => { setSearch(e.target.value); setSelected(""); }} placeholder="Buscar alimento, collar, correa…" /></div>
        {search && <div className="sale-results">{results.map(p => <button key={p.id} onClick={() => { setSelected(p.id); setSearch(p.name); setMode("AMOUNT"); setEntry(p.type === "BULK" ? "5000" : "1"); }}><span><strong>{p.name}</strong><small>{p.type === "BULK" ? "A granel" : "Por unidad"} · Stock {formatStock(p)}</small></span><b>{formatARS(p.salePrice)}<small>{p.type === "BULK" ? "/ kg" : "/ u."}</small></b></button>)}{!results.length && <p className="sale-empty">No se encontraron productos.</p>}</div>}
        {selectedProduct && <div className="selected-product"><div className="selected-head"><div><strong>{selectedProduct.name}</strong><small>{formatARS(selectedProduct.salePrice)} {selectedProduct.type === "BULK" ? "por kg" : "por unidad"} · Disponible: {formatStock(selectedProduct)}</small></div><button className="text-button" onClick={() => { setSelected(""); setSearch("") }}>Cambiar</button></div>
          {selectedProduct.type === "BULK" ? <><div className="segmented"><button type="button" className={mode === "AMOUNT" ? "active" : ""} onClick={() => { setMode("AMOUNT"); setEntry("5000") }}>Por importe ($)</button><button type="button" className={mode === "WEIGHT" ? "active" : ""} onClick={() => { setMode("WEIGHT"); setEntry("0.5") }}>Por peso (kg)</button></div><label className="sale-field">{mode === "AMOUNT" ? "Importe que paga el cliente" : "Cantidad en kilogramos"}<input type="number" min="0.001" step="0.01" value={entry} onChange={e => setEntry(e.target.value)} /></label><div className="sale-calculation">{Number(entry) > 0 ? <><span>Se entregan aproximadamente</span><strong>{(mode === "AMOUNT" ? Math.round(Number(entry) / selectedProduct.salePrice * 1000) : Math.round(Number(entry) * 1000)).toLocaleString("es-AR")} g</strong><span>Importe calculado: {formatARS(selectedProduct.salePrice * (mode === "AMOUNT" ? Math.round(Number(entry) / selectedProduct.salePrice * 1000) : Math.round(Number(entry) * 1000)) / 1000)}</span></> : "Ingresá un importe o peso"}</div></> : <label className="sale-field">Cantidad de unidades<input type="number" min="1" step="1" value={entry} onChange={e => setEntry(e.target.value)} /></label>}
          <button className="primary add-line" onClick={addSelected}>Agregar al carrito</button></div>}
      </div>
      <div className="panel cart-panel"><div className="cart-heading"><div><h2>Carrito</h2><p>{cart.length} productos diferentes</p></div><ShoppingCart /></div>
        {cart.length ? <div className="cart-lines">{cart.map(line => <div className="cart-line" key={line.productId}><div className="cart-line-info"><strong>{line.productName}</strong><small>{line.productType === "BULK" ? `${line.quantityBase.toLocaleString("es-AR")} g` : `${line.quantityBase} unidades`} · Costo {formatARS(line.costTotal)}</small><div className="quantity-stepper"><button onClick={() => adjustLine(line, -1)} aria-label="Disminuir cantidad">−</button><span>{line.productType === "BULK" ? "paso 100 g" : "paso 1 u."}</span><button onClick={() => adjustLine(line, 1)} aria-label="Aumentar cantidad">+</button></div></div><b>{formatARS(line.subtotal)}</b><button aria-label={`Quitar ${line.productName}`} onClick={() => removeLine(line.productId)}><X size={16} /></button></div>)}</div> : <div className="cart-empty"><ShoppingCart size={27} /><strong>El carrito está vacío</strong><span>Buscá un producto para comenzar una venta.</span></div>}
        <div className="cart-totals"><div><span>Subtotal</span><strong>{formatARS(total)}</strong></div><div><span>Costo estimado</span><strong>{formatARS(cost)}</strong></div><div className="profit-row"><span>Ganancia bruta estimada</span><strong>{formatARS(profit)}</strong></div><div className="cart-total"><span>Total</span><strong>{formatARS(total)}</strong></div></div>
        <label className="payment-field">Medio de pago<select value={payment} onChange={e => setPayment(e.target.value as PaymentMethod)}><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="DEBIT">Tarjeta de débito</option><option value="CREDIT">Tarjeta de crédito</option><option value="OTHER">Otro</option></select></label>
        {error && <div className="form-error">{error}</div>}<button className="primary checkout" disabled={!cart.length || busy} onClick={confirmSale}>{busy ? "Registrando…" : `Confirmar venta · ${formatARS(total)}`}</button>
      </div>
    </div> : <div className="panel"><div className="table-toolbar"><div><h2>Ventas registradas</h2><p>Historial guardado en este dispositivo</p></div></div><div className="table-wrap"><table><thead><tr><th>FECHA</th><th>PRODUCTOS</th><th>MEDIO DE PAGO</th><th>TOTAL</th><th>COSTO</th><th>GANANCIA BRUTA</th></tr></thead><tbody>{sales.map(s => <tr key={s.id}><td>{new Date(s.date).toLocaleString("es-AR")}</td><td>{s.items.map(i => `${i.productName} (${i.productType === "BULK" ? `${i.quantityBase} g` : `${i.quantityBase} u.`})`).join(", ")}</td><td>{{ CASH: "Efectivo", TRANSFER: "Transferencia", DEBIT: "Débito", CREDIT: "Crédito", OTHER: "Otro" }[s.paymentMethod]}</td><td><strong>{formatARS(s.total)}</strong></td><td>{formatARS(s.totalCost)}</td><td>{formatARS(s.grossProfit)}</td></tr>)}{!sales.length && <tr><td colSpan={6} className="empty">Todavía no hay ventas registradas.</td></tr>}</tbody></table></div></div>}
  </section>;
}

function localDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function dateAtStart(value: string) { return value ? new Date(`${value}T00:00:00`).getTime() : Number.NEGATIVE_INFINITY; }
function dateAtEnd(value: string) { return value ? new Date(`${value}T23:59:59.999`).getTime() : Number.POSITIVE_INFINITY; }
function csvDownload(headers: string[], rows: (string | number)[][], filename: string) {
  const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  downloadFile("\uFEFF" + csv, filename, "text/csv;charset=utf-8");
}
function ReportsPage({ sales, products }: { sales: Sale[]; products: Product[] }) {
  const now = new Date();
  const [from, setFrom] = useState(localDateInput(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(localDateInput(now));
  const filtered = sales.filter(s => { const time = new Date(s.date).getTime(); return time >= dateAtStart(from) && time <= dateAtEnd(to); });
  const revenue = filtered.reduce((sum, s) => sum + s.total, 0);
  const cost = filtered.reduce((sum, s) => sum + s.totalCost, 0);
  const profit = filtered.reduce((sum, s) => sum + s.grossProfit, 0);
  const average = filtered.length ? revenue / filtered.length : 0;
  const productMap = new Map<string, { name: string; type: ProductType; quantity: number; revenue: number; cost: number }>();
  filtered.forEach(s => s.items.forEach(item => {
    const current = productMap.get(item.productId) ?? { name: item.productName, type: item.productType, quantity: 0, revenue: 0, cost: 0 };
    current.quantity += item.quantityBase; current.revenue += item.subtotal; current.cost += item.costTotal; productMap.set(item.productId, current);
  }));
  const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  const paymentLabels: Record<PaymentMethod, string> = { CASH: "Efectivo", TRANSFER: "Transferencia", DEBIT: "Débito", CREDIT: "Crédito", OTHER: "Otro" };
  const paymentTotals = (Object.keys(paymentLabels) as PaymentMethod[]).map(method => ({ method, label: paymentLabels[method], amount: filtered.filter(s => s.paymentMethod === method).reduce((sum, s) => sum + s.total, 0) })).filter(item => item.amount > 0);
  const daily = new Map<string, number>();
  filtered.forEach(s => { const key = localDateInput(new Date(s.date)); daily.set(key, (daily.get(key) ?? 0) + s.total); });
  const days = [...daily.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 7);
  const maxDay = Math.max(1, ...days.map(([, value]) => value));
  function exportReport() {
    const rows = filtered.flatMap(s => s.items.map(item => [s.id, s.date, paymentLabels[s.paymentMethod], item.productName, item.productType, item.quantityBase, item.unitPrice, item.subtotal, item.costTotal, item.grossProfit]));
    csvDownload(["venta_id", "fecha", "medio_pago", "producto", "tipo", "cantidad_base", "precio_unitario", "subtotal", "costo", "ganancia_bruta"], rows, "reporte-ventas.csv");
  }
  return <section>
    <div className="page-heading"><div><div className="eyebrow">ANÁLISIS COMERCIAL</div><h1>Reportes</h1><p>Resultados calculados a partir de las ventas registradas en este dispositivo.</p></div><button className="secondary" onClick={exportReport} disabled={!filtered.length}><FileDown size={16} /> Exportar detalle CSV</button></div>
    <div className="panel report-filters"><div className="report-filter-title"><CalendarDays size={17} /><strong>Período del reporte</strong></div><label>Desde<input type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} /></label><label>Hasta<input type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} /></label><button className="text-button" onClick={() => { const d = new Date(); setFrom(localDateInput(new Date(d.getFullYear(), d.getMonth(), 1))); setTo(localDateInput(d)); }}>Este mes</button><button className="text-button" onClick={() => { const d = new Date(); setFrom(localDateInput(d)); setTo(localDateInput(d)); }}>Hoy</button></div>
    <div className="stats-row report-stats"><Stat icon={<CircleDollarSign />} label="Ventas del período" value={formatARS(revenue)} /><Stat icon={<TrendingUp />} label="Ganancia bruta" value={formatARS(profit)} /><Stat icon={<Wallet />} label="Costo de mercadería" value={formatARS(cost)} /><Stat icon={<ShoppingCart />} label="Cantidad de ventas" value={String(filtered.length)} /></div>
    <div className="report-grid"><div className="panel report-panel"><div className="panel-heading"><div><h2>Productos más vendidos</h2><p>Ordenados por facturación</p></div></div>{topProducts.length ? <div className="report-product-list">{topProducts.map(item => <div className="report-product-row" key={item.name}><div><strong>{item.name}</strong><small>{item.type === "BULK" ? `${item.quantity.toLocaleString("es-AR")} g vendidos` : `${item.quantity} unidades vendidas`}</small></div><div><strong>{formatARS(item.revenue)}</strong><small>Ganancia {formatARS(item.revenue - item.cost)}</small></div></div>)}</div> : <div className="report-empty">No hay ventas en el período seleccionado.</div>}</div>
      <div className="panel report-panel"><div className="panel-heading"><div><h2>Ventas por medio de pago</h2><p>Distribución del importe vendido</p></div></div>{paymentTotals.length ? paymentTotals.map(item => <div className="payment-total-row" key={item.method}><div><span>{item.label}</span><strong>{formatARS(item.amount)}</strong></div><div className="bar-track"><i style={{ width: `${revenue ? item.amount / revenue * 100 : 0}%` }} /></div></div>) : <div className="report-empty">Sin operaciones para mostrar.</div>}<div className="average-ticket"><span>Ticket promedio</span><strong>{formatARS(average)}</strong></div></div>
      <div className="panel report-panel report-daily"><div className="panel-heading"><div><h2>Últimos días con ventas</h2><p>Facturación diaria · máximo 7 días</p></div></div>{days.length ? days.map(([day, value]) => <div className="daily-row" key={day}><span>{new Date(`${day}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "short" })}</span><div className="bar-track"><i style={{ width: `${value / maxDay * 100}%` }} /></div><strong>{formatARS(value)}</strong></div>) : <div className="report-empty">Todavía no hay ventas registradas.</div>}</div>
      <div className="panel report-panel"><div className="panel-heading"><div><h2>Inventario actual</h2><p>Situación de productos activos</p></div></div><div className="inventory-summary report-inventory"><div><span>Productos activos</span><strong>{products.length}</strong></div><div><span>Stock bajo</span><strong>{products.filter(isLowStock).length}</strong></div><div><span>Margen bruto del período</span><strong>{revenue ? `${(profit / revenue * 100).toLocaleString("es-AR", { maximumFractionDigits: 1 })}%` : "—"}</strong></div></div><p className="report-footnote">La ganancia es bruta estimada: no descuenta gastos fijos, impuestos, comisiones ni otros costos operativos.</p></div></div>
  </section>;
}
function MovementsPage({ movements, products, onAdjust }: { movements: StockMovement[]; products: Product[]; onAdjust: (productId: string, delta: number, reason: string) => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("ALL");
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [adjustProductId, setAdjustProductId] = useState(products.find(p => p.active)?.id ?? "");
  const [adjustDirection, setAdjustDirection] = useState<"IN" | "OUT">("IN");
  const [adjustQuantity, setAdjustQuantity] = useState("1");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState(""); const [adjustBusy, setAdjustBusy] = useState(false);
  const selectedAdjustProduct = products.find(p => p.id === adjustProductId);
  async function submitAdjustment(e: FormEvent) {
    e.preventDefault(); setAdjustError("");
    const value = Number(adjustQuantity);
    if (!selectedAdjustProduct || !Number.isFinite(value) || value <= 0 || !adjustReason.trim()) { setAdjustError("Seleccioná un producto, ingresá una cantidad válida y explicá el motivo."); return; }
    const valid = selectedAdjustProduct.type === "BULK" ? Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-7 : Number.isInteger(value);
    if (!valid) { setAdjustError(selectedAdjustProduct.type === "BULK" ? "La cantidad debe expresarse en incrementos de 1 gramo." : "La cantidad debe ser un número entero de unidades."); return; }
    const base = Math.round(value * (selectedAdjustProduct.type === "BULK" ? 1000 : 1)) * (adjustDirection === "IN" ? 1 : -1);
    setAdjustBusy(true); try { await onAdjust(selectedAdjustProduct.id, base, adjustReason); setAdjustReason(""); setAdjustQuantity("1"); } catch (error) { setAdjustError(error instanceof Error ? error.message : "No se pudo registrar el ajuste."); } finally { setAdjustBusy(false); }
  }
  const filtered = movements.filter(m => {
    const time = new Date(m.date).getTime();
    return (kind === "ALL" || m.type === kind) && time >= dateAtStart(from) && time <= dateAtEnd(to) && `${m.productName} ${m.reason} ${m.referenceId}`.toLowerCase().includes(search.toLowerCase());
  });
  const typeLabels: Record<StockMovement["type"], string> = { SALE: "Venta", PURCHASE: "Compra", ADJUSTMENT: "Ajuste", RETURN: "Devolución" };
  function quantityLabel(m: StockMovement) { const product = products.find(p => p.id === m.productId); if ((m.productType ?? product?.type) === "UNIT") return `${Math.abs(m.quantity)} u.`; return `${(Math.abs(m.quantity) / 1000).toLocaleString("es-AR", { maximumFractionDigits: 3 })} kg`; }
  function exportMovements() { csvDownload(["fecha", "producto", "tipo", "cantidad_base", "stock_anterior", "stock_posterior", "motivo", "referencia"], filtered.map(m => [m.date, m.productName, typeLabels[m.type], m.quantity, m.stockBefore, m.stockAfter, m.reason, m.referenceId]), "movimientos-stock.csv"); }
  const salesCount = filtered.filter(m => m.type === "SALE").length;
  return <section>
    <div className="page-heading"><div><div className="eyebrow">TRAZABILIDAD DE EXISTENCIAS</div><h1>Movimientos de stock</h1><p>Registro de entradas y salidas generadas por las operaciones disponibles.</p></div><button className="secondary" onClick={exportMovements} disabled={!filtered.length}><FileDown size={16} /> Exportar CSV</button></div>
    <div className="stats-row report-stats"><Stat icon={<Activity />} label="Movimientos visibles" value={String(filtered.length)} /><Stat icon={<ArrowUpRight />} label="Líneas de venta" value={String(salesCount)} /><Stat icon={<Boxes />} label="Productos en catálogo" value={String(products.length)} /></div>
    <form className="panel adjustment-form" onSubmit={submitAdjustment}><div><div className="eyebrow">CORRECCIÓN DE EXISTENCIAS</div><h2>Registrar ajuste manual</h2><p>Usalo para corregir diferencias de inventario. Cada ajuste queda guardado en el historial.</p></div><label>Producto<select value={adjustProductId} onChange={e => setAdjustProductId(e.target.value)}>{products.filter(p => p.active).map(p => <option key={p.id} value={p.id}>{p.name} · {formatStock(p)}</option>)}</select></label><label>Tipo de ajuste<select value={adjustDirection} onChange={e => setAdjustDirection(e.target.value as "IN" | "OUT")}><option value="IN">Entrada / aumentar stock</option><option value="OUT">Salida / reducir stock</option></select></label><label>Cantidad ({selectedAdjustProduct?.type === "BULK" ? "kg" : "unidades"})<input type="number" min="0" step={selectedAdjustProduct?.type === "BULK" ? "0.001" : "1"} value={adjustQuantity} onChange={e => setAdjustQuantity(e.target.value)} /></label><label className="adjust-reason">Motivo obligatorio<input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="Ej. Diferencia detectada en recuento físico" /></label><button className="primary" disabled={adjustBusy || !products.some(p => p.active)}>{adjustBusy ? "Guardando…" : "Guardar ajuste"}</button>{adjustError && <div className="form-error adjust-error">{adjustError}</div>}</form>
    <div className="panel"><div className="movement-filters"><div className="searchbox"><Search size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar producto, motivo o referencia…" /></div><select value={kind} onChange={e => setKind(e.target.value)}><option value="ALL">Todos los tipos</option><option value="SALE">Ventas</option><option value="PURCHASE">Compras</option><option value="ADJUSTMENT">Ajustes</option><option value="RETURN">Devoluciones</option></select><label>Desde<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>Hasta<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>
      <div className="table-toolbar"><div><h2>Historial de movimientos</h2><p>{filtered.length} registros encontrados</p></div></div><div className="table-wrap"><table><thead><tr><th>FECHA</th><th>PRODUCTO</th><th>TIPO</th><th>CANTIDAD</th><th>STOCK ANTERIOR</th><th>STOCK RESULTANTE</th><th>MOTIVO / REFERENCIA</th></tr></thead><tbody>{filtered.map(m => <tr key={m.id}><td>{new Date(m.date).toLocaleString("es-AR")}</td><td><strong>{m.productName}</strong></td><td><span className={`movement-kind ${m.type.toLowerCase()}`}>{typeLabels[m.type]}</span></td><td><strong className={m.quantity < 0 ? "movement-out" : "movement-in"}>{m.quantity < 0 ? "−" : "+"}{quantityLabel(m)}</strong></td><td>{(() => { const p = products.find(x => x.id === m.productId); return (m.productType ?? p?.type) === "UNIT" ? `${m.stockBefore} u.` : `${(m.stockBefore / 1000).toLocaleString("es-AR")} kg`; })()}</td><td>{(() => { const p = products.find(x => x.id === m.productId); return (m.productType ?? p?.type) === "UNIT" ? `${m.stockAfter} u.` : `${(m.stockAfter / 1000).toLocaleString("es-AR")} kg`; })()}</td><td>{m.reason}<small className="subcell">{m.referenceId}</small></td></tr>)}{!filtered.length && <tr><td colSpan={7} className="empty">No hay movimientos que coincidan con los filtros. Registrá una venta o un ajuste manual para generar movimientos.</td></tr>}</tbody></table></div></div>
    <p className="footnote">Se registran automáticamente las salidas por venta y se permiten ajustes manuales con motivo obligatorio. Las entradas por compras y devoluciones se habilitarán con el módulo de compras.</p>
  </section>;
}

function ProductModal({ initial, onClose, onSave }: { initial: Product | null; onClose: () => void; onSave: (data: Omit<Product, "id" | "createdAt" | "updatedAt" | "active">, id?: string) => Promise<void> }) {
  const [name, setName] = useState(initial?.name ?? ""); const [category, setCategory] = useState(initial?.category ?? "Alimento para perros");
  const [type, setType] = useState<ProductType>(initial?.type ?? "BULK"); const [cost, setCost] = useState(String(initial?.costPrice ?? ""));
  const [price, setPrice] = useState(String(initial?.salePrice ?? "")); const [stock, setStock] = useState(initial ? String(initial.type === "BULK" ? initial.stock / 1000 : initial.stock) : "");
  const [minimum, setMinimum] = useState(initial ? String(initial.type === "BULK" ? initial.minimumStock / 1000 : initial.minimumStock) : "");
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const nums = [cost, price, stock, minimum].map(Number);
    const isWholeGram = (kg: number) => Math.abs(kg * 1000 - Math.round(kg * 1000)) < 1e-7;
    const stockIsValid = type === "BULK"
      ? isWholeGram(nums[2]) && isWholeGram(nums[3])
      : Number.isInteger(nums[2]) && Number.isInteger(nums[3]);
    if (!name.trim() || !category.trim() || nums.some(n => !Number.isFinite(n) || n < 0) || nums[0] <= 0 || nums[1] <= 0 || !stockIsValid) {
      setError(type === "BULK"
        ? "Completá los campos. Costos y precios deben ser mayores a cero; el stock a granel debe expresarse en incrementos de 1 gramo."
        : "Completá los campos. Costos y precios deben ser mayores a cero y el stock debe expresarse en unidades enteras.");
      return;
    }
    setSaving(true);
    try { await onSave({ name: name.trim(), category: category.trim(), type, costPrice: nums[0], salePrice: nums[1], stock: type === "BULK" ? Math.round(nums[2] * 1000) : Math.floor(nums[2]), minimumStock: type === "BULK" ? Math.round(nums[3] * 1000) : Math.floor(nums[3]) }, initial?.id); }
    catch { setError("No se pudo guardar el producto."); setSaving(false); }
  }
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><form className="modal" onSubmit={submit}><div className="modal-header"><div><div className="eyebrow">{initial ? "EDICIÓN" : "ALTA DE PRODUCTO"}</div><h2>{initial ? "Editar producto" : "Nuevo producto"}</h2></div><button type="button" className="icon-button" onClick={onClose}><X /></button></div>
    <label>Nombre del producto<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Ej. Pedigree Cachorros" /></label>
    <label>Categoría<select value={category} onChange={e => setCategory(e.target.value)}><option>Alimento para perros</option><option>Alimento para gatos</option><option>Accesorios</option><option>Higiene</option><option>Juguetes</option><option>Otros</option></select></label>
    <label>Modalidad de venta<div className="segmented"><button type="button" disabled={Boolean(initial)} className={type === "BULK" ? "active" : ""} onClick={() => { setType("BULK"); setStock("0"); setMinimum("0") }}>A granel (kg)</button><button type="button" disabled={Boolean(initial)} className={type === "UNIT" ? "active" : ""} onClick={() => { setType("UNIT"); setStock("0"); setMinimum("0") }}>Por unidad</button></div></label>
    {initial && <div className="helper">La modalidad no se puede cambiar después de crear el producto para evitar mezclar kilogramos, gramos y unidades.</div>}
    <div className="form-grid"><label>Costo de compra ({type === "BULK" ? "por kg" : "por unidad"})<div className="input-prefix"><span>$</span><input type="number" min="0" step="0.01" value={cost} onChange={e => setCost(e.target.value)} placeholder="0,00" /></div></label><label>Precio de venta ({type === "BULK" ? "por kg" : "por unidad"})<div className="input-prefix"><span>$</span><input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0,00" /></div></label></div>
    <div className="form-grid"><label>Stock actual ({type === "BULK" ? "kg" : "unidades"})<input type="number" min="0" step={type === "BULK" ? "0.001" : "1"} value={stock} onChange={e => setStock(e.target.value)} placeholder="0" /></label><label>Stock mínimo ({type === "BULK" ? "kg" : "unidades"})<input type="number" min="0" step={type === "BULK" ? "0.001" : "1"} value={minimum} onChange={e => setMinimum(e.target.value)} placeholder="0" /></label></div>
    {type === "BULK" && <div className="helper">El stock se guarda internamente en gramos para evitar errores de precisión.</div>}
    {error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancelar</button><button className="primary" disabled={saving}>{saving ? "Guardando…" : "Guardar producto"}</button></div>
  </form></div>;
}