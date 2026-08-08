export type PaymentMethod = "Cash" | "MTN MoMo" | "Telecel Cash" | "AirtelTigo Money" | "Card / POS" | "Bank transfer" | "Credit";

export type Product = {
  id: string;
  name: string;
  description?: string;
  sku: string;
  category: string;
  price: number;
  cost: number;
  stock: number;
  reorderAt: number;
  unit: string;
};

export type Customer = { id: string; name: string; phone: string; credit: number; visits: number };
export type CartItem = { productId: string; name: string; price: number; qty: number; stock: number };
export type Sale = { id: string; date: string; items: CartItem[]; total: number; method: PaymentMethod; customer: string; operator: string };
export type Purchase = { id: string; supplier: string; date: string; amount: number; status: "Received" | "Pending" };
export type Expense = { id: string; description: string; category: string; date: string; amount: number };

export type PosState = {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
  taxEnabled: boolean;
  taxRate: number;
};

export const seedProducts: Product[] = [];

export const seedCustomers: Customer[] = [
  { id: "c-walkin", name: "Walk-in Customer", phone: "", credit: 0, visits: 0 },
];

export const seedSales: Sale[] = [];

export const seedPurchases: Purchase[] = [];

export const seedExpenses: Expense[] = [];

export const defaultPosState: PosState = {
  products: seedProducts,
  customers: seedCustomers,
  sales: seedSales,
  purchases: seedPurchases,
  expenses: seedExpenses,
  taxEnabled: false,
  taxRate: 15,
};
