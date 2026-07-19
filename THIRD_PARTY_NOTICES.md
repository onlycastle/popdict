# Third-Party Notices

PopDict is licensed under the MIT License (see [LICENSE](LICENSE)). It bundles
and relies on third-party software and data covered by their own licenses,
reproduced or referenced below.

Runtime dependencies (Electron, Chromium, React, Supabase JS, and others) ship
their own license texts inside their npm packages and inside the packaged app's
resources; this file collects the notices that require explicit attribution or
that are not otherwise distributed with the binary.

---

## Fonts — SIL Open Font License, Version 1.1

PopDict embeds the following fonts. The desktop app bundles Fraunces and
JetBrains Mono; the website (`site/`) additionally self-hosts Inter. All are
distributed under the SIL Open Font License, Version 1.1, whose full text
appears once below.

- **Fraunces** — Copyright 2020 The Fraunces Project Authors
  (github.com/undercasetype/Fraunces). Reserved Font Name: "Fraunces".
- **JetBrains Mono** — Copyright 2020 The JetBrains Mono Project Authors
  (https://github.com/JetBrains/JetBrainsMono). Reserved Font Name:
  "JetBrains Mono".
- **Inter** — Copyright The Inter Project Authors
  (https://github.com/rsms/inter). Reserved Font Name: "Inter". (Used on the
  website only.)

These fonts are used under their distributed family names and are neither
modified nor renamed, so no Reserved Font Name restriction is triggered.

```
-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

---

## English definition data

- **Free Dictionary API** (https://dictionaryapi.dev) — provides word
  definitions used for lookups. Its data is derived from
  [Wiktionary](https://www.wiktionary.org) and is licensed under
  [Creative Commons Attribution-ShareAlike (CC BY-SA)](https://creativecommons.org/licenses/by-sa/3.0/).

PopDict preserves the source and license metadata returned with each Free
Dictionary entry. Recorded pronunciation is used only when its phonetic record
also supplies source and license metadata; otherwise PopDict uses system
text-to-speech.

---

## Multilingual translation dataset — CC BY-SA 4.0

Attribution: **English Wiktionary via Kaikki — filtered, ranked, and completed by PopDict.**

The generated `data/translations/word-translations.csv` dataset and normalized
`data/translations/ngsl-gr-5049.txt` learner headword list are licensed
separately from PopDict application code under
[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).

Pinned source inputs:

- **Kaikki raw Wiktextract JSONL**
  (https://kaikki.org/dictionary/raw-wiktextract-data.jsonl.gz), extracted
  2026-07-09 from the English Wiktionary dump dated 2026-07-06. Compressed
  SHA-256:
  `e8a1d8e9470af8ee424bc5a2d74ad89aa158b913d924042dc5a90a62437906c6`.
- **NGSL-GR 1.0 ranked learner vocabulary**
  (https://www.newgeneralservicelist.com/s/NGSL-GR_rank.csv). Source CSV
  SHA-256:
  `5c4f7bb84b5d74d7481d43483b811f1591bd667b86a6131f1566fdf07cade91e`.

PopDict’s deterministic changes are: select all 5,049 distinct valid
normalized single English NGSL-GR headwords; retain Korean, Japanese,
Simplified Chinese, Spanish, and Brazilian Portuguese; remove archaic,
obsolete, dated, rare, and nonstandard candidates using entry tags and leading
source-sense qualifiers; remove wrong-region, wrong-script, and romanized-only
candidates; normalize Unicode and whitespace; deduplicate;
reject unresolved Wiktionary templates; prefer useful sense diversity; and
rank at most three equivalents per word and language. Short English
source-sense labels are retained when available after safe markup cleanup.
When the snapshot has no translation-bearing entry for an NGSL-GR headword,
PopDict keeps at most one manually vetted alias sense per language. Ambiguous
fallbacks use explicit semantic equivalents authored by PopDict project
contributors and offered under CC BY-SA 4.0. The manifest separately records
the alias/manual fallback counts so downstream users can audit provenance.

The machine-readable manifest with record counts, source URLs, checksums, and
the filtering summary is at `data/translations/manifest.json`. Wiktextract is
developed by Tatu Ylonen and contributors; Kaikki requests links to its pages
and citation of Tatu Ylonen, “Wiktextract: Wiktionary as Machine-Readable
Structured Data,” LREC 2022, for academic use.

---

## English phrase dataset — CC BY-SA 4.0

Attribution: **English Wiktionary via Kaikki — filtered and ranked by PopDict.**

The generated `data/phrases/phrase-entries.csv` dataset is licensed separately
from PopDict application code under
[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
It comes from the same pinned Kaikki snapshot and English Wiktionary dump listed
above. PopDict includes multi-word idiomatic senses and phrase,
prepositional-phrase, and proverb entries; removes archaic, obsolete, dated,
rare, and nonstandard senses; preserves regional and sensitive usage labels;
deduplicates definitions; and ranks at most three senses per normalized phrase.
Exact counts, checksums, and filtering rules are recorded in
`data/phrases/manifest.json`.

---

_This file is bundled into the packaged macOS app and mirrored on the website at
`/licenses`. If you add a dependency or data source with attribution
requirements, add it here in the same change._
