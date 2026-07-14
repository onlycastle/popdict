import { fetchGitHubDmgDownloadCount, formatDownloadProof } from './downloadProof'

export default async function Home() {
  // The repo is public, so fall back to it — the hero's "View source" button
  // should always work, even if GITHUB_REPO isn't set in the build environment.
  const githubRepo = process.env.GITHUB_REPO || 'onlycastle/popdict'
  const githubUrl = `https://github.com/${githubRepo}`
  const issuesUrl = `${githubUrl}/issues`
  const releasesUrl = `${githubUrl}/releases`
  const downloadCount = await fetchGitHubDmgDownloadCount(githubRepo)
  const downloadProof = downloadCount === null ? null : formatDownloadProof(downloadCount)

  return (
    <main>
      <nav className="nav">
        <div className="nav-inner">
          <a className="wordmark" href="#top">
            <img className="wordmark-logo" src="/popdict-logo.png" alt="" />
            popdict
          </a>
          <div className="nav-actions">
            <a className="nav-link" href="#features">
              Features
            </a>
            <a className="nav-link" href="#notes">
              Notes
            </a>
            <a className="btn btn-small" href="/download/latest">
              Download
            </a>
          </div>
        </div>
      </nav>

      <div className="page" id="top">
        {/* HERO — the page opens as a dictionary entry for the word "popdict",
            set like a product page: centered, quiet, one type moment. */}
        <header className="hero">
          <img className="hero-logo" src="/popdict-logo.png" alt="" />
          <p className="eyebrow">macOS · menu-bar dictionary</p>
          <h1 className="headword">
            pop<span className="headword-mid">·</span>dict
          </h1>
          <p className="pronunciation">
            <span className="ipa">/pɒp ˈdɪkt/</span>
            <em className="pos">noun</em>
          </p>
          <p className="definition">
            <span className="sense-num">1.</span> a dictionary that{' '}
            <mark className="mark">appears</mark> one keystroke away — look up
            an English word, hear it, translate it, and save it without leaving what
            you’re reading.
          </p>
          <div className="hero-cta">
            <div className="hero-cta-actions">
              <a className="btn" href="/download/latest">
                Download for macOS
              </a>
              <a
                className="btn btn-ghost"
                href={githubUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <svg
                  className="gh-mark"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                View source
              </a>
            </div>
            <p className="cta-note">Free · Apple Silicon · open source</p>
            <div className="trust-strip" aria-label="PopDict trust signals">
              <a
                className="trust-item"
                href={githubUrl}
                target="_blank"
                rel="noreferrer noopener"
              >
                <svg
                  className="trust-icon"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
                </svg>
                <span>
                  <strong>Open source</strong>
                  <small>MIT licensed</small>
                </span>
              </a>
              {downloadProof ? (
                <a
                  className="trust-item"
                  href={releasesUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <svg
                    className="trust-icon"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 3v9m0 0 3.25-3.25M10 12 6.75 8.75M4 14.5v1.25A1.25 1.25 0 0 0 5.25 17h9.5A1.25 1.25 0 0 0 16 15.75V14.5"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>
                    <strong>{downloadProof}</strong>
                    <small>Counted by GitHub</small>
                  </span>
                </a>
              ) : null}
            </div>
          </div>
        </header>

        {/* THE STAGE — a real product capture, not an abstraction: hotkey,
            lookup window, and context together in one inspectable frame. */}
        <section className="stage" aria-labelledby="demo-title">
          <div className="demo-capture">
            <img
              className="demo-gif"
              src="/demo.gif"
              alt="PopDict popup searching for a word while floating over a browser page"
              width="720"
              height="456"
            />
          </div>
          <p className="demo-caption" id="demo-title">
            Press the hotkey, type a word, read the definition without leaving
            the page.
          </p>
        </section>

        {/* USAGE — a genuine sequence (you must press the key first), shown as one
            connected flow with keycaps rather than decorative numbered cards. */}
        <section className="block" id="usage">
          <p className="block-label">usage</p>
          <div className="flow">
            <div className="flow-step">
              <span className="keys">
                <kbd>⌘</kbd>
                <kbd>⇧</kbd>
                <kbd>Space</kbd>
              </span>
              <p>Summon PopDict over any app with the global hotkey.</p>
            </div>
            <span className="flow-arrow" aria-hidden="true">
              →
            </span>
            <div className="flow-step">
              <span className="flow-verb">type · select</span>
              <p>Type a word, or highlight one anywhere and let PopDict read it.</p>
            </div>
            <span className="flow-arrow" aria-hidden="true">
              →
            </span>
            <div className="flow-step">
              <span className="flow-verb">see · hear · save</span>
              <p>Read the definition, play the pronunciation, keep it to review.</p>
            </div>
          </div>
        </section>

        {/* FEATURES — presented as further senses of the entry. Each carries a
            mono function tag (grouping = information, not decoration). */}
        <section className="block" id="features">
          <p className="block-label">more senses</p>
          <div className="senses">
            <article className="sense">
              <span className="sense-tag">lookup</span>
              <h3>Instant popup</h3>
              <p>A floating glass panel over whatever you’re doing. Esc to dismiss.</p>
            </article>
            <article className="sense">
              <span className="sense-tag">lookup</span>
              <h3>Select-to-lookup</h3>
              <p>Highlight a word in any app and press the hotkey to search it.</p>
            </article>
            <article className="sense">
              <span className="sense-tag">audio</span>
              <h3>Hear every word</h3>
              <p>Play the recorded clip, or a built-in text-to-speech fallback.</p>
            </article>
            <article className="sense">
              <span className="sense-tag">translate</span>
              <h3>Five translation languages</h3>
              <p>Sign in for free equivalents in Korean, Japanese, Simplified Chinese, Spanish, or Brazilian Portuguese.</p>
            </article>
            <article className="sense">
              <span className="sense-tag">review</span>
              <h3>Saved words</h3>
              <p>Save words, then filter, review, and re-look-up them anytime.</p>
            </article>
            <article className="sense">
              <span className="sense-tag">native</span>
              <h3>Lives in the menu bar</h3>
              <p>Launches at login. No dock clutter, no window to manage.</p>
            </article>
          </div>
        </section>

        {/* NOTES — the FAQ, framed as a dictionary's usage notes. */}
        <section className="block" id="notes">
          <p className="block-label">notes</p>
          <dl className="notes">
            <div className="note">
              <dt>Is it free?</dt>
              <dd>Yes. English definitions and all five translation languages are free.</dd>
            </div>
            <div className="note">
              <dt>Do I need an account?</dt>
              <dd>Only to save words or see translations. English lookups work without signing in.</dd>
            </div>
            <div className="note">
              <dt>Why the Accessibility permission?</dt>
              <dd>
                Only for select-to-lookup — to read text you’ve highlighted in
                another app when you press the hotkey. It’s optional.
              </dd>
            </div>
            <div className="note">
              <dt>How do updates work?</dt>
              <dd>PopDict updates itself automatically once a new version ships.</dd>
            </div>
            <div className="note">
              <dt>What are the requirements?</dt>
              <dd>macOS on Apple Silicon.</dd>
            </div>
          </dl>
        </section>

        {/* Closing call — the headword, defined as an action. */}
        <section className="closing">
          <p className="closing-line">
            Keep reading. <mark className="mark">Look it up</mark> on the way.
          </p>
          <a className="btn" href="/download/latest">
            Download for macOS
          </a>
          <p className="cta-note">Free · Apple Silicon · open source</p>
        </section>
      </div>

      <footer>
        <div className="footer-inner">
          <a className="wordmark wordmark-quiet" href="#top">
            <img className="wordmark-logo" src="/popdict-logo.png" alt="" />
            popdict
          </a>
          <div className="links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/licenses">Licenses</a>
            {issuesUrl ? <a href={issuesUrl}>GitHub Issues</a> : null}
          </div>
          <div className="copyright">© {new Date().getFullYear()} OriginLayer, Inc.</div>
        </div>
      </footer>
    </main>
  )
}
