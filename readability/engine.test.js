/* Tests for engine.js — run with: node readability/engine.test.js */
'use strict';
const assert = require('assert');
const path = require('path');
const R = require(path.join(__dirname, 'engine.js'));

let passed = 0, failed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) { failed++; failures.push(name + '\n    ' + (e && e.message ? e.message.split('\n').join('\n    ') : e)); }
}
const texts = (r) => r.sentences.map((s) => s.text);

/* ------------------------------------------------------------------ */
/* 1. Syllable accuracy on common English words (dictionary counts)    */
/* ------------------------------------------------------------------ */
const SYL_LIST = {
  1: 'the cat dog house make time strength through thought cheese schools played jumped called cakes smile ' +
     'bridge judge worked knife hope change large while sure there where whole once done scheme tried breathe ' +
     'squeezed fire hour eye queue one give have love were friend light laughed piece guide built which write ' +
     'known used based tongue league',
  2: 'table little people simple apple wanted needed places changes wishes boxes being going doing flying ' +
     'playing player lawyer beyond business water happy money garden music paper river open letter morning ' +
     'children problem mountain science quiet lion poem naive create diet fluid ruin cruel client giant lovely ' +
     'careful statement sometimes something someone homework useful freedom agreed receive believe coffee ' +
     'castle bottle title single purple honest picture question nation special ocean ancient patient million ' +
     'region senior onion measure guitar minute button purchase dozen rhythm chaos poet react ' +
     'prism ninety safety',
  3: 'area idea family beautiful realize different banana potato tomorrow important together remember already ' +
     'another animal radio video piano period serious various obvious curious usual actual gradual champion ' +
     'museum premium influence genuine opinion happier easier easiest management government extremely however ' +
     'whatever everyone violin library energy holiday president industry character possible terrible article ' +
     'example vehicle',
  4: 'education information situation available especially actually usually experience january category ' +
     'biology society variety definitely community celebration',
  5: 'university opportunity imagination organization vocabulary international refrigerator individual ' +
     'personality electricity unbelievable anniversary',
  6: 'responsibility identification'
};
const sylPairs = [];
for (const [n, words] of Object.entries(SYL_LIST)) words.split(/\s+/).forEach((w) => sylPairs.push([w, +n]));
let sylOk = 0;
const sylMiss = [];
for (const [w, n] of sylPairs) {
  const got = R._syllables(w);
  if (got === n) sylOk++; else sylMiss.push(`${w} (want ${n}, got ${got})`);
}
const sylAcc = (100 * sylOk) / sylPairs.length;
// Honesty check: the same list with the exception dictionary switched off (pure rules).
const rulesOk = sylPairs.filter(([w, n]) => R._syllablesRulesOnly(w) === n).length;
const rulesAcc = (100 * rulesOk) / sylPairs.length;
test(`syllable accuracy >= 93% on ${sylPairs.length} words`, () => assert.ok(sylAcc >= 93, `only ${sylAcc.toFixed(1)}%`));

test('syllables: numbers, contractions, hyphens, acronyms', () => {
  assert.strictEqual(R._syllables('2026'), 5);        // twenty twenty-six
  assert.strictEqual(R._syllables('1.67'), 5);        // one point six se-ven
  assert.strictEqual(R._syllables('7'), 2);           // seven
  assert.strictEqual(R._syllables("couldn't"), 2);
  assert.strictEqual(R._syllables('don’t'), 1);
  assert.strictEqual(R._syllables("it's"), 1);
  assert.strictEqual(R._syllables('well-known'), 2);
  assert.strictEqual(R._syllables('U.S'), 2);
  assert.strictEqual(R._syllables('HTML'), 4);
  assert.strictEqual(R._syllables('NASA'), 2);
  assert.strictEqual(R._syllables('naïve'), 2);
  assert.strictEqual(R._syllables('tables'), 2);
  assert.strictEqual(R._syllables('handled'), 2);
  assert.strictEqual(R._syllables('created'), 3);
  assert.strictEqual(R._syllables('ideas'), 3);
});

/* ------------------------------------------------------------------ */
/* 2. Sentence splitting                                               */
/* ------------------------------------------------------------------ */
const SPLIT_CASES = [
  ['Mr. Smith went to Washington. He arrived late.', ['Mr. Smith went to Washington.', 'He arrived late.']],
  ["Mrs. Gupta and Dr. Rao met Prof. Iyer at St. Xavier's College.", null],
  ['We compared apples vs. oranges. Then we left.', ['We compared apples vs. oranges.', 'Then we left.']],
  ['Bring pens, paper, etc. and a ruler.', null],
  ['Bring pens, paper, etc. Then sit down.', ['Bring pens, paper, etc.', 'Then sit down.']],
  ['Use a fruit, e.g. Mango or apple. It helps.', ['Use a fruit, e.g. Mango or apple.', 'It helps.']],
  ['Use plain words, i.e. short ones.', null],
  ['He woke at 6 a.m. The sun was up.', ['He woke at 6 a.m.', 'The sun was up.']],
  ['Meet me at 5 p.m. tomorrow.', null],
  ['She works at Acme Inc. and loves it.', null],
  ['Infosys Ltd. The company grew.', ['Infosys Ltd.', 'The company grew.']],
  ['The deal closed on Jan. 5 last year.', null],
  ['He moved to the U.S. last year.', null],
  ['He moved to the U.S. The weather was cold.', ['He moved to the U.S.', 'The weather was cold.']],
  ['The U.K. and India signed a deal.', null],
  ['The novel is by J. K. Rowling. It sold well.', ['The novel is by J. K. Rowling.', 'It sold well.']],
  ['Tickets cost ₹1.67 lakh in total. Growth was 3.5% this year. A pen costs $2.50 now.',
    ['Tickets cost ₹1.67 lakh in total.', 'Growth was 3.5% this year.', 'A pen costs $2.50 now.']],
  ['I waited... and waited. Then it rang.', ['I waited... and waited.', 'Then it rang.']],
  ['I waited... Then it rang.', ['I waited...', 'Then it rang.']],
  ['He paused… then spoke.', null],
  ['"Stop!" he shouted. Nobody moved.', ['"Stop!" he shouted.', 'Nobody moved.']],
  ['“Stop!” He ran away.', ['“Stop!”', 'He ran away.']],
  ['Really?! That is wild.', ['Really?!', 'That is wild.']],
  ['Wait!! What happened?', ['Wait!!', 'What happened?']],
  ['She said, "Go home." Then she left.', ['She said, "Go home."', 'Then she left.']],
  ['See the notes (they are short.) Next, read the book.', ['See the notes (they are short.)', 'Next, read the book.']],
  ['Visit https://example.com/a.b?c=d for more. Then email me at jeet.j@example.co.in today.',
    ['Visit https://example.com/a.b?c=d for more.', 'Then email me at jeet.j@example.co.in today.']],
  ['Go to www.example.com. It is free.', ['Go to www.example.com.', 'It is free.']],
  ['Write to hello@readable.app. We reply fast.', ['Write to hello@readable.app.', 'We reply fast.']],
  ['Things to bring:\n- A notebook\n- Two pens\n1. Read the brief\n2. Write the summary',
    ['Things to bring:', 'A notebook', 'Two pens', 'Read the brief', 'Write the summary']],
  ['Steps:\n1) Open it\n2) Close it', ['Steps:', 'Open it', 'Close it']],
  ['• First point here\n• Second point here', ['First point here', 'Second point here']],
  ['Introduction\nThis report covers sales. It is short.', ['Introduction', 'This report covers sales.', 'It is short.']],
  ['## Results\nSales grew fast.', ['Results', 'Sales grew fast.']],
  ['First paragraph without a stop\n\nSecond paragraph here.', ['First paragraph without a stop', 'Second paragraph here.']],
  ['This sentence is wrapped across\ntwo lines in the source. Next one.',
    ['This sentence is wrapped across\ntwo lines in the source.', 'Next one.']],
  ['Line one is here.\r\nLine two is here.\r\n\r\nNew para.', ['Line one is here.', 'Line two is here.', 'New para.']],
  ['Smt. Sharma paid Rs. 500 to Shri Verma. The Pvt. Ltd. company agreed.',
    ['Smt. Sharma paid Rs. 500 to Shri Verma.', 'The Pvt. Ltd. company agreed.']],
  ['यह एक वाक्य है। This is English.', ['यह एक वाक्य है।', 'This is English.']],
  ['No. 10 is the house. Fig. 3 shows it.', ['No. 10 is the house.', 'Fig. 3 shows it.']],
  ['The answer is no. We move on.', ['The answer is no.', 'We move on.']],
  ['He holds a Ph.D. in physics.', null],
  ['Our fest SEQUEL 26 sold 150+ passes, i.e. ₹1.67 lakh. The team at IIM K. was thrilled!',
    ['Our fest SEQUEL 26 sold 150+ passes, i.e. ₹1.67 lakh.', 'The team at IIM K. was thrilled!']]
];
SPLIT_CASES.forEach(([input, want], i) => {
  test(`split #${i + 1}: ${JSON.stringify(input).slice(0, 50)}`, () => {
    const r = R.analyze(input);
    assert.ok(r, 'analyze returned null');
    assert.deepStrictEqual(texts(r), want || [input]);
    r.sentences.forEach((s) => assert.strictEqual(input.slice(s.start, s.end), s.text));
  });
});

test('CRLF paragraphs counted', () => {
  const r = R.analyze('Line one is here.\r\nLine two is here.\r\n\r\nNew para.');
  assert.strictEqual(r.stats.paragraphs, 2);
  assert.deepStrictEqual(r.sentences.map((s) => s.paragraph), [0, 0, 1]);
});

/* ------------------------------------------------------------------ */
/* 3. Offsets round-trip on a long mixed sample                        */
/* ------------------------------------------------------------------ */
const MIXED = [
  '# Readable report\r\n',
  'Dr. A. P. J. Abdul Kalam visited IIM K. on Jan. 5, 2026 at 10 a.m. He spoke for 45 min. and took ',
  'questions — lots of them!! Was it worth it?! Absolutely… The fee was ₹1,50,000 (approx. $1.8k), i.e. cheap.\r\n\r\n',
  'Key points:\n- Utilize the template in order to commence work.\n- The the form shall be submitted prior to Friday\n',
  '  and must be signed.\n* Contact hello@readable.app or visit https://jeetjhawar.github.io/readability/?x=1.\n\n',
  'नमस्ते दुनिया। Mixed Hindi text works too 😀. Emoji 🎉 do not break offsets — “quotes” and ‘apostrophes’ don’t either.\n',
  '\n\n   Indented paragraph with trailing spaces.   \n\n',
  'The aforementioned reimbursement, notwithstanding any subsequent modification, was approximately determined ',
  'by the committee, which, having facilitated the deliberations, subsequently ascertained the outcome. ',
  'Because the team kept adding more and more steps to the process without ever stopping to ask whether each one ',
  'was needed, the whole thing became slow and hard to follow for everyone.'
].join('');
test('offset round-trip: sentences, issues, paragraphs', () => {
  const r = R.analyze(MIXED);
  assert.ok(r && r.sentences.length >= 12, 'expected many sentences, got ' + (r && r.sentences.length));
  let prevEnd = -1;
  r.sentences.forEach((s, i) => {
    assert.strictEqual(MIXED.slice(s.start, s.end), s.text, 'sentence ' + i);
    assert.strictEqual(s.index, i);
    assert.ok(s.start >= prevEnd, 'sentences must not overlap');
    assert.strictEqual(s.text, s.text.trim());
    prevEnd = s.end;
  });
  r.issues.forEach((it) => assert.strictEqual(MIXED.slice(it.start, it.end), it.text, it.type));
  r.paragraphs.forEach((p) => {
    assert.ok(p.end > p.start);
    assert.strictEqual(MIXED.slice(p.start, p.end), MIXED.slice(p.start, p.end).trim());
  });
  const types = new Set(r.issues.map((i) => i.type));
  ['passive', 'complex-word', 'repeated-word', 'adverb', 'long-sentence'].forEach((t) => assert.ok(types.has(t), 'missing issue type ' + t));
});

/* ------------------------------------------------------------------ */
/* 4. Formulas                                                         */
/* ------------------------------------------------------------------ */
const LEGAL = 'Notwithstanding any provision of this Agreement to the contrary, the indemnifying party shall, ' +
  'upon receipt of written notification from the indemnified party, assume the defence of any claim, action, or ' +
  'proceeding arising out of or relating to the performance of the obligations hereunder, including the ' +
  "reimbursement of reasonable attorneys' fees and expenses incurred in connection therewith, subject to the " +
  'limitations of liability set forth in Section 12 of this Agreement.';
test('formula: "The cat sat on the mat." is very easy', () => {
  const r = R.analyze('The cat sat on the mat.');
  assert.ok(r.scores.fleschReadingEase > 90, r.scores.fleschReadingEase);
  assert.strictEqual(r.scores.label, 'Very easy');
  assert.strictEqual(r.scores.letter, 'A');
  assert.strictEqual(r.stats.words, 6);
  assert.strictEqual(r.stats.syllables, 6);
});
test('formula: dense legal paragraph is very difficult', () => {
  const r = R.analyze(LEGAL);
  assert.ok(r.scores.fleschReadingEase < 30, r.scores.fleschReadingEase);
  assert.strictEqual(r.scores.letter, 'F');
  assert.ok(r.scores.consensusGrade > 16, 'grade ' + r.scores.consensusGrade);
  assert.ok(r.sentences[0].level === 'very-hard');
});
test('formula: published constants reproduce from stats', () => {
  const r = R.analyze('The quick brown fox jumps over the lazy dog. Readability formulas estimate difficulty.');
  const { words: W, sentences: S, syllables: SY } = r.stats;
  const fre = 206.835 - 1.015 * (W / S) - 84.6 * (SY / W);
  const fk = 0.39 * (W / S) + 11.8 * (SY / W) - 15.59;
  const fog = 0.4 * (W / S + 100 * r.stats.complexWords / W);
  assert.strictEqual(r.scores.fleschReadingEase, Math.round(Math.max(0, Math.min(100, fre)) * 10) / 10);
  assert.strictEqual(r.scores.fleschKincaidGrade, Math.round(Math.max(0, fk) * 10) / 10);
  assert.strictEqual(r.scores.gunningFog, Math.round(fog * 10) / 10);
  const g = [r.scores.fleschKincaidGrade, r.scores.gunningFog, r.scores.smog, r.scores.colemanLiau, r.scores.ari].sort((a, b) => a - b);
  assert.ok(r.scores.consensusGrade >= g[1] - 0.1 && r.scores.consensusGrade <= g[3] + 0.1);
});
test('formula: Gunning complex words skip proper nouns and -ed/-es/-ing', () => {
  const r = R.analyze('Yesterday Alexandria completed the creating of promises. Everybody understood the elephant.');
  // complex: yesterday (sentence-initial, 3 syl), everybody, understood? (un-der-stood 3), elephant
  // not complex: Alexandria (proper), completed/creating/promises (inflection)
  assert.strictEqual(r.stats.complexWords, 4);
});
test('stats: times, averages, long words, word frequency', () => {
  const r = R.analyze('Readable checks readable text. Readable text is easier to read.');
  assert.strictEqual(r.stats.words, 10);
  assert.strictEqual(r.stats.readingTimeSec, Math.round(10 / 238 * 60));
  assert.strictEqual(r.stats.speakingTimeSec, Math.round(10 / 150 * 60));
  assert.strictEqual(r.stats.avgWordsPerSentence, 5);
  assert.strictEqual(r.stats.longWords, 3);
  assert.deepStrictEqual(r.wordFrequency[0], { word: 'readable', count: 3 });
  assert.ok(r.wordFrequency.every((f) => !['is', 'to'].includes(f.word)));
});

/* ------------------------------------------------------------------ */
/* 5. Passive voice                                                    */
/* ------------------------------------------------------------------ */
const PASSIVE_YES = [
  ['The report was written by Sam.', 'was written'],
  ['Mistakes were made.', 'were made'],
  ['The fee shall be determined later.', 'shall be determined'],
  ['The house is being built.', 'is being built'],
  ['It has been widely reported.', 'has been widely reported'],
  ['The results were not published.', 'were not published'],
  ['The company is run by her.', 'is run'],
  ["The forms weren't signed.", "weren't signed"],
  ['Your seat is reserved.', 'is reserved']
];
const PASSIVE_NO = [
  'The car was red.', 'There is need for care.', 'He was happy.', 'They were at home.', 'She is a teacher.',
  'He is indeed right.', 'The sky is blue.', 'I am going home.', 'It was a hundred rupees.', 'The bed is soft.'
];
PASSIVE_YES.forEach(([s, phrase]) => test('passive yes: ' + s, () => {
  const p = R.analyze(s).issues.filter((i) => i.type === 'passive');
  assert.strictEqual(p.length, 1, 'found ' + p.length);
  assert.strictEqual(p[0].text, phrase);
}));
PASSIVE_NO.forEach((s) => test('passive no: ' + s, () => {
  const p = R.analyze(s).issues.filter((i) => i.type === 'passive');
  assert.strictEqual(p.length, 0, 'flagged ' + (p[0] && p[0].text));
}));
test('passive reason text', () => {
  const s = R.analyze('The fee shall be determined by the board in due course.').sentences[0];
  assert.ok(s.reasons.some((r) => r === 'Passive voice: “shall be determined”'), s.reasons.join(' | '));
});

/* ------------------------------------------------------------------ */
/* 6. Word-level issues                                                */
/* ------------------------------------------------------------------ */
test('complex words get plain alternatives (incl. phrases and inflections)', () => {
  const r = R.analyze('We utilized the funds in order to commence work prior to the deadline.');
  const cw = r.issues.filter((i) => i.type === 'complex-word');
  assert.deepStrictEqual(cw.map((i) => [i.text, i.suggestion]),
    [['utilized', 'use'], ['in order to', 'to'], ['commence', 'start'], ['prior to', 'before']]);
});
test('filler, adverbs and repeated words', () => {
  const r = R.analyze('It is really very quickly done, and the the team basically agreed. What kind of car? Only early.');
  const by = (t) => r.issues.filter((i) => i.type === t).map((i) => i.text);
  assert.deepStrictEqual(by('filler'), ['really', 'very', 'basically']);
  assert.deepStrictEqual(by('adverb'), ['quickly']);
  assert.deepStrictEqual(by('repeated-word'), ['the the']);
});
test('long and very long sentence issues', () => {
  const long = Array.from({ length: 30 }, (_, i) => 'word' + 'abcdefghijklmnopqrstuvwxyz'[i % 26]).join(' ') + '.';
  const vlong = Array.from({ length: 45 }, () => 'cat').join(' ') + '.';
  assert.strictEqual(R.analyze(long).issues.filter((i) => i.type === 'long-sentence').length, 1);
  assert.strictEqual(R.analyze(vlong).issues.filter((i) => i.type === 'very-long-sentence').length, 1);
});

/* ------------------------------------------------------------------ */
/* 7. Hardest five                                                     */
/* ------------------------------------------------------------------ */
test('hardest-5 ordering and ranks', () => {
  const easy = 'I ran. We sat down here. The dog is big.';
  const hard = [
    'The committee, having considered the evidence, decided to postpone the decision until further information was gathered.',
    'Notwithstanding the aforementioned considerations, the organisation shall endeavour to facilitate the implementation of the recommendations.',
    'It is short but okay.',
    'Considerable uncertainty regarding the methodology, the assumptions, and the interpretation of results was expressed by several independent reviewers.',
    'Because the weather was bad, we stayed inside and played some games together.',
    'The extraordinarily complicated administrative procedures, which were introduced without consultation, have been universally criticised by practitioners, academics, and representatives of civil society organisations.',
    'Ok go.'
  ].join(' ');
  const r = R.analyze(easy + ' ' + hard);
  assert.strictEqual(r.hardest.length, 5);
  r.hardest.forEach((s, i) => {
    assert.strictEqual(s.rank, i + 1);
    assert.ok(s.words >= 4);
    assert.strictEqual(r.sentences[s.index], s, 'hardest entries are the sentence objects');
    if (i) {
      const p = r.hardest[i - 1];
      assert.ok(p.difficulty > s.difficulty || (p.difficulty === s.difficulty && p.grade >= s.grade));
    }
  });
  assert.ok(r.hardest[0].text.startsWith('The extraordinarily'), r.hardest[0].text);
  assert.strictEqual(r.sentences.filter((s) => s.rank !== null).length, 5);
  assert.ok(r.sentences.filter((s) => s.words < 4).every((s) => s.rank === null));
  const max = Math.max(...r.sentences.filter((s) => s.words >= 4).map((s) => s.difficulty));
  assert.strictEqual(r.hardest[0].difficulty, max);
  r.sentences.forEach((s) => {
    assert.ok(s.difficulty >= 0 && s.difficulty <= 100);
    assert.ok(['easy', 'ok', 'hard', 'very-hard'].includes(s.level));
    assert.ok(Array.isArray(s.reasons));
  });
});

/* ------------------------------------------------------------------ */
/* 8. Robustness                                                       */
/* ------------------------------------------------------------------ */
test('null for empty / whitespace / no letters', () => {
  [ '', '   \n\t ', '😀😀 🎉', '12345 678.', '---\n***', null, undefined ].forEach((t) =>
    assert.strictEqual(R.analyze(t), null, JSON.stringify(t)));
});
test('single word without punctuation', () => {
  const r = R.analyze('hello');
  assert.strictEqual(r.stats.words, 1);
  assert.strictEqual(r.stats.sentences, 1);
  assert.strictEqual(r.sentences[0].text, 'hello');
  assert.strictEqual(r.hardest.length, 0);
});
test('Hindi / Devanagari and emoji do not crash', () => {
  const t = 'मेरा नाम जीत है। मैं IIM कोझिकोड में पढ़ता हूँ 😀. This line is English.';
  const r = R.analyze(t);
  assert.ok(r && r.stats.words > 5);
  assert.ok(Number.isFinite(r.scores.fleschReadingEase));
  r.sentences.forEach((s) => assert.strictEqual(t.slice(s.start, s.end), s.text));
});
test('all score fields are finite and in range', () => {
  ['Hi.', 'a b c d e f g h i j k l m n o p', MIXED, LEGAL, 'Supercalifragilisticexpialidocious.'].forEach((t) => {
    const r = R.analyze(t);
    const s = r.scores;
    ['fleschReadingEase', 'fleschKincaidGrade', 'gunningFog', 'smog', 'colemanLiau', 'ari', 'consensusGrade']
      .forEach((k) => assert.ok(Number.isFinite(s[k]) && s[k] >= 0, k + '=' + s[k]));
    assert.ok(s.fleschReadingEase <= 100);
    assert.ok(/^[A-F]$/.test(s.letter) && s.label && s.audience);
  });
});
test('API shape', () => {
  const r = R.analyze(MIXED);
  assert.strictEqual(typeof R.version, 'string');
  assert.deepStrictEqual(Object.keys(r).sort(), ['hardest', 'issues', 'paragraphs', 'scores', 'sentences', 'stats', 'wordFrequency']);
  assert.deepStrictEqual(Object.keys(r.stats).sort(), ['avgSyllablesPerWord', 'avgWordsPerSentence', 'characters', 'complexWords',
    'longWords', 'paragraphs', 'readingTimeSec', 'sentences', 'speakingTimeSec', 'syllables', 'words'].sort());
  assert.deepStrictEqual(Object.keys(r.sentences[0]).sort(), ['complexWords', 'difficulty', 'end', 'grade', 'index', 'level',
    'paragraph', 'rank', 'reasons', 'start', 'syllables', 'text', 'words'].sort());
  assert.deepStrictEqual(Object.keys(r.paragraphs[0]).sort(), ['end', 'fleschReadingEase', 'index', 'start', 'words']);
  r.issues.forEach((i) => {
    assert.deepStrictEqual(Object.keys(i).sort(), ['end', 'message', 'start', 'suggestion', 'text', 'type']);
    assert.ok(['passive', 'adverb', 'complex-word', 'filler', 'long-sentence', 'very-long-sentence', 'repeated-word'].includes(i.type));
  });
  assert.ok(r.wordFrequency.length <= 10);
});

/* ------------------------------------------------------------------ */
/* 9. Performance: 20,000 words                                        */
/* ------------------------------------------------------------------ */
let perfMs = 0, perfWords = 0;
test('performance: 20,000 words < 150 ms', () => {
  // Varied vocabulary (pseudo-random words) so the syllable cache can't hide the real cost.
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const sy = ['ra', 'tion', 'con', 'mi', 'pre', 'ble', 'ing', 'ex', 'po', 'ly', 'ter', 'ment', 'ous', 'di', 'sa', 'que'];
  const base = (MIXED + '\n\n' + LEGAL + '\n\n').split(/\s+/);
  const out = [];
  for (let i = 0; out.length < 20000; i++) {
    if (i % 3 === 0) {
      let w = '';
      for (let k = 0, n = 1 + Math.floor(rnd() * 4); k < n; k++) w += sy[Math.floor(rnd() * sy.length)];
      out.push(w + (rnd() < 0.07 ? '.' : rnd() < 0.05 ? ',' : ''));
    } else out.push(base[i % base.length]);
    if (i % 180 === 179) out.push('\n\n');
  }
  const big = out.join(' ');
  const t0 = process.hrtime.bigint();
  const r = R.analyze(big);
  perfMs = Number(process.hrtime.bigint() - t0) / 1e6;
  perfWords = r.stats.words;
  assert.ok(perfWords >= 19000, 'words ' + perfWords);
  assert.ok(perfMs < 150, perfMs.toFixed(1) + ' ms');
  r.sentences.forEach((s) => assert.strictEqual(big.slice(s.start, s.end), s.text));
});

/* ------------------------------------------------------------------ */
console.log('Readable engine v' + R.version);
console.log(`Syllables: ${sylOk}/${sylPairs.length} exact = ${sylAcc.toFixed(1)}%` + (sylMiss.length ? `\n  misses: ${sylMiss.join(', ')}` : ''));
console.log(`Syllables, rules only (exception dictionary off): ${rulesOk}/${sylPairs.length} = ${rulesAcc.toFixed(1)}%`);
console.log(`Performance: ${perfWords} words analysed in ${perfMs.toFixed(1)} ms`);
console.log(`Sentence-split cases: ${SPLIT_CASES.length}`);
if (failures.length) console.log('\nFAILED:\n  ' + failures.join('\n  '));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
