# Implementation Notes

## Current State (Feb 27, 2026)
- App running: 0 TypeScript errors, 69 tests passing
- Login screen shows correctly with Business+ branding
- Server 403 on /api/auth/me — root cause of auth bugs

## Root Cause Analysis
The authenticateRequest in sdk.ts tries to sync from OAuth server when user not found by openId.
For phone-based users (openId = "phone_XXXX"), this fails because OAuth server doesn't know them.
The fix: authenticateRequest should NOT try OAuth sync for phone-based users.

Also, the login flow returns sessionToken but the client (use-auth.ts / _core/auth.ts) 
stores it and calls getMe() which hits /api/auth/me — this should work if the token is valid.
Need to check if the Bearer token is being sent correctly.

## 10 Issues to Fix
1. Auth → Dashboard bug (403 on /api/auth/me for phone users)
2. No logout button visible
3. Company logo disappears on app update (stored locally)
4. Custom category adds to permanent list — should be one-time use
5. Export data destination unclear
6. Country code auto-detect on login
7. Admin panel not visible (tied to #1)
8. Subscription plans not visible (tied to #1)
9. Mobile money payment integration
10. Sync all business data to server DB
