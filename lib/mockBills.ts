export interface BillItem {
  name: string;
  price: number;
  qty?: number;
  unitPrice?: number;
}

export interface Bill {
  billNumber: string;
  tableName: string;
  serverName: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  tax: number;
  tip: number;
  grandTotal: number;
  status: "PAID" | "PENDING" | "CANCELLED";
  locationName?: string;
  orderModeDes?: string;
  time?: string;
  stewardName?: string;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  orderMode?: string;
  payments?: { method: string; amount: number }[];
}

export const mockBills: Record<string, Bill> = {
  "MC-8492": {
    billNumber: "MC-8492",
    tableName: "Table 12",
    locationName: "Colombo 03 - Branch",
    orderModeDes: "Dine In",
    serverName: "Nimal",
    date: "Oct 24, 2025",
    time: "10:45 PM",
    orderMode: "DINE",
    stewardName: "Thamindu",
    cashierName: "Anjalee",
    customerName: "Ajana",
    customerPhone: "+94773464656",
    items: [
      { name: "Soda - Regular", qty: 2, unitPrice: 220.0, price: 440.0 },
      { name: "Water Bottle", qty: 1, unitPrice: 100.0, price: 100.0 },
      { name: "Fried Fish With Thai Lemon Sauce - Regular", qty: 1, unitPrice: 2070.0, price: 2070.0 },
      { name: "Golden Fried Cashew Nuts - Regular", qty: 1, unitPrice: 1850.0, price: 1850.0 },
      { name: "Soda - Regular", qty: 1, unitPrice: 220.0, price: 220.0 },
      { name: "Tango Special Mixed Chopsuey Rice - Large", qty: 1, unitPrice: 3920.0, price: 3920.0 },
    ],
    subtotal: 8600.0,
    tax: 688.0,
    tip: 430.0,
    grandTotal: 9718.0,
    status: "PAID",
    payments: [
      { method: "CASH", amount: 4718.0 },
      { method: "VISA", amount: 5000.0 },
    ],
  },
  "MC-8493": {
    billNumber: "MC-8493",
    tableName: "Table 5",
    locationName: "Colombo 03 - Branch",
    orderModeDes: "Take Away",
    serverName: "Kumari",
    date: "Oct 24, 2025",
    orderMode: "TA",
    items: [
      { name: "Hoppers", qty: 3, unitPrice: 150.0, price: 450.0 },
      { name: "Dhal Curry", qty: 1, unitPrice: 200.0, price: 200.0 },
      { name: "Chicken Curry", qty: 1, unitPrice: 800.0, price: 800.0 },
      { name: "Plain Tea", qty: 2, unitPrice: 100.0, price: 200.0 },
    ],
    subtotal: 1650.0,
    tax: 132.0,
    tip: 100.0,
    grandTotal: 1882.0,
    status: "PENDING",
  },
  "MC-8494": {
    billNumber: "MC-8494",
    tableName: "Table 8",
    locationName: "Colombo 03 - Branch",
    orderModeDes: "Dine In",
    serverName: "Kasun",
    date: "Oct 25, 2025",
    orderMode: "DINE",
    items: [
      { name: "Rice & Curry", qty: 2, unitPrice: 800.0, price: 1600.0 },
      { name: "Kottu Roti", qty: 1, unitPrice: 850.0, price: 850.0 },
      { name: "Fresh Lime Juice", qty: 3, unitPrice: 150.0, price: 450.0 },
    ],
    subtotal: 2900.0,
    tax: 232.0,
    tip: 150.0,
    grandTotal: 3282.0,
    status: "PAID",
  },
};

export function getBillByNumber(billNumber: string): Bill | null {
  return mockBills[billNumber] || null;
}
