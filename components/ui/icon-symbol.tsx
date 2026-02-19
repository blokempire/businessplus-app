import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  "list.bullet": "receipt-long",
  "chart.bar.fill": "bar-chart",
  "gearshape.fill": "settings",
  "plus.circle.fill": "add-circle",
  "minus.circle.fill": "remove-circle",
  "arrow.up.circle.fill": "arrow-upward",
  "arrow.down.circle.fill": "arrow-downward",
  "trash.fill": "delete",
  "pencil": "edit",
  "xmark": "close",
  "checkmark": "check",
  "magnifyingglass": "search",
  "calendar": "calendar-today",
  "person.fill": "person",
  "globe": "language",
  "dollarsign.circle": "attach-money",
  "folder.fill": "folder",
  "doc.text": "description",
  "info.circle": "info",
  "arrow.right.square": "logout",
  "cart.fill": "shopping-cart",
  "fork.knife": "restaurant",
  "bus.fill": "directions-bus",
  "heart.fill": "favorite",
  "lightbulb.fill": "lightbulb",
  "wrench.fill": "build",
  "gift.fill": "card-giftcard",
  "phone.fill": "phone",
  "wifi": "wifi",
  "drop.fill": "water-drop",
  "bolt.fill": "bolt",
  "graduationcap.fill": "school",
  "cross.fill": "local-hospital",
  "tag.fill": "local-offer",
  "banknote.fill": "payments",
  "building.2.fill": "business",
  "ellipsis": "more-horiz",
  "person.2.fill": "people",
  "person.crop.circle.badge.plus": "person-add",
  "creditcard.fill": "credit-card",
  "arrow.left.arrow.right": "swap-horiz",
  "checkmark.circle.fill": "check-circle",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
