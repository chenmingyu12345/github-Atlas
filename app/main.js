'use strict';
(() => {
  const catalog = window.ATLAS_CATALOG;
  const el = id => document.getElementById(id);
  if (!catalog) {
    el('empty').textContent = '项目索引未加载。请完整解压发布包后重新打开。';
    el('empty').hidden = false;
    el('pagination').hidden = true;
    return;
  }
  const roleNames = Object.keys(catalog.roleCounts);
  const roleIcons = ['办','财','教','创','产','营','数','码'];
  const number = new Intl.NumberFormat('zh-CN');
  const PAGE_SIZE = 12;
  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem('github-atlas:'+key)) ?? fallback; }
    catch { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem('github-atlas:'+key, JSON.stringify(value)); }
    catch { /* Browsers can block storage for local files. The current session still works. */ }
  }
  const saved = read('saved', []);
  const favorites = new Set(Array.isArray(saved) ? saved : []);
  const remembered = read('role', roleNames[0]);
  const state = {view:'roles',role:roleNames.includes(remembered)?remembered:roleNames[0],text:'',category:'',sort:'stars',page:1};
  const repositoryName = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
  const repos = catalog.repos.filter(item=>repositoryName.test(item.name) && Number.isSafeInteger(item.stars) && item.stars>=0).map(item=>({
    ...item, key:item.name.toLowerCase(),
    search:[item.name,item.description,item.note,item.language,item.license,...item.categories,...item.roles].join(' ').toLowerCase(),
  }));
  const date = value => typeof value==='string' && /^\d{4}-\d\d-\d\d/.test(value) ? value.slice(0,10) : '未知';
  const roleButtons = new Map();
  const viewButtons = [...document.querySelectorAll('#sections button[data-view]')];
  const dom = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined) node.textContent = content;
    return node;
  };

  for (const [i,role] of roleNames.entries()) {
    const button = dom('button','role');
    button.type='button';
    const icon=dom('span','role-icon',roleIcons[i]??'•');
    icon.setAttribute('aria-hidden','true');
    button.append(icon,dom('span','',role),dom('span','role-count',number.format(catalog.roleCounts[role])));
    button.addEventListener('click',() => {
      state.role=role;state.view='roles';write('role',role);resetFilters();
    });
    el('role-list').append(button);
    roleButtons.set(role,button);
  }

  function resetFilters() {
    state.text='';state.category='';state.page=1;state.sort='stars';
    el('search').value='';el('sort').value='stars';
    render();
  }
  for (const button of viewButtons) {
    button.addEventListener('click',()=>{ state.view=button.dataset.view;resetFilters(); });
  }

  const searches = el('search');
  searches.addEventListener('input',()=>{ state.text=searches.value.trim().toLowerCase();state.page=1;render(); });
  el('category').addEventListener('change',event=>{ state.category=event.target.value;state.page=1;render(); });
  el('sort').addEventListener('change',event=>{ state.sort=event.target.value;state.page=1;render(); });
  for (const [id,change] of [['prev',-1],['next',1]]) {
    el(id).addEventListener('click',()=>{ state.page+=change;render();el('list-title').scrollIntoView({block:'nearest'}); });
  }

  function projectCard(item) {
    const card=dom('article','card');
    card.dataset.stars=String(item.stars);
    const head=dom('div','card-head');
    const [owner,name]=item.name.split('/');
    const symbol=dom('span','card-icon',name[0].toUpperCase());
    symbol.setAttribute('aria-hidden','true');
    const title=dom('div','card-title');
    const link=dom('a','repo-link',name);
    link.href='https://github.com/'+item.name;
    link.target='_blank';
    link.rel='noopener noreferrer';
    link.title='在 GitHub 打开 '+item.name;
    title.append(link,dom('p','',item.name));
    const favorite=dom('button','favorite');
    favorite.type='button';
    const refreshFavorite=()=>{
      const on=favorites.has(item.key);
      favorite.setAttribute('aria-pressed',String(on));
      favorite.setAttribute('aria-label',(on?'取消收藏 ':'收藏 ')+item.name);
      favorite.textContent=on?'★':'☆';
    };
    refreshFavorite();
    favorite.addEventListener('click',()=>{
      if(favorites.has(item.key)) favorites.delete(item.key);
      else favorites.add(item.key);
      write('saved',[...favorites]);
      refreshFavorite();
      el('saved-count').textContent=number.format(favorites.size);
      if(state.view==='saved') render();
    });
    head.append(symbol,title,favorite);
    const description=dom('p','description',item.note || item.description || '打开 GitHub 查看项目介绍、安装方式与发行版。');
    const tags=dom('div','tags');
    for (const tag of [...new Set([item.language,item.license,...item.categories, state.view==='roles'?'职业精选':''].filter(Boolean))].slice(0,3)) {
      tags.append(dom('span','tag',tag));
    }
    const bottom=dom('div','card-bottom');
    const stars=dom('span','stars','★ '+number.format(item.stars));
    stars.title=number.format(item.stars)+' GitHub Stars';
    bottom.append(stars,dom('small','',item.source+' · '+date(item.source==='GitHub API'?catalog.generated:catalog.orbitUpdated)));
    card.append(head,description,tags,bottom);
    return card;
  }

  function render() {
    for(const button of viewButtons) button.setAttribute('aria-pressed',String(button.dataset.view===state.view));
    for(const [role,button] of roleButtons) button.setAttribute('aria-pressed',String(state.view==='roles' && role===state.role));
    el('saved-count').textContent=number.format(favorites.size);
    const base = state.view==='roles' ? repos.filter(item=>item.roles.includes(state.role)) :
      state.view==='saved' ? repos.filter(item=>favorites.has(item.key)) : repos;
    const category=el('category');
    const options=[...new Set(base.flatMap(item=>item.categories))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
    const option=dom('option','','全部分类');option.value='';
    category.replaceChildren(option,...options.map(name=>{const o=dom('option','',name);o.value=name;return o;}));
    if(!options.includes(state.category))state.category='';
    category.value=state.category;
    category.disabled=options.length===0;
    const tokens=state.text.split(/\s+/).filter(Boolean);
    const found=base.filter(item=>(!state.category||item.categories.includes(state.category)) && tokens.every(token=>item.search.includes(token)));
    const byName=(a,b)=>a.name.localeCompare(b.name);
    found.sort(state.sort==='updated' ? (a,b)=>String(b.updated).localeCompare(String(a.updated))||byName(a,b) :
      state.sort==='name' ? byName : (a,b)=>b.stars-a.stars||byName(a,b));
    const max=Math.max(1,Math.ceil(found.length/PAGE_SIZE));
    state.page=Math.min(Math.max(state.page,1),max);
    const start=(state.page-1)*PAGE_SIZE;
    el('results').replaceChildren(...found.slice(start,start+PAGE_SIZE).map(projectCard));
    el('empty').hidden=found.length>0;
    el('empty').textContent=state.view==='saved'&&!base.length ? '还没有收藏。点任意项目右上角的星号，即可在这里查看。' : '没有匹配的项目，试试更短的关键词或清除筛选。';
    el('prev').disabled=state.page===1;
    el('next').disabled=state.page===max;
    el('pagination').hidden=max===1;
    el('page-count').textContent='第 '+state.page+' / '+max+' 页';
    el('result-count').textContent='匹配 '+number.format(found.length)+' 项';
    el('list-title').textContent=state.view==='roles'?state.role+' · 精选项目':state.view==='saved'?'我的项目收藏':'全部开源项目';
    el('hero-total').textContent=number.format(repos.length);
    el('hero-total-label').textContent='索引项目';
    el('aside-count').textContent=number.format(roleNames.length)+' 个职业 · '+number.format(repos.length)+' 个项目';
  }
  el('snapshot').textContent='Star 为快照值 · 职业精选 '+date(catalog.generated)+' / Orbit 索引 '+date(catalog.orbitUpdated);
  render();
})();
