import { eq, desc, sql, and, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, companies, companyInvitations, InsertCompany, InsertCompanyInvitation, paymentRequests, InsertPaymentRequest } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod", "phone", "pinHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      (values as any)[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    // Subscription fields
    if (user.subscriptionPlan !== undefined) {
      values.subscriptionPlan = user.subscriptionPlan;
      updateSet.subscriptionPlan = user.subscriptionPlan;
    }
    if (user.subscriptionStartDate !== undefined) {
      values.subscriptionStartDate = user.subscriptionStartDate;
      updateSet.subscriptionStartDate = user.subscriptionStartDate;
    }
    if (user.subscriptionEndDate !== undefined) {
      values.subscriptionEndDate = user.subscriptionEndDate;
      updateSet.subscriptionEndDate = user.subscriptionEndDate;
    }
    if (user.subscriptionActive !== undefined) {
      values.subscriptionActive = user.subscriptionActive;
      updateSet.subscriptionActive = user.subscriptionActive;
    }

    // Company fields
    if (user.companyId !== undefined) {
      values.companyId = user.companyId;
      updateSet.companyId = user.companyId;
    }
    if (user.companyRole !== undefined) {
      values.companyRole = user.companyRole;
      updateSet.companyRole = user.companyRole;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Phone Auth ────────────────────────────────────────────────────

/** Find user by phone number */
export async function getUserByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Register a new user with phone + PIN */
export async function registerPhoneUser(data: {
  phone: string;
  pinHash: string;
  name: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Use phone as openId for phone-based auth
  const openId = `phone_${data.phone}`;

  // Check if admin phone — normalize by stripping +, spaces, and country codes, then compare last 9 digits
  const ADMIN_PHONE_SUFFIX = "56184503"; // last digits of 056184503
  const normalizedPhone = data.phone.replace(/[\s+\-]/g, "");
  const isAdmin = normalizedPhone.endsWith(ADMIN_PHONE_SUFFIX);

  await db.insert(users).values({
    openId,
    phone: data.phone,
    pinHash: data.pinHash,
    name: data.name,
    loginMethod: "phone",
    role: isAdmin ? "admin" : "user",
    status: "active",
    subscriptionPlan: "free",
    subscriptionActive: true, // Free trial starts active
    subscriptionStartDate: new Date(),
    subscriptionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    lastSignedIn: new Date(),
  });

  return getUserByPhone(data.phone);
}

// ─── Admin: User Management ────────────────────────────────────────

/** List all users ordered by most recent sign-in */
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.lastSignedIn));
}

/** Get a single user by ID */
export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Update user role (user ↔ admin) */
export async function updateUserRole(id: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

/** Update user status (active ↔ restricted) */
export async function updateUserStatus(id: number, status: "active" | "restricted") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ status }).where(eq(users.id, id));
}

/** Delete a user by ID */
export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

/** Get user stats for admin dashboard */
export async function getUserStats() {
  const db = await getDb();
  if (!db) return { total: 0, active: 0, restricted: 0, admins: 0, subscribers: 0, expired: 0 };

  const result = await db
    .select({
      total: sql<number>`COUNT(*)`,
      active: sql<number>`SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END)`,
      restricted: sql<number>`SUM(CASE WHEN status = 'restricted' THEN 1 ELSE 0 END)`,
      admins: sql<number>`SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END)`,
      subscribers: sql<number>`SUM(CASE WHEN subscriptionActive = true AND subscriptionPlan != 'free' THEN 1 ELSE 0 END)`,
      expired: sql<number>`SUM(CASE WHEN subscriptionActive = false OR subscriptionEndDate < NOW() THEN 1 ELSE 0 END)`,
    })
    .from(users);

  return result[0] || { total: 0, active: 0, restricted: 0, admins: 0, subscribers: 0, expired: 0 };
}

// ─── Subscription Management ────────────────────────────────────────

/** Grant subscription to a user for 1 year */
export async function grantSubscription(userId: number, plan: "solo" | "team") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const now = new Date();
  const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  await db.update(users).set({
    subscriptionPlan: plan,
    subscriptionActive: true,
    subscriptionStartDate: now,
    subscriptionEndDate: oneYearLater,
    status: "active",
  }).where(eq(users.id, userId));
}

/** Revoke subscription from a user */
export async function revokeSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(users).set({
    subscriptionActive: false,
    status: "restricted",
  }).where(eq(users.id, userId));
}

/** Check and expire subscriptions that have passed their end date */
export async function expireSubscriptions() {
  const db = await getDb();
  if (!db) return;

  await db.update(users).set({
    subscriptionActive: false,
    status: "restricted",
  }).where(
    and(
      eq(users.subscriptionActive, true),
      sql`subscriptionEndDate IS NOT NULL AND subscriptionEndDate < NOW()`
    )
  );
}

// ─── Company Group Management ────────────────────────────────────────

/** Create a company group */
export async function createCompany(data: InsertCompany) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(companies).values(data);
  const companyId = result[0].insertId;

  // Update the owner's company fields
  await db.update(users).set({
    companyId,
    companyRole: "owner",
  }).where(eq(users.id, data.ownerId));

  return companyId;
}

/** Get company by ID */
export async function getCompanyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Get company members */
export async function getCompanyMembers(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).where(eq(users.companyId, companyId));
}

/** Get company by owner ID */
export async function getCompanyByOwnerId(ownerId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(companies).where(eq(companies.ownerId, ownerId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** Create an invitation */
export async function createInvitation(data: InsertCompanyInvitation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(companyInvitations).values(data);
}

/** Get pending invitations for a phone number */
export async function getPendingInvitations(phone: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companyInvitations).where(
    and(
      eq(companyInvitations.invitedPhone, phone),
      eq(companyInvitations.status, "pending")
    )
  );
}

/** Get all invitations for a company */
export async function getCompanyInvitations(companyId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(companyInvitations).where(eq(companyInvitations.companyId, companyId));
}

/** Accept an invitation */
export async function acceptInvitation(invitationId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const invResult = await db.select().from(companyInvitations).where(eq(companyInvitations.id, invitationId)).limit(1);
  if (invResult.length === 0) throw new Error("Invitation not found");
  const invitation = invResult[0];

  // Update invitation status
  await db.update(companyInvitations).set({ status: "accepted" }).where(eq(companyInvitations.id, invitationId));

  // Add user to company
  await db.update(users).set({
    companyId: invitation.companyId,
    companyRole: invitation.role,
  }).where(eq(users.id, userId));
}

/** Reject an invitation */
export async function rejectInvitation(invitationId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(companyInvitations).set({ status: "rejected" }).where(eq(companyInvitations.id, invitationId));
}

/** Remove a member from company */
export async function removeCompanyMember(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({
    companyId: null,
    companyRole: "viewer",
  }).where(eq(users.id, userId));
}

// ─── Business Data CRUD ────────────────────────────────────────────

import { categories, transactions, contacts, debtEntries, products, invoices, userProfiles } from "../drizzle/schema";

// ─── User Profile ──────────────────────────────────────────────────

export async function getUserProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userProfiles).where(eq(userProfiles.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertUserProfile(userId: number, data: {
  name?: string;
  businessName?: string;
  currency?: string;
  language?: string;
  logoUri?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getUserProfile(userId);
  if (existing) {
    const updateSet: Record<string, unknown> = {};
    if (data.name !== undefined) updateSet.name = data.name;
    if (data.businessName !== undefined) updateSet.businessName = data.businessName;
    if (data.currency !== undefined) updateSet.currency = data.currency;
    if (data.language !== undefined) updateSet.language = data.language;
    if (data.logoUri !== undefined) updateSet.logoUri = data.logoUri;
    if (Object.keys(updateSet).length > 0) {
      await db.update(userProfiles).set(updateSet).where(eq(userProfiles.userId, userId));
    }
  } else {
    await db.insert(userProfiles).values({
      userId,
      name: data.name || "",
      businessName: data.businessName || "",
      currency: data.currency || "XAF",
      language: data.language || "fr",
      logoUri: data.logoUri || "",
    });
  }
  return getUserProfile(userId);
}

// ─── Categories ────────────────────────────────────────────────────

export async function getUserCategories(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(categories).where(eq(categories.userId, userId));
}

export async function syncCategories(userId: number, cats: Array<{
  clientId: string;
  nameKey: string;
  icon: string;
  type: "income" | "expense";
  isCustom: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete existing and re-insert (simple sync)
  await db.delete(categories).where(eq(categories.userId, userId));
  if (cats.length > 0) {
    await db.insert(categories).values(cats.map(c => ({
      userId,
      clientId: c.clientId,
      nameKey: c.nameKey,
      icon: c.icon,
      type: c.type,
      isCustom: c.isCustom,
    })));
  }
}

// ─── Transactions ──────────────────────────────────────────────────

export async function getUserTransactions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.createdAt));
}

export async function syncTransactions(userId: number, txns: Array<{
  clientId: string;
  type: "income" | "expense";
  amount: number;
  categoryId: string;
  description: string;
  date: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(transactions).where(eq(transactions.userId, userId));
  if (txns.length > 0) {
    await db.insert(transactions).values(txns.map(t => ({
      userId,
      clientId: t.clientId,
      type: t.type,
      amount: t.amount,
      categoryId: t.categoryId,
      description: t.description || "",
      date: t.date,
    })));
  }
}

// ─── Contacts ──────────────────────────────────────────────────────

export async function getUserContacts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contacts).where(eq(contacts.userId, userId));
}

export async function syncContacts(userId: number, contactList: Array<{
  clientId: string;
  name: string;
  phone: string;
  note: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(contacts).where(eq(contacts.userId, userId));
  if (contactList.length > 0) {
    await db.insert(contacts).values(contactList.map(c => ({
      userId,
      clientId: c.clientId,
      name: c.name,
      phone: c.phone || "",
      note: c.note || "",
    })));
  }
}

// ─── Debt Entries ──────────────────────────────────────────────────

export async function getUserDebtEntries(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(debtEntries).where(eq(debtEntries.userId, userId));
}

export async function syncDebtEntries(userId: number, entries: Array<{
  clientId: string;
  contactId: string;
  type: "theyOweMe" | "iOweThem";
  amount: number;
  description: string;
  date: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(debtEntries).where(eq(debtEntries.userId, userId));
  if (entries.length > 0) {
    await db.insert(debtEntries).values(entries.map(e => ({
      userId,
      clientId: e.clientId,
      contactId: e.contactId,
      type: e.type,
      amount: e.amount,
      description: e.description || "",
      date: e.date,
    })));
  }
}

// ─── Products ──────────────────────────────────────────────────────

export async function getUserProducts(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.userId, userId));
}

export async function syncProducts(userId: number, productList: Array<{
  clientId: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  unit: string;
  photoUri: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(products).where(eq(products.userId, userId));
  if (productList.length > 0) {
    await db.insert(products).values(productList.map(p => ({
      userId,
      clientId: p.clientId,
      name: p.name,
      description: p.description || "",
      price: p.price,
      quantity: p.quantity,
      unit: p.unit || "pcs",
      photoUri: p.photoUri || "",
    })));
  }
}

// ─── Invoices ──────────────────────────────────────────────────────

export async function getUserInvoices(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
}

export async function syncInvoices(userId: number, invoiceList: Array<{
  clientId: string;
  invoiceNumber: string;
  contactId: string;
  contactName: string;
  items: any;
  subtotal: number;
  discountType: "value" | "percentage";
  discountValue: number;
  discountAmount: number;
  tax: number;
  total: number;
  status: "pending" | "paid" | "partial" | "cancelled";
  paidAmount: number;
  date: string;
  dueDate: string;
  note: string;
  photoUris: string[];
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(invoices).where(eq(invoices.userId, userId));
  if (invoiceList.length > 0) {
    await db.insert(invoices).values(invoiceList.map(inv => ({
      userId,
      clientId: inv.clientId,
      invoiceNumber: inv.invoiceNumber,
      contactId: inv.contactId,
      contactName: inv.contactName,
      items: inv.items,
      subtotal: inv.subtotal,
      discountType: inv.discountType,
      discountValue: inv.discountValue,
      discountAmount: inv.discountAmount,
      tax: inv.tax,
      total: inv.total,
      status: inv.status,
      paidAmount: inv.paidAmount,
      date: inv.date,
      dueDate: inv.dueDate || "",
      note: inv.note || "",
      photoUris: inv.photoUris || [],
    })));
  }
}

// ─── Payment Request Functions ────────────────────────────────────────

export async function createPaymentRequest(data: {
  userId: number;
  userPhone: string;
  userName: string | null;
  plan: "solo" | "team";
  amount: number;
  paymentMethod: "mtn_momo" | "airtel_money" | "cash" | "whatsapp" | "other";
  transactionRef?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(paymentRequests).values({
    userId: data.userId,
    userPhone: data.userPhone,
    userName: data.userName,
    plan: data.plan,
    amount: data.amount,
    paymentMethod: data.paymentMethod,
    transactionRef: data.transactionRef || null,
  });
  return (result as any)[0].insertId;
}

export async function getPaymentRequests(status?: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return [];

  if (status) {
    return db.select().from(paymentRequests).where(eq(paymentRequests.status, status)).orderBy(desc(paymentRequests.createdAt));
  }
  return db.select().from(paymentRequests).orderBy(desc(paymentRequests.createdAt));
}

export async function getUserPaymentRequests(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(paymentRequests).where(eq(paymentRequests.userId, userId)).orderBy(desc(paymentRequests.createdAt));
}

export async function approvePaymentRequest(requestId: number, adminId: number, adminNote?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the payment request
  const [request] = await db.select().from(paymentRequests).where(eq(paymentRequests.id, requestId));
  if (!request) throw new Error("Payment request not found");
  if (request.status !== "pending") throw new Error("Payment request already processed");

  // Approve the request
  await db.update(paymentRequests).set({
    status: "approved",
    processedBy: adminId,
    adminNote: adminNote || null,
    processedAt: new Date(),
  }).where(eq(paymentRequests.id, requestId));

  // Grant subscription to the user
  await grantSubscription(request.userId, request.plan);

  return { success: true };
}

export async function rejectPaymentRequest(requestId: number, adminId: number, adminNote?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(paymentRequests).set({
    status: "rejected",
    processedBy: adminId,
    adminNote: adminNote || "Payment not verified",
    processedAt: new Date(),
  }).where(eq(paymentRequests.id, requestId));

  return { success: true };
}

export async function getPaymentRequestStats() {
  const db = await getDb();
  if (!db) return { pending: 0, approved: 0, rejected: 0, totalRevenue: 0 };

  const [pending] = await db.select({ count: sql<number>`count(*)` }).from(paymentRequests).where(eq(paymentRequests.status, "pending"));
  const [approved] = await db.select({ count: sql<number>`count(*)`, total: sql<number>`COALESCE(SUM(amount), 0)` }).from(paymentRequests).where(eq(paymentRequests.status, "approved"));
  const [rejected] = await db.select({ count: sql<number>`count(*)` }).from(paymentRequests).where(eq(paymentRequests.status, "rejected"));

  return {
    pending: pending?.count || 0,
    approved: approved?.count || 0,
    rejected: rejected?.count || 0,
    totalRevenue: approved?.total || 0,
  };
}
