import { describe, it, expect } from "vitest";
import { translations, t } from "../i18n";

describe("translations", () => {
  it("should have English translations", () => {
    expect(translations.en).toBeDefined();
    expect(translations.en.dashboard).toBe("Dashboard");
    expect(translations.en.income).toBe("Income");
    expect(translations.en.expense).toBe("Expense");
  });

  it("should have French translations", () => {
    expect(translations.fr).toBeDefined();
    expect(translations.fr.dashboard).toBe("Tableau de bord");
    expect(translations.fr.income).toBe("Revenus");
    expect(translations.fr.expense).toBe("Dépenses");
  });

  it("should have the same keys in both languages", () => {
    const enKeys = Object.keys(translations.en).sort();
    const frKeys = Object.keys(translations.fr).sort();
    expect(enKeys).toEqual(frKeys);
  });

  it("should have non-empty values for all keys", () => {
    for (const key of Object.keys(translations.en)) {
      expect(translations.en[key as keyof typeof translations.en]).toBeTruthy();
      expect(translations.fr[key as keyof typeof translations.fr]).toBeTruthy();
    }
  });
});

describe("t function", () => {
  it("should return English translation", () => {
    expect(t("dashboard", "en")).toBe("Dashboard");
    expect(t("settings", "en")).toBe("Settings");
  });

  it("should return French translation", () => {
    expect(t("dashboard", "fr")).toBe("Tableau de bord");
    expect(t("settings", "fr")).toBe("Paramètres");
  });

  it("should return key for unknown translation keys", () => {
    expect(t("nonexistent_key" as any, "en")).toBe("nonexistent_key");
  });
});
