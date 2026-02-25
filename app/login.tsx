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

export default function LoginScreen() {
  const colors = useColors();
  const { translate } = useApp();
  const router = useRouter();
  const { isAuthenticated, loading: authLoading, refresh } = useAuth();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pinRef = useRef<TextInput>(null);
  const confirmPinRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      router.replace("/(tabs)" as any);
    }
  }, [isAuthenticated, authLoading]);

  const handleLogin = async () => {
    if (!phone.trim() || pin.length !== 4) {
      Alert.alert(translate("error"), translate("enterPhoneAndPin"));
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await loginMutation.mutateAsync({ phone: phone.trim(), pin });
      // Store session
      await Auth.setSessionToken(result.sessionToken);
      await Auth.setUserInfo({
        id: result.user.id,
        openId: result.user.openId,
        name: result.user.name,
        email: null,
        loginMethod: "phone",
        lastSignedIn: new Date(),
      });
      await refresh();
      router.replace("/(tabs)" as any);
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
        phone: phone.trim(),
        pin,
        name: name.trim(),
      });
      // Store session
      await Auth.setSessionToken(result.sessionToken);
      await Auth.setUserInfo({
        id: result.user.id,
        openId: result.user.openId,
        name: result.user.name,
        email: null,
        loginMethod: "phone",
        lastSignedIn: new Date(),
      });
      await refresh();
      router.replace("/(tabs)" as any);
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
              <Text style={styles.appName}>Mon Business</Text>
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

              {/* Phone Input */}
              <View style={[styles.inputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <IconSymbol name="phone.fill" size={20} color={colors.muted} />
                <TextInput
                  style={[styles.input, { color: colors.foreground }]}
                  placeholder={translate("enterPhone")}
                  placeholderTextColor={colors.muted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  onSubmitEditing={() => pinRef.current?.focus()}
                />
              </View>

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
