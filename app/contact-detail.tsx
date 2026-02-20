import { useMemo, useState } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  TextInput,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { calculateContactBalance, formatCurrency, DebtEntry } from "@/lib/store";
import * as SMS from "expo-sms";
import * as Haptics from "expo-haptics";

export default function ContactDetailScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const { state, translate, addDebtEntry, deleteDebtEntry, settleContact, deleteContact } = useApp();
  const colors = useColors();
  const router = useRouter();

  const [showReminderMenu, setShowReminderMenu] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");

  const contact = useMemo(
    () => state.contacts.find((c) => c.id === contactId),
    [state.contacts, contactId]
  );

  const entries = useMemo(
    () =>
      state.debtEntries
        .filter((e) => e.contactId === contactId)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [state.debtEntries, contactId]
  );

  const balance = useMemo(
    () => calculateContactBalance(state.debtEntries, contactId || ""),
    [state.debtEntries, contactId]
  );

  if (!contact) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6">
        <Text style={{ color: colors.foreground, fontSize: 18 }}>Contact not found</Text>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={{ color: colors.primary, marginTop: 16 }}>Go Back</Text>
        </TouchableOpacity>
      </ScreenContainer>
    );
  }

  const netBalance = balance.netBalance;
  const balanceColor = netBalance > 0 ? colors.success : netBalance < 0 ? colors.error : colors.muted;

  // Build reminder message
  const getReminderMessage = () => {
    const amount = formatCurrency(Math.abs(netBalance), state.profile.currency);
    return translate("reminderMessage")
      .replace("{name}", contact.name)
      .replace("{amount}", amount);
  };

  // SMS Reminder
  const handleSendSMS = async () => {
    setShowReminderMenu(false);
    if (!contact.phone) {
      Alert.alert(translate("error"), translate("noPhoneNumber"));
      return;
    }
    try {
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(translate("error"), translate("smsNotAvailable"));
        return;
      }
      await SMS.sendSMSAsync([contact.phone], getReminderMessage());
    } catch (error) {
      Alert.alert(translate("error"), translate("smsNotAvailable"));
    }
  };

  // WhatsApp Reminder
  const handleSendWhatsApp = async () => {
    setShowReminderMenu(false);
    if (!contact.phone) {
      Alert.alert(translate("error"), translate("noPhoneNumber"));
      return;
    }
    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = contact.phone.replace(/[^0-9+]/g, "");
    const message = encodeURIComponent(getReminderMessage());
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${message}`;
    try {
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert(translate("error"), translate("whatsAppNotAvailable"));
      }
    } catch {
      Alert.alert(translate("error"), translate("whatsAppNotAvailable"));
    }
  };

  // Payment handler
  const handleRecordPayment = () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) return;

    const absBalance = Math.abs(netBalance);
    if (amount > absBalance) {
      Alert.alert(translate("error"), translate("paymentExceedsDebt"));
      return;
    }

    // If they owe me (netBalance > 0), a payment means they paid me back → record as "iOweThem" (reduces what they owe)
    // If I owe them (netBalance < 0), a payment means I paid them → record as "theyOweMe" (reduces what I owe)
    const paymentType = netBalance > 0 ? "iOweThem" : "theyOweMe";
    const desc = paymentNote.trim() || (netBalance > 0 ? translate("paymentReceived") : translate("paymentMade"));

    addDebtEntry(contact.id, paymentType, amount, desc, new Date().toISOString());

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    Alert.alert(translate("success"), translate("paymentRecorded"));
    setPaymentAmount("");
    setPaymentNote("");
    setShowPaymentModal(false);
  };

  const handlePayFull = () => {
    setPaymentAmount(Math.abs(netBalance).toString());
  };

  const handleSettle = () => {
    Alert.alert(
      translate("settleAccount"),
      translate("settleConfirm"),
      [
        { text: translate("cancel"), style: "cancel" },
        {
          text: translate("confirm"),
          onPress: () => settleContact(contact.id),
        },
      ]
    );
  };

  const handleDeleteEntry = (entry: DebtEntry) => {
    Alert.alert(
      translate("delete"),
      translate("deleteConfirm"),
      [
        { text: translate("cancel"), style: "cancel" },
        {
          text: translate("delete"),
          style: "destructive",
          onPress: () => deleteDebtEntry(entry.id),
        },
      ]
    );
  };

  const handleDeleteContact = () => {
    Alert.alert(
      translate("deleteContact"),
      translate("deleteContactConfirm"),
      [
        { text: translate("cancel"), style: "cancel" },
        {
          text: translate("delete"),
          style: "destructive",
          onPress: () => {
            deleteContact(contact.id);
            router.back();
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(state.profile.language === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const renderEntry = ({ item }: { item: DebtEntry }) => {
    const isCredit = item.type === "theyOweMe";
    const entryColor = isCredit ? colors.success : colors.error;
    const sign = isCredit ? "+" : "-";
    const isPayment = item.description === translate("paymentReceived") || item.description === translate("paymentMade");

    return (
      <TouchableOpacity
        style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
        onLongPress={() => handleDeleteEntry(item)}
      >
        <View style={[styles.entryIcon, { backgroundColor: entryColor + "15" }]}>
          <IconSymbol
            name={isPayment ? "creditcard.fill" : isCredit ? "arrow.down.circle.fill" : "arrow.up.circle.fill"}
            size={22}
            color={entryColor}
          />
        </View>
        <View style={styles.entryInfo}>
          <Text style={[styles.entryDesc, { color: colors.foreground }]} numberOfLines={1}>
            {item.description || (isCredit ? translate("theyOweMe") : translate("iOweThem"))}
          </Text>
          <Text style={[styles.entryDate, { color: colors.muted }]}>{formatDate(item.date)}</Text>
        </View>
        <Text style={[styles.entryAmount, { color: entryColor }]}>
          {sign}{formatCurrency(item.amount, state.profile.currency)}
        </Text>
      </TouchableOpacity>
    );
  };

  const paymentIsValid = parseFloat(paymentAmount) > 0 && parseFloat(paymentAmount) <= Math.abs(netBalance);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backButton}>
          <IconSymbol name="chevron.right" size={22} color={colors.primary} style={{ transform: [{ scaleX: -1 }] }} />
          <Text style={[styles.backText, { color: colors.primary }]}>{translate("contacts")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDeleteContact} activeOpacity={0.7}>
          <IconSymbol name="trash.fill" size={22} color={colors.error} />
        </TouchableOpacity>
      </View>

      {/* Contact Info */}
      <View style={styles.contactHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {contact.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.contactName, { color: colors.foreground }]}>{contact.name}</Text>
        {contact.phone ? (
          <Text style={[styles.contactPhone, { color: colors.muted }]}>{contact.phone}</Text>
        ) : null}
        {contact.note ? (
          <Text style={[styles.contactNote, { color: colors.muted }]}>{contact.note}</Text>
        ) : null}
      </View>

      {/* Balance Card */}
      <View style={[styles.balanceCard, { backgroundColor: balanceColor + "10", borderColor: balanceColor + "30" }]}>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={[styles.balanceItemLabel, { color: colors.success }]}>
              {translate("theyOweMe")}
            </Text>
            <Text style={[styles.balanceItemAmount, { color: colors.success }]}>
              {formatCurrency(balance.theyOweMe, state.profile.currency)}
            </Text>
          </View>
          <View style={[styles.balanceDivider, { backgroundColor: colors.border }]} />
          <View style={styles.balanceItem}>
            <Text style={[styles.balanceItemLabel, { color: colors.error }]}>
              {translate("iOweThem")}
            </Text>
            <Text style={[styles.balanceItemAmount, { color: colors.error }]}>
              {formatCurrency(balance.iOweThem, state.profile.currency)}
            </Text>
          </View>
        </View>
        <View style={[styles.netRow, { borderTopColor: balanceColor + "30" }]}>
          <Text style={[styles.netLabel, { color: balanceColor }]}>{translate("netBalance")}</Text>
          <Text style={[styles.netAmount, { color: balanceColor }]}>
            {netBalance >= 0 ? "+" : "-"}{formatCurrency(Math.abs(netBalance), state.profile.currency)}
          </Text>
        </View>
      </View>

      {/* Action Buttons - Row 1: Add Debt / Add Credit */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.success }]}
          activeOpacity={0.7}
          onPress={() =>
            router.push({
              pathname: "/add-debt-entry" as any,
              params: { contactId: contact.id, type: "theyOweMe" },
            })
          }
        >
          <IconSymbol name="arrow.down.circle.fill" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>{translate("addDebt")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.error }]}
          activeOpacity={0.7}
          onPress={() =>
            router.push({
              pathname: "/add-debt-entry" as any,
              params: { contactId: contact.id, type: "iOweThem" },
            })
          }
        >
          <IconSymbol name="arrow.up.circle.fill" size={18} color="#fff" />
          <Text style={styles.actionButtonText}>{translate("addCredit")}</Text>
        </TouchableOpacity>
      </View>

      {/* Action Buttons - Row 2: Payment / Reminder / Settle */}
      <View style={styles.actionRow2}>
        {netBalance !== 0 && (
          <TouchableOpacity
            style={[styles.actionButton2, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "40" }]}
            activeOpacity={0.7}
            onPress={() => setShowPaymentModal(true)}
          >
            <IconSymbol name="creditcard.fill" size={16} color={colors.primary} />
            <Text style={[styles.actionButton2Text, { color: colors.primary }]}>{translate("recordPayment")}</Text>
          </TouchableOpacity>
        )}
        {netBalance > 0 && (
          <TouchableOpacity
            style={[styles.actionButton2, { backgroundColor: colors.warning + "15", borderColor: colors.warning + "40" }]}
            activeOpacity={0.7}
            onPress={() => setShowReminderMenu(true)}
          >
            <IconSymbol name="paperplane.fill" size={16} color={colors.warning} />
            <Text style={[styles.actionButton2Text, { color: colors.warning }]}>{translate("sendReminder")}</Text>
          </TouchableOpacity>
        )}
        {entries.length > 1 && (
          <TouchableOpacity
            style={[styles.actionButton2, { backgroundColor: colors.muted + "15", borderColor: colors.muted + "40" }]}
            activeOpacity={0.7}
            onPress={handleSettle}
          >
            <IconSymbol name="checkmark.circle.fill" size={16} color={colors.muted} />
            <Text style={[styles.actionButton2Text, { color: colors.muted }]}>{translate("settleAccount")}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Transaction History */}
      <View style={styles.historyHeader}>
        <Text style={[styles.historyTitle, { color: colors.foreground }]}>
          {translate("debtHistory")}
        </Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id}
        renderItem={renderEntry}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {translate("noDebtEntries")}
            </Text>
          </View>
        }
      />

      {/* Reminder Menu Modal */}
      <Modal visible={showReminderMenu} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowReminderMenu(false)}
        >
          <View style={[styles.reminderMenu, { backgroundColor: colors.background }]}>
            <Text style={[styles.reminderTitle, { color: colors.foreground }]}>
              {translate("sendReminder")}
            </Text>
            <Text style={[styles.reminderPreview, { color: colors.muted }]} numberOfLines={3}>
              {getReminderMessage()}
            </Text>

            <TouchableOpacity
              style={[styles.reminderOption, { backgroundColor: colors.success + "10", borderColor: colors.success + "30" }]}
              activeOpacity={0.7}
              onPress={handleSendSMS}
            >
              <IconSymbol name="paperplane.fill" size={22} color={colors.success} />
              <View style={styles.reminderOptionInfo}>
                <Text style={[styles.reminderOptionTitle, { color: colors.success }]}>
                  {translate("sendViaSMS")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.reminderOption, { backgroundColor: "#25D36610", borderColor: "#25D36630" }]}
              activeOpacity={0.7}
              onPress={handleSendWhatsApp}
            >
              <IconSymbol name="phone.fill" size={22} color="#25D366" />
              <View style={styles.reminderOptionInfo}>
                <Text style={[styles.reminderOptionTitle, { color: "#25D366" }]}>
                  {translate("sendViaWhatsApp")}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: colors.surface }]}
              activeOpacity={0.7}
              onPress={() => setShowReminderMenu(false)}
            >
              <Text style={[styles.cancelButtonText, { color: colors.muted }]}>{translate("cancel")}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.paymentModal, { backgroundColor: colors.background }]}>
            <View style={styles.paymentHeader}>
              <Text style={[styles.paymentTitle, { color: colors.foreground }]}>
                {translate("recordPayment")}
              </Text>
              <TouchableOpacity onPress={() => { setShowPaymentModal(false); setPaymentAmount(""); setPaymentNote(""); }} activeOpacity={0.7}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Balance info */}
            <View style={[styles.paymentBalanceInfo, { backgroundColor: balanceColor + "10", borderColor: balanceColor + "30" }]}>
              <Text style={[styles.paymentBalanceLabel, { color: balanceColor }]}>
                {netBalance > 0 ? translate("totalOwedToYou") : translate("totalYouOwe")}
              </Text>
              <Text style={[styles.paymentBalanceAmount, { color: balanceColor }]}>
                {formatCurrency(Math.abs(netBalance), state.profile.currency)}
              </Text>
            </View>

            {/* Amount input */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {translate("paymentAmount")} ({state.profile.currency})
              </Text>
              <TextInput
                style={[styles.amountInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.primary }]}
                placeholder="0"
                placeholderTextColor={colors.muted}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="numeric"
                returnKeyType="done"
              />
            </View>

            {/* Pay full button */}
            <TouchableOpacity
              style={[styles.payFullButton, { borderColor: colors.primary }]}
              activeOpacity={0.7}
              onPress={handlePayFull}
            >
              <Text style={[styles.payFullText, { color: colors.primary }]}>{translate("payFull")}</Text>
            </TouchableOpacity>

            {/* Note input */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {translate("note")}
              </Text>
              <TextInput
                style={[styles.noteInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder={translate("enterNote")}
                placeholderTextColor={colors.muted}
                value={paymentNote}
                onChangeText={setPaymentNote}
                returnKeyType="done"
              />
            </View>

            {/* Remaining balance preview */}
            {parseFloat(paymentAmount) > 0 && (
              <View style={[styles.remainingRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.remainingLabel, { color: colors.muted }]}>{translate("remainingBalance")}</Text>
                <Text style={[styles.remainingAmount, { color: balanceColor }]}>
                  {formatCurrency(Math.max(0, Math.abs(netBalance) - parseFloat(paymentAmount || "0")), state.profile.currency)}
                </Text>
              </View>
            )}

            {/* Save button */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: paymentIsValid ? 1 : 0.5 }]}
              activeOpacity={0.7}
              onPress={handleRecordPayment}
              disabled={!paymentIsValid}
            >
              <Text style={styles.saveButtonText}>
                {netBalance > 0 ? translate("paymentReceived") : translate("paymentMade")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
  },
  contactHeader: {
    alignItems: "center",
    paddingVertical: 16,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "700",
  },
  contactName: {
    fontSize: 22,
    fontWeight: "700",
  },
  contactPhone: {
    fontSize: 14,
    marginTop: 4,
  },
  contactNote: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: "italic",
  },
  balanceCard: {
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  balanceRow: {
    flexDirection: "row",
    padding: 16,
  },
  balanceItem: {
    flex: 1,
    alignItems: "center",
  },
  balanceItemLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  balanceItemAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  balanceDivider: {
    width: 1,
    marginVertical: 4,
  },
  netRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  netAmount: {
    fontSize: 20,
    fontWeight: "800",
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  actionRow2: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton2: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
    borderWidth: 1,
  },
  actionButton2Text: {
    fontSize: 12,
    fontWeight: "600",
  },
  historyHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  entryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  entryInfo: {
    flex: 1,
  },
  entryDesc: {
    fontSize: 15,
    fontWeight: "500",
  },
  entryDate: {
    fontSize: 12,
    marginTop: 2,
  },
  entryAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 15,
  },
  // Reminder Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  reminderMenu: {
    width: "85%",
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  reminderTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  reminderPreview: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 4,
  },
  reminderOption: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  reminderOptionInfo: {
    flex: 1,
  },
  reminderOptionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  cancelButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginTop: 4,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  // Payment Modal
  paymentModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  paymentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  paymentTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  paymentBalanceInfo: {
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  paymentBalanceLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  paymentBalanceAmount: {
    fontSize: 20,
    fontWeight: "800",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  amountInput: {
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 56,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
    borderWidth: 1,
  },
  payFullButton: {
    borderRadius: 8,
    borderWidth: 1.5,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 16,
  },
  payFullText: {
    fontSize: 14,
    fontWeight: "600",
  },
  noteInput: {
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    borderWidth: 1,
  },
  remainingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginBottom: 16,
    borderTopWidth: 1,
  },
  remainingLabel: {
    fontSize: 14,
  },
  remainingAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  saveButton: {
    borderRadius: 12,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
});
