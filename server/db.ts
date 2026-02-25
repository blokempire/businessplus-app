import { eq, desc, sql, and, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, companies, companyInvitations, InsertCompany, InsertCompanyInvitation } from "../drizzle/schema";
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

  // Check if admin phone
  const isAdmin = data.phone === "056185603";

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
