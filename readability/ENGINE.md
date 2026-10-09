# Readable engine (`engine.js`)

A plain script with no dependencies. In the browser it sets `window.Readable`; in Node, `require('./engine.js')` returns it. Tests: `node readability/engine.test.js`.

## API
`Readable.analyze(text) → Result | null`. It returns `null` when no sentence contains a letter, which covers empty text, whitespace, emoji only and numbers only. `Readable.version` holds the version string.

- **stats**: `words, sentences, paragraphs, characters` (code points, line breaks excluded), `syllables, complexWords` (Gunning), `longWords` (7+ letters), `readingTimeSec` (238 wpm), `speakingTimeSec` (150 wpm), `avgWordsPerSentence, avgSyllablesPerWord`.
- **scores**:
  - `fleschReadingEase` is clamped to 0–100.
  - `fleschKincaidGrade, gunningFog, smog, colemanLiau, ari` are grades, clamped at 0 or above.
  - `consensusGrade` is a trimmed mean of those five: it drops the highest and lowest, then averages the middle three.
  - `label` and `audience` come from the standard Flesch bands. `letter` runs A (70 or more), B (60 or more), C (50 or more), D (40 or more), E (30 or more) and F (below 30).
- **sentences[]**: `index, start, end` (offsets into the original string, end exclusive, so `text.slice(start,end) === text`), `paragraph, words, syllables, complexWords, grade` (Flesch–Kincaid for that one sentence), `difficulty` (0–100), `level` (`easy` below 25, `ok` below 45, `hard` below 65, otherwise `very-hard`), `reasons[]`, `rank` (1–5 or `null`).
- **hardest[]**: up to five sentence objects with 4 or more words, sorted by difficulty, then grade, then position. These are the same objects that appear in `sentences`.
- **issues[]**: `{type, start, end, text, message, suggestion}`, sorted by `start`. The types are `passive | complex-word | filler | adverb | repeated-word | long-sentence` (25 or more words) `| very-long-sentence` (40 or more). Word-level issues never overlap each other. Passive and sentence-level spans can overlap them.
- **paragraphs[]**: `{index, start, end, words, fleschReadingEase}`.
- **wordFrequency[]**: the top 10 `{word, count}`, leaving out stopwords and numbers.

## Formulas (published constants)
- Flesch RE = 206.835 − 1.015·(W/S) − 84.6·(Syl/W)
- FK = 0.39·(W/S) + 11.8·(Syl/W) − 15.59
- Fog = 0.4·(W/S + 100·complex/W)
- SMOG = 1.0430·√(poly·30/S) + 3.1291
- Coleman–Liau = 0.0588·L − 0.296·S100 − 15.8 (letters and sentences per 100 words)
- ARI = 4.71·(chars/W) + 0.5·(W/S) − 21.43

Gunning "complex" means 3 or more syllables, excluding:
- proper nouns (capitalised words that aren't first in the sentence) and ALL-CAPS words
- hyphenated words where no single part has 3 syllables
- words that reach 3 syllables only through -es, -ed or -ing (SMOG counts every word of 3+ syllables)

## Heuristics
- **Sentences.** Blank lines and lines with no letters (`---`, `* * *`) separate paragraphs.
  - A line break ends a sentence after a list item, before a list item (`-`, `*`, `•`, `1.`, `a)`, `iv.`, `#`), and after a heading. A heading is a line of 10 words or fewer, with no end punctuation, followed by a line that starts with a capital. Any other line break is soft wrapping. Bullet markers are left out of sentence spans; Windows line endings (CRLF) are handled.
  - The splitter acts on `. ! ? … ... ।` plus any closing quotes or brackets, and only when whitespace follows. That protects decimals, currency, URLs, emails and `U.S.A`.
  - `!` and `?` end a sentence unless the next word is lower case. `"Why?" she asked.` stays as one sentence.
  - Abbreviations fall into three classes:
    - Never a sentence end: Mr, Dr, Prof, St, Smt, Shri, e.g., i.e., vs., approx.
    - Not an end before a number: No., Fig., Rs., Jan. 5
    - Can end a sentence (etc., Inc., Ltd., a.m., U.S., single initials such as J. K.): it ends one only when the next word is capitalised and is a common sentence opener (The, It, We…). `etc`, `a.m`, `p.m`, `Ltd` and `Inc` end one before any capital.
- **Syllables.** Rules first, then about 270 dictionary exceptions (people, business, area, idea…). Inflected forms (-s, -es, -d, -ed, -ing, -ly) of an exception are derived from it.
  - Rules: silent final e; syllabic -le; -es and -ed only count after a sibilant or after t/d; y is a consonant at the start of a word and between vowels; qu; two-vowel splits such as ia, io, ua, ue, ui, eo, ium, eum, iet and ien(t/c), with the usual exceptions (-tion, -cial, -llion, -geon); -ing after a vowel; -ier/-iest; -ism/-thm; silent e inside words (statement, lovely, sometimes); and the prefixes re-, co-, pre-, de- and cre- before a vowel.
  - Numbers are estimated as spoken: `2026` is "twenty twenty-six", 5 syllables; `1.67` is 5; the most any number gets is 6. Contractions: `couldn't` = 2, `don't` = 1.
  - Acronyms are spelled out (HTML = 4) unless they can be said as a word (NASA = 2). Non-Latin words (Devanagari and others) count as words of 1 syllable and are never complex.
  - Test results on 227 common words: 100% with the dictionary and 95.6% with rules only.
- **Passive voice.** A form of *be* (including contractions), then up to two adverbs or "not/never/being/been", then a participle. The participle can be regular (-ed, minus a not-a-participle list: red, need, hundred, naked…) or one of about 185 irregular forms. Up to two auxiliaries before it are included (*shall be determined*, *has been reported*).
- **Plain English.** About 160 bureaucratic words and phrases with simpler alternatives, matched against inflections too (utilized → use, in order to → to).
  - The filler and hedge list skips literal uses: *what kind of*, *rather than*, *just as*.
  - Adverbs are -ly words minus a stoplist (only, family, early, friendly…).
- **Sentence difficulty.** The 0–100 score adds up five parts:
  - length: up to 40, full at 35 words
  - share of complex words: up to 25, scaled down for sentences under 12 words
  - passive voice: 10 per instance, up to 15
  - clauses (commas count 1; ; : ( — count 2): up to 15
  - Plain-English hits: up to 10

**Performance:** about 30–50 ms for 20,000 words in Node 24 (syllable counts are cached).
