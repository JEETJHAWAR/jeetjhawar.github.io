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
const by = (r, t) => r.issues.filter((i) => i.type === t);

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
    ['Our fest SEQUEL 26 sold 150+ passes, i.e. ₹1.67 lakh.', 'The team at IIM K. was thrilled!']],
  // v3: dialogue, Indian English, markdown, code, chat, emails
  ['"Where are you going?" asked Meera. "To the market," said Arjun.',
    ['"Where are you going?" asked Meera.', '"To the market," said Arjun.']],
  ['He finished his B.Tech. in 2024 and joined Infosys.', null],
  ['Hon\'ble Justice Rao heard the case. Adv. Mehta argued for the bank.',
    ['Hon\'ble Justice Rao heard the case.', 'Adv. Mehta argued for the bank.']],
  ['## Setup\n\nRun `npm install` first. Then open **index.html** in a [browser](https://x.dev/a.b).',
    ['Setup', 'Run `npm install` first.', 'Then open **index.html** in a [browser](https://x.dev/a.b).']],
  ['Install it:\n\n```\nnpm install\nnpm run dev\n```\n\nThen open the app.', ['Install it:', 'Then open the app.']],
  ['Edit app/page.js. Then save it.', ['Edit app/page.js.', 'Then save it.']],
  ['hey are u coming tonight\nparty starts at 8\nbring the speaker pls',
    ['hey are u coming tonight', 'party starts at 8', 'bring the speaker pls']],
  ['Hi Ravi,\nThanks for the update. See you Monday.\nRegards,\nJeet',
    ['Hi Ravi,', 'Thanks for the update.', 'See you Monday.', 'Regards,', 'Jeet']],
  ['✅ Free delivery\n✅ Easy returns', ['Free delivery', 'Easy returns']],
  ['| Plan | Price |\n|---|---|\n| Basic | ₹99 |', ['Plan | Price', 'Basic | ₹99']]
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
test('formula: Dale–Chall score follows the published constants', () => {
  const r = R.analyze('The cat sat on the mat. The dog ran to the park.');
  // no unfamiliar words: raw = 0.0496 × ASL
  assert.strictEqual(r.stats.unfamiliarWords, 0);
  assert.strictEqual(r.scores.daleChall, Math.round(0.0496 * 6 * 10) / 10);
  const h = R.analyze('Heterogeneous asymmetries complicate idiosyncratic estimation. The cat sat.');
  assert.ok(h.stats.unfamiliarWords >= 3, 'unfamiliar ' + h.stats.unfamiliarWords);
  assert.ok(h.scores.daleChall > 5, 'dale–chall ' + h.scores.daleChall);
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
  ['Your seat is reserved.', 'is reserved'],
  ['Incomplete applications will not be considered.', 'will not be considered'],
  ['The staff were surprised by the result.', 'were surprised']
];
const PASSIVE_NO = [
  'The car was red.', 'There is need for care.', 'He was happy.', 'They were at home.', 'She is a teacher.',
  'He is indeed right.', 'The sky is blue.', 'I am going home.', 'It was a hundred rupees.', 'The bed is soft.',
  'He was tired but happy.', 'I am interested in the role.', 'This process is called photosynthesis.',
  'The school is located in Pune.', 'The campus is spread over 100 acres.', 'They were married in 2020.'
];
PASSIVE_YES.forEach(([s, phrase]) => test('passive yes: ' + s, () => {
  const p = by(R.analyze(s), 'passive');
  assert.strictEqual(p.length, 1, 'found ' + p.length);
  assert.strictEqual(p[0].text, phrase);
}));
PASSIVE_NO.forEach((s) => test('passive no: ' + s, () => {
  const p = by(R.analyze(s), 'passive');
  assert.strictEqual(p.length, 0, 'flagged ' + (p[0] && p[0].text));
}));
test('passive reasons name the actor (or ask for one) and rewrite simple sentences', () => {
  const a = R.analyze('The fee shall be determined by the board in due course.').sentences[0];
  assert.ok(a.reasons.includes('Passive: “shall be determined by the board” — start with “the board”'), a.reasons.join(' | '));
  assert.strictEqual(a.tip, 'Make it active: “The board shall determine the fee in due course.”');
  const b = R.analyze('Records shall be retained for five years.').sentences[0];
  assert.ok(b.reasons.includes('Passive: “shall be retained” — who retains them?'), b.reasons.join(' | '));
  const c = R.analyze('The report was written by Sam.').sentences[0];
  assert.strictEqual(c.tip, 'Make it active: “Sam wrote the report.”');
  const d = R.analyze('It has been decided by the Ministry that the scheme will run for two more years.').sentences[0];
  assert.ok(/^Make it active: “The Ministry has decided that the scheme/.test(d.tip), d.tip);
  const e = R.analyze('Mistakes were made.').sentences[0];
  assert.ok(e.reasons.includes('Passive: “were made” — who made them?'), e.reasons.join(' | '));
});

/* ------------------------------------------------------------------ */
/* 6. Word-level issues                                                */
/* ------------------------------------------------------------------ */
test('complex words get plain alternatives (incl. phrases and inflections)', () => {
  const r = R.analyze('We utilized the funds in order to commence work prior to the deadline.');
  assert.deepStrictEqual(by(r, 'complex-word').map((i) => [i.text, i.suggestion]),
    [['utilized', 'used'], ['in order to', 'to'], ['commence', 'start'], ['prior to', 'before']]);
});
test('filler, adverbs and repeated words', () => {
  const r = R.analyze('It is really very quickly done, and the the team basically agreed. What kind of car? Only early.');
  const t = (x) => by(r, x).map((i) => i.text);
  assert.deepStrictEqual(t('filler'), ['really', 'very', 'basically']);
  assert.deepStrictEqual(t('adverb'), ['quickly']);
  assert.deepStrictEqual(t('repeated-word'), ['the the']);
});
test('long and very long sentence issues', () => {
  const long = Array.from({ length: 30 }, (_, i) => 'word' + 'abcdefghijklmnopqrstuvwxyz'[i % 26]).join(' ') + '.';
  const vlong = Array.from({ length: 45 }, () => 'cat').join(' ') + '.';
  assert.strictEqual(by(R.analyze(long), 'long-sentence').length, 1);
  assert.strictEqual(by(R.analyze(vlong), 'very-long-sentence').length, 1);
});

/* Plain-English dictionary: every suggestion is a valid drop-in in typical use. */
const PLAIN_OK = [
  ['We utilized the funds.', 'utilized', 'used'],
  ['The team has obtained approval.', 'obtained', 'got'],
  ['We obtained the data.', 'obtained', 'got'],
  ['You can purchase tickets online.', 'purchase', 'buy'],
  ['Is the supply adequate?', 'adequate', 'enough'],
  ['We must ensure that it works.', 'ensure that', 'make sure that'],
  ['Write to us concerning the refund.', 'concerning', 'about'],
  ['Please advise us of any change.', 'advise', 'tell'],
  ['We leverage our network.', 'leverage', 'use'],
  ['It is an optimal choice.', 'an optimal', 'the best'],
  ['We need an additional fee.', 'additional', 'extra'],
  ['It was an appreciable gain.', 'an appreciable', 'a large'],
  ['A majority of the voters agreed.', 'A majority of', 'Most of'],
  ['A majority of voters agreed.', 'A majority of', 'Most'],
  ['We located the file.', 'located', 'found'],
  ['Accordingly, we left.', 'Accordingly', 'So'],
  ['Kindly send the form.', 'Kindly', 'Please'],
  ['Reply at the earliest.', 'at the earliest', 'soon'],
  ['The aforementioned report is late.', 'aforementioned', 'above'],
  ['Our endeavours paid off.', 'endeavours', 'efforts'],
  ['We endeavour to reply.', 'endeavour', 'try'],
  ['She facilitated the meeting.', 'facilitated', 'helped with'],
  ['He demonstrated that it works.', 'demonstrated', 'showed'],
  ['It has been demonstrated.', 'demonstrated', 'shown'],
  ['It comprises three parts.', 'comprises', 'consists of'],
  ['It is comprised of three parts.', 'comprised of', 'made up of'],
  ['Women constitute 40% of staff.', 'constitute', 'make up'],
  ['We were notified.', 'notified', 'told'],
  ['He requires a visa.', 'requires', 'needs'],
  ['Thereafter, we met.', 'Thereafter', 'After that'],
  ['Notwithstanding the above, we agree.', 'Notwithstanding', 'Despite'],
  ['He is able to swim.', 'is able to', 'can'],
  ['She was able to come.', 'was able to', 'could'],
  ['We are reverting back.', 'reverting back', 'replying'],
  ['They ascertained the cause.', 'ascertained', 'found out'],
  ['The methodologies differ.', 'methodologies', 'methods'],
  ['Please do the needful.', 'do the needful', 'do what is needed'],
  ['They expedited the refund.', 'expedited', 'sped up'],
  ['We are participating in the fair.', 'participating', 'taking part']
];
PLAIN_OK.forEach(([s, text, sug]) => test('plain English drop-in: ' + s, () => {
  const cw = by(R.analyze(s), 'complex-word');
  assert.ok(cw.some((i) => i.text === text && i.suggestion === sug), JSON.stringify(cw.map((i) => [i.text, i.suggestion])));
}));
const PLAIN_SKIP = [
  'Data obtained from the survey was used.', 'Please find the allocated budget.', 'Keep your proof of purchase.',
  'The change was two orders of magnitude.', 'Returns since inception are strong.', 'This may cease to exist.',
  'We need an adequate supply.', 'We must ensure quality.', 'These are concerning trends.', 'Please advise on taxes.',
  'The leverage ratio rose.', 'The school is located in Pune.', 'Act accordingly.', 'He spoke kindly.',
  'Reply at the earliest opportunity.', 'The meeting was facilitated by Ravi.', 'This constitutes a breach.',
  'Payment is required.', 'The required documents are here.', 'Terminated staff will be paid.',
  'He applied for a permit.', 'An encounter with a bear.'
];
PLAIN_SKIP.forEach((s) => test('plain English: no risky suggestion in "' + s + '"', () => {
  const cw = by(R.analyze(s), 'complex-word');
  assert.strictEqual(cw.length, 0, JSON.stringify(cw.map((i) => [i.text, i.suggestion])));
}));
test('plain English: every dictionary entry yields well-formed suggestions in base, -s, -ed and -ing frames', () => {
  const bad = [];
  R._plainEntries.forEach((e) => {
    const frames = e.pos === 'v'
      ? ['They ' + e.phrase + ' it.', 'She ' + e.phrase.replace(/^(\S+)/, (w) => w + (/(s|x|ch|sh)$/.test(w) ? 'es' : /[^aeiou]y$/.test(w) ? '' : 's')).replace(/([^aeiou])ys\b/, '$1ies') + ' it.', 'We have ' + e.phrase.replace(/^(\S+?)e?(\s|$)/, '$1ed$2') + ' it.']
      : ['We saw ' + e.phrase + ' here.'];
    frames.forEach((f) => {
      const r = R.analyze(f);
      if (!r) return;
      by(r, 'complex-word').forEach((i) => {
        const s = String(i.suggestion);
        // well-formed: every word of the suggestion is itself an everyday word (no "useed", "makeing")
        const ok = s && !/undefined|null|\s\s/.test(s) && !/^(?:a|an|the)$/i.test(s) &&
          s.split(/\s+/).every((w) => R._isFamiliar(w.toLowerCase()));
        if (!ok) bad.push(f + ' → ' + s);
      });
    });
  });
  assert.deepStrictEqual(bad, []);
});

/* ------------------------------------------------------------------ */
/* 7. Regressions for the v2 "silly output" reports                    */
/* ------------------------------------------------------------------ */
test('silly #1: an easy email has no "hardest" sentences', () => {
  const r = R.analyze('Hi Ravi. Thanks for the quick reply. I can join the call on Monday at 4 pm. Let me know if that works.');
  assert.strictEqual(r.hardest.length, 0);
  assert.strictEqual(r.hardestNote, 'No sentence here is hard to read.');
  assert.ok(r.sentences.every((s) => s.rank === null && s.flagged === false && s.level === 'easy'));
  assert.strictEqual(r.scores.letter, 'A');
});
test('silly #2: a simple bullet list is not "Difficult"; label, letter, audience and grade agree', () => {
  const r = R.analyze('Key features:\n- Fast checkout with UPI\n- Free shipping above ₹1,200\n- 80+ cards in every box\n\nOrder today.');
  assert.ok(['A', 'B'].includes(r.scores.letter), r.scores.letter);
  assert.ok(!/difficult/i.test(r.scores.label), r.scores.label);
  assert.ok(r.scores.consensusGrade < 6, 'grade ' + r.scores.consensusGrade);
  assert.strictEqual(r.textType, 'list');
  assert.strictEqual(r.hardest.length, 0);
  // numbers get a neutral syllable cost (not "one thousand two hundred")
  assert.ok(r.sentences[2].syllables <= 7, 'syllables ' + r.sentences[2].syllables);
  // headings and short fragments do not move the document formulas
  const plain = R.analyze('Fast checkout with UPI\nFree shipping above ₹1,200\n80+ cards in every box');
  const withHead = R.analyze('Key features:\nFast checkout with UPI\nFree shipping above ₹1,200\n80+ cards in every box');
  assert.strictEqual(withHead.scores.fleschReadingEase, plain.scores.fleschReadingEase);
});
test('silly #3: familiar long words are not flagged; unfamiliar ones are, by name', () => {
  ['interest', 'inflation', 'electricity', 'difference', 'information', 'company', 'government', 'important',
    'lakh', 'crore', 'rupee', 'college', 'exam', 'semester', 'internship', 'smartphone', 'considerations',
    'statistically', 'organisation', 'unbelievable', 'recommendations'].forEach((w) => assert.ok(R._isFamiliar(w), w));
  ['heterogeneous', 'asymmetries', 'idiosyncratic', 'indemnifying', 'notwithstanding', 'macroeconomic']
    .forEach((w) => assert.ok(!R._isFamiliar(w), w));
  const r = R.analyze('The interest on the difference was important information for the company, the government and the electricity board, given inflation.');
  assert.ok(r.sentences[0].reasons.every((x) => !/unfamiliar|long word/i.test(x)), r.sentences[0].reasons.join(' | '));
  assert.strictEqual(r.stats.unfamiliarWords, 0);
  const h = R.analyze('Heterogeneous asymmetries and idiosyncratic shocks persist across regions.').sentences[0];
  assert.ok(h.reasons.includes('3 unfamiliar words: Heterogeneous, asymmetries, idiosyncratic'), h.reasons.join(' | '));
});
test('silly #4: names, acronyms and institutions are never complex or unfamiliar', () => {
  const r = R.analyze('On Monday, Governor Sanjay Malhotra said the Reserve Bank of India and the RBI, UPI and IIM teams will meet in Kozhikode.');
  assert.strictEqual(r.stats.complexWords, 0);
  assert.strictEqual(r.stats.unfamiliarWords, 0);
  assert.ok(r.sentences[0].reasons.every((x) => !/unfamiliar/.test(x)));
  const s = R.analyze('Sanjay Malhotra chairs the Monetary Policy Committee.');
  assert.strictEqual(s.stats.unfamiliarWords, 0);
});
test('silly #5: URLs, emails, paths and code are not words, syllables or clauses', () => {
  const a = R.analyze('Open http://localhost:3000 in your browser.');
  assert.strictEqual(a.stats.words, 4);
  assert.deepStrictEqual(a.sentences[0].reasons, []);
  assert.strictEqual(a.sentences[0].tip, null);
  const b = R.analyze('Edit app/page.js and run npm run dev, then email dev@acme.io or see C:\\Users\\jeet\\notes.txt.');
  assert.deepStrictEqual(b.sentences[0].text.length > 0, true);
  assert.strictEqual(b.stats.words, 7, 'words ' + b.stats.words);   // Edit, and, run, then, email, or, see
  const c = R.analyze('Call `useState()` inside `App.jsx`; the `--save-dev` flag is optional.');
  assert.ok(c.stats.words <= 7, 'words ' + c.stats.words);
  assert.strictEqual(R._mask('Use app/page.js now').indexOf('page'), -1);
  assert.ok(R._mask('Pick one: and/or, his/her, 24/7.').includes('and/or'));
  assert.ok(R._mask('Built with Node.js and Next.js.').includes('Node.js'));
});
test('silly #6: domain adverbs are fine; weak intensifiers and verb + adverb are flagged', () => {
  const a = R.analyze('The results were statistically significant, financially sound and environmentally safe, and revenue grew annually.');
  assert.strictEqual(by(a, 'adverb').length, 0, JSON.stringify(by(a, 'adverb').map((i) => i.text)));
  const b = R.analyze('She said quietly that the plan was extremely important and definitely ready.');
  const adv = by(b, 'adverb').map((i) => [i.text, i.suggestion]);
  assert.deepStrictEqual(adv, [['said quietly', 'whispered'], ['extremely important', 'crucial'], ['definitely', null]]);
  assert.ok(by(b, 'adverb').every((i) => !/statistically|annually/.test(i.message)));
});
test('silly #7: reasons and tips are specific and actionable', () => {
  const long = R.analyze('The bank raised its lending rate by half a point over the last six months, and the ' +
    'government expects inflation to ease before the festival season begins in late October this year.').sentences[0];
  assert.ok(long.reasons.some((x) => /^\d+ words — split after “months”, where a new idea starts$/.test(x)), long.reasons.join(' | '));
  assert.ok(/^Put a full stop after “months” and start the next sentence: “The government expects inflation …”$/.test(long.tip), long.tip);
  const stack = R.analyze('The paper studies monetary policy transmission in rural districts.').sentences[0];
  assert.ok(stack.reasons.includes('Stacked nouns: “monetary policy transmission”'), stack.reasons.join(' | '));
  const nom = R.analyze('The committee will conduct an investigation of the incident next week.').sentences[0];
  assert.ok(nom.reasons.includes('Nominalisation: investigation → investigate'), nom.reasons.join(' | '));
  const lead = R.analyze('Notwithstanding anything stated in the earlier letter sent to all of the members last week, ' +
    'the club will open on Monday at nine in the morning for everyone.').sentences[0];
  assert.ok(lead.reasons.some((x) => /^Starts with a \d+-word lead-in before the main point$/.test(x)), lead.reasons.join(' | '));
  const which = R.analyze('The policy brief covers several rural districts in two states, many of which lack the staff ' +
    'to run the new scheme on their own.').sentences[0];
  assert.ok(/“Many of them lack/.test(which.tip || ''), which.tip);
  const say = R.analyze('The Reserve Bank of India left its key rate unchanged on Wednesday, saying that inflation, ' +
    'although easing, remained above target and that more evidence of a slowdown was needed.').sentences[0];
  assert.ok(/“It said that inflation …”/.test(say.tip || ''), say.tip);
  assert.ok(say.reasons.every((x) => !/although easing remained/.test(x)));
});
test('silly #8: short texts carry a confidence note', () => {
  const a = R.analyze('Short note. Easy to read.');
  assert.deepStrictEqual(a.confidence, { level: 'low', note: 'Short text — scores are a rough guide.' });
  const long = R.analyze(Array.from({ length: 12 }, (_, i) => 'The team met on day ' + (i + 1) + ' and checked every number in the sales report.').join(' '));
  assert.strictEqual(long.confidence.level, 'high');
  assert.strictEqual(typeof long.confidence.note, 'string');
});
test('silly #9: dialogue, abbreviations and Indian English make no junk sentences', () => {
  const r = R.analyze('“Are you coming?” asked Priya. “Yes,” said Ravi, “but only after 5 p.m.” Smt. Rao paid Rs. 1,200 ' +
    'for the B.Tech. form, i.e. the late fee. Dr. Iyer of IIM K. agreed.');
  assert.deepStrictEqual(texts(r), ['“Are you coming?” asked Priya.', '“Yes,” said Ravi, “but only after 5 p.m.”',
    'Smt. Rao paid Rs. 1,200 for the B.Tech. form, i.e. the late fee.', 'Dr. Iyer of IIM K. agreed.']);
  assert.strictEqual(r.textType, 'dialogue');
});

/* ------------------------------------------------------------------ */
/* 8. Hardest sentences: only the genuinely hard ones                  */
/* ------------------------------------------------------------------ */
test('hardest: ordering, ranks, and only hard / very-hard sentences', () => {
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
  const flagged = r.sentences.filter((s) => s.flagged);
  assert.ok(r.hardest.length >= 2 && r.hardest.length <= 5, 'hardest ' + r.hardest.length);
  assert.strictEqual(r.hardest.length, Math.min(5, flagged.length));
  r.hardest.forEach((s, i) => {
    assert.strictEqual(s.rank, i + 1);
    assert.ok(s.words >= 4);
    assert.ok(s.level === 'hard' || s.level === 'very-hard');
    assert.strictEqual(r.sentences[s.index], s, 'hardest entries are the sentence objects');
    if (i) {
      const p = r.hardest[i - 1];
      assert.ok(p.difficulty > s.difficulty || (p.difficulty === s.difficulty && p.grade >= s.grade));
    }
  });
  assert.ok(r.hardest[0].text.startsWith('The extraordinarily'), r.hardest[0].text);
  assert.ok(!r.hardest.some((s) => s.text.startsWith('Because the weather')), 'easy sentence ranked');
  assert.ok(r.sentences.filter((s) => s.rank === null).every((s) => !r.hardest.includes(s)));
  assert.ok(/stand out|hard to read/.test(r.hardestNote), r.hardestNote);
  r.sentences.forEach((s) => {
    assert.ok(s.difficulty >= 0 && s.difficulty <= 100);
    assert.ok(['easy', 'ok', 'hard', 'very-hard'].includes(s.level));
    assert.ok(Array.isArray(s.reasons));
    assert.strictEqual(s.flagged, (s.level === 'hard' || s.level === 'very-hard') && s.words >= 4);
  });
});

/* ------------------------------------------------------------------ */
/* 9. Robustness and API                                               */
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
    ['fleschReadingEase', 'fleschKincaidGrade', 'gunningFog', 'smog', 'colemanLiau', 'ari', 'consensusGrade', 'daleChall', 'consensusEase']
      .forEach((k) => assert.ok(Number.isFinite(s[k]) && s[k] >= 0, k + '=' + s[k]));
    assert.ok(s.fleschReadingEase <= 100 && s.consensusEase <= 100);
    assert.ok(/^[A-F]$/.test(s.letter) && s.label && s.audience);
  });
});
test('API shape (v2 fields kept, v3 fields added)', () => {
  const r = R.analyze(MIXED);
  assert.strictEqual(R.version, '3.0.0');
  assert.deepStrictEqual(Object.keys(r).sort(), ['confidence', 'hardest', 'hardestNote', 'issues', 'paragraphs', 'scores',
    'sentences', 'stats', 'summary', 'textType', 'wordFrequency']);
  assert.deepStrictEqual(Object.keys(r.stats).sort(), ['avgSyllablesPerWord', 'avgWordsPerSentence', 'characters', 'complexWords',
    'longWords', 'paragraphs', 'readingTimeSec', 'sentences', 'speakingTimeSec', 'syllables', 'unfamiliarWords', 'words'].sort());
  assert.deepStrictEqual(Object.keys(r.scores).sort(), ['ari', 'audience', 'colemanLiau', 'consensusEase', 'consensusGrade',
    'daleChall', 'fleschKincaidGrade', 'fleschReadingEase', 'gunningFog', 'label', 'letter', 'smog'].sort());
  assert.deepStrictEqual(Object.keys(r.sentences[0]).sort(), ['complexWords', 'difficulty', 'end', 'flagged', 'grade', 'index', 'level',
    'paragraph', 'rank', 'reasons', 'start', 'syllables', 'text', 'tip', 'words'].sort());
  assert.deepStrictEqual(Object.keys(r.paragraphs[0]).sort(), ['end', 'fleschReadingEase', 'index', 'start', 'words']);
  assert.ok(Number.isInteger(r.stats.unfamiliarWords));
  assert.ok(['low', 'medium', 'high'].includes(r.confidence.level) && typeof r.confidence.note === 'string');
  assert.ok(['prose', 'list', 'dialogue', 'mixed', 'technical'].includes(r.textType));
  assert.ok(typeof r.summary === 'string' && r.summary.length > 10);
  assert.ok(typeof r.hardestNote === 'string' && r.hardestNote.length > 5);
  r.sentences.forEach((s) => assert.ok(s.tip === null || typeof s.tip === 'string'));
  r.issues.forEach((i) => {
    assert.deepStrictEqual(Object.keys(i).sort(), ['end', 'message', 'start', 'suggestion', 'text', 'type']);
    assert.ok(['passive', 'adverb', 'complex-word', 'filler', 'long-sentence', 'very-long-sentence', 'repeated-word'].includes(i.type));
  });
  assert.ok(r.wordFrequency.length <= 10);
});

/* ------------------------------------------------------------------ */
/* 10. Calibration corpus with expected bands                          */
/* ------------------------------------------------------------------ */
/* [name, text, expectations]: letters = allowed letter grades; grade = [min, max] consensus grade;
 * hardest = [min, max] number of hardest sentences; type = textType; conf = confidence level. */
const CORPUS = [
  ['Children’s story',
    'Once upon a time, a little fox lived in a big green wood. Every day he ran to the river to drink. ' +
    'One morning he saw a frog on a rock. "Hello," said the frog. "Do you want to play?" The fox smiled and sat down. ' +
    'They played all day in the sun. When the sky turned pink, the fox went home. He was tired but happy. He had a new friend.',
    { letters: 'A', grade: [0, 4], hardest: [0, 0] }],
  ['Tabloid news',
    'Cricket fans went wild on Sunday night as India beat Australia in a last-ball thriller. Needing four runs off the ' +
    'final ball, Hardik Pandya smashed a six over long-on. The crowd in Mumbai erupted. "I just backed myself," Pandya ' +
    'said after the game. It was India\'s third win in a row. Fans danced in the streets until the early hours, and the ' +
    'team will now face England in the final on Friday.',
    { letters: 'AB', grade: [0, 8], hardest: [0, 1] }],
  ['Broadsheet news',
    'The Reserve Bank of India left its key lending rate unchanged on Wednesday, saying that inflation, although easing, ' +
    'remained above its medium-term target and that further evidence of a durable slowdown in food prices was needed ' +
    'before policy could be loosened. Governor Sanjay Malhotra told reporters that the central bank would continue to ' +
    'monitor global developments closely, particularly the volatility in crude oil prices and its potential impact on ' +
    'domestic inflation expectations. Economists had broadly expected the decision, although a minority had argued for ' +
    'a modest cut to support slowing investment. Bond yields rose slightly after the announcement.',
    { letters: 'DEF', grade: [11, 18], hardest: [1, 3] }],
  ['RBI-style circular',
    'In exercise of the powers conferred by Section 35A of the Banking Regulation Act, 1949, the Reserve Bank, being ' +
    'satisfied that it is necessary and expedient in the public interest so to do, hereby directs that all regulated ' +
    'entities shall ensure that the credit information of borrowers is furnished to credit information companies within ' +
    'a period of seven days from the date of the relevant transaction. Regulated entities are further advised that any ' +
    'failure to comply with the aforementioned directions shall render them liable to penal action under the provisions ' +
    'of the Act. These directions shall come into force with immediate effect.',
    { letters: 'EF', grade: [14, 40], hardest: [2, 3] }],
  ['Legal T&C',
    'Notwithstanding any provision of this Agreement to the contrary, the indemnifying party shall, upon receipt of ' +
    'written notification from the indemnified party, assume the defence of any claim, action, or proceeding arising out ' +
    'of or relating to the performance of the obligations hereunder, including the reimbursement of reasonable ' +
    'attorneys\' fees and expenses incurred in connection therewith. The Company reserves the right, at its sole ' +
    'discretion, to modify, suspend, or discontinue the Service, or any part thereof, at any time and without prior ' +
    'notice, and shall not be liable to the User or to any third party for any such modification, suspension, or ' +
    'discontinuance. Any dispute, controversy or claim arising out of or in relation to these Terms, including the ' +
    'validity, invalidity, breach or termination thereof, shall be referred to and finally resolved by arbitration in ' +
    'accordance with the Arbitration and Conciliation Act, 1996. The User acknowledges that the limitations of liability ' +
    'set forth herein constitute an essential element of the bargain between the parties and shall apply notwithstanding ' +
    'the failure of essential purpose of any limited remedy.',
    { letters: 'F', grade: [16, 40], hardest: [3, 5] }],
  ['Academic abstract',
    'This study investigates the heterogeneous effects of monetary policy transmission on household consumption across ' +
    'income quintiles in emerging economies. Using a panel of 4,200 households observed between 2012 and 2022, we ' +
    'estimate a series of local projection models that account for asymmetries in credit access and liquidity ' +
    'constraints. Our findings indicate that contractionary shocks disproportionately reduce consumption among ' +
    'lower-income households, whereas the response of higher-income households is statistically indistinguishable from ' +
    'zero. These results suggest that distributional considerations should be incorporated into the conduct of monetary ' +
    'policy, and that the methodology developed here can be extended to other macroeconomic interventions.',
    { letters: 'EF', grade: [14, 40], hardest: [2, 4] }],
  ['Startup landing page',
    'Meet Ledger, the money app for small shops. Track every sale in one place. Send bills on WhatsApp in seconds. ' +
    'Get paid faster with UPI links. No setup fees. No hidden costs. Over 20,000 shop owners across India already use ' +
    'Ledger to save two hours a day. Start free today — it takes less than a minute.',
    { letters: 'AB', grade: [0, 7], hardest: [0, 0] }],
  ['Cold email',
    'Hi Priya,\n\nI\'m Jeet, a second-year MBA student at IIM Kozhikode. I came across your work on rural fintech and ' +
    'loved your recent post on credit for small farmers.\n\nI\'m looking for a summer internship in product or strategy, ' +
    'and I think I could help your team with user research and market sizing. Last year I ran a student festival that ' +
    'sold over 150 passes, and I built a small web app that helps students check their writing.\n\nWould you be open to ' +
    'a 15-minute call next week? I\'m happy to work around your schedule.\n\nThanks,\nJeet',
    { letters: 'ABC', grade: [0, 10], hardest: [0, 1] }],
  ['WhatsApp message',
    'hey are u coming tonight\nparty starts at 8\nbring the speaker pls\nalso ask riya if she needs a ride\nok see u',
    { letters: 'A', grade: [0, 4], hardest: [0, 0], conf: 'low' }],
  ['School essay',
    'My favourite festival is Diwali. It is the festival of lights, and it comes every year in October or November. ' +
    'A few days before Diwali, we clean our house and buy new clothes. My mother makes sweets like laddoos and barfi. ' +
    'On the night of Diwali, we light diyas and candles all around the house. We also pray to Goddess Lakshmi. After ' +
    'the prayer, my brother and I burst crackers with our friends. I like Diwali because the whole family is together ' +
    'and everyone is happy.',
    { letters: 'AB', grade: [0, 7], hardest: [0, 0] }],
  ['Wikipedia-style intro',
    'The Indian Institute of Management Kozhikode (IIM Kozhikode) is a public business school located in Kozhikode, ' +
    'Kerala, India. Established in 1996 by the Government of India, it is the fifth Indian Institute of Management and ' +
    'offers postgraduate, doctoral and executive education programmes. The institute\'s campus is spread over ' +
    'approximately 100 acres on a hilltop in Kunnamangalam, about 17 kilometres from the city centre. It is ' +
    'consistently ranked among the top business schools in the country by the National Institutional Ranking Framework.',
    { letters: 'BCDE', grade: [8, 15], hardest: [0, 2] }],
  ['Recipe',
    'Heat two tablespoons of oil in a pan. Add one chopped onion and fry until golden. Stir in the ginger and garlic ' +
    'paste and cook for one minute. Add the tomatoes, turmeric, chilli powder and salt. Cook for five minutes until the ' +
    'tomatoes turn soft. Add the boiled potatoes and mix well. Pour in half a cup of water, cover and cook for ten ' +
    'minutes. Garnish with fresh coriander and serve hot with rotis.',
    { letters: 'A', grade: [0, 6], hardest: [0, 0] }],
  ['Product bullet list',
    'Key features:\n- Fast checkout with UPI\n- Free shipping above ₹1,200\n- 80+ cards in every box\n\nOrder today.',
    { letters: 'AB', grade: [0, 6], hardest: [0, 0], type: 'list', conf: 'low' }],
  ['Technical README',
    '# Readable\n\nReadable checks how easy your writing is to read. It runs in the browser, so your text never leaves ' +
    'your computer.\n\n## Getting started\n\n1. Clone the repo.\n2. Run `npm install` to get the dependencies.\n3. Run ' +
    '`npm run dev` and open http://localhost:3000 in your browser.\n\nThe main logic lives in `src/engine.js`. Tests ' +
    'are in `engine.test.js` and run with `node engine.test.js`.\n\n## Contributing\n\nPull requests are welcome. Please ' +
    'open an issue first to discuss what you would like to change.',
    { letters: 'AB', grade: [0, 8], hardest: [0, 0], type: 'technical' }],
  ['Poetry line',
    'The river hums a quiet song beneath the silver moon tonight.',
    { letters: 'AB', grade: [0, 7], hardest: [0, 0], conf: 'low' }],
  ['Government notice (passive)',
    'It has been decided by the Ministry that the scheme will be extended for a further period of two years. ' +
    'Applications are invited from eligible institutions and must be submitted through the online portal by 31 March. ' +
    'Incomplete applications will not be considered. Further details may be obtained from the official website.',
    { letters: 'ABCD', grade: [5, 12], hardest: [0, 2] }],
  ['Corporate jargon email',
    'As per our discussion, we need to leverage our synergies and facilitate a seamless transition to the new paradigm. ' +
    'Kindly do the needful and revert back at the earliest. Going forward, all stakeholders are requested to ensure that ' +
    'deliverables are finalised prior to the deadline in order to optimise outcomes.',
    { letters: 'BCDEF', grade: [7, 16], hardest: [1, 3] }],
  ['Medicine leaflet',
    'Take one tablet twice a day with food. Do not take more than four tablets in 24 hours. If you feel dizzy, sit down ' +
    'and drink some water. Stop taking the tablets and see a doctor if you get a rash or find it hard to breathe. Keep ' +
    'this medicine out of the reach of children.',
    { letters: 'AB', grade: [0, 7], hardest: [0, 0] }],
  ['Dialogue',
    '"Where are you going?" asked Meera.\n"To the market," said Arjun. "We need milk."\n"Can I come too?"\n' +
    '"Only if you carry the bag."\nMeera laughed and grabbed her shoes.',
    { letters: 'A', grade: [0, 4], hardest: [0, 0], type: 'dialogue', conf: 'low' }],
  ['Philosophy essay',
    'The question of whether moral knowledge is possible has occupied philosophers since antiquity, and the answers they ' +
    'have given reflect deeper commitments about the nature of reality, the reliability of intuition, and the ' +
    'relationship between reason and emotion. Realists maintain that moral facts exist independently of our beliefs ' +
    'about them, while anti-realists contend that such facts are, in some sense, constructed by the attitudes and ' +
    'practices of human communities. Neither position, however, has proven entirely satisfactory, since each seems to ' +
    'sacrifice something that ordinary moral experience takes for granted.',
    { letters: 'DEF', grade: [12, 20], hardest: [2, 3] }],
  ['Customer support reply',
    'Thanks for writing to us. I\'m sorry your order arrived late. I\'ve added a ₹200 credit to your account, and you ' +
    'can use it on your next order. If anything else goes wrong, just reply to this email and we\'ll sort it out.',
    { letters: 'AB', grade: [0, 7], hardest: [0, 0] }],
  ['Job post (mixed)',
    'About the role\nWe are looking for a product analyst to join our growth team in Bengaluru.\n\nWhat you will do:\n' +
    '- Analyse user behaviour and build dashboards\n- Work with designers and engineers to test new ideas\n' +
    '- Present findings to the leadership team every month\n\nWhat we look for:\n' +
    '- 1–3 years of experience with SQL and Excel\n- Clear writing and a curious mind',
    { letters: 'ABC', grade: [0, 10], hardest: [0, 0], type: 'list' }],
  ['Markdown blog post',
    '## Why I built Readable\n\nMost writing tools tell you **what** is wrong but not **why**. I wanted something that ' +
    'explains each problem in plain words.\n\n> Good writing is clear thinking made visible.\n\nYou can try it ' +
    '[here](https://jeetjhawar.github.io/readability/). It is free, and it works offline.',
    { letters: 'AB', grade: [0, 7], hardest: [0, 0] }],
  ['Indian-English business email',
    'Dear Sir,\n\nAs discussed, please find attached the revised quotation for 500 units. Kindly confirm the order at ' +
    'the earliest so that we can prepone the dispatch to Monday. The total amount payable is ₹2.5 lakh including GST.' +
    '\n\nRegards,\nAmit Sharma\nSales Manager',
    { letters: 'ABC', grade: [0, 10], hardest: [0, 1] }],
  ['Science explainer',
    'Plants make their own food. They take in water through their roots and carbon dioxide from the air. Using energy ' +
    'from sunlight, they turn these into sugar and oxygen. This process is called photosynthesis. The sugar gives the ' +
    'plant energy to grow, and the oxygen goes back into the air for us to breathe.',
    { letters: 'AB', grade: [0, 8], hardest: [0, 0] }],
  ['Policy brief (dense)',
    'The proposed amendments to the data protection compliance requirements would impose substantial additional ' +
    'obligations on small and medium enterprises, many of which lack the administrative capacity to implement ' +
    'comprehensive consent management frameworks. Consequently, it is recommended that the implementation timeline be ' +
    'extended and that simplified templates be made available to enterprises below a specified turnover threshold.',
    { letters: 'EF', grade: [14, 40], hardest: [2, 2] }]
];

const LETTER_OF = (e) => (e >= 70 ? 'A' : e >= 60 ? 'B' : e >= 50 ? 'C' : e >= 40 ? 'D' : e >= 30 ? 'E' : 'F');
const LABEL_OF = (e) => (e >= 90 ? 'Very easy' : e >= 80 ? 'Easy' : e >= 70 ? 'Fairly easy' : e >= 60 ? 'Plain English' :
  e >= 50 ? 'Fairly difficult' : e >= 30 ? 'Difficult' : 'Very difficult');
const table = [];
CORPUS.forEach(([name, t, ex]) => {
  test('corpus: ' + name, () => {
    const r = R.analyze(t), s = r.scores;
    table.push([name, s.letter, s.label, s.consensusGrade, s.fleschReadingEase, s.daleChall, r.hardest.length, r.textType, r.confidence.level]);
    assert.ok(ex.letters.includes(s.letter), `letter ${s.letter} not in ${ex.letters}`);
    assert.ok(s.consensusGrade >= ex.grade[0] && s.consensusGrade <= ex.grade[1], `grade ${s.consensusGrade} not in ${ex.grade}`);
    assert.ok(r.hardest.length >= ex.hardest[0] && r.hardest.length <= ex.hardest[1], `hardest ${r.hardest.length} not in ${ex.hardest}`);
    if (ex.type) assert.strictEqual(r.textType, ex.type);
    if (ex.conf) assert.strictEqual(r.confidence.level, ex.conf);
    // one consensus drives label, letter and audience
    assert.strictEqual(s.letter, LETTER_OF(s.consensusEase));
    assert.strictEqual(s.label, LABEL_OF(s.consensusEase));
    // the summary is one or two plain sentences and agrees with the hardest list
    const sentencesInSummary = r.summary.split(/(?<=[.!?])\s+/).length;
    assert.ok(sentencesInSummary <= 2, r.summary);
    if (!r.hardest.length) assert.ok(!/drags?|stands? out|Most sentences/.test(r.summary), r.summary);
    else assert.ok(/drags?|stands? out|Most sentences/.test(r.summary), r.summary);
  });
});
test('silly #7b: no template is repeated across hard sentences; no broken text in any reason or tip', () => {
  CORPUS.forEach(([name, t]) => {
    const r = R.analyze(t);
    const tips = r.hardest.map((s) => s.tip).filter(Boolean);
    assert.strictEqual(new Set(tips).size, tips.length, name + ': repeated tip');
    r.sentences.forEach((s) => {
      s.reasons.concat(s.tip || []).forEach((x) => {
        assert.ok(!/undefined|null|NaN|“”|\s\s|^\s|\s$/.test(x), name + ': ' + x);
        assert.ok(!/Many clauses — try full stops instead of commas|consider shortening it/.test(x), name + ': generic ' + x);
      });
      if (s.flagged) assert.ok(typeof s.tip === 'string' && s.tip.length > 10, name + ': flagged sentence without a tip');
    });
  });
});
test('corpus: easier passages never out-score harder ones on the letter scale', () => {
  const g = (n) => R.analyze(CORPUS.find((c) => c[0] === n)[1]).scores.consensusGrade;
  assert.ok(g('Children’s story') < g('Tabloid news'));
  assert.ok(g('Tabloid news') < g('Broadsheet news'));
  assert.ok(g('Broadsheet news') < g('Legal T&C'));
  assert.ok(g('Recipe') < g('Academic abstract'));
});

/* ------------------------------------------------------------------ */
/* 11. Monotonic sanity                                                */
/* ------------------------------------------------------------------ */
const diffOf = (t) => R.analyze(t).sentences[0].difficulty;
test('monotonic: making a sentence longer never lowers its difficulty', () => {
  const bases = ['The team checked the sales report', 'Our new app helps small shops track every sale',
    'The board shall review the policy', 'Notwithstanding the delay the committee approved the plan'];
  const tails = [' on Monday', ' with the finance staff', ', and the manager signed it', ' before the end of the quarter',
    ' because customers asked for faster delivery', ', which pleased everyone in the office'];
  bases.forEach((b) => {
    let t = b, prev = diffOf(t + '.');
    tails.forEach((tail) => {
      t += tail;
      const d = diffOf(t + '.');
      assert.ok(d >= prev, `"${t}." ${d} < ${prev}`);
      prev = d;
    });
  });
});
test('monotonic: swapping plain words for jargon never lowers difficulty', () => {
  const steps = [
    'We used the money to start work before the deadline and we told the staff about the plan.',
    'We utilized the money to start work before the deadline and we told the staff about the plan.',
    'We utilized the money to commence work before the deadline and we told the staff about the plan.',
    'We utilized the money to commence work prior to the deadline and we told the staff about the plan.',
    'We utilized the money to commence work prior to the deadline and we notified the staff about the plan.',
    'We utilized the money to commence work prior to the deadline and we notified the staff regarding the methodology.',
    'We utilized the heterogeneous funds to commence work prior to the deadline and we notified the staff regarding the methodology.'
  ];
  let prev = -1;
  steps.forEach((s) => { const d = diffOf(s); assert.ok(d >= prev, `${d} < ${prev}: ${s}`); prev = d; });
  assert.ok(prev > diffOf(steps[0]), 'jargon should raise difficulty');
});
test('monotonic: adding a passive or a noun stack never lowers difficulty', () => {
  assert.ok(diffOf('The board approved the plan for the new office.') <= diffOf('The plan for the new office was approved by the board.'));
  assert.ok(diffOf('The paper studies how money moves in rural areas.') <= diffOf('The paper studies monetary policy transmission mechanisms in rural areas.'));
});

/* ------------------------------------------------------------------ */
/* 12. Performance: 20,000 words                                       */
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
console.log('Readable engine v' + R.version + '  (familiar-word list: ' + R._familiarCount + ' lemmas)');
console.log(`Syllables: ${sylOk}/${sylPairs.length} exact = ${sylAcc.toFixed(1)}%` + (sylMiss.length ? `\n  misses: ${sylMiss.join(', ')}` : ''));
console.log(`Syllables, rules only (exception dictionary off): ${rulesOk}/${sylPairs.length} = ${rulesAcc.toFixed(1)}%`);
console.log(`Performance: ${perfWords} words analysed in ${perfMs.toFixed(1)} ms`);
console.log(`Sentence-split cases: ${SPLIT_CASES.length}`);
console.log('\nCalibration corpus:');
const pad = (s, n) => String(s).padEnd(n);
console.log('  ' + pad('Passage', 31) + pad('Letter', 7) + pad('Label', 17) + pad('Grade', 7) + pad('Flesch', 8) + pad('D–C', 6) + pad('Hard', 6) + pad('Type', 11) + 'Confidence');
table.forEach((t) => console.log('  ' + pad(t[0], 31) + pad(t[1], 7) + pad(t[2], 17) + pad(t[3], 7) + pad(t[4], 8) + pad(t[5], 6) + pad(t[6], 6) + pad(t[7], 11) + t[8]));
if (failures.length) console.log('\nFAILED:\n  ' + failures.join('\n  '));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
