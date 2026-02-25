import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,

  // ─── Auth Routes ────────────────────────────────────────────────
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    /** Register with phone + PIN */
    register: publicProcedure
      .input(z.object({
        phone: z.string().min(6).max(20),
        pin: z.string().length(4).regex(/^\d{4}$/),
        name: z.string().min(1).max(100),
      }))
      .mutation(async ({ input, ctx }) => {
        // Check if phone already registered
        const existing = await db.getUserByPhone(input.phone);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "Phone number already registered" });
        }

        // Hash PIN with SHA-256 (using Node crypto)
        const crypto = await import("crypto");
        const pinHash = crypto.createHash("sha256").update(input.pin).digest("hex");

        const user = await db.registerPhoneUser({
          phone: input.phone,
          pinHash,
          name: input.name,
        });

        if (!user) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Registration failed" });
        }

        // Create session token
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        return {
          sessionToken,
          user: {
            id: user.id,
            openId: user.openId,
            name: user.name,
            phone: user.phone,
            role: user.role,
            status: user.status,
            subscriptionPlan: user.subscriptionPlan,
            subscriptionActive: user.subscriptionActive,
            subscriptionEndDate: user.subscriptionEndDate?.toISOString() || null,
            companyId: user.companyId,
            companyRole: user.companyRole,
          },
        };
      }),

    /** Login with phone + PIN */
    login: publicProcedure
      .input(z.object({
        phone: z.string().min(6).max(20),
        pin: z.string().length(4).regex(/^\d{4}$/),
      }))
      .mutation(async ({ input, ctx }) => {
        const user = await db.getUserByPhone(input.phone);
        if (!user) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Account not found. Please register first." });
        }

        // Verify PIN
        const crypto = await import("crypto");
        const pinHash = crypto.createHash("sha256").update(input.pin).digest("hex");
        if (user.pinHash !== pinHash) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect PIN" });
        }

        // Check if restricted
        if (user.status === "restricted") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Your account has been restricted. Contact admin." });
        }

        // Check subscription expiry
        if (user.subscriptionEndDate && new Date(user.subscriptionEndDate) < new Date()) {
          // Mark as expired
          await db.revokeSubscription(user.id);
        }

        // Update last signed in
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

        // Create session token
        const sessionToken = await sdk.createSessionToken(user.openId, {
          name: user.name || "",
          expiresInMs: ONE_YEAR_MS,
        });

        // Set cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

        // Check for pending invitations
        const pendingInvitations = await db.getPendingInvitations(input.phone);

        return {
          sessionToken,
          user: {
            id: user.id,
            openId: user.openId,
            name: user.name,
            phone: user.phone,
            role: user.role,
            status: user.status,
            subscriptionPlan: user.subscriptionPlan,
            subscriptionActive: user.subscriptionActive,
            subscriptionEndDate: user.subscriptionEndDate?.toISOString() || null,
            companyId: user.companyId,
            companyRole: user.companyRole,
          },
          pendingInvitations: pendingInvitations.length,
        };
      }),
  }),

  // ─── Subscription Routes ────────────────────────────────────────
  subscription: router({
    /** Get current user's subscription status */
    status: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      return {
        plan: user.subscriptionPlan,
        active: user.subscriptionActive,
        startDate: user.subscriptionStartDate?.toISOString() || null,
        endDate: user.subscriptionEndDate?.toISOString() || null,
        daysRemaining: user.subscriptionEndDate
          ? Math.max(0, Math.ceil((new Date(user.subscriptionEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : 0,
      };
    }),

    /** Check if subscription is still valid */
    check: protectedProcedure.query(async ({ ctx }) => {
      const user = ctx.user;
      // Admins always have access
      if (user.role === "admin") return { valid: true, reason: "admin" };
      // Check if subscription is active and not expired
      if (user.subscriptionActive && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()) {
        return { valid: true, reason: "active_subscription" };
      }
      // Free trial check (7 days from creation)
      const trialEnd = new Date(user.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (trialEnd > new Date()) {
        return { valid: true, reason: "free_trial", trialEndsAt: trialEnd.toISOString() };
      }
      return { valid: false, reason: "expired" };
    }),
  }),

  // ─── Company/Team Routes ────────────────────────────────────────
  company: router({
    /** Create a company group */
    create: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(255) }))
      .mutation(async ({ input, ctx }) => {
        // Check if user already owns a company
        const existing = await db.getCompanyByOwnerId(ctx.user.id);
        if (existing) {
          throw new TRPCError({ code: "CONFLICT", message: "You already own a company group" });
        }
        const companyId = await db.createCompany({ name: input.name, ownerId: ctx.user.id });
        return { companyId };
      }),

    /** Get current user's company info */
    info: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.companyId) return null;
      const company = await db.getCompanyById(ctx.user.companyId);
      if (!company) return null;
      const members = await db.getCompanyMembers(ctx.user.companyId);
      const invitations = await db.getCompanyInvitations(ctx.user.companyId);
      return { company, members, invitations };
    }),

    /** Invite a member by phone number */
    invite: protectedProcedure
      .input(z.object({
        phone: z.string().min(6).max(20),
        role: z.enum(["manager", "cashier", "viewer"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user.companyId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "You are not part of a company" });
        }
        // Only owner or manager can invite
        if (ctx.user.companyRole !== "owner" && ctx.user.companyRole !== "manager") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only owner or manager can invite members" });
        }
        // Check member count
        const members = await db.getCompanyMembers(ctx.user.companyId);
        const company = await db.getCompanyById(ctx.user.companyId);
        if (members.length >= (company?.maxMembers || 5)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Maximum members reached (5)" });
        }
        await db.createInvitation({
          companyId: ctx.user.companyId,
          invitedPhone: input.phone,
          role: input.role,
          invitedBy: ctx.user.id,
        });
        return { success: true };
      }),

    /** Accept an invitation */
    acceptInvitation: protectedProcedure
      .input(z.object({ invitationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.acceptInvitation(input.invitationId, ctx.user.id);
        return { success: true };
      }),

    /** Reject an invitation */
    rejectInvitation: protectedProcedure
      .input(z.object({ invitationId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.rejectInvitation(input.invitationId);
        return { success: true };
      }),

    /** Remove a member */
    removeMember: protectedProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (ctx.user.companyRole !== "owner") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Only the owner can remove members" });
        }
        await db.removeCompanyMember(input.userId);
        return { success: true };
      }),

    /** Get pending invitations for current user */
    pendingInvitations: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user.phone) return [];
      return db.getPendingInvitations(ctx.user.phone);
    }),
  }),

  // ─── Admin Routes ────────────────────────────────────────────────
  admin: router({
    /** Get dashboard stats */
    stats: adminProcedure.query(async () => {
      return db.getUserStats();
    }),

    /** List all users */
    listUsers: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),

    /** Get a single user by ID */
    getUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getUserById(input.id);
      }),

    /** Update user role */
    setRole: adminProcedure
      .input(z.object({
        id: z.number(),
        role: z.enum(["user", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id && input.role !== "admin") {
          throw new Error("Cannot change your own role");
        }
        await db.updateUserRole(input.id, input.role);
        return { success: true };
      }),

    /** Update user status (active/restricted) */
    setStatus: adminProcedure
      .input(z.object({
        id: z.number(),
        status: z.enum(["active", "restricted"]),
      }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new Error("Cannot restrict your own account");
        }
        await db.updateUserStatus(input.id, input.status);
        return { success: true };
      }),

    /** Delete a user */
    deleteUser: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        if (input.id === ctx.user.id) {
          throw new Error("Cannot delete your own account");
        }
        await db.deleteUser(input.id);
        return { success: true };
      }),

    /** Grant subscription to a user */
    grantSubscription: adminProcedure
      .input(z.object({
        userId: z.number(),
        plan: z.enum(["solo", "team"]),
      }))
      .mutation(async ({ input }) => {
        await db.grantSubscription(input.userId, input.plan);
        return { success: true };
      }),

    /** Revoke subscription from a user */
    revokeSubscription: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await db.revokeSubscription(input.userId);
        return { success: true };
      }),

    /** Expire all overdue subscriptions */
    expireSubscriptions: adminProcedure.mutation(async () => {
      await db.expireSubscriptions();
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
