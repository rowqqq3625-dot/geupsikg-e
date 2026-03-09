import AsyncStorage from "@react-native-async-storage/async-storage";

const INSTALL_ID_KEY = "@gipsige_install_id";
const LAST_ROUTE_KEY = "@gipsige_last_route";

let _installId: string | null = null;

export async function getOrCreateInstallId(): Promise<string> {
  if (_installId) return _installId;

  try {
    let id = await AsyncStorage.getItem(INSTALL_ID_KEY);
    if (!id) {
      id = generateUUID();
      await AsyncStorage.setItem(INSTALL_ID_KEY, id);
    }
    _installId = id;
    return id;
  } catch {
    const id = generateUUID();
    _installId = id;
    return id;
  }
}

export function getInstallIdSync(): string | null {
  return _installId;
}

export async function saveLastRoute(route: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_ROUTE_KEY, route);
  } catch {}
}

export async function getLastRoute(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_ROUTE_KEY);
  } catch {
    return null;
  }
}

export async function clearLastRoute(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_ROUTE_KEY);
  } catch {}
}

function generateUUID(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9) + "-" + Math.random().toString(36).substr(2, 9);
}
