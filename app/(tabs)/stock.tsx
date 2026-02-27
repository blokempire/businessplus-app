import { useState, useMemo } from "react";
import { Text, View, FlatList, TouchableOpacity, TextInput, Alert, Modal, Pressable, Platform, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency, Product } from "@/lib/store";
import { ExportPreview } from "@/components/export-preview";

export default function StockScreen() {
  const { state, translate, deleteProduct } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [exportMenuVisible, setExportMenuVisible] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return state.products;
    const q = searchQuery.toLowerCase();
    return state.products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
    );
  }, [state.products, searchQuery]);

  const totalValue = useMemo(() => {
    return state.products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  }, [state.products]);

  const totalItems = state.products.length;

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: translate("outOfStock"), color: colors.error };
    if (qty <= 5) return { label: translate("lowStock"), color: colors.warning };
    return { label: translate("inStock"), color: colors.success };
  };

  const handleDelete = (product: Product) => {
    Alert.alert(translate("deleteProduct"), translate("deleteProductConfirm"), [
      { text: translate("cancel"), style: "cancel" },
      { text: translate("delete"), style: "destructive", onPress: () => deleteProduct(product.id) },
    ]);
  };

  const getStockStatusText = (qty: number) => {
    if (qty === 0) return "Out of Stock";
    if (qty <= 5) return "Low Stock";
    return "In Stock";
  };

  const generateCSVHtml = () => {
    const rows = filteredProducts
      .map(
        (p, i) =>
          `<tr><td>${i + 1}</td><td>${p.name}</td><td>${formatCurrency(p.price, state.profile.currency)}</td><td>${p.quantity}</td><td>${p.unit}</td><td>${formatCurrency(p.price * p.quantity, state.profile.currency)}</td><td>${getStockStatusText(p.quantity)}</td></tr>`
      )
      .join("");
    return `<html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:20px}h2{color:#0D9488}table{width:100%;border-collapse:collapse}th{background:#0D9488;color:#fff;padding:8px;text-align:left;font-size:12px}td{padding:8px;border-bottom:1px solid #eee;font-size:12px}tr:nth-child(even){background:#f9f9f9}.summary{margin:16px 0;font-size:14px}</style></head><body><h2>${state.profile.businessName || "Business+"}</h2><p>${translate("inventoryReport")} — ${filteredProducts.length} ${translate("products").toLowerCase()}</p><p class="summary">${translate("totalProducts")}: ${totalItems} | ${translate("stockValue")}: ${formatCurrency(totalValue, state.profile.currency)}</p><table><tr><th>#</th><th>${translate("productName")}</th><th>${translate("productPrice")}</th><th>${translate("stock")}</th><th>Unit</th><th>${translate("stockValue")}</th><th>Status</th></tr>${rows}</table></body></html>`;
  };

  const exportAsCSV = () => {
    setExportMenuVisible(false);
    if (filteredProducts.length === 0) {
      Alert.alert(translate("noDataToExport"));
      return;
    }
    setPreviewTitle(`${translate("stock")} (CSV)`);
    setPreviewHtml(generateCSVHtml());
    setPreviewVisible(true);
  };

  const generatePDFHtml = () => {
    const businessName = state.profile.businessName || "Business+";
    const outOfStock = filteredProducts.filter((p) => p.quantity === 0).length;
    const lowStock = filteredProducts.filter((p) => p.quantity > 0 && p.quantity <= 5).length;
    const inStock = filteredProducts.filter((p) => p.quantity > 5).length;
    return `
      <html><head><meta charset="utf-8" /><style>
        body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 30px; color: #333; }
        h1 { color: #0D9488; margin-bottom: 4px; }
        .subtitle { color: #666; margin-bottom: 20px; }
        .summary { display: flex; gap: 12px; margin-bottom: 24px; }
        .summary-box { flex: 1; padding: 14px; border-radius: 10px; text-align: center; }
        .total-box { background: #F0FDFA; } .value-box { background: #F0F9FF; }
        .instock-box { background: #ECFDF5; } .low-box { background: #FFFBEB; } .out-box { background: #FEF2F2; }
        .summary-label { font-size: 11px; color: #666; }
        .summary-value { font-size: 18px; font-weight: bold; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th { background: #0D9488; color: white; padding: 10px; text-align: left; font-size: 12px; }
        td { padding: 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
        tr:nth-child(even) { background: #F9FAFB; }
        .in-stock { color: #16A34A; font-weight: bold; } .low-stock { color: #D97706; font-weight: bold; } .out-of-stock { color: #DC2626; font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 10px; }
      </style></head><body>
        <h1>${businessName}</h1>
        <div class="subtitle">${translate("inventoryReport")} — ${filteredProducts.length} ${translate("products").toLowerCase()}</div>
        <div class="summary">
          <div class="summary-box total-box"><div class="summary-label">${translate("totalProducts")}</div><div class="summary-value">${totalItems}</div></div>
          <div class="summary-box value-box"><div class="summary-label">${translate("stockValue")}</div><div class="summary-value" style="color:#0D9488">${formatCurrency(totalValue, state.profile.currency)}</div></div>
          <div class="summary-box instock-box"><div class="summary-label">${translate("inStock")}</div><div class="summary-value" style="color:#16A34A">${inStock}</div></div>
          <div class="summary-box low-box"><div class="summary-label">${translate("lowStock")}</div><div class="summary-value" style="color:#D97706">${lowStock}</div></div>
          <div class="summary-box out-box"><div class="summary-label">${translate("outOfStock")}</div><div class="summary-value" style="color:#DC2626">${outOfStock}</div></div>
        </div>
        <table>
          <tr><th>#</th><th>${translate("productName")}</th><th>${translate("productPrice")}</th><th>${translate("stock")}</th><th>${translate("products")}</th><th>${translate("stockValue")}</th><th>Status</th></tr>
          ${filteredProducts.map((p, i) => {
            const statusClass = p.quantity === 0 ? "out-of-stock" : p.quantity <= 5 ? "low-stock" : "in-stock";
            return `<tr><td>${i + 1}</td><td>${p.name}</td><td>${formatCurrency(p.price, state.profile.currency)}</td><td>${p.quantity}</td><td>${p.unit}</td><td>${formatCurrency(p.price * p.quantity, state.profile.currency)}</td><td class="${statusClass}">${getStockStatusText(p.quantity)}</td></tr>`;
          }).join("")}
        </table>
        <div class="footer">${businessName} · ${new Date().toLocaleDateString()}</div>
      </body></html>`;
  };

  const exportAsPDF = () => {
    setExportMenuVisible(false);
    if (filteredProducts.length === 0) {
      Alert.alert(translate("noDataToExport"));
      return;
    }
    setPreviewTitle(`${translate("stock")} (PDF)`);
    setPreviewHtml(generatePDFHtml());
    setPreviewVisible(true);
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const status = getStockStatus(item.quantity);
    return (
      <TouchableOpacity
        style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center" }}
        onPress={() => router.push({ pathname: "/add-product", params: { editId: item.id } } as any)}
        onLongPress={() => handleDelete(item)}
      >
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={{ width: 50, height: 50, borderRadius: 8, marginRight: 12 }} />
        ) : (
          <View style={{ width: 50, height: 50, borderRadius: 8, marginRight: 12, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}>
            <IconSymbol name="shippingbox.fill" size={24} color={colors.muted} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>{item.name}</Text>
          <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>
            {formatCurrency(item.price, state.profile.currency)} / {item.unit}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 16, fontWeight: "700", color: colors.foreground }}>
            {item.quantity} {item.unit}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: status.color, marginRight: 4 }} />
            <Text style={{ fontSize: 11, color: status.color, fontWeight: "500" }}>{status.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer className="px-4 pt-4">
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.foreground }}>{translate("stock")}</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            onPress={() => setExportMenuVisible(true)}
            style={({ pressed }) => ({
              backgroundColor: colors.primary + "15",
              borderRadius: 20,
              paddingHorizontal: 12,
              paddingVertical: 8,
              flexDirection: "row",
              alignItems: "center",
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <IconSymbol name="square.and.arrow.up" size={16} color={colors.primary} />
          </Pressable>
          <TouchableOpacity
            style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}
            onPress={() => router.push("/add-product" as any)}
          >
            <IconSymbol name="plus" size={18} color={colors.background} />
            <Text style={{ color: colors.background, fontWeight: "600", marginLeft: 4, fontSize: 14 }}>{translate("addProduct")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>{translate("totalProducts")}</Text>
          <Text style={{ fontSize: 22, fontWeight: "700", color: colors.foreground, marginTop: 4 }}>{totalItems}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: colors.surface, borderRadius: 12, padding: 14 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>{translate("stockValue")}</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.primary, marginTop: 4 }}>
            {formatCurrency(totalValue, state.profile.currency)}
          </Text>
        </View>
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

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProduct}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60 }}>
            <IconSymbol name="shippingbox.fill" size={48} color={colors.muted} />
            <Text style={{ fontSize: 16, color: colors.muted, marginTop: 12 }}>{translate("noProducts")}</Text>
          </View>
        }
      />

      {/* Export Preview */}
      <ExportPreview
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
        html={previewHtml}
        title={previewTitle}
        fileName={`inventory_${new Date().toISOString().split("T")[0]}.pdf`}
        shareLabel={translate("sharePDF")}
        printLabel={translate("printInvoice")}
      />

      {/* Export Menu Modal */}
      <Modal visible={exportMenuVisible} transparent animationType="fade">
        <Pressable style={s.modalOverlay} onPress={() => setExportMenuVisible(false)}>
          <View style={[s.exportMenu, { backgroundColor: colors.background }]}>
            <Text style={[s.exportMenuTitle, { color: colors.foreground }]}>
              {translate("exportStock")}
            </Text>
            <Text style={[s.exportMenuSubtitle, { color: colors.muted }]}>
              {filteredProducts.length} {translate("products").toLowerCase()}
            </Text>
            <Pressable
              onPress={exportAsPDF}
              style={({ pressed }) => [
                s.exportOption,
                { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name="doc.text" size={22} color={colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={[s.exportOptionTitle, { color: colors.foreground }]}>PDF</Text>
                <Text style={[s.exportOptionDesc, { color: colors.muted }]}>
                  {translate("exportPdfDesc")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={exportAsCSV}
              style={({ pressed }) => [
                s.exportOption,
                { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <IconSymbol name="doc.text" size={22} color={colors.success} />
              <View style={{ flex: 1 }}>
                <Text style={[s.exportOptionTitle, { color: colors.foreground }]}>CSV</Text>
                <Text style={[s.exportOptionDesc, { color: colors.muted }]}>
                  {translate("exportCsvDesc")}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => setExportMenuVisible(false)}
              style={({ pressed }) => [s.exportCancel, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text style={[s.exportCancelText, { color: colors.muted }]}>
                {translate("cancel")}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
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
