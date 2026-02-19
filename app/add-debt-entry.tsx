import { useState, useMemo } from "react";
import {
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { DebtType } from "@/lib/store";
import * as Haptics from "expo-haptics";

export default function AddDebtEntryScreen() {
  const { contactId, type: initialType } = useLocalSearchParams<{
    contactId: string;
    type: string;
  }>();
  const { state, translate, addDebtEntry } = useApp();
  const colors = useColors();
  const router = useRouter();

  const contact = useMemo(
    () => state.contacts.find((c) => c.id === contactId),
    [state.contacts, contactId]
  );

  const [debtType, setDebtType] = useState<DebtType>(
    (initialType as DebtType) || "theyOweMe"
  );
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSave = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0 || !contactId) return;

    addDebtEntry(contactId, debtType, numAmount, description.trim(), new Date(date).toISOString());

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    router.back();
  };

  const isValid = parseFloat(amount) > 0;

  if (!contact) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6">
        <Text style={{ color: colors.foreground, fontSize: 18 }}>Contact not found</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={[styles.cancelText, { color: colors.muted }]}>{translate("cancel")}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {debtType === "theyOweMe" ? translate("addDebt") : translate("addCredit")}
        </Text>
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.7}
          disabled={!isValid}
        >
          <Text
            style={[
              styles.saveText,
              { color: isValid ? colors.primary : colors.muted },
            ]}
          >
            {translate("save")}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Contact Badge */}
        <View style={styles.contactBadge}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {contact.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.contactName, { color: colors.foreground }]}>{contact.name}</Text>
        </View>

        {/* Type Selector */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>{translate("type")}</Text>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                {
                  backgroundColor: debtType === "theyOweMe" ? colors.success + "20" : colors.surface,
                  borderColor: debtType === "theyOweMe" ? colors.success : colors.border,
                },
              ]}
              activeOpacity={0.7}
              onPress={() => setDebtType("theyOweMe")}
            >
              <IconSymbol
                name="arrow.down.circle.fill"
                size={20}
                color={debtType === "theyOweMe" ? colors.success : colors.muted}
              />
              <Text
                style={[
                  styles.typeText,
                  { color: debtType === "theyOweMe" ? colors.success : colors.muted },
                ]}
              >
                {translate("theyOweMe")}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                {
                  backgroundColor: debtType === "iOweThem" ? colors.error + "20" : colors.surface,
                  borderColor: debtType === "iOweThem" ? colors.error : colors.border,
                },
              ]}
              activeOpacity={0.7}
              onPress={() => setDebtType("iOweThem")}
            >
              <IconSymbol
                name="arrow.up.circle.fill"
                size={20}
                color={debtType === "iOweThem" ? colors.error : colors.muted}
              />
              <Text
                style={[
                  styles.typeText,
                  { color: debtType === "iOweThem" ? colors.error : colors.muted },
                ]}
              >
                {translate("iOweThem")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Amount */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {translate("amount")} ({state.profile.currency})
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.amountInput,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: debtType === "theyOweMe" ? colors.success : colors.error,
              },
            ]}
            placeholder="0"
            placeholderTextColor={colors.muted}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            returnKeyType="done"
          />
        </View>

        {/* Description */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {translate("description")}
          </Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder={translate("description")}
            placeholderTextColor={colors.muted}
            value={description}
            onChangeText={setDescription}
            returnKeyType="done"
          />
        </View>

        {/* Date */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.foreground }]}>{translate("date")}</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground },
            ]}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            value={date}
            onChangeText={setDate}
            returnKeyType="done"
          />
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: debtType === "theyOweMe" ? colors.success : colors.error,
              opacity: isValid ? 1 : 0.5,
            },
          ]}
          activeOpacity={0.7}
          onPress={handleSave}
          disabled={!isValid}
        >
          <Text style={styles.saveButtonText}>{translate("save")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  cancelText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  saveText: {
    fontSize: 16,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  contactBadge: {
    alignItems: "center",
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
  },
  contactName: {
    fontSize: 18,
    fontWeight: "600",
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: "row",
    gap: 12,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  typeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    borderWidth: 1,
  },
  amountInput: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    height: 64,
  },
  saveButton: {
    borderRadius: 12,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
