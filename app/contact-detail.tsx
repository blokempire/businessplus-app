import { useMemo } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { calculateContactBalance, formatCurrency, DebtEntry } from "@/lib/store";

export default function ContactDetailScreen() {
  const { contactId } = useLocalSearchParams<{ contactId: string }>();
  const { state, translate, deleteDebtEntry, settleContact, deleteContact } = useApp();
  const colors = useColors();
  const router = useRouter();

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

    return (
      <TouchableOpacity
        style={[styles.entryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
        onLongPress={() => handleDeleteEntry(item)}
      >
        <View style={[styles.entryIcon, { backgroundColor: entryColor + "15" }]}>
          <IconSymbol
            name={isCredit ? "arrow.down.circle.fill" : "arrow.up.circle.fill"}
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

      {/* Action Buttons */}
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
        {entries.length > 1 && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
            onPress={handleSettle}
          >
            <IconSymbol name="checkmark.circle.fill" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>{translate("settleAccount")}</Text>
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
    paddingVertical: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
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
    paddingTop: 16,
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  historyHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
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
});
