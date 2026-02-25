import React, { createContext, useContext, useEffect, useReducer, useCallback } from "react";
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
  settleContact: (contactId: string) => void; // Clears all debts for this contact
  addProduct: (name: string, description: string, price: number, quantity: number, unit: string, photoUri: string) => Product;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addInvoice: (contactId: string, contactName: string, items: InvoiceItem[], tax: number, note: string, dueDate: string, photoUris: string[], discountType?: import("./store").DiscountType, discountValue?: number) => Invoice;
  changeInvoiceStatus: (invoiceId: string, newStatus: InvoiceStatus) => void;
  updateInvoice: (invoice: Invoice) => void;
  deleteInvoice: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const [transactions, categories, profile, language, contacts, debtEntries, products, invoices] = await Promise.all([
        loadTransactions(),
        loadCategories(),
        loadProfile(),
        getStoredLanguage(),
        loadContacts(),
        loadDebtEntries(),
        loadProducts(),
        loadInvoices(),
      ]);
      dispatch({
        type: "LOAD_DATA",
        payload: { transactions, categories, profile: { ...profile, language }, language, contacts, debtEntries, products, invoices },
      });
    })();
  }, []);

  // Persist effects
  useEffect(() => { if (!state.isLoading) saveTransactions(state.transactions); }, [state.transactions, state.isLoading]);
  useEffect(() => { if (!state.isLoading) saveCategories(state.categories); }, [state.categories, state.isLoading]);
  useEffect(() => { if (!state.isLoading) saveProfile(state.profile); }, [state.profile, state.isLoading]);
  useEffect(() => { if (!state.isLoading) saveContacts(state.contacts); }, [state.contacts, state.isLoading]);
  useEffect(() => { if (!state.isLoading) saveDebtEntries(state.debtEntries); }, [state.debtEntries, state.isLoading]);
  useEffect(() => { if (!state.isLoading) saveProducts(state.products); }, [state.products, state.isLoading]);
  useEffect(() => { if (!state.isLoading) saveInvoices(state.invoices); }, [state.invoices, state.isLoading]);

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
      // Calculate the net balance before settling
      let theyOweMe = 0;
      let iOweThem = 0;
      for (const entry of state.debtEntries) {
        if (entry.contactId !== contactId) continue;
        if (entry.type === "theyOweMe") theyOweMe += entry.amount;
        else iOweThem += entry.amount;
      }
      const net = theyOweMe - iOweThem;

      // Find the contact name for the description
      const contact = state.contacts.find((c) => c.id === contactId);
      const contactName = contact?.name || "";

      // If there's a remaining balance, record it as a transaction AND as a settlement debt entry
      if (net !== 0) {
        // Record as a regular transaction (income if they paid us, expense if we paid them)
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

        // Add a settlement entry to the contact's debt history (opposite of the net to zero out)
        // This keeps the history visible — old entries stay, plus a new "settlement" entry
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

      // Auto-add to debt zone: the contact owes this invoice total
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

      // Deduct stock for each item
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

  // Change invoice status — when marked as paid, remove debt; when unpaid, add debt
  const changeInvoiceStatus = useCallback((invoiceId: string, newStatus: InvoiceStatus) => {
    const invoice = state.invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;
    const updatedInvoice = { ...invoice, status: newStatus, paidAmount: newStatus === "paid" ? invoice.total : invoice.paidAmount };
    dispatch({ type: "UPDATE_INVOICE", payload: updatedInvoice });

    if (newStatus === "paid") {
      // Remove the auto-created debt entry for this invoice
      const debtDesc = `Invoice ${invoice.invoiceNumber}`;
      const matchingDebt = state.debtEntries.find(
        (e) => e.contactId === invoice.contactId && e.description === debtDesc
      );
      if (matchingDebt) {
        dispatch({ type: "DELETE_DEBT_ENTRY", payload: matchingDebt.id });
      }
    } else if (newStatus === "cancelled") {
      // Remove the auto-created debt entry for this invoice
      const debtDesc = `Invoice ${invoice.invoiceNumber}`;
      const matchingDebt = state.debtEntries.find(
        (e) => e.contactId === invoice.contactId && e.description === debtDesc
      );
      if (matchingDebt) {
        dispatch({ type: "DELETE_DEBT_ENTRY", payload: matchingDebt.id });
      }
    } else if (newStatus === "pending" && invoice.status !== "pending") {
      // Re-add debt if changing back to pending
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
        addInvoice, updateInvoice, deleteInvoice, changeInvoiceStatus,
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
