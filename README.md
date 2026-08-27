# dsh-projects-mode

<p align="center"><strong>为 DeepSeek Harness（DSH）Web GUI 打造的「项目模式」</strong></p>

<p align="center">侧边栏功能行（任务看板 / SSH / 技能中心）新增「📁 项目」入口，点击在中间栏全屏打开项目管理台。把任意会话归入项目，为项目编写<strong>实时生效的指令与共享记忆</strong>，一键在项目内新建会话。</p>

---

## ✨ 功能

### 🗂 项目管理
- 创建 / 重命名 / 删除项目（删除两次确认；只删分组，不动会话）
- 把最近 200 条会话归入项目（自动过滤子代理会话）
- 点击会话行直接跳转；「⏩ 打开最近会话」回到项目最近的对话

### 🧠 双通道项目上下文（核心差异化）
- **指令（Instructions）**：写入后通过 DSH `system-prompt` 动态段注入本项目**所有会话**——每次模型组装时实时渲染，改完立即生效，无需重启会话
- **记忆（Memory）**：跨会话共享的项目记忆块，保存后在下一个模型步骤**原位替换刷新**（不是只注入一次的过期快照），清空即自动移除

### 🆕 项目内新建会话 + 会话徽标
- 「✨ 新建会话」创建空白会话并**立即写入归属**
- 对话区右上角浮动**项目徽标**：随时显示当前会话归属，点击即可切换/移出——无需打开管理台

### ⏱ 真实活跃时间
- 会话时间取自会话日志文件的修改时间（mtime），精确反映最后活动时刻，排序不再失真

### 🧹 附赠
- 隐藏侧边栏底部的「Cordis Plugin · N running」状态行（可随插件卸载恢复）

## 📦 安装

```bash
git clone https://github.com/BertramWang12399/dsh-projects-mode.git ~/.dsh/plugins/dsh-projects-mode
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

> 以下对比基于各项目 README 在本文撰写时点的公开描述，仅用于说明能力差异；如有出入，以原项目最新文档为准。对各项目无任何贬低之意。

| 能力 | dsh-projects-mode | lanyun077/dsh-project | WenhongPan/dsh-projects | dsh-project-context |
|---|---|---|---|---|
| 侧边栏功能行入口 + 全屏管理台 | ✅ | ✅ | ❌（官方 slot 分组） | ❌ |
| 指令注入且**实时生效** | ✅ system-prompt 段 | ✅ 同左 | ❌ 明确不做 | ❌ 硬编码模板 |
| 记忆**中途更新即时刷新** | ✅ 原位替换 | ❌ 仅首条消息快照 | ❌ | ⚠️ 有替换但内容不可编辑 |
| 新建会话**立即写归属** | ✅ | ✅ | ⚠️ 隐式（Workspace 机制） | ❌ |
| **会话徽标**（任意时刻可见/切换） | ✅ | ❌ | ❌ | ⚠️ 仅 on/off 开关 |
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

## ⚠️ Disclaimer（声明）

- 本插件为**独立开发的社区项目**，非 DeepSeek 官方出品，未经官方审核或背书，与 DeepSeek 官方及其关联方不存在任何隶属或合作关系
- 「DeepSeek」「DSH」及相关名称的权利归其权利人所有，本文中的提及仅用于说明兼容对象
- 本插件通过 DSH 公开加载机制与其私有运行时接口协作；DSH 后续版本变更接口可能导致插件失效，作者不对由此产生的任何损失负责
- 插件仅在本地读取自身数据文件与会话日志元信息，不上传、不收集、不向第三方发送任何数据

## License

MIT
