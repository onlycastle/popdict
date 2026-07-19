# PopDict phrase dataset

`phrase-entries.csv` is a generated data artifact distributed under the
[Creative Commons Attribution-ShareAlike 4.0 International License](LICENSE.md).

Attribution: **English Wiktionary via Kaikki — filtered and ranked by PopDict.**

The pinned Kaikki raw Wiktextract snapshot was extracted 2026-07-09 from the
English Wiktionary dump dated 2026-07-06. Exact input checksum, counts, source
links, and filtering rules are recorded in [`manifest.json`](manifest.json).

The deterministic generator includes multi-word idiomatic senses and entries
whose part of speech is phrase, prepositional phrase, or proverb. It removes
archaic, obsolete, dated, rare, and nonstandard senses while retaining useful
regional, slang, vulgar, and offensive labels. Duplicate definitions are
removed and each normalized phrase is capped at three ranked senses.

Rebuild with `npm run data:phrases` and the generator's required flags.
Generated CSV and SQL outputs must not be hand-edited.
