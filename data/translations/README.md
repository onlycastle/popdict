# PopDict translation dataset

The files in this directory are data artifacts, not MIT-licensed application
code. `word-translations.csv` and `ngsl-gr-3000.txt` are distributed under the
[Creative Commons Attribution-ShareAlike 4.0 International License](LICENSE.md).

Attribution: **English Wiktionary via Kaikki — filtered and ranked by PopDict.**

## Pinned inputs

- Kaikki raw Wiktextract JSONL snapshot, extracted 2026-07-09 from the English
  Wiktionary dump dated 2026-07-06:
  <https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz>
- NGSL-GR 1.0 ranked learner vocabulary:
  <https://www.newgeneralservicelist.com/s/NGSL-GR_rank.csv>

Exact SHA-256 checksums, record counts, and the snapshot date are recorded in
[`manifest.json`](manifest.json).

## PopDict transformations

The deterministic generator:

1. takes the first 3,000 distinct normalized, single English headwords from
   NGSL-GR;
2. keeps Korean, Japanese, Simplified Chinese, Spanish, and Brazilian
   Portuguese translations from English Wiktionary entries;
3. removes archaic, obsolete, dated, rare, and nonstandard candidates using
   both entry tags and leading source-sense qualifiers, then removes
   wrong-region, wrong-script, and romanized-only candidates;
4. normalizes whitespace and Unicode, deduplicates equivalents, prefers useful
   sense diversity, rejects unresolved Wiktionary templates, and limits each
   word/language pair to three ranked rows;
5. preserves a short English sense label when the source supplies one, after
   removing safe emphasis/link markup and dropping template-bearing labels.

Rebuild with `npm run data:translations` and the generator’s required flags.
Generated CSV and SQL are outputs;
do not hand-edit them.

Wiktionary entries remain available under their applicable Creative Commons
terms. The raw extraction is produced by the
[Wiktextract project](https://github.com/tatuylonen/wiktextract); Kaikki asks
users to link to the relevant Kaikki pages and cite Tatu Ylonen, *Wiktextract:
Wiktionary as Machine-Readable Structured Data* (LREC 2022) in academic work.
