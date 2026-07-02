import { forwardRef } from 'react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch?: () => void
  loading?: boolean
}

// The unboxed, Spotlight-style field: magnifier, serif input, spinner slot.
// Layout (row height, gaps) belongs to .search-row in the parent.
const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onSearch, loading }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSearch) {
        onSearch()
      }
    }

    return (
      <>
        <svg
          aria-hidden="true"
          className="search-row__icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="7" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Look up a word or idiom…"
          className="search-field"
          aria-label="Look up a word or idiom"
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          autoFocus
        />
        {loading && (
          <div className="animate-spin h-4 w-4 shrink-0 border-2 border-white/25 border-t-white/70 rounded-full" />
        )}
      </>
    )
  }
)

SearchInput.displayName = 'SearchInput'

export default SearchInput
