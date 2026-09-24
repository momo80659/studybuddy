type Env = {
  DB: D1Database;
  ACCOUNT_KV?: KVNamespace;
};

type RegisterBody = {
  accessCode?: string;
  accountName?: string;
  email?: string;
  password?: string;
};

const REQUIRED_ACCESS_CODE = "01347";
const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

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

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function hashPassword(password: string): Promise<{ passwordHash: string; passwordSalt: string; passwordAlgo: string }> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
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
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return {
    passwordHash: toBase64(new Uint8Array(derivedBits)),
    passwordSalt: toBase64(salt),
    passwordAlgo: "PBKDF2-SHA256-100000",
  };
}

async function readJson(request: Request): Promise<RegisterBody | null> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;
  try {
    return await request.json<RegisterBody>();
  } catch {
    return null;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function validate(body: RegisterBody): { ok: true; data: Required<RegisterBody> } | { ok: false; status: number; message: string } {
  const accessCode = String(body.accessCode || "").trim();
  const accountName = String(body.accountName || "").trim();
  const email = normalizeEmail(String(body.email || ""));
  const password = String(body.password || "");

  if (!timingSafeEqualText(accessCode, REQUIRED_ACCESS_CODE)) {
    return { ok: false, status: 403, message: "介紹碼不正確。請輸入有效介紹碼後才可註冊。" };
  }
  if (!accountName) {
    return { ok: false, status: 400, message: "請輸入帳戶名稱。" };
  }
  if (accountName.length > 40) {
    return { ok: false, status: 400, message: "帳戶名稱不可超過 40 個字元。" };
  }
  if (!email) {
    return { ok: false, status: 400, message: "請輸入電郵號碼。" };
  }
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, status: 400, message: "請輸入有效的電郵號碼。" };
  }
  if (!password) {
    return { ok: false, status: 400, message: "請輸入登入密碼。" };
  }
  if (password.length < 8) {
    return { ok: false, status: 400, message: "登入密碼最少需要 8 個字元。" };
  }

  return { ok: true, data: { accessCode, accountName, email, password } };
}

export const onRequestOptions: PagesFunction<Env> = async () => jsonResponse({ ok: true });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB) {
    return jsonResponse({ ok: false, message: "系統暫時未完成帳戶資料庫設定，請稍後再試。" }, 500);
  }

  const body = await readJson(request);
  if (!body) {
    return jsonResponse({ ok: false, message: "請使用 JSON 格式提交註冊資料。" }, 400);
  }

  const validated = validate(body);
  if (!validated.ok) {
    return jsonResponse({ ok: false, message: validated.message }, validated.status);
  }

  const { accountName, email, password } = validated.data;
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const { passwordHash, passwordSalt, passwordAlgo } = await hashPassword(password);

  try {
    await env.DB.prepare(
      `INSERT INTO users (id, account_name, email, password_hash, password_salt, password_algo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(userId, accountName, email, passwordHash, passwordSalt, passwordAlgo, now, now)
      .run();

    if (env.ACCOUNT_KV) {
      await env.ACCOUNT_KV.put(`user_email:${email}`, userId, { metadata: { createdAt: now } });
    }

    return jsonResponse({
      ok: true,
      message: "註冊完成。",
      user: {
        id: userId,
        accountName,
        email,
        createdAt: now,
      },
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("UNIQUE") || message.includes("constraint")) {
      return jsonResponse({ ok: false, message: "此電郵號碼已經註冊。" }, 409);
    }
    return jsonResponse({ ok: false, message: "註冊暫時未能完成，請稍後再試。" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  return jsonResponse({ ok: false, message: "此 API 只接受 POST 請求。" }, 405);
};
