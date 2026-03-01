import { useState, useEffect, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

type UserRecord = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  status: "active" | "restricted";
  subscriptionPlan: "free" | "solo" | "team";
  subscriptionActive: boolean;
  subscriptionStartDate: Date | null;
  subscriptionEndDate: Date | null;
  companyId: number | null;
  companyRole: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

type UserStats = {
  total: number;
  active: number;
  restricted: number;
  admins: number;
  subscribers: number;
  expired: number;
};

export default function AdminScreen() {
  const { translate, state } = useApp();
  const colors = useColors();
  const router = useRouter();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, restricted: 0, admins: 0, subscribers: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const utils = trpc.useUtils();

  const statsQuery = trpc.admin.stats.useQuery(undefined, { retry: false });
  const usersQuery = trpc.admin.listUsers.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (statsQuery.error) {
      const err = statsQuery.error as any;
      if (err?.data?.code === "FORBIDDEN") {
        Alert.alert(translate("error"), "Access denied");
        router.back();
      }
    }
  }, [statsQuery.error]);

  const setRoleMutation = trpc.admin.setRole.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("roleUpdated"));
      refetchAll();
    },
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  const setStatusMutation = trpc.admin.setStatus.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("statusUpdated"));
      refetchAll();
    },
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("userDeleted"));
      setDetailVisible(false);
      setSelectedUser(null);
      refetchAll();
    },
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  const grantSubMutation = trpc.admin.grantSubscription.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("subscriptionGranted"));
      refetchAll();
      // Refresh selected user
      if (selectedUser) {
        const updated = users.find((u) => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
      }
    },
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  const revokeSubMutation = trpc.admin.revokeSubscription.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("subscriptionRevoked"));
      refetchAll();
    },
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  const expireAllMutation = trpc.admin.expireSubscriptions.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("allExpired"));
      refetchAll();
    },
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  useEffect(() => {
    if (statsQuery.data) setStats(statsQuery.data as UserStats);
  }, [statsQuery.data]);

  useEffect(() => {
    if (usersQuery.data) setUsers(usersQuery.data as UserRecord[]);
    setLoading(usersQuery.isLoading);
  }, [usersQuery.data, usersQuery.isLoading]);

  // Payment request mutations
  const approvePaymentMutation = trpc.admin.approvePayment.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("paymentApprovedSuccess"));
      refetchAll();
    },
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  const rejectPaymentMutation = trpc.admin.rejectPayment.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("paymentRejectedSuccess"));
      refetchAll();
    },
    onError: (err: any) => Alert.alert(translate("error"), err.message),
  });

  const paymentRequestsQuery = trpc.admin.paymentRequests.useQuery(undefined, { retry: false });
  const paymentStatsQuery = trpc.admin.paymentStats.useQuery(undefined, { retry: false });

  const [paymentListVisible, setPaymentListVisible] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  const paymentRequests = paymentRequestsQuery.data || [];
  const paymentStats = paymentStatsQuery.data || { pending: 0, approved: 0, rejected: 0, totalRevenue: 0 };

  const filteredPayments = paymentFilter === "all"
    ? paymentRequests
    : paymentRequests.filter((p: any) => p.status === paymentFilter);

  const handleApprovePayment = (requestId: number, userName: string) => {
    Alert.alert(translate("approvePayment"), translate("approvePaymentConfirm"), [
      { text: translate("cancel"), style: "cancel" },
      { text: translate("confirm"), onPress: () => approvePaymentMutation.mutate({ requestId }) },
    ]);
  };

  const handleRejectPayment = (requestId: number, userName: string) => {
    Alert.alert(translate("rejectPayment"), translate("rejectPaymentConfirm"), [
      { text: translate("cancel"), style: "cancel" },
      { text: translate("confirm"), style: "destructive", onPress: () => rejectPaymentMutation.mutate({ requestId }) },
    ]);
  };

  const refetchAll = useCallback(() => {
    utils.admin.stats.invalidate();
    utils.admin.listUsers.invalidate();
    utils.admin.paymentRequests.invalidate();
    utils.admin.paymentStats.invalidate();
  }, [utils]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchAll();
    setRefreshing(false);
  }, [refetchAll]);

  const handleToggleRole = (user: UserRecord) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    const label = newRole === "admin" ? translate("setAsAdmin") : translate("setAsUser");
    Alert.alert(label, `${user.name || user.phone || user.openId}`, [
      { text: translate("cancel"), style: "cancel" },
      { text: translate("confirm"), onPress: () => setRoleMutation.mutate({ id: user.id, role: newRole }) },
    ]);
  };

  const handleToggleStatus = (user: UserRecord) => {
    const newStatus = user.status === "active" ? "restricted" : "active";
    const label = newStatus === "restricted" ? translate("restrictAccess") : translate("grantAccess");
    Alert.alert(label, `${user.name || user.phone || user.openId}`, [
      { text: translate("cancel"), style: "cancel" },
      {
        text: translate("confirm"),
        style: newStatus === "restricted" ? "destructive" : "default",
        onPress: () => setStatusMutation.mutate({ id: user.id, status: newStatus }),
      },
    ]);
  };

  const handleDeleteUser = (user: UserRecord) => {
    Alert.alert(translate("deleteUser"), translate("deleteUserConfirm"), [
      { text: translate("cancel"), style: "cancel" },
      { text: translate("delete"), style: "destructive", onPress: () => deleteUserMutation.mutate({ id: user.id }) },
    ]);
  };

  const handleGrantSubscription = (user: UserRecord, plan: "solo" | "team") => {
    const label = plan === "solo" ? translate("grantSolo") : translate("grantTeam");
    Alert.alert(label, `${user.name || user.phone || user.openId}`, [
      { text: translate("cancel"), style: "cancel" },
      { text: translate("confirm"), onPress: () => grantSubMutation.mutate({ userId: user.id, plan }) },
    ]);
  };

  const handleRevokeSubscription = (user: UserRecord) => {
    Alert.alert(translate("revokeAccess"), `${user.name || user.phone || user.openId}`, [
      { text: translate("cancel"), style: "cancel" },
      { text: translate("confirm"), style: "destructive", onPress: () => revokeSubMutation.mutate({ userId: user.id }) },
    ]);
  };

  const handleExpireAll = () => {
    Alert.alert(translate("expireAll"), translate("expireAllConfirm"), [
      { text: translate("cancel"), style: "cancel" },
      { text: translate("confirm"), style: "destructive", onPress: () => expireAllMutation.mutate() },
    ]);
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString(state.language === "fr" ? "fr-FR" : "en-US", {
      year: "numeric", month: "short", day: "numeric",
    });
  };

  const formatDateTime = (date: Date | string | null) => {
    if (!date) return "—";
    const d = new Date(date);
    return d.toLocaleDateString(state.language === "fr" ? "fr-FR" : "en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const getSubColor = (user: UserRecord) => {
    if (user.subscriptionActive && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()) {
      return colors.success;
    }
    return colors.error;
  };

  const getSubLabel = (user: UserRecord) => {
    if (user.role === "admin") return translate("admin");
    if (user.subscriptionActive && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date()) {
      return user.subscriptionPlan === "team" ? translate("teamPlan") : user.subscriptionPlan === "solo" ? translate("soloPlan") : translate("freeTrial");
    }
    return translate("subscriptionExpired");
  };

  const renderStatCard = (label: string, value: number, color: string, icon: string) => (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.statIconBg, { backgroundColor: color + "20" }]}>
        <IconSymbol name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.muted }]}>{label}</Text>
    </View>
  );

  const renderUser = ({ item }: { item: UserRecord }) => (
    <Pressable
      onPress={() => { setSelectedUser(item); setDetailVisible(true); }}
      style={({ pressed }) => [styles.userItem, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={styles.userLeft}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {(item.name || item.phone || "U")[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
              {item.name || `User #${item.id}`}
            </Text>
            {item.role === "admin" && (
              <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>{translate("admin")}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.userPhone, { color: colors.muted }]} numberOfLines={1}>
            {item.phone || item.email || item.openId}
          </Text>
          <View style={styles.subBadgeRow}>
            <View style={[styles.subBadge, { backgroundColor: getSubColor(item) + "15" }]}>
              <Text style={[styles.subBadgeText, { color: getSubColor(item) }]}>
                {getSubLabel(item)}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.userRight}>
        <View style={[styles.statusDot, { backgroundColor: item.status === "active" ? colors.success : colors.error }]} />
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="flex-1">
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="chevron.right" size={24} color={colors.primary} style={{ transform: [{ scaleX: -1 }] }} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{translate("adminPanel")}</Text>
        <Pressable onPress={handleExpireAll} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
          <IconSymbol name="arrow.clockwise" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderUser}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View>
              {/* Stats Cards */}
              <View style={styles.statsGrid}>
                {renderStatCard(translate("totalUsers"), stats.total, colors.primary, "person.2.fill")}
                {renderStatCard(translate("activeUsers"), stats.active, colors.success, "checkmark.circle.fill")}
                {renderStatCard(translate("subscriberCount"), stats.subscribers || 0, colors.warning, "creditcard.fill")}
                {renderStatCard(translate("expiredCount"), stats.expired || 0, colors.error, "xmark.circle.fill")}
              </View>

              {/* Payment Requests Banner */}
              <Pressable
                onPress={() => setPaymentListVisible(true)}
                style={({ pressed }) => [styles.paymentBanner, { backgroundColor: paymentStats.pending > 0 ? colors.warning + "15" : colors.surface, borderColor: paymentStats.pending > 0 ? colors.warning : colors.border, opacity: pressed ? 0.8 : 1 }]}
              >
                <View style={[styles.paymentBannerIcon, { backgroundColor: paymentStats.pending > 0 ? colors.warning + "25" : colors.primary + "20" }]}>
                  <IconSymbol name="creditcard.fill" size={22} color={paymentStats.pending > 0 ? colors.warning : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paymentBannerTitle, { color: colors.foreground }]}>
                    {translate("paymentRequests")}
                  </Text>
                  <Text style={[styles.paymentBannerSubtitle, { color: colors.muted }]}>
                    {paymentStats.pending > 0 ? `${paymentStats.pending} ${translate("pendingPayments").toLowerCase()}` : translate("noPaymentRequests")}
                    {paymentStats.totalRevenue > 0 ? ` • ${translate("totalRevenue")}: ${Number(paymentStats.totalRevenue).toLocaleString()} XAF` : ""}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={16} color={colors.muted} />
              </Pressable>

              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{translate("userManagement")}</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>{translate("noUsers")}</Text>
            </View>
          }
        />
      )}

      {/* User Detail Modal */}
      <Modal visible={detailVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setDetailVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Pressable onPress={() => setDetailVisible(false)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                  <Text style={[styles.modalClose, { color: colors.primary }]}>{translate("cancel")}</Text>
                </Pressable>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>{translate("userDetails")}</Text>
                <View style={{ width: 60 }} />
              </View>

              {selectedUser && (
                <View style={styles.modalContent}>
                  {/* User Avatar & Name */}
                  <View style={styles.detailHeader}>
                    <View style={[styles.detailAvatar, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={[styles.detailAvatarText, { color: colors.primary }]}>
                        {(selectedUser.name || selectedUser.phone || "U")[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.detailName, { color: colors.foreground }]}>
                      {selectedUser.name || `User #${selectedUser.id}`}
                    </Text>
                    <Text style={[styles.detailPhone, { color: colors.muted }]}>
                      {selectedUser.phone || selectedUser.email || selectedUser.openId}
                    </Text>
                    <View style={styles.detailBadges}>
                      <View style={[styles.detailBadge, { backgroundColor: selectedUser.role === "admin" ? colors.primary + "20" : colors.muted + "20" }]}>
                        <Text style={[styles.detailBadgeText, { color: selectedUser.role === "admin" ? colors.primary : colors.muted }]}>
                          {selectedUser.role === "admin" ? translate("admin") : translate("user")}
                        </Text>
                      </View>
                      <View style={[styles.detailBadge, { backgroundColor: selectedUser.status === "active" ? colors.success + "20" : colors.error + "20" }]}>
                        <Text style={[styles.detailBadgeText, { color: selectedUser.status === "active" ? colors.success : colors.error }]}>
                          {selectedUser.status === "active" ? translate("active") : translate("restricted")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Info Card */}
                  <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>ID</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>#{selectedUser.id}</Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>{translate("phone")}</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>{selectedUser.phone || "—"}</Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>{translate("joined")}</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatDateTime(selectedUser.createdAt)}</Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>{translate("lastActive")}</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatDateTime(selectedUser.lastSignedIn)}</Text>
                    </View>
                  </View>

                  {/* Subscription Info */}
                  <Text style={[styles.actionSectionTitle, { color: colors.foreground }]}>
                    {translate("subscriptionInfo")}
                  </Text>
                  <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>{translate("plan")}</Text>
                      <View style={[styles.subBadge, { backgroundColor: getSubColor(selectedUser) + "15" }]}>
                        <Text style={[styles.subBadgeText, { color: getSubColor(selectedUser) }]}>
                          {getSubLabel(selectedUser)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>{translate("expiresOn")}</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>{formatDate(selectedUser.subscriptionEndDate)}</Text>
                    </View>
                  </View>

                  {/* Subscription Actions */}
                  <Text style={[styles.actionSectionTitle, { color: colors.foreground }]}>
                    {translate("manageAccess")}
                  </Text>

                  {/* Grant Solo */}
                  <Pressable
                    onPress={() => handleGrantSubscription(selectedUser, "solo")}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.success + "10", opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={[styles.actionIconBg, { backgroundColor: colors.success + "20" }]}>
                      <IconSymbol name="person.fill" size={18} color={colors.success} />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionTitle, { color: colors.foreground }]}>{translate("grantSolo")}</Text>
                      <Text style={[styles.actionDesc, { color: colors.muted }]}>10,000 XAF — 1 {translate("user")}</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </Pressable>

                  {/* Grant Team */}
                  <Pressable
                    onPress={() => handleGrantSubscription(selectedUser, "team")}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.warning + "10", opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={[styles.actionIconBg, { backgroundColor: colors.warning + "20" }]}>
                      <IconSymbol name="person.3.fill" size={18} color={colors.warning} />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionTitle, { color: colors.foreground }]}>{translate("grantTeam")}</Text>
                      <Text style={[styles.actionDesc, { color: colors.muted }]}>20,000 XAF — 5 {translate("members")}</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </Pressable>

                  {/* Revoke Subscription */}
                  <Pressable
                    onPress={() => handleRevokeSubscription(selectedUser)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.error + "10", opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={[styles.actionIconBg, { backgroundColor: colors.error + "20" }]}>
                      <IconSymbol name="xmark.circle.fill" size={18} color={colors.error} />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionTitle, { color: colors.error }]}>{translate("revokeAccess")}</Text>
                      <Text style={[styles.actionDesc, { color: colors.error + "99" }]}>Remove subscription and restrict access</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.error} />
                  </Pressable>

                  {/* Toggle Role */}
                  <Pressable
                    onPress={() => handleToggleRole(selectedUser)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1, marginTop: 16 }]}
                  >
                    <View style={[styles.actionIconBg, { backgroundColor: colors.primary + "20" }]}>
                      <IconSymbol name="shield.fill" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                        {selectedUser.role === "admin" ? translate("setAsUser") : translate("setAsAdmin")}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </Pressable>

                  {/* Toggle Status */}
                  <Pressable
                    onPress={() => handleToggleStatus(selectedUser)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <View style={[styles.actionIconBg, { backgroundColor: selectedUser.status === "active" ? colors.error + "20" : colors.success + "20" }]}>
                      <IconSymbol
                        name={selectedUser.status === "active" ? "person.fill.xmark" : ("checkmark.circle.fill" as any)}
                        size={18}
                        color={selectedUser.status === "active" ? colors.error : colors.success}
                      />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                        {selectedUser.status === "active" ? translate("restrictAccess") : translate("grantAccess")}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </Pressable>

                  {/* Delete User */}
                  <Pressable
                    onPress={() => handleDeleteUser(selectedUser)}
                    style={({ pressed }) => [styles.actionBtn, { backgroundColor: colors.error + "10", opacity: pressed ? 0.7 : 1, marginTop: 16 }]}
                  >
                    <View style={[styles.actionIconBg, { backgroundColor: colors.error + "20" }]}>
                      <IconSymbol name="trash.fill" size={18} color={colors.error} />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionTitle, { color: colors.error }]}>{translate("deleteUser")}</Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.error} />
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Payment Requests Modal */}
      <Modal visible={paymentListVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPaymentListVisible(false)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View style={styles.paymentModalHeader}>
            <Pressable onPress={() => setPaymentListVisible(false)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              <Text style={[styles.paymentModalClose, { color: colors.primary }]}>{translate("cancel")}</Text>
            </Pressable>
            <Text style={[styles.paymentModalTitle, { color: colors.foreground }]}>{translate("paymentRequests")}</Text>
            <View style={{ width: 60 }} />
          </View>

          <View style={styles.paymentModalContent}>
            {/* Payment Stats */}
            <View style={styles.paymentStatsRow}>
              <View style={[styles.paymentStatItem, { backgroundColor: colors.warning + "15" }]}>
                <Text style={[styles.paymentStatValue, { color: colors.warning }]}>{paymentStats.pending}</Text>
                <Text style={[styles.paymentStatLabel, { color: colors.muted }]}>{translate("pendingPayments")}</Text>
              </View>
              <View style={[styles.paymentStatItem, { backgroundColor: colors.success + "15" }]}>
                <Text style={[styles.paymentStatValue, { color: colors.success }]}>{paymentStats.approved}</Text>
                <Text style={[styles.paymentStatLabel, { color: colors.muted }]}>{translate("approvedPayments")}</Text>
              </View>
              <View style={[styles.paymentStatItem, { backgroundColor: colors.error + "15" }]}>
                <Text style={[styles.paymentStatValue, { color: colors.error }]}>{paymentStats.rejected}</Text>
                <Text style={[styles.paymentStatLabel, { color: colors.muted }]}>{translate("rejectedPayments")}</Text>
              </View>
            </View>

            {/* Filter Tabs */}
            <View style={styles.paymentFilterRow}>
              {(["pending", "approved", "rejected", "all"] as const).map((filter) => (
                <Pressable
                  key={filter}
                  onPress={() => setPaymentFilter(filter)}
                  style={[styles.paymentFilterBtn, {
                    backgroundColor: paymentFilter === filter ? colors.primary : "transparent",
                    borderColor: paymentFilter === filter ? colors.primary : colors.border,
                  }]}
                >
                  <Text style={[styles.paymentFilterBtnText, {
                    color: paymentFilter === filter ? "#FFF" : colors.muted,
                  }]}>
                    {filter === "pending" ? translate("pendingPayments") :
                     filter === "approved" ? translate("approvedPayments") :
                     filter === "rejected" ? translate("rejectedPayments") : "All"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Payment List */}
            <FlatList
              data={filteredPayments}
              keyExtractor={(item: any) => String(item.id)}
              renderItem={({ item }: { item: any }) => (
                <View style={[styles.paymentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.paymentCardHeader}>
                    <Text style={[styles.paymentCardUser, { color: colors.foreground }]} numberOfLines={1}>
                      {item.userName || item.userPhone}
                    </Text>
                    <Text style={[styles.paymentCardStatus, {
                      color: item.status === "pending" ? colors.warning : item.status === "approved" ? colors.success : colors.error,
                      backgroundColor: (item.status === "pending" ? colors.warning : item.status === "approved" ? colors.success : colors.error) + "15",
                    }]}>
                      {item.status === "pending" ? translate("paymentPending") :
                       item.status === "approved" ? translate("paymentApproved") :
                       translate("paymentRejected")}
                    </Text>
                  </View>
                  <View style={styles.paymentCardDetails}>
                    <Text style={[styles.paymentCardDetail, { color: colors.foreground }]}>
                      {item.plan === "solo" ? translate("soloPlan") : translate("teamPlan")} — {item.amount?.toLocaleString()} XAF
                    </Text>
                    <Text style={[styles.paymentCardDetail, { color: colors.muted }]}>
                      {item.paymentMethod === "mtn_momo" ? "MTN MoMo" : item.paymentMethod === "airtel_money" ? "Airtel Money" : item.paymentMethod === "cash" ? translate("cashPayment") : "WhatsApp"}
                      {item.transactionRef ? ` • Ref: ${item.transactionRef}` : ""}
                    </Text>
                    <Text style={[styles.paymentCardDetail, { color: colors.muted }]}>
                      {translate("phone")}: {item.userPhone} • {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {item.status === "pending" && (
                    <View style={styles.paymentCardActions}>
                      <Pressable
                        onPress={() => handleApprovePayment(item.id, item.userName || item.userPhone)}
                        style={({ pressed }) => [styles.paymentActionBtn, { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 }]}
                      >
                        <Text style={[styles.paymentActionBtnText, { color: "#FFF" }]}>{translate("approvePayment")}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleRejectPayment(item.id, item.userName || item.userPhone)}
                        style={({ pressed }) => [styles.paymentActionBtn, { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 }]}
                      >
                        <Text style={[styles.paymentActionBtnText, { color: "#FFF" }]}>{translate("rejectPayment")}</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <IconSymbol name="creditcard.fill" size={48} color={colors.muted} />
                  <Text style={[styles.emptyText, { color: colors.muted }]}>{translate("noPaymentRequests")}</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24, marginTop: 8 },
  statCard: { flex: 1, minWidth: "45%", padding: 14, borderRadius: 14, borderWidth: 1, alignItems: "center", gap: 6 },
  statIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 24, fontWeight: "800" },
  statLabel: { fontSize: 12, fontWeight: "500", textAlign: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  userItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 14, marginBottom: 8 },
  userLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700" },
  userInfo: { marginLeft: 12, flex: 1 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: { fontSize: 15, fontWeight: "600", flexShrink: 1 },
  userPhone: { fontSize: 13, marginTop: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: "600" },
  subBadgeRow: { flexDirection: "row", marginTop: 4 },
  subBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  subBadgeText: { fontSize: 11, fontWeight: "600" },
  userRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: "500" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  modalClose: { fontSize: 16, fontWeight: "600" },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalContent: { paddingHorizontal: 20 },
  detailHeader: { alignItems: "center", paddingVertical: 20, gap: 6 },
  detailAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  detailAvatarText: { fontSize: 28, fontWeight: "700" },
  detailName: { fontSize: 22, fontWeight: "700" },
  detailPhone: { fontSize: 14 },
  detailBadges: { flexDirection: "row", gap: 8, marginTop: 8 },
  detailBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  detailBadgeText: { fontSize: 13, fontWeight: "600" },
  infoCard: { borderRadius: 14, padding: 16, marginBottom: 24 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  infoLabel: { fontSize: 14, fontWeight: "500" },
  infoValue: { fontSize: 14, fontWeight: "600" },
  infoDivider: { height: 1 },
  actionSectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  actionBtn: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, marginBottom: 8 },
  actionIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  actionInfo: { flex: 1, marginLeft: 12 },
  actionTitle: { fontSize: 15, fontWeight: "600" },
  actionDesc: { fontSize: 12, marginTop: 2 },
  paymentBanner: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20, gap: 12 },
  paymentBannerIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  paymentBannerTitle: { fontSize: 15, fontWeight: "700" },
  paymentBannerSubtitle: { fontSize: 12, marginTop: 2 },
  paymentFilterRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  paymentFilterBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  paymentFilterBtnText: { fontSize: 13, fontWeight: "600" },
  paymentCard: { padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  paymentCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  paymentCardUser: { fontSize: 15, fontWeight: "700", flex: 1 },
  paymentCardStatus: { fontSize: 12, fontWeight: "600", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  paymentCardDetails: { gap: 4, marginBottom: 10 },
  paymentCardDetail: { fontSize: 13 },
  paymentCardActions: { flexDirection: "row", gap: 10 },
  paymentActionBtn: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10 },
  paymentActionBtnText: { fontSize: 14, fontWeight: "600" },
  paymentModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  paymentModalTitle: { fontSize: 18, fontWeight: "700" },
  paymentModalClose: { fontSize: 16, fontWeight: "600" },
  paymentModalContent: { paddingHorizontal: 20, flex: 1 },
  paymentStatsRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  paymentStatItem: { flex: 1, alignItems: "center", padding: 10, borderRadius: 10 },
  paymentStatValue: { fontSize: 20, fontWeight: "800" },
  paymentStatLabel: { fontSize: 11, fontWeight: "500", marginTop: 2 },
});
