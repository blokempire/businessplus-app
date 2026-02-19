import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext } from "react";

export type Language = "en" | "fr";

export const translations = {
  en: {
    // Navigation
    dashboard: "Dashboard",
    transactions: "Transactions",
    reports: "Reports",
    settings: "Settings",

    // Dashboard
    welcome: "Welcome",
    totalBalance: "Total Balance",
    income: "Income",
    expense: "Expense",
    addIncome: "+ Income",
    addExpense: "- Expense",
    recentTransactions: "Recent Transactions",
    noTransactions: "No transactions yet",
    todaySummary: "Today's Summary",

    // Transactions
    all: "All",
    filterByType: "Filter by type",
    searchTransactions: "Search transactions",
    deleteTransaction: "Delete Transaction",
    deleteConfirm: "Are you sure you want to delete this transaction?",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",

    // Add/Edit Transaction
    addTransaction: "Add Transaction",
    editTransaction: "Edit Transaction",
    amount: "Amount",
    category: "Category",
    description: "Description",
    date: "Date",
    save: "Save",
    enterAmount: "Enter amount",
    enterDescription: "Add a note (optional)",
    selectCategory: "Select a category",

    // Reports
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    incomeVsExpense: "Income vs Expense",
    expenseByCategory: "Expense by Category",
    noDataForPeriod: "No data for this period",
    netBalance: "Net Balance",

    // Settings
    profile: "Profile",
    language: "Language",
    currency: "Currency",
    categories: "Categories",
    exportData: "Export Data",
    about: "About",
    businessName: "Business Name",
    userName: "Your Name",
    english: "English",
    french: "French",
    manageCategories: "Manage Categories",
    addCategory: "Add Category",
    categoryName: "Category Name",
    incomeCategories: "Income Categories",
    expenseCategories: "Expense Categories",
    version: "Version",
    appDescription: "Simple accounting for your business",
    dataExported: "Data exported successfully",
    darkMode: "Dark Mode",
    lightMode: "Light Mode",

    // Auth
    login: "Login",
    register: "Create Account",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    name: "Name",
    alreadyHaveAccount: "Already have an account?",
    dontHaveAccount: "Don't have an account?",
    loginError: "Invalid email or password",
    registerError: "Registration failed",
    logout: "Log Out",

    // Categories
    salary: "Salary",
    business: "Business",
    freelance: "Freelance",
    investment: "Investment",
    gift: "Gift",
    otherIncome: "Other Income",
    food: "Food",
    transport: "Transport",
    utilities: "Utilities",
    health: "Health",
    education: "Education",
    shopping: "Shopping",
    phone: "Phone",
    entertainment: "Entertainment",
    rent: "Rent",
    otherExpense: "Other Expense",

    // General
    today: "Today",
    yesterday: "Yesterday",
    thisWeek: "This Week",
    thisMonth: "This Month",
    ok: "OK",
    confirm: "Confirm",
    error: "Error",
    success: "Success",
  },
  fr: {
    // Navigation
    dashboard: "Tableau de bord",
    transactions: "Transactions",
    reports: "Rapports",
    settings: "Paramètres",

    // Dashboard
    welcome: "Bienvenue",
    totalBalance: "Solde Total",
    income: "Revenus",
    expense: "Dépenses",
    addIncome: "+ Revenu",
    addExpense: "- Dépense",
    recentTransactions: "Transactions Récentes",
    noTransactions: "Aucune transaction",
    todaySummary: "Résumé du jour",

    // Transactions
    all: "Tout",
    filterByType: "Filtrer par type",
    searchTransactions: "Rechercher des transactions",
    deleteTransaction: "Supprimer la transaction",
    deleteConfirm: "Êtes-vous sûr de vouloir supprimer cette transaction ?",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",

    // Add/Edit Transaction
    addTransaction: "Ajouter une transaction",
    editTransaction: "Modifier la transaction",
    amount: "Montant",
    category: "Catégorie",
    description: "Description",
    date: "Date",
    save: "Enregistrer",
    enterAmount: "Entrer le montant",
    enterDescription: "Ajouter une note (optionnel)",
    selectCategory: "Sélectionner une catégorie",

    // Reports
    daily: "Jour",
    weekly: "Semaine",
    monthly: "Mois",
    yearly: "Année",
    incomeVsExpense: "Revenus vs Dépenses",
    expenseByCategory: "Dépenses par catégorie",
    noDataForPeriod: "Aucune donnée pour cette période",
    netBalance: "Solde Net",

    // Settings
    profile: "Profil",
    language: "Langue",
    currency: "Devise",
    categories: "Catégories",
    exportData: "Exporter les données",
    about: "À propos",
    businessName: "Nom de l'entreprise",
    userName: "Votre nom",
    english: "Anglais",
    french: "Français",
    manageCategories: "Gérer les catégories",
    addCategory: "Ajouter une catégorie",
    categoryName: "Nom de la catégorie",
    incomeCategories: "Catégories de revenus",
    expenseCategories: "Catégories de dépenses",
    version: "Version",
    appDescription: "Comptabilité simple pour votre entreprise",
    dataExported: "Données exportées avec succès",
    darkMode: "Mode sombre",
    lightMode: "Mode clair",

    // Auth
    login: "Connexion",
    register: "Créer un compte",
    email: "E-mail",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    name: "Nom",
    alreadyHaveAccount: "Vous avez déjà un compte ?",
    dontHaveAccount: "Vous n'avez pas de compte ?",
    loginError: "E-mail ou mot de passe invalide",
    registerError: "L'inscription a échoué",
    logout: "Déconnexion",

    // Categories
    salary: "Salaire",
    business: "Commerce",
    freelance: "Freelance",
    investment: "Investissement",
    gift: "Cadeau",
    otherIncome: "Autre revenu",
    food: "Nourriture",
    transport: "Transport",
    utilities: "Services",
    health: "Santé",
    education: "Éducation",
    shopping: "Achats",
    phone: "Téléphone",
    entertainment: "Divertissement",
    rent: "Loyer",
    otherExpense: "Autre dépense",

    // General
    today: "Aujourd'hui",
    yesterday: "Hier",
    thisWeek: "Cette semaine",
    thisMonth: "Ce mois",
    ok: "OK",
    confirm: "Confirmer",
    error: "Erreur",
    success: "Succès",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

const LANGUAGE_KEY = "@ledger_language";

export async function getStoredLanguage(): Promise<Language> {
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (lang === "fr" || lang === "en") return lang;
    return "en";
  } catch {
    return "en";
  }
}

export async function setStoredLanguage(lang: Language): Promise<void> {
  await AsyncStorage.setItem(LANGUAGE_KEY, lang);
}

export function t(key: TranslationKey, lang: Language): string {
  return translations[lang][key] || translations.en[key] || key;
}
