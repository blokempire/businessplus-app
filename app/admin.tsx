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
  loginMethod: string | null;
  role: "user" | "admin";
  status: "active" | "restricted";
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

type UserStats = {
  total: number;
  active: number;
  restricted: number;
  admins: number;
};

export default function AdminScreen() {
  const { translate, state } = useApp();
  const colors = useColors();
  const router = useRouter();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [stats, setStats] = useState<UserStats>({ total: 0, active: 0, restricted: 0, admins: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const utils = trpc.useUtils();

  const statsQuery = trpc.admin.stats.useQuery(undefined, {
    retry: false,
  });

  // Handle access denied
  useEffect(() => {
    if (statsQuery.error) {
      const err = statsQuery.error as any;
      if (err?.data?.code === "FORBIDDEN") {
        Alert.alert(translate("error"), "Access denied");
        router.back();
      }
    }
  }, [statsQuery.error]);

  const usersQuery = trpc.admin.listUsers.useQuery(undefined, {
    retry: false,
  });

  const setRoleMutation = trpc.admin.setRole.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("roleUpdated"));
      refetchAll();
    },
    onError: (err: any) => {
      Alert.alert(translate("error"), err.message);
    },
  });

  const setStatusMutation = trpc.admin.setStatus.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("statusUpdated"));
      refetchAll();
    },
    onError: (err: any) => {
      Alert.alert(translate("error"), err.message);
    },
  });

  const deleteUserMutation = trpc.admin.deleteUser.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("userDeleted"));
      setDetailVisible(false);
      setSelectedUser(null);
      refetchAll();
    },
    onError: (err: any) => {
      Alert.alert(translate("error"), err.message);
    },
  });

  useEffect(() => {
    if (statsQuery.data) {
      setStats(statsQuery.data as UserStats);
    }
  }, [statsQuery.data]);

  useEffect(() => {
    if (usersQuery.data) {
      setUsers(usersQuery.data as UserRecord[]);
    }
    setLoading(usersQuery.isLoading);
  }, [usersQuery.data, usersQuery.isLoading]);

  const refetchAll = useCallback(() => {
    utils.admin.stats.invalidate();
    utils.admin.listUsers.invalidate();
  }, [utils]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchAll();
    setRefreshing(false);
  }, [refetchAll]);

  const handleToggleRole = (user: UserRecord) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    const label = newRole === "admin" ? translate("setAsAdmin") : translate("setAsUser");
    Alert.alert(
      label,
      `${user.name || user.email || user.openId}`,
      [
        { text: translate("cancel"), style: "cancel" },
        {
          text: translate("confirm"),
          onPress: () => setRoleMutation.mutate({ id: user.id, role: newRole }),
        },
      ]
    );
  };

  const handleToggleStatus = (user: UserRecord) => {
    const newStatus = user.status === "active" ? "restricted" : "active";
    const label = newStatus === "restricted" ? translate("restrictAccess") : translate("grantAccess");
    Alert.alert(
      label,
      `${user.name || user.email || user.openId}`,
      [
        { text: translate("cancel"), style: "cancel" },
        {
          text: translate("confirm"),
          style: newStatus === "restricted" ? "destructive" : "default",
          onPress: () => setStatusMutation.mutate({ id: user.id, status: newStatus }),
        },
      ]
    );
  };

  const handleDeleteUser = (user: UserRecord) => {
    Alert.alert(
      translate("deleteUser"),
      translate("deleteUserConfirm"),
      [
        { text: translate("cancel"), style: "cancel" },
        {
          text: translate("delete"),
          style: "destructive",
          onPress: () => deleteUserMutation.mutate({ id: user.id }),
        },
      ]
    );
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString(state.language === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString(state.language === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const openUserDetail = (user: UserRecord) => {
    setSelectedUser(user);
    setDetailVisible(true);
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
      onPress={() => openUserDetail(item)}
      style={({ pressed }) => [
        styles.userItem,
        { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.userLeft}>
        <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {(item.name || item.email || "U")[0].toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, { color: colors.foreground }]} numberOfLines={1}>
              {item.name || item.email || `User #${item.id}`}
            </Text>
            {item.role === "admin" && (
              <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>
                  {translate("admin")}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.userEmail, { color: colors.muted }]} numberOfLines={1}>
            {item.email || item.openId}
          </Text>
          <Text style={[styles.userDate, { color: colors.muted }]}>
            {translate("lastActive")}: {formatDate(item.lastSignedIn)}
          </Text>
        </View>
      </View>
      <View style={styles.userRight}>
        <View
          style={[
            styles.statusDot,
            { backgroundColor: item.status === "active" ? colors.success : colors.error },
          ]}
        />
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </View>
    </Pressable>
  );

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="flex-1">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
        >
          <IconSymbol name="chevron.left.forwardslash.chevron.right" size={24} color={colors.primary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {translate("adminPanel")}
        </Text>
        <View style={{ width: 24 }} />
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListHeaderComponent={
            <View>
              {/* Stats Cards */}
              <View style={styles.statsGrid}>
                {renderStatCard(translate("totalUsers"), stats.total, colors.primary, "person.2.fill")}
                {renderStatCard(translate("activeUsers"), stats.active, colors.success, "checkmark.circle.fill")}
                {renderStatCard(translate("restrictedUsers"), stats.restricted, colors.error, "person.fill.xmark")}
                {renderStatCard(translate("adminUsers"), stats.admins, colors.warning, "shield.fill")}
              </View>

              {/* Section Title */}
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                {translate("userManagement")}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {translate("noUsers")}
              </Text>
            </View>
          }
        />
      )}

      {/* User Detail Modal */}
      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <Pressable
                  onPress={() => setDetailVisible(false)}
                  style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.modalClose, { color: colors.primary }]}>
                    {translate("cancel")}
                  </Text>
                </Pressable>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {translate("userDetails")}
                </Text>
                <View style={{ width: 60 }} />
              </View>

              {selectedUser && (
                <View style={styles.modalContent}>
                  {/* User Avatar & Name */}
                  <View style={styles.detailHeader}>
                    <View style={[styles.detailAvatar, { backgroundColor: colors.primary + "20" }]}>
                      <Text style={[styles.detailAvatarText, { color: colors.primary }]}>
                        {(selectedUser.name || selectedUser.email || "U")[0].toUpperCase()}
                      </Text>
                    </View>
                    <Text style={[styles.detailName, { color: colors.foreground }]}>
                      {selectedUser.name || `User #${selectedUser.id}`}
                    </Text>
                    <Text style={[styles.detailEmail, { color: colors.muted }]}>
                      {selectedUser.email || selectedUser.openId}
                    </Text>
                    <View style={styles.detailBadges}>
                      <View
                        style={[
                          styles.detailBadge,
                          {
                            backgroundColor:
                              selectedUser.role === "admin"
                                ? colors.primary + "20"
                                : colors.muted + "20",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.detailBadgeText,
                            {
                              color:
                                selectedUser.role === "admin" ? colors.primary : colors.muted,
                            },
                          ]}
                        >
                          {selectedUser.role === "admin" ? translate("admin") : translate("user")}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.detailBadge,
                          {
                            backgroundColor:
                              selectedUser.status === "active"
                                ? colors.success + "20"
                                : colors.error + "20",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.detailBadgeText,
                            {
                              color:
                                selectedUser.status === "active" ? colors.success : colors.error,
                            },
                          ]}
                        >
                          {selectedUser.status === "active"
                            ? translate("active")
                            : translate("restricted")}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Info Cards */}
                  <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>ID</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>
                        #{selectedUser.id}
                      </Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>
                        {translate("joined")}
                      </Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>
                        {formatDateTime(selectedUser.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>
                        {translate("lastActive")}
                      </Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>
                        {formatDateTime(selectedUser.lastSignedIn)}
                      </Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoRow}>
                      <Text style={[styles.infoLabel, { color: colors.muted }]}>Login</Text>
                      <Text style={[styles.infoValue, { color: colors.foreground }]}>
                        {selectedUser.loginMethod || "OAuth"}
                      </Text>
                    </View>
                  </View>

                  {/* Actions */}
                  <Text style={[styles.actionSectionTitle, { color: colors.foreground }]}>
                    {translate("manageAccess")}
                  </Text>

                  {/* Toggle Role */}
                  <Pressable
                    onPress={() => handleToggleRole(selectedUser)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={[styles.actionIconBg, { backgroundColor: colors.primary + "20" }]}>
                      <IconSymbol name="shield.fill" size={18} color={colors.primary} />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                        {selectedUser.role === "admin"
                          ? translate("setAsUser")
                          : translate("setAsAdmin")}
                      </Text>
                      <Text style={[styles.actionDesc, { color: colors.muted }]}>
                        {selectedUser.role === "admin"
                          ? "Remove admin privileges"
                          : "Grant admin privileges"}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </Pressable>

                  {/* Toggle Status */}
                  <Pressable
                    onPress={() => handleToggleStatus(selectedUser)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      { backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View
                      style={[
                        styles.actionIconBg,
                        {
                          backgroundColor:
                            selectedUser.status === "active"
                              ? colors.error + "20"
                              : colors.success + "20",
                        },
                      ]}
                    >
                      <IconSymbol
                        name={
                          selectedUser.status === "active"
                            ? "person.fill.xmark"
                            : ("checkmark.circle.fill" as any)
                        }
                        size={18}
                        color={selectedUser.status === "active" ? colors.error : colors.success}
                      />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionTitle, { color: colors.foreground }]}>
                        {selectedUser.status === "active"
                          ? translate("restrictAccess")
                          : translate("grantAccess")}
                      </Text>
                      <Text style={[styles.actionDesc, { color: colors.muted }]}>
                        {selectedUser.status === "active"
                          ? "Block this user from accessing the app"
                          : "Allow this user to access the app again"}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.muted} />
                  </Pressable>

                  {/* Delete User */}
                  <Pressable
                    onPress={() => handleDeleteUser(selectedUser)}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      {
                        backgroundColor: colors.error + "10",
                        opacity: pressed ? 0.7 : 1,
                        marginTop: 16,
                      },
                    ]}
                  >
                    <View style={[styles.actionIconBg, { backgroundColor: colors.error + "20" }]}>
                      <IconSymbol name="trash.fill" size={18} color={colors.error} />
                    </View>
                    <View style={styles.actionInfo}>
                      <Text style={[styles.actionTitle, { color: colors.error }]}>
                        {translate("deleteUser")}
                      </Text>
                      <Text style={[styles.actionDesc, { color: colors.error + "99" }]}>
                        Permanently remove this user and all their data
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={16} color={colors.error} />
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
    marginTop: 8,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    gap: 6,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  userLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  userInfo: {
    marginLeft: 12,
    flex: 1,
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    flexShrink: 1,
  },
  userEmail: {
    fontSize: 13,
    marginTop: 1,
  },
  userDate: {
    fontSize: 11,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  userRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: "500",
  },
  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  modalClose: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalContent: {
    paddingHorizontal: 20,
  },
  detailHeader: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 6,
  },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAvatarText: {
    fontSize: 28,
    fontWeight: "700",
  },
  detailName: {
    fontSize: 22,
    fontWeight: "700",
  },
  detailEmail: {
    fontSize: 14,
  },
  detailBadges: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  detailBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  detailBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  infoCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoDivider: {
    height: 1,
  },
  actionSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
  },
  actionIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  actionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
});
