export default function Home() {
  const githubRepo = process.env.GITHUB_REPO
  const issuesUrl = githubRepo ? `https://github.com/${githubRepo}/issues` : null

  return (
    <main>
      <div className="container">
        <header className="hero">
          <h1>A dictionary one keystroke away.</h1>
          <p className="lead">
            PopDict is a macOS menu-bar dictionary for English learners. Look up any word
            or idiom, hear it pronounced, and save it to review — without leaving whatever
            you’re reading.
          </p>
          <a className="cta" href="/download/latest">
            Download for macOS
          </a>
          <p className="cta-note">Free · macOS (Apple Silicon)</p>
        </header>

        <section id="how">
          <h2>How it works</h2>
          <div className="steps">
            <div className="step">
              <p className="num">1</p>
              <p>Press the global hotkey (default ⌘⇧Space) from any app.</p>
            </div>
            <div className="step">
              <p className="num">2</p>
              <p>Type a word — or select text anywhere and let PopDict look it up.</p>
            </div>
            <div className="step">
              <p className="num">3</p>
              <p>See the definition, hear the pronunciation, and save it to review.</p>
            </div>
          </div>
        </section>

        <section id="features">
          <h2>Features</h2>
          <div className="features">
            <div className="feature">
              <h3>Instant lookup</h3>
              <p>A floating glass popup over whatever you’re doing. Esc to dismiss.</p>
            </div>
            <div className="feature">
              <h3>Select-to-lookup</h3>
              <p>Highlight a word in any app and press the hotkey to search it.</p>
            </div>
            <div className="feature">
              <h3>Audio pronunciation</h3>
              <p>Hear the recorded clip, or a built-in text-to-speech fallback.</p>
            </div>
            <div className="feature">
              <h3>Idioms &amp; phrases</h3>
              <p>Multi-word searches return idiomatic meanings, not just literals.</p>
            </div>
            <div className="feature">
              <h3>Saved words</h3>
              <p>Save words and review, filter, and re-look-up them anytime.</p>
            </div>
            <div className="feature">
              <h3>Native menu-bar app</h3>
              <p>Lives in your menu bar. Launch at login. No dock clutter.</p>
            </div>
          </div>
        </section>

        <section id="faq">
          <h2>FAQ</h2>
          <dl className="faq">
            <dt>Is it free?</dt>
            <dd>Yes.</dd>
            <dt>Do I need an account?</dt>
            <dd>Only to save words. Looking up words works without signing in.</dd>
            <dt>Why does it ask for Accessibility permission?</dt>
            <dd>
              Only for select-to-lookup — to read the text you’ve highlighted in another
              app when you press the hotkey. It’s optional.
            </dd>
            <dt>How do updates work?</dt>
            <dd>PopDict updates itself automatically once a new version is released.</dd>
            <dt>What are the requirements?</dt>
            <dd>macOS on Apple Silicon.</dd>
          </dl>
        </section>
      </div>

      <footer>
        <div className="container">
          <div className="links">
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            {issuesUrl ? <a href={issuesUrl}>GitHub Issues</a> : null}
          </div>
          <div>© {new Date().getFullYear()} Sungman Cho · PopDict</div>
        </div>
      </footer>
    </main>
  )
}
