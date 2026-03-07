import { FlatList, Text, View, Pressable, StyleSheet, Image, Modal, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { calculateTotals, formatCurrency, filterTransactionsByPeriod, Transaction } from "@/lib/store";
import { useMemo, useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDebtReminders } from "@/hooks/use-debt-reminders";
import { trpc } from "@/lib/trpc";

// Notification item types
type NotifItemData = {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  type: "invoice" | "debt" | "invitation";
  referenceId?: string;
  invitationId?: number;
};

export default function DashboardScreen() {
  const { state, translate } = useApp();

  // Schedule debt reminder notifications every 2 days
  useDebtReminders(state.debtEntries, state.invoices, translate as (key: string) => string);
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Fetch pending team invitations from server
  const pendingInvitationsQuery = trpc.company.pendingInvitations.useQuery(undefined, { retry: false });
  const pendingInvitations = pendingInvitationsQuery.data || [];
  const utils = trpc.useUtils();

  const acceptMutation = trpc.company.acceptInvitation.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("invitationAccepted"));
      utils.company.pendingInvitations.invalidate();
      utils.company.info.invalidate();
    },
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  const rejectMutation = trpc.company.rejectInvitation.useMutation({
    onSuccess: () => utils.company.pendingInvitations.invalidate(),
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  const dismissNotification = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Build notification items from pending invoices, debts, and team invitations
  const notificationItems = useMemo(() => {
    const items: NotifItemData[] = [];
    // Team invitations (highest priority)
    pendingInvitations.forEach((inv: any) => {
      items.push({
        id: `invite-${inv.id}`,
        icon: "person.2.fill",
        iconColor: colors.primary,
        title: translate("companyGroup"),
        subtitle: translate("teamInvitationNotif"),
        type: "invitation",
        invitationId: inv.id,
      });
    });
    // Pending/partial invoices
    state.invoices
      .filter((i) => i.status === "pending" || i.status === "partial")
      .forEach((inv) => {
        const remaining = inv.total - inv.paidAmount;
        items.push({
          id: `inv-${inv.id}`,
          icon: "doc.text.fill",
          iconColor: colors.warning,
          title: inv.contactName,
          subtitle: `${translate("unpaidInvoiceNotif")} • ${formatCurrency(remaining, state.profile.currency)}`,
          type: "invoice",
          referenceId: inv.id,
        });
      });
    // Debts (they owe me)
    state.debtEntries
      .filter((d) => d.type === "theyOweMe")
      .forEach((debt) => {
        const contact = state.contacts.find((c) => c.id === debt.contactId);
        items.push({
          id: `debt-${debt.id}`,
          icon: "exclamationmark.triangle.fill",
          iconColor: colors.error,
          title: contact?.name || "Unknown",
          subtitle: `${translate("debtOwedNotif")} ${formatCurrency(debt.amount, state.profile.currency)}`,
          type: "debt",
          referenceId: debt.contactId,
        });
      });
    return items;
  }, [state.invoices, state.debtEntries, state.contacts, state.profile.currency, colors, translate, pendingInvitations]);

  const visibleNotifications = useMemo(
    () => notificationItems.filter(item => !dismissedIds.has(item.id)),
    [notificationItems, dismissedIds]
  );

  const handleNotifTap = useCallback((item: NotifItemData) => {
    setShowNotifications(false);
    if (item.type === "invoice" && item.referenceId) {
      router.push({ pathname: "/invoice-detail", params: { invoiceId: item.referenceId } } as any);
    } else if (item.type === "debt" && item.referenceId) {
      router.push({ pathname: "/contact-detail", params: { contactId: item.referenceId } } as any);
    } else if (item.type === "invitation") {
      router.push("/company" as any);
    }
  }, [router]);

  const handleAcceptInvitation = useCallback((invitationId: number) => {
    acceptMutation.mutate({ invitationId });
  }, [acceptMutation]);

  const handleRejectInvitation = useCallback((invitationId: number, notifId: string) => {
    rejectMutation.mutate({ invitationId });
    dismissNotification(notifId);
  }, [rejectMutation, dismissNotification]);

  const allTotals = useMemo(() => calculateTotals(state.transactions), [state.transactions]);
  const todayTotals = useMemo(
    () => calculateTotals(filterTransactionsByPeriod(state.transactions, "daily")),
    [state.transactions]
  );

  const recentTransactions = useMemo(
    () =>
      [...state.transactions]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5),
    [state.transactions]
  );

  const getCategoryName = (categoryId: string) => {
    if (categoryId.startsWith("custom_")) return categoryId.replace("custom_", "");
    const cat = state.categories.find((c) => c.id === categoryId);
    if (!cat) return categoryId;
    if (cat.isCustom) return cat.nameKey;
    return translate(cat.nameKey as any);
  };

  const getCategoryIcon = (categoryId: string) => {
    if (categoryId.startsWith("custom_")) return "ellipsis";
    const cat = state.categories.find((c) => c.id === categoryId);
    return cat?.icon || "ellipsis";
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return translate("today");
    if (isYesterday) return translate("yesterday");
    return d.toLocaleDateString(state.language === "fr" ? "fr-FR" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <Pressable
      style={({ pressed }) => [styles.transactionItem, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.categoryIcon, { backgroundColor: item.type === "income" ? colors.success + "20" : colors.error + "20" }]}>
        <IconSymbol
          name={getCategoryIcon(item.categoryId) as any}
          size={20}
          color={item.type === "income" ? colors.success : colors.error}
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={[styles.transactionCategory, { color: colors.foreground }]}>
          {getCategoryName(item.categoryId)}
        </Text>
        <Text style={[styles.transactionDesc, { color: colors.muted }]} numberOfLines={1}>
          {item.description || formatDate(item.date)}
        </Text>
      </View>
      <Text
        style={[
          styles.transactionAmount,
          { color: item.type === "income" ? colors.success : colors.error },
        ]}
      >
        {item.type === "income" ? "+" : "-"}
        {formatCurrency(item.amount, state.profile.currency)}
      </Text>
    </Pressable>
  );

  return (
    <>
    <ScreenContainer className="flex-1">
      <FlatList
        data={recentTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              {state.profile.logoUri ? (
                <Image key={state.profile.logoUri} source={{ uri: state.profile.logoUri }} style={styles.headerLogo} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={[styles.greeting, { color: colors.muted }]}>
                  {translate("welcome")}
                </Text>
                <Text style={[styles.businessName, { color: colors.foreground }]}>
                  {state.profile.businessName || translate("businessName")}
                </Text>
              </View>
              <View style={styles.headerIcons}>
                <Pressable
                  onPress={() => router.push("/settings" as any)}
                  style={({ pressed }) => [styles.headerIconBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <IconSymbol name="gearshape.fill" size={22} color={colors.muted} />
                </Pressable>
                <Pressable
                  onPress={() => setShowNotifications(true)}
                  style={({ pressed }) => [styles.headerIconBtn, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <View>
                    <IconSymbol name="bell.fill" size={22} color={colors.muted} />
                    {visibleNotifications.length > 0 && (
                      <View style={[styles.notifBadge, { backgroundColor: colors.error }]}>
                        <Text style={styles.notifBadgeText}>
                          {Math.min(visibleNotifications.length, 99)}
                        </Text>
                      </View>
                    )}
                  </View>
                </Pressable>
                {isAdmin && (
                  <Pressable
                    onPress={() => router.push("/admin" as any)}
                    style={({ pressed }) => [styles.headerIconBtn, { opacity: pressed ? 0.6 : 1 }]}
                  >
                    <IconSymbol name="shield.fill" size={22} color={colors.warning} />
                  </Pressable>
                )}
              </View>
            </View>

            {/* Balance Card */}
            <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
              <Text style={styles.balanceLabel}>{translate("totalBalance")}</Text>
              <Text style={styles.balanceAmount}>
                {formatCurrency(allTotals.balance, state.profile.currency)}
              </Text>
              <View style={styles.balanceRow}>
                <View style={styles.balanceItem}>
                  <View style={styles.balanceIconRow}>
                    <IconSymbol name="arrow.up.circle.fill" size={18} color="#4ADE80" />
                    <Text style={styles.balanceItemLabel}>{translate("income")}</Text>
                  </View>
                  <Text style={styles.balanceItemAmount}>
                    {formatCurrency(allTotals.income, state.profile.currency)}
                  </Text>
                </View>
                <View style={[styles.balanceDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
                <View style={styles.balanceItem}>
                  <View style={styles.balanceIconRow}>
                    <IconSymbol name="arrow.down.circle.fill" size={18} color="#F87171" />
                    <Text style={styles.balanceItemLabel}>{translate("expense")}</Text>
                  </View>
                  <Text style={styles.balanceItemAmount}>
                    {formatCurrency(allTotals.expense, state.profile.currency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <Pressable
                onPress={() => router.push("/add-transaction?type=income" as any)}
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  { backgroundColor: colors.success + "15", borderColor: colors.success + "40", opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <IconSymbol name="plus.circle.fill" size={28} color={colors.success} />
                <Text style={[styles.quickActionText, { color: colors.success }]}>
                  {translate("addIncome")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/add-transaction?type=expense" as any)}
                style={({ pressed }) => [
                  styles.quickActionBtn,
                  { backgroundColor: colors.error + "15", borderColor: colors.error + "40", opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <IconSymbol name="minus.circle.fill" size={28} color={colors.error} />
                <Text style={[styles.quickActionText, { color: colors.error }]}>
                  {translate("addExpense")}
                </Text>
              </Pressable>
            </View>

            {/* Navigation Shortcuts */}
            <View style={styles.quickActions}>
              <Pressable
                onPress={() => router.push("/reports" as any)}
                style={({ pressed }) => [
                  styles.navShortcut,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <IconSymbol name="chart.bar.fill" size={22} color={colors.primary} />
                <Text style={[styles.navShortcutText, { color: colors.foreground }]}>
                  {translate("reports")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.push("/settings" as any)}
                style={({ pressed }) => [
                  styles.navShortcut,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <IconSymbol name="gearshape.fill" size={22} color={colors.primary} />
                <Text style={[styles.navShortcutText, { color: colors.foreground }]}>
                  {translate("settings")}
                </Text>
              </Pressable>
            </View>

            {/* Admin Panel - visible only to admins */}
            {isAdmin && (
              <Pressable
                onPress={() => router.push("/admin" as any)}
                style={({ pressed }) => [
                  styles.adminBanner,
                  { backgroundColor: colors.warning + "15", borderColor: colors.warning + "40", opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <View style={[styles.adminIconBg, { backgroundColor: colors.warning + "25" }]}>
                  <IconSymbol name="shield.fill" size={22} color={colors.warning} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.adminBannerTitle, { color: colors.foreground }]}>
                    {translate("adminPanel")}
                  </Text>
                  <Text style={[styles.adminBannerDesc, { color: colors.muted }]}>
                    {translate("userManagement")}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.warning} />
              </Pressable>
            )}

            {/* Today's Summary */}
            <View style={[styles.todayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {translate("todaySummary")}
              </Text>
              <View style={styles.todayRow}>
                <View style={styles.todayItem}>
                  <Text style={[styles.todayLabel, { color: colors.muted }]}>{translate("income")}</Text>
                  <Text style={[styles.todayValue, { color: colors.success }]}>
                    +{formatCurrency(todayTotals.income, state.profile.currency)}
                  </Text>
                </View>
                <View style={styles.todayItem}>
                  <Text style={[styles.todayLabel, { color: colors.muted }]}>{translate("expense")}</Text>
                  <Text style={[styles.todayValue, { color: colors.error }]}>
                    -{formatCurrency(todayTotals.expense, state.profile.currency)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Recent Transactions Header */}
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {translate("recentTransactions")}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <IconSymbol name="doc.text" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {translate("noTransactions")}
            </Text>
          </View>
        }
      />
    </ScreenContainer>

    {/* Notification Panel Modal */}
    <Modal
      visible={showNotifications}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowNotifications(false)}
    >
      <View style={[notifStyles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[notifStyles.header, { borderBottomColor: colors.border }]}>
          <Text style={[notifStyles.headerTitle, { color: colors.foreground }]}>
            {translate("notifications")}
          </Text>
          <TouchableOpacity onPress={() => setShowNotifications(false)} style={notifStyles.closeBtn}>
            <IconSymbol name="xmark" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Notification List */}
        {visibleNotifications.length === 0 ? (
          <View style={notifStyles.emptyState}>
            <IconSymbol name="bell.fill" size={48} color={colors.muted} />
            <Text style={[notifStyles.emptyText, { color: colors.muted }]}>
              {translate("noNotifications")}
            </Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={notifStyles.list}>
            {visibleNotifications.map((item) => (
              <View key={item.id} style={notifStyles.notifRow}>
                <Pressable
                  onPress={() => handleNotifTap(item)}
                  style={({ pressed }) => [notifStyles.notifItem, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[notifStyles.notifIcon, { backgroundColor: item.iconColor + "20" }]}>
                    <IconSymbol name={item.icon as any} size={20} color={item.iconColor} />
                  </View>
                  <View style={notifStyles.notifContent}>
                    <Text style={[notifStyles.notifTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={[notifStyles.notifSubtitle, { color: colors.muted }]} numberOfLines={2}>
                      {item.subtitle}
                    </Text>
                    <Text style={[notifStyles.notifTapHint, { color: colors.primary }]}>
                      {translate("tapToView")}
                    </Text>
                  </View>
                  {/* Invitation: Accept/Reject buttons */}
                  {item.type === "invitation" && item.invitationId ? (
                    <View style={notifStyles.invitationActions}>
                      <Pressable
                        onPress={() => handleAcceptInvitation(item.invitationId!)}
                        style={({ pressed }) => [notifStyles.invBtn, { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 }]}
                      >
                        <IconSymbol name="checkmark" size={16} color="#FFF" />
                      </Pressable>
                      <Pressable
                        onPress={() => handleRejectInvitation(item.invitationId!, item.id)}
                        style={({ pressed }) => [notifStyles.invBtn, { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }]}
                      >
                        <IconSymbol name="xmark" size={16} color="#FFF" />
                      </Pressable>
                    </View>
                  ) : (
                    /* Dismiss button for invoices/debts */
                    <Pressable
                      onPress={() => dismissNotification(item.id)}
                      style={({ pressed }) => [notifStyles.dismissBtn, { opacity: pressed ? 0.5 : 0.8 }]}
                    >
                      <IconSymbol name="xmark" size={16} color={colors.muted} />
                    </Pressable>
                  )}
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 16,
    gap: 14,
  },
  headerLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "500",
  },
  businessName: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "700",
    textTransform: "uppercase" as const,
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 4,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  balanceItem: {
    flex: 1,
  },
  balanceIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  balanceItemLabel: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  balanceItemAmount: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 4,
  },
  balanceDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: "700",
  },
  todayCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  todayRow: {
    flexDirection: "row",
    marginTop: 12,
    gap: 16,
  },
  todayItem: {
    flex: 1,
  },
  todayLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  todayValue: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  transactionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  categoryIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  transactionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  transactionCategory: {
    fontSize: 15,
    fontWeight: "600",
  },
  transactionDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
  navShortcut: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  navShortcutText: {
    fontSize: 14,
    fontWeight: "600",
  },
  adminBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 20,
    gap: 12,
  },
  adminIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  adminBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  adminBannerDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerIconBtn: {
    padding: 8,
  },
  notifBadge: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
});

const notifStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  closeBtn: {
    padding: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "500",
  },
  list: {
    padding: 20,
    gap: 10,
  },
  notifItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    gap: 12,
  },
  notifIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  notifSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  notifTapHint: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },
  notifRow: {
    marginBottom: 0,
  },
  invitationActions: {
    flexDirection: "row",
    gap: 8,
    marginLeft: 8,
  },
  invBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissBtn: {
    padding: 8,
    marginLeft: 4,
  },
});
