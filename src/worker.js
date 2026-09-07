const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

const normalize = (value) => String(value ?? "").trim();

const base64url = (bytes) => {
  const binary = typeof bytes === "string" ? bytes : String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const fromBase64url = (value) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

async function signingKey(secret, usage) {
  const material = new TextEncoder().encode(`${usage}:${secret}`);
  const digest = await crypto.subtle.digest("SHA-256", material);
  return crypto.subtle.importKey("raw", digest, usage === "oauth-state" ? { name: "HMAC", hash: "SHA-256" } : "AES-GCM", false, usage === "oauth-state" ? ["sign", "verify"] : ["encrypt", "decrypt"]);
}

async function createOauthState(secret) {
  const payload = `${Date.now()}.${crypto.randomUUID()}`;
  const key = await signingKey(secret, "oauth-state");
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${base64url(new TextEncoder().encode(payload))}.${base64url(new Uint8Array(signature))}`;
}

async function verifyOauthState(value, secret) {
  const [encodedPayload, encodedSignature] = String(value || "").split(".");
  if (!encodedPayload || !encodedSignature) return false;
  const payloadBytes = fromBase64url(encodedPayload);
  const payload = new TextDecoder().decode(payloadBytes);
  const createdAt = Number(payload.split(".")[0]);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > 10 * 60 * 1000) return false;
  const key = await signingKey(secret, "oauth-state");
  return crypto.subtle.verify("HMAC", key, fromBase64url(encodedSignature), payloadBytes);
}

async function encryptToken(token, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await signingKey(secret, "oauth-token");
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return { encryptedToken: base64url(new Uint8Array(encrypted)), iv: base64url(iv) };
}

async function decryptToken(encryptedToken, iv, secret) {
  const key = await signingKey(secret, "oauth-token");
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64url(iv) }, key, fromBase64url(encryptedToken));
  return new TextDecoder().decode(decrypted);
}

function oauthRedirectUri(request) {
  return `${new URL(request.url).origin}/api/oauth/google/callback`;
}

async function startGoogleOauth(request, env) {
  const state = await createOauthState(env.GOOGLE_OAUTH_STATE_SECRET);
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: oauthRedirectUri(request),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

async function finishGoogleOauth(request, env) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !(await verifyOauthState(state, env.GOOGLE_OAUTH_STATE_SECRET))) {
    return new Response("OAuth request was invalid or expired.", { status: 400 });
  }
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: oauthRedirectUri(request),
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenResponse.json();
  if (!tokenResponse.ok || !tokens.refresh_token) {
    const reason = tokens.error || (tokens.access_token ? "missing_refresh_token" : "token_exchange_failed");
    return new Response(`Google authorization failed: ${reason}. Please try again.`, { status: 502, headers: { "cache-control": "no-store" } });
  }
  const encrypted = await encryptToken(tokens.refresh_token, env.GOOGLE_OAUTH_STATE_SECRET);
  await env.DB.prepare(
    "INSERT INTO oauth_tokens (provider, encrypted_token, iv, updated_at) VALUES ('google', ?1, ?2, datetime('now')) ON CONFLICT(provider) DO UPDATE SET encrypted_token = excluded.encrypted_token, iv = excluded.iv, updated_at = datetime('now')"
  ).bind(encrypted.encryptedToken, encrypted.iv).run();
  return new Response("<!doctype html><meta charset=\"utf-8\"><title>Gmail connected</title><style>body{margin:0;background:#0b0c0f;color:#f4f1e8;font:18px system-ui;display:grid;place-items:center;min-height:100vh}main{max-width:560px;padding:40px}h1{color:#ffc400}</style><main><h1>Gmail connected.</h1><p>Kuncepto can now send website notifications and automatic acknowledgments. You may close this tab.</p></main>", { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

async function gmailAccessToken(env) {
  const stored = await env.DB.prepare("SELECT encrypted_token, iv FROM oauth_tokens WHERE provider = 'google'").first();
  if (!stored) throw new Error("Gmail is not connected.");
  const refreshToken = await decryptToken(stored.encrypted_token, stored.iv, env.GOOGLE_OAUTH_STATE_SECRET);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error("Gmail token refresh failed.");
  return result.access_token;
}

function gmailMessage({ to, subject, body, important = false }) {
  const headers = [
    "From: Joma Echavez <jomaechavez@gmail.com>",
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (important) headers.push("Importance: high", "X-Priority: 1");
  return base64url(new TextEncoder().encode(`${headers.join("\r\n")}\r\n\r\n${body}`));
}

async function sendGmail(accessToken, message, important = false) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ raw: message, ...(important ? { labelIds: ["IMPORTANT"] } : {}) }),
  });
  if (!response.ok) throw new Error("Gmail send failed.");
}

async function sendContactEmails(env, { name, email, message }) {
  const accessToken = await gmailAccessToken(env);
  const receivedAt = new Date().toISOString();
  const notificationBody = `New portfolio website submission\n\nFrom: ${name}\nEmail: ${email}\nReceived: ${receivedAt}\n\nMessage:\n${message}`;
  const acknowledgementBody = `Hi,\n\nThank you for reaching out through my Kuncepto portfolio. I received your message or CV request and will respond as soon as possible.\n\nBest regards,\nJoma Echavez\nWeb, Design & Automation\nhttps://joma.kuncepto-portfolio.workers.dev/`;
  await sendGmail(accessToken, gmailMessage({ to: "jomaechavez@gmail.com", subject: "FROM_WEBSITE", body: notificationBody, important: true }), true);
  await sendGmail(accessToken, gmailMessage({ to: email, subject: "Request received — Joma Echavez", body: acknowledgementBody }));
}

async function hashSource(request, salt) {
  const address = request.headers.get("cf-connecting-ip") || "unknown";
  const bytes = new TextEncoder().encode(`${salt}:${address}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createContact(request, env) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return json({ ok: false, message: "This request was not accepted." }, 403);
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ ok: false, message: "Please submit the website form." }, 415);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ ok: false, message: "The message could not be read." }, 400);
  }

  const name = normalize(input.name);
  const email = normalize(input.email).toLowerCase();
  const message = normalize(input.message);
  const website = normalize(input.website);
  const startedAt = Number(input.startedAt);
  const elapsed = Date.now() - startedAt;

  if (website || !Number.isFinite(startedAt) || elapsed < 700) {
    return json({ ok: true, message: "Thanks—your message was received." }, 201);
  }
  if (name.length < 2 || name.length > 100) {
    return json({ ok: false, field: "sender_name", message: "Please enter your name." }, 422);
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, field: "sender_email", message: "Please enter a valid email address." }, 422);
  }
  if (message.length < 10 || message.length > 2000) {
    return json({ ok: false, field: "message", message: "Please write between 10 and 2,000 characters." }, 422);
  }

  const sourceHash = await hashSource(request, env.CONTACT_HASH_SALT);
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM contact_messages WHERE source_hash = ?1 AND created_at >= datetime('now', '-1 hour')"
  ).bind(sourceHash).first();
  if ((recent?.total || 0) >= 5) {
    return json({ ok: false, message: "Too many messages were sent. Please try again later." }, 429, { "retry-after": "3600" });
  }

  const messageId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO contact_messages (id, name, email, message, source_hash, status) VALUES (?1, ?2, ?3, ?4, ?5, 'new')"
  ).bind(messageId, name, email, message, sourceHash).run();

  try {
    await sendContactEmails(env, { name, email, message });
    await env.DB.prepare("UPDATE contact_messages SET status = 'replied' WHERE id = ?1").bind(messageId).run();
  } catch {
    await env.DB.prepare("UPDATE contact_messages SET status = 'new' WHERE id = ?1").bind(messageId).run();
  }

  return json({ ok: true, message: "Thanks—your message was sent to Joma." }, 201);
}

async function siteVisits(request, env) {
  if (request.method === "POST") {
    await env.DB.prepare(
      "INSERT INTO site_metrics (metric, value, updated_at) VALUES ('portfolio_visits', 1, datetime('now')) ON CONFLICT(metric) DO UPDATE SET value = value + 1, updated_at = datetime('now')"
    ).run();
  } else if (request.method !== "GET") {
    return json({ ok: false, message: "Method not allowed." }, 405, { allow: "GET, POST" });
  }
  const metric = await env.DB.prepare("SELECT value FROM site_metrics WHERE metric = 'portfolio_visits'").first();
  return json({ ok: true, count: Number(metric?.value || 0) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/oauth/google/start" && request.method === "GET") {
      return startGoogleOauth(request, env);
    }
    if (url.pathname === "/api/oauth/google/callback" && request.method === "GET") {
      return finishGoogleOauth(request, env);
    }
    if (url.pathname === "/api/contact") {
      if (request.method !== "POST") {
        return json({ ok: false, message: "Method not allowed." }, 405, { allow: "POST" });
      }
      return createContact(request, env);
    }
    if (url.pathname === "/api/visits") {
      return siteVisits(request, env);
    }
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
    headers.set("content-security-policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-ancestors 'none'; upgrade-insecure-requests");
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
    return new Response(asset.body, { status: asset.status, statusText: asset.statusText, headers });
  },
};
