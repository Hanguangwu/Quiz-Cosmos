/**
 * Knowledge card data model.
 *
 * A card is a Markdown file with YAML front matter. The front matter carries
 * metadata (search / filter / sort); the body carries the question and answer.
 *
 * Normalisation contract for the whole app: optional scalar fields are
 * `string | null` and optional list fields are `string[]` (never `undefined`).
 * The build-time parser is the only place that decides "missing" vs "present".
 */

export const SCHEMA_VERSION = 1 as const
export type SchemaVersion = typeof SCHEMA_VERSION

export const CARD_TYPES = ['qa'] as const
export type CardType = (typeof CARD_TYPES)[number]

export const CARD_STATUSES = ['draft', 'review', 'published', 'archived'] as const
export type CardStatus = (typeof CARD_STATUSES)[number]

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

/** Marker that splits the card body into front (question) and back (answer). */
export const FLIP_MARKER = '<!-- flip -->' as const

/** Ordered canonical status list, used for filters and badges. */
export const STATUS_LABELS: Record<CardStatus, string> = {
  draft: '草稿',
  review: '待审',
  published: '已发布',
  archived: '已归档',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

/** Fields that must be present in every card's front matter. */
export const REQUIRED_FIELDS = [
  'schemaVersion',
  'id',
  'type',
  'title',
  'category',
  'tags',
  'status',
] as const
export type RequiredField = (typeof REQUIRED_FIELDS)[number]

export const OPTIONAL_FIELDS = [
  'subcategory',
  'difficulty',
  'theme',
  'aliases',
  'related',
  'created',
  'updated',
] as const
export type OptionalField = (typeof OPTIONAL_FIELDS)[number]

/** Parsed + normalised front matter of a single card. */
export interface CardFrontMatter {
  schemaVersion: SchemaVersion
  id: string
  type: CardType
  title: string
  category: string
  subcategory: string | null
  tags: string[]
  difficulty: Difficulty | null
  status: CardStatus
  /** Theme id from the theme registry; `null` means "use the user's default". */
  theme: string | null
  aliases: string[]
  /** Ids of related cards. No backlinks, no graph traversal. */
  related: string[]
  /** ISO date, `YYYY-MM-DD`. */
  created: string | null
  updated: string | null
}

/** A fully parsed card: normalised metadata + split question/answer markdown. */
export interface KnowledgeCard extends CardFrontMatter {
  /** Card body with front matter stripped, whitespace-normalised at the edges. */
  body: string
  /** Markdown rendered on the front of the card. */
  question: string
  /** Markdown rendered on the back of the card. */
  answer: string
  /** True when the body actually produced a back side (answer is non-empty). */
  hasAnswer: boolean
  /** Repo-relative source path, e.g. `content/programming/os/os-001.md`. */
  sourcePath: string
}

/** Fields an editor form can change. */
export type CardDraft = Omit<KnowledgeCard, 'sourcePath'>

/** The result of parsing one Markdown file. */
export type ParseResult =
  | { ok: true; card: KnowledgeCard; warnings: string[] }
  | { ok: false; sourcePath: string; errors: string[]; warnings: string[] }
