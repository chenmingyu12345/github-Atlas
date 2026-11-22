const atlasAccount = (() => {
  const byId = id => document.getElementById(id);
  const endpoint = typeof atlasVoteEndpoint === "string" ? atlasVoteEndpoint : "";
  if (!endpoint || location.protocol === "file:") return {token: () => "", expire() {}};
  const storageKey = "atlas.account.session";
  const origin = new URL(endpoint).origin;
  const dialog = byId("account-dialog");
  const form = byId("account-form");
  const open = byId("account-open");
  const status = byId("account-status");
  let session = "";
  let user;
  let register = false;
  try { session = localStorage.getItem(storageKey) || ""; } catch {}

  function render() {
    open.textContent = user?.displayName || "登录";
    open.title = user?.displayName || "登录";
    byId("account-title").textContent = user ? "我的账号" : register ? "注册账号" : "登录";
    byId("account-profile").hidden = !user;
    byId("account-user").textContent = user ? `${user.displayName} · ${user.username}` : "";
    byId("account-nickname").hidden = !register;
    form.hidden = Boolean(user);
    form.elements.password.autocomplete = register ? "new-password" : "current-password";
    form.querySelector("[type=submit]").textContent = register ? "创建账号" : "登录";
    byId("account-mode").textContent = register ? "返回登录" : "注册账号";
  }

  function setAccount(token, data) {
    session = token;
    user = data;
    try {
      if (session) localStorage.setItem(storageKey, session);
      else localStorage.removeItem(storageKey);
    } catch {}
    render();
    document.dispatchEvent(new Event("atlas-account-changed"));
  }

  async function request(path, payload, method = "POST") {
    const headers = session ? {Authorization: `Bearer ${session}`} : {};
    if (payload) headers["Content-Type"] = "application/json";
    const response = await fetch(origin + path, {
      method, headers, body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(body.error || "账号服务暂不可用");
      error.status = response.status;
      throw error;
    }
    return body;
  }

  open.hidden = false;
  open.addEventListener("click", () => {
    status.textContent = "";
    dialog.showModal();
  });
  byId("account-close").addEventListener("click", () => dialog.close());
  byId("account-mode").addEventListener("click", () => {
    register = !register;
    form.elements.password.value = "";
    status.textContent = "";
    render();
  });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector("[type=submit]");
    button.disabled = true;
    byId("account-mode").disabled = true;
    status.textContent = register ? "正在注册…" : "正在登录…";
    try {
      const data = await request(register ? "/account/register" : "/account/login", Object.fromEntries(new FormData(form)));
      setAccount(data.token, data.user);
      form.reset();
      dialog.close();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      button.disabled = false;
      byId("account-mode").disabled = false;
    }
  });
  byId("account-logout").addEventListener("click", async event => {
    event.target.disabled = true;
    try {
      await request("/account/logout");
      setAccount("", undefined);
      dialog.close();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.disabled = false;
    }
  });

  render();
  if (session) {
    const initial = session;
    request("/account/me", undefined, "GET").then(data => {
      if (session === initial) setAccount(initial, data.user);
    }).catch(error => {
      if (session === initial && error.status === 401) setAccount("", undefined);
    });
  }
  return {token: () => session, expire: () => setAccount("", undefined)};
})();
