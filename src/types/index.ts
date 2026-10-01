/** Public type surface. Import from `@/types` — never from a sub-file directly. */

export type {
  CardDraft,
  CardFrontMatter,
  CardStatus,
  CardType,
  Difficulty,
  KnowledgeCard,
  OptionalField,
  ParseResult,
  RequiredField,
  SchemaVersion,
} from './card'
export {
  CARD_STATUSES,
  CARD_TYPES,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  FLIP_MARKER,
  OPTIONAL_FIELDS,
  REQUIRED_FIELDS,
  SCHEMA_VERSION,
  STATUS_LABELS,
} from './card'

export type {
  ThemeBinding,
  ThemeCategory,
  ThemeDefinition,
  ThemeLayout,
  ThemeMode,
  ThemeTexture,
  ThemeTypography,
  ThemeVariableOverrides,
  ThemeVariables,
} from './theme'
export { DEFAULT_THEME_ID, THEME_CATEGORIES, THEME_CATEGORY_LABELS } from './theme'

export type {
  FacetCount,
  IndexedCard,
  KnowledgeIndex,
  SearchField,
  SearchFilters,
  SearchHit,
  SearchResult,
} from './search'
export { ALL_STATUSES, EMPTY_FILTERS, PUBLIC_STATUS, SEARCH_FIELDS } from './search'
