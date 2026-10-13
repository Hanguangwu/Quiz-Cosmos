-- Quiz-Cosmos D1 schema — 0001_init.sql
--
-- 应用：wrangler d1 execute quiz-cosmos-db --remote --file=./migrations/0001_init.sql
--
-- 设计约定：
--   * D1 是唯一正式数据源；id 是业务 ID（TEXT，保留原 Markdown 卡的 id/slug）。
--   * 删除是软删除（deleted_at IS NOT NULL），公开接口一律过滤。
--   * 标签多对多（tags + card_tags），中文标签 slug = 名称本身。
--   * 复习进度按 (card_id, user_key) 聚合，user_key 是 KV 会话的用户键。
--   * 本文件于 2026-10-13 依据 functions/api/[[proxy]].js 的 SQL 重建
--     （此前副本在仓库迁移清理中被删除）；与 D1 动态类型兼容。

PRAGMA foreign_keys = ON;

/* -------------------------------------------------------------------------- */
/* 卡片                                                                        */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS cards (
  id          TEXT PRIMARY KEY,                -- 业务 ID（唯一，如 react-hooks-001）
  type        TEXT NOT NULL DEFAULT 'qa',
  title       TEXT NOT NULL,
  question    TEXT NOT NULL DEFAULT '',        -- Markdown
  answer      TEXT NOT NULL DEFAULT '',        -- Markdown
  category    TEXT NOT NULL,
  subcategory TEXT,
  difficulty  TEXT,                            -- easy | medium | hard
  status      TEXT NOT NULL DEFAULT 'published', -- draft | review | published | archived
  theme       TEXT,
  aliases     TEXT NOT NULL DEFAULT '[]',      -- JSON 数组字符串
  related     TEXT NOT NULL DEFAULT '[]',      -- JSON 数组字符串（card id）
  search_text TEXT NOT NULL DEFAULT '',        -- 去 Markdown 后的纯文本，供 LIKE 搜索
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT                             -- 软删除时间戳（NULL = 未删除）
);

CREATE INDEX IF NOT EXISTS idx_cards_category ON cards (category);
CREATE INDEX IF NOT EXISTS idx_cards_status   ON cards (status);

/* -------------------------------------------------------------------------- */
/* 标签                                                                        */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,             -- 显示名；中文标签 slug 与 name 相同
  slug       TEXT,
  created_at TEXT
);

/* -------------------------------------------------------------------------- */
/* 卡片-标签 多对多                                                            */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS card_tags (
  card_id TEXT    NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags (id)  ON DELETE CASCADE,
  PRIMARY KEY (card_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_card_tags_tag_id ON card_tags (tag_id);

/* -------------------------------------------------------------------------- */
/* 复习进度                                                                    */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS card_reviews (
  card_id          TEXT    NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  user_key         TEXT    NOT NULL,            -- KV 会话用户键
  known_count      INTEGER NOT NULL DEFAULT 0,
  unknown_count    INTEGER NOT NULL DEFAULT 0,
  last_verdict     TEXT,                        -- known | unknown
  last_reviewed_at TEXT,
  PRIMARY KEY (card_id, user_key)
);

CREATE INDEX IF NOT EXISTS idx_card_reviews_user_key ON card_reviews (user_key);