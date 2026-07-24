import { Capacitor, registerPlugin } from "@capacitor/core";

let nativeSessionMemoryPlugin;

const getNativeSessionMemoryPlugin = () => {
  if (!nativeSessionMemoryPlugin) {
    nativeSessionMemoryPlugin = registerPlugin("NativeSessionMemory");
  }
  return nativeSessionMemoryPlugin;
};

export async function readNativeSessionToken() {
  if (!Capacitor.isNativePlatform()) return "";
  const result = await getNativeSessionMemoryPlugin().get();
  return typeof result?.token === "string" ? result.token.trim() : "";
}

export async function writeNativeSessionToken(token) {
  if (!Capacitor.isNativePlatform()) return;
  await getNativeSessionMemoryPlugin().set({ token });
}

export async function clearNativeSessionToken() {
  if (!Capacitor.isNativePlatform()) return;
  await getNativeSessionMemoryPlugin().clear();
}
