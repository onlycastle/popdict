# Harness Routing

Task type → specialist skill → gates that must stay green. The
`harness-drift` gate keeps this table in parity with `.claude/skills/`:
every tracked skill needs a row, every row needs a tracked skill.

| Skill | Route here when | Domain map | Gates that bite |
|---|---|---|---|
| popdict-foreman | Work spans several domains, or you're unsure which specialist applies | [wiki index](llm-wiki/index.md) | all |
| desktop-runtime | Electron main process: windows, IPC, hotkey, tray, updater, auth deep links, security policy | [desktop-runtime](llm-wiki/desktop-runtime.md) | electron-invariants |
| dictionary-data | Lookup routing, dictionary sources, edge functions, migrations, saved words | [dictionary-data](llm-wiki/dictionary-data.md) | supabase-boundary |
| site-downloads | Next.js site, download redirect/tracking, admin stats, cron, OAuth handoff page | [site-downloads](llm-wiki/site-downloads.md) | secret-scan |
| deploy-popdict | Cutting/publishing a release, stale website DMG, auto-update not arriving | [release-ops](llm-wiki/release-ops.md) | electron-invariants |
| privacy-security | Secrets, auth flows, renderer security, anything that could leak into the public repo | [harness](llm-wiki/harness.md) | secret-scan, supabase-boundary |
| qa-reviewer | Independent review before merging non-trivial work | [harness](llm-wiki/harness.md) | all |

Skill playbooks live in [.claude/skills/](../.claude/skills/) — each SKILL.md
is the specialist's working rules; the wiki page is the domain map. Writer
and reviewer must be different: route the review of any specialist's work to
qa-reviewer (or the neighboring domain specialist), never back to the writer.
