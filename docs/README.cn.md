# mcp-kaiten

[English](../README.md) | [Русский](README.ru.md)

[为什么选择 mcp-kaiten](WHYIEXIST.cn.md)

适用于 **Kaiten** 的 MCP 服务器 — 卡片、工时记录、看板、评论、用户。

将 Cursor、Claude Desktop 或任意 MCP 客户端连接到您的 Kaiten 工作区。

一条命令即可开始：`npx -y mcp-kaiten`。

---

## 快速开始

### 1. 获取 API 令牌

1. 打开您的 Kaiten 实例（例如 `https://your-domain.kaiten.ru`）
2. 进入 个人资料 → API Key
3. 创建新令牌并复制

### 2. 添加到 Cursor / MCP 客户端

```json
{
  "mcpServers": {
    "mcp-kaiten": {
      "command": "npx",
      "args": ["-y", "mcp-kaiten"],
      "env": {
        "KAITEN_API_TOKEN": "your-api-token",
        "KAITEN_URL": "https://your-domain.kaiten.ru"
      }
    }
  }
}
```

MCP 客户端连接时，服务器会自动启动。

---

## 能做什么？

### 卡片

| 工具 | 说明 |
|------|------|
| `kaiten_get_card` | 按 ID 获取卡片（可选包含子卡片） |
| `kaiten_search_cards` | 按筛选条件、日期、分页搜索卡片 |
| `kaiten_get_space_cards` | 获取空间内的卡片 |
| `kaiten_get_board_cards` | 获取看板上的卡片 |
| `kaiten_create_card` | 创建新卡片 |
| `kaiten_update_card` | 更新卡片字段，在看板/列之间移动 |
| `kaiten_delete_card` | 删除卡片 |

### 评论

| 工具 | 说明 |
|------|------|
| `kaiten_get_card_comments` | 列出卡片评论 |
| `kaiten_create_comment` | 添加评论 |
| `kaiten_update_comment` | 更新评论 |
| `kaiten_delete_comment` | 删除评论 |

### 工时记录

| 工具 | 说明 |
|------|------|
| `kaiten_get_user_timelogs` | 按日期范围获取用户的工时记录 |
| `kaiten_get_card_timelogs` | 获取卡片的工时记录 |
| `kaiten_create_timelog` | 创建工时记录（需要 `roleId`） |
| `kaiten_update_timelog` | 更新工时记录 |
| `kaiten_delete_timelog` | 删除工时记录（需要 `cardId`） |

### 空间与看板

| 工具 | 说明 |
|------|------|
| `kaiten_list_spaces` | 列出所有空间 |
| `kaiten_get_space` | 按 ID 获取空间 |
| `kaiten_list_boards` | 列出空间内的看板 |
| `kaiten_get_board` | 按 ID 获取看板 |
| `kaiten_list_columns` | 列出看板的列（状态） |
| `kaiten_list_lanes` | 列出看板的泳道 |
| `kaiten_list_card_types` | 列出看板的卡片类型 |

### 用户

| 工具 | 说明 |
|------|------|
| `kaiten_get_current_user` | 获取当前已认证用户 |
| `kaiten_list_users` | 列出所有用户 |
| `kaiten_get_user_roles` | 获取当前用户的角色 |

### 资源

| URI | 描述 |
|-----|------|
| `kaiten://spaces` | 所有空间及其 ID 和名称 |
| `kaiten://boards` | 所有看板（id、title、spaceId） |

### 提示词

| 名称 | 描述 |
|------|------|
| `create-card` | 分步创建卡片工作流 |
| `time-report` | 生成指定日期范围的工时报告 |
| `board-overview` | 看板概览：列、卡片、逾期项 |

---

## 身份验证

Kaiten 使用 API 令牌进行身份验证。Kaiten API 不支持 OAuth。

1. 进入 Kaiten 个人资料 → API Key
2. 创建并复制令牌
3. 在 MCP 配置中设置 `KAITEN_API_TOKEN`

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `KAITEN_API_TOKEN` | 是 | API 令牌（Bearer） |
| `KAITEN_URL` | 是 | Kaiten 实例 URL（例如 `https://your-domain.kaiten.ru`） |
| `KAITEN_DEFAULT_SPACE_ID` | 否 | 搜索卡片时的默认空间 ID（未指定 `spaceId` 时） |

---

## 详细程度（verbosity）

每个工具都支持可选参数 `verbosity`（默认：`min`）：

| 级别 | 说明 | 卡片字段 |
|------|------|----------|
| `min` | 精简，节省上下文 | 9 个字段：id、title、url、board、column、owner、updated、asap、blocked |
| `normal` | 常用字段 | 约 22 个字段：另含日期、状态、标签、成员、泳道、类型、大小、due_date |
| `max` | 完整分析 | 约 30 个字段：另含描述、检查清单、阻塞项、external_links |
| `raw` | 完整 API 响应 | Kaiten API 返回的全部字段 |

## 可靠性

- **请求超时：** 可配置 HTTP 超时（默认 10 秒），避免网络问题导致长时间挂起。
- **自动重试：** 失败请求（429、408、5xx、网络错误、超时）最多重试 3 次，采用指数退避与抖动；遵守 `Retry-After` 响应头。
- **TTL 缓存：** 空间、看板、列、泳道、卡片类型和用户缓存在内存中（默认 5 分钟），减少对参考数据的重复 API 调用。
- **环境校验：** 启动时校验全部配置；无效值会给出明确错误，避免静默失败。
- **响应截断：** 超过 10 万字符的响应会自动截断，防止上下文溢出。
- **崩溃防护：** 未捕获异常与未处理的 Promise 拒绝会记录到标准错误流，而不会终止服务器。

## 已知限制

- **速率限制：** Kaiten API 可能限流。重试可缓解短暂的 429，若持续过载需降低请求频率。

## 故障排除

- **服务器无法启动：** 请确认 MCP 配置的 `env` 中已设置 `KAITEN_API_TOKEN` 和 `KAITEN_URL`。
- **401 错误：** 令牌可能过期或无效，请在 Kaiten 个人资料中重新生成。
- **响应过大：** 使用筛选（`boardId`、`spaceId`）或降低 `limit` 以减小响应体积。

---

[更新日志](../CHANGELOG.md)

[许可](../LICENSE)
