-- Quiz-Cosmos D1 schema — 0002_fsrs.sql
--
-- 间隔复习系统（FSRS）。为「读过的都记住」服务。
--
-- 设计约定：
--   * 本迁移是纯增量的：不新增列、不修改既有表的语义，因此卡片 front matter
--     的 schemaVersion 保持 v1 不变（AGENTS.md §25.4 / §25.5——数据格式没变）。
--   * `card_schedule` 按 (card_id, user_key) 存 ts-fsrs 的 Card 状态。
--     用户体系仍是单一共享密码，所以 user_key 恒为 'default_user'
--     （AGENTS.md §19）；换设备/多人会共享同一份调度状态。
--   * `review_log` 是成长看板（全年热力图、连击、记忆留存预测）的唯一历史出处：
--     只存事件，不存聚合值，聚合由查询推导。
--   * state / rating 用 ts-fsrs 的枚举数值（State: 0 New / 1 Learning / 2 Review /
--     3 Relearning；Rating: 1 Again / 2 Hard / 3 Good / 4 Easy），与库保持一致，
--     便于直接用 fsrs.next() 反序列化。
--
-- 应用：
--   wrangler d1 execute quiz-cosmos-db --remote --file=./migrations/0002_fsrs.sql

PRAGMA foreign_keys = ON;

/* -------------------------------------------------------------------------- */
/* 卡片调度状态（FSRS）                                                        */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS card_schedule (
  card_id        TEXT    NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  user_key       TEXT    NOT NULL,
  due            TEXT    NOT NULL,                 -- ISO 到期时间
  stability      REAL    NOT NULL DEFAULT 0,       -- FSRS: 记忆稳定性
  difficulty     REAL    NOT NULL DEFAULT 0,       -- FSRS: 卡片难度 1-10
  elapsed_days   INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,       -- 本次安排的间隔天数
  learning_steps INTEGER NOT NULL DEFAULT 0,
  reps           INTEGER NOT NULL DEFAULT 0,       -- 总复习次数
  lapses         INTEGER NOT NULL DEFAULT 0,       -- 遗忘次数
  state          INTEGER NOT NULL DEFAULT 0,       -- ts-fsrs State
  last_review    TEXT,                             -- ISO，NULL = 从未复习
  updated_at     TEXT    NOT NULL,
  PRIMARY KEY (card_id, user_key)
);

CREATE INDEX IF NOT EXISTS idx_card_schedule_due ON card_schedule (user_key, due);

/* -------------------------------------------------------------------------- */
/* 复习流水                                                                     */
/* -------------------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS review_log (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id        TEXT    NOT NULL REFERENCES cards (id) ON DELETE CASCADE,
  user_key       TEXT    NOT NULL,
  rating         INTEGER NOT NULL,                 -- ts-fsrs Rating
  state          INTEGER NOT NULL,                 -- 复习前所处状态
  stability      REAL    NOT NULL DEFAULT 0,
  difficulty     REAL    NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  reviewed_at    TEXT    NOT NULL                  -- ISO
);

CREATE INDEX IF NOT EXISTS idx_review_log_user_time ON review_log (user_key, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_review_log_card     ON review_log (card_id, reviewed_at);
