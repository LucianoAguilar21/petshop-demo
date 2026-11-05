export type ProductType = "BULK" | "UNIT";

export interface Product {
  id: string;
  name: string;
  category: string;
  type: ProductType;
  costPrice: number;       // ARS por kg si BULK; por unidad si UNIT
  salePrice: number;       // ARS por kg si BULK; por unidad si UNIT
  stock: number;           // gramos si BULK; unidades si UNIT
  minimumStock: number;    // gramos si BULK; unidades si UNIT
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  currency: "ARS";
  schemaVersion: 1;
}

export interface BackupData {
  app: "PetShop Manager";
  schemaVersion: 1;
  exportedAt: string;
  products: Product[];
  settings: AppSettings;
}

export const formatARS = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency", currency: "ARS", maximumFractionDigits: 2
  }).format(value);

export const formatStock = (product: Product) =>
  product.type === "BULK"
    ? `${(product.stock / 1000).toLocaleString("es-AR", { maximumFractionDigits: 3 })} kg`
    : `${product.stock} u.`;

export const isLowStock = (product: Product) =>
  product.stock <= product.minimumStock;
export type PaymentMethod = "CASH" | "TRANSFER" | "DEBIT" | "CREDIT" | "OTHER";

export interface SaleItem {
  productId: string;
  productName: string;
  productType: ProductType;
  quantityBase: number; // gramos para BULK; unidades para UNIT
  displayUnit: "g" | "unit";
  unitPrice: number; // ARS/kg para BULK; ARS/unidad para UNIT
  unitCost: number;
  subtotal: number;
  costTotal: number;
  grossProfit: number;
}

export interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  subtotal: number;
  total: number;
  totalCost: number;
  grossProfit: number;
  paymentMethod: PaymentMethod;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  productType?: ProductType;
  date: string;
  type: "SALE" | "PURCHASE" | "ADJUSTMENT" | "RETURN";
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  referenceId: string;
}
