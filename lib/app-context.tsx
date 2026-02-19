import React, { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import {
  Transaction,
  Category,
  UserProfile,
  DEFAULT_PROFILE,
  DEFAULT_CATEGORIES,
  loadTransactions,
  saveTransactions,
  loadCategories,
  saveCategories,
  loadProfile,
  saveProfile,
  generateId,
  TransactionType,
} from "./store";
import { Language, getStoredLanguage, setStoredLanguage, t, TranslationKey } from "./i18n";

// ─── State ───────────────────────────────────────────────────────────

interface AppState {
  transactions: Transaction[];
  categories: Category[];
  profile: UserProfile;
  language: Language;
  isLoading: boolean;
}

type Action =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOAD_DATA"; payload: { transactions: Transaction[]; categories: Category[]; profile: UserProfile; language: Language } }
  | { type: "ADD_TRANSACTION"; payload: Transaction }
  | { type: "UPDATE_TRANSACTION"; payload: Transaction }
  | { type: "DELETE_TRANSACTION"; payload: string }
  | { type: "ADD_CATEGORY"; payload: Category }
  | { type: "DELETE_CATEGORY"; payload: string }
  | { type: "UPDATE_PROFILE"; payload: Partial<UserProfile> }
  | { type: "SET_LANGUAGE"; payload: Language };

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
    default:
      return state;
  }
}

const initialState: AppState = {
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  profile: DEFAULT_PROFILE,
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
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    (async () => {
      const [transactions, categories, profile, language] = await Promise.all([
        loadTransactions(),
        loadCategories(),
        loadProfile(),
        getStoredLanguage(),
      ]);
      dispatch({
        type: "LOAD_DATA",
        payload: { transactions, categories, profile: { ...profile, language }, language },
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
