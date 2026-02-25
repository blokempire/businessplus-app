import { useState, useMemo, useCallback } from "react";
import {
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import * as Contacts from "expo-contacts";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";
import { calculateContactBalance, formatCurrency, Contact } from "@/lib/store";

interface PhoneContact {
  id: string;
  name: string;
  phone: string;
  selected: boolean;
}

export default function ContactsScreen() {
  const { state, translate, addContact, deleteContact } = useApp();
  const colors = useColors();
  const router = useRouter();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNote, setNewNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Phone book import state
  const [phoneContacts, setPhoneContacts] = useState<PhoneContact[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importSearch, setImportSearch] = useState("");

  // Editable import state
  const [showEditImport, setShowEditImport] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNote, setEditNote] = useState("");

  // Calculate totals
  const summary = useMemo(() => {
    let totalOwed = 0;
    let totalOwe = 0;
    for (const contact of state.contacts) {
      const bal = calculateContactBalance(state.debtEntries, contact.id);
      if (bal.netBalance > 0) totalOwed += bal.netBalance;
      else totalOwe += Math.abs(bal.netBalance);
    }
    return { totalOwed, totalOwe };
  }, [state.contacts, state.debtEntries]);

  // Filter contacts by search
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return state.contacts;
    const q = searchQuery.toLowerCase();
    return state.contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [state.contacts, searchQuery]);

  // Filtered phone contacts for import
  const filteredPhoneContacts = useMemo(() => {
    if (!importSearch.trim()) return phoneContacts;
    const q = importSearch.toLowerCase();
    return phoneContacts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
  }, [phoneContacts, importSearch]);

  const selectedCount = useMemo(
    () => phoneContacts.filter((c) => c.selected).length,
    [phoneContacts]
  );

  const handleAddContact = () => {
    if (!newName.trim()) return;
    addContact(newName.trim(), newPhone.trim(), newNote.trim());
    setNewName("");
    setNewPhone("");
    setNewNote("");
    setShowAddModal(false);
  };

  const handleDeleteContact = (contact: Contact) => {
    Alert.alert(
      translate("deleteContact"),
      translate("deleteContactConfirm"),
      [
        { text: translate("cancel"), style: "cancel" },
        {
          text: translate("delete"),
          style: "destructive",
          onPress: () => deleteContact(contact.id),
        },
      ]
    );
  };

  // Phone book import
  const handleImportFromPhoneBook = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert(translate("error"), "Phone book import is only available on mobile devices.");
      return;
    }
    setImportLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(translate("error"), translate("contactsPermissionDenied"));
        setImportLoading(false);
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
      });
      const mapped: PhoneContact[] = data
        .filter((c) => c.name)
        .map((c) => ({
          id: c.id || String(Math.random()),
          name: `${c.firstName || ""} ${c.lastName || ""}`.trim() || c.name || "",
          phone:
            c.phoneNumbers && c.phoneNumbers.length > 0
              ? c.phoneNumbers[0].number || ""
              : "",
          selected: false,
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setPhoneContacts(mapped);
      setShowImportModal(true);
    } catch (e) {
      Alert.alert(translate("error"), String(e));
    }
    setImportLoading(false);
  }, [translate]);

  const togglePhoneContact = (id: string) => {
    setPhoneContacts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c))
    );
  };

  const handleImportSelected = () => {
    const selected = phoneContacts.filter((c) => c.selected);
    if (selected.length === 0) return;
    if (selected.length === 1) {
      // Single contact — show edit form before saving
      setEditName(selected[0].name);
      setEditPhone(selected[0].phone);
      setEditNote("");
      setShowImportModal(false);
      setShowEditImport(true);
    } else {
      // Multiple contacts — import all, user can edit later
      for (const c of selected) {
        addContact(c.name, c.phone, "");
      }
      setShowImportModal(false);
      setPhoneContacts([]);
    }
  };

  const handleSaveEditedImport = () => {
    if (!editName.trim()) return;
    addContact(editName.trim(), editPhone.trim(), editNote.trim());
    setEditName("");
    setEditPhone("");
    setEditNote("");
    setShowEditImport(false);
    setPhoneContacts([]);
  };

  const renderContact = ({ item }: { item: Contact }) => {
    const bal = calculateContactBalance(state.debtEntries, item.id);
    const netBalance = bal.netBalance;
    const balanceColor = netBalance > 0 ? colors.success : netBalance < 0 ? colors.error : colors.muted;
    const balanceLabel =
      netBalance > 0
        ? translate("theyOweMe")
        : netBalance < 0
        ? translate("iOweThem")
        : "";

    return (
      <TouchableOpacity
        style={[styles.contactCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        activeOpacity={0.7}
        onPress={() =>
          router.push({
            pathname: "/contact-detail" as any,
            params: { contactId: item.id },
          })
        }
        onLongPress={() => handleDeleteContact(item)}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.contactInfo}>
          <Text style={[styles.contactName, { color: colors.foreground }]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.phone ? (
            <Text style={[styles.contactPhone, { color: colors.muted }]} numberOfLines={1}>
              {item.phone}
            </Text>
          ) : null}
        </View>
        <View style={styles.balanceContainer}>
          {netBalance !== 0 ? (
            <>
              <Text style={[styles.balanceAmount, { color: balanceColor }]}>
                {formatCurrency(Math.abs(netBalance), state.profile.currency)}
              </Text>
              <Text style={[styles.balanceLabel, { color: balanceColor }]}>{balanceLabel}</Text>
            </>
          ) : (
            <Text style={[styles.balanceLabel, { color: colors.muted }]}>—</Text>
          )}
        </View>
        <IconSymbol name="chevron.right" size={16} color={colors.muted} />
      </TouchableOpacity>
    );
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          {translate("contacts")}
        </Text>
        <View style={styles.headerActions}>
          {/* Import from Phone Book */}
          <TouchableOpacity
            style={[styles.importButton, { backgroundColor: colors.primary + "15" }]}
            activeOpacity={0.7}
            onPress={handleImportFromPhoneBook}
            disabled={importLoading}
          >
            {importLoading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <IconSymbol name="person.2.fill" size={18} color={colors.primary} />
            )}
          </TouchableOpacity>
          {/* Add manually */}
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.7}
            onPress={() => setShowAddModal(true)}
          >
            <IconSymbol name="plus.circle.fill" size={20} color={colors.background} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.success + "15", borderColor: colors.success + "30" }]}>
          <Text style={[styles.summaryLabel, { color: colors.success }]}>
            {translate("totalOwedToYou")}
          </Text>
          <Text style={[styles.summaryAmount, { color: colors.success }]}>
            {formatCurrency(summary.totalOwed, state.profile.currency)}
          </Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.error + "15", borderColor: colors.error + "30" }]}>
          <Text style={[styles.summaryLabel, { color: colors.error }]}>
            {translate("totalYouOwe")}
          </Text>
          <Text style={[styles.summaryAmount, { color: colors.error }]}>
            {formatCurrency(summary.totalOwe, state.profile.currency)}
          </Text>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.foreground }]}
            placeholder={translate("search")}
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="done"
          />
        </View>
      </View>

      {/* Contact List */}
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContact}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              {translate("noContacts")}
            </Text>
          </View>
        }
      />

      {/* Add Contact Modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {translate("addContact")}
              </Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} activeOpacity={0.7}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {translate("contactName")} *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder={translate("enterContactName")}
                placeholderTextColor={colors.muted}
                value={newName}
                onChangeText={setNewName}
                returnKeyType="done"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {translate("phoneNumber")}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder={translate("enterPhone")}
                placeholderTextColor={colors.muted}
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
                returnKeyType="done"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {translate("note")}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder={translate("enterNote")}
                placeholderTextColor={colors.muted}
                value={newNote}
                onChangeText={setNewNote}
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: newName.trim() ? 1 : 0.5 }]}
              activeOpacity={0.7}
              onPress={handleAddContact}
              disabled={!newName.trim()}
            >
              <Text style={[styles.saveButtonText, { color: colors.background }]}>
                {translate("save")}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Import from Phone Book Modal */}
      <Modal visible={showImportModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.importModalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {translate("selectContacts")}
              </Text>
              <TouchableOpacity onPress={() => { setShowImportModal(false); setPhoneContacts([]); }} activeOpacity={0.7}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            {/* Import search */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border, marginBottom: 12 }]}>
              <IconSymbol name="magnifyingglass" size={18} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.foreground }]}
                placeholder={translate("search")}
                placeholderTextColor={colors.muted}
                value={importSearch}
                onChangeText={setImportSearch}
                returnKeyType="done"
              />
            </View>

            {/* Selected count */}
            <Text style={[styles.selectedCountText, { color: colors.primary }]}>
              {selectedCount} {translate("selectedCount")}
            </Text>

            {/* Phone contacts list */}
            <FlatList
              data={filteredPhoneContacts}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.phoneContactRow,
                    {
                      backgroundColor: item.selected ? colors.primary + "10" : colors.surface,
                      borderColor: item.selected ? colors.primary : colors.border,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => togglePhoneContact(item.id)}
                >
                  <View style={[styles.checkbox, { borderColor: item.selected ? colors.primary : colors.muted, backgroundColor: item.selected ? colors.primary : "transparent" }]}>
                    {item.selected && <IconSymbol name="checkmark" size={14} color="#FFF" />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.phoneContactName, { color: colors.foreground }]}>{item.name}</Text>
                    {item.phone ? (
                      <Text style={[styles.phoneContactPhone, { color: colors.muted }]}>{item.phone}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.muted, textAlign: "center", paddingTop: 40 }]}>
                  {translate("noContacts")}
                </Text>
              }
            />

            {/* Import button */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: selectedCount > 0 ? 1 : 0.5, marginTop: 12 }]}
              activeOpacity={0.7}
              onPress={handleImportSelected}
              disabled={selectedCount === 0}
            >
              <Text style={[styles.saveButtonText, { color: colors.background }]}>
                {translate("importSelected")} ({selectedCount})
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Edit Imported Contact Modal */}
      <Modal visible={showEditImport} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {translate("editContact")}
              </Text>
              <TouchableOpacity onPress={() => setShowEditImport(false)} activeOpacity={0.7}>
                <IconSymbol name="xmark" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {translate("contactName")} *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={editName}
                onChangeText={setEditName}
                returnKeyType="done"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {translate("phoneNumber")}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                returnKeyType="done"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.foreground }]}>
                {translate("note")}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.foreground }]}
                placeholder={translate("enterNote")}
                placeholderTextColor={colors.muted}
                value={editNote}
                onChangeText={setEditNote}
                multiline
                numberOfLines={3}
                returnKeyType="done"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary, opacity: editName.trim() ? 1 : 0.5 }]}
              activeOpacity={0.7}
              onPress={handleSaveEditedImport}
              disabled={!editName.trim()}
            >
              <Text style={[styles.saveButtonText, { color: colors.background }]}>
                {translate("save")}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  importButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: "700",
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: 40,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 100,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "700",
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
  },
  contactPhone: {
    fontSize: 13,
    marginTop: 2,
  },
  balanceContainer: {
    alignItems: "flex-end",
  },
  balanceAmount: {
    fontSize: 15,
    fontWeight: "700",
  },
  balanceLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  importModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "85%",
    flex: 1,
    marginTop: "15%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  saveButton: {
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  selectedCountText: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  phoneContactRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  phoneContactName: {
    fontSize: 15,
    fontWeight: "600",
  },
  phoneContactPhone: {
    fontSize: 13,
    marginTop: 2,
  },
});
