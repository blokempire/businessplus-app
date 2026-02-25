import { describe, expect, it } from "vitest";
import { appRouter } from "../server/routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "../server/_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createMockContext(userOverrides?: Partial<AuthenticatedUser>): {
  ctx: TrpcContext;
  cookies: { name: string; value: string; options: Record<string, unknown> }[];
  clearedCookies: { name: string; options: Record<string, unknown> }[];
} {
  const cookies: { name: string; value: string; options: Record<string, unknown> }[] = [];
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

  const baseUser: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: null,
    name: "Test User",
    phone: "056185603",
    pinHash: null,
    loginMethod: "phone",
    role: "user",
    status: "active",
    subscriptionPlan: "free",
    subscriptionStartDate: null,
    subscriptionEndDate: null,
    subscriptionActive: false,
    companyId: null,
    companyRole: "viewer",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    ...userOverrides,
  };

  const ctx: TrpcContext = {
    user: baseUser,
    req: {
      protocol: "https",
      hostname: "localhost",
      headers: { host: "localhost:3000" },
      get: (key: string) => key === "host" ? "localhost:3000" : undefined,
    } as unknown as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, cookies, clearedCookies };
}

function createPublicContext(): {
  ctx: TrpcContext;
  cookies: { name: string; value: string; options: Record<string, unknown> }[];
} {
  const cookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookies.push({ name, value, options });
      },
      clearCookie: () => {},
    } as unknown as TrpcContext["res"],
  };

  return { ctx, cookies };
}

describe("Auth Routes", () => {
  describe("auth.me", () => {
    it("returns null for unauthenticated user", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it("returns user data for authenticated user", async () => {
      const { ctx } = createMockContext({ name: "Admin User", role: "admin" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeTruthy();
      expect(result?.name).toBe("Admin User");
      expect(result?.role).toBe("admin");
    });
  });

  describe("auth.logout", () => {
    it("clears the session cookie and reports success", async () => {
      const { ctx, clearedCookies } = createMockContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.logout();
      expect(result).toEqual({ success: true });
      expect(clearedCookies).toHaveLength(1);
      expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    });
  });

  describe("auth.register input validation", () => {
    it("rejects invalid phone number (too short)", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.auth.register({ phone: "123", pin: "1234", name: "Test" })
      ).rejects.toThrow();
    });

    it("rejects invalid PIN (not 4 digits)", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.auth.register({ phone: "056185603", pin: "12", name: "Test" })
      ).rejects.toThrow();
    });

    it("rejects PIN with non-numeric characters", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.auth.register({ phone: "056185603", pin: "abcd", name: "Test" })
      ).rejects.toThrow();
    });

    it("rejects empty name", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.auth.register({ phone: "056185603", pin: "1234", name: "" })
      ).rejects.toThrow();
    });
  });

  describe("auth.login input validation", () => {
    it("rejects invalid phone number", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.auth.login({ phone: "12", pin: "1234" })
      ).rejects.toThrow();
    });

    it("rejects invalid PIN format", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.auth.login({ phone: "056185603", pin: "abc" })
      ).rejects.toThrow();
    });
  });
});

describe("Subscription Routes", () => {
  describe("subscription.status", () => {
    it("returns subscription status for authenticated user", async () => {
      const now = new Date();
      const endDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      const { ctx } = createMockContext({
        subscriptionPlan: "solo",
        subscriptionActive: true,
        subscriptionStartDate: now,
        subscriptionEndDate: endDate,
      });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.status();
      expect(result.plan).toBe("solo");
      expect(result.active).toBe(true);
      expect(result.daysRemaining).toBeGreaterThan(360);
    });

    it("returns 0 days remaining for expired subscription", async () => {
      const pastDate = new Date("2024-01-01");
      const { ctx } = createMockContext({
        subscriptionPlan: "solo",
        subscriptionActive: false,
        subscriptionStartDate: pastDate,
        subscriptionEndDate: pastDate,
      });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.status();
      expect(result.daysRemaining).toBe(0);
    });

    it("rejects unauthenticated access", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.subscription.status()).rejects.toThrow();
    });
  });

  describe("subscription.check", () => {
    it("returns valid for admin users", async () => {
      const { ctx } = createMockContext({ role: "admin" });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.check();
      expect(result.valid).toBe(true);
      expect(result.reason).toBe("admin");
    });

    it("returns valid for active subscription", async () => {
      const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      const { ctx } = createMockContext({
        subscriptionActive: true,
        subscriptionEndDate: endDate,
      });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.check();
      expect(result.valid).toBe(true);
      expect(result.reason).toBe("active_subscription");
    });

    it("returns valid for free trial (within 7 days of creation)", async () => {
      const recentCreation = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const { ctx } = createMockContext({
        createdAt: recentCreation,
        subscriptionActive: false,
      });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.check();
      expect(result.valid).toBe(true);
      expect(result.reason).toBe("free_trial");
    });

    it("returns invalid for expired subscription and expired trial", async () => {
      const oldCreation = new Date("2024-01-01");
      const { ctx } = createMockContext({
        createdAt: oldCreation,
        subscriptionActive: false,
        subscriptionEndDate: new Date("2024-06-01"),
      });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.check();
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("expired");
    });
  });
});

describe("Company Routes", () => {
  describe("company.info", () => {
    it("returns null when user has no company", async () => {
      const { ctx } = createMockContext({ companyId: null });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.company.info();
      expect(result).toBeNull();
    });

    it("rejects unauthenticated access", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.company.info()).rejects.toThrow();
    });
  });

  describe("company.create input validation", () => {
    it("rejects empty company name", async () => {
      const { ctx } = createMockContext();
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.company.create({ name: "" })
      ).rejects.toThrow();
    });
  });

  describe("company.invite input validation", () => {
    it("rejects invalid phone number", async () => {
      const { ctx } = createMockContext({ companyId: 1, companyRole: "owner" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.company.invite({ phone: "12", role: "cashier" })
      ).rejects.toThrow();
    });

    it("rejects invalid role", async () => {
      const { ctx } = createMockContext({ companyId: 1, companyRole: "owner" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.company.invite({ phone: "056185603", role: "superadmin" as any })
      ).rejects.toThrow();
    });
  });

  describe("company.pendingInvitations", () => {
    it("returns empty array for user with no phone", async () => {
      const { ctx } = createMockContext({ phone: null });
      const caller = appRouter.createCaller(ctx);
      const result = await caller.company.pendingInvitations();
      expect(result).toEqual([]);
    });
  });
});

describe("Admin Routes", () => {
  describe("admin access control", () => {
    it("rejects non-admin users from stats", async () => {
      const { ctx } = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.stats()).rejects.toThrow();
    });

    it("rejects non-admin users from listUsers", async () => {
      const { ctx } = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.listUsers()).rejects.toThrow();
    });

    it("rejects non-admin users from grantSubscription", async () => {
      const { ctx } = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.admin.grantSubscription({ userId: 2, plan: "solo" })
      ).rejects.toThrow();
    });

    it("rejects non-admin users from revokeSubscription", async () => {
      const { ctx } = createMockContext({ role: "user" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.admin.revokeSubscription({ userId: 2 })
      ).rejects.toThrow();
    });

    it("rejects unauthenticated users from admin routes", async () => {
      const { ctx } = createPublicContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.admin.stats()).rejects.toThrow();
    });
  });

  describe("admin.grantSubscription input validation", () => {
    it("rejects invalid plan", async () => {
      const { ctx } = createMockContext({ role: "admin" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.admin.grantSubscription({ userId: 2, plan: "premium" as any })
      ).rejects.toThrow();
    });
  });

  describe("admin.setRole input validation", () => {
    it("rejects invalid role", async () => {
      const { ctx } = createMockContext({ role: "admin" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.admin.setRole({ id: 2, role: "superadmin" as any })
      ).rejects.toThrow();
    });
  });

  describe("admin.setStatus input validation", () => {
    it("rejects invalid status", async () => {
      const { ctx } = createMockContext({ role: "admin" });
      const caller = appRouter.createCaller(ctx);
      await expect(
        caller.admin.setStatus({ id: 2, status: "banned" as any })
      ).rejects.toThrow();
    });
  });
});
