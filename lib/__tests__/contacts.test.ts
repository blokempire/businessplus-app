import { describe, it, expect } from "vitest";
import { calculateContactBalance, generateId } from "../store";
import type { DebtEntry } from "../store";

describe("calculateContactBalance", () => {
  const contactId = "contact1";

  it("returns zero balances when no entries exist", () => {
    const result = calculateContactBalance([], contactId);
    expect(result.theyOweMe).toBe(0);
    expect(result.iOweThem).toBe(0);
    expect(result.netBalance).toBe(0);
  });

  it("calculates correctly when only theyOweMe entries exist", () => {
    const entries: DebtEntry[] = [
      {
        id: "e1",
        contactId,
        type: "theyOweMe",
        amount: 5000,
        description: "Loan",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        contactId,
        type: "theyOweMe",
        amount: 3000,
        description: "Another loan",
        date: "2026-01-15T00:00:00.000Z",
        createdAt: "2026-01-15T00:00:00.000Z",
      },
    ];
    const result = calculateContactBalance(entries, contactId);
    expect(result.theyOweMe).toBe(8000);
    expect(result.iOweThem).toBe(0);
    expect(result.netBalance).toBe(8000);
  });

  it("calculates correctly when only iOweThem entries exist", () => {
    const entries: DebtEntry[] = [
      {
        id: "e1",
        contactId,
        type: "iOweThem",
        amount: 2000,
        description: "Borrowed",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const result = calculateContactBalance(entries, contactId);
    expect(result.theyOweMe).toBe(0);
    expect(result.iOweThem).toBe(2000);
    expect(result.netBalance).toBe(-2000);
  });

  it("calculates net balance with mixed entries", () => {
    const entries: DebtEntry[] = [
      {
        id: "e1",
        contactId,
        type: "theyOweMe",
        amount: 10000,
        description: "Loan",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        contactId,
        type: "iOweThem",
        amount: 3000,
        description: "Repayment",
        date: "2026-01-10T00:00:00.000Z",
        createdAt: "2026-01-10T00:00:00.000Z",
      },
      {
        id: "e3",
        contactId,
        type: "theyOweMe",
        amount: 2000,
        description: "Another loan",
        date: "2026-01-15T00:00:00.000Z",
        createdAt: "2026-01-15T00:00:00.000Z",
      },
    ];
    const result = calculateContactBalance(entries, contactId);
    expect(result.theyOweMe).toBe(12000);
    expect(result.iOweThem).toBe(3000);
    expect(result.netBalance).toBe(9000);
  });

  it("ignores entries for other contacts", () => {
    const entries: DebtEntry[] = [
      {
        id: "e1",
        contactId,
        type: "theyOweMe",
        amount: 5000,
        description: "Loan",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        contactId: "otherContact",
        type: "theyOweMe",
        amount: 99999,
        description: "Should be ignored",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const result = calculateContactBalance(entries, contactId);
    expect(result.theyOweMe).toBe(5000);
    expect(result.netBalance).toBe(5000);
  });

  it("returns zero net when debts cancel out", () => {
    const entries: DebtEntry[] = [
      {
        id: "e1",
        contactId,
        type: "theyOweMe",
        amount: 5000,
        description: "Loan",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        contactId,
        type: "iOweThem",
        amount: 5000,
        description: "Repaid",
        date: "2026-01-15T00:00:00.000Z",
        createdAt: "2026-01-15T00:00:00.000Z",
      },
    ];
    const result = calculateContactBalance(entries, contactId);
    expect(result.theyOweMe).toBe(5000);
    expect(result.iOweThem).toBe(5000);
    expect(result.netBalance).toBe(0);
  });
});

describe("payment scenarios", () => {
  const contactId = "contact1";

  it("partial payment reduces net balance correctly (they owe me)", () => {
    // Someone owes me 10000, they pay back 3000
    const entries: DebtEntry[] = [
      {
        id: "e1",
        contactId,
        type: "theyOweMe",
        amount: 10000,
        description: "Loan",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        contactId,
        type: "iOweThem",
        amount: 3000,
        description: "Payment Received",
        date: "2026-01-10T00:00:00.000Z",
        createdAt: "2026-01-10T00:00:00.000Z",
      },
    ];
    const result = calculateContactBalance(entries, contactId);
    expect(result.netBalance).toBe(7000);
    expect(result.theyOweMe).toBe(10000);
    expect(result.iOweThem).toBe(3000);
  });

  it("full payment clears net balance (they owe me)", () => {
    const entries: DebtEntry[] = [
      {
        id: "e1",
        contactId,
        type: "theyOweMe",
        amount: 5000,
        description: "Loan",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        contactId,
        type: "iOweThem",
        amount: 5000,
        description: "Payment Received",
        date: "2026-01-15T00:00:00.000Z",
        createdAt: "2026-01-15T00:00:00.000Z",
      },
    ];
    const result = calculateContactBalance(entries, contactId);
    expect(result.netBalance).toBe(0);
  });

  it("partial payment reduces net balance correctly (I owe them)", () => {
    // I owe someone 8000, I pay back 2000
    const entries: DebtEntry[] = [
      {
        id: "e1",
        contactId,
        type: "iOweThem",
        amount: 8000,
        description: "Borrowed",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        contactId,
        type: "theyOweMe",
        amount: 2000,
        description: "Payment Made",
        date: "2026-01-10T00:00:00.000Z",
        createdAt: "2026-01-10T00:00:00.000Z",
      },
    ];
    const result = calculateContactBalance(entries, contactId);
    expect(result.netBalance).toBe(-6000);
    expect(result.iOweThem).toBe(8000);
    expect(result.theyOweMe).toBe(2000);
  });

  it("multiple partial payments accumulate correctly", () => {
    const entries: DebtEntry[] = [
      {
        id: "e1",
        contactId,
        type: "theyOweMe",
        amount: 15000,
        description: "Loan",
        date: "2026-01-01T00:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        contactId,
        type: "iOweThem",
        amount: 5000,
        description: "Payment 1",
        date: "2026-01-10T00:00:00.000Z",
        createdAt: "2026-01-10T00:00:00.000Z",
      },
      {
        id: "e3",
        contactId,
        type: "iOweThem",
        amount: 3000,
        description: "Payment 2",
        date: "2026-01-20T00:00:00.000Z",
        createdAt: "2026-01-20T00:00:00.000Z",
      },
      {
        id: "e4",
        contactId,
        type: "iOweThem",
        amount: 7000,
        description: "Payment 3",
        date: "2026-02-01T00:00:00.000Z",
        createdAt: "2026-02-01T00:00:00.000Z",
      },
    ];
    const result = calculateContactBalance(entries, contactId);
    expect(result.netBalance).toBe(0); // 15000 - 5000 - 3000 - 7000 = 0
    expect(result.theyOweMe).toBe(15000);
    expect(result.iOweThem).toBe(15000);
  });
});

describe("generateId", () => {
  it("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });

  it("generates string IDs", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });
});
