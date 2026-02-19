import React, { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import {
  Transaction,
  Category,
  UserProfile,
  Contact,
  DebtEntry,
  DebtType,
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
  generateId,
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
  language: Language;
  isLoading: boolean;
}

type Action =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOAD_DATA"; payload: { transactions: Transaction[]; categories: Category[]; profile: UserProfile; language: Language; contacts: Contact[]; debtEntries: DebtEntry[] } }
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
  | { type: "SETTLE_CONTACT"; payload: { contactId: string; settlementEntry: DebtEntry } };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "LOAD_DATA":
      return {
        ...state,
        ...action.payload,
        isLoading: false,
      };
    case "ADD_TRANSACTION":
      return {
        ...state,
        transactions: [action.payload, ...state.transactions],
      };
    case "UPDATE_TRANSACTION":
      return {
        ...state,
        transactions: state.transactions.map((tx) =>
          tx.id === action.payload.id ? action.payload : tx
        ),
      };
    case "DELETE_TRANSACTION":
      return {
        ...state,
        transactions: state.transactions.filter((tx) => tx.id !== action.payload),
      };
    case "ADD_CATEGORY":
      return {
        ...state,
        categories: [...state.categories, action.payload],
      };
    case "DELETE_CATEGORY":
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.payload),
      };
    case "UPDATE_PROFILE":
      return {
        ...state,
        profile: { ...state.profile, ...action.payload },
      };
    case "SET_LANGUAGE":
      return {
        ...state,
        language: action.payload,
        profile: { ...state.profile, language: action.payload },
      };
    case "ADD_CONTACT":
      return {
        ...state,
        contacts: [action.payload, ...state.contacts],
      };
    case "UPDATE_CONTACT":
      return {
        ...state,
        contacts: state.contacts.map((c) =>
          c.id === action.payload.id ? action.payload : c
        ),
      };
    case "DELETE_CONTACT":
      return {
        ...state,
        contacts: state.contacts.filter((c) => c.id !== action.payload),
        debtEntries: state.debtEntries.filter((e) => e.contactId !== action.payload),
      };
    case "ADD_DEBT_ENTRY":
      return {
        ...state,
        debtEntries: [action.payload, ...state.debtEntries],
      };
    case "DELETE_DEBT_ENTRY":
      return {
        ...state,
        debtEntries: state.debtEntries.filter((e) => e.id !== action.payload),
      };
    case "SETTLE_CONTACT": {
      // Remove all entries for this contact and add a single settlement entry
      const filtered = state.debtEntries.filter((e) => e.contactId !== action.payload.contactId);
      return {
        ...state,
        debtEntries: [action.payload.settlementEntry, ...filtered],
      };
    }
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
  settleContact: (contactId: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const [transactions, categories, profile, language, contacts, debtEntries] = await Promise.all([
        loadTransactions(),
        loadCategories(),
        loadProfile(),
        getStoredLanguage(),
        loadContacts(),
        loadDebtEntries(),
      ]);
      dispatch({
        type: "LOAD_DATA",
        payload: { transactions, categories, profile: { ...profile, language }, language, contacts, debtEntries },
      });
    })();
  }, []);

  // Persist transactions
  useEffect(() => {
    if (!state.isLoading) {
      saveTransactions(state.transactions);
    }
  }, [state.transactions, state.isLoading]);

  // Persist categories
  useEffect(() => {
    if (!state.isLoading) {
      saveCategories(state.categories);
    }
  }, [state.categories, state.isLoading]);

  // Persist profile
  useEffect(() => {
    if (!state.isLoading) {
      saveProfile(state.profile);
    }
  }, [state.profile, state.isLoading]);

  // Persist contacts
  useEffect(() => {
    if (!state.isLoading) {
      saveContacts(state.contacts);
    }
  }, [state.contacts, state.isLoading]);

  // Persist debt entries
  useEffect(() => {
    if (!state.isLoading) {
      saveDebtEntries(state.debtEntries);
    }
  }, [state.debtEntries, state.isLoading]);

  const addTransaction = useCallback(
    (type: TransactionType, amount: number, categoryId: string, description: string, date: string) => {
      const tx: Transaction = {
        id: generateId(),
        type,
        amount,
        categoryId,
        description,
        date,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_TRANSACTION", payload: tx });
    },
    []
  );

  const updateTransaction = useCallback((tx: Transaction) => {
    dispatch({ type: "UPDATE_TRANSACTION", payload: tx });
  }, []);

  const deleteTransaction = useCallback((id: string) => {
    dispatch({ type: "DELETE_TRANSACTION", payload: id });
  }, []);

  const addCategory = useCallback((nameKey: string, icon: string, type: TransactionType) => {
    const cat: Category = {
      id: generateId(),
      nameKey,
      icon,
      type,
      isCustom: true,
    };
    dispatch({ type: "ADD_CATEGORY", payload: cat });
  }, []);

  const deleteCategory = useCallback((id: string) => {
    dispatch({ type: "DELETE_CATEGORY", payload: id });
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    dispatch({ type: "UPDATE_PROFILE", payload: updates });
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setStoredLanguage(lang);
    dispatch({ type: "SET_LANGUAGE", payload: lang });
  }, []);

  const translate = useCallback(
    (key: TranslationKey) => t(key, state.language),
    [state.language]
  );

  const addContact = useCallback((name: string, phone: string, note: string): Contact => {
    const contact: Contact = {
      id: generateId(),
      name,
      phone,
      note,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: "ADD_CONTACT", payload: contact });
    return contact;
  }, []);

  const updateContact = useCallback((contact: Contact) => {
    dispatch({ type: "UPDATE_CONTACT", payload: contact });
  }, []);

  const deleteContact = useCallback((id: string) => {
    dispatch({ type: "DELETE_CONTACT", payload: id });
  }, []);

  const addDebtEntry = useCallback(
    (contactId: string, type: DebtType, amount: number, description: string, date: string) => {
      const entry: DebtEntry = {
        id: generateId(),
        contactId,
        type,
        amount,
        description,
        date,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_DEBT_ENTRY", payload: entry });
    },
    []
  );

  const deleteDebtEntry = useCallback((id: string) => {
    dispatch({ type: "DELETE_DEBT_ENTRY", payload: id });
  }, []);

  const settleContact = useCallback(
    (contactId: string) => {
      // Calculate net balance and create a single settlement entry
      let theyOweMe = 0;
      let iOweThem = 0;
      for (const entry of state.debtEntries) {
        if (entry.contactId !== contactId) continue;
        if (entry.type === "theyOweMe") theyOweMe += entry.amount;
        else iOweThem += entry.amount;
      }
      const net = theyOweMe - iOweThem;
      if (net === 0) {
        // Just clear all entries
        dispatch({
          type: "SETTLE_CONTACT",
          payload: {
            contactId,
            settlementEntry: {
              id: generateId(),
              contactId,
              type: "theyOweMe",
              amount: 0,
              description: "Account settled",
              date: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
          },
        });
        return;
      }
      const settlementEntry: DebtEntry = {
        id: generateId(),
        contactId,
        type: net > 0 ? "theyOweMe" : "iOweThem",
        amount: Math.abs(net),
        description: "Settlement balance carried forward",
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "SETTLE_CONTACT", payload: { contactId, settlementEntry } });
    },
    [state.debtEntries]
  );

  return (
    <AppContext.Provider
      value={{
        state,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addCategory,
        deleteCategory,
        updateProfile,
        setLanguage,
        translate,
        addContact,
        updateContact,
        deleteContact,
        addDebtEntry,
        deleteDebtEntry,
        settleContact,
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
