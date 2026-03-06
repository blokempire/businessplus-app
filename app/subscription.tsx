import { useState, useCallback } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  Modal,
  TextInput,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/use-auth";
import * as ImagePicker from "expo-image-picker";

const WHATSAPP_NUMBER = "+242056184503";

// Country-specific mobile money numbers
const MOBILE_MONEY_NUMBERS: Record<string, { mtn?: string; airtel?: string; orange?: string; togocel?: string }> = {
  "+242": { mtn: "+242 06 998 05 77", airtel: "+242 05 618 45 03" },
  "+223": { orange: "+223 76 81 69 52" },
  "+228": { togocel: "+228 99 42 47 47" },
};

const COUNTRY_OPTIONS = [
  { code: "+242", label: "Congo Brazzaville", flag: "\u{1F1E8}\u{1F1EC}", methods: ["mtn_momo", "airtel_money"] },
  { code: "+223", label: "Mali", flag: "\u{1F1F2}\u{1F1F1}", methods: ["orange_money"] },
  { code: "+228", label: "Togo", flag: "\u{1F1F9}\u{1F1EC}", methods: ["togocel"] },
];

type PaymentMethod = "whatsapp" | "mtn_momo" | "airtel_money" | "cash" | "call";
type PlanInfo = { name: string; planKey: "solo" | "team"; amount: number; amountStr: string };

export default function SubscriptionScreen() {
  const { translate } = useApp();
  const colors = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [momoFlowVisible, setMomoFlowVisible] = useState(false);
  const [paymentHistoryVisible, setPaymentHistoryVisible] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanInfo | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [transactionRef, setTransactionRef] = useState("");
  const [proofImageUri, setProofImageUri] = useState<string | null>(null);
  const [paymentCountry, setPaymentCountry] = useState("+242");
  const [submitting, setSubmitting] = useState(false);

  const subQuery = trpc.subscription.status.useQuery(undefined, { retry: false });
  const checkQuery = trpc.subscription.check.useQuery(undefined, { retry: false });
  const myPaymentsQuery = trpc.payment.myRequests.useQuery(undefined, { retry: false });
  const submitPayment = trpc.payment.submit.useMutation();

  const sub = subQuery.data;
  const check = checkQuery.data;
  const myPayments = myPaymentsQuery.data || [];

  const userName = user?.name || "User";
  const userPhone = (user as any)?.phone || "N/A";

  const buildPaymentMessage = (plan: string, amount: string) => {
    return translate("whatsAppPaymentMsg")
      .replace("{plan}", plan)
      .replace("{name}", userName)
      .replace("{phone}", userPhone)
      .replace("{amount}", amount);
  };

  const handleSelectPlan = (planKey: "solo" | "team", name: string, amount: number, amountStr: string) => {
    // Check if user already has a pending payment for this plan
    const hasPending = myPayments.some(p => p.plan === planKey && p.status === "pending");
    if (hasPending) {
      Alert.alert(translate("paymentPending"), translate("alreadyPendingPayment"));
      return;
    }
    setSelectedPlan({ name, planKey, amount, amountStr });
    setPaymentModalVisible(true);
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    if (!selectedPlan) return;
    setSelectedMethod(method);
    setPaymentModalVisible(false);

    if (method === "mtn_momo" || method === "airtel_money") {
      // Show the mobile money flow with transaction reference input
      setTransactionRef("");
      setMomoFlowVisible(true);
    } else if (method === "whatsapp") {
      const message = buildPaymentMessage(selectedPlan.name, selectedPlan.amountStr);
      const encoded = encodeURIComponent(message);
      const url = `https://wa.me/${WHATSAPP_NUMBER.replace("+", "")}?text=${encoded}`;
      Linking.openURL(url).catch(() => {
        Alert.alert(translate("error"), "Could not open WhatsApp");
      });
      // Also submit a payment request for tracking
      submitPaymentRequest("whatsapp", "WhatsApp");
    } else if (method === "cash") {
      Alert.alert(
        translate("cashPayment"),
        translate("cashPaymentDesc"),
        [
          {
            text: translate("contactViaWhatsApp"),
            onPress: () => {
              const cashMsg = encodeURIComponent(
                `💵 ${translate("cashPaymentRequest")}\n${translate("name")}: ${userName}\n${translate("phone")}: ${userPhone}\n${translate("plan")}: ${selectedPlan.name}\n${translate("amount")}: ${selectedPlan.amountStr}`
              );
              Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER.replace("+", "")}?text=${cashMsg}`);
              submitPaymentRequest("cash", "Cash");
            },
          },
          { text: translate("cancel"), style: "cancel" },
        ]
      );
    } else if (method === "call") {
      Linking.openURL(`tel:${WHATSAPP_NUMBER}`).catch(() => {
        Alert.alert(translate("error"), "Could not make call");
      });
    }
  };

  const submitPaymentRequest = async (method: "mtn_momo" | "airtel_money" | "cash" | "whatsapp" | "other", ref?: string) => {
    if (!selectedPlan) return;
    try {
      await submitPayment.mutateAsync({
        plan: selectedPlan.planKey,
        amount: selectedPlan.amount,
        paymentMethod: method,
        transactionRef: ref || undefined,
      });
      myPaymentsQuery.refetch();
    } catch (e) {
      console.warn("Failed to submit payment request:", e);
    }
  };

  const handleMomoSubmit = async () => {
    if (!selectedPlan || !selectedMethod) return;
    if (!transactionRef.trim() && !proofImageUri) {
      Alert.alert(translate("error"), translate("enterTransactionRef"));
      return;
    }

    setSubmitting(true);
    try {
      // Build reference: use text ref, or indicate image proof was uploaded
      const refValue = transactionRef.trim() || (proofImageUri ? `[IMAGE_PROOF:${Date.now()}]` : "");
      await submitPayment.mutateAsync({
        plan: selectedPlan.planKey,
        amount: selectedPlan.amount,
        paymentMethod: selectedMethod as "mtn_momo" | "airtel_money",
        transactionRef: refValue,
      });
      setMomoFlowVisible(false);
      setTransactionRef("");
      setProofImageUri(null);
      myPaymentsQuery.refetch();

      // Also send confirmation via WhatsApp
      const confirmMsg = encodeURIComponent(
        `✅ ${selectedMethod === "mtn_momo" ? "MTN MoMo" : "Airtel Money"} Payment\n${translate("name")}: ${userName}\n${translate("phone")}: ${userPhone}\n${translate("plan")}: ${selectedPlan.name}\n${translate("amount")}: ${selectedPlan.amountStr}\nTransaction ID: ${transactionRef.trim()}`
      );

      Alert.alert(
        translate("paymentSubmitted"),
        translate("paymentSubmittedDesc"),
        [
          {
            text: translate("sendConfirmation"),
            onPress: () => {
              Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER.replace("+", "")}?text=${confirmMsg}`);
            },
          },
          { text: "OK" },
        ]
      );
    } catch (e: any) {
      Alert.alert(translate("error"), e.message || "Failed to submit payment");
    } finally {
      setSubmitting(false);
    }
  };

  const isActive = check?.valid === true;
  const isTrial = check?.reason === "free_trial";
  const isAdmin = check?.reason === "admin";

  const pendingCount = myPayments.filter(p => p.status === "pending").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return colors.warning;
      case "approved": return colors.success;
      case "rejected": return colors.error;
      default: return colors.muted;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case "mtn_momo": return "MTN MoMo";
      case "airtel_money": return "Airtel Money";
      case "cash": return translate("cashPayment");
      case "whatsapp": return "WhatsApp";
      default: return method;
    }
  };

  const renderPaymentItem = useCallback(({ item }: { item: any }) => (
    <View style={[styles.paymentItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.paymentItemHeader}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        <Text style={[styles.paymentItemPlan, { color: colors.foreground }]}>
          {item.plan === "solo" ? translate("soloPlan") : translate("teamPlan")} — {item.amount.toLocaleString()} XAF
        </Text>
      </View>
      <View style={styles.paymentItemDetails}>
        <Text style={[styles.paymentItemMethod, { color: colors.muted }]}>
          {getMethodLabel(item.paymentMethod)}
          {item.transactionRef ? ` • Ref: ${item.transactionRef}` : ""}
        </Text>
        <Text style={[styles.paymentItemStatus, { color: getStatusColor(item.status) }]}>
          {item.status === "pending" ? translate("pendingVerification") :
           item.status === "approved" ? translate("verifiedAndActivated") :
           translate("paymentNotVerified")}
        </Text>
        <Text style={[styles.paymentItemDate, { color: colors.muted }]}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    </View>
  ), [colors, translate]);

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

        {/* Pending Payment Banner */}
        {pendingCount > 0 && (
          <Pressable
            onPress={() => setPaymentHistoryVisible(true)}
            style={({ pressed }) => [
              styles.pendingBanner,
              { backgroundColor: colors.warning + "15", borderColor: colors.warning, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <IconSymbol name="clock.fill" size={20} color={colors.warning} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.pendingBannerText, { color: colors.foreground }]}>
                {pendingCount} {translate("pendingPayments").toLowerCase()}
              </Text>
              <Text style={[styles.pendingBannerSubtext, { color: colors.muted }]}>
                {translate("pendingVerification")}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        )}

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
                0 XAF — 7 {translate("days")}
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
                  /{translate("perYear")}
                </Text>
              </View>
            </View>
          </View>
          <Text style={[styles.planDesc, { color: colors.muted }]}>
            {translate("soloPlanDesc")}
          </Text>
          <View style={styles.planFeatures}>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>✓ {translate("unlimitedTransactions")}</Text>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>✓ {translate("cloudSync")}</Text>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>✓ {translate("pdfExport")}</Text>
          </View>
          <Pressable
            onPress={() => handleSelectPlan("solo", "Solo (10,000 XAF)", 10000, "10,000 XAF")}
            style={({ pressed }) => [
              styles.subscribeBtn,
              { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Text style={styles.subscribeBtnText}>{translate("subscribe")}</Text>
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
                  /{translate("perYear")}
                </Text>
              </View>
            </View>
          </View>
          <Text style={[styles.planDesc, { color: colors.muted }]}>
            {translate("teamPlanDesc")}
          </Text>
          <View style={styles.planFeatures}>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>✓ {translate("unlimitedTransactions")}</Text>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>✓ {translate("cloudSync")}</Text>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>✓ {translate("pdfExport")}</Text>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>✓ {translate("members")}: 5 max</Text>
            <Text style={[styles.featureItem, { color: colors.foreground }]}>✓ {translate("inviteMember")}</Text>
          </View>
          <Pressable
            onPress={() => handleSelectPlan("team", "Team (20,000 XAF)", 20000, "20,000 XAF")}
            style={({ pressed }) => [
              styles.subscribeBtn,
              { backgroundColor: colors.warning, opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Text style={styles.subscribeBtnText}>{translate("subscribe")}</Text>
          </Pressable>
        </View>

        {/* Payment History Link */}
        {myPayments.length > 0 && (
          <Pressable
            onPress={() => setPaymentHistoryVisible(true)}
            style={({ pressed }) => [
              styles.historyLink,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <IconSymbol name="clock.fill" size={20} color={colors.primary} />
            <Text style={[styles.historyLinkText, { color: colors.primary }]}>
              {translate("paymentHistory")} ({myPayments.length})
            </Text>
            <IconSymbol name="chevron.right" size={16} color={colors.muted} />
          </Pressable>
        )}

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

      {/* Payment Method Modal */}
      <Modal
        visible={paymentModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPaymentModalVisible(false)}
        >
          <View />
        </Pressable>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {translate("choosePaymentMethod")}
          </Text>
          {selectedPlan && (
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              {selectedPlan.name} — {selectedPlan.amountStr}/{translate("perYear")}
            </Text>
          )}

          {/* Country selector for payment */}
          <View style={{ flexDirection: "row", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {COUNTRY_OPTIONS.map((c) => (
              <Pressable
                key={c.code}
                onPress={() => setPaymentCountry(c.code)}
                style={({ pressed }) => [{
                  flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12,
                  borderRadius: 10, borderWidth: 1, gap: 4,
                  backgroundColor: paymentCountry === c.code ? colors.primary : colors.surface,
                  borderColor: paymentCountry === c.code ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                }]}
              >
                <Text style={{ fontSize: 14 }}>{c.flag}</Text>
                <Text style={{ color: paymentCountry === c.code ? "#FFF" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                  {c.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setPaymentCountry("other")}
              style={({ pressed }) => [{
                flexDirection: "row", alignItems: "center", paddingVertical: 8, paddingHorizontal: 12,
                borderRadius: 10, borderWidth: 1, gap: 4,
                backgroundColor: paymentCountry === "other" ? colors.primary : colors.surface,
                borderColor: paymentCountry === "other" ? colors.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
              }]}
            >
              <Text style={{ fontSize: 14 }}>🌍</Text>
              <Text style={{ color: paymentCountry === "other" ? "#FFF" : colors.foreground, fontWeight: "600", fontSize: 12 }}>
                {translate("otherCountry")}
              </Text>
            </Pressable>
          </View>

          {paymentCountry !== "other" ? (
            <>
              {/* MTN Mobile Money */}
              <Pressable
                onPress={() => handlePaymentMethodSelect("mtn_momo")}
                style={({ pressed }) => [
                  styles.paymentOption,
                  { backgroundColor: pressed ? colors.surface : "transparent", borderColor: colors.border },
                ]}
              >
                <View style={[styles.paymentIconBg, { backgroundColor: "#FFCC00" + "20" }]}>
                  <Text style={styles.paymentEmoji}>📱</Text>
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentName, { color: colors.foreground }]}>MTN Mobile Money</Text>
                  <Text style={[styles.paymentDesc, { color: colors.muted }]}>{translate("mtnMomoDesc")}</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </Pressable>

              {/* Airtel Money */}
              <Pressable
                onPress={() => handlePaymentMethodSelect("airtel_money")}
                style={({ pressed }) => [
                  styles.paymentOption,
                  { backgroundColor: pressed ? colors.surface : "transparent", borderColor: colors.border },
                ]}
              >
                <View style={[styles.paymentIconBg, { backgroundColor: "#ED1C24" + "20" }]}>
                  <Text style={styles.paymentEmoji}>📱</Text>
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentName, { color: colors.foreground }]}>Airtel Money</Text>
                  <Text style={[styles.paymentDesc, { color: colors.muted }]}>{translate("airtelMoneyDesc")}</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </Pressable>

              {/* WhatsApp */}
              <Pressable
                onPress={() => handlePaymentMethodSelect("whatsapp")}
                style={({ pressed }) => [
                  styles.paymentOption,
                  { backgroundColor: pressed ? colors.surface : "transparent", borderColor: colors.border },
                ]}
              >
                <View style={[styles.paymentIconBg, { backgroundColor: "#25D366" + "20" }]}>
                  <IconSymbol name="message.fill" size={24} color="#25D366" />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentName, { color: colors.foreground }]}>WhatsApp</Text>
                  <Text style={[styles.paymentDesc, { color: colors.muted }]}>{translate("payWhatsAppDesc")}</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </Pressable>

              {/* Cash */}
              <Pressable
                onPress={() => handlePaymentMethodSelect("cash")}
                style={({ pressed }) => [
                  styles.paymentOption,
                  { backgroundColor: pressed ? colors.surface : "transparent", borderColor: colors.border },
                ]}
              >
                <View style={[styles.paymentIconBg, { backgroundColor: colors.success + "20" }]}>
                  <Text style={styles.paymentEmoji}>💵</Text>
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentName, { color: colors.foreground }]}>{translate("cashPayment")}</Text>
                  <Text style={[styles.paymentDesc, { color: colors.muted }]}>{translate("cashPaymentShortDesc")}</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </Pressable>

              {/* Call Directly */}
              <Pressable
                onPress={() => handlePaymentMethodSelect("call")}
                style={({ pressed }) => [
                  styles.paymentOption,
                  { backgroundColor: pressed ? colors.surface : "transparent", borderColor: colors.border },
                ]}
              >
                <View style={[styles.paymentIconBg, { backgroundColor: colors.primary + "20" }]}>
                  <IconSymbol name="phone.fill" size={24} color={colors.primary} />
                </View>
                <View style={styles.paymentInfo}>
                  <Text style={[styles.paymentName, { color: colors.foreground }]}>{translate("callDirectly")}</Text>
                  <Text style={[styles.paymentDesc, { color: colors.muted }]}>{WHATSAPP_NUMBER}</Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.muted} />
              </Pressable>
            </>
          ) : (
            <>
              {/* Other country — WhatsApp only */}
              <View style={[styles.paymentOption, { borderColor: colors.border, backgroundColor: colors.surface + "50" }]}>
                <View style={[styles.paymentIconBg, { backgroundColor: "#25D366" + "20" }]}>
                  <IconSymbol name="message.fill" size={24} color="#25D366" />
                </View>
                <View style={[styles.paymentInfo, { flex: 1 }]}>
                  <Text style={[styles.paymentName, { color: colors.foreground }]}>{translate("contactViaWhatsAppPayment")}</Text>
                  <Text style={[styles.paymentDesc, { color: colors.muted }]}>{translate("whatsAppPaymentDesc")}</Text>
                </View>
              </View>
              <Pressable
                onPress={() => {
                  const msg = selectedPlan
                    ? buildPaymentMessage(selectedPlan.name, selectedPlan.amountStr)
                    : `Hello, I would like to subscribe to Business+. Please assist me with payment.`;
                  const encoded = encodeURIComponent(msg);
                  const url = `https://wa.me/${WHATSAPP_NUMBER.replace("+", "")}?text=${encoded}`;
                  Linking.openURL(url).catch(() => {
                    Alert.alert(translate("error"), "Could not open WhatsApp");
                  });
                  if (selectedPlan) submitPaymentRequest("whatsapp", "WhatsApp-International");
                }}
                style={({ pressed }) => [{
                  flexDirection: "row", alignItems: "center", justifyContent: "center",
                  backgroundColor: "#25D366", borderRadius: 12, paddingVertical: 14, marginTop: 8, gap: 8,
                  opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.97 : 1 }],
                }]}
              >
                <IconSymbol name="message.fill" size={20} color="#FFF" />
                <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 15 }}>
                  {translate("contactViaWhatsAppPayment")}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable
            onPress={() => setPaymentModalVisible(false)}
            style={({ pressed }) => [
              styles.cancelBtn,
              { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>{translate("cancel")}</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Mobile Money Flow Modal */}
      <Modal
        visible={momoFlowVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMomoFlowVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setMomoFlowVisible(false)}
          >
            <View />
          </Pressable>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {selectedMethod === "mtn_momo" ? "MTN Mobile Money" : selectedMethod === "airtel_money" ? "Airtel Money" : "Mobile Money"}
            </Text>
            {selectedPlan && (
              <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
                {selectedPlan.name} — {selectedPlan.amountStr}
              </Text>
            )}

            {/* Country Selector */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {COUNTRY_OPTIONS.map((c) => (
                <Pressable
                  key={c.code}
                  onPress={() => setPaymentCountry(c.code)}
                  style={({ pressed }) => [{
                    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                    paddingVertical: 10, borderRadius: 10, borderWidth: 1, gap: 4,
                    backgroundColor: paymentCountry === c.code ? colors.primary : colors.surface,
                    borderColor: paymentCountry === c.code ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  }]}
                >
                  <Text style={{ fontSize: 16 }}>{c.flag}</Text>
                  <Text style={{ color: paymentCountry === c.code ? "#FFF" : colors.foreground, fontWeight: "600", fontSize: 11 }}>
                    {c.code}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Step 1: Send Money Instructions */}
            <View style={[styles.stepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                  {translate("step1SendMoney")}
                </Text>
                <Text style={[styles.stepDesc, { color: colors.muted }]}>
                  {selectedMethod === "mtn_momo" ? translate("mtnMomoSteps") : translate("airtelMoneySteps")}
                </Text>
                {/* Show recipient number based on selected country */}
                {(() => {
                  const nums = MOBILE_MONEY_NUMBERS[paymentCountry];
                  if (!nums) return null;
                  const entries = Object.entries(nums).filter(([_, v]) => v);
                  return entries.map(([provider, number]) => (
                    <View key={provider} style={[styles.recipientBox, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
                      <Text style={[styles.recipientLabel, { color: colors.muted }]}>{provider.toUpperCase()}:</Text>
                      <Text style={[styles.recipientNumber, { color: colors.primary }]}>{number}</Text>
                    </View>
                  ));
                })()}
                <View style={[styles.recipientBox, { backgroundColor: colors.warning + "10", borderColor: colors.warning + "30" }]}>
                  <Text style={[styles.recipientLabel, { color: colors.muted }]}>{translate("amount")}:</Text>
                  <Text style={[styles.recipientNumber, { color: colors.warning }]}>{selectedPlan?.amountStr}</Text>
                </View>
              </View>
            </View>

            {/* Step 2: Upload proof OR enter reference */}
            <View style={[styles.stepCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: colors.foreground }]}>
                  {translate("uploadProof")}
                </Text>

                {/* Image Upload Buttons */}
                <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                  <Pressable
                    onPress={async () => {
                      const result = await ImagePicker.launchImageLibraryAsync({
                        mediaTypes: ["images"],
                        allowsEditing: false,
                        quality: 0.7,
                      });
                      if (!result.canceled && result.assets[0]) {
                        setProofImageUri(result.assets[0].uri);
                      }
                    }}
                    style={({ pressed }) => [{
                      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      paddingVertical: 12, borderRadius: 10, gap: 6,
                      backgroundColor: colors.primary + "15", borderWidth: 1, borderColor: colors.primary + "30",
                      opacity: pressed ? 0.8 : 1,
                    }]}
                  >
                    <IconSymbol name="photo.fill" size={18} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                      {translate("chooseFromGallery")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      const { status } = await ImagePicker.requestCameraPermissionsAsync();
                      if (status !== "granted") {
                        Alert.alert(translate("error"), "Camera permission required");
                        return;
                      }
                      const result = await ImagePicker.launchCameraAsync({
                        allowsEditing: false,
                        quality: 0.7,
                      });
                      if (!result.canceled && result.assets[0]) {
                        setProofImageUri(result.assets[0].uri);
                      }
                    }}
                    style={({ pressed }) => [{
                      flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
                      paddingVertical: 12, borderRadius: 10, gap: 6,
                      backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    }]}
                  >
                    <IconSymbol name="camera.fill" size={18} color={colors.foreground} />
                    <Text style={{ color: colors.foreground, fontWeight: "600", fontSize: 13 }}>
                      {translate("takePhoto")}
                    </Text>
                  </Pressable>
                </View>

                {/* Preview uploaded image */}
                {proofImageUri && (
                  <View style={{ marginBottom: 12, alignItems: "center" }}>
                    <Image
                      source={{ uri: proofImageUri }}
                      style={{ width: "100%", height: 150, borderRadius: 10 }}
                      resizeMode="cover"
                    />
                    <Pressable
                      onPress={() => setProofImageUri(null)}
                      style={({ pressed }) => [{
                        position: "absolute", top: 6, right: 6,
                        backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12,
                        width: 24, height: 24, alignItems: "center", justifyContent: "center",
                        opacity: pressed ? 0.7 : 1,
                      }]}
                    >
                      <IconSymbol name="xmark" size={14} color="#FFF" />
                    </Pressable>
                  </View>
                )}

                {/* OR divider */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                  <Text style={{ marginHorizontal: 12, color: colors.muted, fontSize: 12 }}>
                    {translate("orPasteRef")}
                  </Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
                </View>

                {/* Transaction Reference Input */}
                <TextInput
                  style={[styles.refInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder={translate("enterTransactionRef")}
                  placeholderTextColor={colors.muted}
                  value={transactionRef}
                  onChangeText={setTransactionRef}
                  autoCapitalize="characters"
                  returnKeyType="done"
                />
              </View>
            </View>

            {/* Submit Button */}
            <Pressable
              onPress={handleMomoSubmit}
              disabled={submitting || (!transactionRef.trim() && !proofImageUri)}
              style={({ pressed }) => [
                styles.submitBtn,
                {
                  backgroundColor: (transactionRef.trim() || proofImageUri) ? colors.primary : colors.muted,
                  opacity: pressed ? 0.9 : submitting ? 0.6 : 1,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.submitBtnText}>{translate("submitPayment")}</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => setMomoFlowVisible(false)}
              style={({ pressed }) => [
                styles.cancelBtn,
                { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>{translate("cancel")}</Text>
            </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Payment History Modal */}
      <Modal
        visible={paymentHistoryVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPaymentHistoryVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setPaymentHistoryVisible(false)}
        >
          <View />
        </Pressable>
        <View style={[styles.modalContent, { backgroundColor: colors.background, maxHeight: "70%" }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {translate("paymentHistory")}
          </Text>

          {myPayments.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {translate("noPaymentRequests")}
            </Text>
          ) : (
            <FlatList
              data={myPayments}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderPaymentItem}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={false}
            />
          )}

          <Pressable
            onPress={() => setPaymentHistoryVisible(false)}
            style={({ pressed }) => [
              styles.cancelBtn,
              { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.cancelBtnText, { color: colors.foreground }]}>OK</Text>
          </Pressable>
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
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
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
  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  pendingBannerText: {
    fontSize: 14,
    fontWeight: "600",
  },
  pendingBannerSubtext: {
    fontSize: 12,
    marginTop: 2,
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
  planFeatures: {
    marginBottom: 14,
    gap: 6,
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
  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 10,
  },
  historyLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  paymentOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  paymentIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentEmoji: {
    fontSize: 22,
  },
  paymentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: "600",
  },
  paymentDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  cancelBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6,
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  // Mobile money flow styles
  stepCard: {
    flexDirection: "row",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepNumberText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 10,
  },
  recipientBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    gap: 8,
  },
  recipientLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  recipientNumber: {
    fontSize: 16,
    fontWeight: "800",
  },
  refInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: "600",
  },
  submitBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 4,
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  // Payment history styles
  paymentItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  paymentItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  paymentItemPlan: {
    fontSize: 15,
    fontWeight: "700",
  },
  paymentItemDetails: {
    paddingLeft: 18,
    gap: 3,
  },
  paymentItemMethod: {
    fontSize: 13,
  },
  paymentItemStatus: {
    fontSize: 13,
    fontWeight: "600",
  },
  paymentItemDate: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    paddingVertical: 24,
  },
});
