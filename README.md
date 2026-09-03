# dsh-projects-mode

<p align="center"><strong>为 DeepSeek Harness（DSH）Web GUI 打造的 WorkBuddy 风格「项目模式」</strong></p>

侧边栏功能行（任务看板 / SSH / 技能中心）新增「📁 项目」入口，点击在中间栏全屏打开项目管理台。把任意会话归入项目，为项目编写**实时生效的指令与共享记忆**，一键在项目内新建会话。

---

## ✨ 功能

### 🗂 项目管理
- 创建 / 重命名 / 删除项目（删除两次确认；只删分组，不动会话）
- 把最近 200 条会话归入项目（自动过滤子代理会话）
- 点击会话行直接跳转；「⏩ 打开最近会话」回到项目最近的对话

### 🧠 双通道项目上下文（核心差异化）
- **指令（Instructions）**：写入后通过 DSH `system-prompt` 动态段注入本项目**所有会话**——每次模型组装时实时渲染，改完立即生效，无需重启会话
- **记忆（Memory）**：跨会话共享的项目记忆块，保存后在下一个模型步骤**原位替换刷新**（不是只注入一次的过期快照），清空即自动移除

### 📡 自动项目简报（v0.3 新增，省 token 核心）
- 项目内新建会话时，自动从本项目**最近会话的真实历史**蒸馏出一份简报（各会话标题 + 开篇需求 + 时间），注入新会话第一步
- 效果：接续老任务**不用拖长老会话**——老会话每轮要重发全部历史（聊 200 轮 ≈ 每轮 5 万 token），项目新会话只带约 1 千 token 的简报 + 记忆，**省 95% 以上**
- 简报按会话缓存 30 分钟，之后每步原位刷新（auto-compact 压缩后依然存活）；每个项目可一键开关

### 📊 Token 计量（v0.3 新增）
- 指令 / 记忆编辑框实时显示估算 token 占用，超过 1500 变黄、超过 4000 变红提醒精简
- 项目详情行显示「每步上下文 ≈ N tokens」，本项目注入成本一目了然

### 🆕 项目内新建会话 + 会话徽标
- 「✨ 新建会话」创建空白会话并**立即写入归属**
- 对话区右上角浮动**项目徽标**：随时显示当前会话归属，点击即可切换/移出——无需打开管理台

### 📂 工作目录自动归属（v0.4 新增）
- 给项目填一个工作目录路径，该目录（含子目录）下发起的会话**自动归入项目**，无需手动拖拽
- 多个项目路径重叠时**最长前缀优先**；手动归属永远优先于自动归属
- 把会话从项目移出即记住「退出选择」——不会被自动归属重新拉回去；手动归入则自动清除

### 🔎 会话过滤 + 失效归属清理（v0.4 新增）
- 项目详情页新增「🔎 过滤会话标题」输入框，会话多的项目快速定位
- 「🧹 清理失效归属」一键移除指向已删除会话的归属记录；每次插件启动也会自动执行一轮

### 🛡 API 加固（v0.4 新增）
- loopback 远程地址之外，新增 **Host 头校验**（防 DNS rebinding）与 **Origin 同源校验**（防恶意页面跨域驱动 API）
- 简报缓存加上限（300 条）并在归属变更时修剪，杜绝长期运行内存膨胀
- 项目列表按最近活跃排序；徽标改为事件驱动刷新（去掉了 4 秒轮询）

### ⏱ 真实活跃时间
- 会话时间取自会话日志文件的修改时间（mtime），精确反映最后活动时刻，排序不再失真

### 🧹 附赠
- 隐藏侧边栏底部的「Cordis Plugin · N running」状态行（可随插件卸载恢复）

## 📦 安装

```bash
git clone https://github.com/<you>/dsh-projects-mode.git ~/.dsh/plugins/dsh-projects-mode
dsh plugin --profile web add link:$HOME/.dsh/plugins/dsh-projects-mode
# 重启 dsh web（DSH Desktop 会自动拉起子进程），浏览器硬刷新（Cmd/Ctrl+Shift+R）
```

## 🗑 卸载

```bash
cd ~/.dsh/profiles/web && pnpm remove dsh-projects-mode
# 从 package.json 的 dsh.profile.bundles 移除 "dsh-projects-mode"，重启 dsh web
```

数据文件 `~/.dsh/.dsh-projects.json` 保留不动。

## 🆚 与社区同类插件的差异

| 能力 | dsh-projects-mode | lanyun077/dsh-project | WenhongPan/dsh-projects | dsh-project-context |
|---|---|---|---|---|
| 侧边栏功能行入口 + 全屏管理台 | ✅ | ✅ | ❌（官方 slot 分组） | ❌ |
| 指令注入且**实时生效** | ✅ system-prompt 段 | ✅ 同左 | ❌ 明确不做 | ❌ 硬编码模板 |
| 记忆**中途更新即时刷新** | ✅ 原位替换 | ❌ 仅首条消息快照 | ❌ | ⚠️ 有替换但内容不可编辑 |
| **自动项目简报**（从真实历史蒸馏，新会话免拖老会话） | ✅ | ❌ | ❌ | ❌ |
| **Token 计量**（编辑器实时估算 + 项目上下文成本） | ✅ | ❌ | ❌ | ❌ |
| 新建会话**立即写归属** | ✅ | ✅ | ⚠️ 隐式（Workspace 机制） | ❌ |
| **会话徽标**（任意时刻可见/切换，事件驱动零轮询） | ✅ | ❌ | ❌ | ⚠️ 仅 on/off 开关 |
| **工作目录自动归属**（cwd 前缀匹配 + 最长前缀优先） | ✅ v0.4 | ❌ | ❌ | ❌ |
| **失效归属清理**（启动自动 + 手动一键） | ✅ v0.4 | ❌ | ❌ | ❌ |
| 真实活跃时间（日志 mtime） | ✅ | ❌ | ⚠️ 用内部状态字段 | ❌ |
| 数据可移植（服务端 JSON 文件） | ✅ 单文件 | ✅ 目录树 | ❌ localStorage | ✅ |

## 🏗 架构

- **Host 半区**（Node）：`webServer` 注册同源 REST API（loopback 防护）；`systemPrompt.section` 实时指令段；`agent/pre-step` 记忆块替换；`sessionQuery.listSessions + readTitleSnapshots` 会话索引
- **Browser 半区**：与 task-board / ssh / skill-explorer 同族的 DOM 注入方案（plain DOM + MutationObserver 自愈），中间栏全屏接管视图，无构建步骤的单文件 bundle
- **存储**：单 JSON 文件 `~/.dsh/.dsh-projects.json`（原子写），v2 schema 含 instructions/memory 字段

## ⚠️ 兼容性说明

- 在 macOS arm64 + DSH Desktop（DSH 0.1.1-rc.2）上验证；理论兼容 Linux / Windows
- 不向 session log 写入任何自定义事件（避免上游事件白名单导致的拒读问题）
- 与 task-board / ssh / skill-explorer 的入口行通过 `data-dsh-*-entry` 家族选择器协同排序

## License

MIT
