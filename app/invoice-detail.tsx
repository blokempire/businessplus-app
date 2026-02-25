import { useState } from "react";
import { Text, View, TouchableOpacity, ScrollView, Alert, Platform } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { formatCurrency } from "@/lib/store";

export default function InvoiceDetailScreen() {
  const { state, translate, updateInvoice, deleteInvoice, changeInvoiceStatus } = useApp();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ invoiceId: string }>();

  const invoice = state.invoices.find((inv) => inv.id === params.invoiceId);
  if (!invoice) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-4">
        <Text style={{ color: colors.muted, textAlign: "center", marginTop: 40 }}>Invoice not found</Text>
      </ScreenContainer>
    );
  }

  const currency = state.profile.currency;

  const handleStatusChange = () => {
    const options: { text: string; onPress?: () => void; style?: "cancel" | "destructive" }[] = [];

    if (invoice.status !== "paid") {
      options.push({
        text: translate("markAsPaid"),
        onPress: () => {
          changeInvoiceStatus(invoice.id, "paid");
          Alert.alert(translate("success"), translate("invoicePaid"));
        },
      });
    }
    if (invoice.status !== "pending") {
      options.push({
        text: translate("markAsPending"),
        onPress: () => {
          changeInvoiceStatus(invoice.id, "pending");
          Alert.alert(translate("success"), translate("invoicePending"));
        },
      });
    }
    if (invoice.status !== "cancelled") {
      options.push({
        text: translate("markAsCancelled"),
        style: "destructive",
        onPress: () => {
          changeInvoiceStatus(invoice.id, "cancelled");
          Alert.alert(translate("success"), translate("invoiceCancelled"));
        },
      });
    }
    options.push({ text: translate("cancel"), style: "cancel" });

    Alert.alert(translate("changeStatus"), "", options);
  };

  const generateInvoiceHTML = () => {
    const itemsRows = invoice.items
      .map(
        (item, i) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee;">${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;">${item.productName}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.unitPrice, currency)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${formatCurrency(item.total, currency)}</td>
      </tr>`
      )
      .join("");

    const discountRow = (invoice.discountAmount && invoice.discountAmount > 0) ? `
    <div class="row" style="color:#22C55E;">
      <span>${translate("discount")}${invoice.discountType === "percentage" ? ` (${invoice.discountValue}%)` : ""}:</span>
      <span>-${formatCurrency(invoice.discountAmount, currency)}</span>
    </div>` : "";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .invoice-title { font-size: 32px; font-weight: 700; color: #0D9488; }
    .invoice-number { font-size: 14px; color: #666; margin-top: 4px; }
    .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .info-block h3 { font-size: 12px; color: #999; text-transform: uppercase; margin-bottom: 4px; }
    .info-block p { font-size: 14px; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #f8f9fa; padding: 10px 8px; text-align: left; font-size: 12px; color: #666; text-transform: uppercase; border-bottom: 2px solid #eee; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    .totals { text-align: right; margin-top: 20px; }
    .totals .row { display: flex; justify-content: flex-end; gap: 40px; padding: 6px 0; }
    .totals .total-row { font-size: 20px; font-weight: 700; color: #0D9488; border-top: 2px solid #0D9488; padding-top: 10px; margin-top: 6px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .status-pending { background: #FEE2E2; color: #EF4444; }
    .status-partial { background: #FEF3C7; color: #F59E0B; }
    .status-paid { background: #D1FAE5; color: #22C55E; }
    .status-cancelled { background: #E5E7EB; color: #6B7280; }
    .note { background: #f8f9fa; padding: 16px; border-radius: 8px; margin-top: 20px; }
    .note h4 { font-size: 12px; color: #999; margin-bottom: 4px; }
    .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="invoice-title">${translate("invoiceDetail")}</div>
      <div class="invoice-number">${invoice.invoiceNumber}</div>
    </div>
    <span class="status status-${invoice.status}">${invoice.status.toUpperCase()}</span>
  </div>

  <div class="info-section">
    <div class="info-block">
      <h3>${translate("invoiceFrom")}</h3>
      <p><strong>${state.profile.businessName || state.profile.name || "Mon Business"}</strong></p>
    </div>
    <div class="info-block">
      <h3>${translate("invoiceTo")}</h3>
      <p><strong>${invoice.contactName}</strong></p>
    </div>
    <div class="info-block">
      <h3>${translate("invoiceDate")}</h3>
      <p>${new Date(invoice.date).toLocaleDateString()}</p>
      <h3 style="margin-top:8px;">${translate("dueDate")}</h3>
      <p>${new Date(invoice.dueDate).toLocaleDateString()}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>${translate("itemName")}</th>
        <th style="text-align:center;">${translate("qty")}</th>
        <th style="text-align:right;">${translate("unitPrice")}</th>
        <th style="text-align:right;">${translate("lineTotal")}</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <div class="totals">
    <div class="row">
      <span>${translate("subtotal")}:</span>
      <span>${formatCurrency(invoice.subtotal, currency)}</span>
    </div>
    ${discountRow}
    <div class="row">
      <span>${translate("taxAmount")}:</span>
      <span>${formatCurrency(invoice.tax, currency)}</span>
    </div>
    <div class="row total-row">
      <span>${translate("invoiceTotal")}:</span>
      <span>${formatCurrency(invoice.total, currency)}</span>
    </div>
  </div>

  ${invoice.note ? `<div class="note"><h4>${translate("invoiceNote")}</h4><p>${invoice.note}</p></div>` : ""}

  <div class="footer">
    <p>${state.profile.businessName || "Mon Business"} &mdash; ${translate("appDescription")}</p>
  </div>
</body>
</html>`;
  };

  const handlePrint = async () => {
    try {
      await Print.printAsync({ html: generateInvoiceHTML() });
    } catch (e) {
      console.error("Print error:", e);
    }
  };

  const handleSharePDF = async () => {
    try {
      const { uri } = await Print.printToFileAsync({ html: generateInvoiceHTML() });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `${invoice.invoiceNumber}.pdf` });
    } catch (e) {
      console.error("Share PDF error:", e);
    }
  };

  const handleAddPhoto = async () => {
    Alert.alert(translate("addPhoto"), "", [
      {
        text: translate("takePhoto"),
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") return;
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!result.canceled) {
            updateInvoice({ ...invoice, photoUris: [...invoice.photoUris, result.assets[0].uri] });
          }
        },
      },
      {
        text: translate("chooseFromLibrary"),
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
          if (!result.canceled) {
            updateInvoice({ ...invoice, photoUris: [...invoice.photoUris, result.assets[0].uri] });
          }
        },
      },
      { text: translate("cancel"), style: "cancel" },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(translate("delete"), translate("deleteConfirm"), [
      { text: translate("cancel"), style: "cancel" },
      {
        text: translate("delete"),
        style: "destructive",
        onPress: () => {
          deleteInvoice(invoice.id);
          router.back();
        },
      },
    ]);
  };

  const statusColor =
    invoice.status === "paid" ? colors.success
    : invoice.status === "cancelled" ? colors.muted
    : invoice.status === "partial" ? colors.warning
    : colors.error;

  const statusLabel =
    invoice.status === "paid" ? translate("paid")
    : invoice.status === "cancelled" ? translate("markAsCancelled")
    : invoice.status === "partial" ? translate("partial")
    : translate("pending");

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-4">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="chevron.right" size={24} color={colors.foreground} style={{ transform: [{ rotate: "180deg" }] }} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>{invoice.invoiceNumber}</Text>
          <TouchableOpacity onPress={handleDelete}>
            <IconSymbol name="trash.fill" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Status Badge — Tappable to change */}
        <TouchableOpacity onPress={handleStatusChange} style={{ alignItems: "center", marginBottom: 20 }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, backgroundColor: statusColor + "20", flexDirection: "row", alignItems: "center" }}>
            <Text style={{ fontSize: 14, fontWeight: "600", color: statusColor }}>{statusLabel}</Text>
            <IconSymbol name="chevron.right" size={14} color={statusColor} style={{ marginLeft: 6, transform: [{ rotate: "90deg" }] }} />
          </View>
          <Text style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{translate("changeStatus")}</Text>
        </TouchableOpacity>

        {/* Invoice Info */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
            <View>
              <Text style={{ fontSize: 12, color: colors.muted }}>{translate("invoiceTo")}</Text>
              <Text style={{ fontSize: 16, fontWeight: "600", color: colors.foreground }}>{invoice.contactName}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>{translate("invoiceDate")}</Text>
              <Text style={{ fontSize: 14, color: colors.foreground }}>{new Date(invoice.date).toLocaleDateString()}</Text>
            </View>
          </View>
          {invoice.dueDate && (
            <View>
              <Text style={{ fontSize: 12, color: colors.muted }}>{translate("dueDate")}</Text>
              <Text style={{ fontSize: 14, color: colors.foreground }}>{new Date(invoice.dueDate).toLocaleDateString()}</Text>
            </View>
          )}
        </View>

        {/* Items */}
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground, marginBottom: 10 }}>{translate("products")}</Text>
        {invoice.items.map((item, i) => (
          <View key={i} style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, marginBottom: 8, flexDirection: "row", justifyContent: "space-between" }}>
            <View>
              <Text style={{ fontSize: 15, fontWeight: "500", color: colors.foreground }}>{item.productName}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                {formatCurrency(item.unitPrice, currency)} x {item.quantity}
              </Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{formatCurrency(item.total, currency)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginTop: 8, marginBottom: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: colors.muted }}>{translate("subtotal")}</Text>
            <Text style={{ color: colors.foreground }}>{formatCurrency(invoice.subtotal, currency)}</Text>
          </View>
          {invoice.discountAmount && invoice.discountAmount > 0 ? (
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: colors.success }}>
                {translate("discount")} {invoice.discountType === "percentage" ? `(${invoice.discountValue}%)` : ""}
              </Text>
              <Text style={{ color: colors.success }}>-{formatCurrency(invoice.discountAmount, currency)}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
            <Text style={{ color: colors.muted }}>{translate("taxAmount")}</Text>
            <Text style={{ color: colors.foreground }}>{formatCurrency(invoice.tax, currency)}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.foreground }}>{translate("invoiceTotal")}</Text>
            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.primary }}>{formatCurrency(invoice.total, currency)}</Text>
          </View>
        </View>

        {/* Note */}
        {invoice.note ? (
          <View style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>{translate("invoiceNote")}</Text>
            <Text style={{ fontSize: 14, color: colors.foreground }}>{invoice.note}</Text>
          </View>
        ) : null}

        {/* Photo Attachments */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>{translate("attachedPhotos")}</Text>
          <TouchableOpacity onPress={handleAddPhoto} style={{ flexDirection: "row", alignItems: "center" }}>
            <IconSymbol name="camera.fill" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "500", marginLeft: 4, fontSize: 13 }}>{translate("addPhoto")}</Text>
          </TouchableOpacity>
        </View>
        {invoice.photoUris.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {invoice.photoUris.map((uri, i) => (
              <TouchableOpacity
                key={i}
                onLongPress={() => {
                  Alert.alert(translate("removePhoto"), "", [
                    { text: translate("cancel"), style: "cancel" },
                    {
                      text: translate("delete"),
                      style: "destructive",
                      onPress: () => {
                        const newUris = invoice.photoUris.filter((_, idx) => idx !== i);
                        updateInvoice({ ...invoice, photoUris: newUris });
                      },
                    },
                  ]);
                }}
                style={{ marginRight: 10 }}
              >
                <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 10 }} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={{ color: colors.muted, marginBottom: 20 }}>{translate("noPhotos")}</Text>
        )}

        {/* Action Buttons */}
        <View style={{ gap: 10, marginBottom: 40 }}>
          {/* Status Change Button */}
          <TouchableOpacity
            onPress={handleStatusChange}
            style={{ backgroundColor: statusColor + "20", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
          >
            <IconSymbol name="checkmark.circle.fill" size={20} color={statusColor} />
            <Text style={{ color: statusColor, fontWeight: "600", marginLeft: 8, fontSize: 15 }}>{translate("changeStatus")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSharePDF}
            style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
          >
            <IconSymbol name="square.and.arrow.up" size={20} color={colors.background} />
            <Text style={{ color: colors.background, fontWeight: "600", marginLeft: 8, fontSize: 15 }}>{translate("sharePDF")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePrint}
            style={{ backgroundColor: colors.surface, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
          >
            <IconSymbol name="printer.fill" size={20} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontWeight: "600", marginLeft: 8, fontSize: 15 }}>{translate("printInvoice")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
