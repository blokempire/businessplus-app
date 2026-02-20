import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Admin panel: user management
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
      .input(
        z.object({
          id: z.number(),
          role: z.enum(["user", "admin"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Prevent admin from demoting themselves
        if (input.id === ctx.user.id && input.role !== "admin") {
          throw new Error("Cannot change your own role");
        }
        await db.updateUserRole(input.id, input.role);
        return { success: true };
      }),

    /** Update user status (active/restricted) */
    setStatus: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["active", "restricted"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Prevent admin from restricting themselves
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
        // Prevent admin from deleting themselves
        if (input.id === ctx.user.id) {
          throw new Error("Cannot delete your own account");
        }
        await db.deleteUser(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
