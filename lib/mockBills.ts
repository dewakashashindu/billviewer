export interface BillItem {
  name: string;
  price: number;
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
}

export const mockBills: Record<string, Bill> = {
  "MC-8492": {
    billNumber: "MC-8492",
    tableName: "Table 12",
    serverName: "Nimal",
    date: "Oct 24, 2025",
    items: [
      { name: "Chicken Kottu Roti x 2", price: 1800.0 },
      { name: "Fish Ambulthiyal x 1", price: 1200.0 },
      { name: "Pol Sambol & Rice x 3", price: 2100.0 },
      { name: "King Coconut x 4", price: 800.0 },
      { name: "Watalappan x 2", price: 900.0 },
    ],
    subtotal: 6800.0,
    tax: 544.0,
    tip: 340.0,
    grandTotal: 7684.0,
    status: "PAID",
  },
  "MC-8493": {
    billNumber: "MC-8493",
    tableName: "Table 5",
    serverName: "Kumari",
    date: "Oct 24, 2025",
    items: [
      { name: "Hoppers x 3", price: 450.0 },
      { name: "Dhal Curry", price: 200.0 },
      { name: "Chicken Curry", price: 800.0 },
      { name: "Plain Tea x 2", price: 200.0 },
    ],
    subtotal: 1650.0,
    tax: 132.0,
    tip: 100.0,
    grandTotal: 1882.0,
    status: "PAID",
  },
  "MC-8494": {
    billNumber: "MC-8494",
    tableName: "Table 8",
    serverName: "Kasun",
    date: "Oct 25, 2025",
    items: [
      { name: "Rice & Curry x 2", price: 1600.0 },
      { name: "Kottu Roti x 1", price: 850.0 },
      { name: "Fresh Lime Juice x 3", price: 450.0 },
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