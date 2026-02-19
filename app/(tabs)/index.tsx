import { FlatList, Text, View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { calculateTotals, formatCurrency, filterTransactionsByPeriod, Transaction } from "@/lib/store";
import { useMemo } from "react";

export default function DashboardScreen() {
  const { state, translate } = useApp();
  const colors = useColors();
  const router = useRouter();

  const allTotals = useMemo(() => calculateTotals(state.transactions), [state.transactions]);
  const todayTotals = useMemo(
    () => calculateTotals(filterTransactionsByPeriod(state.transactions, "daily")),
    [state.transactions]
  );

  const recentTransactions = useMemo(
    () =>
      [...state.transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
    [state.transactions]
  );

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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return translate("today");
    if (isYesterday) return translate("yesterday");
    return d.toLocaleDateString(state.language === "fr" ? "fr-FR" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <Pressable
      style={({ pressed }) => [styles.transactionItem, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.categoryIcon, { backgroundColor: item.type === "income" ? colors.success + "20" : colors.error + "20" }]}>
        <IconSymbol
          name={getCategoryIcon(item.categoryId) as any}
          size={20}
          color={item.type === "income" ? colors.success : colors.error}
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={[styles.transactionCategory, { color: colors.foreground }]}>
          {getCategoryName(item.categoryId)}
        </Text>
        <Text style={[styles.transactionDesc, { color: colors.muted }]} numberOfLines={1}>
          {item.description || formatDate(item.date)}
        </Text>
      </View>
      <Text
        style={[
          styles.transactionAmount,
          { color: item.type === "income" ? colors.success : colors.error },
        ]}
      >
        {item.type === "income" ? "+" : "-"}
        {formatCurrency(item.amount, state.profile.currency)}
      </Text>
    </Pressable>
  );

  return (
    <ScreenContainer className="flex-1">
      <FlatList
        data={recentTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={[styles.greeting, { color: colors.muted }]}>
                  {translate("welcome")}
                </Text>
                <Text style={[styles.businessName, { color: colors.foreground }]}>
                  {state.profile.businessName || translate("businessName")}
                </Text>
              </View>
            </View>

            {/* Balance Card */}
            <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
              <Text style={styles.balanceLabel}>{translate("totalBalance")}</Text>
              <Text style={styles.balanceAmount}>
                {formatCurrency(allTotals.balance, state.profile.currency)}
              </Text>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <View style={styles.balanceIconRow}>
                    <IconSymbol name="arrow.up.circle.fill" size={18} color="#4ADE80" />
                    <Text style={styles.balanceItemLabel}>{translate("income")}</Text>
                  </View>
                  <Text style={styles.balanceItemAmount}>
                    {formatCurrency(allTotals.income, state.profile.currency)}
                  </Text>
                </View>
                <View style={[styles.balanceDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
                <View style={styles.balanceItem}>
                  <View style={styles.balanceIconRow}>
                    <IconSymbol name="arrow.down.circle.fill" size={18} color="#F87171" />
                    <Text style={styles.balanceItemLabel}>{translate("expense")}</Text>
                  </View>
                  <Text style={styles.balanceItemAmount}>
                    {formatCurrency(allTotals.expense, state.profile.currency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <Pressable
                onPress={() => router.push("/add-transaction?type=income" as any)}
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  { backgroundColor: colors.success + "15", borderColor: colors.success + "40", opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <IconSymbol name="plus.circle.fill" size={28} color={colors.success} />
                <Text style={[styles.quickActionText, { color: colors.success }]}>
                  {translate("addIncome")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/add-transaction?type=expense" as any)}
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  { backgroundColor: colors.error + "15", borderColor: colors.error + "40", opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <IconSymbol name="minus.circle.fill" size={28} color={colors.error} />
                <Text style={[styles.quickActionText, { color: colors.error }]}>
                  {translate("addExpense")}
                </Text>
              </Pressable>
            </View>

            {/* Today's Summary */}
            <View style={[styles.todayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {translate("todaySummary")}
              </Text>
              <View style={styles.todayRow}>
                <View style={styles.todayItem}>
                  <Text style={[styles.todayLabel, { color: colors.muted }]}>{translate("income")}</Text>
                  <Text style={[styles.todayValue, { color: colors.success }]}>
                    +{formatCurrency(todayTotals.income, state.profile.currency)}
                  </Text>
                </View>
                <View style={styles.todayItem}>
                  <Text style={[styles.todayLabel, { color: colors.muted }]}>{translate("expense")}</Text>
                  <Text style={[styles.todayValue, { color: colors.error }]}>
                    -{formatCurrency(todayTotals.expense, state.profile.currency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Recent Transactions Header */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {translate("recentTransactions")}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="doc.text" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {translate("noTransactions")}
            </Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 16,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "500",
  },
  businessName: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 4,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  balanceItem: {
    flex: 1,
  },
  balanceIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceItemLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "500",
  },
  balanceItemAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  balanceDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: "700",
  },
  todayCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  todayRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 16,
  },
  todayItem: {
    flex: 1,
  },
  todayLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  todayValue: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionCategory: {
    fontSize: 15,
    fontWeight: "600",
  },
  transactionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
});
