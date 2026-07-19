import type { TargetLanguage, WordTranslation } from '../../shared/language'
import { targetLanguageLabel } from '../../shared/language'

type Props = {
  language: TargetLanguage
  word: string
  state: 'loading' | 'ready' | 'error'
  translations?: WordTranslation[]
  onRetry?: () => void
}

export function wiktionaryEntryUrl(word: string): string {
  return `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}#English`
}

export default function TranslationCard({
  language,
  word,
  state,
  translations = [],
  onRetry,
}: Props) {
  return (
    <section className="translation-card" aria-label={`${targetLanguageLabel(language)} translations`}>
      <div className="translation-card-heading">
        <span className="dict-label">{targetLanguageLabel(language)}</span>
      </div>

      {state === 'loading' ? (
        <div className="translation-skeleton" aria-label="Loading translations">
          <span />
          <span />
        </div>
      ) : state === 'error' ? (
        <div className="translation-card-action">
          <p>Translations are temporarily unavailable.</p>
          <button type="button" className="btn-ghost text-xs" onClick={onRetry}>Retry</button>
        </div>
      ) : (
        <ol className="translation-list">
          {translations.map((translation) => (
            <li key={`${translation.rank}-${translation.text}`}>
              <span className="translation-text">{translation.text}</span>
              {translation.senseLabel && (
                <span className="translation-sense">{translation.senseLabel}</span>
              )}
            </li>
          ))}
        </ol>
      )}

      {state === 'ready' && (
        <p className="translation-attribution">
          <a href={wiktionaryEntryUrl(word)} target="_blank" rel="noreferrer noopener">
            English Wiktionary via Kaikki
          </a>
          {' — filtered, ranked, and completed by PopDict · '}
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/"
            target="_blank"
            rel="noreferrer noopener"
          >
            CC BY-SA 4.0
          </a>
        </p>
      )}
    </section>
  )
}
