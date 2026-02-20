import { useState, useMemo } from "react";
import { Text, View, FlatList, TouchableOpacity, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency, Invoice, InvoiceStatus } from "@/lib/store";

export default function InvoicesScreen() {
  const { state, translate } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInvoices = useMemo(() => {
    let list = state.invoices;
    if (filter !== "all") {
      list = list.filter((inv) => inv.status === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (inv) =>
          inv.contactName.toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q)
      );
    }
    return list;
  }, [state.invoices, filter, searchQuery]);

  const statusColor = (status: InvoiceStatus) => {
    switch (status) {
      case "paid": return colors.success;
      case "partial": return colors.warning;
      case "pending": return colors.error;
    }
  };

  const statusLabel = (status: InvoiceStatus) => {
    switch (status) {
      case "paid": return translate("paid");
      case "partial": return translate("partial");
      case "pending": return translate("pending");
    }
  };

  const filters: Array<{ key: "all" | InvoiceStatus; label: string }> = [
    { key: "all", label: translate("all") },
    { key: "pending", label: translate("pending") },
    { key: "partial", label: translate("partial") },
    { key: "paid", label: translate("paid") },
  ];

  const renderInvoice = ({ item }: { item: Invoice }) => {
    const sColor = statusColor(item.status);
    return (
      <TouchableOpacity
        style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10 }}
        onPress={() => router.push({ pathname: "/invoice-detail", params: { invoiceId: item.id } } as any)}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{item.invoiceNumber}</Text>
            <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{item.contactName}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
              {formatCurrency(item.total, state.profile.currency)}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: sColor, marginRight: 4 }} />
              <Text style={{ fontSize: 11, color: sColor, fontWeight: "500" }}>{statusLabel(item.status)}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            {item.items.length} {item.items.length === 1 ? "item" : "items"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="px-4 pt-4">
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>{translate("invoices")}</Text>
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}
          onPress={() => router.push("/create-invoice" as any)}
        >
          <IconSymbol name="plus" size={18} color={colors.background} />
          <Text style={{ color: colors.background, fontWeight: "600", marginLeft: 4, fontSize: 14 }}>{translate("createInvoice")}</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Bar */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 18,
              backgroundColor: filter === f.key ? colors.primary : colors.surface,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "500", color: filter === f.key ? colors.background : colors.foreground }}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={{ backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
        <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
        <TextInput
          style={{ flex: 1, marginLeft: 8, fontSize: 15, color: colors.foreground }}
          placeholder={translate("search")}
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Invoice List */}
      <FlatList
        data={filteredInvoices}
        keyExtractor={(item) => item.id}
        renderItem={renderInvoice}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <IconSymbol name="doc.text.fill" size={48} color={colors.muted} />
            <Text style={{ fontSize: 16, color: colors.muted, marginTop: 12 }}>{translate("noInvoices")}</Text>
          </View>
        }
      />
    </ScreenContainer>
  );
}
