import { useState, useMemo } from "react";
import { Text, View, ScrollView, Pressable, StyleSheet } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import {
  formatCurrency,
  filterTransactionsByPeriod,
  calculateTotals,
} from "@/lib/store";

type Period = "daily" | "weekly" | "monthly" | "yearly";

export default function ReportsScreen() {
  const { state, translate } = useApp();
  const colors = useColors();
  const [period, setPeriod] = useState<Period>("monthly");

  const periodTxs = useMemo(
    () => filterTransactionsByPeriod(state.transactions, period),
    [state.transactions, period]
  );

  const totals = useMemo(() => calculateTotals(periodTxs), [periodTxs]);

  // Category breakdown for expenses
  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of periodTxs) {
      if (tx.type === "expense") {
        map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
      }
    }
    return Array.from(map.entries())
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTxs]);

  // Income category breakdown
  const incomeCategoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const tx of periodTxs) {
      if (tx.type === "income") {
        map.set(tx.categoryId, (map.get(tx.categoryId) || 0) + tx.amount);
      }
    }
    return Array.from(map.entries())
      .map(([categoryId, amount]) => ({ categoryId, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [periodTxs]);

  const getCategoryName = (categoryId: string) => {
    const cat = state.categories.find((c) => c.id === categoryId);
    if (!cat) return "";
    if (cat.isCustom) return cat.nameKey;
    return translate(cat.nameKey as any);
  };

  const getCategoryIcon = (categoryId: string) => {
    const cat = state.categories.find((c) => c.id === categoryId);
    return cat?.icon || "ellipsis";
  };

  const maxExpense = categoryBreakdown.length > 0 ? categoryBreakdown[0].amount : 1;
  const maxIncome = incomeCategoryBreakdown.length > 0 ? incomeCategoryBreakdown[0].amount : 1;

  const periods: { key: Period; label: string }[] = [
    { key: "daily", label: translate("daily") },
    { key: "weekly", label: translate("weekly") },
    { key: "monthly", label: translate("monthly") },
    { key: "yearly", label: translate("yearly") },
  ];

  const barChartData = useMemo(() => {
    // Simple comparison bar
    const maxVal = Math.max(totals.income, totals.expense, 1);
    return {
      incomePercent: (totals.income / maxVal) * 100,
      expensePercent: (totals.expense / maxVal) * 100,
    };
  }, [totals]);

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {translate("reports")}
          </Text>
        </View>

        {/* Period Selector */}
        <View style={styles.periodBar}>
          {periods.map((p) => (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={({ pressed }) => [
                styles.periodBtn,
                {
                  backgroundColor: period === p.key ? colors.primary : colors.surface,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.periodText,
                  { color: period === p.key ? "#FFF" : colors.muted },
                ]}
              >
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.success + "15", borderColor: colors.success + "30" }]}>
            <Text style={[styles.summaryLabel, { color: colors.success }]}>{translate("income")}</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>
              {formatCurrency(totals.income, state.profile.currency)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.error + "15", borderColor: colors.error + "30" }]}>
            <Text style={[styles.summaryLabel, { color: colors.error }]}>{translate("expense")}</Text>
            <Text style={[styles.summaryValue, { color: colors.error }]}>
              {formatCurrency(totals.expense, state.profile.currency)}
            </Text>
          </View>
        </View>

        {/* Net Balance */}
        <View style={[styles.netCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.netLabel, { color: colors.muted }]}>{translate("netBalance")}</Text>
          <Text
            style={[
              styles.netValue,
              { color: totals.balance >= 0 ? colors.success : colors.error },
            ]}
          >
            {totals.balance >= 0 ? "+" : ""}
            {formatCurrency(totals.balance, state.profile.currency)}
          </Text>
        </View>

        {/* Income vs Expense Bar */}
        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.foreground }]}>
            {translate("incomeVsExpense")}
          </Text>
          {periodTxs.length > 0 ? (
            <View style={styles.barChart}>
              <View style={styles.barRow}>
                <Text style={[styles.barLabel, { color: colors.success }]}>{translate("income")}</Text>
                <View style={[styles.barTrack, { backgroundColor: colors.border + "40" }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: colors.success,
                        width: `${barChartData.incomePercent}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barValue, { color: colors.foreground }]}>
                  {formatCurrency(totals.income, state.profile.currency)}
                </Text>
              </View>
              <View style={styles.barRow}>
                <Text style={[styles.barLabel, { color: colors.error }]}>{translate("expense")}</Text>
                <View style={[styles.barTrack, { backgroundColor: colors.border + "40" }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: colors.error,
                        width: `${barChartData.expensePercent}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barValue, { color: colors.foreground }]}>
                  {formatCurrency(totals.expense, state.profile.currency)}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.noData, { color: colors.muted }]}>
              {translate("noDataForPeriod")}
            </Text>
          )}
        </View>

        {/* Expense by Category */}
        {categoryBreakdown.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>
              {translate("expenseByCategory")}
            </Text>
            {categoryBreakdown.map((item) => (
              <View key={item.categoryId} style={styles.catRow}>
                <View style={[styles.catIcon, { backgroundColor: colors.error + "15" }]}>
                  <IconSymbol
                    name={getCategoryIcon(item.categoryId) as any}
                    size={18}
                    color={colors.error}
                  />
                </View>
                <View style={styles.catInfo}>
                  <View style={styles.catHeader}>
                    <Text style={[styles.catName, { color: colors.foreground }]}>
                      {getCategoryName(item.categoryId)}
                    </Text>
                    <Text style={[styles.catAmount, { color: colors.error }]}>
                      {formatCurrency(item.amount, state.profile.currency)}
                    </Text>
                  </View>
                  <View style={[styles.catBarTrack, { backgroundColor: colors.border + "40" }]}>
                    <View
                      style={[
                        styles.catBarFill,
                        {
                          backgroundColor: colors.error,
                          width: `${(item.amount / maxExpense) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Income by Category */}
        {incomeCategoryBreakdown.length > 0 && (
          <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.chartTitle, { color: colors.foreground }]}>
              {translate("income")} - {translate("categories")}
            </Text>
            {incomeCategoryBreakdown.map((item) => (
              <View key={item.categoryId} style={styles.catRow}>
                <View style={[styles.catIcon, { backgroundColor: colors.success + "15" }]}>
                  <IconSymbol
                    name={getCategoryIcon(item.categoryId) as any}
                    size={18}
                    color={colors.success}
                  />
                </View>
                <View style={styles.catInfo}>
                  <View style={styles.catHeader}>
                    <Text style={[styles.catName, { color: colors.foreground }]}>
                      {getCategoryName(item.categoryId)}
                    </Text>
                    <Text style={[styles.catAmount, { color: colors.success }]}>
                      {formatCurrency(item.amount, state.profile.currency)}
                    </Text>
                  </View>
                  <View style={[styles.catBarTrack, { backgroundColor: colors.border + "40" }]}>
                    <View
                      style={[
                        styles.catBarFill,
                        {
                          backgroundColor: colors.success,
                          width: `${(item.amount / maxIncome) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
  },
  periodBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  periodText: {
    fontSize: 13,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 4,
  },
  netCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
    alignItems: "center",
  },
  netLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  netValue: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 4,
  },
  chartCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
  },
  barChart: {
    gap: 16,
  },
  barRow: {
    gap: 6,
  },
  barLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  barTrack: {
    height: 24,
    borderRadius: 12,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 12,
    minWidth: 4,
  },
  barValue: {
    fontSize: 14,
    fontWeight: "700",
  },
  noData: {
    textAlign: "center",
    paddingVertical: 20,
    fontSize: 14,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  catInfo: {
    flex: 1,
    marginLeft: 12,
  },
  catHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  catName: {
    fontSize: 14,
    fontWeight: "600",
  },
  catAmount: {
    fontSize: 14,
    fontWeight: "700",
  },
  catBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  catBarFill: {
    height: "100%",
    borderRadius: 3,
    minWidth: 4,
  },
});
