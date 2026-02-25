import { useState } from "react";
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, Platform, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";

interface ExportPreviewProps {
  visible: boolean;
  onClose: () => void;
  html: string;
  title: string;
  fileName?: string;
  shareLabel?: string;
  printLabel?: string;
  closeLabel?: string;
}

export function ExportPreview({
  visible,
  onClose,
  html,
  title,
  fileName = "export.pdf",
  shareLabel = "Share PDF",
  printLabel = "Print",
  closeLabel = "Close",
}: ExportPreviewProps) {
  const colors = useColors();
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    try {
      setLoading(true);
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: fileName });
    } catch (e) {
      console.error("Share error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    try {
      setLoading(true);
      await Print.printAsync({ html });
    } catch (e) {
      console.error("Print error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[s.container, { backgroundColor: colors.background }]}>  
        {/* Header */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <IconSymbol name="xmark.circle.fill" size={28} color={colors.muted} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{title}</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Preview */}
        <View style={s.previewContainer}>
          {Platform.OS === "web" ? (
            <iframe
              srcDoc={html}
              style={{ flex: 1, border: "none", width: "100%", height: "100%" } as any}
            />
          ) : (
            <WebView
              originWhitelist={["*"]}
              source={{ html }}
              style={{ flex: 1 }}
              scalesPageToFit
            />
          )}
        </View>

        {/* Action Buttons */}
        <View style={[s.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleShare}
            disabled={loading}
            style={[s.actionBtn, { backgroundColor: colors.primary }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.background} />
            ) : (
              <>
                <IconSymbol name="square.and.arrow.up" size={18} color={colors.background} />
                <Text style={[s.actionBtnText, { color: colors.background }]}>{shareLabel}</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePrint}
            disabled={loading}
            style={[s.actionBtn, { backgroundColor: colors.surface }]}
          >
            <IconSymbol name="printer.fill" size={18} color={colors.foreground} />
            <Text style={[s.actionBtnText, { color: colors.foreground }]}>{printLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  previewContainer: {
    flex: 1,
    margin: 12,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 0.5,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
