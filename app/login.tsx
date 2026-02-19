import { Text, View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { startOAuthLogin } from "@/constants/oauth";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function LoginScreen() {
  const colors = useColors();
  const { translate } = useApp();
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !loading) {
      router.replace("/(tabs)" as any);
    }
  }, [isAuthenticated, loading]);

  const handleLogin = async () => {
    await startOAuthLogin();
  };

  if (loading) {
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
      <View style={styles.container}>
        {/* Top Section with Gradient-like Background */}
        <View style={[styles.topSection, { backgroundColor: colors.primary }]}>
          <View style={styles.logoContainer}>
            <IconSymbol name="dollarsign.circle" size={72} color="#FFFFFF" />
          </View>
          <Text style={styles.appName}>Ledger</Text>
          <Text style={styles.tagline}>{translate("appDescription")}</Text>
        </View>

        {/* Bottom Section */}
        <View style={[styles.bottomSection, { backgroundColor: colors.background }]}>
          <Pressable
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.loginBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <Text style={styles.loginBtnText}>{translate("login")}</Text>
          </Pressable>

          <Text style={[styles.orText, { color: colors.muted }]}>
            {translate("dontHaveAccount")}
          </Text>

          <Pressable
            onPress={handleLogin}
            style={({ pressed }) => [
              styles.registerBtn,
              {
                borderColor: colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Text style={[styles.registerBtnText, { color: colors.primary }]}>
              {translate("register")}
            </Text>
          </Pressable>

          {/* Skip for now - use locally */}
          <Pressable
            onPress={() => router.replace("/(tabs)" as any)}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1, marginTop: 20 }]}
          >
            <Text style={[styles.skipText, { color: colors.muted }]}>
              {translate("dashboard")} →
            </Text>
          </Pressable>
        </View>
      </View>
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    paddingBottom: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    color: "rgba(255,255,255,0.8)",
    marginTop: 8,
    fontWeight: "500",
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 40,
    alignItems: "center",
  },
  loginBtn: {
    width: "100%",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
  },
  loginBtnText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  orText: {
    fontSize: 14,
    marginTop: 20,
    marginBottom: 12,
  },
  registerBtn: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 2,
  },
  registerBtnText: {
    fontSize: 18,
    fontWeight: "700",
  },
  skipText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
