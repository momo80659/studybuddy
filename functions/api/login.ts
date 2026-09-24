type Env = {
  DB: D1Database;
  ACCOUNT_KV?: KVNamespace;
};

type LoginBody = {
  accessCode?: string;
  accountName?: string;
  password?: string;
};

const REQUIRED_ACCESS_CODE = "01347";
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

async function readJson(request: Request): Promise<LoginBody | null> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await request.json<LoginBody>();
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
    return jsonResponse({ ok: false, message: "請使用 JSON 格式提交登入資料。" }, 400);
  }

  const accessCode = String(body.accessCode || "").trim();
  const accountName = String(body.accountName || "").trim();
  const password = String(body.password || "");

  if (!timingSafeEqualText(accessCode, REQUIRED_ACCESS_CODE)) {
    return jsonResponse({ ok: false, message: "介紹碼不正確。請輸入有效介紹碼後才可登入。" }, 403);
  }
  if (!accountName) {
    return jsonResponse({ ok: false, message: "請輸入帳戶名稱。" }, 400);
  }
  if (accountName.length > 40) {
    return jsonResponse({ ok: false, message: "帳戶名稱不可超過 40 個字元。" }, 400);
  }
  if (!password) {
    return jsonResponse({ ok: false, message: "請輸入登入密碼。" }, 400);
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
      return jsonResponse({ ok: false, message: "此帳戶的密碼格式暫不支援，請重新註冊。" }, 500);
    }

    const salt = fromBase64(record.password_salt);
    const derivedHash = await derivePasswordHash(password, salt);

    if (!timingSafeEqualText(derivedHash, record.password_hash)) {
      return jsonResponse({ ok: false, message: "帳戶名稱或密碼不正確。" }, 401);
    }

    return jsonResponse({
      ok: true,
      message: "登入成功。",
      user: {
        id: record.id,
        accountName: record.account_name,
        email: record.email,
      },
    });
  } catch {
    return jsonResponse({ ok: false, message: "登入暫時未能完成，請稍後再試。" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  return jsonResponse({ ok: false, message: "此 API 只接受 POST 請求。" }, 405);
};
