import { boolean, double, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Now supports phone+PIN authentication alongside OAuth.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  /** Phone number used for phone+PIN auth */
  phone: varchar("phone", { length: 32 }),
  /** Hashed 4-digit PIN for phone auth (SHA-256) */
  pinHash: varchar("pinHash", { length: 128 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  /** Account status: active users can use the app, restricted users are blocked */
  status: mysqlEnum("status", ["active", "restricted"]).default("active").notNull(),
  /** Subscription plan: free (7-day trial), solo (10k XAF/yr), team (20k XAF/yr) */
  subscriptionPlan: mysqlEnum("subscriptionPlan", ["free", "solo", "team"]).default("free").notNull(),
  /** When the current subscription started */
  subscriptionStartDate: timestamp("subscriptionStartDate"),
  /** When the current subscription expires */
  subscriptionEndDate: timestamp("subscriptionEndDate"),
  /** Whether subscription is currently active (set by admin after payment) */
  subscriptionActive: boolean("subscriptionActive").default(false).notNull(),
  /** Company group ID this user belongs to (null = independent user) */
  companyId: int("companyId"),
  /** Role within the company group */
  companyRole: mysqlEnum("companyRole", ["owner", "manager", "cashier", "viewer"]).default("viewer"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Company groups for multi-user accounts.
 * A company can have up to 5 members (owner + 4 invited).
 */
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  /** The user who created/owns this company group */
  ownerId: int("ownerId").notNull(),
  /** Maximum members allowed (default 5) */
  maxMembers: int("maxMembers").default(5).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Invitations to join a company group.
 */
export const companyInvitations = mysqlTable("company_invitations", {
  id: int("id").autoincrement().primaryKey(),
  companyId: int("companyId").notNull(),
  /** Phone number of the invited user */
  invitedPhone: varchar("invitedPhone", { length: 32 }).notNull(),
  /** Role assigned to the invited user */
  role: mysqlEnum("role", ["manager", "cashier", "viewer"]).default("viewer").notNull(),
  /** Invitation status */
  status: mysqlEnum("status", ["pending", "accepted", "rejected", "expired"]).default("pending").notNull(),
  /** Who sent the invitation */
  invitedBy: int("invitedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Business Data Tables ────────────────────────────────────────

/**
 * User categories for transactions.
 */
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: varchar("clientId", { length: 64 }).notNull(), // client-side UUID
  nameKey: varchar("nameKey", { length: 255 }).notNull(),
  icon: varchar("icon", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  isCustom: boolean("isCustom").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Financial transactions (income/expense).
 */
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: varchar("clientId", { length: 64 }).notNull(), // client-side UUID
  type: mysqlEnum("type", ["income", "expense"]).notNull(),
  amount: double("amount").notNull(),
  categoryId: varchar("categoryId", { length: 64 }).notNull(), // references categories.clientId
  description: text("description"),
  date: varchar("date", { length: 64 }).notNull(), // ISO string
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Contacts (clients, suppliers, etc.)
 */
export const contacts = mysqlTable("contacts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: varchar("clientId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Debt entries tracking who owes whom.
 */
export const debtEntries = mysqlTable("debt_entries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: varchar("clientId", { length: 64 }).notNull(),
  contactId: varchar("contactId", { length: 64 }).notNull(), // references contacts.clientId
  type: mysqlEnum("type", ["theyOweMe", "iOweThem"]).notNull(),
  amount: double("amount").notNull(),
  description: text("description"),
  date: varchar("date", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Products / stock items.
 */
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: varchar("clientId", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: double("price").default(0).notNull(),
  quantity: int("quantity").default(0).notNull(),
  unit: varchar("unit", { length: 32 }).default("pcs").notNull(),
  photoUri: text("photoUri"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Invoices.
 */
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  clientId: varchar("clientId", { length: 64 }).notNull(),
  invoiceNumber: varchar("invoiceNumber", { length: 64 }).notNull(),
  contactId: varchar("contactId", { length: 64 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  items: json("items").notNull(), // InvoiceItem[]
  subtotal: double("subtotal").default(0).notNull(),
  discountType: mysqlEnum("discountType", ["value", "percentage"]).default("value").notNull(),
  discountValue: double("discountValue").default(0).notNull(),
  discountAmount: double("discountAmount").default(0).notNull(),
  tax: double("tax").default(0).notNull(),
  total: double("total").default(0).notNull(),
  status: mysqlEnum("invoiceStatus", ["pending", "paid", "partial", "cancelled"]).default("pending").notNull(),
  paidAmount: double("paidAmount").default(0).notNull(),
  date: varchar("date", { length: 64 }).notNull(),
  dueDate: varchar("dueDate", { length: 64 }),
  note: text("note"),
  photoUris: json("photoUris"), // string[]
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * User profile/settings stored on server.
 */
export const userProfiles = mysqlTable("user_profiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  name: varchar("name", { length: 255 }),
  businessName: varchar("businessName", { length: 255 }),
  currency: varchar("currency", { length: 10 }).default("XAF").notNull(),
  language: varchar("language", { length: 5 }).default("fr").notNull(),
  logoUri: text("logoUri"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Payment requests for subscription purchases.
 * Users submit a payment request after sending mobile money.
 * Admin verifies and approves to activate the subscription.
 */
export const paymentRequests = mysqlTable("payment_requests", {
  id: int("id").autoincrement().primaryKey(),
  /** The user who made the payment */
  userId: int("userId").notNull(),
  /** Phone number of the user */
  userPhone: varchar("userPhone", { length: 32 }).notNull(),
  /** User's display name */
  userName: varchar("userName", { length: 255 }),
  /** Subscription plan requested */
  plan: mysqlEnum("plan", ["solo", "team"]).notNull(),
  /** Amount in XAF */
  amount: int("amount").notNull(),
  /** Payment method used */
  paymentMethod: mysqlEnum("paymentMethod", ["mtn_momo", "airtel_money", "cash", "whatsapp", "other"]).notNull(),
  /** Mobile money transaction reference (if available) */
  transactionRef: varchar("transactionRef", { length: 255 }),
  /** Status of the payment request */
  status: mysqlEnum("paymentStatus", ["pending", "approved", "rejected"]).default("pending").notNull(),
  /** Admin who processed the request */
  processedBy: int("processedBy"),
  /** Admin note (reason for rejection, etc.) */
  adminNote: text("adminNote"),
  /** When the request was processed */
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ─── Type Exports ────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type CompanyInvitation = typeof companyInvitations.$inferSelect;
export type InsertCompanyInvitation = typeof companyInvitations.$inferInsert;
export type DbCategory = typeof categories.$inferSelect;
export type DbTransaction = typeof transactions.$inferSelect;
export type DbContact = typeof contacts.$inferSelect;
export type DbDebtEntry = typeof debtEntries.$inferSelect;
export type DbProduct = typeof products.$inferSelect;
export type DbInvoice = typeof invoices.$inferSelect;
export type DbUserProfile = typeof userProfiles.$inferSelect;
export type DbPaymentRequest = typeof paymentRequests.$inferSelect;
export type InsertPaymentRequest = typeof paymentRequests.$inferInsert;
