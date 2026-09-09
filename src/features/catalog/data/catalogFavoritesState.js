export const EMPTY_FAVORITES_STATE = Object.freeze({
  ownerId: null,
  generation: 0,
  status: "idle",
  rows: Object.freeze([]),
  busy: Object.freeze({}),
  error: null,
})

export function favoriteItemKey(kind, canonicalId) {
  return `${kind}:${canonicalId}`
}

export function findCatalogFavorite(rows, kind, canonicalId) {
  return rows.find(row => row.kind === kind && row.canonicalId === canonicalId) ?? null
}

export function visibleFavoritesState(state, session) {
  return session.status === "signed_in" && state.ownerId === session.user?.id ? state : null
}

function current(state, action) {
  return state.ownerId === action.ownerId && state.generation === action.generation
}

export function catalogFavoritesReducer(state, action) {
  if (action.type === "owner") {
    return {
      ownerId: action.ownerId,
      generation: action.generation,
      status: action.ownerId ? "loading" : "idle",
      rows: [],
      busy: {},
      error: null,
    }
  }
  if (!current(state, action)) return state
  if (action.type === "load_success") return { ...state, status: "ready", rows: action.rows, error: null }
  if (action.type === "load_error") return { ...state, status: "error", rows: [], error: "تعذر تحميل حالة المفضلة." }
  if (action.type === "mutation_start") return { ...state, busy: { ...state.busy, [action.itemKey]: action.operationId }, error: null }
  if (action.type === "save_success" && state.busy[action.itemKey] === action.operationId) {
    const rows = state.rows.filter(row => !(row.kind === action.row.kind && row.canonicalId === action.row.canonicalId))
    return { ...state, rows: [...rows, action.row], busy: withoutBusy(state.busy, action.itemKey), error: null }
  }
  if (action.type === "delete_success" && state.busy[action.itemKey] === action.operationId) {
    return { ...state, rows: state.rows.filter(row => row.id !== action.favoriteId), busy: withoutBusy(state.busy, action.itemKey), error: null }
  }
  if (action.type === "mutation_error" && state.busy[action.itemKey] === action.operationId) {
    return { ...state, busy: withoutBusy(state.busy, action.itemKey), error: "تعذر تحديث المفضلة. حاول مجددًا." }
  }
  return state
}

function withoutBusy(busy, itemKey) {
  const next = { ...busy }
  delete next[itemKey]
  return next
}
