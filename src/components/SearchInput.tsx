import { forwardRef } from 'react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch?: () => void
  loading?: boolean
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onSearch, loading }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onSearch) {
        onSearch()
      }
    }

    return (
      <div className="relative">
        {/* Decorative affordance only — aria-hidden + pointer-events:none so it
            never steals focus/clicks or interferes with the drag region. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/45"
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
          placeholder="Search for words, phrases, or idioms..."
          className="search-input search-input--with-icon"
          autoFocus
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-white/30 border-t-white/80 rounded-full" />
          </div>
        )}
      </div>
    )
  }
)

SearchInput.displayName = 'SearchInput'

export default SearchInput
