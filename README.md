# ocean-hub

液态玻璃风格的个人本机总控台：Vue3 + Vite 前端，服务端零依赖，优先用 bun 跑（找不到 bun 自动回落 node）。
把本机自带 Web 界面的服务（ComfyUI、SnowLuma、Alist 之类）登记成模块，在同一个页面里看状态、启停、内嵌操作。

打开即是控制台，无登录门禁：http://127.0.0.1:5200

## 启动

双击 `start.bat`。

- 端口已在监听时静默退出，不会起第二份。
- 全程不弹 cmd 黑窗，node 的 stdout/stderr 落到 `data/logs/hub.out.log` / `hub.err.log`。
- 换端口：`start.bat 5300`，或设环境变量 `PORT`。

停止：控制台里把模块停掉，或直接结束那个跑 `server\index.js` 的 bun（或 node）进程。

## 开机自启动

控制台左下角「⚡ 开机自启动」开关：开启就在 Windows「启动」文件夹里放一个指向 `start.bat`、窗口样式=隐藏的快捷方式（`ocean-hub.lnk`），关闭即删除该快捷方式。

## 能干什么

### 总览

所有模块的状态卡片：图标、名称、端口、PID、运行/启动中/离线灯。卡片最小高度锁定并垂直居中，状态切换不会让页面上下跳。点卡片跳到对应模块，窄屏自动纵向换行、长名字截省略号。

### 服务模块（核心）

一个模块 = 名称 + 本地路径 + 网页端口（+ 可选图标），记录在 `data/services.json`。

- **本地路径**填要拉起的东西：`.bat / .cmd / .exe / .ps1 / .lnk / .py / .js / .jar`，也可以直接填它所在的文件夹，会按 `start.bat / run.bat / main.py / index.js …` 顺序自己找入口。支持 `~` 开头的家目录写法。
- **网页端口**用来判断在不在跑、以及内嵌它的网页；端口被别的模块占用会拒绝创建。
- **启动后台静默**，不弹任何窗口；输出重定向到 `data/logs/svc-<key>.log`，模块页的「控制台」按钮显示的就是这块屏（按行试解 UTF-8 / GBK，ANSI 色码剥掉）。
- **停止**先杀端口占用进程（整棵进程树），再把命令行里带着这个路径的启动器、以及可执行文件装在该目录下的进程（venv python 之类）一并收掉。
- **状态识别**不只看端口：端口还没监听但启动记录是新的，显示「启动中」，避免冷启动几十秒里状态一闪就没。轮询接口只做纯 TCP 探测，不翻进程表，界面不会疯狂闪窗。
- **图标**：填图片路径（png/ico/jpg/webp/svg…）直接用；填 exe 或 lnk 会抽出系统图标存成 png 缓存在 `data/icons/`；留空走默认服务图标。
- 模块页顶部有状态灯、访问地址、刷新内嵌页、编辑、控制台按钮；侧栏每个服务项右边自带启停拨动开关和端口角标。

### 侧栏与模块管理

- 卡片式侧栏，可收起成 mini 态；左下角「模块排序」按钮进入排序模式，按住拖动换位。
- 「+」新增服务模块；删除模块即移除登记（卡片模块连同其本地数据一并清掉）。
- 可以只登记纯卡片模块（只有名称），页面走通用 `ModuleView`：九宫格功能卡，每模块独立的形状/背景（纯色或流光变色）/每行数量设置。

## 目录

```
├─ start.bat              启动入口（纯 bat，无 cmd 窗口、无 vbs）
├─ web/                   前端（Vue3 + Vite）
│  ├─ src/App.vue         外壳：模块清单、路由/停留位置持久化、启停调用
│  ├─ src/components/     侧栏 / 工具条 / 弹窗 / Toast / 服务表单
│  ├─ src/api/            模块(localStorage) / 服务 / 设置 / 图标 / Toast
│  ├─ src/views/overview/ 总览卡片页
│  ├─ src/views/shared/   服务页（内嵌 + 控制台）/ 通用卡片模块页
│  ├─ src/styles/theme.css 液态玻璃主题
│  ├─ public/             图标等静态资源（favicon.ico / favicon.png）
│  └─ dist/               构建产物（服务端直接托管，静态资源回落 public）
└─ server/                服务端（零依赖，bun / node 均可跑）
   ├─ index.js            入口：静态托管 + /api 分发
   ├─ core/registry.js    URL 前缀 → 模块路由映射表
   ├─ core/shared.js      进程 / 端口探测 / netstat 取 PID / 请求体读取
   ├─ core/services.js    服务模块层：路径解析、静默启停、日志、图标抽取
   └─ modules/system/     路由：模块清单、服务 CRUD 与启停、开机自启动
```

## 接入你自己的模块

1. `web/src/views/<模块名>/` 写 Vue 页面，在 `App.vue` 的 `compMap` 注册组件；
2. `server/modules/<模块名>/` 写路由，在 `index.js` 里挂上；
3. `server/core/registry.js` 的 `MAP` 加一行 URL 前缀映射；
4. `data/modules-seed.json` 加一条种子（侧栏显示 + 功能清单）。

只想挂个已有网页服务不用写代码：点侧栏「+」登记名称 + 本地路径 + 端口即可。

## 接口

全部为 `/api/...`，只在本机使用，无鉴权。

| 路径 | 方法 | 说明 |
|---|---|---|
| `/api/svc/list` | GET | 服务清单 + 实时状态（running / open / starting / pid / hasLog） |
| `/api/svc/create` `/update` `/delete` | POST | 服务模块增删改 |
| `/api/svc/start` `/stop` | POST | 后台静默拉起 / 结束进程树 |
| `/api/svc/status` | GET | 单个服务状态 |
| `/api/svc/logs` | GET | 模块控制台输出（日志尾） |
| `/api/svc/icon` | GET | 模块图标（图片或抽取出的 exe 图标） |
| `/api/modules/list` `/delete` | GET/POST | 卡片模块种子清单 |
| `/api/startup/list` `/toggle` | GET/POST | 开机自启动快捷方式 |

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | 控制台端口 | `5200` |

## 构建

改过前端才需要：

```bash
cd web && npm install && npm run build
```

`npm install` 只装 vue / @vitejs/plugin-vue / vite 三个包（`node_modules` 属于临时构建产物，不进发布包）。构建产物 `web/dist` 才是运行时要的东西，服务端零依赖：`bun server/index.js`（或 `node server/index.js`）即可，日常用 `start.bat`。

