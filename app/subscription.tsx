import { useState } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";

const WHATSAPP_NUMBER = "+242056184503";

export default function SubscriptionScreen() {
  const { translate } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();

  const subQuery = trpc.subscription.status.useQuery(undefined, { retry: false });
  const checkQuery = trpc.subscription.check.useQuery(undefined, { retry: false });

  const sub = subQuery.data;
  const check = checkQuery.data;

  const openWhatsApp = (plan: string, amount: string) => {
    const userName = user?.name || "User";
    const userPhone = (user as any)?.phone || "N/A";
    const message = translate("whatsAppPaymentMsg")
      .replace("{plan}", plan)
      .replace("{name}", userName)
      .replace("{phone}", userPhone)
      .replace("{amount}", amount);

    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/${WHATSAPP_NUMBER.replace("+", "")}?text=${encoded}`;

    Linking.openURL(url).catch(() => {
      Alert.alert(translate("error"), "Could not open WhatsApp");
    });
  };

  const isActive = check?.valid === true;
  const isTrial = check?.reason === "free_trial";
  const isAdmin = check?.reason === "admin";

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
            {translate("subscription")}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Current Status */}
        <View style={[styles.statusCard, { backgroundColor: isActive ? colors.success + "15" : colors.error + "15", borderColor: isActive ? colors.success : colors.error }]}>
          <View style={[styles.statusIconBg, { backgroundColor: isActive ? colors.success + "25" : colors.error + "25" }]}>
            <IconSymbol name={isActive ? "checkmark.circle.fill" : "xmark.circle.fill"} size={32} color={isActive ? colors.success : colors.error} />
          </View>
          <View style={styles.statusInfo}>
            <Text style={[styles.statusTitle, { color: colors.foreground }]}>
              {isAdmin ? translate("admin") : isTrial ? translate("freeTrial") : isActive ? translate("subscriptionActive") : translate("subscriptionExpired")}
            </Text>
            {sub && sub.endDate && (
              <Text style={[styles.statusSubtitle, { color: colors.muted }]}>
                {sub.daysRemaining > 0
                  ? `${sub.daysRemaining} ${translate("daysRemaining")}`
                  : translate("subscriptionExpiredDesc")}
              </Text>
            )}
            {sub && (
              <Text style={[styles.statusPlan, { color: colors.primary }]}>
                {translate("currentPlan")}: {sub.plan === "free" ? translate("freeTrial") : sub.plan === "solo" ? translate("soloPlan") : translate("teamPlan")}
              </Text>
            )}
          </View>
        </View>

        {/* Plans */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
          {translate("subscriptionPlans")}
        </Text>

        {/* Free Trial */}
        <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.planHeader}>
            <View style={[styles.planIconBg, { backgroundColor: colors.muted + "20" }]}>
              <IconSymbol name="clock.fill" size={24} color={colors.muted} />
            </View>
            <View style={styles.planInfo}>
              <Text style={[styles.planName, { color: colors.foreground }]}>
                {translate("freeTrial")}
              </Text>
              <Text style={[styles.planPrice, { color: colors.muted }]}>
                0 XAF
              </Text>
            </View>
          </View>
          <Text style={[styles.planDesc, { color: colors.muted }]}>
            {translate("freeTrialDesc")}
          </Text>
        </View>

        {/* Solo Plan */}
        <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 2 }]}>
          <View style={styles.planHeader}>
            <View style={[styles.planIconBg, { backgroundColor: colors.primary + "20" }]}>
              <IconSymbol name="person.fill" size={24} color={colors.primary} />
            </View>
            <View style={styles.planInfo}>
              <Text style={[styles.planName, { color: colors.foreground }]}>
                {translate("soloPlan")}
              </Text>
              <View style={styles.priceRow}>
                <Text style={[styles.planPriceAmount, { color: colors.primary }]}>
                  10,000 XAF
                </Text>
                <Text style={[styles.planPricePeriod, { color: colors.muted }]}>
                  {translate("perYear")}
                </Text>
              </View>
            </View>
          </View>
          <Text style={[styles.planDesc, { color: colors.muted }]}>
            {translate("soloPlanDesc")}
          </Text>
          <Pressable
            onPress={() => openWhatsApp("Solo (10,000 XAF/year)", "10,000 XAF")}
            style={({ pressed }) => [
              styles.subscribeBtn,
              { backgroundColor: "#25D366", opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <IconSymbol name="message.fill" size={20} color="#FFF" />
            <Text style={styles.subscribeBtnText}>{translate("payViaWhatsApp")}</Text>
          </Pressable>
        </View>

        {/* Team Plan */}
        <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.warning, borderWidth: 2 }]}>
          <View style={[styles.popularBadge, { backgroundColor: colors.warning }]}>
            <Text style={styles.popularBadgeText}>POPULAR</Text>
          </View>
          <View style={styles.planHeader}>
            <View style={[styles.planIconBg, { backgroundColor: colors.warning + "20" }]}>
              <IconSymbol name="person.3.fill" size={24} color={colors.warning} />
            </View>
            <View style={styles.planInfo}>
              <Text style={[styles.planName, { color: colors.foreground }]}>
                {translate("teamPlan")}
              </Text>
              <View style={styles.priceRow}>
                <Text style={[styles.planPriceAmount, { color: colors.warning }]}>
                  20,000 XAF
                </Text>
                <Text style={[styles.planPricePeriod, { color: colors.muted }]}>
                  {translate("perYear")}
                </Text>
              </View>
            </View>
          </View>
          <Text style={[styles.planDesc, { color: colors.muted }]}>
            {translate("teamPlanDesc")}
          </Text>
          <View style={styles.teamFeatures}>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>
              • {translate("members")}: 5 max
            </Text>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>
              • {translate("inviteMember")}
            </Text>
          </View>
          <Pressable
            onPress={() => openWhatsApp("Team (20,000 XAF/year)", "20,000 XAF")}
            style={({ pressed }) => [
              styles.subscribeBtn,
              { backgroundColor: "#25D366", opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <IconSymbol name="message.fill" size={20} color="#FFF" />
            <Text style={styles.subscribeBtnText}>{translate("payViaWhatsApp")}</Text>
          </Pressable>
        </View>

        {/* Contact Info */}
        <View style={[styles.contactCard, { backgroundColor: colors.surface }]}>
          <IconSymbol name="phone.fill" size={20} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.contactTitle, { color: colors.foreground }]}>
              {translate("contactAdmin")}
            </Text>
            <Text style={[styles.contactNumber, { color: colors.primary }]}>
              {WHATSAPP_NUMBER}
            </Text>
          </View>
          <Pressable
            onPress={() => Linking.openURL(`tel:${WHATSAPP_NUMBER}`)}
            style={({ pressed }) => [
              styles.callBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <IconSymbol name="phone.fill" size={16} color="#FFF" />
          </Pressable>
        </View>
      </ScrollView>
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
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  statusIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statusInfo: {
    flex: 1,
    marginLeft: 14,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  statusSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  statusPlan: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "800",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  planCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    position: "relative",
    overflow: "hidden",
  },
  popularBadge: {
    position: "absolute",
    top: 12,
    right: -28,
    paddingHorizontal: 32,
    paddingVertical: 4,
    transform: [{ rotate: "45deg" }],
  },
  popularBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  planIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  planInfo: {
    marginLeft: 14,
    flex: 1,
  },
  planName: {
    fontSize: 18,
    fontWeight: "700",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  planPriceAmount: {
    fontSize: 22,
    fontWeight: "800",
  },
  planPricePeriod: {
    fontSize: 14,
    fontWeight: "500",
  },
  planPrice: {
    fontSize: 16,
    fontWeight: "600",
  },
  planDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  teamFeatures: {
    marginBottom: 12,
    gap: 4,
  },
  featureItem: {
    fontSize: 14,
    fontWeight: "500",
  },
  subscribeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  subscribeBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  contactNumber: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
