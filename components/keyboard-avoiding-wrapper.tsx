import { KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { type ReactNode } from "react";

interface KeyboardAvoidingWrapperProps {
  children: ReactNode;
  keyboardVerticalOffset?: number;
}

/**
 * Wraps content in a KeyboardAvoidingView that pushes content up
 * when the keyboard is displayed, keeping input fields visible.
 *
 * Usage: Wrap the outermost ScrollView or content container.
 */
export function KeyboardAvoidingWrapper({
  children,
  keyboardVerticalOffset = Platform.OS === "ios" ? 90 : 0,
}: KeyboardAvoidingWrapperProps) {
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
