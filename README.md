# GitHub Atlas

按职业发现开源项目。选择行政与人事、财务与会计、教育与培训、内容创作、产品与项目、电商与运营、数据分析或软件开发，查看对应的精选工具。项目默认按 GitHub Star 从高到低排列。

## 在线效率工具图鉴

[打开效率工具图鉴](https://chenmingyu12345.github.io/github-Atlas/)。面向国内学生和上班族，可按身份、行业和任务查找在线工具、AI 技能及开源项目，也可以把常用资源收藏在当前浏览器。

站点由 `docs/` 发布，条目维护在 `docs/tools.js`。默认按 GitHub Star 降序，技能使用所属仓库的 Star，在线工具没有仓库时保留编排顺序。使用 Node.js、Python 3 和已登录的 GitHub CLI 运行 `python scripts/update_web_stars.py` 可刷新网站的 Star 快照。

## 下载与打开

1. 在 [GitHub Releases](https://github.com/chenmingyu12345/github-Atlas/releases) 下载 `github-Atlas-v0.1.0-portable.zip`。
2. 完整解压。Windows 双击 **Start GitHub Atlas.cmd**，或直接打开 **app/index.html**。macOS 和 Linux 在浏览器打开 **app/index.html**。
3. 在左侧选职业。可搜索项目、筛选来源分类，或点击卡片右上角星号收藏。

便携包是离线浏览器应用。界面与索引无需网络；外部 GitHub 链接需要网络。职业选择和收藏存在当前浏览器。部分浏览器可能禁止本地文件持久存储，这时收藏只在当次会话有效。

| 功能 | 说明 |
| --- | --- |
| 职业导航 | 根据仓库维护的职业匹配表推荐相关项目 |
| 全部项目 | 可搜索、分主题筛选、按 Star / 更新日期 / 名称排序 |
| 我的收藏 | 本机收藏，和 GitHub 账号的 Star 分开 |
| 数据日期 | Star 数是收录时的快照，页面标注来源日期 |

## 数据与来源

职业精选由 `catalog/roles.json` 定义，常用中文场景说明见 `catalog/notes.json`。精选条目的仓库元数据由 GitHub GraphQL API 请求。全量发现目录基于 [Orbit 的公开索引](https://github.com/DaiYiqq/orbit-github-nav)，仅使用仓库名、主题、Star、许可证和更新时间等索引字段。会跳过已归档的仓库。索引规模和职业条目数以当前包为准。许可证字段来自来源数据，使用或分发第三方项目时请核对对应仓库。

## 开发与构建

应用使用 HTML、CSS 和原生 JavaScript。可以直接打开 `app/index.html`。刷新数据需要 Python 3 与已登录的 GitHub CLI，运行：

```shell
python scripts/build_catalog.py
python scripts/package_release.py
```

第一个命令更新本地索引，第二个命令在 `dist/` 生成 ZIP 和 SHA-256 文件。下载版里的快照随 Release 更新。

## 许可证

本项目使用 GPL-3.0。第三方仓库及其内容沿用各自的许可证。
