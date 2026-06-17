# Idiom & Phrase Support Setup Guide

PopDict now supports searching for idioms and phrases in addition to single words!

## 🎯 How It Works

### Automatic Detection
- **Single word** (e.g., "apple") → Uses Free Dictionary API only
- **Multi-word phrase** (e.g., "kick the bucket") → Queries both Free Dictionary API and STANDS4 Phrases API in parallel

### What You'll See

When searching for an idiom like "kick the bucket", you'll see:

1. **Idiom Section** (blue highlight box)
   - Idiomatic meaning: "To die"
   - Example usage
   - Marked with "IDIOM" badge

2. **Dictionary Section** (below idiom)
   - Literal meanings of each word
   - Helps understand the components

## 🔑 Setting Up STANDS4 Phrases API (Optional but Recommended)

The app works out of the box with Free Dictionary API, which supports many common idioms. However, for broader idiom coverage, you can add STANDS4 Phrases API:

### Step 1: Get API Credentials

1. Visit: https://www.stands4.com/services/v2/phrases.php
2. Sign up for a free account
3. You'll receive:
   - `uid` (User ID)
   - `tokenid` (API Token)
4. Free tier includes **100 queries per day**

### Step 2: Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```env
   VITE_PHRASES_API_UID=your_uid_here
   VITE_PHRASES_API_TOKEN=your_token_here
   ```

3. Restart the app:
   ```bash
   npm start
   ```

### Step 3: Test It Out

Try searching for these idioms:
- "kick the bucket"
- "break the ice"
- "once in a blue moon"
- "piece of cake"
- "hit the nail on the head"

## 📊 API Coverage Comparison

| Idiom | Free Dictionary API | With STANDS4 API |
|-------|---------------------|------------------|
| "kick the bucket" | ✅ Works | ✅ Enhanced |
| "break the ice" | ✅ Works | ✅ Enhanced |
| "once in a blue moon" | ✅ Works | ✅ Enhanced |
| "piece of cake" | ❌ Not found | ✅ Works |
| "spill the beans" | ❌ Not found | ✅ Works |

## 🔧 Technical Details

### Architecture

```
User enters text
    ↓
Is it multi-word?
    ↓
YES → Query both APIs in parallel
    ├─→ Free Dictionary API (for literal meanings)
    └─→ STANDS4 Phrases API (for idiomatic meanings)

NO → Query Free Dictionary API only
```

### Files Modified

- [`src/types/dictionary.ts`](src/types/dictionary.ts) - Added `IdiomResult` and `SearchResponse` types
- [`src/services/dictionaryApi.ts`](src/services/dictionaryApi.ts) - New API service layer
- [`src/hooks/useDictionarySearch.ts`](src/hooks/useDictionarySearch.ts) - Updated to use new API service
- [`src/components/SearchResults.tsx`](src/components/SearchResults.tsx) - Added idiom display section
- [`src/components/SearchInput.tsx`](src/components/SearchInput.tsx) - Updated placeholder text

### API Response Structure

**Free Dictionary API Response:**
```json
[
  {
    "word": "kick the bucket",
    "phonetic": "/ˈkɪk ðə ˈbʌkɪt/",
    "meanings": [
      {
        "partOfSpeech": "verb",
        "definitions": [
          {
            "definition": "To die.",
            "example": "The old horse finally kicked the bucket.",
            "synonyms": ["bite the dust", "buy the farm"]
          }
        ]
      }
    ]
  }
]
```

**STANDS4 Phrases API Response:**
```json
{
  "results": {
    "result": {
      "term": "buckle up",
      "explanation": "To fasten one's seat belt or safety belt.",
      "example": "Buckle up every time you drive somewhere in a car."
    }
  }
}
```

## 🚀 Without API Key

Even without configuring STANDS4 API, the app will:
- Work perfectly for single words
- Work for many common idioms (via Free Dictionary API)
- Show graceful error messages for unsupported idioms

## 🎨 UI Design

Idioms are displayed in a **blue-highlighted box** to visually distinguish them from regular dictionary definitions:

```
┌─────────────────────────────────────┐
│ 🏷️ IDIOM                            │
│                                     │
│ kick the bucket                     │
│ To die (informal)                   │
│ "The old horse finally kicked..."   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Dictionary Definition               │
│ kick (verb)                         │
│ 1. Strike with the foot...          │
└─────────────────────────────────────┘
```

## 📈 Future Enhancements

Potential improvements for Phase 2:
- Local caching to reduce API calls
- Favorites/history for commonly searched idioms
- "Related idioms" suggestions
- Support for more languages
- Offline idiom database

## ❓ Troubleshooting

### "Phrases API credentials not configured" error
- Make sure you created the `.env` file
- Verify the credentials are correct
- Restart the app after adding credentials

### Idioms not showing up
- Check if the idiom is supported by searching it directly
- Ensure you're searching with correct spelling
- Try with and without articles (e.g., "kick bucket" vs "kick the bucket")

### API rate limit reached
- Free tier: 100 queries/day for STANDS4
- Wait 24 hours or upgrade to premium
- Free Dictionary API has no rate limit

## 📚 Resources

- [Free Dictionary API Docs](https://dictionaryapi.dev/)
- [STANDS4 Phrases API Docs](https://www.stands4.com/services/v2/phrases.php)
- [Merriam-Webster API](https://dictionaryapi.com/) (alternative with 1000/day free tier)
