import { Text, View, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency } from "@/lib/store";

export default function TransactionDetailScreen() {
  const { state, translate } = useApp();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ txId: string }>();

  const tx = state.transactions.find((t) => t.id === params.txId);
  if (!tx) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-4">
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>Transaction not found</Text>
      </ScreenContainer>
    );
  }

  const category = state.categories.find((c) => c.id === tx.categoryId);
  const categoryName = category ? (translate(category.nameKey as any) || category.nameKey) : tx.categoryId;
  const isIncome = tx.type === "income";
  const currency = state.profile.currency;

  const generateHTML = () => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #333; max-width: 600px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; }
    .amount { font-size: 36px; font-weight: 700; color: ${isIncome ? "#22C55E" : "#EF4444"}; }
    .type { font-size: 14px; color: #666; text-transform: uppercase; margin-top: 4px; }
    .details { background: #f8f9fa; border-radius: 12px; padding: 20px; }
    .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .row:last-child { border-bottom: none; }
    .label { color: #999; font-size: 13px; }
    .value { font-weight: 500; }
    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <div class="type">${isIncome ? translate("income") : translate("expense")}</div>
    <div class="amount">${isIncome ? "+" : "-"}${formatCurrency(tx.amount, currency)}</div>
  </div>
  <div class="details">
    <div class="row">
      <span class="label">${translate("category")}</span>
      <span class="value">${categoryName}</span>
    </div>
    <div class="row">
      <span class="label">${translate("description")}</span>
      <span class="value">${tx.description || "-"}</span>
    </div>
    <div class="row">
      <span class="label">${translate("date")}</span>
      <span class="value">${new Date(tx.date).toLocaleDateString()}</span>
    </div>
    <div class="row">
      <span class="label">${translate("type")}</span>
      <span class="value">${isIncome ? translate("income") : translate("expense")}</span>
    </div>
  </div>
  <div class="footer">
    <p>${state.profile.businessName || "Business+"}</p>
  </div>
</body>
</html>`;

  const handleSharePDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: generateHTML() });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Transaction.pdf" });
    } catch (e) {
      console.error("Share error:", e);
    }
  };

  const handlePrint = async () => {
    try {
      await Print.printAsync({ html: generateHTML() });
    } catch (e) {
      console.error("Print error:", e);
    }
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.right" size={24} color={colors.foreground} style={{ transform: [{ rotate: "180deg" }] }} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>{translate("transactionDetail")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Amount */}
        <View style={{ alignItems: "center", marginBottom: 30 }}>
          <Text style={{ fontSize: 14, color: colors.muted, marginBottom: 4 }}>
            {isIncome ? translate("income") : translate("expense")}
          </Text>
          <Text style={{ fontSize: 36, fontWeight: "700", color: isIncome ? colors.success : colors.error }}>
            {isIncome ? "+" : "-"}{formatCurrency(tx.amount, currency)}
          </Text>
        </View>

        {/* Details Card */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, color: colors.muted }}>{translate("category")}</Text>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }}>{categoryName}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, color: colors.muted }}>{translate("description")}</Text>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }}>{tx.description || "-"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 14, color: colors.muted }}>{translate("date")}</Text>
            <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }}>{new Date(tx.date).toLocaleDateString()}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, color: colors.muted }}>{translate("type")}</Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isIncome ? colors.success : colors.error, marginRight: 6 }} />
              <Text style={{ fontSize: 14, fontWeight: "500", color: colors.foreground }}>
                {isIncome ? translate("income") : translate("expense")}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={{ gap: 10, marginBottom: 40 }}>
          <TouchableOpacity
            onPress={handleSharePDF}
            style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color={colors.background} />
            <Text style={{ color: colors.background, fontWeight: "600", marginLeft: 8, fontSize: 15 }}>{translate("exportPDF")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePrint}
            style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
          >
            <IconSymbol name="printer.fill" size={20} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontWeight: "600", marginLeft: 8, fontSize: 15 }}>{translate("printInvoice")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
