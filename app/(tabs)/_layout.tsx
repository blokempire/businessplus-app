import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useApp } from "@/lib/app-context";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { translate } = useApp();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarLabelStyle: {
          fontSize: 10,
        },
        tabBarStyle: {
          paddingTop: 6,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: translate("dashboard"),
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: translate("transactions"),
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="list.bullet" color={color} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: translate("contacts"),
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.2.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stock"
        options={{
          title: translate("stock"),
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="shippingbox.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: translate("invoices"),
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="doc.text.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: translate("reports"),
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.bar.fill" color={color} />,
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: translate("settings"),
          tabBarIcon: ({ color }) => <IconSymbol size={24} name="gearshape.fill" color={color} />,
          href: null,
        }}
      />
    </Tabs>
  );
}
