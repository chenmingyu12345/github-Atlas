const publicColumns = `id, bookmark_key AS bookmarkKey, name, kind, task, audiences,
  description, url, keywords, repository, stars, ballot_id AS ballotId`;
const roleKeys = new Set(["student","office","education","finance","creative","operations","data","project"]);
const taskKeys = new Set(["reading","pdf","data","media","design","manage","file","dev"]);
const kindKeys = new Set(["online","skill","project"]);
const resourceId = /^(?:seed-\d+|[a-f0-9-]{36})$/;
const repositoryName = /^[\w.-]+\/[\w.-]+$/;

function normalizedEntry(payload) {
  const {name, kind, task, audiences, description, url, keywords = "", repository = "", visible} = payload ?? {};
  const text = (value, max) => typeof value === "string" && value.trim().length <= max;
  if (!text(name, 80) || !name.trim() || !text(description, 600) || !description.trim()
    || !text(keywords, 350) || !text(url, 500) || !kindKeys.has(kind) || !taskKeys.has(task)
    || typeof visible !== "boolean" || !Array.isArray(audiences) || !audiences.length
    || audiences.length > roleKeys.size || !audiences.every(role => roleKeys.has(role))
    || typeof repository !== "string" || (repository !== "" && (!repositoryName.test(repository)
    || repository.split("/").some(part => part === "." || part === "..")))) return null;
  let target;
  try { target = new URL(url.trim()); } catch { return null; }
  if (target.protocol !== "https:" || target.username || target.password) return null;
  if (kind === "skill") {
    const parts = target.pathname.split("/").filter(Boolean);
    if (target.host !== "github.com" || target.search || target.hash
      || parts.length < 5 || parts[2] !== "tree"
      || !repository || parts.slice(0, 2).join("/").toLowerCase() !== repository.toLowerCase()) return null;
  }
  return {
    name: name.trim(), kind, task, audiences: JSON.stringify([...new Set(audiences)]), description: description.trim(),
    url: target.href, keywords: keywords.trim(), repository: repository || null, visible: Number(visible),
  };
}

async function checkToken(request, secret) {
  const supplied = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!secret || !supplied) return false;
  const encoder = new TextEncoder();
  const [presented, expected] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(supplied)),
    crypto.subtle.digest("SHA-256", encoder.encode(secret)),
  ]);
  return crypto.subtle.timingSafeEqual(presented, expected);
}

async function githubStars(repository) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repository}`, {
      headers: {"User-Agent": "GitHub-Atlas-Catalog", Accept: "application/vnd.github+json"},
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return null;
    const count = (await response.json()).stargazers_count;
    return Number.isSafeInteger(count) && count >= 0 ? count : null;
  } catch {
    return null;
  }
}

export async function publicCatalog(request, env, respond) {
  if (request.method !== "GET") return respond({error: "Method not allowed"}, 405);
  const {results} = await env.DB.prepare(`SELECT ${publicColumns} FROM resources WHERE visible = 1 ORDER BY position, name`).all();
  return respond(results.map(row => ({...row, audiences: JSON.parse(row.audiences)})));
}

export async function adminCatalog(request, env, respond, path) {
  if (!await checkToken(request, env.ATLAS_ADMIN_TOKEN)) return respond({error: "管理密钥无效"}, 401);
  if (request.method === "GET" && path === "/admin/resources") {
    const {results} = await env.DB.prepare(`
      SELECT ${publicColumns}, visible, updated_at AS updatedAt
      FROM resources ORDER BY position, name
    `).all();
    return respond(results.map(row => ({...row, audiences: JSON.parse(row.audiences)})));
  }
  if (request.method !== "PUT" || !path.startsWith("/admin/resources/")) {
    return respond({error: "操作不存在"}, 404);
  }
  const id = path.split("/").at(-1);
  if (!resourceId.test(id)) return respond({error: "资源编号无效"}, 400);
  const raw = await request.text();
  if (raw.length > 4500) return respond({error: "内容过长"}, 400);
  let entry;
  try { entry = normalizedEntry(JSON.parse(raw)); } catch { entry = null; }
  if (!entry) return respond({error: "请检查名称、分类、字段长度和链接。技能需要填写对应的 GitHub 仓库和技能目录。"}, 400);
  try {
    const {name, kind, task, audiences, description, url, keywords, repository, visible} = entry;
    const existing = await env.DB.prepare("SELECT repository FROM resources WHERE id = ?").bind(id).first();
    const stars = repository && repository !== existing?.repository ? await githubStars(repository) : null;
    await env.DB.prepare(`
      INSERT INTO resources (id, bookmark_key, name, kind, task, audiences, description, url, keywords, repository, stars, visible)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        name = excluded.name, kind = excluded.kind, task = excluded.task, audiences = excluded.audiences,
        description = excluded.description, url = excluded.url, keywords = excluded.keywords,
        stars = CASE WHEN resources.repository IS excluded.repository THEN resources.stars ELSE excluded.stars END,
        repository = excluded.repository, visible = excluded.visible,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    `).bind(id, id, name, kind, task, audiences, description, url, keywords, repository, stars, visible).run();
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint")) return respond({error: "工具名称或链接已被其他条目使用"}, 409);
    throw error;
  }
  const updated = await env.DB.prepare(`SELECT ${publicColumns}, visible, updated_at AS updatedAt FROM resources WHERE id = ?`).bind(id).first();
  return respond({...updated, audiences: JSON.parse(updated.audiences)});
}
