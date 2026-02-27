import { useState, useMemo } from "react";
import {
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { TransactionType, Transaction, generateId } from "@/lib/store";

export default function AddTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string; editId?: string }>();
  const { state, addTransaction, updateTransaction, addCategory, translate } = useApp();
  const colors = useColors();

  // Find existing transaction if editing
  const existingTx = params.editId
    ? state.transactions.find((tx) => tx.id === params.editId)
    : null;

  const [txType, setTxType] = useState<TransactionType>(
    (existingTx?.type || params.type || "expense") as TransactionType
  );
  const [amount, setAmount] = useState(existingTx ? String(existingTx.amount) : "");
  const [selectedCategory, setSelectedCategory] = useState(existingTx?.categoryId || "");
  const [description, setDescription] = useState(existingTx?.description || "");
  const [date, setDate] = useState(
    existingTx ? existingTx.date.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState("");

  const filteredCategories = useMemo(
    () => state.categories.filter((c) => c.type === txType),
    [state.categories, txType]
  );

  const isValid = amount && parseFloat(amount) > 0 && selectedCategory;

  const handleSave = () => {
    if (!isValid) return;
    const parsedAmount = parseFloat(amount);

    if (existingTx) {
      updateTransaction({
        ...existingTx,
        type: txType,
        amount: parsedAmount,
        categoryId: selectedCategory,
        description,
        date: new Date(date).toISOString(),
      });
    } else {
      addTransaction(txType, parsedAmount, selectedCategory, description, new Date(date).toISOString());
    }
    router.back();
  };

  const getCategoryDisplayName = (cat: { nameKey: string; isCustom: boolean }) => {
    if (cat.isCustom) return cat.nameKey;
    return translate(cat.nameKey as any);
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {existingTx ? translate("editTransaction") : translate("addTransaction")}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Type Toggle */}
          <View style={[styles.typeToggle, { backgroundColor: colors.surface }]}>
            <Pressable
              onPress={() => { setTxType("income"); setSelectedCategory(""); }}
              style={({ pressed }) => [
                styles.typeBtn,
                txType === "income" && { backgroundColor: colors.success },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  { color: txType === "income" ? "#FFF" : colors.muted },
                ]}
              >
                {translate("income")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => { setTxType("expense"); setSelectedCategory(""); }}
              style={({ pressed }) => [
                styles.typeBtn,
                txType === "expense" && { backgroundColor: colors.error },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  { color: txType === "expense" ? "#FFF" : colors.muted },
                ]}
              >
                {translate("expense")}
              </Text>
            </Pressable>
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.muted }]}>{translate("amount")}</Text>
            <TextInput
              style={[
                styles.amountInput,
                {
                  color: txType === "income" ? colors.success : colors.error,
                  borderColor: colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              placeholder="0"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={amount}
              onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ""))}
              returnKeyType="done"
            />
          </View>

          {/* Category Grid */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.muted }]}>{translate("selectCategory")}</Text>
            <View style={styles.categoryGrid}>
              {filteredCategories.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => { setSelectedCategory(cat.id); setShowCustomCategory(false); }}
                  style={({ pressed }) => [
                    styles.categoryItem,
                    {
                      backgroundColor:
                        selectedCategory === cat.id ? colors.primary + "20" : colors.surface,
                      borderColor:
                        selectedCategory === cat.id ? colors.primary : colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <IconSymbol
                    name={cat.icon as any}
                    size={22}
                    color={selectedCategory === cat.id ? colors.primary : colors.muted}
                  />
                  <Text
                    style={[
                      styles.categoryText,
                      {
                        color: selectedCategory === cat.id ? colors.primary : colors.foreground,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {getCategoryDisplayName(cat)}
                  </Text>
                </Pressable>
              ))}
              {/* Add Custom Category Button */}
              <Pressable
                onPress={() => setShowCustomCategory(!showCustomCategory)}
                style={({ pressed }) => [
                  styles.categoryItem,
                  {
                    backgroundColor: showCustomCategory ? colors.primary + "20" : colors.surface,
                    borderColor: showCustomCategory ? colors.primary : colors.border,
                    borderStyle: "dashed" as any,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <IconSymbol
                  name={"plus.circle.fill" as any}
                  size={22}
                  color={showCustomCategory ? colors.primary : colors.muted}
                />
                <Text
                  style={[
                    styles.categoryText,
                    { color: showCustomCategory ? colors.primary : colors.muted },
                  ]}
                  numberOfLines={1}
                >
                  {translate("addCategory")}
                </Text>
              </Pressable>
            </View>
            {/* Custom Category Input */}
            {showCustomCategory && (
              <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                <TextInput
                  style={[
                    styles.descInput,
                    { flex: 1, color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                  placeholder={translate("categoryName")}
                  placeholderTextColor={colors.muted}
                  value={customCategoryName}
                  onChangeText={setCustomCategoryName}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (customCategoryName.trim()) {
                      const newId = generateId();
                      addCategory(customCategoryName.trim(), "ellipsis", txType);
                      // Find the newly added category and select it
                      setTimeout(() => {
                        const newCat = state.categories.find((c) => c.nameKey === customCategoryName.trim() && c.isCustom);
                        if (newCat) setSelectedCategory(newCat.id);
                      }, 100);
                      setCustomCategoryName("");
                      setShowCustomCategory(false);
                    }
                  }}
                />
                <Pressable
                  onPress={() => {
                    if (customCategoryName.trim()) {
                      addCategory(customCategoryName.trim(), "ellipsis", txType);
                      setTimeout(() => {
                        const newCat = state.categories.find((c) => c.nameKey === customCategoryName.trim() && c.isCustom);
                        if (newCat) setSelectedCategory(newCat.id);
                      }, 100);
                      setCustomCategoryName("");
                      setShowCustomCategory(false);
                    }
                  }}
                  style={({ pressed }) => [{
                    backgroundColor: customCategoryName.trim() ? colors.primary : colors.muted,
                    borderRadius: 14,
                    paddingHorizontal: 20,
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  <Text style={{ color: "#FFF", fontWeight: "600", fontSize: 14 }}>{translate("save")}</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.muted }]}>{translate("description")}</Text>
            <TextInput
              style={[
                styles.descInput,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface },
              ]}
              placeholder={translate("enterDescription")}
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              returnKeyType="done"
            />
          </View>

          {/* Date */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.muted }]}>{translate("date")}</Text>
            <TextInput
              style={[
                styles.descInput,
                { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface },
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              value={date}
              onChangeText={setDate}
              returnKeyType="done"
            />
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={!isValid}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: isValid ? colors.primary : colors.muted,
                opacity: pressed && isValid ? 0.9 : 1,
                transform: [{ scale: pressed && isValid ? 0.97 : 1 }],
              },
            ]}
          >
            <Text style={styles.saveBtnText}>{translate("save")}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  typeToggle: {
    flexDirection: "row",
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 11,
    alignItems: "center",
  },
  typeBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },
  section: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: "800",
    textAlign: "center",
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryItem: {
    width: "30%",
    flexGrow: 1,
    minWidth: 100,
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  descInput: {
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  saveBtn: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 12,
  },
  saveBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
