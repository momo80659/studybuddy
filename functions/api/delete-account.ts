type Env = {
  DB: D1Database;
  ACCOUNT_KV?: KVNamespace;
};

type DeleteAccountBody = {
  accountName?: string;
  password?: string;
};

const SUPPORTED_ALGO = "PBKDF2-SHA256-100000";
const PBKDF2_ITERATIONS = 100_000;

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

function timingSafeEqualText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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
  const bytes = new Uint8Array(derivedBits);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function readJson(request: Request): Promise<DeleteAccountBody | null> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await request.json<DeleteAccountBody>();
  } catch {
    return null;
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => jsonResponse({ ok: true });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) {
    return jsonResponse({ ok: false, message: "系統暫時未完成帳戶資料庫設定，請稍後再試。" }, 500);
  }

  const body = await readJson(request);
  if (!body) {
    return jsonResponse({ ok: false, message: "請使用 JSON 格式提交刪除帳戶資料。" }, 400);
  }

  const accountName = String(body.accountName || "").trim();
  const password = String(body.password || "");

  if (!accountName) {
    return jsonResponse({ ok: false, message: "請輸入帳戶名稱。" }, 400);
  }
  if (accountName.length > 40) {
    return jsonResponse({ ok: false, message: "帳戶名稱不可超過 40 個字元。" }, 400);
  }
  if (!password) {
    return jsonResponse({ ok: false, message: "請輸入登入密碼以確認刪除。" }, 400);
  }

  try {
    const record = await env.DB.prepare(
      `SELECT id, account_name, email, password_hash, password_salt, password_algo
       FROM users
       WHERE account_name = ?
       LIMIT 1`,
    )
      .bind(accountName)
      .first<{
        id: string;
        account_name: string;
        email: string;
        password_hash: string;
        password_salt: string;
        password_algo: string;
      }>();

    if (!record) {
      return jsonResponse({ ok: false, message: "帳戶名稱或密碼不正確。" }, 401);
    }

    if (record.password_algo !== SUPPORTED_ALGO) {
      return jsonResponse({ ok: false, message: "此帳戶的密碼格式暫不支援，請聯絡管理員。" }, 500);
    }

    const salt = fromBase64(record.password_salt);
    const derivedHash = await derivePasswordHash(password, salt);

    if (!timingSafeEqualText(derivedHash, record.password_hash)) {
      return jsonResponse({ ok: false, message: "帳戶名稱或密碼不正確。" }, 401);
    }

    await env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(record.id).run();

    if (env.ACCOUNT_KV) {
      await env.ACCOUNT_KV.delete(`user_email:${record.email}`);
    }

    return jsonResponse({
      ok: true,
      message: "帳號已永久刪除。",
    });
  } catch {
    return jsonResponse({ ok: false, message: "刪除帳號暫時未能完成，請稍後再試。" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  return jsonResponse({ ok: false, message: "此 API 只接受 POST 請求。" }, 405);
};
