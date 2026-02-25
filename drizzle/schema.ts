import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;
export type CompanyInvitation = typeof companyInvitations.$inferSelect;
export type InsertCompanyInvitation = typeof companyInvitations.$inferInsert;
