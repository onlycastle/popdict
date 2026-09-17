# Bundled offline dictionary

`dictionary.sqlite.gz` is a generated read-only dictionary, separate from
MIT-licensed application code and from the user's writable `library.sqlite`.
The app installs this bundled file locally; no runtime API or first-run download
is needed. The manifest pins source hashes and the resulting database hash.

## Sources and licenses

- **Simple English Wiktionary via Kaikki/Wiktextract**: learner definitions,
  examples, phonetics and explicit inflections. Adapted under
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- **Princeton WordNet 3.1**: definitions, examples, synonyms and exception forms.
  See [WORDNET-LICENSE.txt](WORDNET-LICENSE.txt). Preserve this notice with copies.
- PopDict's existing [phrase dataset](../phrases/README.md) and
  [translation dataset](../translations/README.md), under CC BY-SA 4.0.

The combined database is distributed under CC BY-SA 4.0, with the WordNet
notice retained. Each result carries its source attribution and license.
PopDict transforms source records into indexed entries, caps WordNet senses at
three per part of speech, prioritizes learner definitions, excludes archaic and
obsolete learner senses, maps explicit inflections, and omits remote audio.
This is a finite snapshot: it is not a promise of complete English coverage.
Translations cover the existing learner headword set, not every definition.

## Rebuild

Download the two source archives at the URLs recorded in
[manifest.json](manifest.json), verify their SHA-256 values, then run:

```sh
python3 scripts/offline/build-dictionary.py \
  --simple out-data/simple-extract.jsonl.gz \
  --wordnet out-data/wn3.1.dict.tar.gz
```

The script reads the tracked phrase and translation CSV files, writes the
compressed SQLite artifact and manifest, and removes the intermediate database.
Sources are identified by content hashes because Kaikki's download is updated
in place. Keep a copy of the pinned input when reproducing a historical build.

Packaging copies this directory into application resources. Electron verifies
the manifest hash and atomically installs a versioned dictionary under user data.
The writable personal library is never replaced by a dictionary update.
