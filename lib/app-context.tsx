import React, { createContext, useContext, useEffect, useReducer, useCallback, useRef } from "react";
import {
  Transaction,
  Category,
  UserProfile,
  Contact,
  DebtEntry,
  DebtType,
  Product,
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  DEFAULT_PROFILE,
  DEFAULT_CATEGORIES,
  loadTransactions,
  saveTransactions,
  loadCategories,
  saveCategories,
  loadProfile,
  saveProfile,
  loadContacts,
  saveContacts,
  loadDebtEntries,
  saveDebtEntries,
  loadProducts,
  saveProducts,
  loadInvoices,
  saveInvoices,
  generateId,
  generateInvoiceNumber,
  TransactionType,
} from "./store";
import { Language, getStoredLanguage, setStoredLanguage, t, TranslationKey } from "./i18n";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";
import { Platform } from "react-native";
import * as Network from "expo-network";

async function isOnline(): Promise<boolean> {
  try {
    if (Platform.OS === "web") return navigator.onLine;
    const state = await Network.getNetworkStateAsync();
    return state.isConnected === true && state.isInternetReachable !== false;
  } catch {
    return true; // assume online if check fails
  }
}

// ─── State ───────────────────────────────────────────────────────────

interface AppState {
  transactions: Transaction[];
  categories: Category[];
  profile: UserProfile;
  contacts: Contact[];
  debtEntries: DebtEntry[];
  products: Product[];
  invoices: Invoice[];
  language: Language;
  isLoading: boolean;
}

type Action =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOAD_DATA"; payload: { transactions: Transaction[]; categories: Category[]; profile: UserProfile; language: Language; contacts: Contact[]; debtEntries: DebtEntry[]; products: Product[]; invoices: Invoice[] } }
  | { type: "ADD_TRANSACTION"; payload: Transaction }
  | { type: "UPDATE_TRANSACTION"; payload: Transaction }
  | { type: "DELETE_TRANSACTION"; payload: string }
  | { type: "ADD_CATEGORY"; payload: Category }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "UPDATE_PROFILE"; payload: Partial<UserProfile> }
  | { type: "SET_LANGUAGE"; payload: Language }
  | { type: "ADD_CONTACT"; payload: Contact }
  | { type: "UPDATE_CONTACT"; payload: Contact }
  | { type: "DELETE_CONTACT"; payload: string }
  | { type: "ADD_DEBT_ENTRY"; payload: DebtEntry }
  | { type: "UPDATE_DEBT_ENTRY"; payload: DebtEntry }
  | { type: "DELETE_DEBT_ENTRY"; payload: string }
  | { type: "CLEAR_CONTACT_DEBTS"; payload: string }
  | { type: "ADD_PRODUCT"; payload: Product }
  | { type: "UPDATE_PRODUCT"; payload: Product }
  | { type: "DELETE_PRODUCT"; payload: string }
  | { type: "ADD_INVOICE"; payload: Invoice }
  | { type: "UPDATE_INVOICE"; payload: Invoice }
  | { type: "DELETE_INVOICE"; payload: string };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "LOAD_DATA":
      return { ...state, ...action.payload, isLoading: false };
    case "ADD_TRANSACTION":
      return { ...state, transactions: [action.payload, ...state.transactions] };
    case "UPDATE_TRANSACTION":
      return { ...state, transactions: state.transactions.map((tx) => tx.id === action.payload.id ? action.payload : tx) };
    case "DELETE_TRANSACTION":
      return { ...state, transactions: state.transactions.filter((tx) => tx.id !== action.payload) };
    case "ADD_CATEGORY":
      return { ...state, categories: [...state.categories, action.payload] };
    case "DELETE_CATEGORY":
      return { ...state, categories: state.categories.filter((c) => c.id !== action.payload) };
    case "UPDATE_PROFILE":
      return { ...state, profile: { ...state.profile, ...action.payload } };
    case "SET_LANGUAGE":
      return { ...state, language: action.payload, profile: { ...state.profile, language: action.payload } };
    case "ADD_CONTACT":
      return { ...state, contacts: [action.payload, ...state.contacts] };
    case "UPDATE_CONTACT":
      return { ...state, contacts: state.contacts.map((c) => c.id === action.payload.id ? action.payload : c) };
    case "DELETE_CONTACT":
      return {
        ...state,
        contacts: state.contacts.filter((c) => c.id !== action.payload),
        debtEntries: state.debtEntries.filter((e) => e.contactId !== action.payload),
      };
    case "ADD_DEBT_ENTRY":
      return { ...state, debtEntries: [action.payload, ...state.debtEntries] };
    case "UPDATE_DEBT_ENTRY":
      return { ...state, debtEntries: state.debtEntries.map((e) => e.id === action.payload.id ? action.payload : e) };
    case "DELETE_DEBT_ENTRY":
      return { ...state, debtEntries: state.debtEntries.filter((e) => e.id !== action.payload) };
    case "CLEAR_CONTACT_DEBTS":
      return { ...state, debtEntries: state.debtEntries.filter((e) => e.contactId !== action.payload) };
    case "ADD_PRODUCT":
      return { ...state, products: [action.payload, ...state.products] };
    case "UPDATE_PRODUCT":
      return { ...state, products: state.products.map((p) => p.id === action.payload.id ? action.payload : p) };
    case "DELETE_PRODUCT":
      return { ...state, products: state.products.filter((p) => p.id !== action.payload) };
    case "ADD_INVOICE":
      return { ...state, invoices: [action.payload, ...state.invoices] };
    case "UPDATE_INVOICE":
      return { ...state, invoices: state.invoices.map((inv) => inv.id === action.payload.id ? action.payload : inv) };
    case "DELETE_INVOICE":
      return { ...state, invoices: state.invoices.filter((inv) => inv.id !== action.payload) };
    default:
      return state;
  }
}

const initialState: AppState = {
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  profile: DEFAULT_PROFILE,
  contacts: [],
  debtEntries: [],
  products: [],
  invoices: [],
  language: "en",
  isLoading: true,
};

// ─── Server Sync Helpers ────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (Platform.OS !== "web") {
    const token = await Auth.getSessionToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function pullFromServer(): Promise<{
  profile: UserProfile | null;
  categories: Category[];
  transactions: Transaction[];
  contacts: Contact[];
  debtEntries: DebtEntry[];
  products: Product[];
  invoices: Invoice[];
} | null> {
  try {
    const baseUrl = getApiBaseUrl();
    const headers = await getAuthHeaders();
    const url = `${baseUrl}/api/trpc/data.pull`;
    const response = await fetch(url, {
      method: "GET",
      headers,
      credentials: "include",
    });
    if (!response.ok) return null;
    const json = await response.json();
    // tRPC wraps in { result: { data: ... } }
    const data = json?.result?.data;
    if (!data) return null;
    return {
      profile: data.profile ? {
        name: data.profile.name || "",
        businessName: data.profile.businessName || "",
        businessAddress: data.profile.businessAddress || "",
        businessPhone: data.profile.businessPhone || "",
        currency: data.profile.currency || "XAF",
        language: (data.profile.language || "en") as Language,
        logoUri: data.profile.logoUri || "",
      } : null,
      categories: data.categories || [],
      transactions: data.transactions || [],
      contacts: data.contacts || [],
      debtEntries: data.debtEntries || [],
      products: data.products || [],
      invoices: data.invoices || [],
    };
  } catch (err) {
    console.log("[Sync] Pull from server failed, using local data:", err);
    return null;
  }
}

async function pushToServer(state: AppState): Promise<void> {
  try {
    const baseUrl = getApiBaseUrl();
    const headers = await getAuthHeaders();
    const url = `${baseUrl}/api/trpc/data.push`;
    const body = JSON.stringify({
      profile: {
        name: state.profile.name,
        businessName: state.profile.businessName,
        currency: state.profile.currency,
        language: state.profile.language,
        logoUri: state.profile.logoUri,
      },
      categories: state.categories.filter(c => c.isCustom).map(c => ({
        id: c.id, nameKey: c.nameKey, icon: c.icon, type: c.type, isCustom: c.isCustom,
      })),
      transactions: state.transactions.map(tx => ({
        id: tx.id, type: tx.type, amount: tx.amount, categoryId: tx.categoryId,
        description: tx.description, date: tx.date,
      })),
      contacts: state.contacts.map(c => ({
        id: c.id, name: c.name, phone: c.phone, note: c.note,
      })),
      debtEntries: state.debtEntries.map(d => ({
        id: d.id, contactId: d.contactId, type: d.type, amount: d.amount,
        description: d.description, date: d.date,
      })),
      products: state.products.map(p => ({
        id: p.id, name: p.name, description: p.description, price: p.price,
        quantity: p.quantity, unit: p.unit, photoUri: p.photoUri,
      })),
      invoices: state.invoices.map(inv => ({
        id: inv.id, invoiceNumber: inv.invoiceNumber, contactId: inv.contactId,
        contactName: inv.contactName, items: inv.items, subtotal: inv.subtotal,
        discountType: inv.discountType, discountValue: inv.discountValue,
        discountAmount: inv.discountAmount, tax: inv.tax, total: inv.total,
        status: inv.status, paidAmount: inv.paidAmount, date: inv.date,
        dueDate: inv.dueDate, note: inv.note, photoUris: inv.photoUris,
      })),
    });

    await fetch(url, {
      method: "POST",
      headers,
      credentials: "include",
      body,
    });
  } catch (err) {
    console.log("[Sync] Push to server failed (will retry):", err);
  }
}

// ─── Context ─────────────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  addTransaction: (type: TransactionType, amount: number, categoryId: string, description: string, date: string) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  addCategory: (nameKey: string, icon: string, type: TransactionType) => void;
  deleteCategory: (id: string) => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  setLanguage: (lang: Language) => void;
  translate: (key: TranslationKey) => string;
  addContact: (name: string, phone: string, note: string) => Contact;
  updateContact: (contact: Contact) => void;
  deleteContact: (id: string) => void;
  addDebtEntry: (contactId: string, type: DebtType, amount: number, description: string, date: string) => void;
  deleteDebtEntry: (id: string) => void;
  settleContact: (contactId: string) => void;
  addProduct: (name: string, description: string, price: number, quantity: number, unit: string, photoUri: string) => Product;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addInvoice: (contactId: string, contactName: string, items: InvoiceItem[], tax: number, note: string, dueDate: string, photoUris: string[], discountType?: import("./store").DiscountType, discountValue?: number) => Invoice;
  changeInvoiceStatus: (invoiceId: string, newStatus: InvoiceStatus) => void;
  makePartialPayment: (invoiceId: string, paymentAmount: number) => void;
  updateInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  // ─── Load data on mount ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Step 1: Load from local storage IMMEDIATELY (fast, always available)
      const [localTxns, localCats, localProfile, language, localContacts, localDebts, localProducts, localInvoices] = await Promise.all([
        loadTransactions(),
        loadCategories(),
        loadProfile(),
        getStoredLanguage(),
        loadContacts(),
        loadDebtEntries(),
        loadProducts(),
        loadInvoices(),
      ]);

      const localData = {
        transactions: localTxns,
        categories: localCats,
        profile: { ...localProfile, language },
        language,
        contacts: localContacts,
        debtEntries: localDebts,
        products: localProducts,
        invoices: localInvoices,
      };

      // Show local data right away so user sees content instantly
      dispatch({ type: "LOAD_DATA", payload: localData });
      isInitialLoadRef.current = false;

      // Step 2: Sync with server in background (non-blocking)
      try {
        const online = await isOnline();
        if (!online) return;
        const serverData = await pullFromServer();
        if (!serverData) return;

        const hasServerData = serverData.transactions.length > 0 || serverData.contacts.length > 0 ||
          serverData.products.length > 0 || serverData.invoices.length > 0;

        if (hasServerData) {
          const serverProfile = serverData.profile || localProfile;
          const serverLang = (serverProfile.language || language) as Language;
          const mergedCats = [...DEFAULT_CATEGORIES];
          const defaultIds = new Set(DEFAULT_CATEGORIES.map(c => c.id));
          for (const cat of serverData.categories) {
            if (!defaultIds.has(cat.id)) mergedCats.push(cat);
          }

          dispatch({ type: "LOAD_DATA", payload: {
            transactions: serverData.transactions,
            categories: mergedCats,
            profile: { ...serverProfile, language: serverLang },
            language: serverLang,
            contacts: serverData.contacts,
            debtEntries: serverData.debtEntries,
            products: serverData.products,
            invoices: serverData.invoices,
          }});
        } else if (localTxns.length > 0 || localContacts.length > 0 || localProducts.length > 0 || localInvoices.length > 0) {
          const stateToSync: AppState = {
            ...localData,
            isLoading: false,
          };
          pushToServer(stateToSync).catch(() => {});
        }
      } catch {
        // Server sync failed silently — local data is already displayed
      }
    })();
  }, []);

  // ─── Persist to local storage + debounced server sync ─────────────
  useEffect(() => {
    if (state.isLoading) return;
    saveTransactions(state.transactions);
    saveCategories(state.categories);
    saveProfile(state.profile);
    saveContacts(state.contacts);
    saveDebtEntries(state.debtEntries);
    saveProducts(state.products);
    saveInvoices(state.invoices);

    // Debounced server sync — push after 2 seconds of inactivity, only if online
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(async () => {
      if (!isInitialLoadRef.current) {
        const online = await isOnline();
        if (online) {
          pushToServer(state).catch(() => {});
        }
      }
    }, 2000);
  }, [state.transactions, state.categories, state.profile, state.contacts, state.debtEntries, state.products, state.invoices, state.isLoading]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, []);

  // ─── Transaction Actions ──────────────────────────────────────────

  const addTransaction = useCallback(
    (type: TransactionType, amount: number, categoryId: string, description: string, date: string) => {
      const tx: Transaction = { id: generateId(), type, amount, categoryId, description, date, createdAt: new Date().toISOString() };
      dispatch({ type: "ADD_TRANSACTION", payload: tx });
    }, []);

  const updateTransaction = useCallback((tx: Transaction) => { dispatch({ type: "UPDATE_TRANSACTION", payload: tx }); }, []);
  const deleteTransaction = useCallback((id: string) => { dispatch({ type: "DELETE_TRANSACTION", payload: id }); }, []);

  const addCategory = useCallback((nameKey: string, icon: string, type: TransactionType) => {
    const cat: Category = { id: generateId(), nameKey, icon, type, isCustom: true };
    dispatch({ type: "ADD_CATEGORY", payload: cat });
  }, []);

  const deleteCategory = useCallback((id: string) => { dispatch({ type: "DELETE_CATEGORY", payload: id }); }, []);
  const updateProfile = useCallback((updates: Partial<UserProfile>) => { dispatch({ type: "UPDATE_PROFILE", payload: updates }); }, []);

  const setLanguage = useCallback((lang: Language) => {
    setStoredLanguage(lang);
    dispatch({ type: "SET_LANGUAGE", payload: lang });
  }, []);

  const translate = useCallback((key: TranslationKey) => t(key, state.language), [state.language]);

  // ─── Contact Actions ──────────────────────────────────────────────

  const addContact = useCallback((name: string, phone: string, note: string): Contact => {
    const contact: Contact = { id: generateId(), name, phone, note, createdAt: new Date().toISOString() };
    dispatch({ type: "ADD_CONTACT", payload: contact });
    return contact;
  }, []);

  const updateContact = useCallback((contact: Contact) => { dispatch({ type: "UPDATE_CONTACT", payload: contact }); }, []);
  const deleteContact = useCallback((id: string) => { dispatch({ type: "DELETE_CONTACT", payload: id }); }, []);

  const addDebtEntry = useCallback(
    (contactId: string, type: DebtType, amount: number, description: string, date: string) => {
      const entry: DebtEntry = { id: generateId(), contactId, type, amount, description, date, createdAt: new Date().toISOString() };
      dispatch({ type: "ADD_DEBT_ENTRY", payload: entry });
    }, []);

  const deleteDebtEntry = useCallback((id: string) => { dispatch({ type: "DELETE_DEBT_ENTRY", payload: id }); }, []);

  const settleContact = useCallback(
    (contactId: string) => {
      let theyOweMe = 0;
      let iOweThem = 0;
      for (const entry of state.debtEntries) {
        if (entry.contactId !== contactId) continue;
        if (entry.type === "theyOweMe") theyOweMe += entry.amount;
        else iOweThem += entry.amount;
      }
      const net = theyOweMe - iOweThem;
      const contact = state.contacts.find((c) => c.id === contactId);
      const contactName = contact?.name || "";

      if (net !== 0) {
        const tx: Transaction = {
          id: generateId(),
          type: net > 0 ? "income" : "expense",
          amount: Math.abs(net),
          categoryId: net > 0 ? "inc_settlement" : "exp_settlement",
          description: `${translate("settlementBalance")} - ${contactName}`,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "ADD_TRANSACTION", payload: tx });

        const settlementEntry: DebtEntry = {
          id: generateId(),
          contactId,
          type: net > 0 ? "iOweThem" : "theyOweMe",
          amount: Math.abs(net),
          description: `${translate("settlementBalance")} - ${translate("accountSettled")}`,
          date: new Date().toISOString(),
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: "ADD_DEBT_ENTRY", payload: settlementEntry });
      }
    }, [state.debtEntries, state.contacts, translate]);

  // ─── Product Actions ──────────────────────────────────────────────

  const addProduct = useCallback(
    (name: string, description: string, price: number, quantity: number, unit: string, photoUri: string): Product => {
      const product: Product = { id: generateId(), name, description, price, quantity, unit, photoUri, createdAt: new Date().toISOString() };
      dispatch({ type: "ADD_PRODUCT", payload: product });
      return product;
    }, []);

  const updateProduct = useCallback((product: Product) => { dispatch({ type: "UPDATE_PRODUCT", payload: product }); }, []);
  const deleteProduct = useCallback((id: string) => { dispatch({ type: "DELETE_PRODUCT", payload: id }); }, []);

  // ─── Invoice Actions ──────────────────────────────────────────────

  const addInvoice = useCallback(
    (contactId: string, contactName: string, items: InvoiceItem[], tax: number, note: string, dueDate: string, photoUris: string[], discountType: import("./store").DiscountType = "value", discountValue: number = 0): Invoice => {
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const discountAmount = discountType === "percentage" ? (subtotal * discountValue) / 100 : discountValue;
      const total = Math.max(0, subtotal - discountAmount + tax);
      const invoice: Invoice = {
        id: generateId(),
        invoiceNumber: generateInvoiceNumber(state.invoices),
        contactId,
        contactName,
        items,
        subtotal,
        discountType,
        discountValue,
        discountAmount,
        tax,
        total,
        status: "pending",
        paidAmount: 0,
        date: new Date().toISOString(),
        dueDate,
        note,
        photoUris,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_INVOICE", payload: invoice });

      const debtEntry: DebtEntry = {
        id: generateId(),
        contactId,
        type: "theyOweMe",
        amount: total,
        description: `Invoice ${invoice.invoiceNumber}`,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_DEBT_ENTRY", payload: debtEntry });

      for (const item of items) {
        const product = state.products.find((p) => p.id === item.productId);
        if (product) {
          const updatedProduct = { ...product, quantity: Math.max(0, product.quantity - item.quantity) };
          dispatch({ type: "UPDATE_PRODUCT", payload: updatedProduct });
        }
      }

      return invoice;
    }, [state.invoices, state.products]);

  const updateInvoice = useCallback((invoice: Invoice) => { dispatch({ type: "UPDATE_INVOICE", payload: invoice }); }, []);
  const deleteInvoice = useCallback((id: string) => { dispatch({ type: "DELETE_INVOICE", payload: id }); }, []);

  const changeInvoiceStatus = useCallback((invoiceId: string, newStatus: InvoiceStatus) => {
    const invoice = state.invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    const updatedInvoice = { ...invoice, status: newStatus, paidAmount: newStatus === "paid" ? invoice.total : invoice.paidAmount };
    dispatch({ type: "UPDATE_INVOICE", payload: updatedInvoice });

    if (newStatus === "paid" || newStatus === "cancelled") {
      const debtDesc = `Invoice ${invoice.invoiceNumber}`;
      const matchingDebt = state.debtEntries.find(
        (e) => e.contactId === invoice.contactId && e.description === debtDesc
      );
      if (matchingDebt) {
        dispatch({ type: "DELETE_DEBT_ENTRY", payload: matchingDebt.id });
      }
    } else if (newStatus === "pending" && invoice.status !== "pending") {
      const debtEntry: DebtEntry = {
        id: generateId(),
        contactId: invoice.contactId,
        type: "theyOweMe",
        amount: invoice.total,
        description: `Invoice ${invoice.invoiceNumber}`,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_DEBT_ENTRY", payload: debtEntry });
    }
  }, [state.invoices, state.debtEntries]);

  const makePartialPayment = useCallback((invoiceId: string, paymentAmount: number) => {
    const invoice = state.invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    const newPaidAmount = (invoice.paidAmount || 0) + paymentAmount;
    const remaining = invoice.total - newPaidAmount;
    const newStatus: InvoiceStatus = remaining <= 0 ? "paid" : "partial";

    const updatedInvoice = { ...invoice, paidAmount: newPaidAmount, status: newStatus };
    dispatch({ type: "UPDATE_INVOICE", payload: updatedInvoice });

    const debtDesc = `Invoice ${invoice.invoiceNumber}`;
    const matchingDebt = state.debtEntries.find(
      (e) => e.contactId === invoice.contactId && e.description === debtDesc
    );

    if (remaining <= 0) {
      if (matchingDebt) {
        dispatch({ type: "DELETE_DEBT_ENTRY", payload: matchingDebt.id });
      }
    } else if (matchingDebt) {
      const updatedDebt = { ...matchingDebt, amount: remaining };
      dispatch({ type: "UPDATE_DEBT_ENTRY", payload: updatedDebt });
    }

    const tx: Transaction = {
      id: generateId(),
      type: "income",
      amount: paymentAmount,
      categoryId: "settlement",
      description: `Payment: ${invoice.invoiceNumber} (${invoice.contactName})`,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_TRANSACTION", payload: tx });
  }, [state.invoices, state.debtEntries]);

  return (
    <AppContext.Provider
      value={{
        state,
        addTransaction, updateTransaction, deleteTransaction,
        addCategory, deleteCategory,
        updateProfile, setLanguage, translate,
        addContact, updateContact, deleteContact,
        addDebtEntry, deleteDebtEntry, settleContact,
        addProduct, updateProduct, deleteProduct,
        addInvoice, updateInvoice, deleteInvoice, changeInvoiceStatus, makePartialPayment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
