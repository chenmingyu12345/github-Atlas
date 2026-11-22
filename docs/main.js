const byId = id => document.getElementById(id);
const search = byId("query");
const savedButton = byId("saved");
const roleButtons = byId("roles");
const taskButtons = byId("tasks");
const typeButtons = byId("types");
const sort = byId("sort");
const results = byId("results");
const more = byId("more");
const storageKey = "atlas.tools.bookmarks";
const pageSize = 12;
const kindLabels = { online: "在线工具", skill: "AI 技能", project: "开源项目" };
const actionLabels = { online: "打开工具", skill: "查看技能", project: "查看项目" };
const skillCollections = new Set([
  "anthropics/skills", "openai/skills", "vercel-labs/skills", "mattpocock/skills", "remotion-dev/skills",
]);
const browserProjects = new Set(["Excalidraw", "draw.io", "Squoosh"]);
const selfHostedProjects = new Set([
  "AppFlowy", "Appsmith", "Apache Superset", "BookStack", "DataEase",
  "Dolibarr", "ERPNext", "Memos", "Metabase", "Nextcloud", "Node-RED",
  "OpenProject", "Paperless-ngx", "Penpot", "Vikunja", "WooCommerce", "Zulip",
]);
const developmentTools = new Set([
  "Apache ECharts", "DuckDB", "FFmpeg", "H5P", "JupyterLab",
  "PaddleOCR", "Pandoc", "RapidOCR", "Tesseract OCR", "Whisper",
]);
const starFormatter = new Intl.NumberFormat("zh-CN");
const list = resources.map(resource => ({
  ...resource,
  stars: starSnapshot.counts[resource.repository] ?? null,
  searchable: [resource.name, resource.description, resource.keywords, resource.repository,
    tasks[resource.task], kindLabels[resource.kind]].join(" ").toLocaleLowerCase("zh-CN"),
}));

let bookmarks = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(stored)) {
    bookmarks = new Set(stored.map(name => name === "PPT 演示技能" ? "PPT Master" : name));
  }
} catch {}
let currentRole = "all";
let currentTask = "all";
let currentKind = "";
let bookmarksOnly = false;
let visibleCount = pageSize;

function makeFilter(container, key, label, icon) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.filter = key;
  if (icon) {
    const badge = document.createElement("span");
    badge.className = "role-icon";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = icon;
    button.append(badge);
  }
  button.append(document.createTextNode(label));
  container.append(button);
}

for (const [key, [label, , icon]] of Object.entries(roles)) {
  makeFilter(roleButtons, key, label, icon);
}
for (const [key, label] of Object.entries(tasks)) {
  makeFilter(taskButtons, key, label);
}

function updateBookmarkButton(button, name) {
  const active = bookmarks.has(name);
  button.textContent = active ? "★" : "☆";
  button.setAttribute("aria-pressed", active);
  button.setAttribute("aria-label", `收藏 ${name}`);
}

function buildInstallPrompt({name, url, kind, repository}) {
  if (kind === "online" || browserProjects.has(name)) return "";

  if (kind === "skill") {
    const [ref, ...directory] = url.split("/tree/")[1].split("/");
    const skill = directory.at(-1);
    const dependency = repository === "iOfficeAI/OfficeCLI"
      ? "按项目中文文档检查并安装 OfficeCLI 命令行，验证 officecli 可用后再验证技能。"
      : "";
    return [
      `请在你当前的桌面端智能体中安装「${name}」，技能 ID 为 ${skill}。`,
      `官方仓库 https://github.com/${repository}，分支 ${ref}，技能目录 ${directory.join("/")}。`,
      `先核对该目录的 SKILL.md（${url.replace("/tree/", "/blob/")}/SKILL.md）和随附文件。确认当前客户端支持 Agent Skills 后，按客户端官方方式仅安装这一个技能，保留技能所需的脚本和参考资料。`,
      dependency,
      "检查客户端能否识别该技能，告诉我安装位置和验证结果。如果需要重新加载客户端或补充依赖，说明具体步骤。使用账号、外部服务或权限时，遵循当前客户端的授权流程。",
    ].filter(Boolean).join("\n\n");
  }

  let setup = "先识别电脑的操作系统和架构，从官方入口选择对应的稳定版本并安装。优先使用官方发布包或官方推荐的安装方式，检测到已安装时先检查能否正常打开。";
  if (selfHostedProjects.has(name)) {
    setup = "先核对官方的部署文档和电脑现有运行环境。依赖齐全时按官方步骤安装并在本机运行，保留已有数据和配置。使用测试配置验证本机入口，公开访问或连接正式数据时等我明确授权。";
  }
  if (developmentTools.has(name)) {
    setup = "先核对官方安装文档、平台和依赖。按当前环境安装，涉及语言依赖时优先使用项目环境。用版本命令或最小本地示例验证。";
  }
  if (name === "OpenCalc") {
    setup = "先确认你能否操作我已授权的 Android 设备。可以操作时，根据官方发布说明安装对应版本并试用计算功能。仅能操作电脑时，告诉我需要在哪台设备上完成哪一步。";
  }
  return [
    `请帮我安装并验证「${name}」。官方入口 ${url}${repository ? `，官方仓库 https://github.com/${repository}` : ""}。`,
    setup,
    "完成后告诉我安装版本、打开方式和验证结果。如果当前权限或设备无法完成，说明卡在哪一步。",
  ].join("\n\n");
}

function addInstallPrompt(card, resource) {
  const prompt = buildInstallPrompt(resource);
  if (!prompt) return;
  const install = card.querySelector(".install");
  const button = install.querySelector(".copy-install");
  const status = install.querySelector(".copy-status");
  const field = install.querySelector("textarea");
  install.hidden = false;
  field.value = prompt;
  button.setAttribute("aria-label", `复制「${resource.name}」的安装提示词`);
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      status.textContent = "已复制";
    } catch {
      field.focus();
      field.select();
      status.textContent = "已选中，请手动复制";
    }
  });
}

function createCard(resource) {
  const {name, task, description, url, kind, repository, stars} = resource;
  const card = byId("card-template").content.cloneNode(true);
  const type = card.querySelector(".tool-type");
  type.querySelector("img").src = `assets/${kind}.webp`;
  type.querySelector("span").textContent = kindLabels[kind];
  card.querySelector("h3").textContent = name;
  card.querySelector(".description").textContent = description;
  addInstallPrompt(card, resource);
  card.querySelector(".category").textContent = tasks[task];
  const starLabel = card.querySelector(".stars");
  starLabel.hidden = stars === null;
  if (stars !== null) {
    starLabel.dataset.value = stars;
    const starSource = kind === "skill" ? (skillCollections.has(repository) ? "合集仓库 " : "项目仓库 ") : "";
    starLabel.textContent = `${starSource}★ ${starFormatter.format(stars)}`;
    starLabel.title = `${repository} · GitHub Star`;
  }
  const entry = card.querySelector(".entry-link");
  entry.href = url;
  entry.textContent = actionLabels[kind];
  entry.setAttribute("aria-label", `${actionLabels[kind]} ${name}（新标签页）`);
  const source = card.querySelector(".repository-link");
  const repoUrl = repository && `https://github.com/${repository}`;
  source.hidden = !repoUrl || url.toLowerCase() === repoUrl.toLowerCase();
  if (repoUrl) source.href = repoUrl;
  source.setAttribute("aria-label", `查看 ${name} 的 GitHub 仓库（新标签页）`);
  const button = card.querySelector(".bookmark");
  updateBookmarkButton(button, name);
  button.addEventListener("click", () => {
    if (bookmarks.has(name)) bookmarks.delete(name);
    else bookmarks.add(name);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...bookmarks]));
    } catch {}
    if (bookmarksOnly) {
      render();
      (results.querySelector(".bookmark") || savedButton).focus();
    } else {
      updateBookmarkButton(button, name);
      updateSavedButton();
    }
  });
  return card;
}

function updateSavedButton() {
  byId("saved-count").textContent = bookmarks.size;
  savedButton.setAttribute("aria-pressed", bookmarksOnly);
}

function render(reset = true) {
  if (reset) visibleCount = pageSize;
  const words = search.value.trim().toLocaleLowerCase("zh-CN").split(/\s+/).filter(Boolean);
  const audience = list.filter(resource =>
    (bookmarksOnly ? bookmarks.has(resource.name) : currentRole === "all" || resource.audiences.includes(currentRole))
    && (!currentKind || resource.kind === currentKind));
  const availableTasks = new Set(audience.map(resource => resource.task));
  if (!availableTasks.has(currentTask)) currentTask = "all";
  const matching = audience.filter(resource =>
    (currentTask === "all" || currentTask === resource.task) && words.every(word => resource.searchable.includes(word)));
  if (sort.value === "stars") {
    matching.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1));
  }
  for (const button of roleButtons.children) {
    button.setAttribute("aria-pressed", !bookmarksOnly && currentRole === button.dataset.filter);
  }
  for (const button of taskButtons.children) {
    const key = button.dataset.filter;
    button.hidden = key !== "all" && !availableTasks.has(key);
    button.setAttribute("aria-pressed", currentTask === key);
  }
  for (const button of typeButtons.children) {
    button.setAttribute("aria-pressed", currentKind === button.dataset.type);
  }
  updateSavedButton();
  const role = roles[currentRole];
  byId("result-title").textContent = bookmarksOnly ? "我的收藏"
    : [currentRole === "all" ? "" : role[0], kindLabels[currentKind]].filter(Boolean).join(" · ") || "全部资源";
  byId("role-note").textContent = bookmarksOnly ? "收藏保存在当前浏览器。"
    : currentKind === "skill" ? "复制卡片里的安装提示词，发给支持技能的桌面端智能体。" : role[1];
  byId("result-count").textContent = `${matching.length} 项`;
  sort.disabled = currentKind === "online";
  const starNote = byId("star-note");
  starNote.hidden = sort.disabled;
  starNote.textContent = `GitHub Star 快照 ${starSnapshot.date} · 技能显示所属仓库 Star`;
  results.replaceChildren(...matching.slice(0, visibleCount).map(createCard));
  more.hidden = matching.length <= visibleCount;
  if (matching.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = bookmarksOnly && !bookmarks.size
      ? "收藏还是空的。点击工具卡片上的星标，即可在这里找到它。"
      : "暂无匹配资源。试试更短的关键词，或切换身份和任务。";
    results.append(empty);
  }
}

roleButtons.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  currentRole = button.dataset.filter;
  currentTask = "all";
  bookmarksOnly = false;
  render();
});
taskButtons.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  currentTask = button.dataset.filter;
  render();
});
typeButtons.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  currentKind = currentKind === button.dataset.type ? "" : button.dataset.type;
  currentTask = "all";
  bookmarksOnly = false;
  render();
});
savedButton.addEventListener("click", () => {
  bookmarksOnly = !bookmarksOnly;
  currentKind = "";
  currentTask = "all";
  search.value = "";
  render();
  if (bookmarksOnly) byId("result-title").scrollIntoView({block: "nearest"});
});
search.addEventListener("input", () => render());
sort.addEventListener("change", () => render());
more.addEventListener("click", () => {
  const firstNew = visibleCount;
  visibleCount += pageSize;
  render(false);
  results.children[firstNew]?.querySelector(".entry-link").focus();
});
byId("search-form").addEventListener("submit", event => {
  event.preventDefault();
  render();
  byId("result-title").scrollIntoView({block: "start"});
});
render();
