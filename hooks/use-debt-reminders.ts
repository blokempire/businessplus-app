import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DebtEntry, Invoice, InvoiceStatus } from "@/lib/store";

const REMINDER_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days
const LAST_REMINDER_KEY = "@debt_reminder_last";
const NOTIFICATION_ID = "debt-reminder";

// Configure notification handler for foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("debt-reminders", {
      name: "Debt Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export function useDebtReminders(
  debtEntries: DebtEntry[],
  invoices: Invoice[],
  translate: (key: string) => string,
) {
  const hasScheduled = useRef(false);

  useEffect(() => {
    if (hasScheduled.current) return;
    if (Platform.OS === "web") return;

    const checkAndSchedule = async () => {
      // Count unpaid debts and invoices
      const unpaidDebts = debtEntries.filter(d => d.type === "theyOweMe");
      const unpaidInvoices = invoices.filter(
        inv => inv.status === "pending" || inv.status === "partial"
      );

      const totalUnpaid = unpaidDebts.length + unpaidInvoices.length;
      if (totalUnpaid === 0) return;

      // Check last reminder time
      const lastReminderStr = await AsyncStorage.getItem(LAST_REMINDER_KEY);
      const lastReminder = lastReminderStr ? parseInt(lastReminderStr, 10) : 0;
      const now = Date.now();

      if (now - lastReminder < REMINDER_INTERVAL_MS) return;

      // Request permissions
      const granted = await requestPermissions();
      if (!granted) return;

      // Cancel any existing reminder
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});

      // Build notification body
      let body = "";
      if (unpaidDebts.length > 0 && unpaidInvoices.length > 0) {
        body = `${unpaidDebts.length} ${translate("unsolvedDebts")} · ${unpaidInvoices.length} ${translate("unpaidInvoices")}`;
      } else if (unpaidDebts.length > 0) {
        body = `${unpaidDebts.length} ${translate("unsolvedDebts")}`;
      } else {
        body = `${unpaidInvoices.length} ${translate("unpaidInvoices")}`;
      }

      // Schedule immediate notification
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: {
          title: translate("debtReminder"),
          body: `${body}. ${translate("debtReminderDesc")}`,
          sound: true,
        },
        trigger: null, // immediate
      });

      // Save last reminder time
      await AsyncStorage.setItem(LAST_REMINDER_KEY, String(now));
      hasScheduled.current = true;

      // Schedule next reminder in 2 days
      await Notifications.scheduleNotificationAsync({
        identifier: `${NOTIFICATION_ID}-recurring`,
        content: {
          title: translate("debtReminder"),
          body: `${body}. ${translate("debtReminderDesc")}`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: REMINDER_INTERVAL_MS / 1000,
          repeats: true,
        },
      });
    };

    checkAndSchedule().catch(console.warn);
  }, [debtEntries, invoices, translate]);
}
