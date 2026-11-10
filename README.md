# 静页 · QuietPage

> 一个放在办公桌上的桌面阅读工作台：微信读书官方只读数据视图 + 本地书籍阅读 + 低调阅读层。

## 项目定位

| 做 | 不做（红线） |
|---|---|
| 官方 Gateway 只读书架 / 进度 / 笔记 | 不回写进度、不加书架、不发想法 |
| 本地无 DRM 的 EPUB / TXT 阅读与断点续读 | 不解密 / 去除 DRM，不处理受保护商业电子书 |
| 窗口分层透明、置顶、极简、全局热键一键收起 | 不伪装成 IDE / 业务系统，不伪造工作内容，不规避终端监控（需求文档 L3） |
| 正版书正文一键跳转官方网页版 | 不内嵌 / 不代理 / 不逆向网页版登录态，不抓取正文 |

设计资产：`ui-prototype-v0.1.html`（交互原型）、`桌面阅读工作台-需求梳理-v0.1.md`、`UI设计规格-v0.1.md`、`.impeccable.md`（设计上下文）。基于真实 IDE 截图的 `效果预览-深色透明-v0.2.html` 内含公司内部代码画面，已加入 `.gitignore`，**仅本地保留，不随公开仓库分发**。

## 技术选型

| 方案 | 栈 | 窗口能力 | 包体 | 上手成本 | 结论 |
|---|---|---|---|---|---|
| **Electron** | Node + 原生 HTML/CSS/JS | 完整（transparent / alwaysOnTop / globalShortcut / Tray） | ~90MB | 低 | **采用** |
| Tauri 2 | Rust + WebView2 | 完整 | ~10MB | 中高（Rust 工具链） | 备选，追求包体时再换 |
| 纯 Web / PWA | 浏览器 | 无窗口级能力 | 0 | 最低 | 否决：做不了透明与全局热键 |
| JavaFX / WPF | JVM / .NET | 完整 | 中 | 中 | 不推荐：两版 HTML 原型要重写 |

选 Electron 的三个理由：① 已有原型可直接作为 renderer，零重写；② 不引入 React/Vue/构建链，保持最小实现；③ 窗口与热键 API 成熟，后续自己改得动。renderer 是纯 HTML/CSS/JS，将来换 Tauri 可复用大部分。

## 目录结构

```
src/
  main/
    index.js        主进程入口、单实例锁、托盘、IPC 白名单
    window.js       frameless 透明窗口、置顶、收起恢复、位置持久化
    shortcuts.js    全局热键注册（多候选 + 降级）
    store.js        userData 下的 JSON 存储（原子写，存进度与配置）
    weread.js       官方 Gateway 只读适配，未配置即降级纯本地
  preload/
    index.js        contextBridge 白名单 API
  renderer/
    index.html      阅读界面结构
    tokens.css      纸墨 / 夜读双主题设计 token
    styles.css      布局与组件
    app.js          主题、分层透明、极简、收起、书架与进度
```

## 快速开始（dev）

```bash
npm install          # 首次约 100MB，需可访问 npm registry
npm run check        # 纯语法自检，不依赖 electron 安装
npm start            # 启动应用
npm run dev          # 启动并打开 DevTools
npm run dist         # 打 Windows 安装包（prod）
```

首次启动是空书架：点「导入本地书籍」选 TXT / EPUB；EPUB 解析在后续迭代接入（当前先落 TXT 文本读取与占位）。

### 微信读书接入（只读）

官方 Agent Gateway 的接口地址、参数与 `skill_version` 以官方文档为准，本项目**不硬编码任何推测值**。通过环境变量配置，任一缺失即自动降级为纯本地模式（需求 R-16）：

```bash
# .env.example 见仓库，或直接在启动前设置（不要写进仓库）
WEREAD_SHELF_URL=   # 官方书架接口完整地址
WEREAD_API_KEY=     # 个人 API Key，wrk-...
```

**API Key 不落盘、不进仓库、不写日志**；MVP 阶段只从环境变量读取，正式版应改用系统凭据库（Windows Credential Manager）并提供一键清除与重置引导。

### 快捷键

- 收起 / 恢复：默认依次尝试 `Alt+Backslash`、`Ctrl+Alt+H`，第一个注册成功的生效；都失败时用托盘菜单。原型设计的 `Alt+\` 需在 Electron accelerator 键名上实测后写进 `config.hotkey`。
- `Esc`：关闭浮层面板。

## dev / prod 差异

| 项 | dev | prod |
|---|---|---|
| DevTools | `--dev` 可开 | 关闭 |
| 渲染进程权限 | `contextIsolation:true` / `nodeIntegration:false` / `sandbox:true` | 同左，额外加 CSP |
| 外部链接 | 主进程白名单校验，只允许 `weread.qq.com` | 同左 |
| API Key | 环境变量 | 系统凭据库，不明文落盘 |
| 打包 | 不打包 | `electron-builder` nsis，签名按需 |

## 风险提示与常见坑

1. **分层透明度**：`transparent:true` 只让窗口背景可透；背景 alpha 由 renderer 的 surface 层控制，文字层始终全不透明。不要对 `BrowserWindow` 或整窗设 `opacity` —— 会把正文对比度一起压低，违反 WCAG AA 4.5:1。
2. **透明窗口失效**：部分远程桌面 / 虚拟机 / 显卡驱动下 Windows 分层窗口会退化成黑底或不透明。出现时降级为「最小化 + 热键恢复」，并在设置里给出提示。
3. **热键冲突**：`Ctrl+Alt+H` 可能被 IDE 占用；注册失败已有回退，但正式版应提供设置页自定义与冲突提示。
4. **单实例**：已加 `requestSingleInstanceLock`，避免多开导致热键重复注册。
5. **账号安全**：官方对第三方客户端 / 插件有账号封禁警告，本项目只用官方只读接口 + 系统浏览器打开官方网页版，不碰登录态。
6. **公司邮箱**：本机 git 身份是 `王旭 <ex_wangxu10@cnooc.com.cn>`，推公开仓库前建议改成 GitHub noreply 邮箱，见下方推送章节。
7. **DRM**：导入流程只接受无保护的自有文件；解析失败要明确提示，不要静默尝试解密。

## 推送到 GitHub

本机已确认：`git 2.55`、`Node 22.22.2`、GitHub 可达（HTTP 200）、Git Credential Manager 可用；`gh` 未安装、无 SSH 公钥，因此走 **HTTPS + 凭据管理器**最省事。

```bash
# 1) 建议先设置仓库级提交身份（避免公司邮箱出现在公开仓库）
git config user.name  "你的 GitHub 用户名"
git config user.email "你的ID@users.noreply.github.com"

# 2) 提交
git add .
git commit -m "feat: 静页 QuietPage 初始骨架"

# 3) 关联并推送（仓库 URL 由用户提供）
git remote add origin https://github.com/wangxv0407/quiet-page.git
git branch -M main
git push -u origin main
```

推送时凭据管理器会弹 GitHub 登录；若不便交互，可改用 PAT 作为密码，或生成 SSH key 后换 SSH 地址。

## 路线图

- **v0.1（当前）**：可运行骨架 —— 窗口能力、双主题、分层透明、极简、收起、本地进度、只读适配层与降级。
- **v0.2**：EPUB 解析、导入流程与 DRM 拒绝提示、设置页与热键自定义、API Key 系统凭据存储。
- **v0.3**：笔记划线只读导出、阅读统计看板、错误 / 加载 / 边界全状态走查。

---

本方案为产品设计参考，具体实施请结合公司合规与法务要求确认；在办公设备上使用请先确认所在单位终端管理与劳动纪律要求。
