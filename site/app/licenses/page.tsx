import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Third-Party Licenses — PopDict',
  description:
    'Open-source fonts and data sources used by PopDict, and their license notices.',
}

// SIL Open Font License 1.1 — reproduced so the fonts this site self-hosts ship
// with their required license text. Kept in sync with the repo-root
// THIRD_PARTY_NOTICES.md.
const OFL_TEXT = `-----------------------------------------------------------
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
OTHER DEALINGS IN THE FONT SOFTWARE.`

export default function Licenses() {
  return (
    <main className="container prose">
      <h1>Third-Party Licenses</h1>
      <p>
        PopDict is open source under the MIT License. It uses the open-source
        fonts and data sources listed here, each under its own license.
      </p>

      <h2>Fonts — SIL Open Font License 1.1</h2>
      <p>This site self-hosts the following fonts under the SIL OFL 1.1:</p>
      <ul>
        <li>
          <strong>Fraunces</strong> — Copyright 2020 The Fraunces Project Authors
          (<a href="https://github.com/undercasetype/Fraunces">github.com/undercasetype/Fraunces</a>).
        </li>
        <li>
          <strong>Inter</strong> — Copyright The Inter Project Authors
          (<a href="https://github.com/rsms/inter">github.com/rsms/inter</a>).
        </li>
        <li>
          <strong>JetBrains Mono</strong> — Copyright 2020 The JetBrains Mono
          Project Authors
          (<a href="https://github.com/JetBrains/JetBrainsMono">github.com/JetBrains/JetBrainsMono</a>).
        </li>
      </ul>
      <p>
        The fonts are used under their distributed family names, unmodified, so
        no Reserved Font Name restriction is triggered. The full license text:
      </p>
      <pre>{OFL_TEXT}</pre>

      <h2>English definitions</h2>
      <p>
        Word definitions come from the{' '}
        <a href="https://dictionaryapi.dev">Free Dictionary API</a>, whose data is
        derived from <a href="https://www.wiktionary.org">Wiktionary</a> and
        licensed under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA</a>.
        PopDict preserves and displays the per-entry source and license metadata
        returned by the API.
      </p>

      <h2>Multilingual translation dataset — CC BY-SA 4.0</h2>
      <p>
        Korean, Japanese, Simplified Chinese, Spanish, and Brazilian Portuguese
        equivalents are derived from English Wiktionary through the{' '}
        <a href="https://kaikki.org/dictionary/rawdata.html">Kaikki machine-readable dictionary</a>.
        The learner headword selection comes from{' '}
        <a href="https://www.newgeneralservicelist.com/ngsl-graded-reader">NGSL-GR 1.0</a>.
        PopDict’s generated translation dataset and normalized 5,049-headword list
        are distributed under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>,
        separately from the MIT-licensed application code.
      </p>
      <p>
        The pinned Kaikki snapshot was extracted July 9, 2026 from the July 6,
        2026 English Wiktionary dump. PopDict normalized English headwords,
        selected five target languages, removed archaic, obsolete, dated, rare,
        and nonstandard forms, applied regional/script filters, deduplicated
        equivalents, and ranked at most three per word and language. Checksums
        and exact inputs are recorded in the repository’s{' '}
        <a href="https://github.com/onlycastle/popdict/blob/main/data/translations/manifest.json">
          translation dataset manifest
        </a>{' '}
        and bundled notices.
      </p>

      <h2>English phrase dataset — CC BY-SA 4.0</h2>
      <p>
        Phrase and idiom entries are derived from English Wiktionary through
        Kaikki and distributed under{' '}
        <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>.
        PopDict includes multi-word idiomatic senses and phrase,
        prepositional-phrase, and proverb entries; filters obsolete and
        nonstandard senses; retains useful usage labels; and ranks at most three
        senses per normalized phrase. Exact counts and checksums are recorded in
        the repository’s{' '}
        <a href="https://github.com/onlycastle/popdict/blob/main/data/phrases/manifest.json">
          phrase dataset manifest
        </a>.
      </p>

      <h2>Full notices</h2>
      <p>
        The complete third-party notices bundled with the desktop app are in{' '}
        <a href="https://github.com/onlycastle/popdict/blob/main/THIRD_PARTY_NOTICES.md">
          THIRD_PARTY_NOTICES.md
        </a>
        .
      </p>
    </main>
  )
}
