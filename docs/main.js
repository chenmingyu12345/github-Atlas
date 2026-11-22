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
  if (Array.isArray(stored)) bookmarks = new Set(stored);
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

function createCard({name, task, description, url, kind, repository, stars}) {
  const card = byId("card-template").content.cloneNode(true);
  const type = card.querySelector(".tool-type");
  type.querySelector("img").src = `assets/${kind}.webp`;
  type.querySelector("span").textContent = kindLabels[kind];
  card.querySelector("h3").textContent = name;
  card.querySelector(".description").textContent = description;
  card.querySelector(".category").textContent = tasks[task];
  const starLabel = card.querySelector(".stars");
  starLabel.hidden = stars === null;
  if (stars !== null) {
    starLabel.dataset.value = stars;
    starLabel.textContent = `${kind === "skill" ? "仓库 " : ""}★ ${starFormatter.format(stars)}`;
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
    : currentKind === "skill" ? "技能需在兼容的 AI 助手中使用，安装方式见作者文档。" : role[1];
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
