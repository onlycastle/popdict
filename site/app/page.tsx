export default function Home() {
  const githubRepo = process.env.GITHUB_REPO
  const issuesUrl = githubRepo ? `https://github.com/${githubRepo}/issues` : null

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
            and a live demo shows the highlight-a-word → glass-popup gesture. */}
        <header className="hero">
          <div className="hero-entry">
            <div className="hero-brand">
              <img className="hero-logo" src="/popdict-logo.png" alt="" />
              <p className="eyebrow">macOS · menu-bar dictionary</p>
            </div>
            <h1 className="headword">
              pop<span className="headword-mid">·</span>dict
            </h1>
            <p className="pronunciation">
              <span className="ipa">/pɒp ˈdɪkt/</span>
              <em className="pos">noun</em>
            </p>
            <p className="definition">
              <span className="sense-num">1.</span> a dictionary that{' '}
              <mark className="mark">appears</mark> one keystroke away — so you can
              look up any word or idiom, hear it, and save it without leaving what
              you’re reading.
            </p>
            <div className="hero-cta">
              <a className="btn" href="/download/latest">
                Download for macOS
              </a>
              <p className="cta-note">Free · Apple Silicon · open source</p>
            </div>
          </div>

          {/* The signature: a real reading surface with a highlighted idiom and the
              actual glass popup blooming over it. This scene is the product. */}
          <div className="demo" aria-hidden="true">
            <div className="reading">
              <p className="reading-meta">the morning thread · 8:41</p>
              <p className="reading-body">
                By Thursday, half the team was{' '}
                <span className="reading-mark">under the weather</span> — the
                standup had become a chorus of coughs, apologetic mutes, and
                people quietly typing “brb, tea” into the channel.
              </p>
            </div>

            <div className="popup">
              <div className="popup-rail">
                <span className="popup-wordmark">
                  <span className="popup-dot" />
                  popdict
                </span>
                <span className="popup-esc">esc</span>
              </div>
              <div className="popup-search">
                <svg
                  className="popup-glass"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <circle cx="7" cy="7" r="5" />
                  <path d="m11 11 3.5 3.5" strokeLinecap="round" />
                </svg>
                under the weather
              </div>
              <div className="popup-result">
                <span className="popup-badge">idiom</span>
                <p className="popup-head">under the weather</p>
                <p className="popup-def">Feeling slightly ill or unwell.</p>
                <p className="popup-example">
                  “I’m a bit under the weather today, so I’ll join remotely.”
                </p>
                <div className="popup-actions">
                  <span className="popup-action">▶ Listen</span>
                  <span className="popup-action popup-action-save">＋ Save</span>
                </div>
              </div>
            </div>
          </div>
        </header>

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
              <span className="sense-tag">phrases</span>
              <h3>Idioms &amp; phrases</h3>
              <p>Multi-word searches return idiomatic meanings, not just literals.</p>
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
              <dd>Yes — and open source under the MIT License.</dd>
            </div>
            <div className="note">
              <dt>Do I need an account?</dt>
              <dd>Only to save words. Looking up words works without signing in.</dd>
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
            {issuesUrl ? <a href={issuesUrl}>GitHub Issues</a> : null}
          </div>
          <div className="copyright">© {new Date().getFullYear()} Sungman Cho</div>
        </div>
      </footer>
    </main>
  )
}
