const byId = id => document.getElementById(id);
const search = byId("query");
const savedButton = byId("saved");
const roleButtons = byId("roles");
const taskButtons = byId("tasks");
const results = byId("results");
const storageKey = "atlas.tools.bookmarks";
const taskColors = {
  reading: ["阅","violet"], pdf: ["文","pink"], data: ["表","mint"],
  media: ["录","peach"], design: ["绘","blue"], manage: ["办","violet"],
  file: ["传","blue"], dev: ["码","mint"],
};
let bookmarks = new Set();
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(stored)) bookmarks = new Set(stored);
} catch {}
let currentRole = "all";
let currentTask = "all";
let bookmarksOnly = false;

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

function createCard([name, task, , description, url]) {
  const card = byId("card-template").content.cloneNode(true);
  const [glyph, color] = taskColors[task];
  const icon = card.querySelector(".tool-icon");
  icon.textContent = glyph;
  icon.classList.add(color);
  card.querySelector("h3").textContent = name;
  card.querySelector(".description").textContent = description;
  card.querySelector(".category").textContent = tasks[task];
  const link = card.querySelector("a");
  link.href = url;
  link.setAttribute("aria-label", `打开 ${name} 官网或官方项目页（新标签页）`);
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

function render() {
  const words = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const audience = tools.filter(([name, , audiences]) =>
    bookmarksOnly ? bookmarks.has(name) : currentRole === "all" || audiences.includes(currentRole)
  );
  const matching = audience.filter(([name, task, , description, , keywords]) => {
    const searchable = [name, tasks[task], description, keywords].join(" ").toLocaleLowerCase();
    return (currentTask === "all" || currentTask === task) && words.every(word => searchable.includes(word));
  });
  for (const button of roleButtons.children) {
    button.setAttribute("aria-pressed", !bookmarksOnly && currentRole === button.dataset.filter);
  }
  for (const button of taskButtons.children) {
    const key = button.dataset.filter;
    button.hidden = key !== "all" && !audience.some(tool => tool[1] === key);
    button.setAttribute("aria-pressed", currentTask === key);
  }
  updateSavedButton();
  byId("result-title").textContent = bookmarksOnly ? "我的收藏" : currentRole === "all" ? "精选工具" : roles[currentRole][0];
  byId("role-note").textContent = bookmarksOnly ? "收藏保存在当前浏览器。" : roles[currentRole][1];
  byId("result-count").textContent = `${matching.length} 个工具`;
  results.replaceChildren(...matching.map(createCard));
  if (matching.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = bookmarksOnly && !bookmarks.size
      ? "收藏还是空的。点击工具卡片上的星标，即可在这里找到它。"
      : "没有找到工具。试试更短的关键词，或切换到全部任务。";
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
savedButton.addEventListener("click", () => {
  bookmarksOnly = !bookmarksOnly;
  currentTask = "all";
  search.value = "";
  render();
  if (bookmarksOnly) byId("result-title").scrollIntoView({block: "nearest"});
});
search.addEventListener("input", render);
byId("search-form").addEventListener("submit", event => {
  event.preventDefault();
  render();
  byId("result-title").scrollIntoView({block: "start"});
});
render();
