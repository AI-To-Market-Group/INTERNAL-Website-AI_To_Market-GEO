import crypto from "crypto";
import { isDbAvailable } from "@/lib/db";
import {
  dbGetGAConnection,
  dbSaveGAConnection,
  dbUpdateAccessToken,
} from "@/lib/db";

export interface GAConnection {
  userId: string;
  gaPropertyId: string;
  gaPropertyDisplayName?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number; // epoch ms
  createdAt: number;
  updatedAt: number;
}

// Simple in-memory store for demo purposes. In production you should replace
// this with a persistent database (e.g. Postgres, Supabase, Vercel KV, etc.).
const connections = new Map<string, GAConnection>();

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  // Derive a 32-byte key from the provided secret.
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
  const buf = Buffer.from(value, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

export async function saveGAConnection(input: {
  userId: string;
  gaPropertyId: string;
  gaPropertyDisplayName?: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
}): Promise<GAConnection> {
  const now = Date.now();
  const existing = connections.get(input.userId);
  const record: GAConnection = {
    userId: input.userId,
    gaPropertyId: input.gaPropertyId,
    gaPropertyDisplayName: input.gaPropertyDisplayName ?? existing?.gaPropertyDisplayName,
    accessToken: encrypt(input.accessToken),
    refreshToken: encrypt(input.refreshToken),
    tokenExpiry: input.tokenExpiry,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  connections.set(input.userId, record);

  if (isDbAvailable()) {
    try {
      await dbSaveGAConnection({
        userId: input.userId,
        gaPropertyId: input.gaPropertyId,
        gaPropertyDisplayName: input.gaPropertyDisplayName,
        accessToken: record.accessToken,
        refreshToken: record.refreshToken,
        tokenExpiry: input.tokenExpiry,
      });
    } catch {
      /* keep in-memory */
    }
  }

  return record;
}

export async function getGAConnection(userId: string): Promise<GAConnection | null> {
  if (isDbAvailable()) {
    try {
      const row = await dbGetGAConnection(userId);
      if (row) {
        return {
          userId: row.user_id,
          gaPropertyId: row.ga_property_id,
          gaPropertyDisplayName: row.ga_property_display_name ?? undefined,
          accessToken: decrypt(row.access_token),
          refreshToken: decrypt(row.refresh_token),
          tokenExpiry: row.token_expiry,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      }
    } catch {
      /* fallback to memory */
    }
  }

  const record = connections.get(userId);
  if (!record) return null;
  return {
    ...record,
    accessToken: decrypt(record.accessToken),
    refreshToken: decrypt(record.refreshToken),
  };
}

export async function updateAccessToken(userId: string, accessToken: string, tokenExpiry: number) {
  const existing = connections.get(userId);
  if (!existing) return;
  const now = Date.now();
  const encrypted = encrypt(accessToken);
  connections.set(userId, {
    ...existing,
    accessToken: encrypted,
    tokenExpiry,
    updatedAt: now,
  });

  if (isDbAvailable()) {
    try {
      await dbUpdateAccessToken(userId, encrypted, tokenExpiry);
    } catch {
      /* keep in-memory */
    }
  }
}

