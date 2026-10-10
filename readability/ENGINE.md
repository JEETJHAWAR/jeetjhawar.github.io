# Readable engine (`engine.js`) — v3.0.0

A plain script with no dependencies. In the browser it sets `window.Readable`; in Node, `require('./engine.js')` returns it. Tests: `node readability/engine.test.js` (also prints the calibration-corpus table). Everything, including the ~5,100-lemma familiar-word list, lives in `engine.js`; no other file needs to load first.

## API
`Readable.analyze(text) → Result | null`. It returns `null` when no sentence contains a prose letter: empty text, whitespace, emoji only, numbers only, or only code/URLs. `Readable.version` is `'3.0.0'`.

All v2 fields keep their names and meaning. v3 adds fields (marked **new**) and changes three behaviours (marked **changed**).

- **stats**: `words, sentences, paragraphs, characters` (code points, line breaks excluded), `syllables, complexWords` (Gunning), `longWords` (7+ letters), `readingTimeSec` (238 wpm), `speakingTimeSec` (150 wpm), `avgWordsPerSentence, avgSyllablesPerWord`.
  - **new** `unfamiliarWords`: a count of words that are not on the familiar list (names, acronyms and numbers never count).
  - Counts cover the whole text. Code, URLs, emails and file paths are not words.
- **scores**:
  - `fleschReadingEase` is clamped to 0–100. `fleschKincaidGrade, gunningFog, smog, colemanLiau, ari` are grades, 0 or above. `consensusGrade` is the trimmed mean of those five (drop highest and lowest, average the middle three).
  - **new** `daleChall`: a Dale–Chall-style raw score, `0.1579 × unfamiliar% + 0.0496 × words-per-sentence (+ 3.6365 if unfamiliar% > 5)`. It uses Readable's familiar list rather than the original 3,000-word list.
  - **new** `consensusEase` (0–100): `consensusGrade` mapped onto the reading-ease scale.
  - **changed** `label`, `letter` and `audience` are all derived from `consensusEase`, so they always agree with each other and with `consensusGrade`. Bands: A ≥ 70, B ≥ 60, C ≥ 50, D ≥ 40, E ≥ 30, F below. Grade 7 ≈ 70, grade 9 ≈ 60, grade 12 ≈ 50, grade 14 ≈ 40, grade 16 ≈ 30. If a UI wants the gauge to agree with the letter, it should show `consensusEase`.
- **new** `confidence: { level: 'low' | 'medium' | 'high', note }`.
  - `low`: under 60 words or under 3 body sentences ("Short text — scores are a rough guide.").
  - `medium`: under 100 words or under 5 body sentences, or mostly a list.
  - `high`: otherwise.
- **new** `textType`: `'prose' | 'list' | 'dialogue' | 'mixed' | 'technical'`.
  - `technical`: code fences, two or more code spans, or more than 8% code characters. Plain links and URLs do not make a text technical.
  - `list`: at least half the sentences are list items.
  - `dialogue`: at least 30% of sentences contain quotes.
  - `mixed`: at least 20% list items.
- **new** `summary`: one or two plain sentences naming the main problem, e.g. "Mostly clear. Two long sentences drag the score down — split them." or "Hard going in places. No single sentence is the problem — long words like “approximately” and “postgraduate” add up; use shorter ones where you can."
- **sentences[]**: `index, start, end` (offsets into the original string, end exclusive), `paragraph, words, syllables, complexWords, grade` (Flesch–Kincaid for that sentence), `difficulty` (0–100), `level` (`easy` below 25, `ok` below 45, `hard` below 65, otherwise `very-hard`), `reasons[]`, `rank` (1–5 or `null`).
  - **new** `flagged`: `true` when the level is `hard` or `very-hard`, the sentence has 4 or more words, and it is not a heading.
  - **new** `tip`: one concrete next step, or `null` when an easy sentence needs nothing.
- **hardest[]** **changed**: only flagged sentences, sorted by difficulty, then grade, then position. It holds up to five and **may be empty**. These are the same objects as in `sentences`.
- **new** `hardestNote`: "No sentence here is hard to read." / "Only one sentence stands out." / "Only two sentences stand out." / "Three of 5 sentences are hard to read." / "All 4 sentences are hard to read." / "7 sentences are hard to read — these are the 5 hardest."
- **issues[]**: `{type, start, end, text, message, suggestion}`, sorted by `start`. The types are unchanged: `passive | complex-word | filler | adverb | repeated-word | long-sentence` (25 or more words) `| very-long-sentence` (40 or more).
  - **changed**: `suggestion` for `complex-word` is inflected to fit the text (utilized → "used"). A few spans now include an article or verb so that the suggestion is a drop-in: "an optimal" → "the best", "very important" → "crucial", "said quietly" → "whispered".
- **paragraphs[]**: `{index, start, end, words, fleschReadingEase}`.
- **wordFrequency[]**: the top 10 `{word, count}`, leaving out stopwords and numbers.

## Pipeline
1. **Mask.** `buildMask` makes a same-length "clean" copy of the text. Everything after this step reads the clean copy; every offset still points into the original.
   - These become placeholders: fenced code blocks, inline code, markdown link targets and images, HTML tags, URLs, `localhost:3000`, IPs, emails, bare domains, file paths (`app/page.js`, `C:\…`), file names (`package.json`, but not `Node.js`), camelCase/snake_case identifiers, `fn()`, `--flags`, `key=value`, `console.log` and shell commands (`npm run dev`, `git clone …`).
   - Masked text is never a word, a syllable or a clause, and its dots never end a sentence.
2. **Segment.** The text is split into paragraphs, then into segments, then into sentences. Each sentence gets a role: `heading`, `list` or `prose`.
   - A line break ends a sentence at a list item (`-`, `*`, `•`, numbers, letters, roman numerals, emoji or ✓ bullets, markdown table rows), at `#` headings, at short title-like lines, at greetings and sign-offs ("Hi Ravi,", "Regards,"), after a label ending in `:`, and after short chat-style lines ("party starts at 8").
   - Splitting acts on `. ! ? … ।` followed by whitespace. There are three abbreviation classes:
     - Never an end: Mr, Dr, Prof, St, Smt, Shri, Hon'ble, Adv, e.g., i.e., vs.
     - Not an end before a number: No., Fig., Rs., Jan.
     - An end only before a sentence opener: etc., Inc., Ltd., a.m., U.S., B.Tech., Ph.D., single initials.
3. **Words.** Each word gets syllables (rules plus a dictionary; 100% on the 227-word test list, 95.6% from rules alone), familiarity, Gunning complexity, and the issue checks.
4. **Document formulas.** The five formulas and Dale–Chall run on **body** sentences. Headings are left out, and so are fragments of 3 words or fewer when they are list items, greetings or sign-offs, or lack end punctuation. If nothing is left, every sentence is used. Numbers, names and acronyms cost at most 2 syllables ("₹1,200", "UPI", "Malhotra"), so they never count as polysyllables.

## Familiarity
- `FAMILIAR` holds about 5,100 everyday lemmas: function words, common nouns, verbs and adjectives, school, work, money and tech words, and Indian-English words (lakh, crore, rupee, UPI, GST, college, exam, semester, hostel, canteen, chai, rickshaw…).
- A word is also familiar if it is an inflection of a listed word (-s, -ed, -ing, -er, -est, -ly, doubled consonants), a transparent derivation (-ness, -ment, -ation, -ion, -ity, -ence, -ance, -er, -ist, -al, -ive, -ous, -able, -ify, -ability…), carries a prefix (un-, re-, dis-, pre-, inter-…), or is a compound of two listed words.
  - So "electricity", "considerations" and "statistically" are familiar, while "heterogeneous", "asymmetries" and "notwithstanding" are not.
- Names (capitalised words after the first, and a capitalised first word that looks like a name), acronyms, numbers and dotted abbreviations are never unfamiliar, complex or long.
- A **hard word** is unfamiliar **and** long: 3 or more syllables, or 9 or more letters. Only hard words are listed in reasons.

## Sentence difficulty (0–100)
It is the sum of these parts, capped at 100:

| Part | Points |
|---|---|
| Length | 40 × (words − 10) / 25, from 0 to 40 |
| Hard words | 30 × (1 − e^(−count/2)) |
| Passive voice | 10 each, up to 15 |
| Clauses | 15 × clauses / 6, up to 15 (`, ` = 1, `; ` = 2, `: ` `(` `—` = 1; commas in numbers, times and URLs don't count) |
| Plain-English hits | 10 × hits / 2, up to 10 |
| Nominalisations | 5 each, up to 10 |
| Noun stacks | 5 each, up to 8 |
| Long lead-in | 5 |

Every part uses counts, not ratios. That makes the score monotonic: adding words, jargon, a passive or a noun stack never lowers it, and the tests check this.

## Reasons and tips (specific, never a template)
- **Length**: "34 words — split after “months”, where a new idea starts".
  - The split point is a semicolon, ", and/but/so/yet + subject", ", which" (→ "This …"), ", many of which" (→ "Many of them …"), ", because" (→ "This is because …"), ", although/whereas/while" (→ "However, …"), ", saying/adding/noting that" (→ "It said that …"), or ", we/they …".
  - Splits are never placed after a lead-in clause, inside a parenthetical (", although easing,"), or inside a list.
  - Very long sentences may get a "soft" comma split. Without any split: "N words with no natural break — say it as two sentences".
- **Unfamiliar**: "3 unfamiliar words: heterogeneous, asymmetries, idiosyncratic". Words already covered by a Plain-English reason are not repeated.
- **Passive**: "Passive: “shall be retained” — who retains them?". The tense and the pronoun come from the sentence.
  - With a "by" agent: "Passive: “was written by Sam” — start with “Sam”".
  - The tip gives a full active rewrite when the subject is simple: "Make it active: “The board shall determine the fee in due course.”" Dummy "it" is handled: "It has been decided by the Ministry that …" → "The Ministry has decided that …".
  - Stative participles are not passive: "is called", "is located in", "is spread over", "was tired", "is interested in".
- **Plain English**: "“in order to” → “to”".
- **Nominalisation**: "Nominalisation: investigation → investigate". It is flagged only after a light verb ("conduct an investigation") or in "the X of".
- **Stacked nouns**: "Stacked nouns: “monetary policy transmission”". This means 3 or more nouns or adjectives in a row with at least two abstract nouns, or 4 or more with one. The tip unpacks it ("transmission of monetary policy").
- **Lead-in**: "Starts with a 9-word lead-in before the main point". This fires when the opener is a preposition, subordinator or participle and 8 or more words come before the first comma.
- **Clauses** (under 25 words): "Strings 5 clauses together — end the first after “x”".
- **`tip`** picks the biggest contributor that has a concrete fix: a split with the next sentence previewed, an active rewrite, word swaps, a verb for the nominalisation, an unpacked noun stack, or "lead with the main point".

## Word-level checks
- **Plain English**: 168 entries, each tagged with a part of speech and context rules so every suggestion is a valid drop-in.
  - Verbs are inflected (utilized → used, has obtained → got, were notified → told).
  - a/an is fixed ("an appreciable" → "a large").
  - Rules skip noun uses ("a permit", "proof of purchase"), -ed adjectives and reduced relatives ("the allocated budget", "data obtained from"), passives that would read badly ("can be got"), and idioms ("orders of magnitude", "since inception", "cease to", "at the earliest opportunity").
  - Risky pairs were removed: "in relation to", "in respect of", "irrespective of", "implement", "designate", "sufficiently", "accomplish", "thereby".
  - A test runs every entry through base, -s and -ed frames and checks the output is real English.
- **Filler and hedges**: as before. Padding phrases ("it should be noted that", "hereby") get "cut it". "very/really/so + adjective" → one strong word ("very important" → "crucial").
- **Adverbs**: only weak intensifiers (extremely, absolutely, definitely, highly, completely, totally…) and -ly manner adverbs next to a weak verb ("said quietly" → "whispered"). Domain adverbs (statistically, financially, annually) are never flagged.

## Calibration
The test file holds 26 passages written for this purpose, each with expected bands for letter, grade, the number of hardest sentences, text type and confidence:

- children's story, tabloid, broadsheet, RBI-style circular, legal T&C, academic abstract
- landing page, cold email, WhatsApp chat, school essay, Wikipedia-style intro, recipe
- bullet list, README, poem line, government notice, jargon email, medicine leaflet
- dialogue, philosophy, support reply, job post, markdown blog, Indian-English email, science explainer, policy brief

They also check that label, letter, audience and consensus agree, that the summary matches the hardest list, that no tip repeats across hard sentences, and that no reason or tip contains broken text.

**Performance:** about 80–100 ms for 20,000 varied words in Node 24 on a cold run (the test limit is 150 ms). Syllables, familiarity, lemma lookups and dictionary hits are cached.
