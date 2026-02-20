import { useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatCurrency, Transaction, TransactionType } from "@/lib/store";

type FilterType = "all" | "income" | "expense";

export default function TransactionsScreen() {
  const { state, deleteTransaction, translate } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");

  const filteredTransactions = useMemo(() => {
    let txs = [...state.transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (filter !== "all") {
      txs = txs.filter((tx) => tx.type === filter);
    }
    return txs;
  }, [state.transactions, filter]);

  const getCategoryName = useCallback(
    (categoryId: string) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      if (!cat) return "";
      if (cat.isCustom) return cat.nameKey;
      return translate(cat.nameKey as any);
    },
    [state.categories, translate]
  );

  const getCategoryIcon = useCallback(
    (categoryId: string) => {
      const cat = state.categories.find((c) => c.id === categoryId);
      return cat?.icon || "ellipsis";
    },
    [state.categories]
  );

  const formatTxDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(state.language === "fr" ? "fr-FR" : "en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      translate("deleteTransaction"),
      translate("deleteConfirm"),
      [
        { text: translate("cancel"), style: "cancel" },
        {
          text: translate("delete"),
          style: "destructive",
          onPress: () => deleteTransaction(id),
        },
      ]
    );
  };

  const handleEdit = (tx: Transaction) => {
    router.push(`/add-transaction?editId=${tx.id}` as any);
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <Pressable
      onPress={() => router.push({ pathname: "/transaction-detail", params: { txId: item.id } } as any)}
      onLongPress={() => handleDelete(item.id)}
      style={({ pressed }) => [
        styles.transactionItem,
        { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View
        style={[
          styles.categoryIcon,
          {
            backgroundColor:
              item.type === "income" ? colors.success + "20" : colors.error + "20",
          },
        ]}
      >
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
        <Text style={[styles.transactionDate, { color: colors.muted }]}>
          {item.description ? `${item.description} · ` : ""}
          {formatTxDate(item.date)}
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

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: translate("all") },
    { key: "income", label: translate("income") },
    { key: "expense", label: translate("expense") },
  ];

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {translate("transactions")}
        </Text>
      </View>

      {/* Filter Bar */}
      <View style={styles.filterBar}>
        {filters.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={({ pressed }) => [
              styles.filterBtn,
              {
                backgroundColor: filter === f.key ? colors.primary : colors.surface,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.filterText,
                { color: filter === f.key ? "#FFF" : colors.muted },
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Transaction List */}
      <FlatList
        data={filteredTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="doc.text" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {translate("noTransactions")}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <Pressable
        onPress={() => router.push("/add-transaction" as any)}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.9 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          },
        ]}
      >
        <IconSymbol name="plus.circle.fill" size={28} color="#FFF" />
      </Pressable>
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
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  filterBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
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
  transactionDate: {
    fontSize: 13,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
  fab: {
    position: "absolute",
    bottom: 100,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
