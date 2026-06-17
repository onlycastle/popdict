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
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for words, phrases, or idioms..."
          className="search-input"
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
