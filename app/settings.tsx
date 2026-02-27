import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "@/hooks/use-auth";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { CURRENCIES, formatCurrency } from "@/lib/store";
import { Language } from "@/lib/i18n";

export default function SettingsScreen() {
  const { state, updateProfile, setLanguage, addCategory, deleteCategory, translate } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"income" | "expense">("expense");
  const [editingName, setEditingName] = useState(false);
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [currencySearch, setCurrencySearch] = useState("");
  const [nameInput, setNameInput] = useState(state.profile.name);
  const [businessInput, setBusinessInput] = useState(state.profile.businessName);

  const handleExport = () => {
    // Build CSV
    const headers = "Date,Type,Category,Amount,Description\n";
    const rows = state.transactions
      .map((tx) => {
        const cat = state.categories.find((c) => c.id === tx.categoryId);
        const catName = cat?.isCustom ? cat.nameKey : translate((cat?.nameKey || "") as any);
        const d = new Date(tx.date).toLocaleDateString();
        return `${d},${tx.type},${catName},${tx.amount},"${tx.description}"`;
      })
      .join("\n");
    const csv = headers + rows;
    Alert.alert(translate("success"), translate("dataExported"));
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    addCategory(newCatName.trim(), "tag.fill", newCatType);
    setNewCatName("");
    setShowCategoryModal(false);
  };

  const handleDeleteCategory = (id: string) => {
    Alert.alert(translate("confirm"), translate("deleteConfirm"), [
      { text: translate("cancel"), style: "cancel" },
      { text: translate("delete"), style: "destructive", onPress: () => deleteCategory(id) },
    ]);
  };

  const incomeCategories = state.categories.filter((c) => c.type === "income");
  const expenseCategories = state.categories.filter((c) => c.type === "expense");

  const SettingRow = ({
    icon,
    label,
    value,
    onPress,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { backgroundColor: colors.surface, opacity: pressed && onPress ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.primary + "15" }]}>
        <IconSymbol name={icon as any} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
      <View style={styles.settingRight}>
        {value && <Text style={[styles.settingValue, { color: colors.muted }]}>{value}</Text>}
        {onPress && <IconSymbol name="chevron.right" size={18} color={colors.muted} />}
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {translate("settings")}
          </Text>
        </View>

        {/* Profile Section */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>{translate("profile")}</Text>

        {editingName ? (
          <View style={[styles.editRow, { backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={translate("userName")}
              placeholderTextColor={colors.muted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                updateProfile({ name: nameInput });
                setEditingName(false);
              }}
            />
            <Pressable
              onPress={() => {
                updateProfile({ name: nameInput });
                setEditingName(false);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <IconSymbol name="checkmark" size={24} color={colors.primary} />
            </Pressable>
          </View>
        ) : (
          <SettingRow
            icon="person.fill"
            label={translate("userName")}
            value={state.profile.name || "—"}
            onPress={() => {
              setNameInput(state.profile.name);
              setEditingName(true);
            }}
          />
        )}

        {editingBusiness ? (
          <View style={[styles.editRow, { backgroundColor: colors.surface }]}>
            <TextInput
              style={[styles.editInput, { color: colors.foreground, borderColor: colors.border }]}
              value={businessInput}
              onChangeText={setBusinessInput}
              placeholder={translate("businessName")}
              placeholderTextColor={colors.muted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => {
                updateProfile({ businessName: businessInput });
                setEditingBusiness(false);
              }}
            />
            <Pressable
              onPress={() => {
                updateProfile({ businessName: businessInput });
                setEditingBusiness(false);
              }}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <IconSymbol name="checkmark" size={24} color={colors.primary} />
            </Pressable>
          </View>
        ) : (
          <SettingRow
            icon="building.2.fill"
            label={translate("businessName")}
            value={state.profile.businessName || "—"}
            onPress={() => {
              setBusinessInput(state.profile.businessName);
              setEditingBusiness(true);
            }}
          />
        )}

        {/* Preferences */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>{translate("settings")}</Text>

        <SettingRow
          icon="globe"
          label={translate("language")}
          value={state.language === "en" ? translate("english") : translate("french")}
          onPress={() => {
            const newLang: Language = state.language === "en" ? "fr" : "en";
            setLanguage(newLang);
          }}
        />

        <SettingRow
          icon="dollarsign.circle"
          label={translate("currency")}
          value={state.profile.currency}
          onPress={() => setShowCurrencyModal(true)}
        />

        <SettingRow
          icon="folder.fill"
          label={translate("manageCategories")}
          onPress={() => setShowCategoryModal(true)}
        />

        <SettingRow
          icon="doc.text"
          label={translate("exportData")}
          onPress={handleExport}
        />

        {/* Account & Subscription */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>{translate("subscription")}</Text>

        <SettingRow
          icon="creditcard.fill"
          label={translate("subscription")}
          value={translate("subscriptionPlans")}
          onPress={() => router.push("/subscription" as any)}
        />

        <SettingRow
          icon="building.2.fill"
          label={translate("companyGroup")}
          onPress={() => router.push("/company" as any)}
        />

        {isAuthenticated && (
          <SettingRow
            icon="rectangle.portrait.and.arrow.right"
            label={translate("logout")}
            onPress={() => {
              Alert.alert(translate("confirm"), translate("logoutConfirm"), [
                { text: translate("cancel"), style: "cancel" },
                {
                  text: translate("logout"),
                  style: "destructive",
                  onPress: async () => {
                    await logout();
                    router.replace("/login" as any);
                  },
                },
              ]);
            }}
          />
        )}

        {/* About */}
        <Text style={[styles.sectionTitle, { color: colors.muted }]}>{translate("about")}</Text>
        <SettingRow icon="info.circle" label={translate("version")} value="1.0.0" />
        <View style={[styles.aboutCard, { backgroundColor: colors.surface }]}>
          <Text style={[styles.aboutText, { color: colors.muted }]}>
            {translate("appDescription")}
          </Text>
        </View>
      </ScrollView>

      {/* Currency Modal */}
      <Modal visible={showCurrencyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{translate("currency")}</Text>
              <Pressable onPress={() => setShowCurrencyModal(false)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>
            <TextInput
              style={[styles.searchInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
              placeholder={translate("search") + "..."}
              placeholderTextColor={colors.muted}
              value={currencySearch}
              onChangeText={setCurrencySearch}
              returnKeyType="done"
            />
            <ScrollView>
              {(() => {
                const filtered = CURRENCIES.filter((cur) =>
                  !currencySearch || cur.code.toLowerCase().includes(currencySearch.toLowerCase()) || cur.name.toLowerCase().includes(currencySearch.toLowerCase()) || (cur.region && cur.region.toLowerCase().includes(currencySearch.toLowerCase()))
                );
                const regions = [...new Set(filtered.map((c) => c.region || "Other"))];
                return regions.map((region) => (
                  <View key={region}>
                    <Text style={[styles.regionHeader, { color: colors.muted }]}>{region}</Text>
                    {filtered.filter((c) => (c.region || "Other") === region).map((cur) => (
                      <Pressable
                        key={cur.code}
                        onPress={() => {
                          updateProfile({ currency: cur.code });
                          setShowCurrencyModal(false);
                          setCurrencySearch("");
                        }}
                        style={({ pressed }) => [
                          styles.currencyRow,
                          {
                            backgroundColor: state.profile.currency === cur.code ? colors.primary + "15" : "transparent",
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.currencyCode, { color: colors.foreground }]}>{cur.code}</Text>
                        <Text style={[styles.currencyName, { color: colors.muted }]}>{cur.name}</Text>
                        {state.profile.currency === cur.code && (
                          <IconSymbol name="checkmark" size={20} color={colors.primary} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                ));
              })()}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Category Management Modal */}
      <Modal visible={showCategoryModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: "85%" }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>{translate("manageCategories")}</Text>
              <Pressable onPress={() => setShowCategoryModal(false)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                <IconSymbol name="xmark" size={24} color={colors.foreground} />
              </Pressable>
            </View>

            <ScrollView>
              {/* Add New Category */}
              <View style={[styles.addCatSection, { borderColor: colors.border }]}>
                <View style={styles.addCatTypeRow}>
                  <Pressable
                    onPress={() => setNewCatType("income")}
                    style={({ pressed }) => [
                      styles.addCatTypeBtn,
                      {
                        backgroundColor: newCatType === "income" ? colors.success : colors.surface,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: newCatType === "income" ? "#FFF" : colors.muted, fontWeight: "600", fontSize: 13 }}>
                      {translate("income")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setNewCatType("expense")}
                    style={({ pressed }) => [
                      styles.addCatTypeBtn,
                      {
                        backgroundColor: newCatType === "expense" ? colors.error : colors.surface,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <Text style={{ color: newCatType === "expense" ? "#FFF" : colors.muted, fontWeight: "600", fontSize: 13 }}>
                      {translate("expense")}
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.addCatInputRow}>
                  <TextInput
                    style={[
                      styles.addCatInput,
                      { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                    placeholder={translate("categoryName")}
                    placeholderTextColor={colors.muted}
                    value={newCatName}
                    onChangeText={setNewCatName}
                    returnKeyType="done"
                    onSubmitEditing={handleAddCategory}
                  />
                  <Pressable
                    onPress={handleAddCategory}
                    style={({ pressed }) => [
                      styles.addCatBtn,
                      { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <IconSymbol name="plus.circle.fill" size={22} color="#FFF" />
                  </Pressable>
                </View>
              </View>

              {/* Income Categories */}
              <Text style={[styles.catSectionTitle, { color: colors.success }]}>
                {translate("incomeCategories")}
              </Text>
              {incomeCategories.map((cat) => (
                <View key={cat.id} style={[styles.catItem, { backgroundColor: colors.surface }]}>
                  <IconSymbol name={cat.icon as any} size={20} color={colors.success} />
                  <Text style={[styles.catItemName, { color: colors.foreground }]}>
                    {cat.isCustom ? cat.nameKey : translate(cat.nameKey as any)}
                  </Text>
                  {cat.isCustom && (
                    <Pressable
                      onPress={() => handleDeleteCategory(cat.id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                    >
                      <IconSymbol name="trash.fill" size={18} color={colors.error} />
                    </Pressable>
                  )}
                </View>
              ))}

              {/* Expense Categories */}
              <Text style={[styles.catSectionTitle, { color: colors.error }]}>
                {translate("expenseCategories")}
              </Text>
              {expenseCategories.map((cat) => (
                <View key={cat.id} style={[styles.catItem, { backgroundColor: colors.surface }]}>
                  <IconSymbol name={cat.icon as any} size={20} color={colors.error} />
                  <Text style={[styles.catItemName, { color: colors.foreground }]}>
                    {cat.isCustom ? cat.nameKey : translate(cat.nameKey as any)}
                  </Text>
                  {cat.isCustom && (
                    <Pressable
                      onPress={() => handleDeleteCategory(cat.id)}
                      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                    >
                      <IconSymbol name="trash.fill" size={18} color={colors.error} />
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderRadius: 14,
    marginBottom: 4,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 12,
  },
  settingRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  settingValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderRadius: 14,
    marginBottom: 4,
    gap: 12,
  },
  editInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  aboutCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    marginTop: 4,
  },
  aboutText: {
    fontSize: 14,
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  searchInput: {
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  regionHeader: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase" as any,
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  currencyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: "700",
    width: 50,
  },
  currencyName: {
    flex: 1,
    fontSize: 14,
  },
  // Category management
  addCatSection: {
    padding: 16,
    marginHorizontal: 20,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  addCatTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  addCatTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  addCatInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  addCatInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  addCatBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  catSectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  catItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 4,
    gap: 12,
  },
  catItemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "500",
  },
});
