// Database service wrapper for local storage data persistence

export interface ProductVariation {
  size?: string;
  color?: string;
  stock: number;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  variations: ProductVariation[];
  image: string; // URL path or base64 placeholder
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes?: string;
  createdAt: string;
}

export interface TransactionItem {
  productId: string;
  name: string;
  variation?: {
    size?: string;
    color?: string;
  };
  quantity: number;
  price: number;
}

export interface Transaction {
  id: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
  };
  items: TransactionItem[];
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: "Cash" | "Mobile Money";
  momoNetwork?: "MTN" | "Telecel" | "AT";
  timestamp: string;
  isVoided: boolean;
  operator: string;
}

// Initial Data Seeding
const DEFAULT_CATEGORIES = ["Pomades", "Skincare", "Clothing"];

const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Edith's Organic Shea Butter Pomade",
    category: "Pomades",
    description: "Premium pure Ghanaian shea butter infused with lavender oils for hair and body growth.",
    price: 65.00,
    stock: 50,
    variations: [
      { size: "Medium (250g)", stock: 30, price: 65.00 },
      { size: "Large (500g)", stock: 20, price: 110.00 }
    ],
    image: "/logo.png"
  },
  {
    id: "p2",
    name: "Cocoa Butter Skin Nourisher",
    category: "Skincare",
    description: "Deeply moisturizing cocoa butter lotion sourced locally. Ideal for daily skin protection.",
    price: 85.00,
    stock: 40,
    variations: [
      { size: "Standard (200ml)", stock: 25, price: 85.00 },
      { size: "Family Pack (400ml)", stock: 15, price: 150.00 }
    ],
    image: "/logo.png"
  },
  {
    id: "p3",
    name: "DiaPalace Handcrafted Smock",
    category: "Clothing",
    description: "Authentic woven Northern Ghana Smock with premium stitching and traditional colors.",
    price: 320.00,
    stock: 12,
    variations: [
      { size: "M", color: "Blue Stripes", stock: 4, price: 320.00 },
      { size: "L", color: "Blue Stripes", stock: 5, price: 320.00 },
      { size: "XL", color: "Red Classic", stock: 3, price: 350.00 }
    ],
    image: "/logo.png"
  },
  {
    id: "p4",
    name: "Alata Samina (African Black Soap)",
    category: "Skincare",
    description: "Traditional liquid black soap infused with neem extract and tea tree oil for acne-prone skin.",
    price: 45.00,
    stock: 60,
    variations: [
      { size: "250ml Bottle", stock: 40, price: 45.00 },
      { size: "500ml Bottle", stock: 20, price: 80.00 }
    ],
    image: "/logo.png"
  },
  {
    id: "p5",
    name: "Premium Cotton Summer Dress",
    category: "Clothing",
    description: "Lightweight, breathable summer dress handmade by local tailors with vibrant African prints.",
    price: 180.00,
    stock: 15,
    variations: [
      { size: "S", color: "Kente Print", stock: 5, price: 180.00 },
      { size: "M", color: "Kente Print", stock: 5, price: 180.00 },
      { size: "L", color: "Woodin Pattern", stock: 5, price: 195.00 }
    ],
    image: "/logo.png"
  }
];

const DEFAULT_CUSTOMERS: Customer[] = [
  {
    id: "c1",
    name: "Ama Mensah",
    phone: "+233 24 412 3456",
    notes: "Prefers Lavender scent pomade. Regular buyer.",
    createdAt: "2026-06-01T10:00:00Z"
  },
  {
    id: "c2",
    name: "Kofi Asante",
    phone: "+233 20 811 9876",
    notes: "Buys Smocks for family gifts.",
    createdAt: "2026-06-15T12:00:00Z"
  },
  {
    id: "c3",
    name: "Efua Osei",
    phone: "+233 55 902 4433",
    notes: "Skincare focus. Interested in new soap arrivals.",
    createdAt: "2026-07-02T14:30:00Z"
  }
];

// Helper to check if window is available (client-side)
const isClient = () => typeof window !== "undefined";

export const db = {
  // Products
  getProducts(): Product[] {
    if (!isClient()) return DEFAULT_PRODUCTS;
    const data = localStorage.getItem("dp_products");
    if (!data) {
      this.saveProducts(DEFAULT_PRODUCTS);
      return DEFAULT_PRODUCTS;
    }
    return JSON.parse(data);
  },

  saveProducts(products: Product[]): void {
    if (!isClient()) return;
    localStorage.setItem("dp_products", JSON.stringify(products));
  },

  // Categories
  getCategories(): string[] {
    if (!isClient()) return DEFAULT_CATEGORIES;
    const data = localStorage.getItem("dp_categories");
    if (!data) {
      this.saveCategories(DEFAULT_CATEGORIES);
      return DEFAULT_CATEGORIES;
    }
    return JSON.parse(data);
  },

  saveCategories(categories: string[]): void {
    if (!isClient()) return;
    localStorage.setItem("dp_categories", JSON.stringify(categories));
  },

  // Customers
  getCustomers(): Customer[] {
    if (!isClient()) return DEFAULT_CUSTOMERS;
    const data = localStorage.getItem("dp_customers");
    if (!data) {
      this.saveCustomers(DEFAULT_CUSTOMERS);
      return DEFAULT_CUSTOMERS;
    }
    return JSON.parse(data);
  },

  saveCustomers(customers: Customer[]): void {
    if (!isClient()) return;
    localStorage.setItem("dp_customers", JSON.stringify(customers));
  },

  // Transactions
  getTransactions(): Transaction[] {
    if (!isClient()) return [];
    const data = localStorage.getItem("dp_transactions");
    return data ? JSON.parse(data) : [];
  },

  saveTransactions(transactions: Transaction[]): void {
    if (!isClient()) return;
    localStorage.setItem("dp_transactions", JSON.stringify(transactions));
  },

  // Edith's Login Session (Basic)
  getSession(): string | null {
    if (!isClient()) return null;
    return localStorage.getItem("dp_session_operator");
  },

  setSession(operator: string | null): void {
    if (!isClient()) return;
    if (operator) {
      localStorage.setItem("dp_session_operator", operator);
    } else {
      localStorage.removeItem("dp_session_operator");
    }
  }
};
