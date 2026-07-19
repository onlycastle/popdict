export type SavedWordsLoadState<Row> = {
  userId: string | null
  rows: Row[]
  loading: boolean
  error: string
  requestId: number
}

export function initialSavedWordsLoadState<Row>(): SavedWordsLoadState<Row> {
  return { userId: null, rows: [], loading: false, error: '', requestId: 0 }
}

export function beginSavedWordsLoad<Row>(
  userId: string | null,
  requestId: number,
): SavedWordsLoadState<Row> {
  return { userId, rows: [], loading: userId !== null, error: '', requestId }
}

export function completeSavedWordsLoad<Row>(
  state: SavedWordsLoadState<Row>,
  input: { userId: string; requestId: number; rows: Row[] },
): SavedWordsLoadState<Row> {
  if (state.userId !== input.userId || state.requestId !== input.requestId) return state
  return { ...state, rows: input.rows, loading: false, error: '' }
}

export function failSavedWordsLoad<Row>(
  state: SavedWordsLoadState<Row>,
  input: { userId: string; requestId: number; error: string },
): SavedWordsLoadState<Row> {
  if (state.userId !== input.userId || state.requestId !== input.requestId) return state
  return { ...state, rows: [], loading: false, error: input.error }
}

export function visibleSavedWords<Row>(
  state: SavedWordsLoadState<Row>,
  activeUserId: string | null,
): Row[] {
  return activeUserId !== null && state.userId === activeUserId ? state.rows : []
}
