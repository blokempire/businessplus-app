import { useMemo, useState, useRef } from "react";
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
  Animated,
  KeyboardAvoidingView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { calculateContactBalance, formatCurrency, DebtEntry } from "@/lib/store";
import * as SMS from "expo-sms";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

const HEADER_MAX_HEIGHT = 180;
const HEADER_MIN_HEIGHT = 0;
const HEADER_SCROLL_DISTANCE = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

export default function ContactDetailScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const { state, translate, addDebtEntry, deleteDebtEntry, settleContact, deleteContact } = useApp();
  const colors = useColors();
  const router = useRouter();

  const [showReminderMenu, setShowReminderMenu] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const scrollY = useRef(new Animated.Value(0)).current;

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

  // Animated header collapse
  const headerHeight = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE],
    outputRange: [HEADER_MAX_HEIGHT, HEADER_MIN_HEIGHT],
    extrapolate: "clamp",
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_SCROLL_DISTANCE * 0.6],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

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
          onPress: () => {
            settleContact(contact.id);
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
          },
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

  // Export contact records as PDF
  const handleExportRecords = async () => {
    const currency = state.profile.currency;
    const rows = entries.map((e) => {
      const isCredit = e.type === "theyOweMe";
      return `<tr>
        <td>${new Date(e.date).toLocaleDateString()}</td>
        <td>${e.description || (isCredit ? translate("theyOweMe") : translate("iOweThem"))}</td>
        <td style="color:${isCredit ? "#22C55E" : "#EF4444"}">${isCredit ? "+" : "-"}${formatCurrency(e.amount, currency)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:-apple-system,sans-serif;padding:30px;color:#333;max-width:700px;margin:0 auto}
      h1{font-size:22px;margin-bottom:4px}
      .sub{color:#666;font-size:14px;margin-bottom:20px}
      .summary{display:flex;gap:20px;margin-bottom:20px}
      .summary-item{flex:1;background:#f8f9fa;border-radius:10px;padding:14px;text-align:center}
      .summary-item .label{font-size:12px;color:#999}
      .summary-item .value{font-size:20px;font-weight:700;margin-top:4px}
      table{width:100%;border-collapse:collapse}
      th{text-align:left;padding:10px 8px;border-bottom:2px solid #eee;font-size:13px;color:#999}
      td{padding:10px 8px;border-bottom:1px solid #f0f0f0;font-size:14px}
      .footer{margin-top:30px;text-align:center;font-size:12px;color:#999}
    </style></head><body>
      <h1>${contact.name}</h1>
      <p class="sub">${contact.phone || ""} ${contact.note ? "· " + contact.note : ""}</p>
      <div class="summary">
        <div class="summary-item"><div class="label">${translate("theyOweMe")}</div><div class="value" style="color:#22C55E">${formatCurrency(balance.theyOweMe, currency)}</div></div>
        <div class="summary-item"><div class="label">${translate("iOweThem")}</div><div class="value" style="color:#EF4444">${formatCurrency(balance.iOweThem, currency)}</div></div>
        <div class="summary-item"><div class="label">${translate("netBalance")}</div><div class="value" style="color:${netBalance >= 0 ? "#22C55E" : "#EF4444"}">${netBalance >= 0 ? "+" : "-"}${formatCurrency(Math.abs(netBalance), currency)}</div></div>
      </div>
      <table><thead><tr><th>${translate("date")}</th><th>${translate("description")}</th><th>${translate("amount")}</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">${state.profile.businessName || "Mon Business"} · ${new Date().toLocaleDateString()}</div>
    </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${contact.name}_records.pdf` });
    } catch (e) {
      console.error("Export error:", e);
    }
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
        <View style={{ flexDirection: "row", gap: 16 }}>
          <TouchableOpacity onPress={handleExportRecords} activeOpacity={0.7}>
            <IconSymbol name="square.and.arrow.up" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDeleteContact} activeOpacity={0.7}>
            <IconSymbol name="trash.fill" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsible Contact Profile */}
      <Animated.View style={{ height: headerHeight, opacity: headerOpacity, overflow: "hidden" }}>
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
      </Animated.View>

      {/* Balance Card */}
      <View style={[styles.balanceCard, { backgroundColor: balanceColor + "10", borderColor: balanceColor + "30" }]}>
        <View style={styles.balanceRow}>
          <View style={styles.balanceItem}>
            <Text style={[styles.balanceItemLabel, { color: colors.success }]}>{translate("theyOweMe")}</Text>
            <Text style={[styles.balanceItemAmount, { color: colors.success }]}>
              {formatCurrency(balance.theyOweMe, state.profile.currency)}
            </Text>
          </View>
          <View style={[styles.balanceDivider, { backgroundColor: colors.border }]} />
          <View style={styles.balanceItem}>
            <Text style={[styles.balanceItemLabel, { color: colors.error }]}>{translate("iOweThem")}</Text>
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
        {entries.length > 0 && (
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
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
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
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.paymentModal, { backgroundColor: colors.background }]}>
            <View style={styles.paymentHeader}>
              <Text style={[styles.paymentTitle, { color: colors.foreground }]}>
                {translate("recordPayment")}
              </Text>
              <TouchableOpacity onPress={() => { setShowPaymentModal(false); setPaymentAmount(""); setPaymentNote(""); }} activeOpacity={0.7}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={[styles.paymentBalanceInfo, { backgroundColor: balanceColor + "10", borderColor: balanceColor + "30" }]}>
              <Text style={[styles.paymentBalanceLabel, { color: balanceColor }]}>
                {netBalance > 0 ? translate("totalOwedToYou") : translate("totalYouOwe")}
              </Text>
              <Text style={[styles.paymentBalanceAmount, { color: balanceColor }]}>
                {formatCurrency(Math.abs(netBalance), state.profile.currency)}
              </Text>
            </View>

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

            <TouchableOpacity
              style={[styles.payFullButton, { borderColor: colors.primary }]}
              activeOpacity={0.7}
              onPress={handlePayFull}
            >
              <Text style={[styles.payFullText, { color: colors.primary }]}>{translate("payFull")}</Text>
            </TouchableOpacity>

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

            {parseFloat(paymentAmount) > 0 && (
              <View style={[styles.remainingRow, { borderTopColor: colors.border }]}>
                <Text style={[styles.remainingLabel, { color: colors.muted }]}>{translate("remainingBalance")}</Text>
                <Text style={[styles.remainingAmount, { color: balanceColor }]}>
                  {formatCurrency(Math.max(0, Math.abs(netBalance) - parseFloat(paymentAmount || "0")), state.profile.currency)}
                </Text>
              </View>
            )}

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
        </KeyboardAvoidingView>
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
    fontSize: 20,
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
