const sessionDays = 30;
const accountToken = /^acct_[a-f0-9]{64}$/;
const usernamePattern = /^[a-z0-9_]{3,32}$/;
const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
const randomHex = size => hex(crypto.getRandomValues(new Uint8Array(size)));
const encoder = new TextEncoder();

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({
    name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256",
  }, key, 256);
}
const tokenHash = async token => hex(await crypto.subtle.digest("SHA-256", encoder.encode(token)));
const fromHex = value => Uint8Array.from(value.match(/../g), byte => parseInt(byte, 16));
const bearer = request => request.headers.get("Authorization")?.match(/^Bearer (\S+)$/)?.[1] || "";

export async function sessionUser(request, env) {
  const token = bearer(request);
  if (!accountToken.test(token)) return null;
  return env.DB.prepare(`
    SELECT u.id, u.username, u.display_name AS displayName
    FROM user_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.session_hash = ? AND s.expires_at > ? AND u.active = 1
  `).bind(await tokenHash(token), Date.now()).first();
}

export function hasAccountToken(request) {
  return bearer(request).startsWith("acct_");
}

async function newSession(env, user) {
  const token = "acct_" + randomHex(32);
  const now = Date.now();
  const [, inserted] = await env.DB.batch([
    env.DB.prepare("DELETE FROM user_sessions WHERE expires_at <= ?").bind(now),
    env.DB.prepare("INSERT INTO user_sessions (session_hash,user_id,expires_at) SELECT ?,id,? FROM users WHERE id=? AND active=1")
      .bind(await tokenHash(token), now + sessionDays * 86400000, user.id),
    env.DB.prepare("UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ? AND active=1").bind(user.id),
  ]);
  return inserted.meta.changes
    ? {user: {id: user.id, username: user.username, displayName: user.displayName}, token} : null;
}

export async function account(request, env, respond, path) {
  if (path === "/account/me" && request.method === "GET") {
    const user = await sessionUser(request, env);
    return user ? respond({user}) : respond({error: "请重新登录"}, 401);
  }
  if (request.method !== "POST") return respond({error: "操作不存在"}, 404);
  if (path === "/account/logout") {
    const token = bearer(request);
    if (accountToken.test(token)) {
      await env.DB.prepare("DELETE FROM user_sessions WHERE session_hash = ?").bind(await tokenHash(token)).run();
    }
    return respond({ok: true});
  }
  const register = path === "/account/register";
  if (!register && path !== "/account/login") return respond({error: "操作不存在"}, 404);
  const client = request.headers.get("CF-Connecting-IP") || "local";
  if (env.ACCOUNT_LIMIT && !(await env.ACCOUNT_LIMIT.limit({key: client})).success) {
    return respond({error: "操作过于频繁，请稍后再试"}, 429);
  }

  const raw = await request.text();
  if (raw.length > 1500) return respond({error: "内容过长"}, 400);
  let payload;
  try { payload = JSON.parse(raw); } catch { return respond({error: "表单格式无效"}, 400); }
  const username = typeof payload?.username === "string" ? payload.username.trim().toLowerCase() : "";
  const password = payload?.password;
  if (!usernamePattern.test(username) || typeof password !== "string" || password.length < 10 || password.length > 128) {
    return respond({error: "账号使用 3–32 位字母、数字或下划线，密码使用 10–128 个字符。"}, 400);
  }

  if (register) {
    const displayName = typeof payload.displayName === "string" ? payload.displayName.trim() || username : username;
    if (displayName.length > 32 || /[\u0000-\u001f\u007f]/.test(displayName)) return respond({error: "昵称格式无效"}, 400);
    const user = {id: crypto.randomUUID(), username, displayName};
    const salt = randomHex(16);
    const digest = hex(await passwordHash(password, salt));
    const result = await env.DB.prepare(`
      INSERT INTO users (id, username, display_name, password_salt, password_hash)
      VALUES (?,?,?,?,?) ON CONFLICT (username) DO NOTHING
    `).bind(user.id, username, displayName, salt, digest).run();
    if (!result.meta.changes) return respond({error: "这个账号已被使用"}, 409);
    const session = await newSession(env, user);
    return session ? respond(session, 201) : respond({error: "账号已停用"}, 401);
  }

  const user = await env.DB.prepare(`
    SELECT id, username, display_name AS displayName, password_salt AS salt, password_hash AS digest, active
    FROM users WHERE username = ?
  `).bind(username).first();
  const presented = await passwordHash(password, user?.salt ?? "00000000000000000000000000000000");
  const expected = fromHex(user?.digest ?? "0".repeat(64));
  if (!crypto.subtle.timingSafeEqual(presented, expected) || !user?.active) {
    return respond({error: "账号或密码错误，或账号已停用"}, 401);
  }
  const session = await newSession(env, user);
  return session ? respond(session) : respond({error: "账号已停用"}, 401);
}

const adminUserColumns = `id, username, display_name AS displayName, active, created_at AS createdAt, last_login_at AS lastLoginAt`;

export async function adminUsers(request, env, respond, path) {
  if (request.method === "GET" && path === "/admin/users") {
    const params = new URL(request.url).searchParams;
    const term = (params.get("q") || "").trim().toLowerCase().slice(0, 64);
    const state = ["0","1"].includes(params.get("state")) ? Number(params.get("state")) : null;
    const page = Number(params.get("page") || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 100000) return respond({error: "页码无效"}, 400);
    const where = "WHERE (instr(username,?) > 0 OR instr(lower(display_name),?) > 0 OR ? = '') AND (? IS NULL OR active=?)";
    const args = [term, term, term, state, state];
    const [{results}, count] = await Promise.all([
      env.DB.prepare(`SELECT ${adminUserColumns} FROM users ${where} ORDER BY created_at DESC, id LIMIT 25 OFFSET ?`).bind(...args, (page - 1) * 25).all(),
      env.DB.prepare(`SELECT count(*) AS total FROM users ${where}`).bind(...args).first(),
    ]);
    return respond({users: results, total: count.total, page});
  }

  const id = path.match(/^\/admin\/users\/([a-f0-9-]{36})$/)?.[1];
  if (!id || request.method !== "PUT") return respond({error: "操作不存在"}, 404);
  const raw = await request.text();
  let active;
  if (raw.length <= 128) {
    try { active = JSON.parse(raw)?.active; } catch {}
  }
  if (typeof active !== "boolean") return respond({error: "状态无效"}, 400);
  const operations = [
    env.DB.prepare("UPDATE users SET active=? WHERE id=?").bind(Number(active), id),
  ];
  if (!active) operations.push(env.DB.prepare("DELETE FROM user_sessions WHERE user_id=?").bind(id));
  operations.push(env.DB.prepare(`SELECT ${adminUserColumns} FROM users WHERE id=?`).bind(id));
  const result = (await env.DB.batch(operations)).at(-1).results[0];
  return result ? respond(result) : respond({error: "用户不存在"}, 404);
}
