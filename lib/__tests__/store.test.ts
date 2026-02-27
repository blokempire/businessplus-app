import { describe, it, expect } from "vitest";
import {
  generateId,
  formatCurrency,
  calculateTotals,
  filterTransactionsByPeriod,
  DEFAULT_CATEGORIES,
  CURRENCIES,
  Transaction,
} from "../store";

describe("generateId", () => {
  it("should return a non-empty string", () => {
    const id = generateId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });

  it("should return unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("formatCurrency", () => {
  it("should format CFA currency", () => {
    expect(formatCurrency(1000, "XOF")).toBe("1,000 FCFA");
  });

  it("should format Nigerian Naira", () => {
    expect(formatCurrency(5000, "NGN")).toBe("5,000 ₦");
  });

  it("should format USD", () => {
    expect(formatCurrency(250, "USD")).toBe("250 $");
  });

  it("should format EUR", () => {
    expect(formatCurrency(1500, "EUR")).toBe("1,500 €");
  });

  it("should handle zero", () => {
    expect(formatCurrency(0, "XOF")).toBe("0 FCFA");
  });

  it("should handle negative amounts (uses absolute value)", () => {
    expect(formatCurrency(-500, "USD")).toBe("500 $");
  });

  it("should fall back to currency code for unknown currencies", () => {
    expect(formatCurrency(100, "ZZZ")).toBe("100 ZZZ");
  });
});

describe("calculateTotals", () => {
  it("should return zeros for empty transactions", () => {
    const result = calculateTotals([]);
    expect(result).toEqual({ income: 0, expense: 0, balance: 0 });
  });

  it("should calculate income total", () => {
    const txs: Transaction[] = [
      { id: "1", type: "income", amount: 1000, categoryId: "c1", description: "", date: "2026-01-01", createdAt: "" },
      { id: "2", type: "income", amount: 2000, categoryId: "c1", description: "", date: "2026-01-02", createdAt: "" },
    ];
    const result = calculateTotals(txs);
    expect(result.income).toBe(3000);
    expect(result.expense).toBe(0);
    expect(result.balance).toBe(3000);
  });

  it("should calculate expense total", () => {
    const txs: Transaction[] = [
      { id: "1", type: "expense", amount: 500, categoryId: "c1", description: "", date: "2026-01-01", createdAt: "" },
      { id: "2", type: "expense", amount: 300, categoryId: "c2", description: "", date: "2026-01-02", createdAt: "" },
    ];
    const result = calculateTotals(txs);
    expect(result.income).toBe(0);
    expect(result.expense).toBe(800);
    expect(result.balance).toBe(-800);
  });

  it("should calculate mixed totals correctly", () => {
    const txs: Transaction[] = [
      { id: "1", type: "income", amount: 5000, categoryId: "c1", description: "", date: "2026-01-01", createdAt: "" },
      { id: "2", type: "expense", amount: 2000, categoryId: "c2", description: "", date: "2026-01-02", createdAt: "" },
      { id: "3", type: "expense", amount: 1000, categoryId: "c3", description: "", date: "2026-01-03", createdAt: "" },
    ];
    const result = calculateTotals(txs);
    expect(result.income).toBe(5000);
    expect(result.expense).toBe(3000);
    expect(result.balance).toBe(2000);
  });
});

describe("DEFAULT_CATEGORIES", () => {
  it("should have income and expense categories", () => {
    const incomeCount = DEFAULT_CATEGORIES.filter((c) => c.type === "income").length;
    const expenseCount = DEFAULT_CATEGORIES.filter((c) => c.type === "expense").length;
    expect(incomeCount).toBeGreaterThan(0);
    expect(expenseCount).toBeGreaterThan(0);
  });

  it("should have unique IDs", () => {
    const ids = DEFAULT_CATEGORIES.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("should all be non-custom", () => {
    expect(DEFAULT_CATEGORIES.every((c) => !c.isCustom)).toBe(true);
  });
});

describe("CURRENCIES", () => {
  it("should include CFA and common currencies", () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(codes).toContain("XOF");
    expect(codes).toContain("XAF");
    expect(codes).toContain("USD");
    expect(codes).toContain("EUR");
  });
});

describe("filterTransactionsByPeriod", () => {
  const now = new Date();
  const todayStr = now.toISOString();
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const lastMonthDate = new Date(now);
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);

  const txs: Transaction[] = [
    { id: "1", type: "income", amount: 100, categoryId: "c1", description: "", date: todayStr, createdAt: "" },
    { id: "2", type: "expense", amount: 50, categoryId: "c2", description: "", date: yesterdayDate.toISOString(), createdAt: "" },
    { id: "3", type: "income", amount: 200, categoryId: "c1", description: "", date: lastMonthDate.toISOString(), createdAt: "" },
  ];

  it("should filter daily transactions", () => {
    const result = filterTransactionsByPeriod(txs, "daily");
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((tx) => tx.id === "1")).toBe(true);
  });

  it("should filter monthly transactions", () => {
    const result = filterTransactionsByPeriod(txs, "monthly");
    // Today and yesterday should be in this month (unless it's the 1st)
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should filter yearly transactions", () => {
    const result = filterTransactionsByPeriod(txs, "yearly");
    // All transactions from this year
    expect(result.length).toBeGreaterThanOrEqual(1);
  });
});
