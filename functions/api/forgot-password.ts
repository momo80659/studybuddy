type Env = {
  DB: D1Database;
  ACCOUNT_KV?: KVNamespace;
  RESEND_API_KEY?: string;
  SENDER_EMAIL?: string;
  SITE_URL?: string;
};

type ForgotBody = {
  email?: string;
};

const TOKEN_TTL_SECONDS = 3600; // 1 小時
const RATE_LIMIT = 3; // 同一 IP 1 分鐘最多 3 次
const GENERIC_OK_MESSAGE = "如電郵已註冊，密碼重設連結已寄出，請查收電郵（有效期 1 小時）。";

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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendResetEmail(env: Env, toEmail: string, resetLink: string): Promise<void> {
  if (!env.RESEND_API_KEY) return; // 未設定電郵服務時靜默跳過（仍回傳通用成功訊息）
  const sender = env.SENDER_EMAIL || "溫習寶 <onboarding@resend.dev>";
  const subject = "【溫習寶】密碼重設請求";
  const text = [
    "你（或其他人）剛剛請求重設溫習寶帳戶密碼。",
    "",
    "請點擊以下連結重設密碼（有效期 1 小時，一次性使用）：",
    resetLink,
    "",
    "如非本人操作，請忽略此電郵，你的密碼不會被更改。",
    "",
    "溫習寶 · 筆試溫習平台",
  ].join("\n");
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: sender, to: [toEmail], subject, text }),
  }).catch(() => undefined);
}

export const onRequestOptions: PagesFunction<Env> = async () => jsonResponse({ ok: true });

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.DB || !env.ACCOUNT_KV) {
    return jsonResponse({ ok: false, message: "系統暫時未完成相關設定，請稍後再試。" }, 500);
  }

  let body: ForgotBody | null = null;
  try {
    body = await request.json<ForgotBody>();
  } catch {
    body = null;
  }
  const email = String(body?.email || "").trim().toLowerCase();

  if (!isValidEmail(email)) {
    return jsonResponse({ ok: false, message: "請輸入有效的電郵地址。" }, 400);
  }

  // 簡單速率限制：同一 IP 1 分鐘最多 3 次
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const rateKey = `ratelimit:forgot:${ip}`;
  const current = parseInt((await env.ACCOUNT_KV.get(rateKey)) || "0", 10);
  if (current >= RATE_LIMIT) {
    return jsonResponse({ ok: false, message: "請求過於頻繁，請 1 分鐘後再試。" }, 429);
  }
  await env.ACCOUNT_KV.put(rateKey, String(current + 1), { expirationTtl: 60 });

  try {
    const record = await env.DB.prepare(
      `SELECT id, email FROM users WHERE email = ? LIMIT 1`,
    )
      .bind(email)
      .first<{ id: string; email: string }>();

    if (record) {
      const token = randomToken();
      const siteUrl = env.SITE_URL || "https://studybuddy-emu.pages.dev";
      const resetLink = `${siteUrl}/?token=${token}#reset`;
      await env.ACCOUNT_KV.put(`reset:${token}`, JSON.stringify({ email, createdAt: Date.now() }), {
        expirationTtl: TOKEN_TTL_SECONDS,
      });
      await sendResetEmail(env, email, resetLink);
    }
    // 無論電郵是否存在都回傳相同訊息，防止帳號枚舉
    return jsonResponse({ ok: true, message: GENERIC_OK_MESSAGE });
  } catch {
    return jsonResponse({ ok: false, message: "系統暫時未能處理請求，請稍後再試。" }, 500);
  }
};

export const onRequest: PagesFunction<Env> = async ({ request }) => {
  if (request.method === "OPTIONS") return jsonResponse({ ok: true });
  return jsonResponse({ ok: false, message: "此 API 只接受 POST 請求。" }, 405);
};
