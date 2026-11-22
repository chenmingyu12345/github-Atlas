const byId = id => document.getElementById(id);
const base = new URL(atlasVoteEndpoint).origin;
const kinds = {online: "在线工具", skill: "AI 技能", project: "开源项目"};
const login = byId("login");
const editor = byId("editor");
const form = byId("resource-form");
const tableBody = byId("rows");
const field = name => form.elements.namedItem(name);
let token = "";
let entries = [];
let totals = new Map();
let editingId = "";

for (const [key, label] of Object.entries(tasks)) {
  if (key !== "all") field("task").add(new Option(label, key));
}
for (const [key, [label]] of Object.entries(roles)) {
  if (key === "all") continue;
  const wrapper = document.createElement("label");
  wrapper.className = "checkbox";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.name = "audiences";
  check.value = key;
  wrapper.append(check, label);
  byId("audience-options").append(wrapper);
}

async function request(path, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: {Authorization: `Bearer ${token}`, ...options.headers},
    signal: AbortSignal.timeout(10000),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "服务暂不可用");
  return payload;
}

function renderTable() {
  const query = byId("filter-text").value.trim().toLowerCase();
  const kind = byId("filter-kind").value;
  const state = byId("filter-state").value;
  const matches = entries.filter(row => (!kind || row.kind === kind)
    && (!state || String(row.visible) === state)
    && [row.name,row.repository,row.keywords].join(" ").toLowerCase().includes(query));
  byId("metrics").textContent = `${entries.length} 项资源 · ${entries.filter(row => row.visible).length} 已上架 · ${matches.length} 项匹配`;
  tableBody.replaceChildren(...matches.map(row => {
    const tr = document.createElement("tr");
    const votes = row.kind === "skill" && totals.get(row.ballotId);
    for (const value of [row.name, kinds[row.kind], tasks[row.task], row.visible ? "已上架" : "已下架", votes?.recommend ?? "—", votes?.notRecommend ?? "—"]) {
      tr.insertCell().textContent = value;
    }
    const badge = document.createElement("span");
    badge.className = row.visible ? "state" : "state off";
    badge.textContent = tr.cells[3].textContent;
    tr.cells[3].replaceChildren(badge);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary";
    button.textContent = "编辑";
    button.setAttribute("aria-label", `编辑 ${row.name}`);
    button.addEventListener("click", () => edit(row));
    tr.insertCell().append(button);
    return tr;
  }));
  byId("list-status").textContent = matches.length ? "" : "没有找到匹配资源。";
}

async function loadTotals() {
  try {
    const response = await fetch(base + "/votes", {signal: AbortSignal.timeout(5000)});
    if (!response.ok) return;
    totals = new Map((await response.json()).map(row => [row.id, row]));
    if (token) renderTable();
  } catch {}
}

login.addEventListener("submit", async event => {
  event.preventDefault();
  const button = login.querySelector("button");
  button.disabled = true;
  token = byId("admin-key").value.trim();
  byId("login-status").textContent = "正在登录…";
  try {
    entries = await request("/admin/resources");
    login.reset();
    byId("login-view").hidden = true;
    byId("dashboard").hidden = false;
    renderTable();
    loadTotals();
  } catch (error) {
    token = "";
    byId("login-status").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

byId("logout").addEventListener("click", () => {
  token = "";
  entries = [];
  totals = new Map();
  tableBody.replaceChildren();
  byId("dashboard").hidden = true;
  byId("login-view").hidden = false;
  byId("login-status").textContent = "";
  byId("admin-key").focus();
});

function updateSkillField() {
  const isSkill = field("kind").value === "skill";
  field("repository").required = isSkill;
  byId("skill-help").hidden = !isSkill;
}

function edit(row) {
  form.reset();
  editingId = row?.id ?? crypto.randomUUID();
  byId("editor-title").textContent = row ? "编辑资源" : "新增资源";
  if (row) {
    for (const key of ["name", "kind", "task", "url", "repository", "description", "keywords"]) {
      field(key).value = row[key] ?? "";
    }
    field("visible").checked = Boolean(row.visible);
    for (const checkbox of field("audiences")) checkbox.checked = row.audiences.includes(checkbox.value);
  }
  byId("save-status").textContent = "";
  updateSkillField();
  editor.showModal();
}

field("kind").addEventListener("change", updateSkillField);
byId("add").addEventListener("click", () => edit());
byId("cancel").addEventListener("click", () => editor.close());
for (const id of ["filter-text","filter-kind","filter-state"]) byId(id).addEventListener("input", renderTable);

form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = new FormData(form);
  const entry = Object.fromEntries(data.entries());
  entry.audiences = data.getAll("audiences");
  entry.visible = field("visible").checked;
  const status = byId("save-status");
  if (!entry.audiences.length) {
    status.textContent = "请至少选择一个适用人群。";
    return;
  }
  const save = form.querySelector("[type=submit]");
  save.disabled = true;
  status.textContent = "正在保存…";
  try {
    const row = await request(`/admin/resources/${editingId}`, {
      method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify(entry),
    });
    const index = entries.findIndex(item => item.id === row.id);
    if (index < 0) entries.push(row);
    else entries[index] = row;
    editor.close();
    renderTable();
    byId("list-status").textContent = `已保存「${row.name}」。`;
    loadTotals();
  } catch (error) {
    status.textContent = error.message;
  } finally {
    save.disabled = false;
  }
});
