import { useState, useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";

type CompanyRole = "manager" | "cashier" | "viewer";

export default function CompanyScreen() {
  const { translate } = useApp();
  const colors = useColors();
  const router = useRouter();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyRole>("cashier");
  const [creating, setCreating] = useState(false);
  const [inviting, setInviting] = useState(false);

  const utils = trpc.useUtils();

  const companyQuery = trpc.company.info.useQuery(undefined, { retry: false });
  const pendingQuery = trpc.company.pendingInvitations.useQuery(undefined, { retry: false });

  const company = companyQuery.data;
  const pendingInvitations = pendingQuery.data || [];

  const createMutation = trpc.company.create.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("companyCreated"));
      setShowCreateModal(false);
      setCompanyName("");
      utils.company.info.invalidate();
    },
    onError: (err: any) => {
      Alert.alert(translate("error"), err.message);
    },
  });

  const inviteMutation = trpc.company.invite.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("invitationSent"));
      setShowInviteModal(false);
      setInvitePhone("");
      utils.company.info.invalidate();
    },
    onError: (err: any) => {
      Alert.alert(translate("error"), err.message);
    },
  });

  const acceptMutation = trpc.company.acceptInvitation.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("invitationAccepted"));
      utils.company.info.invalidate();
      utils.company.pendingInvitations.invalidate();
    },
    onError: (err: any) => {
      Alert.alert(translate("error"), err.message);
    },
  });

  const rejectMutation = trpc.company.rejectInvitation.useMutation({
    onSuccess: () => {
      utils.company.pendingInvitations.invalidate();
    },
    onError: (err: any) => {
      Alert.alert(translate("error"), err.message);
    },
  });

  const removeMutation = trpc.company.removeMember.useMutation({
    onSuccess: () => {
      Alert.alert(translate("success"), translate("memberRemoved"));
      utils.company.info.invalidate();
    },
    onError: (err: any) => {
      Alert.alert(translate("error"), err.message);
    },
  });

  const handleCreate = () => {
    if (!companyName.trim()) return;
    createMutation.mutate({ name: companyName.trim() });
  };

  const handleInvite = () => {
    if (!invitePhone.trim()) return;
    inviteMutation.mutate({ phone: invitePhone.trim(), role: inviteRole });
  };

  const handleRemoveMember = (memberId: number, memberName: string) => {
    Alert.alert(
      translate("removeMember"),
      `${translate("removeMemberConfirm")} ${memberName}?`,
      [
        { text: translate("cancel"), style: "cancel" },
        {
          text: translate("remove"),
          style: "destructive",
          onPress: () => removeMutation.mutate({ userId: memberId }),
        },
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "owner": return colors.primary;
      case "manager": return colors.warning;
      case "cashier": return colors.success;
      default: return colors.muted;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner": return translate("owner");
      case "manager": return translate("manager");
      case "cashier": return translate("cashier");
      case "viewer": return translate("viewer");
      default: return role;
    }
  };

  const hasCompany = company && company.company;
  const isOwner = hasCompany ? company.company.ownerId === (company.members?.find((m: any) => m.companyRole === "owner")?.id ?? -1) : false;
  const members = company?.members || [];

  return (
    <ScreenContainer edges={["top", "left", "right"]} className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <IconSymbol name="chevron.right" size={24} color={colors.primary} style={{ transform: [{ scaleX: -1 }] }} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {translate("companyGroup")}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={[styles.sectionTitle, { color: colors.warning }]}>
              {translate("pendingInvitations")}
            </Text>
            {pendingInvitations.map((inv: any) => (
              <View key={inv.id} style={[styles.invitationCard, { backgroundColor: colors.warning + "10", borderColor: colors.warning }]}>
                <View style={styles.invitationInfo}>
                  <Text style={[styles.invitationText, { color: colors.foreground }]}>
                    {translate("invitedToJoin")}
                  </Text>
                  <Text style={[styles.invitationRole, { color: colors.warning }]}>
                    {translate("selectRole")}: {getRoleLabel(inv.role)}
                  </Text>
                </View>
                <View style={styles.invitationActions}>
                  <Pressable
                    onPress={() => acceptMutation.mutate({ invitationId: inv.id })}
                    style={({ pressed }) => [
                      styles.invActionBtn,
                      { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <IconSymbol name="checkmark" size={18} color="#FFF" />
                  </Pressable>
                  <Pressable
                    onPress={() => rejectMutation.mutate({ invitationId: inv.id })}
                    style={({ pressed }) => [
                      styles.invActionBtn,
                      { backgroundColor: colors.error, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <IconSymbol name="xmark" size={18} color="#FFF" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {hasCompany ? (
          <>
            {/* Company Info */}
            <View style={[styles.companyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.companyIconBg, { backgroundColor: colors.primary + "20" }]}>
                <IconSymbol name="building.2.fill" size={32} color={colors.primary} />
              </View>
              <Text style={[styles.companyName, { color: colors.foreground }]}>
                {company.company.name}
              </Text>
              <Text style={[styles.companyMeta, { color: colors.muted }]}>
                {members.length}/{company.company.maxMembers} {translate("members")}
              </Text>
            </View>

            {/* Members List */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              {translate("members")}
            </Text>
            {members.map((member: any) => (
              <View key={member.id} style={[styles.memberRow, { backgroundColor: colors.surface }]}>
                <View style={[styles.memberAvatar, { backgroundColor: getRoleColor(member.companyRole) + "20" }]}>
                  <Text style={[styles.memberAvatarText, { color: getRoleColor(member.companyRole) }]}>
                    {(member.name || "U")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={[styles.memberName, { color: colors.foreground }]}>
                    {member.name || `User #${member.id}`}
                  </Text>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(member.companyRole) + "20" }]}>
                    <Text style={[styles.roleBadgeText, { color: getRoleColor(member.companyRole) }]}>
                      {getRoleLabel(member.companyRole)}
                    </Text>
                  </View>
                </View>
                {isOwner && member.companyRole !== "owner" && (
                  <Pressable
                    onPress={() => handleRemoveMember(member.id, member.name || `User #${member.id}`)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
                  >
                    <IconSymbol name="trash.fill" size={18} color={colors.error} />
                  </Pressable>
                )}
              </View>
            ))}

            {/* Invite Button */}
            {isOwner && members.length < (company.company.maxMembers || 5) && (
              <Pressable
                onPress={() => setShowInviteModal(true)}
                style={({ pressed }) => [
                  styles.inviteBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                ]}
              >
                <IconSymbol name="plus.circle.fill" size={22} color="#FFF" />
                <Text style={styles.inviteBtnText}>{translate("inviteMember")}</Text>
              </Pressable>
            )}
          </>
        ) : (
          /* No Company — Create or Wait */
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconBg, { backgroundColor: colors.primary + "15" }]}>
              <IconSymbol name="building.2.fill" size={48} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {translate("noCompany")}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.muted }]}>
              {translate("noCompanyDesc")}
            </Text>
            <Pressable
              onPress={() => setShowCreateModal(true)}
              style={({ pressed }) => [
                styles.createBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
              ]}
            >
              <IconSymbol name="plus.circle.fill" size={22} color="#FFF" />
              <Text style={styles.createBtnText}>{translate("createCompany")}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Create Company Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {translate("createCompany")}
                </Text>
                <Pressable onPress={() => setShowCreateModal(false)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                  <IconSymbol name="xmark" size={24} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>
                  {translate("companyName")}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder={translate("companyName")}
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />
                <Pressable
                  onPress={handleCreate}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    { backgroundColor: colors.primary, opacity: pressed || createMutation.isPending ? 0.7 : 1 },
                  ]}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalBtnText}>{translate("create")}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Invite Member Modal */}
      <Modal visible={showInviteModal} animationType="slide" transparent>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {translate("inviteMember")}
                </Text>
                <Pressable onPress={() => setShowInviteModal(false)} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
                  <IconSymbol name="xmark" size={24} color={colors.foreground} />
                </Pressable>
              </View>
              <View style={styles.modalBody}>
                <Text style={[styles.inputLabel, { color: colors.muted }]}>
                  {translate("phoneNumber")}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.surface }]}
                  value={invitePhone}
                  onChangeText={setInvitePhone}
                  placeholder="0XXXXXXXXX"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                />
                <Text style={[styles.inputLabel, { color: colors.muted, marginTop: 16 }]}>
                  {translate("selectRole")}
                </Text>
                <View style={styles.roleSelector}>
                  {(["manager", "cashier", "viewer"] as CompanyRole[]).map((role) => (
                    <Pressable
                      key={role}
                      onPress={() => setInviteRole(role)}
                      style={({ pressed }) => [
                        styles.roleOption,
                        {
                          backgroundColor: inviteRole === role ? getRoleColor(role) : colors.surface,
                          borderColor: getRoleColor(role),
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Text style={{ color: inviteRole === role ? "#FFF" : getRoleColor(role), fontWeight: "600", fontSize: 13 }}>
                        {getRoleLabel(role)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  onPress={handleInvite}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    { backgroundColor: colors.primary, opacity: pressed || inviteMutation.isPending ? 0.7 : 1 },
                  ]}
                  disabled={inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.modalBtnText}>{translate("sendInvitation")}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 4,
  },
  companyCard: {
    alignItems: "center",
    marginHorizontal: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    gap: 8,
  },
  companyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  companyName: {
    fontSize: 22,
    fontWeight: "800",
  },
  companyMeta: {
    fontSize: 14,
    fontWeight: "500",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderRadius: 14,
    marginBottom: 6,
  },
  memberAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    fontSize: 17,
    fontWeight: "700",
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
  },
  memberName: {
    fontSize: 15,
    fontWeight: "600",
  },
  roleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 16,
  },
  inviteBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  invitationCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  invitationInfo: {
    flex: 1,
  },
  invitationText: {
    fontSize: 15,
    fontWeight: "600",
  },
  invitationRole: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  invitationActions: {
    flexDirection: "row",
    gap: 8,
  },
  invActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  createBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
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
  modalBody: {
    paddingHorizontal: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  roleSelector: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  modalBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  modalBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
