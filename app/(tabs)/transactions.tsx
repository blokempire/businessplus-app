import { useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { formatCurrency, Transaction, TransactionType } from "@/lib/store";
import { ExportPreview } from "@/components/export-preview";

type FilterType = "all" | "income" | "expense";
type DateRange = "all" | "today" | "week" | "month" | "year";

export default function TransactionsScreen() {
  const { state, deleteTransaction, translate } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [exportMenuVisible, setExportMenuVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const filteredTransactions = useMemo(() => {
    let txs = [...state.transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (filter !== "all") {
      txs = txs.filter((tx) => tx.type === filter);
    }
    // Date range filter
    if (dateRange !== "all") {
      const now = new Date();
      const start = new Date();
      if (dateRange === "today") {
        start.setHours(0, 0, 0, 0);
      } else if (dateRange === "week") {
        start.setDate(now.getDate() - 7);
      } else if (dateRange === "month") {
        start.setMonth(now.getMonth() - 1);
      } else if (dateRange === "year") {
        start.setFullYear(now.getFullYear() - 1);
      }
      txs = txs.filter((tx) => new Date(tx.date) >= start);
    }
    return txs;
  }, [state.transactions, filter, dateRange]);

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

  const totals = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => tx.type === "income")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const expense = filteredTransactions
      .filter((tx) => tx.type === "expense")
      .reduce((sum, tx) => sum + tx.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filteredTransactions]);

  const getDateRangeLabel = () => {
    if (dateRange === "all") return translate("all");
    const now = new Date();
    const start = new Date();
    if (dateRange === "today") {
      start.setHours(0, 0, 0, 0);
    } else if (dateRange === "week") {
      start.setDate(now.getDate() - 7);
    } else if (dateRange === "month") {
      start.setMonth(now.getMonth() - 1);
    } else if (dateRange === "year") {
      start.setFullYear(now.getFullYear() - 1);
    }
    const locale = state.language === "fr" ? "fr-FR" : "en-US";
    const fmt = (d: Date) => d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
    return `${fmt(start)} → ${fmt(now)}`;
  };

  const generateCSVHtml = () => {
    const rangeLine = `${translate("period")}: ${getDateRangeLabel()}`;
    const rows = filteredTransactions
      .map(
        (tx, i) =>
          `<tr><td>${i + 1}</td><td>${new Date(tx.date).toLocaleDateString()}</td><td>${tx.type === "income" ? translate("income") : translate("expense")}</td><td>${getCategoryName(tx.categoryId)}</td><td>${tx.description || "-"}</td><td>${tx.type === "income" ? "+" : "-"}${formatCurrency(tx.amount, state.profile.currency)}</td></tr>`
      )
      .join("");
    return `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:20px}h2{color:#0D9488}table{width:100%;border-collapse:collapse}th{background:#0D9488;color:#fff;padding:8px;text-align:left;font-size:12px}td{padding:8px;border-bottom:1px solid #eee;font-size:12px}tr:nth-child(even){background:#f9f9f9}.summary{margin:16px 0;font-size:14px}</style></head><body><h2>${state.profile.businessName || "Business+"}</h2><p>${rangeLine}</p><p class="summary">${translate("totalIncome")}: +${formatCurrency(totals.income, state.profile.currency)} | ${translate("totalExpense")}: -${formatCurrency(totals.expense, state.profile.currency)} | ${translate("totalBalance")}: ${formatCurrency(totals.balance, state.profile.currency)}</p><table><tr><th>#</th><th>${translate("date")}</th><th>${translate("type")}</th><th>${translate("category")}</th><th>${translate("description")}</th><th>${translate("amount")}</th></tr>${rows}</table></body></html>`;
  };

  const exportAsCSV = () => {
    setExportMenuVisible(false);
    setPreviewTitle(`${translate("transactions")} (CSV)`);
    setPreviewHtml(generateCSVHtml());
    setPreviewVisible(true);
  };

  const generatePDFHtml = () => {
    const businessName = state.profile.businessName || "Business+";
    const dateRangeStr = getDateRangeLabel();
    return `
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 30px; color: #333; }
          h1 { color: #0D9488; margin-bottom: 4px; }
          .subtitle { color: #666; margin-bottom: 8px; }
          .date-range { color: #0D9488; font-weight: bold; font-size: 14px; margin-bottom: 20px; }
          .summary { display: flex; gap: 20px; margin-bottom: 24px; }
          .summary-box { flex: 1; padding: 16px; border-radius: 10px; text-align: center; }
          .income-box { background: #ECFDF5; }
          .expense-box { background: #FEF2F2; }
          .balance-box { background: #F0FDFA; }
          .summary-label { font-size: 12px; color: #666; }
          .summary-value { font-size: 20px; font-weight: bold; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #0D9488; color: white; padding: 10px; text-align: left; font-size: 12px; }
          td { padding: 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
          tr:nth-child(even) { background: #F9FAFB; }
          .income { color: #16A34A; font-weight: bold; }
          .expense { color: #DC2626; font-weight: bold; }
          .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
        </style>
      </head>
      <body>
        <h1>${businessName}</h1>
        <div class="subtitle">${translate("transactions")} (${filteredTransactions.length} ${translate("transactions").toLowerCase()})</div>
        <div class="date-range">${translate("period")}: ${dateRangeStr}</div>
        <div class="summary">
          <div class="summary-box income-box">
            <div class="summary-label">${translate("totalIncome")}</div>
            <div class="summary-value" style="color:#16A34A">+${formatCurrency(totals.income, state.profile.currency)}</div>
          </div>
          <div class="summary-box expense-box">
            <div class="summary-label">${translate("totalExpense")}</div>
            <div class="summary-value" style="color:#DC2626">-${formatCurrency(totals.expense, state.profile.currency)}</div>
          </div>
          <div class="summary-box balance-box">
            <div class="summary-label">${translate("totalBalance")}</div>
            <div class="summary-value" style="color:#0D9488">${formatCurrency(totals.balance, state.profile.currency)}</div>
          </div>
        </div>
        <table>
          <tr><th>#</th><th>${translate("date")}</th><th>${translate("type")}</th><th>${translate("category")}</th><th>${translate("description")}</th><th>${translate("amount")}</th></tr>
          ${filteredTransactions
            .map(
              (tx, i) =>
                `<tr>
                  <td>${i + 1}</td>
                  <td>${new Date(tx.date).toLocaleDateString()}</td>
                  <td>${tx.type === "income" ? translate("income") : translate("expense")}</td>
                  <td>${getCategoryName(tx.categoryId)}</td>
                  <td>${tx.description || "-"}</td>
                  <td class="${tx.type}">${tx.type === "income" ? "+" : "-"}${formatCurrency(tx.amount, state.profile.currency)}</td>
                </tr>`
            )
            .join("")}
        </table>
        <div class="footer">${businessName} · ${new Date().toLocaleDateString()}</div>
      </body>
      </html>
    `;
  };

  const exportAsPDF = () => {
    setExportMenuVisible(false);
    setPreviewTitle(`${translate("transactions")} (PDF)`);
    setPreviewHtml(generatePDFHtml());
    setPreviewVisible(true);
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

  const dateRanges: { key: DateRange; label: string }[] = [
    { key: "all", label: translate("all") },
    { key: "today", label: translate("today") },
    { key: "week", label: translate("thisWeek") },
    { key: "month", label: translate("thisMonth") },
    { key: "year", label: translate("thisYear") },
  ];

  return (
    <ScreenContainer className="flex-1">
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {translate("transactions")}
        </Text>
        <Pressable
          onPress={() => setExportMenuVisible(true)}
          style={({ pressed }) => [
            styles.exportBtn,
            { backgroundColor: colors.primary + "15", opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <IconSymbol name="square.and.arrow.up" size={18} color={colors.primary} />
          <Text style={[styles.exportBtnText, { color: colors.primary }]}>
            {translate("export")}
          </Text>
        </Pressable>
      </View>

      {/* Date Range Bar */}
      <View style={styles.dateRangeBar}>
        {dateRanges.map((dr) => (
          <Pressable
            key={dr.key}
            onPress={() => setDateRange(dr.key)}
            style={({ pressed }) => [
              styles.dateRangeBtn,
              {
                backgroundColor: dateRange === dr.key ? colors.primary + "20" : "transparent",
                borderColor: dateRange === dr.key ? colors.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.dateRangeText,
                { color: dateRange === dr.key ? colors.primary : colors.muted },
              ]}
            >
              {dr.label}
            </Text>
          </Pressable>
        ))}
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

      {/* Summary Bar */}
      <View style={[styles.summaryBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>{translate("income")}</Text>
          <Text style={[styles.summaryValue, { color: colors.success }]}>
            +{formatCurrency(totals.income, state.profile.currency)}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>{translate("expense")}</Text>
          <Text style={[styles.summaryValue, { color: colors.error }]}>
            -{formatCurrency(totals.expense, state.profile.currency)}
          </Text>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryLabel, { color: colors.muted }]}>{translate("balance")}</Text>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>
            {formatCurrency(totals.balance, state.profile.currency)}
          </Text>
        </View>
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

      {/* Export Preview */}
      <ExportPreview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        html={previewHtml}
        title={previewTitle}
        fileName={`transactions_${new Date().toISOString().split("T")[0]}.pdf`}
        shareLabel={translate("sharePDF")}
        printLabel={translate("printInvoice")}
      />

      {/* Export Menu Modal */}
      <Modal visible={exportMenuVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setExportMenuVisible(false)}>
          <View style={[styles.exportMenu, { backgroundColor: colors.background }]}>
            <Text style={[styles.exportMenuTitle, { color: colors.foreground }]}>
              {translate("exportTransactions")}
            </Text>
            <Text style={[styles.exportMenuSubtitle, { color: colors.muted }]}>
              {filteredTransactions.length} {translate("transactions").toLowerCase()}
            </Text>
            <Pressable
              onPress={exportAsPDF}
              style={({ pressed }) => [
                styles.exportOption,
                { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name="doc.text" size={22} color={colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportOptionTitle, { color: colors.foreground }]}>PDF</Text>
                <Text style={[styles.exportOptionDesc, { color: colors.muted }]}>
                  {translate("exportPdfDesc")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={exportAsCSV}
              style={({ pressed }) => [
                styles.exportOption,
                { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name="doc.text" size={22} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.exportOptionTitle, { color: colors.foreground }]}>CSV</Text>
                <Text style={[styles.exportOptionDesc, { color: colors.muted }]}>
                  {translate("exportCsvDesc")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setExportMenuVisible(false)}
              style={({ pressed }) => [
                styles.exportCancel,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.exportCancelText, { color: colors.muted }]}>
                {translate("cancel")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
  },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  exportBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  dateRangeBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 10,
  },
  dateRangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  dateRangeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 12,
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
  summaryBar: {
    flexDirection: "row",
    marginHorizontal: 20,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  exportMenu: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  exportMenuTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  exportMenuSubtitle: {
    fontSize: 13,
    marginBottom: 20,
  },
  exportOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  exportOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  exportCancel: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  exportCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
