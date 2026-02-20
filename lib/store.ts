import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language } from "./i18n";

// ─── Types ───────────────────────────────────────────────────────────

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  description: string;
  date: string; // ISO string
  createdAt: string;
}

export interface Category {
  id: string;
  nameKey: string; // i18n key or custom name
  icon: string; // SF Symbol name
  type: TransactionType;
  isCustom: boolean;
}

export interface UserProfile {
  name: string;
  businessName: string;
  currency: string;
  language: Language;
}

export type DebtType = "theyOweMe" | "iOweThem";

export interface DebtEntry {
  id: string;
  contactId: string;
  type: DebtType;
  amount: number;
  description: string;
  date: string; // ISO string
  createdAt: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  note: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  unit: string; // e.g., "pcs", "kg", "L"
  photoUri: string; // local URI or empty
  createdAt: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export type InvoiceStatus = "pending" | "paid" | "partial";

export interface Invoice {
  id: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: InvoiceStatus;
  paidAmount: number;
  date: string;
  dueDate: string;
  note: string;
  photoUris: string[]; // attached receipt/document photos
  createdAt: string;
}

export interface AppState {
  transactions: Transaction[];
  categories: Category[];
  profile: UserProfile;
  contacts: Contact[];
  debtEntries: DebtEntry[];
  products: Product[];
  invoices: Invoice[];
}

// ─── Storage Keys ────────────────────────────────────────────────────

const TRANSACTIONS_KEY = "@ledger_transactions";
const CATEGORIES_KEY = "@ledger_categories";
const PROFILE_KEY = "@ledger_profile";
const CONTACTS_KEY = "@ledger_contacts";
const DEBT_ENTRIES_KEY = "@ledger_debt_entries";
const PRODUCTS_KEY = "@ledger_products";
const INVOICES_KEY = "@ledger_invoices";

// ─── Default Categories ─────────────────────────────────────────────

export const DEFAULT_CATEGORIES: Category[] = [
  // Income
  { id: "inc_salary", nameKey: "salary", icon: "banknote.fill", type: "income", isCustom: false },
  { id: "inc_business", nameKey: "business", icon: "building.2.fill", type: "income", isCustom: false },
  { id: "inc_freelance", nameKey: "freelance", icon: "chevron.left.forwardslash.chevron.right", type: "income", isCustom: false },
  { id: "inc_investment", nameKey: "investment", icon: "chart.bar.fill", type: "income", isCustom: false },
  { id: "inc_gift", nameKey: "gift", icon: "gift.fill", type: "income", isCustom: false },
  { id: "inc_other", nameKey: "otherIncome", icon: "ellipsis", type: "income", isCustom: false },
  // Expense
  { id: "exp_food", nameKey: "food", icon: "fork.knife", type: "expense", isCustom: false },
  { id: "exp_transport", nameKey: "transport", icon: "bus.fill", type: "expense", isCustom: false },
  { id: "exp_utilities", nameKey: "utilities", icon: "bolt.fill", type: "expense", isCustom: false },
  { id: "exp_health", nameKey: "health", icon: "cross.fill", type: "expense", isCustom: false },
  { id: "exp_education", nameKey: "education", icon: "graduationcap.fill", type: "expense", isCustom: false },
  { id: "exp_shopping", nameKey: "shopping", icon: "cart.fill", type: "expense", isCustom: false },
  { id: "exp_phone", nameKey: "phone", icon: "phone.fill", type: "expense", isCustom: false },
  { id: "exp_entertainment", nameKey: "entertainment", icon: "heart.fill", type: "expense", isCustom: false },
  { id: "exp_rent", nameKey: "rent", icon: "house.fill", type: "expense", isCustom: false },
  { id: "exp_other", nameKey: "otherExpense", icon: "ellipsis", type: "expense", isCustom: false },
];

export const DEFAULT_PROFILE: UserProfile = {
  name: "",
  businessName: "",
  currency: "XOF",
  language: "en",
};

// ─── Storage Functions ───────────────────────────────────────────────

export async function loadTransactions(): Promise<Transaction[]> {
  try {
    const data = await AsyncStorage.getItem(TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveTransactions(transactions: Transaction[]): Promise<void> {
  await AsyncStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export async function loadCategories(): Promise<Category[]> {
  try {
    const data = await AsyncStorage.getItem(CATEGORIES_KEY);
    if (data) {
      const stored = JSON.parse(data) as Category[];
      // Merge with defaults to ensure new defaults are included
      const storedIds = new Set(stored.map((c) => c.id));
      const merged = [...stored];
      for (const def of DEFAULT_CATEGORIES) {
        if (!storedIds.has(def.id)) merged.push(def);
      }
      return merged;
    }
    return [...DEFAULT_CATEGORIES];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

export async function saveCategories(categories: Category[]): Promise<void> {
  await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export async function loadProfile(): Promise<UserProfile> {
  try {
    const data = await AsyncStorage.getItem(PROFILE_KEY);
    return data ? { ...DEFAULT_PROFILE, ...JSON.parse(data) } : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export async function loadContacts(): Promise<Contact[]> {
  try {
    const data = await AsyncStorage.getItem(CONTACTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveContacts(contacts: Contact[]): Promise<void> {
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts));
}

export async function loadDebtEntries(): Promise<DebtEntry[]> {
  try {
    const data = await AsyncStorage.getItem(DEBT_ENTRIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveDebtEntries(entries: DebtEntry[]): Promise<void> {
  await AsyncStorage.setItem(DEBT_ENTRIES_KEY, JSON.stringify(entries));
}

export async function loadProducts(): Promise<Product[]> {
  try {
    const data = await AsyncStorage.getItem(PRODUCTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveProducts(products: Product[]): Promise<void> {
  await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

export async function loadInvoices(): Promise<Invoice[]> {
  try {
    const data = await AsyncStorage.getItem(INVOICES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveInvoices(invoices: Invoice[]): Promise<void> {
  await AsyncStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
}

export function generateInvoiceNumber(existingInvoices: Invoice[]): string {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const count = existingInvoices.filter((inv) => inv.invoiceNumber.startsWith(prefix)).length;
  return `${prefix}-${String(count + 1).padStart(3, "0")}`;
}

// ─── Utility Functions ───────────────────────────────────────────────

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function formatCurrency(amount: number, currency: string): string {
  const formatted = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const symbols: Record<string, string> = {
    XOF: "CFA",
    XAF: "CFA",
    NGN: "₦",
    GHS: "GH₵",
    KES: "KSh",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const symbol = symbols[currency] || currency;
  return `${formatted} ${symbol}`;
}

export function getDateRange(period: "daily" | "weekly" | "monthly" | "yearly"): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  let start: Date;

  switch (period) {
    case "daily":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      break;
    case "weekly":
      const dayOfWeek = now.getDay();
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek, 0, 0, 0);
      break;
    case "monthly":
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      break;
    case "yearly":
      start = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
      break;
  }

  return { start, end };
}

export function filterTransactionsByPeriod(
  transactions: Transaction[],
  period: "daily" | "weekly" | "monthly" | "yearly"
): Transaction[] {
  const { start, end } = getDateRange(period);
  return transactions.filter((tx) => {
    const d = new Date(tx.date);
    return d >= start && d <= end;
  });
}

export function calculateTotals(transactions: Transaction[]): {
  income: number;
  expense: number;
  balance: number;
} {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }
  return { income, expense, balance: income - expense };
}

export function calculateContactBalance(entries: DebtEntry[], contactId: string): {
  theyOweMe: number;
  iOweThem: number;
  netBalance: number;
} {
  let theyOweMe = 0;
  let iOweThem = 0;
  for (const entry of entries) {
    if (entry.contactId !== contactId) continue;
    if (entry.type === "theyOweMe") theyOweMe += entry.amount;
    else iOweThem += entry.amount;
  }
  return { theyOweMe, iOweThem, netBalance: theyOweMe - iOweThem };
}

export const CURRENCIES = [
  { code: "XOF", name: "CFA Franc (BCEAO)" },
  { code: "XAF", name: "CFA Franc (BEAC)" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
];
