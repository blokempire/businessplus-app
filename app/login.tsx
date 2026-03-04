import { Text, View, TextInput, Pressable, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import * as Auth from "@/lib/_core/auth";
import { detectCurrencyFromPhone, detectLanguageFromPhone, PHONE_PREFIX_TO_CURRENCY } from "@/lib/store";

// Country codes for the picker
const COUNTRY_CODES = [
  { code: "+242", country: "🇨🇬 Congo", short: "CG" },
  { code: "+237", country: "🇨🇲 Cameroun", short: "CM" },
  { code: "+241", country: "🇬🇦 Gabon", short: "GA" },
  { code: "+235", country: "🇹🇩 Tchad", short: "TD" },
  { code: "+236", country: "🇨🇫 Centrafrique", short: "CF" },
  { code: "+240", country: "🇬🇶 Guinée Éq.", short: "GQ" },
  { code: "+243", country: "🇨🇩 RD Congo", short: "CD" },
  { code: "+225", country: "🇨🇮 Côte d'Ivoire", short: "CI" },
  { code: "+221", country: "🇸🇳 Sénégal", short: "SN" },
  { code: "+223", country: "🇲🇱 Mali", short: "ML" },
  { code: "+226", country: "🇧🇫 Burkina Faso", short: "BF" },
  { code: "+227", country: "🇳🇪 Niger", short: "NE" },
  { code: "+228", country: "🇹🇬 Togo", short: "TG" },
  { code: "+229", country: "🇧🇯 Bénin", short: "BJ" },
  { code: "+234", country: "🇳🇬 Nigeria", short: "NG" },
  { code: "+233", country: "🇬🇭 Ghana", short: "GH" },
  { code: "+254", country: "🇰🇪 Kenya", short: "KE" },
  { code: "+255", country: "🇹🇿 Tanzania", short: "TZ" },
  { code: "+256", country: "🇺🇬 Uganda", short: "UG" },
  { code: "+250", country: "🇷🇼 Rwanda", short: "RW" },
  { code: "+27", country: "🇿🇦 South Africa", short: "ZA" },
  { code: "+212", country: "🇲🇦 Maroc", short: "MA" },
  { code: "+33", country: "🇫🇷 France", short: "FR" },
  { code: "+1", country: "🇺🇸 USA/Canada", short: "US" },
  { code: "+44", country: "🇬🇧 UK", short: "GB" },
  { code: "+49", country: "🇩🇪 Germany", short: "DE" },
  { code: "+91", country: "🇮🇳 India", short: "IN" },
  { code: "+86", country: "🇨🇳 China", short: "CN" },
  { code: "+55", country: "🇧🇷 Brazil", short: "BR" },
];

function buildUserInfo(result: any): Auth.User {
  return {
    id: result.user.id,
    openId: result.user.openId,
    name: result.user.name,
    email: result.user.email ?? null,
    phone: result.user.phone ?? null,
    loginMethod: result.user.loginMethod ?? "phone",
    role: result.user.role ?? "user",
    status: result.user.status ?? "active",
    subscriptionPlan: result.user.subscriptionPlan ?? "free",
    subscriptionActive: result.user.subscriptionActive ?? false,
    subscriptionEndDate: result.user.subscriptionEndDate ?? null,
    companyId: result.user.companyId ?? null,
    companyRole: result.user.companyRole ?? null,
    lastSignedIn: new Date(),
  };
}

export default function LoginScreen() {
  const colors = useColors();
  const { translate, updateProfile, setLanguage } = useApp();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, refresh } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [countryCode, setCountryCode] = useState("+242"); // Default Congo
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const pinRef = useRef<TextInput>(null);
  const confirmPinRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();

  // Auto-detect country code from locale on mount
  useEffect(() => {
    try {
      // Try to detect from device locale/timezone
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz.includes("Africa/Brazzaville") || tz.includes("Africa/Kinshasa")) {
        setCountryCode("+242");
      } else if (tz.includes("Africa/Douala")) {
        setCountryCode("+237");
      } else if (tz.includes("Africa/Libreville")) {
        setCountryCode("+241");
      } else if (tz.includes("Africa/Lagos")) {
        setCountryCode("+234");
      } else if (tz.includes("Africa/Nairobi")) {
        setCountryCode("+254");
      } else if (tz.includes("Africa/Johannesburg")) {
        setCountryCode("+27");
      } else if (tz.includes("Europe/Paris")) {
        setCountryCode("+33");
      } else if (tz.includes("America/New_York") || tz.includes("America/Chicago") || tz.includes("America/Los_Angeles")) {
        setCountryCode("+1");
      } else if (tz.includes("Europe/London")) {
        setCountryCode("+44");
      }
    } catch {
      // Default stays +242
    }
  }, []);

  // Auth redirect is handled by AuthGate — no duplicate navigation needed here

  const fullPhone = `${countryCode}${phone.replace(/^0+/, "")}`;

  const handleLogin = async () => {
    if (!phone.trim() || pin.length !== 4) {
      Alert.alert(translate("error"), translate("enterPhoneAndPin"));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await loginMutation.mutateAsync({ phone: fullPhone, pin });
      // Store session
      await Auth.setSessionToken(result.sessionToken);
      await Auth.setUserInfo(buildUserInfo(result));
      await refresh();
      // AuthGate handles redirect to /(tabs) automatically
    } catch (err: any) {
      const msg = err?.message || translate("loginError");
      Alert.alert(translate("error"), msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (!phone.trim() || pin.length !== 4 || !name.trim()) {
      Alert.alert(translate("error"), translate("fillAllFields"));
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert(translate("error"), translate("pinMismatch"));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await registerMutation.mutateAsync({
        phone: fullPhone,
        pin,
        name: name.trim(),
      });
      // Store session
      await Auth.setSessionToken(result.sessionToken);
      await Auth.setUserInfo(buildUserInfo(result));
      // Auto-detect currency and language from phone number
      const detectedCurrency = detectCurrencyFromPhone(fullPhone);
      const detectedLanguage = detectLanguageFromPhone(fullPhone);
      updateProfile({ currency: detectedCurrency });
      setLanguage(detectedLanguage);
      await refresh();
      // AuthGate handles redirect to /(tabs) automatically
    } catch (err: any) {
      const msg = err?.message || translate("registerError");
      Alert.alert(translate("error"), msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const selectedCountry = COUNTRY_CODES.find((c) => c.code === countryCode);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            {/* Top Section */}
            <View style={[styles.topSection, { backgroundColor: colors.primary }]}>
              <View style={styles.logoContainer}>
                <IconSymbol name="dollarsign.circle" size={72} color="#FFFFFF" />
              </View>
              <Text style={styles.appName}>Business+</Text>
              <Text style={styles.tagline}>{translate("appDescription")}</Text>
            </View>

            {/* Bottom Section */}
            <View style={[styles.bottomSection, { backgroundColor: colors.background }]}>
              {/* Mode Toggle */}
              <View style={[styles.modeToggle, { backgroundColor: colors.surface }]}>
                <Pressable
                  onPress={() => setMode("login")}
                  style={({ pressed }) => [
                    styles.modeBtn,
                    mode === "login" && { backgroundColor: colors.primary },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.modeBtnText, { color: mode === "login" ? "#FFF" : colors.muted }]}>
                    {translate("login")}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setMode("register")}
                  style={({ pressed }) => [
                    styles.modeBtn,
                    mode === "register" && { backgroundColor: colors.primary },
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[styles.modeBtnText, { color: mode === "register" ? "#FFF" : colors.muted }]}>
                    {translate("register")}
                  </Text>
                </Pressable>
              </View>

              {/* Name field (register only) */}
              {mode === "register" && (
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <IconSymbol name="person.fill" size={20} color={colors.muted} />
                  <TextInput
                    ref={nameRef}
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder={translate("enterYourName")}
                    placeholderTextColor={colors.muted}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                    returnKeyType="next"
                    onSubmitEditing={() => pinRef.current?.focus()}
                  />
                </View>
              )}

              {/* Phone Input with Country Code */}
              <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Pressable
                  onPress={() => setShowCountryPicker(!showCountryPicker)}
                  style={({ pressed }) => [styles.countryCodeBtn, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.countryCodeText, { color: colors.foreground }]}>
                    {selectedCountry?.country.split(" ")[0]} {countryCode}
                  </Text>
                  <IconSymbol name="chevron.right" size={12} color={colors.muted} style={{ transform: [{ rotate: showCountryPicker ? "90deg" : "0deg" }] }} />
                </Pressable>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={translate("enterPhone")}
                  placeholderTextColor={colors.muted}
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => pinRef.current?.focus()}
                />
              </View>

              {/* Country Code Picker Dropdown */}
              {showCountryPicker && (
                <View style={[styles.countryDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {COUNTRY_CODES.map((cc) => (
                      <Pressable
                        key={cc.code}
                        onPress={() => {
                          setCountryCode(cc.code);
                          setShowCountryPicker(false);
                        }}
                        style={({ pressed }) => [
                          styles.countryRow,
                          {
                            backgroundColor: cc.code === countryCode ? colors.primary + "15" : "transparent",
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.countryRowText, { color: colors.foreground }]}>
                          {cc.country}
                        </Text>
                        <Text style={[styles.countryRowCode, { color: colors.muted }]}>{cc.code}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* PIN Input */}
              <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <IconSymbol name="lock.fill" size={20} color={colors.muted} />
                <TextInput
                  ref={pinRef}
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={translate("enterPin")}
                  placeholderTextColor={colors.muted}
                  value={pin}
                  onChangeText={(t) => setPin(t.replace(/[^0-9]/g, "").slice(0, 4))}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  returnKeyType={mode === "register" ? "next" : "done"}
                  onSubmitEditing={() => {
                    if (mode === "register") confirmPinRef.current?.focus();
                    else handleLogin();
                  }}
                />
                <Text style={[styles.pinCount, { color: colors.muted }]}>{pin.length}/4</Text>
              </View>

              {/* Confirm PIN (register only) */}
              {mode === "register" && (
                <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <IconSymbol name="lock.fill" size={20} color={colors.muted} />
                  <TextInput
                    ref={confirmPinRef}
                    style={[styles.input, { color: colors.foreground }]}
                    placeholder={translate("confirmPin")}
                    placeholderTextColor={colors.muted}
                    value={confirmPin}
                    onChangeText={(t) => setConfirmPin(t.replace(/[^0-9]/g, "").slice(0, 4))}
                    keyboardType="number-pad"
                    secureTextEntry
                    maxLength={4}
                    returnKeyType="done"
                    onSubmitEditing={handleRegister}
                  />
                  <Text style={[styles.pinCount, { color: colors.muted }]}>{confirmPin.length}/4</Text>
                </View>
              )}

              {/* Submit Button */}
              <Pressable
                onPress={mode === "login" ? handleLogin : handleRegister}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.submitBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: isSubmitting ? 0.6 : pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.97 : 1 }],
                  },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {mode === "login" ? translate("login") : translate("register")}
                  </Text>
                )}
              </Pressable>

              {/* Skip for now - use locally */}
              <Pressable
                onPress={() => router.replace("/(tabs)" as any)}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginTop: 16 }]}
              >
                <Text style={[styles.skipText, { color: colors.muted }]}>
                  {translate("useOffline")} →
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
  },
  topSection: {
    paddingTop: 40,
    paddingBottom: 40,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 25,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 6,
    fontWeight: "500",
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    alignItems: "center",
  },
  modeToggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    width: "100%",
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  modeBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 12,
    width: "100%",
    height: 52,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    height: 48,
  },
  pinCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  countryCodeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingRight: 8,
  },
  countryCodeText: {
    fontSize: 15,
    fontWeight: "600",
  },
  divider: {
    width: 1,
    height: 28,
    marginRight: 4,
  },
  countryDropdown: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    marginTop: -8,
    overflow: "hidden",
  },
  countryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countryRowText: {
    fontSize: 15,
    fontWeight: "500",
  },
  countryRowCode: {
    fontSize: 14,
    fontWeight: "600",
  },
  submitBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  skipText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
