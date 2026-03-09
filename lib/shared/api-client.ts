import AsyncStorage from "@react-native-async-storage/async-storage";
import { getInstallIdSync } from "@/lib/session-manager";

const COOKIE_KEY = "@gipsige_cookies";
const IS_WEB = typeof window !== "undefined" && typeof document !== "undefined";

function buildBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) {
    return domain.startsWith("http") ? domain : `https://${domain}`;
  }
  return "http://localhost:5000";
}

const BASE_URL = buildBaseUrl();

async function getCookies(): Promise<string> {
  if (IS_WEB) return "";
  try {
    const raw = await AsyncStorage.getItem(COOKIE_KEY);
    if (!raw) return "";
    const jar: Record<string, { value: string; expires?: number }> = JSON.parse(raw);
    const now = Date.now();
    const parts: string[] = [];
    for (const [name, entry] of Object.entries(jar)) {
      if (!entry.expires || entry.expires > now) {
        parts.push(`${name}=${entry.value}`);
      }
    }
    return parts.join("; ");
  } catch {
    return "";
  }
}

async function saveCookies(setCookieHeaders: string[]): Promise<void> {
  if (IS_WEB) return;
  try {
    const raw = await AsyncStorage.getItem(COOKIE_KEY);
    const jar: Record<string, { value: string; expires?: number }> = raw ? JSON.parse(raw) : {};

    for (const header of setCookieHeaders) {
      const parts = header.split(";").map((p) => p.trim());
      const [nameValue, ...attrs] = parts;
      const eqIdx = nameValue.indexOf("=");
      if (eqIdx === -1) continue;
      const name = nameValue.slice(0, eqIdx).trim();
      const value = nameValue.slice(eqIdx + 1).trim();

      let expires: number | undefined;
      for (const attr of attrs) {
        const lower = attr.toLowerCase();
        if (lower.startsWith("max-age=")) {
          const secs = parseInt(attr.slice(8), 10);
          if (!isNaN(secs)) expires = Date.now() + secs * 1000;
        } else if (lower.startsWith("expires=")) {
          const d = new Date(attr.slice(8));
          if (!isNaN(d.getTime())) expires = d.getTime();
        }
      }

      if (value === "" || value === "deleted") {
        delete jar[name];
      } else {
        jar[name] = expires ? { value, expires } : { value };
      }
    }
    await AsyncStorage.setItem(COOKIE_KEY, JSON.stringify(jar));
  } catch {
  }
}

async function clearCookies(): Promise<void> {
  if (IS_WEB) return;
  await AsyncStorage.removeItem(COOKIE_KEY);
}

function toFullUrl(url: string): string {
  return url.startsWith("http") ? url : `${BASE_URL}${url}`;
}

function injectInstallId(headers: Record<string, string>): void {
  const installId = getInstallIdSync();
  if (installId) headers["X-Install-Id"] = installId;
}

async function mobileFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const cookieStr = await getCookies();
  const headers: Record<string, string> = {};

  const initHeaders = init.headers as Record<string, string> | undefined;
  if (initHeaders) {
    for (const [k, v] of Object.entries(initHeaders)) {
      headers[k] = v;
    }
  }
  if (cookieStr) headers["Cookie"] = cookieStr;
  injectInstallId(headers);

  const fullUrl = toFullUrl(url);
  const res = await fetch(fullUrl, { ...init, headers });

  const rawSetCookie = res.headers.get("set-cookie");
  if (rawSetCookie) {
    await saveCookies([rawSetCookie]);
  }

  return res;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (extraHeaders) Object.assign(headers, extraHeaders);
  let body: BodyInit | undefined;

  if (data instanceof FormData) {
    // Content-Type은 설정하지 않음 — 브라우저/RN이 boundary 포함해서 자동 설정
    body = data;
  } else if (data !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }

  const fullUrl = toFullUrl(url);

  injectInstallId(headers);

  let res: Response;
  if (IS_WEB) {
    res = await fetch(fullUrl, {
      method,
      headers,
      body,
      credentials: "include",
    });
  } else {
    res = await mobileFetch(url, {
      method,
      headers,
      body,
    });
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export function getQueryFn<T>(options: { on401: UnauthorizedBehavior }) {
  return async ({ queryKey }: { queryKey: readonly unknown[] }): Promise<T> => {
    const path = (queryKey as string[]).join("/");
    const fullUrl = toFullUrl(path);

    let res: Response;

    if (IS_WEB) {
      const hdrs: Record<string, string> = {};
      injectInstallId(hdrs);
      res = await fetch(fullUrl, { credentials: "include", headers: hdrs });
    } else {
      res = await mobileFetch(path);
    }

    if (options.on401 === "returnNull" && res.status === 401) {
      return null as T;
    }
    await throwIfResNotOk(res);
    return res.json() as Promise<T>;
  };
}

export function getApiUrl(): string {
  return BASE_URL;
}

export { clearCookies, BASE_URL };
