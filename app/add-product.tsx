import { useState, useEffect } from "react";
import { Text, View, TextInput, TouchableOpacity, ScrollView, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { Image } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useApp } from "@/lib/app-context";
import { useColors } from "@/hooks/use-colors";

const UNITS = ["pcs", "kg", "L", "m", "boxes"];

export default function AddProductScreen() {
  const { state, translate, addProduct, updateProduct } = useApp();
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string }>();

  const editProduct = params.editId ? state.products.find((p) => p.id === params.editId) : null;

  const [name, setName] = useState(editProduct?.name || "");
  const [description, setDescription] = useState(editProduct?.description || "");
  const [price, setPrice] = useState(editProduct?.price?.toString() || "");
  const [quantity, setQuantity] = useState(editProduct?.quantity?.toString() || "");
  const [unit, setUnit] = useState(editProduct?.unit || "pcs");
  const [photoUri, setPhotoUri] = useState(editProduct?.photoUri || "");

  const unitLabels: Record<string, string> = {
    pcs: translate("pieces"),
    kg: translate("kilograms"),
    L: translate("liters"),
    m: translate("meters"),
    boxes: translate("boxes"),
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(translate("error"), "Camera permission required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(translate("addPhoto"), "", [
      { text: translate("takePhoto"), onPress: takePhoto },
      { text: translate("chooseFromLibrary"), onPress: pickImage },
      { text: translate("cancel"), style: "cancel" },
    ]);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert(translate("error"), translate("productName"));
      return;
    }
    const parsedPrice = parseFloat(price) || 0;
    const parsedQty = parseInt(quantity) || 0;

    if (editProduct) {
      updateProduct({
        ...editProduct,
        name: name.trim(),
        description: description.trim(),
        price: parsedPrice,
        quantity: parsedQty,
        unit,
        photoUri,
      });
    } else {
      addProduct(name.trim(), description.trim(), parsedPrice, parsedQty, unit, photoUri);
    }
    router.back();
  };

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-4 pt-4">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="xmark" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground }}>
            {editProduct ? translate("editProduct") : translate("addProduct")}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Text style={{ fontSize: 16, fontWeight: "600", color: colors.primary }}>{translate("save")}</Text>
          </TouchableOpacity>
        </View>

        {/* Photo */}
        <TouchableOpacity
          onPress={showPhotoOptions}
          style={{
            alignSelf: "center",
            width: 120,
            height: 120,
            borderRadius: 16,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            overflow: "hidden",
          }}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ width: 120, height: 120 }} />
          ) : (
            <View style={{ alignItems: "center" }}>
              <IconSymbol name="camera.fill" size={32} color={colors.muted} />
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{translate("addPhoto")}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Product Name */}
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 6 }}>{translate("productName")}</Text>
        <TextInput
          style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 14, fontSize: 16, color: colors.foreground, marginBottom: 16 }}
          placeholder={translate("productName")}
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={setName}
        />

        {/* Description */}
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 6 }}>{translate("productDescription")}</Text>
        <TextInput
          style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 14, fontSize: 16, color: colors.foreground, marginBottom: 16, minHeight: 60 }}
          placeholder={translate("enterDescription")}
          placeholderTextColor={colors.muted}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {/* Price and Quantity Row */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 6 }}>{translate("productPrice")}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 14, fontSize: 16, color: colors.foreground }}
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 6 }}>{translate("productQuantity")}</Text>
            <TextInput
              style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 14, fontSize: 16, color: colors.foreground }}
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Unit Selector */}
        <Text style={{ fontSize: 13, fontWeight: "500", color: colors.muted, marginBottom: 6 }}>{translate("productUnit")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
          {UNITS.map((u) => (
            <TouchableOpacity
              key={u}
              onPress={() => setUnit(u)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 20,
                backgroundColor: unit === u ? colors.primary : colors.surface,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "500", color: unit === u ? colors.background : colors.foreground }}>
                {unitLabels[u] || u}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSave}
          style={{ backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 40 }}
        >
          <Text style={{ color: colors.background, fontSize: 16, fontWeight: "600" }}>{translate("save")}</Text>
        </TouchableOpacity>
      </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
