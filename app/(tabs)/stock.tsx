import { useState, useMemo } from "react";
import { Text, View, FlatList, TouchableOpacity, TextInput, Alert } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency, Product } from "@/lib/store";

export default function StockScreen() {
  const { state, translate, deleteProduct } = useApp();
  const colors = useColors();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

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
        <TouchableOpacity
          style={{ backgroundColor: colors.primary, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, flexDirection: "row", alignItems: "center" }}
          onPress={() => router.push("/add-product" as any)}
        >
          <IconSymbol name="plus" size={18} color={colors.background} />
          <Text style={{ color: colors.background, fontWeight: "600", marginLeft: 4, fontSize: 14 }}>{translate("addProduct")}</Text>
        </TouchableOpacity>
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
    </ScreenContainer>
  );
}
