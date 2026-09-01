import crypto from "crypto";
import { isDbAvailable } from "@/lib/db";
import {
  dbGetGSCConnection,
  dbSaveGSCConnection,
  dbUpdateGSCAccessToken,
} from "@/lib/db";

export interface GSCConnection {
  userId: string;
  siteUrl: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}

const connections = new Map<string, GSCConnection & { accessToken: string; refreshToken: string }>();

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

function encrypt(value: string): string {
  const key = getKey();
  if (!key) return value;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decrypt(value: string): string {
  const key = getKey();
  if (!key) return value;
  try {
    const buf = Buffer.from(value, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return value;
  }
}

export async function saveGSCConnection(input: {
  userId: string;
  siteUrl: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}): Promise<void> {
  const encAccess  = encrypt(input.accessToken);
  const encRefresh = encrypt(input.refreshToken);

  connections.set(input.userId, {
    userId: input.userId,
    siteUrl: input.siteUrl,
    accessToken: encAccess,
    refreshToken: encRefresh,
    tokenExpiry: input.tokenExpiry,
  });

  if (isDbAvailable()) {
    try {
      await dbSaveGSCConnection({
        userId: input.userId,
        siteUrl: input.siteUrl,
        accessToken: encAccess,
        refreshToken: encRefresh,
        tokenExpiry: input.tokenExpiry,
      });
    } catch { /* keep in-memory */ }
  }
}

export async function getGSCConnection(userId: string): Promise<GSCConnection | null> {
  if (isDbAvailable()) {
    try {
      const row = await dbGetGSCConnection(userId);
      if (row) {
        return {
          userId: row.user_id,
          siteUrl: row.site_url,
          accessToken: decrypt(row.access_token),
          refreshToken: decrypt(row.refresh_token),
          tokenExpiry: row.token_expiry,
        };
      }
    } catch { /* fallback to memory */ }
  }

  const rec = connections.get(userId);
  if (!rec) return null;
  return { ...rec, accessToken: decrypt(rec.accessToken), refreshToken: decrypt(rec.refreshToken) };
}

export async function refreshGSCTokenIfNeeded(conn: GSCConnection): Promise<GSCConnection> {
  if (Date.now() < conn.tokenExpiry - 60_000) return conn;

  const clientId     = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET!;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      refresh_token: conn.refreshToken,
      grant_type:    "refresh_token",
    }),
  });

  if (!res.ok) throw new Error(`GSC token refresh failed: ${res.status}`);

  const json = (await res.json()) as { access_token: string; expires_in: number };
  const newExpiry = Date.now() + json.expires_in * 1000;
  const newToken  = json.access_token;

  const encAccess = encrypt(newToken);
  connections.set(conn.userId, {
    ...connections.get(conn.userId)!,
    accessToken: encAccess,
    tokenExpiry: newExpiry,
  });

  if (isDbAvailable()) {
    try { await dbUpdateGSCAccessToken(conn.userId, encAccess, newExpiry); } catch { /* ignore */ }
  }

  return { ...conn, accessToken: newToken, tokenExpiry: newExpiry };
}
