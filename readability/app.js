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
  var MOTION = !REDUCED;

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
    banner: $('#shareBanner'), bannerClose: $('#shareClose'), bannerCta: $('#shareCta'),
    summary: $('#summary'), confPill: $('#confPill'), confText: $('#confText'), typeChip: $('#typeChip'), typeText: $('#typeText'),
    scoreCard: $('#scoreCard'), hlCard: $('#hlCard'), sChip: $('#sChip')
  };

  /* ---------------- sample texts: Jeet's own CV and skills ---------------- */
  var SAMPLES = {
      "council": "Students' Council web app — scouncilbms.vercel.app\n\nThe BMS Students' Council at IIM Kozhikode runs on a platform I built on my own with Claude Code, using Next.js and Supabase. The public site covers 4 committees and 10 clubs, with events that move from upcoming to live to archive on their own, a calendar, a gallery, notices and search across every year.\n\nBehind the login, committees get a working portal. Only official committee and council accounts can sign in. Tasks can have several assignees, and the whole committee can see them. There is attendance, committee chat, and a document vault where each committee files event and expense reports on its own letterhead.\n\nAnnouncements expire after a week, and a retired club keeps its history. Before handing it over, I ran a security review of the whole app.",
      "blindbluff": "Blind Bluff — blindbluff.com\n\nBlind Bluff is a small games brand I started in 2026. I built its online store myself, and it takes real payments. Customers pay through Razorpay, which went live in August 2026. Each paid order goes straight to Shiprocket, and the tracking number syncs back to the order on its own.\n\nBehind the store is an admin panel for orders, refunds, discount codes and the newsletter. Every table is locked down with row-level security, and the sign-in pages are protected against bots.\n\nThree card games are on sale, and six more are in production, including three murder mysteries.",
      "freshers": "Freshers' night — SEQUEL 26\n\nI led SEQUEL 26, the freshers' night for the second BMS batch at IIM Kozhikode, and built its ticketing site. Students paid by UPI, the site checked each payment and issued a QR pass, and a dashboard let the door team check people in.\n\n150+ students bought passes, and ticket sales reached ₹1.67 lakh. Every payment was reconciled into a full P&L within two days of the event.\n\nBefore the night, I also built the sign-up site where seniors registered to perform or volunteer. Their answers went straight into a private sheet for the organisers.",
      "skills": "Skills\n\nTechnical\n- AI-assisted development with Claude Code\n- Next.js, Supabase, Firebase and React, HTML and JavaScript\n- Python: Selenium, BeautifulSoup, pandas and REST APIs\n- Advanced Excel and Google Sheets: pivot tables and XLOOKUP\n- Video editing in DaVinci Resolve\n\nProfessional\n- Event management, budgeting and P&L tracking\n- B2B outreach and sales coordination\n- Public speaking: 1st in English elocution at school, Best Delegate at Masters' Summit MUN\n- Rapid chess: 1st in Under-20 with 6 out of 6 at the International Chess Day Trophy 2026",
      "wordy": "Wordy CV draft (before editing)\n\nIn my capacity as a Council Member, I was entrusted with the conceptualisation and subsequent implementation of a comprehensive digital infrastructure for the Students' Council, thereby facilitating the streamlined administration of committee operations, documentation and institutional reporting across four committees and ten clubs.\n\nAdditionally, as overall lead for SEQUEL 26, the freshers' night that was organised for the incoming second BMS batch, I was responsible for operationalising a ticketing infrastructure which facilitated the procurement of passes by in excess of 150 students and generated ticket revenues amounting to approximately ₹1.67 lakh.\n\nThe same thing, edited: I built the Students' Council's website, and 4 committees and 10 clubs run on it. I also built the ticketing site for SEQUEL 26, where 150+ students bought ₹1.67 lakh of passes."
  };
  var SAMPLE_NAMES = {"council": "Students' Council app", "blindbluff": "Blind Bluff store", "freshers": "freshers' night", "skills": "skills list", "wordy": "wordy CV draft"};

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
  el.emptySample.addEventListener('click', function () { setText(SAMPLES.council, "Students' Council app sample"); });

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
    var ease = Math.round(clamp(num(easeOf(sc)), 0, 100));
    var msg = 'Reading ease ' + ease + ' out of 100, ' + (sc.label || '') + '. Letter grade ' + (sc.letter || '') + '.';
    if (msg !== state.lastAnnounce) { state.lastAnnounce = msg; el.live.textContent = msg; }
    markDirty();
  }

  /* Gauge uses the engine's consensus score (v3) so it agrees with the letter; older engines fall back to Flesch. */
  function easeOf(sc) { return typeof sc.consensusEase === 'number' ? sc.consensusEase : sc.fleschReadingEase; }

  /* score card */
  function countTo(node, from, to, dur) {
    countUp(node, from, to, 0, '', dur || 900);
  }
  /* The gauge holds at 0 until the score card is on screen, then sweeps. */
  var gauge = { seen: false, shown: 0 };
  function showGauge(ease, from) {
    el.needle.classList.remove('no-anim');
    el.needle.style.transform = 'rotate(' + (ease * 1.8).toFixed(1) + 'deg)';
    countTo(el.easeNum, from, ease, 1100);
    gauge.shown = ease;
  }
  function resetGauge() {
    el.needle.classList.add('no-anim');
    el.needle.style.transform = 'rotate(0deg)';
    el.easeNum.textContent = '0';
    gauge.shown = 0;
  }
  function renderScore(sc, st, r) {
    var ease = Math.round(clamp(num(easeOf(sc)), 0, 100));
    state.ease = ease;
    if (!MOTION || gauge.seen) showGauge(ease, gauge.shown);
    else resetGauge();
    var L = String(sc.letter || '?').toUpperCase().charAt(0);
    if (el.letter.dataset.letter !== L) {
      el.letter.classList.remove('pop'); void el.letter.offsetWidth; el.letter.classList.add('pop');
    }
    el.letter.dataset.letter = L;
    el.letter.textContent = L;
    el.letter.setAttribute('aria-label', 'Letter grade ' + L);
    el.label.textContent = sc.label || '—';
    el.audience.textContent = sc.audience ? String(sc.audience).replace(/\.?$/, '.') : '';
    // Newer engine fields (all optional: hidden when an older engine leaves them out)
    var summary = typeof r.summary === 'string' ? r.summary.trim() : '';
    el.summary.textContent = summary;
    el.summary.hidden = !summary;
    var conf = r.confidence && typeof r.confidence === 'object' ? r.confidence : null;
    var showConf = !!(conf && conf.level && conf.level !== 'high' && conf.note);
    el.confPill.hidden = !showConf;
    if (showConf) {
      el.confText.textContent = String(conf.note);
      el.confPill.classList.toggle('is-low', conf.level === 'low');
    }
    var tt = typeof r.textType === 'string' ? r.textType.trim() : '';
    el.typeChip.hidden = !tt;
    if (tt) el.typeText.textContent = tt.replace(/[-_]+/g, ' ').toLowerCase();
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
    { k: 'complexPct', label: 'Complex words', stat: true, tip: 'Share of words with three or more syllables. Under 10% reads easily.' },
    { k: 'daleChall', label: 'Dale–Chall', opt: true, tip: 'Score from sentence length and how many words fall outside a list of about 3,000 words most 10-year-olds know. Under 6 is easy; 9 and up is college level.' },
    { k: 'unfamiliarPct', label: 'Unfamiliar words', stat: true, opt: true, tip: 'Share of words that are not on the Dale–Chall list of familiar words. Under 15% reads easily.' }
  ];
  function daleWord(v) { return v < 5 ? 'Grade 4 and below' : v < 6 ? 'Grades 5–6' : v < 7 ? 'Grades 7–8' : v < 8 ? 'Grades 9–10' : v < 9 ? 'Grades 11–12' : 'College level'; }
  // stats.unfamiliarWords is expected to be a count; a fraction or percent is handled too
  function unfamiliarPct(st) {
    var v = st.unfamiliarWords, w = num(st.words);
    if (typeof st.unfamiliarPct === 'number' && isFinite(st.unfamiliarPct)) return { pct: st.unfamiliarPct, count: null };
    if (typeof v !== 'number' || !isFinite(v) || v < 0) return null;
    if (Number.isInteger(v)) return w ? { pct: v / w * 100, count: v } : null;
    return { pct: v <= 1 ? v * 100 : v, count: null };
  }
  function cnt(v, dec, suffix) {
    return '<span class="cnt" data-to="' + v + '" data-dec="' + (dec || 0) + '" data-suf="' + esc(suffix || '') + '">' +
      esc(dec ? (Math.round(v * 10) / 10).toFixed(dec) : Math.round(v).toLocaleString('en-US')) + esc(suffix || '') + '</span>';
  }
  function renderMetrics(sc, st) {
    var list = METRICS.filter(function (m) {
      if (!m.opt) return true;
      if (m.k === 'daleChall') return typeof sc.daleChall === 'number' && isFinite(sc.daleChall);
      if (m.k === 'unfamiliarPct') return !!unfamiliarPct(st);
      return false;
    });
    var html = list.map(function (m, idx) {
      var value, sub = '', pip = '', vhtml = null;
      if (m.grade) {
        var g = num(sc[m.k], NaN);
        value = fmt1(g);
        if (isFinite(g)) vhtml = cnt(g, 1);
        sub = gradeWord(g);
        if (isFinite(g)) pip = '<span class="pip pip-' + gradePip(g) + '" aria-hidden="true"></span>';
      } else if (m.k === 'readingTimeSec' || m.k === 'speakingTimeSec') {
        value = fmtTime(st[m.k]);
        sub = m.k === 'readingTimeSec' ? 'silent reading' : 'read aloud';
      } else if (m.k === 'daleChall') {
        var dc = sc.daleChall;
        value = fmt1(dc); vhtml = cnt(dc, 1);
        sub = daleWord(dc);
        pip = '<span class="pip pip-' + (dc < 6 ? 'easy' : dc < 8 ? 'mid' : dc < 9 ? 'hard' : 'vhard') + '" aria-hidden="true"></span>';
      } else if (m.k === 'unfamiliarPct') {
        var u = unfamiliarPct(st);
        value = Math.round(u.pct) + '%'; vhtml = cnt(u.pct, 0, '%');
        sub = u.count != null ? plural(u.count, 'word') : 'of all words';
        pip = '<span class="pip pip-' + (u.pct < 15 ? 'easy' : u.pct < 22 ? 'mid' : u.pct < 30 ? 'hard' : 'vhard') + '" aria-hidden="true"></span>';
      } else if (m.k === 'complexPct') {
        var pct = num(st.words) ? num(st.complexWords) / num(st.words) * 100 : 0;
        value = Math.round(pct) + '%'; vhtml = cnt(pct, 0, '%');
        sub = plural(num(st.complexWords), 'word');
        pip = '<span class="pip pip-' + (pct < 10 ? 'easy' : pct < 15 ? 'mid' : pct < 20 ? 'hard' : 'vhard') + '" aria-hidden="true"></span>';
      } else if (m.k === 'avgWordsPerSentence') {
        var a = num(st.avgWordsPerSentence);
        value = fmt1(a); vhtml = cnt(a, 1);
        sub = a <= 20 ? 'comfortable' : a <= 25 ? 'a bit long' : 'too long';
        pip = '<span class="pip pip-' + (a <= 17 ? 'easy' : a <= 21 ? 'mid' : a <= 25 ? 'hard' : 'vhard') + '" aria-hidden="true"></span>';
      } else {
        value = fmtInt(st[m.k]);
        if (typeof st[m.k] === 'number' && isFinite(st[m.k])) vhtml = cnt(st[m.k], 0);
        sub = m.k === 'words' ? plural(num(st.paragraphs), 'paragraph') : (num(st.sentences) ? 'in your text' : '');
      }
      var id = 'tip-' + m.k;
      return '<div class="metric' + (m.stat ? ' is-stat' : '') + '" data-tilt style="--i:' + idx + '">' +
        '<div class="metric-top"><span class="metric-label">' + esc(m.label) + '</span>' +
        '<button class="info" type="button" data-cursor="Info" aria-label="What is ' + esc(m.label) + '?" aria-describedby="' + id + '">i</button>' +
        '<span class="tip" role="tooltip" id="' + id + '">' + esc(m.tip) + '</span></div>' +
        '<div class="metric-value">' + (vhtml || esc(value)) + pip + '</div>' +
        '<div class="metric-sub">' + esc(sub) + '</div></div>';
    }).join('');
    el.metrics.innerHTML = html;
    decorateTilt(el.metrics);
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
    var tryThis = (typeof s.tip === 'string' && s.tip.trim()) ? '<div class="try"><span class="try-tag">Try this</span><p>' + esc(s.tip.trim()) + '</p></div>' : '';
    return '<article class="slide" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' of ' + n + '" data-i="' + i + '"' + (n > 1 ? ' data-cursor="Drag"' : '') + (i ? ' hidden' : '') + '>' +
      '<div class="rank-big" aria-hidden="true">' + rank + '</div>' +
      '<div class="slide-body">' +
      '<div class="slide-meta"><span class="lvl-pill ' + lvl + '">' + LEVEL_NAME[lvl] + '</span>' +
      '<span class="meta-pill">' + esc(gradeWord(num(s.grade, NaN)) || ('Grade ' + fmt1(s.grade))) + '</span>' +
      '<span class="meta-pill">' + plural(num(s.words), 'word') + '</span>' +
      '<span class="sr-only">Hardest sentence number ' + rank + '.</span></div>' +
      '<p class="slide-text">' + esc(slideText) + '</p>' +
      (reasons ? '<ul class="reasons" aria-label="Why it is hard">' + reasons + '</ul>' : '') +
      '<div class="diff"><span class="diff-label">Difficulty</span><div class="diff-track" role="img" aria-label="Difficulty ' + diff + ' out of 100"><div class="diff-fill" data-w="' + diff + '" style="--full:' + (diff ? (10000 / diff).toFixed(1) : 100) + '%"></div></div><span class="diff-val">' + diff + '/100</span></div>' +
      tryThis +
      '<div class="fixes"><h4>' + (tryThis ? 'Also look at' : 'What to try') + '</h4><ul>' + fixes.join('') + '</ul></div>' +
      '<div class="slide-actions"><button class="btn btn-ink btn-sm" type="button" data-cursor="Jump" data-jump="' + esc(s.index) + '">Jump to it in your text' +
      '<svg class="btn-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button></div>' +
      '</div></article>';
  }
  function renderHardest(r) {
    var list = (r.hardest || []).slice(0, 5).sort(function (a, b) { return num(a.rank, 9) - num(b.rank, 9); });
    state.hardest = list;
    var stepper = $('.stepper', el.carousel);
    if (!list.length) {
      var note = (typeof r.hardestNote === 'string' && r.hardestNote.trim()) ? r.hardestNote.trim() :
        'Every sentence reads comfortably. Nice work — keep sentences short and words familiar.';
      el.slides.innerHTML = '<article class="slide slide-clear"><div class="rank-big is-clear" aria-hidden="true">✓</div><div class="slide-body">' +
        '<div class="slide-meta"><span class="lvl-pill easy">All clear</span></div>' +
        '<p class="clear-title">Nothing hard here.</p>' +
        '<p class="clear-note">' + esc(note) + '</p></div></article>';
      el.dots.innerHTML = '';
      stepper.hidden = true;
      state.slide = 0;
      return;
    }
    stepper.hidden = list.length < 2;
    el.slides.innerHTML = list.map(function (s, i) { return slideHTML(s, i, list.length, r); }).join('');
    el.dots.innerHTML = list.map(function (s, i) {
      return '<button type="button" data-cursor="Go" aria-label="Show hardest sentence ' + (i + 1) + '"><span></span></button>';
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
    el.slides.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && (e.button !== 0 || e.target.closest('button, a'))) return;
      x0 = e.clientX; y0 = e.clientY;
    });
    el.slides.addEventListener('pointerup', function (e) {
      if (x0 == null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0;
      x0 = null;
      // a mouse drag that selected text is a selection, not a swipe
      if (e.pointerType === 'mouse' && String(window.getSelection ? window.getSelection() : '').trim()) return;
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
    setSentenceFocus(null);
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
    setSentenceFocus(e.target.closest('.s'));
  });
  el.hl.addEventListener('focusout', function (e) {
    if (e.target.closest(TARGETS) && !popPinned) hidePop(false);
    if (!el.hl.contains(e.relatedTarget)) setSentenceFocus(null);
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
  el.hl.addEventListener('scroll', function () { if (!el.pop.hidden) placePop(); if (SH.cur) setSentenceFocus(null); }, { passive: true });
  document.addEventListener('click', function (e) { if (popPinned && !e.target.closest(TARGETS) && !e.target.closest('#popover')) hidePop(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !el.pop.hidden) hidePop(true); });
  window.addEventListener('resize', function () { if (!el.pop.hidden) placePop(); });

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
      return '<button type="button" data-cursor="Jump" class="heat-bar z-' + easeZone(e) + '" style="--w:' + Math.max(1, num(p.words) / total * 100).toFixed(2) + ';--h:' + h.toFixed(0) + '%;--d:' + (Math.min(i, 20) * 0.04).toFixed(2) + 's" data-start="' + esc(p.start) + '" data-pi="' + esc(p.index) + '" title="' + esc(label) + '" aria-label="' + esc(label) + '. Jump to it."></button>';
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
    lines.push('Reading ease: ' + Math.round(num(easeOf(sc))) + '/100 — ' + (sc.label || '') + ' (grade ' + (sc.letter || '?') + ')');
    if (sc.audience) lines.push(String(sc.audience).replace(/\.?$/, '.'));
    if (typeof r.summary === 'string' && r.summary.trim()) lines.push(r.summary.trim());
    if (r.confidence && r.confidence.level && r.confidence.level !== 'high' && r.confidence.note) lines.push('Note: ' + r.confidence.note);
    lines.push('');
    lines.push('Consensus grade: ' + fmt1(sc.consensusGrade) + ' (' + gradeWord(num(sc.consensusGrade, NaN)) + ')');
    lines.push('Flesch–Kincaid ' + fmt1(sc.fleschKincaidGrade) + ' · Gunning Fog ' + fmt1(sc.gunningFog) + ' · SMOG ' + fmt1(sc.smog) +
      ' · Coleman–Liau ' + fmt1(sc.colemanLiau) + ' · ARI ' + fmt1(sc.ari) +
      (typeof sc.daleChall === 'number' && isFinite(sc.daleChall) ? ' · Dale–Chall ' + fmt1(sc.daleChall) : ''));
    lines.push('');
    var pct = num(st.words) ? Math.round(num(st.complexWords) / num(st.words) * 100) : 0;
    lines.push('Words: ' + fmtInt(st.words) + ' · Sentences: ' + fmtInt(st.sentences) + ' · Paragraphs: ' + fmtInt(st.paragraphs));
    var unf = unfamiliarPct(st);
    lines.push('Average sentence: ' + fmt1(st.avgWordsPerSentence) + ' words · Complex words: ' + pct + '%' + (unf ? ' · Unfamiliar words: ' + Math.round(unf.pct) + '%' : ''));
    lines.push('Reading time: ' + fmtTime(st.readingTimeSec) + ' · Speaking time: ' + fmtTime(st.speakingTimeSec));
    var hard = state.hardest;
    if (!hard.length && typeof r.hardestNote === 'string' && r.hardestNote.trim()) { lines.push(''); lines.push('Hardest sentences: ' + r.hardestNote.trim()); }
    if (hard.length) {
      lines.push('');
      lines.push('THE ' + (hard.length === 5 ? 'FIVE' : hard.length) + ' HARDEST SENTENCES');
      hard.forEach(function (s, i) {
        var body = (typeof s.start === 'number') ? text.slice(s.start, s.end) : s.text;
        lines.push('');
        lines.push((s.rank || i + 1) + '. "' + String(body).replace(/\s+/g, ' ').trim() + '"');
        lines.push('   ' + (LEVEL_NAME[s.level] || '') + ' · ' + gradeWord(num(s.grade, NaN)) + ' · ' + plural(num(s.words), 'word') + ' · difficulty ' + Math.round(num(s.difficulty)) + '/100');
        if (s.reasons && s.reasons.length) lines.push('   Why: ' + s.reasons.join('; '));
        if (typeof s.tip === 'string' && s.tip.trim()) lines.push('   Try this: ' + s.tip.trim());
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

  /* ======================================================================
     Motion & interaction
     One requestAnimationFrame loop drives everything that moves. It sleeps
     when nothing is changing and stops while the tab is hidden. It is fed by
     one passive scroll listener and one passive pointermove listener, writes
     only transforms, opacity and custom properties, and reads layout in a
     separate measure() pass (on resize, body resize, fonts, renders).
     ?static and prefers-reduced-motion switch all of it off; cursor effects
     only start after a real mouse moves, so touch devices never get them.
     ====================================================================== */
  var root = document.documentElement;
  var FINE = !!(window.matchMedia && matchMedia('(any-hover: hover) and (any-pointer: fine)').matches);
  var M = {
    raf: 0, frames: 0, dirty: true, lastSy: -1, vw: 0, vh: 0, docH: 0,
    px: -200, py: -200, mouse: false, cursorOn: false, native: false, away: false,
    target: null, tweens: [], scrolledCls: null
  };
  var CURSOR_OK = MOTION && FINE;
  function lerp(a, b, t) { return a + (b - a) * t; }
  function sstep(a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function kick() { if (!M.raf && !document.hidden) M.raf = requestAnimationFrame(frame); }
  function markDirty() { M.dirty = true; kick(); }

  /* count-ups run inside the main loop */
  function fmtCount(v, dec, suf) { return (dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-US')) + (suf || ''); }
  function countUp(node, from, to, dec, suf, dur) {
    if (node._tw) node._tw.dead = true;
    node._tw = null;
    if (!MOTION || from === to || document.hidden) { node.textContent = fmtCount(to, dec, suf); return; }
    var tw = { t0: performance.now(), dur: dur || 900, fn: function (p) {
      var e = 1 - Math.pow(1 - p, 3);
      node.textContent = fmtCount(from + (to - from) * e, dec, suf);
    } };
    node._tw = tw;
    M.tweens.push(tw);
    kick();
  }
  function runTweens(now) {
    M.tweens = M.tweens.filter(function (tw) {
      if (tw.dead) return false;
      var p = clamp((now - tw.t0) / tw.dur, 0, 1);
      tw.fn(p);
      return p < 1;
    });
    return M.tweens.length > 0;
  }

  /* ---------- elements ---------- */
  var heroSec = $('#hero'), heroArt = $('.hero-art'), heroSvg = $('#heroSvg');
  var layers = heroSvg ? $$('.lyr', heroSvg).map(function (n) { return { n: n, d: parseFloat(n.getAttribute('data-depth')) || 0, x: 0, y: 0 }; }) : [];
  var pagesLayer = layers.filter(function (l) { return l.n.id === 'heroPages'; })[0] || { x: 0, y: 0 };
  var pages = heroSvg ? $$('.pg', heroSvg).map(function (n) { return { n: n, k: +n.getAttribute('data-n') || 1, y: 0, o: 1, key: '' }; }) : [];
  var mag = $('#heroMag'), magHandle = $('#heroHandle'), lens = $('#heroLens'), heroScore = $('#heroScore');
  var letters = $$('.wm-l');
  var shapes = $$('[data-parallax]');
  var scrollPill = $('#scrollPill'), spLabel = $('#spLabel');
  var conveyor = $('#scale'), cvTrack = $('#cvTrack'), cvRail = $('#cvRail'), cvBelt = $('.cv-belt', conveyor || document);
  var cvBarFill = $('.cv-bar i', conveyor || document);
  var cvCards = cvTrack ? $$('.cv-card', cvTrack) : [];
  var cursorEl = $('#cursor'), cDot = cursorEl && $('.c-dot', cursorEl), cFollow = cursorEl && $('.c-follow', cursorEl), cLabel = $('#cursorLabel');
  $$('.filter').forEach(function (b) { b.setAttribute('data-cursor', 'Toggle'); });

  /* ---------- geometry cache (read pass) ---------- */
  var G = { heroTop: 0, heroH: 0, art: { top: 0, left: 0, w: 1, h: 1 }, letters: [], magnets: [], shapes: [], cv: { pin: false } };
  function measure() {
    M.dirty = false;
    M.vw = root.clientWidth; M.vh = window.innerHeight;
    // conveyor writes first (pinning changes page height), then read everything
    var pin = !!(conveyor && cvTrack && MOTION && M.vh >= 560);
    if (conveyor) {
      conveyor.classList.toggle('is-pinned', pin);
      if (cvRail) { if (pin) cvRail.removeAttribute('tabindex'); else cvRail.setAttribute('tabindex', '0'); }
      if (!pin && cvTrack) {
        cvTrack.style.transform = '';
        cvCards.forEach(function (c) { c.style.transform = ''; revealCv(c, false); });
      }
    }
    var sy = window.scrollY, sx = window.scrollX, r;
    if (pin) {
      var dist = Math.max(0, cvTrack.scrollWidth - M.vw);
      conveyor.style.setProperty('--cv-h', Math.round(M.vh + dist + M.vh * 0.3) + 'px');
      r = conveyor.getBoundingClientRect();
      G.cv = { pin: true, top: r.top + sy, dist: dist, cards: cvCards.map(function (c) { return { n: c, cx: c.offsetLeft + c.offsetWidth / 2, key: '' }; }) };
    } else {
      if (conveyor) conveyor.style.removeProperty('--cv-h');
      G.cv = { pin: false };
    }
    M.docH = Math.max(root.scrollHeight, document.body.scrollHeight);
    if (heroSec) { r = heroSec.getBoundingClientRect(); G.heroTop = r.top + sy; G.heroH = r.height; }
    if (heroArt) {
      r = heroArt.getBoundingClientRect();
      var w = r.width || 1;
      G.art = { top: r.top + sy, left: r.left + sx, w: w, h: w * 520 / 600 };
    }
    G.letters = letters.map(function (n, i) {
      var b = n.getBoundingClientRect(), old = G.letters[i];
      return { n: n, cx: b.left + sx + b.width / 2, cy: b.top + sy + b.height / 2, R: Math.max(150, b.height * 1.1), f: old ? old.f : 0, s: old ? old.s : 0, key: old ? old.key : '' };
    });
    G.shapes = shapes.map(function (n) {
      var sec = n.closest('section') || heroSec, anchor = 0, top = 0, bottom = 1e9;
      if (sec && sec !== heroSec) {
        var b = sec.getBoundingClientRect();
        top = b.top + sy; bottom = top + b.height; anchor = top - M.vh * 0.5;
      } else if (sec) { bottom = G.heroTop + G.heroH; }
      return { n: n, sp: parseFloat(n.getAttribute('data-parallax')) || 0, anchor: anchor, top: top, bottom: bottom, key: '' };
    });
    G.magnets = !M.cursorOn ? [] : $$('.btn, .round-btn').map(function (n) {
      if (n.closest('.menu')) return null;
      var st = n._mg || (n._mg = { x: 0, y: 0, key: '' });
      var b = n.getBoundingClientRect();
      if (!b.width || !b.height) return null;
      var fixed = !!n.closest('.site-header, .share-banner');
      return { n: n, st: st, fixed: fixed, l: b.left - st.x + (fixed ? 0 : sx), t: b.top - st.y + (fixed ? 0 : sy), w: b.width, h: b.height };
    }).filter(Boolean);
    M.lastSy = -1; // force a scroll pass with the new numbers
  }

  /* ---------- the loop ---------- */
  function frame(now) {
    M.raf = 0; M.frames++;
    if (M.dirty) measure();
    var sy = window.scrollY, busy = false;
    if (sy !== M.lastSy) { M.lastSy = sy; scrollFrame(sy); }
    if (MOTION) {
      if (M.tweens.length) busy = runTweens(now) || busy;
      busy = heroFrame(now, sy) || busy;
      // pointer effects are limited to the hero illustration; no custom cursor, magnets, letter or card tilt
    }
    if (busy) kick();
  }

  /* ---------- scroll-driven ---------- */
  function scrollFrame(sy) {
    var scrolled = sy > 12;
    if (scrolled !== M.scrolledCls) {
      M.scrolledCls = scrolled;
      el.header.classList.toggle('is-scrolled', scrolled);
      setTimeout(markDirty, 360); // header buttons move when its padding changes
    }
    var p = M.docH > M.vh ? clamp(sy / (M.docH - M.vh), 0, 1) : 0;
    if (scrollPill) scrollPill.style.setProperty('--p', p.toFixed(4));
    if (!el.pop.hidden) placePop();
    if (!MOTION) return;
    var vh = M.vh;
    G.shapes.forEach(function (s) {
      if (sy + vh < s.top - 300 || sy > s.bottom + 300) return;
      var key = ((sy - s.anchor) * s.sp).toFixed(1);
      if (key !== s.key) { s.key = key; s.n.style.transform = 'translate3d(0,' + key + 'px,0)'; }
    });
    var cv = G.cv;
    if (cv.pin && sy > cv.top - vh * 1.2 && sy < cv.top + cv.dist + vh * 1.6) {
      var cp = cv.dist ? clamp((sy - cv.top) / cv.dist, 0, 1) : 0, off = cp * cv.dist, mid = M.vw / 2;
      cvTrack.style.transform = 'translate3d(' + (-off).toFixed(1) + 'px,0,0)';
      if (cvBarFill) cvBarFill.style.transform = 'scaleX(' + cp.toFixed(4) + ')';
      if (cvBelt) cvBelt.style.setProperty('--spin', (cp * 1440).toFixed(1) + 'deg');
      cv.cards.forEach(function (c) {
        var x = c.cx - off - mid, k = 1 - Math.min(1, Math.abs(x) / (M.vw * 0.55));
        var key = ((1 - k) * 30).toFixed(1) + 'px,0) rotate(' + (x / M.vw * 4).toFixed(2) + 'deg) scale(' + (0.9 + 0.1 * k).toFixed(3);
        if (key !== c.key) { c.key = key; c.n.style.transform = 'translate3d(0,' + key + ')'; }
        if (k > 0.5) revealCv(c.n, true);
      });
    }
  }

  /* ---------- hero: intro, scroll assembly, pointer depth, magnifier ---------- */
  var H = { t0: 0, init: false, nx: 0, ny: 0, mx: 318, my: 176, rot: 0, vars: '', tilt: '', scoreDone: false };
  if (heroSvg) {
    $$('.hlm', heroSvg).forEach(function (n) {
      var len = 0;
      try { len = n.getTotalLength(); } catch (e) { len = 0; }
      if (len) n.style.setProperty('--len', len.toFixed(1) + 'px');
    });
  }
  function heroFrame(now, sy) {
    if (!heroSvg) return false;
    var visible = sy < G.heroTop + G.heroH + 40;
    if (!visible && H.init) return false;
    H.init = true;
    if (!H.t0) { H.t0 = now; heroArt.classList.add('ready'); }
    var busy = false;
    var it = clamp((now - H.t0) / 1500, 0, 1);
    if (it < 1) busy = true;
    var ie = 1 - Math.pow(1 - it, 3);
    // scroll assembly: the stack settles and the highlighter draws as the art passes a line on screen.
    var artTopVp = G.art.top - sy, artH = G.art.h;
    var line = G.art.top < M.vh * 0.5 ? 0.4 : 0.72;
    var A = clamp((M.vh * line - artTopVp) / (artH * 0.9), 0, 1);
    var stack = sstep(0.42, 0.8, A), draw = sstep(0.55, 0.9, A), fill = sstep(0.82, 1, A), rk = sstep(0.88, 1, A);
    var lines = sstep(0, 0.3, A) * sstep(0.25, 0.8, it);
    var vars = draw.toFixed(3) + fill.toFixed(3) + rk.toFixed(3) + lines.toFixed(3);
    if (vars !== H.vars) {
      H.vars = vars;
      heroSvg.style.setProperty('--hl-draw', draw.toFixed(3));
      heroSvg.style.setProperty('--hl-fill', fill.toFixed(3));
      heroSvg.style.setProperty('--rk', rk.toFixed(3));
      heroSvg.style.setProperty('--lines', lines.toFixed(3));
    }
    var topPageY = 0;
    pages.forEach(function (pg) {
      var k = pg.k, d = (k - 1) * 0.12;
      var drop = (1 - sstep(d, 0.55 + d, it)) * -(70 + k * 26);
      var y = drop - (1 - stack) * k * 13;
      var o = sstep(d, 0.3 + d, it);
      if (k === 4) topPageY = y;
      var key = y.toFixed(1) + '|' + o.toFixed(2);
      if (key !== pg.key) { pg.key = key; pg.n.setAttribute('transform', 'translate(0 ' + y.toFixed(1) + ')'); pg.n.style.opacity = o.toFixed(2); }
    });
    if (!H.scoreDone && heroScore) {
      heroScore.textContent = String(Math.round(72 * ie));
      if (it >= 1) H.scoreDone = true;
    }
    // pointer depth (mouse only)
    var tnx = 0, tny = 0;
    if (M.cursorOn && M.mouse && !M.away) { tnx = clamp((M.px / M.vw - 0.5) * 2, -1, 1); tny = clamp((M.py / M.vh - 0.5) * 2, -1, 1); }
    H.nx = lerp(H.nx, tnx, 0.08); H.ny = lerp(H.ny, tny, 0.08);
    if (Math.abs(H.nx - tnx) > 0.002 || Math.abs(H.ny - tny) > 0.002) busy = true;
    layers.forEach(function (l) {
      var x = H.nx * l.d * 12, y = H.ny * l.d * 8;
      if (Math.abs(x - l.x) > 0.02 || Math.abs(y - l.y) > 0.02 || !l.set) {
        l.x = x; l.y = y; l.set = true;
        l.n.setAttribute('transform', 'translate(' + x.toFixed(2) + ' ' + y.toFixed(2) + ')');
      }
    });
    var tilt = 'rotateX(' + (-H.ny * 2).toFixed(2) + 'deg) rotateY(' + (H.nx * 3).toFixed(2) + 'deg)';
    if (tilt !== H.tilt) { H.tilt = tilt; heroSvg.style.transform = tilt; }
    // magnifier: follows the pointer across the page, otherwise drifts along the lines
    var tx, ty, inHero = M.cursorOn && M.mouse && !M.away && M.py < G.heroTop + G.heroH - sy;
    if (inHero) {
      tx = (M.px - (G.art.left - window.scrollX)) / G.art.w * 600 - pagesLayer.x;
      ty = (M.py - artTopVp) / artH * 520 - pagesLayer.y - topPageY;
    } else {
      var t = now / 1000;
      tx = 280 + Math.cos(t * 0.45) * 105;
      ty = 190 + Math.sin(t * 0.9) * 42;
    }
    var u = (tx - 271) / 150, v = (ty - 195) / 88, s = Math.abs(u) + Math.abs(v);
    if (s > 1) { u /= s; v /= s; }
    tx = 271 + u * 150 + pagesLayer.x; ty = 195 + v * 88 + pagesLayer.y + topPageY;
    var ox = H.mx;
    H.mx = lerp(H.mx, tx, inHero ? 0.14 : 0.05); H.my = lerp(H.my, ty, inHero ? 0.14 : 0.05);
    H.rot = lerp(H.rot, clamp((H.mx - ox) * 2.2, -14, 14), 0.12);
    if (Math.abs(H.mx - tx) > 0.05 || Math.abs(H.my - ty) > 0.05 || Math.abs(H.rot) > 0.05 || !inHero) busy = true;
    mag.setAttribute('transform', 'translate(' + H.mx.toFixed(2) + ' ' + H.my.toFixed(2) + ')');
    magHandle.setAttribute('transform', 'rotate(' + H.rot.toFixed(2) + ')');
    lens.setAttribute('transform', 'scale(1.7) translate(' + (pagesLayer.x - H.mx).toFixed(2) + ' ' + (pagesLayer.y + topPageY - H.my).toFixed(2) + ')');
    return busy;
  }

  /* ---------- wordmark letters lean away from the pointer ---------- */
  function lettersFrame(sy) {
    var busy = false, pdx = M.px + window.scrollX, pdy = M.py + sy;
    var active = M.mouse && !M.away && sy < G.heroTop + G.heroH;
    G.letters.forEach(function (L) {
      var tf = 0, ts = 0;
      if (active) {
        var dx = L.cx - pdx, dy = L.cy - pdy, d = Math.sqrt(dx * dx + dy * dy);
        if (d < L.R) { var q = 1 - d / L.R; tf = q * q * (3 - 2 * q); ts = clamp(dx / L.R * 2, -1, 1); }
      }
      L.f = lerp(L.f, tf, 0.14); L.s = lerp(L.s, ts, 0.14);
      if (Math.abs(L.f - tf) > 0.002 || Math.abs(L.s - ts) > 0.01) busy = true;
      var key = L.f.toFixed(3) + '|' + L.s.toFixed(2);
      if (key !== L.key) { L.key = key; L.n.style.setProperty('--f', L.f.toFixed(3)); L.n.style.setProperty('--sx', L.s.toFixed(2)); }
    });
    return busy;
  }

  /* ---------- custom cursor ---------- */
  var C = { rx: -200, ry: -200, cls: '', label: '' };
  function cursorFrame() {
    C.rx = lerp(C.rx, M.px, 0.2); C.ry = lerp(C.ry, M.py, 0.2);
    cDot.style.transform = 'translate3d(' + M.px + 'px,' + M.py + 'px,0)';
    cFollow.style.transform = 'translate3d(' + C.rx.toFixed(1) + 'px,' + C.ry.toFixed(1) + 'px,0)';
    return Math.abs(C.rx - M.px) > 0.1 || Math.abs(C.ry - M.py) > 0.1;
  }
  var INTERACTIVE = 'a[href], button, [role="button"], label[for], select, summary';
  var DARK = '.ph-ink, .ph-teal, .btn-ink, .btn-teal, .take-away, .privacy-card, .site-footer, .conveyor, .menu, .share-banner-inner, .tag, .rank-big, .chip-ink, .filter[aria-pressed="true"], .round-btn:hover, .letter[data-letter="A"], .toast';
  var LIGHT = '.cv-card, .btn-white, .btn-yellow, .ph-white, .ph-yellow, .ph-coral, .cv-bar';
  function resolveCursor(t) {
    var o = { native: false, label: '', hover: false, dark: false, blend: false };
    if (!t || t.nodeType !== 1) return o;
    if (t.closest('textarea, input, select, .hl-view, .popover')) { o.native = true; return o; }
    var lab = t.closest('[data-cursor]'), act = t.closest(INTERACTIVE);
    if (act && (!lab || lab.contains(act))) {
      if (!act.disabled && act.getAttribute('aria-disabled') !== 'true') {
        o.hover = true;
        o.label = act.getAttribute('data-cursor') || (/^#/.test(act.getAttribute('href') || '') ? 'Go' : 'Open');
      }
    } else if (lab) { o.hover = true; o.label = lab.getAttribute('data-cursor'); }
    var dark = t.closest(DARK), light = t.closest(LIGHT);
    o.dark = !!dark && !(light && dark.contains(light));
    o.blend = !!t.closest('.wordmark');
    return o;
  }
  function applyCursor(o) {
    M.native = o.native;
    var cls = 'cursor' + (o.native ? ' is-native' : '') + (o.hover && !o.label ? ' is-hover' : '') + (o.label ? ' is-label' : '') +
      (o.dark ? ' is-dark' : '') + (o.blend ? ' is-blend' : '') + (M.away ? ' is-away' : '') + (M.down ? ' is-down' : '');
    if (o.label && o.label !== C.label) { C.label = o.label; cLabel.textContent = o.label; }
    if (cls !== C.cls) { C.cls = cls; cursorEl.className = cls; }
  }
  function enableCursor() {
    if (M.cursorOn || !cursorEl) return;
    M.cursorOn = true;
    C.rx = M.px; C.ry = M.py;
    root.classList.add('has-cursor');
    markDirty();
  }
  function decorateTilt(scope) {
    if (!M.cursorOn) return;
    $$('[data-tilt]', scope).forEach(function (n) {
      if (!n.querySelector(':scope > .sheen')) {
        var s = document.createElement('span');
        s.className = 'sheen'; s.setAttribute('aria-hidden', 'true');
        n.appendChild(s);
      }
    });
  }
  var lastResolve = null;
  function refreshCursor() { lastResolve = resolveCursor(M.target); applyCursor(lastResolve); setTiltTarget(M.target); }

  /* ---------- magnetic pill buttons ---------- */
  function magnetFrame(sy) {
    var busy = false, sx = window.scrollX;
    G.magnets.forEach(function (m) {
      var px = M.px + (m.fixed ? 0 : sx), py = M.py + (m.fixed ? 0 : sy), tx = 0, ty = 0;
      if (M.mouse && !M.away && !M.native && !m.n.disabled) {
        var dx = Math.max(m.l - px, 0, px - (m.l + m.w)), dy = Math.max(m.t - py, 0, py - (m.t + m.h));
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 60) {
          var k = 1 - d / 60;
          tx = clamp((px - (m.l + m.w / 2)) * 0.18, -7, 7) * k;
          ty = clamp((py - (m.t + m.h / 2)) * 0.3, -6, 6) * k;
        }
      }
      var st = m.st;
      st.x = lerp(st.x, tx, 0.2); st.y = lerp(st.y, ty, 0.2);
      if (Math.abs(st.x - tx) < 0.05 && Math.abs(st.y - ty) < 0.05) { st.x = tx; st.y = ty; } else busy = true;
      var key = st.x.toFixed(1) + 'px ' + st.y.toFixed(1) + 'px';
      if (key !== st.key) { st.key = key; m.n.style.translate = (st.x || st.y) ? key : ''; }
    });
    return busy;
  }

  /* ---------- tilt cards ---------- */
  var T = { cur: null, list: [] };
  function setTiltTarget(t) {
    var card = (t && t.closest && !M.native) ? t.closest('[data-tilt]') : null;
    if (card === T.cur) return;
    if (T.cur) T.cur.classList.remove('is-hot');
    T.cur = card;
    if (card) {
      card.classList.add('is-tilting', 'is-hot');
      if (!T.list.some(function (s) { return s.n === card; })) T.list.push({ n: card, rx: 0, ry: 0, lift: 0 });
    }
  }
  function tiltFrame(rect) {
    var busy = false;
    T.list = T.list.filter(function (s) {
      var trx = 0, try_ = 0, tl = 0;
      if (s.n === T.cur && rect && rect.width && M.mouse && !M.away) {
        var fx = clamp((M.px - rect.left) / rect.width, 0, 1), fy = clamp((M.py - rect.top) / rect.height, 0, 1);
        var amp = clamp(380 / Math.max(rect.width, rect.height), 0.3, 1);
        try_ = (fx - 0.5) * 10 * amp; trx = (0.5 - fy) * 8 * amp; tl = -3;
        s.n.style.setProperty('--hx', (fx * 100).toFixed(1) + '%');
        s.n.style.setProperty('--hy', (fy * 100).toFixed(1) + '%');
      }
      s.rx = lerp(s.rx, trx, 0.15); s.ry = lerp(s.ry, try_, 0.15); s.lift = lerp(s.lift, tl, 0.15);
      var settled = Math.abs(s.rx - trx) < 0.02 && Math.abs(s.ry - try_) < 0.02 && Math.abs(s.lift - tl) < 0.02;
      if (settled && s.n !== T.cur) {
        s.n.classList.remove('is-tilting');
        ['--rx', '--ry', '--lift'].forEach(function (k) { s.n.style.removeProperty(k); });
        return false;
      }
      if (!settled) busy = true;
      s.n.style.setProperty('--rx', s.rx.toFixed(2) + 'deg');
      s.n.style.setProperty('--ry', s.ry.toFixed(2) + 'deg');
      s.n.style.setProperty('--lift', s.lift.toFixed(2) + 'px');
      return true;
    });
    return busy;
  }

  /* ---------- highlighted text: one sentence in focus ---------- */
  var SH = { cur: null };
  function setSentenceFocus(s) {
    if (s === SH.cur) return;
    if (SH.cur) SH.cur.classList.remove('is-focus');
    SH.cur = s || null;
    el.hl.classList.toggle('has-focus', !!SH.cur);
    var data = SH.cur && state.sentById ? state.sentById[SH.cur.getAttribute('data-s')] : null;
    if (!data) { el.sChip.hidden = true; return; }
    SH.cur.classList.add('is-focus');
    var lvl = LEVEL_NAME[data.level] ? data.level : 'easy';
    el.sChip.innerHTML = '<i class="c-' + lvl + '"></i><span>' + esc(LEVEL_NAME[lvl]) + ' · difficulty <b>' + Math.round(num(data.difficulty)) + '</b>/100 · ' + plural(num(data.words), 'word') + '</span>';
    el.sChip.hidden = false;
    var rects = SH.cur.getClientRects(), first = rects[0], last = rects[rects.length - 1];
    if (!first) { el.sChip.hidden = true; return; }
    var cr = el.hlCard.getBoundingClientRect(), hr = el.hl.getBoundingClientRect();
    var cw = el.sChip.offsetWidth, ch = el.sChip.offsetHeight;
    var x = clamp(first.left - cr.left, 8, Math.max(8, cr.width - cw - 8));
    var y = first.top - cr.top - ch - 6;
    if (first.top - ch - 6 < hr.top) { y = last.bottom - cr.top + 6; x = clamp(last.left - cr.left, 8, Math.max(8, cr.width - cw - 8)); }
    el.sChip.style.transform = 'translate(' + x.toFixed(0) + 'px,' + y.toFixed(0) + 'px)';
  }
  el.hl.addEventListener('mouseover', function (e) { setSentenceFocus(e.target.closest('.s')); });
  el.hl.addEventListener('mouseleave', function () { setSentenceFocus(null); });

  /* ---------- conveyor: real scores from the engine ---------- */
  function revealCv(li, on) {
    if (li.classList.contains('on') && on) return;
    var val = $('.cv-val', li);
    if (on) {
      li.classList.add('on');
      if (val) countUp(val, 0, +val.getAttribute('data-to'), 0, '', 900);
    } else {
      li.classList.add('on');
      if (val) { if (val._tw) val._tw.dead = true; val.textContent = val.getAttribute('data-to'); }
    }
  }
  (function initConveyor() {
    if (!cvTrack) return;
    var rows = cvCards.map(function (li, i) {
      var text = ($('.cv-text', li) || li).textContent, r = null;
      try { r = window.Readable.analyze(text); } catch (e) { r = null; }
      var s = r && r.sentences && r.sentences[0];
      return {
        li: li, i: i, text: text, level: s && s.level,
        diff: s && typeof s.difficulty === 'number' ? Math.round(clamp(s.difficulty, 0, 100)) : null,
        grade: s && typeof s.grade === 'number' ? s.grade : (r && r.scores ? r.scores.fleschKincaidGrade : null),
        ease: r && r.scores ? Math.round(clamp(num(easeOf(r.scores)), 0, 100)) : null
      };
    });
    if (rows.every(function (x) { return x.diff != null; })) rows.sort(function (a, b) { return a.diff - b.diff || a.i - b.i; });
    rows.forEach(function (row, i) {
      var lvl = LEVEL_NAME[row.level] ? row.level : null;
      var html = '<div class="cv-top"><span class="cv-num" aria-hidden="true">' + (i + 1) + '</span>' +
        (lvl ? '<span class="lvl-pill ' + lvl + '">' + LEVEL_NAME[lvl] + '</span>' : '') + '</div>' +
        '<p class="cv-text">' + esc(row.text) + '</p>';
      if (row.diff != null) {
        html += '<div class="cv-score" aria-hidden="true"><b class="cv-val" data-to="' + row.diff + '">' + (MOTION ? 0 : row.diff) + '</b><span>/100 difficulty</span></div>' +
          '<span class="sr-only">Difficulty ' + row.diff + ' out of 100.</span>' +
          '<div class="cv-meter" aria-hidden="true"><i style="--d:' + row.diff + '%;--full:' + (row.diff ? (10000 / row.diff).toFixed(1) : 100) + '%"></i></div>' +
          '<p class="cv-foot">' + esc(gradeWord(num(row.grade, NaN)) || '') + (row.ease != null ? ' · reading ease ' + row.ease : '') + '</p>';
      }
      row.li.innerHTML = html;
      cvTrack.appendChild(row.li);
    });
    cvCards = $$('.cv-card', cvTrack);
  })();

  /* ---------- listeners ---------- */
  window.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', markDirty);
  if ('ResizeObserver' in window) new ResizeObserver(function () { markDirty(); }).observe(document.body);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(markDirty);
  window.addEventListener('load', markDirty);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (M.raf) cancelAnimationFrame(M.raf); M.raf = 0; }
    else markDirty();
  });
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return; // touch and pen: scroll effects only
    M.px = e.clientX; M.py = e.clientY; M.mouse = true;
    if (!M.cursorOn && CURSOR_OK) enableCursor();
    if (M.cursorOn && (e.target !== M.target || M.away)) { M.target = e.target; M.away = false; refreshCursor(); }
    kick();
  }, { passive: true });
  if (CURSOR_OK) {
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') { M.mouse = false; M.away = true; if (M.cursorOn) refreshCursor(); kick(); return; }
      M.down = true; if (M.cursorOn) applyCursor(lastResolve || resolveCursor(e.target));
    }, { passive: true });
    document.addEventListener('pointerup', function () {
      M.down = false;
      if (M.cursorOn) { refreshCursor(); setTimeout(markDirty, 60); }
    }, { passive: true });
    document.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget && M.cursorOn) { M.away = true; refreshCursor(); kick(); }
    });
    // keyboard users: the follower steps aside so focus rings stay the clearest thing on screen
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && M.cursorOn && !M.away) { M.away = true; refreshCursor(); kick(); }
    });
    // hover state can change without the pointer moving (menu opens, slide changes)
    document.addEventListener('click', function () { if (M.cursorOn) setTimeout(function () { refreshCursor(); markDirty(); }, 30); });
  }

  /* ---------- reveals ---------- */
  var reveals = $$('.reveal');
  var IO = 'IntersectionObserver' in window;
  if (!MOTION || !IO) {
    reveals.forEach(function (n) { n.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (n, i) { n.style.transitionDelay = (n.closest('.how-grid') ? (i % 4) * 70 : 0) + 'ms'; io.observe(n); });
  }
  // score gauge sweeps when the card comes into view (and again each time it returns)
  if (MOTION && IO) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && en.intersectionRatio >= 0.3) {
          if (!gauge.seen) { gauge.seen = true; if (state.result) showGauge(state.ease, 0); }
        } else if (!en.isIntersecting && gauge.seen) {
          gauge.seen = false; if (state.result) resetGauge();
        }
      });
    }, { threshold: [0, 0.3] }).observe(el.scoreCard);
    // metric cards stagger in and their numbers count up, once
    var mio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting || el.metrics.classList.contains('in') || !el.metrics.children.length) return;
        el.metrics.classList.add('in');
        $$('.cnt', el.metrics).forEach(function (n) {
          countUp(n, 0, parseFloat(n.getAttribute('data-to')) || 0, +n.getAttribute('data-dec') || 0, n.getAttribute('data-suf') || '', 1000);
        });
        setTimeout(function () { el.metrics.classList.add('played'); }, 1500);
        mio.disconnect();
      });
    }, { threshold: 0.15 });
    mio.observe(el.metrics);
  } else {
    gauge.seen = true;
    el.metrics.classList.add('in', 'played');
  }
  // header pill names the section in view
  if (IO && spLabel) {
    var lio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) spLabel.textContent = en.target.getAttribute('data-label'); });
    }, { rootMargin: '-45% 0px -54% 0px' });
    $$('[data-label]').forEach(function (n) { lio.observe(n); });
  }

  // for checks in the console / tests
  window.__readableMotion = {
    motion: MOTION, fine: FINE, isStatic: STATIC,
    state: function () {
      return { frames: M.frames, running: !!M.raf, cursorOn: M.cursorOn, pinned: !!G.cv.pin, magnets: G.magnets.length, letters: G.letters.length, shapes: G.shapes.length, tweens: M.tweens.length, gaugeSeen: gauge.seen };
    }
  };
  markDirty();

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
