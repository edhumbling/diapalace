export type ReceiptWidth = "58mm" | "80mm";

export type ReceiptItem = {
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type ReceiptData = {
  id: string;
  saleId: string;
  receiptNumber: string;
  businessName: string;
  branchName: string;
  businessPhone: string;
  businessEmail?: string;
  branchAddress?: string;
  cashierName: string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  createdAt: string;
  footer: string;
  width?: ReceiptWidth;
};
