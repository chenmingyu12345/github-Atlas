# GitHub Atlas

按职业发现开源项目。选择行政与人事、财务与会计、教育与培训、内容创作、产品与项目、电商与运营、数据分析或软件开发，查看对应的精选工具。项目默认按 GitHub Star 从高到低排列。

## 在线效率工具图鉴

[打开效率工具图鉴](https://chenmingyu12345.github.io/github-Atlas/)。面向国内学生和上班族，可按身份、行业和任务查找在线工具、AI 技能及开源项目，也可以把常用资源收藏在当前浏览器。

需要安装的资源提供「复制安装提示词」。把提示词发给能操作电脑的桌面端智能体，智能体可根据官方来源和当前环境执行安装并验证。技能入口应指向 GitHub 上含有 `SKILL.md` 的具体目录。

部分技能附有作者演示、社区实测或中文教程。每个技能的推荐与不推荐票来自图鉴仓库对应 GitHub Issue 的 👍 和 👎。访客可以在图鉴看票数，投票时需要登录 GitHub 并在投票页选择反馈。新增技能后可用已登录的 GitHub CLI 运行 `python scripts/sync_skill_ballots.py` 创建或复用投票页。

站点由 `docs/` 发布，条目维护在 `docs/tools.js`。默认按 GitHub Star 降序，技能使用所属仓库的 Star，在线工具没有仓库时保留编排顺序。使用 Node.js、Python 3 和已登录的 GitHub CLI 运行 `python scripts/update_web_stars.py` 可刷新网站的 Star 快照。

### 选题来源

导航网站用于发现候选。图鉴以工具官网、官方仓库或技能目录的原作者条目作为使用入口，并按学习和办公场景撰写中文说明。名单去重后入库，同一技能仓库的不同技能可以分别收录。

| 方向 | 参考目录 |
| --- | --- |
| 国内 AI 和办公 | [AI 工具集](https://ai-bot.cn/) · [AI 旗页](https://www.aiqipage.com/) · [时代华商 AI 导航](https://www.zdmba.com.cn/) · [深圳大学图书馆生成式 AI 专题](https://www.lib.szu.edu.cn/learning/ai) |
| 学术和设计 | [思谋学术](https://ac.scmor.com/) · [优设导航](https://hao.uisdc.com/) · [Product Hunt 效率类](https://www.producthunt.com/categories/productivity) |
| 在线小工具 | [在线工具 tool.lu](https://tool.lu/) · [爱资料工具](https://www.toolnb.com/) · [LD 工具箱](https://www.lddgo.net/) · [速查在线工具箱](https://www.suchatool.cn/) · [iLovePDF 工具目录](https://www.ilovepdf.com/zh-cn) · [十七连资源网](https://www.17hl.net/) |
| 开源项目 | [AlternativeTo](https://alternativeto.net/software/notion/) · [Open Source Alternatives](https://opensourcealternative.to/) · [Awesome Selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted) · [Orbit](https://github.com/DaiYiqq/orbit-github-nav) · [F-Droid](https://f-droid.org/) |
| AI 技能 | [Skills.sh](https://skills.sh/) |

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
