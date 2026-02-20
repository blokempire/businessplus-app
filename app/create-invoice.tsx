import { useState } from "react";
import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency, InvoiceItem, Contact, Product } from "@/lib/store";

export default function CreateInvoiceScreen() {
  const { state, translate, addInvoice } = useApp();
  const colors = useColors();
  const router = useRouter();

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [tax, setTax] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = parseFloat(tax) || 0;
  const total = subtotal + taxAmount;

  const filteredContacts = state.contacts.filter((c) =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase())
  );

  const filteredProducts = state.products.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const addItemFromProduct = (product: Product) => {
    const existing = items.find((i) => i.productId === product.id);
    if (existing) {
      setItems(
        items.map((i) =>
          i.productId === product.id
            ? { ...i, quantity: i.quantity + 1, total: (i.quantity + 1) * i.unitPrice }
            : i
        )
      );
    } else {
      setItems([
        ...items,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.price,
          total: product.price,
        },
      ]);
    }
    setShowProductPicker(false);
    setProductSearch("");
  };

  const updateItemQty = (productId: string, delta: number) => {
    setItems(
      items
        .map((i) => {
          if (i.productId !== productId) return i;
          const newQty = Math.max(0, i.quantity + delta);
          return { ...i, quantity: newQty, total: newQty * i.unitPrice };
        })
        .filter((i) => i.quantity > 0)
    );
  };

  const handleCreate = () => {
    if (!selectedContact) {
      Alert.alert(translate("error"), translate("selectContact"));
      return;
    }
    if (items.length === 0) {
      Alert.alert(translate("error"), translate("addItem"));
      return;
    }

    addInvoice(
      selectedContact.id,
      selectedContact.name,
      items,
      taxAmount,
      note.trim(),
      dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      []
    );

    Alert.alert(translate("success"), translate("invoiceCreated"), [
      { text: translate("ok"), onPress: () => router.back() },
    ]);
  };

  // Contact Picker Modal
  if (showContactPicker) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-4">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <TouchableOpacity onPress={() => setShowContactPicker(false)}>
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>{translate("selectContact")}</Text>
          <View style={{ width: 24 }} />
        </View>
        <TextInput
          style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.foreground, marginBottom: 12 }}
          placeholder={translate("search")}
          placeholderTextColor={colors.muted}
          value={contactSearch}
          onChangeText={setContactSearch}
        />
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 8 }}
              onPress={() => {
                setSelectedContact(item);
                setShowContactPicker(false);
                setContactSearch("");
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "500", color: colors.foreground }}>{item.name}</Text>
              {item.phone ? <Text style={{ fontSize: 13, color: colors.muted }}>{item.phone}</Text> : null}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: colors.muted, marginTop: 40 }}>{translate("noContacts")}</Text>
          }
        />
      </ScreenContainer>
    );
  }

  // Product Picker Modal
  if (showProductPicker) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-4">
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <TouchableOpacity onPress={() => setShowProductPicker(false)}>
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>{translate("selectProduct")}</Text>
          <View style={{ width: 24 }} />
        </View>
        <TextInput
          style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 15, color: colors.foreground, marginBottom: 12 }}
          placeholder={translate("search")}
          placeholderTextColor={colors.muted}
          value={productSearch}
          onChangeText={setProductSearch}
        />
        <FlatList
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}
              onPress={() => addItemFromProduct(item)}
            >
              <View>
                <Text style={{ fontSize: 16, fontWeight: "500", color: colors.foreground }}>{item.name}</Text>
                <Text style={{ fontSize: 13, color: colors.muted }}>
                  {translate("inStock")}: {item.quantity} {item.unit}
                </Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>
                {formatCurrency(item.price, state.profile.currency)}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={{ textAlign: "center", color: colors.muted, marginTop: 40 }}>{translate("noProducts")}</Text>
          }
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-4">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>{translate("createInvoice")}</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Contact Selection */}
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 6 }}>{translate("selectContact")}</Text>
        <TouchableOpacity
          onPress={() => setShowContactPicker(true)}
          style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 14, marginBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
        >
          <Text style={{ fontSize: 15, color: selectedContact ? colors.foreground : colors.muted }}>
            {selectedContact ? selectedContact.name : translate("selectContact")}
          </Text>
          <IconSymbol name="chevron.right" size={16} color={colors.muted} />
        </TouchableOpacity>

        {/* Items */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{translate("products")}</Text>
          <TouchableOpacity
            onPress={() => setShowProductPicker(true)}
            style={{ flexDirection: "row", alignItems: "center" }}
          >
            <IconSymbol name="plus.circle.fill" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "500", marginLeft: 4, fontSize: 14 }}>{translate("addItem")}</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 20, alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: colors.muted }}>{translate("noProducts")}</Text>
          </View>
        ) : (
          <View style={{ marginBottom: 16 }}>
            {items.map((item) => (
              <View
                key={item.productId}
                style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center" }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground }}>{item.productName}</Text>
                  <Text style={{ fontSize: 12, color: colors.muted }}>
                    {formatCurrency(item.unitPrice, state.profile.currency)} x {item.quantity}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => updateItemQty(item.productId, -1)}
                    style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.border, alignItems: "center", justifyContent: "center" }}
                  >
                    <IconSymbol name="minus" size={16} color={colors.foreground} />
                  </TouchableOpacity>
                  <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground, minWidth: 24, textAlign: "center" }}>
                    {item.quantity}
                  </Text>
                  <TouchableOpacity
                    onPress={() => updateItemQty(item.productId, 1)}
                    style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}
                  >
                    <IconSymbol name="plus" size={16} color={colors.background} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground, marginLeft: 12, minWidth: 70, textAlign: "right" }}>
                  {formatCurrency(item.total, state.profile.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Tax */}
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 6 }}>{translate("taxAmount")}</Text>
        <TextInput
          style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 14, fontSize: 16, color: colors.foreground, marginBottom: 16 }}
          placeholder="0"
          placeholderTextColor={colors.muted}
          value={tax}
          onChangeText={setTax}
          keyboardType="numeric"
        />

        {/* Note */}
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 6 }}>{translate("invoiceNote")}</Text>
        <TextInput
          style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 14, fontSize: 16, color: colors.foreground, marginBottom: 16, minHeight: 60 }}
          placeholder={translate("enterDescription")}
          placeholderTextColor={colors.muted}
          value={note}
          onChangeText={setNote}
          multiline
        />

        {/* Totals */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: colors.muted }}>{translate("subtotal")}</Text>
            <Text style={{ fontSize: 14, color: colors.foreground }}>{formatCurrency(subtotal, state.profile.currency)}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
            <Text style={{ fontSize: 14, color: colors.muted }}>{translate("taxAmount")}</Text>
            <Text style={{ fontSize: 14, color: colors.foreground }}>{formatCurrency(taxAmount, state.profile.currency)}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>{translate("invoiceTotal")}</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.primary }}>{formatCurrency(total, state.profile.currency)}</Text>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          onPress={handleCreate}
          style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 40 }}
        >
          <Text style={{ color: colors.background, fontSize: 16, fontWeight: "600" }}>{translate("createInvoice")}</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
