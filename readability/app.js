/* Readable — UI layer.
   Uses window.Readable.analyze(text) from engine.js. If engine.js is missing
   (or failed to load), a small built-in fallback engine below keeps the page
   working with the same result shape. Everything runs locally. */

/* ======================================================================
   Fallback engine — only used when engine.js did not define Readable.
   ====================================================================== */
if (!window.Readable) {
  window.Readable = (function () {
    'use strict';

    var IRREG = 'built|done|made|given|taken|written|known|seen|shown|held|paid|sent|found|kept|told|chosen|drawn|driven|broken|spoken|bought|brought|caught|thought|taught|led|lost|met|understood|begun|forgotten|hidden|stolen|thrown|grown|heard|meant|spent';
    var PASSIVE_RE = new RegExp('\\b(?:am|is|are|was|were|be|been|being)\\s+(?:[a-z]+ly\\s+)?(?:[a-z]+ed|' + IRREG + ')\\b', 'gi');

    var COMPLEX = {
      'utilize': 'use', 'utilise': 'use', 'utilization': 'use', 'utilisation': 'use',
      'facilitate': 'help', 'commence': 'start', 'approximately': 'about', 'demonstrate': 'show',
      'sufficient': 'enough', 'additional': 'more', 'subsequently': 'later', 'notwithstanding': 'despite',
      'pursuant to': 'under', 'in accordance with': 'under', 'prior to': 'before', 'terminate': 'end',
      'termination': 'end', 'endeavor': 'try', 'endeavour': 'try', 'leverage': 'use', 'leverages': 'uses',
      'individuals': 'people', 'purchase': 'buy', 'assistance': 'help', 'numerous': 'many',
      'methodology': 'method', 'methodologies': 'methods', 'implement': 'carry out', 'aforementioned': 'this',
      'herein': 'here', 'thereof': 'of it', 'ascertain': 'find out', 'optimal': 'best', 'in lieu of': 'instead of',
      'with respect to': 'about', 'obtain': 'get', 'regarding': 'about', 'remuneration': 'pay',
      'consequence': 'result', 'in connection with': 'for', 'set forth': 'set out', 'optimise': 'improve',
      'optimize': 'improve', 'heterogeneous': 'mixed', 'enabling': 'letting', 'possibility': 'chance'
    };
    var FILLERS = {
      'very': 'cut it, or use a stronger word', 'really': 'cut it', 'just': 'cut it', 'actually': 'cut it',
      'basically': 'cut it', 'simply': 'cut it', 'quite': 'cut it', 'literally': 'cut it', 'totally': 'cut it',
      'kind of': 'cut it', 'sort of': 'cut it', 'in order to': 'to', 'due to the fact that': 'because',
      'at this point in time': 'now', 'it is important to note that': 'cut it', 'a number of': 'some',
      'in the event that': 'if', 'for the purpose of': 'to', 'with regard to': 'about', 'at some point': 'cut it',
      'potentially': 'cut it', 'extremely': 'cut it, or use a stronger word', 'significantly': 'a number, if you have one'
    };
    var NOT_ADVERB = /^(only|family|early|likely|reply|apply|supply|july|italy|daily|holy|ugly|belly|rally|jelly|bully|ally|imply|comply|multiply|friendly|lonely|lovely|silly|elderly|costly|weekly|monthly|yearly|assembly|anomaly|homily|lily|fly|sly|poly|rely|butterfly|curly|oily|hilly|chilly|melancholy|monopoly|italy)$/i;
    var STOP = ('a,about,above,after,again,against,all,also,am,an,and,any,are,as,at,be,because,been,before,being,below,between,both,but,by,can,could,did,do,does,doing,down,during,each,few,for,from,further,had,has,have,having,he,her,here,hers,herself,him,himself,his,how,i,if,in,into,is,it,its,itself,just,me,more,most,my,myself,no,nor,not,now,of,off,on,once,only,or,other,our,ours,ourselves,out,over,own,same,she,should,so,some,such,than,that,the,their,theirs,them,themselves,then,there,these,they,this,those,through,to,too,under,until,up,very,was,we,were,what,when,where,which,while,who,whom,why,will,with,would,you,your,yours,yourself,yourselves,may,might,shall,must,let,get,got,us,it\'s,i\'m,don\'t,can\'t,we\'ll,you\'re,isn\'t').split(',');
    var STOPSET = Object.create(null);
    STOP.forEach(function (w) { STOPSET[w] = true; });

    function syl(word) {
      var w = word.toLowerCase().replace(/[^a-z]/g, '');
      if (!w) return 1;
      if (w.length <= 3) return 1;
      w = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
      var m = w.match(/[aeiouy]{1,2}/g);
      return Math.max(1, m ? m.length : 1);
    }
    function wordsIn(str, offset) {
      var re = /[A-Za-z0-9]+(?:['’][A-Za-z]+)*/g, out = [], m;
      while ((m = re.exec(str))) out.push({ w: m[0], start: offset + m.index, end: offset + m.index + m[0].length, s: syl(m[0]) });
      return out;
    }
    function phraseRe(map) {
      var keys = Object.keys(map).sort(function (a, b) { return b.length - a.length; });
      return new RegExp('\\b(' + keys.map(function (k) { return k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+'); }).join('|') + ')\\b', 'gi');
    }
    var COMPLEX_RE = phraseRe(COMPLEX), FILLER_RE = phraseRe(FILLERS);
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function fre(w, s, sy) { return w && s ? clamp(206.835 - 1.015 * (w / s) - 84.6 * (sy / w), 0, 100) : 0; }
    function round1(v) { return Math.round(v * 10) / 10; }

    function analyze(text) {
      if (typeof text !== 'string' || !/[A-Za-z0-9]/.test(text)) return null;
      var paragraphs = [], sentences = [], allWords = [];
      var pre = /\S[\s\S]*?(?=\n[ \t]*\n|\s*$)/g, pm;
      while ((pm = pre.exec(text))) {
        var pStart = pm.index, pText = pm[0], pIndex = paragraphs.length;
        var para = { index: pIndex, start: pStart, end: pStart + pText.length, words: 0, syl: 0, sents: 0 };
        var sre = /[^.!?…\n]+(?:[.!?…]+["'”’)\]]*|\n|$)/g, sm;
        while ((sm = sre.exec(pText))) {
          if (!sm[0]) { sre.lastIndex++; continue; }
          var raw = sm[0], lead = raw.length - raw.replace(/^\s+/, '').length;
          var trimmed = raw.trim();
          if (!/[A-Za-z0-9]/.test(trimmed)) continue;
          var st = pStart + sm.index + lead;
          var ws = wordsIn(trimmed, st);
          if (!ws.length) continue;
          var sy = 0, cx = 0;
          ws.forEach(function (w) { sy += w.s; if (w.s >= 3) cx++; });
          sentences.push({ index: sentences.length, start: st, end: st + trimmed.length, text: trimmed, paragraph: pIndex, words: ws.length, syllables: sy, complexWords: cx, _w: ws });
          para.words += ws.length; para.syl += sy; para.sents++;
          allWords = allWords.concat(ws);
        }
        para.fleschReadingEase = Math.round(fre(para.words, para.sents, para.syl));
        paragraphs.push(para);
      }
      if (!allWords.length || !sentences.length) return null;

      // ----- issues
      var issues = [], m;
      PASSIVE_RE.lastIndex = 0;
      while ((m = PASSIVE_RE.exec(text))) issues.push({ type: 'passive', start: m.index, end: m.index + m[0].length, text: m[0], message: 'Passive voice hides who does the action.', suggestion: 'Name who does it and lead with them.' });
      var taken = [];
      function free(a, b) { for (var i = 0; i < taken.length; i++) if (a < taken[i][1] && b > taken[i][0]) return false; return true; }
      COMPLEX_RE.lastIndex = 0;
      while ((m = COMPLEX_RE.exec(text))) {
        var key = m[0].toLowerCase().replace(/\s+/g, ' ');
        taken.push([m.index, m.index + m[0].length]);
        issues.push({ type: 'complex-word', start: m.index, end: m.index + m[0].length, text: m[0], message: '“' + m[0] + '” has a simpler alternative.', suggestion: COMPLEX[key] ? '“' + COMPLEX[key] + '”' : null });
      }
      FILLER_RE.lastIndex = 0;
      while ((m = FILLER_RE.exec(text))) {
        var fk = m[0].toLowerCase().replace(/\s+/g, ' ');
        taken.push([m.index, m.index + m[0].length]);
        issues.push({ type: 'filler', start: m.index, end: m.index + m[0].length, text: m[0], message: '“' + m[0] + '” adds length without meaning.', suggestion: FILLERS[fk] ? (/^cut|,/.test(FILLERS[fk]) ? FILLERS[fk].charAt(0).toUpperCase() + FILLERS[fk].slice(1) + '.' : '“' + FILLERS[fk] + '”') : null });
      }
      allWords.forEach(function (w) {
        if (!free(w.start, w.end)) return;
        if (/^[a-z]{3,}ly$/i.test(w.w) && !NOT_ADVERB.test(w.w)) {
          issues.push({ type: 'adverb', start: w.start, end: w.end, text: w.w, message: 'Adverbs often prop up a weak verb.', suggestion: 'Cut it, or pick a stronger verb.' });
        } else if (w.s >= 4 && !/^[A-Z]/.test(w.w)) {
          issues.push({ type: 'complex-word', start: w.start, end: w.end, text: w.w, message: 'Long word (' + w.s + ' syllables).', suggestion: null });
        }
      });
      var rep = /\b([A-Za-z]+)\s+\1\b/gi;
      while ((m = rep.exec(text))) issues.push({ type: 'repeated-word', start: m.index, end: m.index + m[0].length, text: m[0], message: 'Repeated word.', suggestion: 'Delete one “' + m[1] + '”.' });

      // ----- sentence scores
      var polysyl = 0, letters = 0, chars = 0, complexTotal = 0, longWords = 0;
      allWords.forEach(function (w) {
        if (w.s >= 3) { polysyl++; complexTotal++; }
        letters += w.w.replace(/[^A-Za-z0-9]/g, '').length;
        if (w.w.length >= 7) longWords++;
      });
      chars = letters;
      sentences.forEach(function (s) {
        var avgS = s.syllables / s.words;
        s.grade = round1(clamp(0.39 * s.words + 11.8 * avgS - 15.59, 0, 24));
        if (s.words > 25) issues.push({ type: s.words >= 35 ? 'very-long-sentence' : 'long-sentence', start: s.start, end: s.end, text: s.text, message: 'This sentence has ' + s.words + ' words.', suggestion: 'Split it into two or three sentences.' });
        var hasPassive = issues.some(function (i) { return i.type === 'passive' && i.start >= s.start && i.end <= s.end; });
        var d = s.grade * 3.4 + (s.complexWords / s.words) * 45 + Math.max(0, s.words - 18) * 1.1 + (hasPassive ? 6 : 0);
        s.difficulty = Math.round(clamp(d, 0, 100));
        s.level = s.difficulty < 30 ? 'easy' : s.difficulty < 50 ? 'ok' : s.difficulty < 70 ? 'hard' : 'very-hard';
        var reasons = [];
        if (s.words >= 25) reasons.push(s.words + ' words long');
        if (s.complexWords >= 3) reasons.push(s.complexWords + ' complex words');
        if (avgS >= 1.7) reasons.push('Long, multi-syllable words');
        if (hasPassive) reasons.push('Passive voice');
        if (!reasons.length && s.level !== 'easy') reasons.push('Dense phrasing');
        s.reasons = reasons;
        s.rank = null;
        delete s._w;
      });
      issues.sort(function (a, b) { return a.start - b.start || b.end - a.end; });

      var hardest = sentences.filter(function (s) { return s.words >= 4 && s.level !== 'easy'; })
        .sort(function (a, b) { return b.difficulty - a.difficulty || b.words - a.words; }).slice(0, 5);
      hardest.forEach(function (s, i) { s.rank = i + 1; });

      var W = allWords.length, S = sentences.length, SY = sentences.reduce(function (a, s) { return a + s.syllables; }, 0);
      var ease = fre(W, S, SY);
      var fk = 0.39 * (W / S) + 11.8 * (SY / W) - 15.59;
      var fog = 0.4 * (W / S + 100 * complexTotal / W);
      var smog = 1.043 * Math.sqrt(polysyl * (30 / S)) + 3.1291;
      var cl = 0.0588 * (letters / W * 100) - 0.296 * (S / W * 100) - 15.8;
      var ari = 4.71 * (chars / W) + 0.5 * (W / S) - 21.43;
      var grades = [fk, fog, smog, cl, ari].map(function (g) { return clamp(g, 0, 22); }).sort(function (a, b) { return a - b; });
      var label = ease >= 90 ? 'Very easy' : ease >= 80 ? 'Easy' : ease >= 70 ? 'Fairly easy' : ease >= 60 ? 'Plain English' : ease >= 50 ? 'Fairly difficult' : ease >= 30 ? 'Difficult' : 'Very difficult';
      var audience = ease >= 90 ? 'Easily understood by an average 11-year-old' : ease >= 80 ? 'Conversational English; easy for most readers' : ease >= 70 ? 'Fairly easy; fine for 12- to 13-year-olds' : ease >= 60 ? 'Easily understood by 13- to 15-year-olds' : ease >= 50 ? 'Fairly difficult; suits 15- to 18-year-olds' : ease >= 30 ? 'Difficult; best understood by college students' : 'Very difficult; best understood by university graduates';
      var letter = ease >= 70 ? 'A' : ease >= 60 ? 'B' : ease >= 50 ? 'C' : ease >= 40 ? 'D' : ease >= 30 ? 'E' : 'F';

      var freq = Object.create(null);
      allWords.forEach(function (w) { var k = w.w.toLowerCase().replace(/’/g, "'"); if (k.length > 2 && !STOPSET[k] && !/^\d+$/.test(k)) freq[k] = (freq[k] || 0) + 1; });
      var wordFrequency = Object.keys(freq).map(function (k) { return { word: k, count: freq[k] }; })
        .sort(function (a, b) { return b.count - a.count || a.word.localeCompare(b.word); }).slice(0, 20);

      return {
        stats: {
          words: W, sentences: S, paragraphs: paragraphs.length, characters: text.replace(/\s/g, '').length,
          syllables: SY, complexWords: complexTotal, longWords: longWords,
          readingTimeSec: Math.round(W / 238 * 60), speakingTimeSec: Math.round(W / 150 * 60),
          avgWordsPerSentence: round1(W / S), avgSyllablesPerWord: Math.round(SY / W * 100) / 100
        },
        scores: {
          fleschReadingEase: round1(ease), fleschKincaidGrade: round1(clamp(fk, 0, 22)), gunningFog: round1(clamp(fog, 0, 22)),
          smog: round1(clamp(smog, 0, 22)), colemanLiau: round1(clamp(cl, 0, 22)), ari: round1(clamp(ari, 0, 22)),
          consensusGrade: round1(grades[2]), label: label, audience: audience, letter: letter
        },
        sentences: sentences,
        hardest: hardest,
        issues: issues,
        paragraphs: paragraphs.map(function (p) { return { index: p.index, start: p.start, end: p.end, words: p.words, fleschReadingEase: p.fleschReadingEase }; }),
        wordFrequency: wordFrequency
      };
    }
    return { analyze: analyze, fallback: true };
  })();
}

/* ======================================================================
   UI
   ====================================================================== */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var params = new URLSearchParams(location.search);
  var STATIC = params.has('static');
  var REDUCED = STATIC || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  var el = {
    header: $('#siteHeader'), input: $('#input'), counter: $('#counter'), editorCard: $('#editorCard'),
    run: $('#runBtn'), sampleBtn: $('#sampleBtn'), sampleMenu: $('#sampleMenu'), upload: $('#uploadBtn'),
    file: $('#fileInput'), clear: $('#clearBtn'), empty: $('#emptyState'), emptySample: $('#emptySample'),
    body: $('#resultsBody'), results: $('#results'), short: $('#shortNotice'), live: $('#liveRegion'),
    easeNum: $('#easeNum'), needle: $('#gNeedle'), letter: $('#letter'), label: $('#scoreLabel'),
    audience: $('#audience'), consensus: $('#consensusChip'), readChip: $('#readChip'), hardChip: $('#hardCountChip'),
    metrics: $('#metrics'), slides: $('#slides'), dots: $('#progressDots'), prev: $('#prevBtn'), next: $('#nextBtn'),
    carousel: $('#carousel'), hl: $('#hlView'), pop: $('#popover'), heat: $('#heat'), words: $('#words'),
    copy: $('#copyBtn'), download: $('#downloadBtn'), share: $('#shareBtn'), toast: $('#toast'),
    banner: $('#shareBanner'), bannerClose: $('#shareClose'), bannerCta: $('#shareCta')
  };

  /* ---------------- sample texts (original) ---------------- */
  var SAMPLES = {
    legal: 'Data Retention and Account Termination Policy\n\n' +
      'Pursuant to the provisions set forth herein, the Company reserves the right, at its sole and absolute discretion, to suspend or terminate any user account that is determined to be in violation of the aforementioned Terms of Service, notwithstanding any prior communication or informal assurance that may have been provided by representatives of the Company.\n\n' +
      'Personal information that is collected in connection with the provision of the Services shall be retained for a period not exceeding thirty-six (36) months following the termination of the account, except where a longer retention period is required or permitted by applicable law, regulation, or the legitimate interests of the Company in the establishment, exercise, or defence of legal claims.\n\n' +
      'Users may request the deletion of their personal information by submitting a written request. Requests will be processed within a reasonable timeframe. It is important to note that the deletion of information may result in the inability of the Company to facilitate the continued provision of certain features.\n\n' +
      'The Company shall not be liable for any losses that are incurred as a consequence of the termination of an account in accordance with this policy.',
    startup: 'Meet Tally. Your invoices, finally sorted.\n\n' +
      'Small teams lose hours every week chasing payments. Tally fixes that. Connect your bank, upload your invoices, and we match every payment automatically.\n\n' +
      'No spreadsheets. No copy-paste. No awkward reminder emails — Tally sends them for you, politely, at exactly the right time.\n\n' +
      'Our platform leverages advanced machine-learning methodologies to facilitate the reconciliation of heterogeneous financial data sources in real time, enabling organisations to optimise working-capital utilisation across numerous accounts.\n\n' +
      'Set it up in five minutes. Get paid faster from day one. Over 2,000 freelancers and small studios already use Tally, and most of them save around six hours a month.\n\n' +
      'Try it free for 30 days. No credit card needed. If it does not save you time, you really do not pay a thing.',
    essay: 'How the Printing Press Changed the World\n\n' +
      'The printing press, which was invented by Johannes Gutenberg around 1440, is widely considered to be one of the most important inventions in human history. Before it existed, books were copied by hand, which was extremely slow and very expensive.\n\n' +
      'Because books were so rare, knowledge was controlled by a small number of people, mainly priests and wealthy families. Most ordinary people could not read at all. When printed books became cheaper, more people actually began to learn to read, and ideas were able to spread much more quickly than ever before.\n\n' +
      'The effects of this were enormous. The Protestant Reformation was significantly accelerated by printed pamphlets that were distributed across Europe in their thousands. Scientists were able to share their discoveries with each other, which eventually contributed to the development of the Scientific Revolution and the gradual standardisation of experimental methodologies.\n\n' +
      'In conclusion, the printing press basically changed how people learned and communicated. Without it, the modern world would look completely different. In many ways, the internet is simply the latest chapter of the same revolution.',
    email: 'Subject: A quick idea for your onboarding\n\n' +
      'Hi Priya,\n\n' +
      'I read your post about cutting onboarding time for new store managers, and I wanted to reach out.\n\n' +
      'Over the summer I built a small tool that turns long training manuals into short, readable checklists. In a pilot with a local retail chain, new hires finished their first-week training two days faster. The checklists use plain language, work on a phone and are easy to update when a policy changes.\n\n' +
      'I would be very grateful if you would consider the possibility of a brief fifteen-minute call at some point in the coming weeks in order to explore whether a similar approach could potentially be of value to your team.\n\n' +
      'If it helps, I can send a one-page summary first. No pressure either way.\n\n' +
      'Thanks for reading,\nSam'
  };
  var SAMPLE_NAMES = { legal: 'legal policy', startup: 'startup landing page', essay: 'school essay', email: 'cold email' };

  /* ---------------- helpers ---------------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : (d == null ? 0 : d); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function fmt1(v) { return (typeof v === 'number' && isFinite(v)) ? (Math.round(v * 10) / 10).toFixed(1) : '—'; }
  function fmtInt(v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v).toLocaleString('en-US') : '—'; }
  function fmtTime(sec) {
    sec = Math.max(0, Math.round(num(sec)));
    if (sec < 60) return (sec || 1) + ' s';
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ' min' + (s ? ' ' + s + ' s' : '');
  }
  function ordinal(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function gradeWord(g) {
    if (typeof g !== 'number' || !isFinite(g)) return '';
    var r = Math.round(g);
    if (r <= 0) return 'Kindergarten';
    if (r <= 12) return ordinal(r) + ' grade';
    if (r <= 16) return 'College level';
    return 'Graduate level';
  }
  function gradePip(g) { return g <= 8 ? 'easy' : g <= 11 ? 'mid' : g <= 14 ? 'hard' : 'vhard'; }
  function easeZone(v) { return v < 30 ? 1 : v < 50 ? 2 : v < 70 ? 3 : 4; }
  function countWords(t) { var m = t.match(/[A-Za-z0-9]+(?:['’][A-Za-z]+)*/g); return m ? m.length : 0; }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }

  var LEVEL_NAME = { 'easy': 'Easy', 'ok': 'OK', 'hard': 'Hard', 'very-hard': 'Very hard' };
  var TYPE_LABEL = { 'passive': 'Passive', 'adverb': 'Adverb', 'complex-word': 'Complex word', 'filler': 'Filler', 'long-sentence': 'Long sentence', 'very-long-sentence': 'Very long', 'repeated-word': 'Repeated' };
  var INLINE_GROUP = { 'passive': 'passive', 'complex-word': 'complex', 'adverb': 'style', 'filler': 'style', 'repeated-word': 'style' };

  var toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.classList.remove('show'); }, 2600);
  }

  /* ---------------- gauge geometry ---------------- */
  var CX = 130, CY = 130, R = 100;
  function pt(v, r) { var a = Math.PI * (1 - v / 100); return [CX + (r || R) * Math.cos(a), CY - (r || R) * Math.sin(a)]; }
  function arc(a, b) { var p = pt(a), q = pt(b); return 'M ' + p[0].toFixed(2) + ' ' + p[1].toFixed(2) + ' A ' + R + ' ' + R + ' 0 0 1 ' + q[0].toFixed(2) + ' ' + q[1].toFixed(2); }
  (function buildGauge() {
    var zones = [[0, 30], [30, 50], [50, 70], [70, 100]];
    zones.forEach(function (z, i) {
      var g = 0.7;
      $('#gz' + (i + 1)).setAttribute('d', arc(z[0] + (i ? g : 0), z[1] - (i < 3 ? g : 0)));
    });
    var ticks = '';
    [30, 50, 70].forEach(function (v) { var p = pt(v, 132); ticks += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="middle">' + v + '</text>'; });
    ticks += '<text x="30" y="160" text-anchor="middle">0</text><text x="230" y="160" text-anchor="middle">100</text>';
    $('#gTicks').innerHTML = ticks;
  })();

  /* ---------------- state ---------------- */
  var state = { text: null, result: null, ease: 0, slide: 0, hardest: [], lastAnnounce: '', issueList: [] };

  /* ---------------- editor ---------------- */
  var autosizeRaf = 0;
  function autosize() {
    cancelAnimationFrame(autosizeRaf);
    autosizeRaf = requestAnimationFrame(function () {
      var i = el.input;
      i.style.height = 'auto';
      var max = Math.max(320, window.innerHeight * 0.7);
      i.style.height = Math.min(i.scrollHeight + 4, max) + 'px';
    });
  }
  function updateCounter() {
    var t = el.input.value;
    var w = countWords(t);
    el.counter.textContent = fmtInt(w) + (w === 1 ? ' word' : ' words') + ' · ' + fmtInt(t.length) + (t.length === 1 ? ' character' : ' characters');
  }

  var debounce;
  el.input.addEventListener('input', function () {
    autosize();
    updateCounter();
    clearTimeout(debounce);
    debounce = setTimeout(function () { analyze(false); }, 300);
  });
  el.input.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); analyze(true, true); }
  });
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && e.target !== el.input && el.input.value.trim()) { e.preventDefault(); analyze(true, true); }
  });
  el.run.addEventListener('click', function () {
    if (!el.input.value.trim()) { toast('Paste some text first — or try a sample.'); el.input.focus(); return; }
    analyze(true, true);
  });
  el.clear.addEventListener('click', function () {
    el.input.value = '';
    updateCounter(); autosize();
    analyze(true);
    el.input.focus();
  });

  function setText(t, label) {
    el.input.value = t;
    updateCounter(); autosize();
    analyze(true, true);
    if (label) toast('Loaded the ' + label + '.');
  }

  /* sample menu */
  function openMenu(focusFirst) {
    el.sampleMenu.hidden = false;
    el.sampleBtn.setAttribute('aria-expanded', 'true');
    if (focusFirst) $$('[role="menuitem"]', el.sampleMenu)[0].focus();
  }
  function closeMenu(refocus) {
    if (el.sampleMenu.hidden) return;
    el.sampleMenu.hidden = true;
    el.sampleBtn.setAttribute('aria-expanded', 'false');
    if (refocus) el.sampleBtn.focus();
  }
  el.sampleBtn.addEventListener('click', function () { el.sampleMenu.hidden ? openMenu(false) : closeMenu(false); });
  el.sampleBtn.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(true); }
  });
  el.sampleMenu.addEventListener('keydown', function (e) {
    var items = $$('[role="menuitem"]', el.sampleMenu), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeMenu(true); }
    else if (e.key === 'Tab') { closeMenu(false); }
  });
  el.sampleMenu.addEventListener('click', function (e) {
    var b = e.target.closest('[data-sample]');
    if (!b) return;
    closeMenu(false);
    setText(SAMPLES[b.dataset.sample], SAMPLE_NAMES[b.dataset.sample] + ' sample');
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.menu-wrap')) closeMenu(false);
  });
  el.emptySample.addEventListener('click', function () { setText(SAMPLES.legal, 'legal policy sample'); });

  /* upload + drag/drop (read locally with FileReader) */
  function readFile(f) {
    if (!f) return;
    if (!/\.(txt|md|markdown|text)$/i.test(f.name) && !/^text\//.test(f.type)) { toast('Please choose a .txt or .md file.'); return; }
    if (f.size > 2 * 1024 * 1024) { toast('That file is over 2 MB — try a shorter one.'); return; }
    var fr = new FileReader();
    fr.onload = function () { setText(String(fr.result || ''), null); toast('Loaded ' + f.name + ' — it stays on your device.'); };
    fr.onerror = function () { toast('Could not read that file.'); };
    fr.readAsText(f);
  }
  el.upload.addEventListener('click', function () { el.file.click(); });
  el.file.addEventListener('change', function () { readFile(el.file.files[0]); el.file.value = ''; });
  var dragDepth = 0;
  el.editorCard.addEventListener('dragenter', function (e) { if (hasFiles(e)) { e.preventDefault(); dragDepth++; el.editorCard.classList.add('is-dragging'); } });
  el.editorCard.addEventListener('dragover', function (e) { if (hasFiles(e)) e.preventDefault(); });
  el.editorCard.addEventListener('dragleave', function () { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) el.editorCard.classList.remove('is-dragging'); });
  el.editorCard.addEventListener('drop', function (e) {
    if (!hasFiles(e)) return;
    e.preventDefault(); dragDepth = 0; el.editorCard.classList.remove('is-dragging');
    readFile(e.dataTransfer.files[0]);
  });
  function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1; }

  /* ---------------- analysis ---------------- */
  function analyze(force, scroll) {
    clearTimeout(debounce);
    var text = el.input.value;
    if (!force && text === state.text) return;
    state.text = text;
    var r = null;
    try { r = window.Readable.analyze(text); } catch (err) { if (window.console) console.error('Readable engine error', err); }
    if (!r || !r.scores || !r.stats || !num(r.stats.words)) {
      state.result = null;
      el.body.hidden = true;
      el.empty.hidden = false;
      hidePop(true);
      if (text.trim() && force) toast('Add a full sentence or two to get a score.');
      return;
    }
    state.result = r;
    el.empty.hidden = true;
    el.body.hidden = false;
    render(r, text);
    if (scroll) {
      requestAnimationFrame(function () {
        el.results.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
      });
    }
  }

  function render(r, text) {
    var st = r.stats, sc = r.scores;
    el.short.hidden = num(st.words) >= 100;
    renderScore(sc, st, r);
    renderMetrics(sc, st);
    renderHardest(r);
    renderHighlight(r, text);
    renderHeat(r);
    renderWords(r);
    var ease = Math.round(clamp(num(sc.fleschReadingEase), 0, 100));
    var msg = 'Reading ease ' + ease + ' out of 100, ' + (sc.label || '') + '. Letter grade ' + (sc.letter || '') + '.';
    if (msg !== state.lastAnnounce) { state.lastAnnounce = msg; el.live.textContent = msg; }
  }

  /* score card */
  var countRaf = 0;
  function countTo(node, from, to) {
    cancelAnimationFrame(countRaf);
    if (REDUCED || from === to || document.hidden) { node.textContent = to; return; }
    var t0 = performance.now(), dur = 900;
    (function step(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      node.textContent = Math.round(from + (to - from) * e);
      if (p < 1) countRaf = requestAnimationFrame(step);
    })(t0);
  }
  function renderScore(sc, st, r) {
    var ease = Math.round(clamp(num(sc.fleschReadingEase), 0, 100));
    countTo(el.easeNum, state.ease, ease);
    state.ease = ease;
    el.needle.style.transform = 'rotate(' + (ease * 1.8).toFixed(1) + 'deg)';
    var L = String(sc.letter || '?').toUpperCase().charAt(0);
    if (el.letter.dataset.letter !== L) {
      el.letter.classList.remove('pop'); void el.letter.offsetWidth; el.letter.classList.add('pop');
    }
    el.letter.dataset.letter = L;
    el.letter.textContent = L;
    el.letter.setAttribute('aria-label', 'Letter grade ' + L);
    el.label.textContent = sc.label || '—';
    el.audience.textContent = sc.audience ? String(sc.audience).replace(/\.?$/, '.') : '';
    el.consensus.textContent = gradeWord(num(sc.consensusGrade, NaN)) || fmt1(sc.consensusGrade);
    el.readChip.textContent = fmtTime(st.readingTimeSec);
    var hardN = (r.sentences || []).filter(function (s) { return s.level === 'hard' || s.level === 'very-hard'; }).length;
    el.hardChip.textContent = hardN;
    el.hardChip.parentNode.lastChild.textContent = hardN === 1 ? ' hard sentence' : ' hard sentences';
  }

  /* metrics */
  var METRICS = [
    { k: 'consensusGrade', label: 'Consensus grade', grade: true, tip: 'The middle of the five grade formulas — the best single estimate of the school grade a reader needs.' },
    { k: 'fleschKincaidGrade', label: 'Flesch–Kincaid', grade: true, tip: 'US school grade from average sentence length and syllables per word.' },
    { k: 'gunningFog', label: 'Gunning Fog', grade: true, tip: 'Years of schooling needed. Long sentences and words of three or more syllables push it up.' },
    { k: 'smog', label: 'SMOG', grade: true, tip: 'Grade estimate from how many words have three or more syllables. Popular in health writing.' },
    { k: 'colemanLiau', label: 'Coleman–Liau', grade: true, tip: 'Grade from letters per word and sentences per 100 words — no syllable counting.' },
    { k: 'ari', label: 'ARI', grade: true, tip: 'Automated Readability Index: characters per word plus words per sentence.' },
    { k: 'words', label: 'Words', stat: true, tip: 'Total words in your text.' },
    { k: 'sentences', label: 'Sentences', stat: true, tip: 'Sentences found, including headings and one-line greetings.' },
    { k: 'avgWordsPerSentence', label: 'Words / sentence', stat: true, tip: 'Average sentence length. Aim for 15–20; vary it so the rhythm doesn’t drone.' },
    { k: 'readingTimeSec', label: 'Reading time', stat: true, tip: 'Estimated time to read silently at a typical adult pace.' },
    { k: 'speakingTimeSec', label: 'Speaking time', stat: true, tip: 'Estimated time to read aloud at a comfortable presenting pace.' },
    { k: 'complexPct', label: 'Complex words', stat: true, tip: 'Share of words with three or more syllables. Under 10% reads easily.' }
  ];
  function renderMetrics(sc, st) {
    var html = METRICS.map(function (m) {
      var value, sub = '', pip = '';
      if (m.grade) {
        var g = num(sc[m.k], NaN);
        value = fmt1(g);
        sub = gradeWord(g);
        if (isFinite(g)) pip = '<span class="pip pip-' + gradePip(g) + '" aria-hidden="true"></span>';
      } else if (m.k === 'readingTimeSec' || m.k === 'speakingTimeSec') {
        value = fmtTime(st[m.k]);
        sub = m.k === 'readingTimeSec' ? 'silent reading' : 'read aloud';
      } else if (m.k === 'complexPct') {
        var pct = num(st.words) ? num(st.complexWords) / num(st.words) * 100 : 0;
        value = Math.round(pct) + '%';
        sub = plural(num(st.complexWords), 'word');
        pip = '<span class="pip pip-' + (pct < 10 ? 'easy' : pct < 15 ? 'mid' : pct < 20 ? 'hard' : 'vhard') + '" aria-hidden="true"></span>';
      } else if (m.k === 'avgWordsPerSentence') {
        var a = num(st.avgWordsPerSentence);
        value = fmt1(a);
        sub = a <= 20 ? 'comfortable' : a <= 25 ? 'a bit long' : 'too long';
        pip = '<span class="pip pip-' + (a <= 17 ? 'easy' : a <= 21 ? 'mid' : a <= 25 ? 'hard' : 'vhard') + '" aria-hidden="true"></span>';
      } else {
        value = fmtInt(st[m.k]);
        sub = m.k === 'words' ? plural(num(st.paragraphs), 'paragraph') : (num(st.sentences) ? 'in your text' : '');
      }
      var id = 'tip-' + m.k;
      return '<div class="metric' + (m.stat ? ' is-stat' : '') + '">' +
        '<div class="metric-top"><span class="metric-label">' + esc(m.label) + '</span>' +
        '<button class="info" type="button" aria-label="What is ' + esc(m.label) + '?" aria-describedby="' + id + '">i</button>' +
        '<span class="tip" role="tooltip" id="' + id + '">' + esc(m.tip) + '</span></div>' +
        '<div class="metric-value">' + esc(value) + pip + '</div>' +
        '<div class="metric-sub">' + esc(sub) + '</div></div>';
    }).join('');
    el.metrics.innerHTML = html;
  }

  /* five hardest */
  function issuesIn(r, s) {
    return (r.issues || []).filter(function (it) { return it.start >= s.start && it.end <= s.end; });
  }
  function slideHTML(s, i, n, r) {
    var rank = s.rank || (i + 1);
    var lvl = LEVEL_NAME[s.level] ? s.level : 'hard';
    var diff = clamp(Math.round(num(s.difficulty)), 0, 100);
    var reasons = (s.reasons || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    var seen = Object.create(null), fixes = [];
    issuesIn(r, s).forEach(function (it) {
      var key = it.type + '|' + String(it.text || '').toLowerCase();
      if (seen[key] || fixes.length >= 5) return;
      seen[key] = 1;
      var quoted = (it.type === 'long-sentence' || it.type === 'very-long-sentence' || !it.text || String(it.message || '').toLowerCase().indexOf(String(it.text).toLowerCase()) !== -1) ? '' : '<b>“' + esc(it.text) + '”</b> ';
      fixes.push('<li><span class="fix-tag tag-' + esc(it.type) + '">' + esc(TYPE_LABEL[it.type] || it.type) + '</span><span>' + quoted + esc(it.message || '') +
        (it.suggestion ? ' <span class="fix-sug">' + esc(it.suggestion) + '</span>' : '') + '</span></li>');
    });
    if (!fixes.length) {
      var tip = num(s.words) > 20 ? 'Split it at a natural pause — aim for under 20 words per sentence.' : 'Swap long words for short ones and cut any word that isn’t pulling its weight.';
      fixes.push('<li><span class="fix-tag tag-tip">Tip</span><span>' + esc(tip) + '</span></li>');
    }
    var slideText = (state.text && typeof s.start === 'number' && typeof s.end === 'number') ? state.text.slice(s.start, s.end) : s.text;
    return '<article class="slide" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + n + '" data-i="' + i + '"' + (i ? ' hidden' : '') + '>' +
      '<div class="rank-big" aria-hidden="true">' + rank + '</div>' +
      '<div class="slide-body">' +
      '<div class="slide-meta"><span class="lvl-pill ' + lvl + '">' + LEVEL_NAME[lvl] + '</span>' +
      '<span class="meta-pill">' + esc(gradeWord(num(s.grade, NaN)) || ('Grade ' + fmt1(s.grade))) + '</span>' +
      '<span class="meta-pill">' + plural(num(s.words), 'word') + '</span>' +
      '<span class="sr-only">Hardest sentence number ' + rank + '.</span></div>' +
      '<p class="slide-text">' + esc(slideText) + '</p>' +
      (reasons ? '<ul class="reasons" aria-label="Why it is hard">' + reasons + '</ul>' : '') +
      '<div class="diff"><span class="diff-label">Difficulty</span><div class="diff-track" role="img" aria-label="Difficulty ' + diff + ' out of 100"><div class="diff-fill" data-w="' + diff + '" style="--full:' + (diff ? (10000 / diff).toFixed(1) : 100) + '%"></div></div><span class="diff-val">' + diff + '/100</span></div>' +
      '<div class="fixes"><h4>What to try</h4><ul>' + fixes.join('') + '</ul></div>' +
      '<div class="slide-actions"><button class="btn btn-ink btn-sm" type="button" data-jump="' + esc(s.index) + '">Jump to it in your text' +
      '<svg class="btn-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
      '</div></article>';
  }
  function renderHardest(r) {
    var list = (r.hardest || []).slice(0, 5).sort(function (a, b) { return num(a.rank, 9) - num(b.rank, 9); });
    state.hardest = list;
    var stepper = $('.stepper', el.carousel);
    if (!list.length) {
      el.slides.innerHTML = '<article class="slide"><div class="rank-big" aria-hidden="true">✓</div><div class="slide-body">' +
        '<div class="slide-meta"><span class="lvl-pill easy">All clear</span></div>' +
        '<p class="slide-text-plain" style="font:600 22px/1.4 var(--sans);margin:0 0 8px;letter-spacing:-.02em">No hard sentences found.</p>' +
        '<p style="margin:0;color:var(--ink-soft)">Every sentence reads comfortably. Nice work — keep sentences short and words familiar.</p></div></article>';
      stepper.hidden = true;
      return;
    }
    stepper.hidden = list.length < 2;
    el.slides.innerHTML = list.map(function (s, i) { return slideHTML(s, i, list.length, r); }).join('');
    el.dots.innerHTML = list.map(function (s, i) {
      return '<button type="button" aria-label="Show hardest sentence ' + (i + 1) + '"><span></span></button>';
    }).join('');
    state.slide = -1;
    go(0, 0);
  }
  function go(i, dir) {
    var slides = $$('.slide', el.slides);
    if (!slides.length) return;
    i = clamp(i, 0, slides.length - 1);
    if (i === state.slide) return;
    state.slide = i;
    slides.forEach(function (s, k) {
      var on = k === i;
      s.hidden = !on;
      s.classList.remove('enter-next', 'enter-prev');
      if (on && dir && !REDUCED) { void s.offsetWidth; s.classList.add(dir > 0 ? 'enter-next' : 'enter-prev'); }
    });
    $$('button', el.dots).forEach(function (b, k) {
      if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
    el.prev.disabled = i === 0;
    el.next.disabled = i === slides.length - 1;
    var fill = $('.diff-fill', slides[i]);
    if (fill) {
      if (REDUCED) fill.style.width = fill.dataset.w + '%';
      else { fill.style.width = '0'; requestAnimationFrame(function () { requestAnimationFrame(function () { fill.style.width = fill.dataset.w + '%'; }); }); }
    }
  }
  el.prev.addEventListener('click', function () { go(state.slide - 1, -1); });
  el.next.addEventListener('click', function () { go(state.slide + 1, 1); });
  el.dots.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var i = $$('button', el.dots).indexOf(b);
    go(i, i > state.slide ? 1 : -1);
  });
  el.carousel.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(state.slide + 1, 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(state.slide - 1, -1); }
  });
  (function swipe() {
    var x0 = null, y0 = null;
    el.slides.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
    el.slides.addEventListener('pointerup', function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(state.slide + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    });
    el.slides.addEventListener('pointercancel', function () { x0 = null; });
  })();
  el.slides.addEventListener('click', function (e) {
    var b = e.target.closest('[data-jump]');
    if (b) jumpTo(b.dataset.jump);
  });
  function jumpTo(index) {
    var node = document.getElementById('sent-' + index);
    if (!node) return;
    hidePop(true);
    node.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
    var badge = $('.rank-badge', node);
    setTimeout(function () { (badge || el.hl).focus({ preventScroll: true }); }, REDUCED ? 0 : 450);
  }

  /* highlighted text — built once per analysis by slicing the original string */
  function renderHighlight(r, text) {
    var sents = (r.sentences || []).filter(function (s) { return typeof s.start === 'number' && typeof s.end === 'number' && s.end > s.start; })
      .slice().sort(function (a, b) { return a.start - b.start; });
    var inline = (r.issues || []).filter(function (it) { return INLINE_GROUP[it.type] && it.end > it.start; })
      .slice().sort(function (a, b) { return a.start - b.start || (b.end - b.start) - (a.end - a.start); });
    var counts = { passive: 0, complex: 0, style: 0 };
    var store = [];
    var ii = 0;
    function emit(from, to) {
      var out = '', p = from;
      while (ii < inline.length && inline[ii].start < to) {
        var it = inline[ii];
        if (it.start < p || it.end > to) { ii++; continue; }
        out += esc(text.slice(p, it.start));
        var g = INLINE_GROUP[it.type];
        counts[g]++;
        var id = store.push(it) - 1;
        out += '<mark class="iss iss-' + g + '" tabindex="0" data-issue="' + id + '">' + esc(text.slice(it.start, it.end)) + '</mark>';
        p = it.end; ii++;
      }
      return out + esc(text.slice(p, to));
    }
    var html = '', pos = 0;
    sents.forEach(function (s) {
      if (s.start < pos) return;
      html += emit(pos, s.start);
      var lvl = LEVEL_NAME[s.level] ? s.level : 'easy';
      var top = s.rank ? ' is-top' : '';
      html += '<span class="s lvl-' + lvl + top + '" id="sent-' + esc(s.index) + '" data-s="' + esc(s.index) + '">';
      if (s.rank) html += '<span class="rank-badge" role="button" tabindex="0" data-rank="' + esc(s.rank) + '" data-sent="' + esc(s.index) + '" aria-label="Hardest sentence ' + esc(s.rank) + ': show details"></span>';
      html += emit(s.start, s.end) + '</span>';
      pos = s.end;
    });
    html += emit(pos, text.length);
    state.issueList = store;
    state.sentById = Object.create(null);
    (r.sentences || []).forEach(function (s) { state.sentById[s.index] = s; });
    hidePop(true);
    el.hl.innerHTML = html;
    $('#countPassive').textContent = counts.passive;
    $('#countComplex').textContent = counts.complex;
    $('#countStyle').textContent = counts.style;
    applyFilters();
  }

  /* filters */
  $$('.filter').forEach(function (b) {
    b.addEventListener('click', function () {
      b.setAttribute('aria-pressed', b.getAttribute('aria-pressed') === 'true' ? 'false' : 'true');
      applyFilters();
    });
  });
  function applyFilters() {
    $$('.filter').forEach(function (b) {
      var f = b.dataset.filter, on = b.getAttribute('aria-pressed') === 'true';
      el.hl.classList.toggle('hide-' + f, !on);
      var sel = f === 'hardest' ? '.rank-badge' : (f === 'levels' ? null : '.iss-' + f);
      if (sel) $$(sel, el.hl).forEach(function (n) { n.tabIndex = on ? 0 : -1; });
    });
    hidePop(true);
  }

  /* popover */
  var popTarget = null, popPinned = false, popHideTimer = 0;
  function popContent(t) {
    if (t.classList.contains('rank-badge')) {
      var s = state.sentById && state.sentById[t.dataset.sent];
      if (!s) return '';
      return '<span class="fix-tag tag-tip pop-type">Hardest #' + esc(t.dataset.rank) + '</span>' +
        '<p class="pop-msg">' + esc(LEVEL_NAME[s.level] || '') + ' · ' + esc(gradeWord(num(s.grade, NaN))) + ' · ' + plural(num(s.words), 'word') + '</p>' +
        ((s.reasons && s.reasons.length) ? '<ul class="pop-reasons">' + s.reasons.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '') +
        '<p class="pop-msg" style="margin-top:8px;color:#B9C4C6">Click to open its fixes.</p>';
    }
    var it = state.issueList[t.dataset.issue];
    if (!it) return '';
    return '<span class="fix-tag tag-' + esc(it.type) + ' pop-type">' + esc(TYPE_LABEL[it.type] || it.type) + '</span>' +
      '<p class="pop-msg">' + esc(it.message || '') + '</p>' +
      (it.suggestion ? '<p class="pop-sug">' + esc(it.suggestion) + '</p>' : '');
  }
  function isActive(t) {
    if (t.classList.contains('rank-badge')) return !el.hl.classList.contains('hide-hardest');
    var g = (t.className.match(/iss-(\w+)/) || [])[1];
    return g && !el.hl.classList.contains('hide-' + g);
  }
  function showPop(t, pin) {
    if (!isActive(t)) return;
    clearTimeout(popHideTimer);
    var html = popContent(t);
    if (!html) return;
    if (popTarget && popTarget !== t) { popTarget.classList.remove('is-active'); popTarget.removeAttribute('aria-describedby'); }
    popTarget = t; popPinned = !!pin;
    t.classList.add('is-active');
    t.setAttribute('aria-describedby', 'popover');
    el.pop.innerHTML = html;
    el.pop.hidden = false;
    placePop();
  }
  function placePop() {
    if (!popTarget || el.pop.hidden) return;
    var rects = popTarget.getClientRects(), rect = rects.length ? rects[0] : popTarget.getBoundingClientRect();
    var pw = el.pop.offsetWidth, ph = el.pop.offsetHeight, vw = document.documentElement.clientWidth;
    var cx = rect.left + rect.width / 2;
    var left = clamp(cx - pw / 2, 16, Math.max(16, vw - pw - 16));
    var above = rect.bottom + ph + 18 > window.innerHeight && rect.top - ph - 18 > 0;
    var top = above ? rect.top - ph - 12 : rect.bottom + 12;
    el.pop.classList.toggle('above', above);
    el.pop.style.left = (left + window.scrollX) + 'px';
    el.pop.style.top = (top + window.scrollY) + 'px';
    el.pop.style.setProperty('--arrow', clamp(cx - left, 18, pw - 18) + 'px');
  }
  function hidePop(force) {
    if (!force && popPinned) return;
    clearTimeout(popHideTimer);
    if (popTarget) { popTarget.classList.remove('is-active'); popTarget.removeAttribute('aria-describedby'); }
    popTarget = null; popPinned = false;
    el.pop.hidden = true;
  }
  var TARGETS = '.iss, .rank-badge';
  el.hl.addEventListener('mouseover', function (e) {
    var t = e.target.closest(TARGETS);
    if (t && !popPinned) showPop(t, false);
  });
  el.hl.addEventListener('mouseout', function (e) {
    var t = e.target.closest(TARGETS);
    if (!t || popPinned) return;
    if (e.relatedTarget && t.contains(e.relatedTarget)) return;
    popHideTimer = setTimeout(function () { hidePop(false); }, 120);
  });
  el.hl.addEventListener('focusin', function (e) {
    var t = e.target.closest(TARGETS);
    if (t) showPop(t, false);
  });
  el.hl.addEventListener('focusout', function (e) {
    if (e.target.closest(TARGETS) && !popPinned) hidePop(false);
  });
  el.hl.addEventListener('click', function (e) {
    var t = e.target.closest(TARGETS);
    if (!t) return;
    if (t.classList.contains('rank-badge')) { openSlideFor(t.dataset.sent); return; }
    if (popTarget === t && popPinned) hidePop(true); else showPop(t, true);
  });
  el.hl.addEventListener('keydown', function (e) {
    var t = e.target.closest(TARGETS);
    if (e.key === 'Escape') { hidePop(true); return; }
    if (t && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      if (t.classList.contains('rank-badge')) openSlideFor(t.dataset.sent);
      else if (popTarget === t && popPinned) hidePop(true); else showPop(t, true);
    }
  });
  el.hl.addEventListener('scroll', function () { if (!el.pop.hidden) placePop(); }, { passive: true });
  document.addEventListener('click', function (e) { if (popPinned && !e.target.closest(TARGETS) && !e.target.closest('#popover')) hidePop(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.pop.hidden) hidePop(true); });
  window.addEventListener('resize', function () { if (!el.pop.hidden) placePop(); });
  window.addEventListener('scroll', function () { if (!el.pop.hidden) placePop(); }, { passive: true });

  function openSlideFor(sentIndex) {
    var i = -1;
    state.hardest.forEach(function (s, k) { if (String(s.index) === String(sentIndex)) i = k; });
    if (i < 0) return;
    hidePop(true);
    go(i, i > state.slide ? 1 : -1);
    el.carousel.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    var btn = $('.slide:not([hidden]) [data-jump]', el.slides);
    if (btn) setTimeout(function () { btn.focus({ preventScroll: true }); }, REDUCED ? 0 : 450);
  }

  /* paragraph heat strip */
  function easeWord(v) { return v >= 70 ? 'easy' : v >= 60 ? 'plain' : v >= 50 ? 'fairly difficult' : v >= 30 ? 'difficult' : 'very difficult'; }
  function renderHeat(r) {
    var paras = (r.paragraphs || []).filter(function (p) { return num(p.words) > 0; });
    if (!paras.length) { el.heat.innerHTML = ''; return; }
    var total = paras.reduce(function (a, p) { return a + num(p.words); }, 0);
    el.heat.innerHTML = paras.map(function (p, i) {
      var e = Math.round(clamp(num(p.fleschReadingEase), 0, 100));
      var h = 34 + (100 - e) * 0.66;
      var label = 'Paragraph ' + (i + 1) + ': ' + plural(num(p.words), 'word') + ', reading ease ' + e + ' (' + easeWord(e) + ')';
      return '<button type="button" class="heat-bar z-' + easeZone(e) + '" style="--w:' + Math.max(1, num(p.words) / total * 100).toFixed(2) + ';--h:' + h.toFixed(0) + '%;--d:' + (Math.min(i, 20) * 0.04).toFixed(2) + 's" data-start="' + esc(p.start) + '" data-pi="' + esc(p.index) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '. Jump to it."></button>';
    }).join('');
  }
  el.heat.addEventListener('click', function (e) {
    var b = e.target.closest('.heat-bar');
    if (!b || !state.result) return;
    var start = +b.dataset.start, pi = b.dataset.pi, target = null;
    (state.result.sentences || []).some(function (s) {
      if (String(s.paragraph) === String(pi) || s.start >= start) { target = s; return true; }
      return false;
    });
    if (target) jumpTo(target.index);
  });

  /* word chips */
  function renderWords(r) {
    var list = (r.wordFrequency || []).filter(function (w) { return w && w.word; }).slice(0, 14);
    el.words.innerHTML = list.length ? list.map(function (w) {
      return '<li>' + esc(w.word) + '<b aria-label="' + esc(w.count) + ' times">' + esc(w.count) + '</b></li>';
    }).join('') : '<li class="none">Not enough words yet.</li>';
  }

  /* ---------------- report / share ---------------- */
  function buildReport() {
    var r = state.result;
    if (!r) return '';
    var sc = r.scores, st = r.stats, text = state.text || '';
    var lines = [];
    lines.push('READABLE — readability report');
    lines.push('================================');
    lines.push('Reading ease: ' + Math.round(num(sc.fleschReadingEase)) + '/100 — ' + (sc.label || '') + ' (grade ' + (sc.letter || '?') + ')');
    if (sc.audience) lines.push(String(sc.audience).replace(/\.?$/, '.'));
    lines.push('');
    lines.push('Consensus grade: ' + fmt1(sc.consensusGrade) + ' (' + gradeWord(num(sc.consensusGrade, NaN)) + ')');
    lines.push('Flesch–Kincaid ' + fmt1(sc.fleschKincaidGrade) + ' · Gunning Fog ' + fmt1(sc.gunningFog) + ' · SMOG ' + fmt1(sc.smog) +
      ' · Coleman–Liau ' + fmt1(sc.colemanLiau) + ' · ARI ' + fmt1(sc.ari));
    lines.push('');
    var pct = num(st.words) ? Math.round(num(st.complexWords) / num(st.words) * 100) : 0;
    lines.push('Words: ' + fmtInt(st.words) + ' · Sentences: ' + fmtInt(st.sentences) + ' · Paragraphs: ' + fmtInt(st.paragraphs));
    lines.push('Average sentence: ' + fmt1(st.avgWordsPerSentence) + ' words · Complex words: ' + pct + '%');
    lines.push('Reading time: ' + fmtTime(st.readingTimeSec) + ' · Speaking time: ' + fmtTime(st.speakingTimeSec));
    var hard = state.hardest;
    if (hard.length) {
      lines.push('');
      lines.push('THE ' + (hard.length === 5 ? 'FIVE' : hard.length) + ' HARDEST SENTENCES');
      hard.forEach(function (s, i) {
        var body = (typeof s.start === 'number') ? text.slice(s.start, s.end) : s.text;
        lines.push('');
        lines.push((s.rank || i + 1) + '. "' + String(body).replace(/\s+/g, ' ').trim() + '"');
        lines.push('   ' + (LEVEL_NAME[s.level] || '') + ' · ' + gradeWord(num(s.grade, NaN)) + ' · ' + plural(num(s.words), 'word') + ' · difficulty ' + Math.round(num(s.difficulty)) + '/100');
        if (s.reasons && s.reasons.length) lines.push('   Why: ' + s.reasons.join('; '));
        var seen = Object.create(null);
        issuesIn(r, s).forEach(function (it) {
          var k = it.type + '|' + it.text;
          if (seen[k]) return; seen[k] = 1;
          lines.push('   - ' + (TYPE_LABEL[it.type] || it.type) + (it.text && it.type.indexOf('sentence') === -1 ? ' "' + it.text + '"' : '') + ': ' + (it.message || '') + (it.suggestion ? ' Try: ' + it.suggestion : ''));
        });
      });
    }
    var c = { passive: 0, complex: 0, style: 0 };
    (r.issues || []).forEach(function (it) { var g = INLINE_GROUP[it.type]; if (g) c[g]++; });
    lines.push('');
    lines.push('Flags: ' + plural(c.passive, 'passive construction') + ' · ' + plural(c.complex, 'complex word') + ' · ' + plural(c.style, 'adverb/filler'));
    var top = (r.wordFrequency || []).slice(0, 8).map(function (w) { return w.word + ' (' + w.count + ')'; });
    if (top.length) lines.push('Most used words: ' + top.join(', '));
    lines.push('');
    lines.push('Scores are estimates from standard readability formulas.');
    lines.push('Checked privately in the browser with Readable — https://jeetjhawar.github.io/readability/');
    return lines.join('\n');
  }
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) {
      var ta = document.createElement('textarea');
      ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy') ? res() : rej(); } catch (e) { rej(e); }
      document.body.removeChild(ta);
    });
  }
  el.copy.addEventListener('click', function () {
    var rep = buildReport();
    if (!rep) return;
    copyText(rep).then(function () { toast('Report copied to your clipboard.'); }, function () { toast('Copy failed — try the download instead.'); });
  });
  el.download.addEventListener('click', function () {
    var rep = buildReport();
    if (!rep) return;
    var blob = new Blob([rep], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'readable-report.txt';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('Downloaded readable-report.txt');
  });
  el.share.addEventListener('click', function () {
    if (!state.result) return;
    // Only the score goes into the link — never the text.
    var url = location.origin + location.pathname + '#score=' + state.ease;
    copyText(url).then(function () { toast('Link copied — it shares only your score (' + state.ease + ').'); }, function () { toast(url); });
  });

  function scoreLabel(v) { return v >= 90 ? 'Very easy' : v >= 80 ? 'Easy' : v >= 70 ? 'Fairly easy' : v >= 60 ? 'Plain English' : v >= 50 ? 'Fairly difficult' : v >= 30 ? 'Difficult' : 'Very difficult'; }
  function checkHash() {
    var m = /^#score=(\d{1,3})$/.exec(location.hash);
    if (!m || +m[1] > 100) return;
    var v = +m[1];
    $('#shareScore').textContent = v;
    $('#shareScoreText').textContent = v;
    $('#shareScoreLabel').textContent = 'That reads as “' + scoreLabel(v) + '”.';
    el.banner.hidden = false;
  }
  function closeBanner() {
    el.banner.hidden = true;
    if (/^#score=/.test(location.hash) && history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }
  el.bannerClose.addEventListener('click', closeBanner);
  el.bannerCta.addEventListener('click', function () { closeBanner(); setTimeout(function () { el.input.focus({ preventScroll: true }); }, 400); });
  window.addEventListener('hashchange', checkHash);

  /* ---------------- motion: header, reveal, parallax ---------------- */
  var ticking = false;
  var shapes = $$('[data-parallax]');
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.scrollY;
      el.header.classList.toggle('is-scrolled', y > 12);
      if (!REDUCED && y < window.innerHeight * 1.5) {
        shapes.forEach(function (s) { s.style.transform = 'translate3d(0,' + (y * parseFloat(s.dataset.parallax)).toFixed(1) + 'px,0)'; });
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var reveals = $$('.reveal');
  if (REDUCED || !('IntersectionObserver' in window)) {
    reveals.forEach(function (n) { n.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (n, i) { n.style.transitionDelay = (n.closest('.how-grid') ? (i % 4) * 70 : 0) + 'ms'; io.observe(n); });
  }

  /* ---------------- boot ---------------- */
  updateCounter();
  checkHash();
  var startSample = params.get('sample');
  if (startSample && SAMPLES[startSample]) {
    el.input.value = SAMPLES[startSample];
    updateCounter(); autosize();
    analyze(true, false);
  } else if (el.input.value.trim()) {
    // browsers may restore textarea content on back/forward navigation
    autosize(); analyze(true, false);
  }
})();
