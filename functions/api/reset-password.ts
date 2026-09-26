type Env = {
  DB: D1Database;
  ACCOUNT_KV?: KVNamespace;
};

type ResetBody = {
  token?: string;
  newPassword?: string;
};

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const PBKDF2_ITERATIONS = 100_000;
const SUPPORTED_ALGO = "PBKDF2-SHA256-100000";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store",
    },
  });
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function derivePasswordHash(password: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );
  return toBase64(new Uint8Array(derivedBits));
}

export const onRequestOptions: PagesFunction<Env> = async () => jsonResponse({ ok: true });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB || !env.ACCOUNT_KV) {
    return jsonResponse({ ok: false, message: "系統暫時未完成相關設定，請稍後再試。" }, 500);
  }

  let body: ResetBody | null = null;
  try {
    body = await request.json<ResetBody>();
  } catch {
    body = null;
  }
  const token = String(body?.token || "").trim();
  const newPassword = String(body?.newPassword || "");

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    return jsonResponse({ ok: false, message: "重設連結無效，請重新申請密碼重設。" }, 400);
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return jsonResponse({ ok: false, message: "新密碼最少需要 8 個字元。" }, 400);
  }
  if (newPassword.length > MAX_PASSWORD_LENGTH) {
    return jsonResponse({ ok: false, message: "新密碼不可超過 128 個字元。" }, 400);
  }

  try {
    // 查詢 token（KV TTL 已自動處理過期）
    const stored = await env.ACCOUNT_KV.get(`reset:${token}`);
    if (!stored) {
      return jsonResponse({ ok: false, message: "重設連結已失效或已使用，請重新申請。" }, 400);
    }
    const { email } = JSON.parse(stored) as { email: string; createdAt: number };

    // 查詢用戶
    const record = await env.DB.prepare(
      `SELECT id, password_salt, password_algo FROM users WHERE email = ? LIMIT 1`,
    )
      .bind(email)
      .first<{ id: string; password_salt: string; password_algo: string }>();

    if (!record) {
      await env.ACCOUNT_KV.delete(`reset:${token}`);
      return jsonResponse({ ok: false, message: "重設連結已失效，請重新申請。" }, 400);
    }

    // 用原有 salt 重新雜湊新密碼（保持演算法一致）
    const salt = fromBase64(record.password_salt);
    const newHash = await derivePasswordHash(newPassword, salt);

    await env.DB.prepare(
      `UPDATE users SET password_hash = ?, password_algo = ?, updated_at = ? WHERE id = ?`,
    )
      .bind(newHash, SUPPORTED_ALGO, new Date().toISOString(), record.id)
      .run();

    // 一次性 token：立即刪除
    await env.ACCOUNT_KV.delete(`reset:${token}`);

    return jsonResponse({ ok: true, message: "密碼已成功更新，請以新密碼登入。" });
  } catch {
    return jsonResponse({ ok: false, message: "系統暫時未能處理請求，請稍後再試。" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  return jsonResponse({ ok: false, message: "此 API 只接受 POST 請求。" }, 405);
};
