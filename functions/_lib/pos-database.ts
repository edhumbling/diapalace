import { defaultPosState, type PosState } from "../../src/lib/pos-data";

type ProductRow = { id: string; name: string; description: string | null; sku: string; category: string; price: number; cost: number; stock: number; reorder_at: number; unit: string };
type CustomerRow = { id: string; name: string; phone: string; credit: number; visits: number };
type SaleRow = { id: string; invoice_number: string; created_at: string; total: number; method: PosState["sales"][number]["method"]; customer: string; operator: string };
type SaleItemRow = { sale_id: string; product_id: string; name: string; price: number; qty: number; stock: number };
type PurchaseRow = { id: string; supplier: string; date: string; amount: number; status: "Received" | "Pending" };
type ExpenseRow = { id: string; description: string; category: string; date: string; amount: number };

const dateLabel = (value: string) => {
  const date = new Date(value);
  if (isNaN(date.getTime())) return value;
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const prefix = date.toDateString() === now.toDateString() ? "Today" : date.toDateString() === yesterday.toDateString() ? "Yesterday" : new Intl.DateTimeFormat("en-GH", { month: "short", day: "numeric", year: "numeric" }).format(date);
  return `${prefix}, ${new Intl.DateTimeFormat("en-GH", { hour: "numeric", minute: "2-digit" }).format(date)}`;
};

async function ensureDefaultCustomerAndCategories(db: D1Database) {
  try {
    const defaultCategories = [
      ["cat-apparel", "Apparel"],
      ["cat-accessories", "Accessories"],
      ["cat-electronics", "Electronics"],
      ["cat-groceries", "Groceries"],
      ["cat-beverages", "Beverages"],
      ["cat-general", "General"],
    ];

    const statements: D1PreparedStatement[] = [
      db.prepare("INSERT OR IGNORE INTO customers (id, name, phone, credit_balance, visit_count) VALUES ('c-walkin', 'Walk-in Customer', '', 0, 0)"),
    ];

    for (const [id, name] of defaultCategories) {
      statements.push(db.prepare("INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)").bind(id, name));
    }

    await db.batch(statements);
  } catch (err) {
    console.error("Failed to ensure default categories/customer:", err);
  }
}

export async function getPosState(db: D1Database, branchId?: string | null): Promise<PosState> {
  await ensureDefaultCustomerAndCategories(db);

  const productScope = branchId ? " WHERE p.branch_id = ?" : "";
  const salesScope = branchId ? " WHERE s.branch_id = ?" : "";
  const purchaseScope = branchId ? " WHERE branch_id = ?" : "";
  const expenseScope = branchId ? " WHERE branch_id = ?" : "";
  const scopeParams = branchId ? [branchId] : [];

  const [products, customers, sales, saleItems, purchases, expenses, settings, paymentMethods] = await Promise.all([
    db.prepare(`SELECT p.id, p.name, COALESCE(p.description, '') AS description, p.sku, c.name AS category, p.selling_price AS price, p.cost_price AS cost, p.stock_quantity AS stock, p.reorder_level AS reorder_at, p.unit FROM products p JOIN categories c ON c.id = p.category_id${productScope} ORDER BY p.name`).bind(...scopeParams).all<ProductRow>(),
    db.prepare("SELECT id, name, phone, credit_balance AS credit, visit_count AS visits FROM customers ORDER BY name").all<CustomerRow>(),
    db.prepare(`SELECT s.id, s.invoice_number, s.created_at, s.total, COALESCE(pay.method, 'Cash') AS method, COALESCE(c.name, 'Walk-in Customer') AS customer, COALESCE(u.full_name, 'Staff') AS operator FROM sales s LEFT JOIN customers c ON c.id = s.customer_id LEFT JOIN users u ON u.id = s.cashier_id LEFT JOIN payments pay ON pay.sale_id = s.id${salesScope} ORDER BY s.created_at DESC`).bind(...scopeParams).all<SaleRow>(),
    db.prepare("SELECT si.sale_id, si.product_id, p.name, si.unit_price AS price, si.quantity AS qty, p.stock_quantity AS stock FROM sale_items si JOIN products p ON p.id = si.product_id").all<SaleItemRow>(),
    db.prepare(`SELECT id, supplier_name AS supplier, purchase_date AS date, amount, status FROM purchases${purchaseScope} ORDER BY purchase_date DESC`).bind(...scopeParams).all<PurchaseRow>(),
    db.prepare(`SELECT id, description, category, expense_date AS date, amount FROM expenses${expenseScope} ORDER BY expense_date DESC`).bind(...scopeParams).all<ExpenseRow>(),
    db.prepare("SELECT key, value FROM settings WHERE key IN ('tax_enabled', 'tax_rate')").all<{ key: string; value: string }>(),
    db.prepare("SELECT name FROM payment_methods WHERE enabled = 1 ORDER BY name").all<{ name: string }>(),
  ]);

  const itemRows = saleItems.results ?? [];
  const settingsMap = new Map((settings.results ?? []).map((setting) => [setting.key, setting.value]));

  const customerList = customers.results ?? [];
  if (customerList.length === 0) {
    customerList.push({ id: "c-walkin", name: "Walk-in Customer", phone: "", credit: 0, visits: 0 });
  }

  return {
    products: (products.results ?? []).map(({ reorder_at: reorderAt, description, ...product }) => ({ ...product, description: description ?? undefined, reorderAt })),
    customers: customerList,
    sales: (sales.results ?? []).map((sale) => ({ id: sale.invoice_number, date: dateLabel(sale.created_at), items: itemRows.filter((item) => item.sale_id === sale.id).map((item) => ({ productId: item.product_id, name: item.name, price: item.price, qty: item.qty, stock: item.stock })), total: sale.total, method: sale.method, customer: sale.customer, operator: sale.operator })),
    purchases: purchases.results ?? [],
    expenses: expenses.results ?? [],
    taxEnabled: settingsMap.get("tax_enabled") === "1",
    taxRate: Number(settingsMap.get("tax_rate") ?? 15),
    paymentMethods: (paymentMethods.results ?? []).map((method) => method.name),
  };
}
