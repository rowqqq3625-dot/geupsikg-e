import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform, AppState } from "react-native";
import { apiRequest } from "@/lib/shared/api-client";

const ACTION_QUEUE_KEY = "@gipsige_action_queue";

export type QueuedAction = {
  id: string;
  method: string;
  url: string;
  body?: unknown;
  idempotencyKey: string;
  createdAt: number;
  retries: number;
};

let _isOnline = true;
let _listeners: ((online: boolean) => void)[] = [];
let _flushInProgress = false;

export function generateIdempotencyKey(): string {
  return Date.now().toString(36) + "-" + Math.random().toString(36).substr(2, 9);
}

export function isOnline(): boolean {
  return _isOnline;
}

export function onConnectivityChange(listener: (online: boolean) => void): () => void {
  _listeners.push(listener);
  return () => {
    _listeners = _listeners.filter((l) => l !== listener);
  };
}

export function initNetworkMonitor(): () => void {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    _isOnline = navigator.onLine;

    const handleOnline = () => {
      _isOnline = true;
      flushQueue();
      _listeners.forEach((l) => l(true));
    };
    const handleOffline = () => {
      _isOnline = false;
      _listeners.forEach((l) => l(false));
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }

  let checkNetwork: (() => Promise<void>) | null = null;
  try {
    const Network = require("expo-network");
    checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const wasOnline = _isOnline;
        _isOnline = !!(state.isConnected);
        if (!wasOnline && _isOnline) {
          flushQueue();
        }
        _listeners.forEach((l) => l(_isOnline));
      } catch {
        _isOnline = true;
      }
    };
    checkNetwork();
  } catch {}

  const sub = AppState.addEventListener("change", async (state) => {
    if (state === "active" && checkNetwork) {
      await checkNetwork();
    } else if (state === "active") {
      const wasOffline = !_isOnline;
      _isOnline = true;
      if (wasOffline) {
        flushQueue();
        _listeners.forEach((l) => l(true));
      }
    }
  });

  const interval = setInterval(async () => {
    if (checkNetwork) await checkNetwork();
  }, 15000);

  return () => {
    sub.remove();
    clearInterval(interval);
  };
}

export async function enqueueAction(method: string, url: string, body?: unknown): Promise<string> {
  const action: QueuedAction = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 6),
    method,
    url,
    body,
    idempotencyKey: generateIdempotencyKey(),
    createdAt: Date.now(),
    retries: 0,
  };

  const queue = await getQueue();
  queue.push(action);
  await saveQueue(queue);
  return action.idempotencyKey;
}

export async function flushQueue(): Promise<void> {
  if (_flushInProgress || !_isOnline) return;
  _flushInProgress = true;

  try {
    let queue = await getQueue();
    const completed: string[] = [];

    for (const action of queue) {
      try {
        const hdrs: Record<string, string> = {};
        if (action.idempotencyKey) hdrs["X-Idempotency-Key"] = action.idempotencyKey;
        await apiRequest(action.method, action.url, action.body, hdrs);
        completed.push(action.id);
      } catch (err: any) {
        action.retries += 1;
        const status = err?.message?.match(/^(\d{3}):/)?.[1];
        if (action.retries >= 5 || (status && parseInt(status) >= 400 && parseInt(status) < 500)) {
          completed.push(action.id);
        }
      }
    }

    queue = queue.filter((a) => !completed.includes(a.id));
    await saveQueue(queue);
  } finally {
    _flushInProgress = false;
  }
}

export async function getQueueLength(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

async function getQueue(): Promise<QueuedAction[]> {
  try {
    const raw = await AsyncStorage.getItem(ACTION_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveQueue(queue: QueuedAction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTION_QUEUE_KEY, JSON.stringify(queue));
  } catch {}
}
