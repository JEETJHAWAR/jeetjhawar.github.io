/*!
 * Readable engine — readability analysis for the browser (and Node, for tests).
 * Plain script, no dependencies. Exposes window.Readable / module.exports.
 * See ENGINE.md for the API and the heuristics behind it.
 */
(function (root) {
  'use strict';

  var VERSION = '2.0.0';

  function wordSet(str) {
    var s = new Set();
    str.split(/\s+/).forEach(function (w) { if (w) s.add(w); });
    return s;
  }
  function pairMap(str) {
    var m = new Map();
    str.split(/\s+/).forEach(function (p) {
      if (!p) return;
      var i = p.lastIndexOf(':');
      m.set(p.slice(0, i), +p.slice(i + 1));
    });
    return m;
  }

  /* ------------------------------------------------------------------ *
   * Syllable exceptions: words the rules get wrong (standard dictionary  *
   * counts). Inflected forms (-s, -es, -d, -ed, -ing, -ly) are derived.  *
   * ------------------------------------------------------------------ */
  var SYL_EX = pairMap(
    'business:2 people:2 area:3 idea:3 create:2 being:2 naive:2 naivety:3 realize:3 realise:3 ' +
    'poem:2 poet:2 poetry:3 poetic:3 fire:1 hour:1 our:1 every:2 everyone:3 everything:3 ' +
    'everybody:4 everywhere:3 everyday:3 someone:2 anyone:3 anybody:4 anywhere:3 ' +
    'recipe:3 simile:3 acne:2 cafe:2 karate:3 apostrophe:4 catastrophe:4 epitome:4 hyperbole:4 ' +
    'sesame:3 finale:3 coyote:3 adobe:3 ukulele:4 facsimile:4 maybe:2 abalone:4 anemone:4 ' +
    'aisle:1 isle:1 island:2 choir:1 colonel:2 wednesday:2 february:4 chaos:2 heroic:3 ' +
    'behavior:3 behaviour:3 savior:2 saviour:2 soldier:2 frontier:2 cashier:2 glacier:2 ' +
    'persuade:2 dissuade:2 conscience:2 element:3 elements:3 moreover:3 forever:3 george:1 ' +
    'leopard:2 jeopardy:3 creature:2 theater:3 theatre:3 nuclear:3 linear:3 cereal:3 lion:2 ' +
    'evening:2 parliament:3 nevertheless:4 naked:2 wicked:2 crooked:2 rugged:2 ragged:2 ' +
    'jagged:2 beloved:3 learned:1 blessed:1 aged:1 dogged:2 sacred:2 hundred:2 hatred:2 ' +
    'kindred:2 shepherd:2 rhythm:2 rhythms:2 orange:2 queue:1 eye:1 eyes:1 ' +
    'genre:2 table:2 vehicle:3 debris:2 plateau:2 chateau:2 bureau:2 ' +
    'mr:2 mrs:2 ms:1 dr:2 st:1 jr:2 sr:2 vs:2 etc:4 eg:2 ie:2 prof:2 ' +
    'via:2 ago:2 ego:2 iron:2 ironic:3 science:2 sciences:3 quiet:2 quietly:3 diet:2 ' +
    'reality:4 really:2 real:1 ideal:2 ideally:3 being:2 seeing:2 doing:2 going:2 ' +
    'coincidence:4 coordinate:4 cooperate:4 cooperation:5 preexisting:4 ' +
    'naturally:4 actually:4 usually:4 especially:4 ' +
    'squirrel:2 wolf:1 women:2 woman:2 busy:2 bury:2 ' +
    'often:2 listen:2 castle:2 whistle:2 wrestle:2 hasten:2 ' +
    'gesture:2 nature:2 picture:2 future:2 culture:2 ' +
    'violence:3 violent:3 diamond:3 dialogue:3 diagram:3 diary:3 ' +
    'poems:2 poets:2 lions:2 hours:1 fires:1 tired:1 hired:1 fired:1 wired:1 ' +
    'prayer:1 prayers:1 layer:2 player:2 mayor:2 lawyer:2 buyer:2 ' +
    'every:2 several:3 family:3 different:3 interest:3 interesting:4 ' +
    'favorite:3 favourite:3 average:3 general:3 natural:3 camera:3 separate:3 ' +
    'chocolate:3 vegetable:4 comfortable:4 temperature:4 literature:4 ' +
    'library:3 laboratory:5 ' +
    'reuse:2 reused:2 react:2 reacted:3 reaction:3 reactions:3 ' +
    'museum:3 premium:3 stadium:3 medium:3 period:3 radio:3 video:3 studio:3 piano:3 ' +
    'ocean:2 social:2 special:2 official:3 ancient:2 patient:2 ' +
    'once:1 one:1 some:1 come:1 done:1 gone:1 none:1 give:1 live:1 have:1 love:1 move:1 ' +
    'above:2 there:1 where:1 here:1 were:1 whole:1 sure:1 ' +
    'courage:2 college:2 village:2 message:2 image:2 garage:2 ' +
    'heaven:2 seven:2 eleven:3 ' +
    'idiom:3 radius:3 genius:2 senior:2 junior:2 ' +
    'lyric:2 lyrics:2 hygiene:2 hyena:3 ' +
    'naive:2 cliche:2 resume:3 fiance:3 ' +
    'reality:4 reinforce:3 reiterate:4 reimburse:3 reimbursement:4'
  );

  // Base words for the "n't" contraction: couldn't = could + n't (2 syllables).
  var NT_PLUS = wordSet('could would should did does is was has have had must need might ought dare');

  /* ------------------------------------------------------------------ *
   * Passive voice                                                       *
   * ------------------------------------------------------------------ */
  var BE_FORMS = wordSet("am is are was were be been being isn't aren't wasn't weren't i'm you're we're they're");
  var BE_AUX = wordSet("will shall would should can could may might must has have had has't hasn't haven't hadn't won't wouldn't shouldn't can't cannot couldn't mustn't to");
  var PASSIVE_SKIP = wordSet(
    'not never also always often already still just all both then now usually sometimes ' +
    'generally widely being been ever only once largely mostly fully partly rarely seldom'
  );
  var IRREGULAR_PP = wordSet(
    'arisen awoken borne born beaten begun bent bitten bled blown broken bred brought built burnt bought ' +
    'caught chosen clung crept cut dealt done drawn dreamt drunk driven eaten fallen fed felt fought found ' +
    'fled flung flown forbidden forgotten forgiven forsaken frozen gotten given ground grown hung heard ' +
    'hidden hit held hurt kept knelt known laid led lent lain lit lost made meant met mistaken ' +
    'misunderstood overtaken overthrown overseen overheard overpaid overrun overdone outgrown outdone ' +
    'paid proven put read rid ridden rung risen run said seen sought sold sent set sewn shaken shaven ' +
    'shown shrunk shut sung sunk slain slept slid slung slit smelt sown spoken sped spent spilt spun ' +
    'split spread sprung stood stolen stuck stung stunk strewn stricken struck strung striven sworn ' +
    'swept swollen swum swung taken taught torn told thought thrown thrust trodden understood ' +
    'undertaken undone upheld upset woken worn woven wed wept won wound withdrawn withheld withstood ' +
    'written wrung rebuilt redone rewritten retold mislaid misled foreseen foretold beset bound bidden ' +
    'cleft dug forecast hewn leant learnt mown shorn shod spat spelt spoilt thriven unbound unwound ' +
    'waylaid broadcast underpaid underwritten underestimated outlawed inbuilt'
  );
  // -ed words that are not past participles (or are adjectives we should not flag).
  var NOT_PP = wordSet(
    'need seed feed speed bleed breed deed weed greed heed steed indeed proceed succeed exceed ' +
    'bed red shed sled shred wed bred fled hundred kindred naked sacred wicked rugged ragged ' +
    'crooked beloved jagged hatred sled embed embed'
  );

  /* ------------------------------------------------------------------ *
   * Plain-English replacements (bureaucratic word or phrase → simpler).  *
   * ------------------------------------------------------------------ */
  var PLAIN_RAW = [
    ['utilize', 'use'], ['utilise', 'use'], ['utilization', 'use'], ['utilisation', 'use'],
    ['commence', 'start'], ['commencement', 'start'], ['notwithstanding', 'despite'],
    ['subsequently', 'later'], ['subsequent', 'later'], ['subsequent to', 'after'],
    ['approximately', 'about'], ['facilitate', 'help'], ['in order to', 'to'], ['prior to', 'before'],
    ['endeavour', 'try'], ['endeavor', 'try'], ['aforementioned', 'this / these'],
    ['ascertain', 'find out'], ['accordingly', 'so'], ['accomplish', 'do'], ['accompany', 'go with'],
    ['acquire', 'get'], ['additional', 'more'], ['adequate', 'enough'], ['adjacent to', 'next to'],
    ['advise', 'tell'], ['aggregate', 'total'], ['allocate', 'give'], ['alleviate', 'ease'],
    ['ameliorate', 'improve'], ['anticipate', 'expect'], ['appreciable', 'large'],
    ['assist', 'help'], ['assistance', 'help'], ['at this point in time', 'now'],
    ['at the present time', 'now'], ['attempt', 'try'], ['attain', 'reach'], ['beverage', 'drink'],
    ['by means of', 'by'], ['cognizant', 'aware'], ['cognisant', 'aware'], ['commensurate', 'equal'],
    ['comprise', 'include'], ['concerning', 'about'], ['consequently', 'so'], ['constitute', 'make up'],
    ['consolidate', 'combine'], ['demonstrate', 'show'], ['designate', 'name'],
    ['disseminate', 'share'], ['due to the fact that', 'because'], ['during the course of', 'during'],
    ['eliminate', 'remove'], ['elucidate', 'explain'], ['encounter', 'meet'], ['ensure', 'make sure'],
    ['equivalent', 'equal'], ['exhibit', 'show'], ['expedite', 'speed up'], ['expeditious', 'fast'],
    ['expenditure', 'spending'], ['feasible', 'possible'], ['finalize', 'finish'], ['finalise', 'finish'],
    ['for the purpose of', 'for'], ['forthwith', 'now'], ['furthermore', 'also'], ['henceforth', 'from now on'],
    ['herein', 'here'], ['hereby', 'now'], ['heretofore', 'until now'], ['in accordance with', 'under'],
    ['in an effort to', 'to'], ['in lieu of', 'instead of'], ['in relation to', 'about'],
    ['in respect of', 'about'], ['in the event that', 'if'], ['in the near future', 'soon'],
    ['inception', 'start'], ['initiate', 'start'], ['in excess of', 'more than'],
    ['irrespective of', 'despite'], ['leverage', 'use'], ['magnitude', 'size'], ['methodology', 'method'],
    ['modify', 'change'], ['necessitate', 'need'], ['numerous', 'many'], ['obtain', 'get'],
    ['optimum', 'best'], ['optimal', 'best'], ['owing to', 'because of'], ['participate', 'take part'],
    ['particulars', 'details'], ['pertaining to', 'about'], ['possess', 'have'],
    ['predominantly', 'mostly'], ['procure', 'get'], ['provided that', 'if'], ['purchase', 'buy'],
    ['pursuant to', 'under'], ['reimbursement', 'repayment'], ['remainder', 'rest'],
    ['remuneration', 'pay'], ['reside', 'live'], ['retain', 'keep'], ['solicit', 'ask for'],
    ['substantial', 'large'], ['sufficient', 'enough'], ['terminate', 'end'], ['thereafter', 'then'],
    ['thereby', 'so'], ['therein', 'there'], ['transmit', 'send'], ['whereas', 'but'],
    ['with regard to', 'about'], ['with respect to', 'about'], ['with the exception of', 'except'],
    ['a majority of', 'most'], ['at all times', 'always'], ['in the absence of', 'without'],
    ['in close proximity to', 'near'], ['in view of the fact that', 'because'],
    ['on a daily basis', 'daily'], ['on the grounds that', 'because'], ['until such time as', 'until'],
    ['whilst', 'while'], ['amongst', 'among'], ['cease', 'stop'], ['collaborate', 'work together'],
    ['comply with', 'follow'], ['deem', 'consider'], ['discontinue', 'stop'], ['enquire', 'ask'],
    ['inquire', 'ask'], ['locate', 'find'], ['notify', 'tell'], ['paradigm', 'model'],
    ['perceive', 'see'], ['regarding', 'about'], ['synergy', 'teamwork'], ['endeavours', 'efforts'],
    ['endeavors', 'efforts'], ['indicate', 'show'], ['implement', 'carry out'], ['initial', 'first'],
    ['frequently', 'often'], ['nevertheless', 'still'], ['permit', 'let'], ['require', 'need'],
    ['sufficiently', 'enough'], ['herewith', '(cut it)'], ['enclosed herewith', 'enclosed'],
    ['kindly', 'please'], ['do the needful', 'do what is needed'], ['revert back', 'reply'],
    ['prepone', 'bring forward'], ['intimate', 'tell'], ['avail', 'use']
  ];

  /* Filler / hedge words (single words and phrases). */
  var FILLER_RAW = [
    'very', 'really', 'basically', 'actually', 'just', 'quite', 'simply', 'literally', 'totally',
    'rather', 'somewhat', 'fairly', 'essentially', 'virtually', 'practically', 'truly', 'honestly',
    'obviously', 'arguably', 'seemingly', 'perhaps', 'in fact', 'kind of', 'sort of', 'a bit',
    'a little bit', 'needless to say', 'it goes without saying', 'for all intents and purposes',
    'at the end of the day', 'as a matter of fact', 'to be honest', 'i think', 'i believe', 'i feel',
    'in my opinion', 'each and every', 'first and foremost'
  ];

  /* -ly words that are not adverbs worth flagging. */
  var LY_STOP = wordSet(
    'only family early reply apply supply imply comply multiply july italy holy ugly ' +
    'friendly lovely lonely lively likely unlikely deadly costly daily weekly monthly yearly hourly ' +
    'nightly quarterly elderly silly jolly belly bully rally ally fly lily assembly anomaly butterfly ' +
    'firefly jelly folly hilly curly smelly chilly sly rely emily billy sally kelly molly holly ' +
    'gully tally dolly sully melancholy monopoly homily wily oily burly surly orderly scholarly ' +
    'motherly fatherly brotherly sisterly manly womanly cowardly ghastly ghostly godly heavenly ' +
    'leisurely lowly portly princely saintly seemly shapely sickly stately unruly wobbly worldly ' +
    'prickly bubbly cuddly bodily timely comely friendly neighbourly neighborly beastly gravelly ' +
    'italy sicily natalie kindly reply rely ply doily hurly anomaly apply wholly woolly ' +
    'ally rally bully'
  );

  /* Stopwords for the word-frequency list. */
  var STOP = wordSet(
    'a about above after again against all also am an and any are aren\'t as at be because been before ' +
    'being below between both but by can can\'t cannot could couldn\'t did didn\'t do does doesn\'t doing ' +
    'don\'t down during each even every few for from further get gets got had hadn\'t has hasn\'t have ' +
    'haven\'t having he her here hers herself him himself his how however i if in into is isn\'t it it\'s ' +
    'its itself just let like make many may me more most much must my myself no nor not now of off on ' +
    'once one only or other our ours ourselves out over own same she should shouldn\'t so some such ' +
    'than that that\'s the their theirs them themselves then there there\'s these they this those ' +
    'through to too under until up upon us very was wasn\'t we were weren\'t what when where which while ' +
    'who whom why will with within without won\'t would wouldn\'t yet you your yours yourself ' +
    'yourselves i\'m you\'re we\'re they\'re i\'ve we\'ve you\'ve they\'ve i\'ll we\'ll you\'ll ' +
    'he\'s she\'s let\'s also said says say use used using two three first new well way still since ' +
    'back really quite really etc'
  );

  /* Sentence splitting: abbreviation classes (lower-case, no trailing dot). */
  var ABBR_NEVER = wordSet(
    'mr mrs ms mx dr prof rev hon gen col capt lt sgt cmdr adm gov sen rep fr st smt shri sh kum ' +
    'messrs mme mlle e.g i.e eg ie vs cf viz approx esp incl ca'
  );
  var ABBR_NUMBER = wordSet(
    'no nos vol vols fig figs pp p art sec ch rs re ref eq ver op para cl jan feb mar apr jun jul ' +
    'aug sep sept oct nov dec tel'
  );
  var ABBR_MAY = wordSet(
    'etc inc ltd co corp pvt llc plc bros jr sr a.m p.m am pm u.s u.k u.s.a u.n ph.d a.d b.c al dept ' +
    'univ govt est ave rd blvd mt jan feb mar apr jun jul aug sep sept oct nov dec min max hrs yr yrs ' +
    'mon tue tues wed thu thur thurs fri sat sun'
  );
  var ABBR_LIBERAL = wordSet('etc a.m p.m ltd inc corp llc plc');
  var STARTERS = wordSet(
    'the a an it i we he she they you this that these those there then but and so yet or if when ' +
    'while what why how who our my his her its their your in on at for from to as after before ' +
    'however also still now here one some many most all each every no not today later meanwhile ' +
    'next finally first second third please let thanks thank'
  );
  var HEADING_TAIL = wordSet('a an the and or but of to in on at for with by from as is are was were that');

  /* ================================================================== *
   * Syllables                                                           *
   * ================================================================== */
  var VOW = 'aeiou';
  function isV(c) { return c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u'; }
  function isVY(c) { return isV(c) || c === 'y'; }
  function hasVowel(s) { return /[aeiouy]/.test(s); }

  // Is the character at i a vowel in this word? Handles y (consonant at the start
  // and between vowels: "yes", "player") and u after q ("queen", "unique").
  function vowelAt(w, i) {
    var c = w[i];
    if (c === 'y') {
      if (i === 0) return false;
      if (isV(w[i - 1]) && i + 1 < w.length && isV(w[i + 1])) return false;
      return true;
    }
    if (c === 'u' && i > 0 && w[i - 1] === 'q') return false;
    return isV(c);
  }
  function countGroups(w) {
    var n = 0, inV = false;
    for (var i = 0; i < w.length; i++) {
      var v = vowelAt(w, i);
      if (v && !inV) n++;
      inV = v;
    }
    return n;
  }

  var SILENT_E_SUFFIX = wordSet(
    'ly ment ments ful fully fulness less lessly lessness ness nesses ship ships some wise ward wards ' +
    'hood hoods ty by like'
  );
  var SILENT_E_MORPH = (
    'some where there here fore time home life wise like safe care base state space place whole grace ' +
    'sure name line game note side make take love move lone nine five bone stone hope shape late smoke ' +
    'fire white more store bike cake face race lake house horse nose rose wide tide page stage ice hole ' +
    'pole role sale tale scale gate plate date site wine shine use edge knife wife bride guide judge ' +
    'voice lime tone gone none'
  ).split(' ');
  var RE_ROOTS = ('act align alloc arrang assur assess assign ali appear appoint appl open use usab unit ' +
    'union enter entr elect evaluat examin employ inforc invent invest integrat issu order organi ignit ' +
    'imburs iterat affirm adjust activ edit emerg establish instat instal insur introduc admit enact engag ' +
    'acquaint awaken educat import').split(' ');
  var CO_ROOTS = 'operat ordinat exist author alesc alit incid erc efficien educat ax opt edit'.split(' ');
  var PRE_ROOTS = 'exist empt occup ordain arrang establish approv audit assembl'.split(' ');
  var DE_ROOTS = 'activ emphas escal ic odor ioni energ'.split(' ');

  function startsWithAny(w, at, roots) {
    for (var i = 0; i < roots.length; i++) if (w.startsWith(roots[i], at)) return true;
    return false;
  }

  var useExceptions = true;
  function exLookup(w) {
    if (!useExceptions) return undefined;
    var v = SYL_EX.get(w), b;
    if (v !== undefined) return v;
    var n = w.length;
    if (n > 3 && w[n - 1] === 's') {
      if ((v = SYL_EX.get(w.slice(0, -1))) !== undefined) return v;
      if (w[n - 2] === 'e' && (v = SYL_EX.get(b = w.slice(0, -2))) !== undefined) return v + (/(?:[sxz]|[cs]h)$/.test(b) ? 1 : 0);
    }
    if (n > 3 && w[n - 1] === 'd') {
      if ((v = SYL_EX.get(b = w.slice(0, -1))) !== undefined && b[b.length - 1] === 'e') return v + (/[td]e$/.test(b) ? 1 : 0);
      if (w[n - 2] === 'e' && (v = SYL_EX.get(b = w.slice(0, -2))) !== undefined) return v + (/[td]$/.test(b) ? 1 : 0);
    }
    if (n > 4 && w.endsWith('ing')) {
      b = w.slice(0, -3);
      if ((v = SYL_EX.get(b)) !== undefined || (v = SYL_EX.get(b + 'e')) !== undefined) return v + 1;
    }
    if (n > 4 && w.endsWith('ly')) {
      if ((v = SYL_EX.get(w.slice(0, -2))) !== undefined) return v + 1;
    }
    return undefined;
  }

  // Core rule-based count for a plain lower-case a–z word.
  function coreSyllables(w) {
    if (w.length <= 2) return hasVowel(w) || w.length === 1 ? 1 : w.length; // "a", "go", "hm"
    var ex = exLookup(w);
    if (ex !== undefined) return ex;
    if (!hasVowel(w)) return 1; // "hmm", "psst", "nth"

    var x = w, add = 0, n, stripped = false;

    // Silent "ue" in tongue, league, vague, fatigue (but not argue).
    if (/[aeioun]gue[sd]?$/.test(x)) x = x.replace(/ue([sd]?)$/, '$1');

    n = x.length;
    if (n > 3 && x.endsWith('es')) {
      var p = x[n - 3];
      var sib = 'sxzcg'.indexOf(p) >= 0 || x.endsWith('ches') || x.endsWith('shes');
      if (!sib && hasVowel(x.slice(0, -2))) { x = x.slice(0, -2); stripped = true; }
    } else if (n > 3 && x.endsWith('ed')) {
      var q = x[n - 3], q2 = x[n - 4];
      var syllabicEd = q === 't' || q === 'd' || (q === 'r' && q2 && !isVY(q2) && q2 !== 'r');
      if (!syllabicEd && hasVowel(x.slice(0, -2))) { x = x.slice(0, -2); stripped = true; }
    } else if (n > 2 && x[n - 1] === 'e') {
      var c3 = x[n - 3];
      if (x[n - 2] === 'l' && c3 && !isVY(c3) && c3 !== 'l' && c3 !== 'r' && c3 !== 'w') {
        x = x.slice(0, -1); add += 1;          // table, little, simple
      } else if (x[n - 2] !== 'e' && hasVowel(x.slice(0, -1))) {
        x = x.slice(0, -1);                    // silent final e
      }
    }
    // tables, handled: the syllabic "l" left behind after stripping -es / -ed.
    if (stripped && /[^aeiouylrw]l$/.test(x)) add += 1;

    var count = countGroups(x);
    n = x.length;

    // Vowel pairs that are two syllables (hiatus): ia, io, ua, ue, ui, eo, iu …
    for (var i = 0; i < n - 1; i++) {
      var a = x[i], b = x[i + 1];
      if (a === 'i' && b === 'o') {
        var pv = x[i - 1], nx = x[i + 2];
        var after = nx === 'n' || nx === 'u';
        if (after && pv && ('tscgx'.indexOf(pv) >= 0 || (pv === 'h' && x[i - 2] === 's'))) continue;
        if (pv && (pv === 'l' || pv === 'n') && (after || nx === 'r')) continue;
        count++;
      } else if (a === 'i' && b === 'a') {
        var pa = x[i - 1];
        if (pa && 'cts'.indexOf(pa) >= 0) continue;
        if (pa === 'l' && i >= 2 && (isV(x[i - 2]) || x[i - 2] === 'l')) continue;
        if (pa === 'g' && i >= 2) continue;
        if (x.startsWith('ge', i + 2) && i + 4 === n) continue; // marriage
        count++;
      } else if (a === 'u' && b === 'a') {
        if (x[i - 1] !== 'q' && x[i - 1] !== 'g') count++;
      } else if (a === 'u' && b === 'o' && x[i + 2] === 'u') {
        count++;                                          // continuous
      } else if (a === 'u' && b === 'e') {
        if (x[i - 1] !== 'q' && x[i - 1] !== 'g' && 'lnt'.indexOf(x[i + 2] || '#') >= 0 && i > 0) count++; // fuel, fluent
      } else if (a === 'u' && b === 'i') {
        if (x[i - 1] !== 'q' && x[i - 1] !== 'g' && i > 0 &&
            (x[i + 2] === 'n' || x[i + 2] === 'd' || x.startsWith('ty', i + 2) || x.startsWith('tion', i + 2) || x.startsWith('tive', i + 2))) count++;
      } else if (a === 'e' && b === 'o') {
        if (!(i >= 2 && (x[i - 1] === 'g' || x[i - 1] === 'c'))) count++; // video, theory (not pigeon)
      } else if (a === 'i' && b === 'u' && x[i + 2] === 'm') {
        count++;                                          // premium, stadium
      } else if (a === 'e' && b === 'u' && x[i + 2] === 'm' && i > 0) {
        count++;                                          // museum
      } else if (a === 'i' && b === 'e') {
        if (x[i + 2] === 't' && i > 0) count++;                   // diet, quiet, society
        else if (x[i + 2] === 'n' && (x[i + 3] === 'c' || x[i + 3] === 't')) {
          var pe = x[i - 1];
          if (pe && ('tc'.indexOf(pe) < 0 || (pe === 'c' && x[i - 2] === 's'))) count++; // client, science
        }
      }
    }
    // happier, earliest
    if (w.length >= 5 && /[^aeiou]i(?:er|est)s?$/.test(w)) count++;
    // prism, rhythm, enthusiasm
    if (/(?:[aeiouy]sm|thm)s?$/.test(x)) count++;
    // -ing after a vowel: being, going, flying (but not playing — y is a consonant there)
    var ing = w.match(/(.)(.)ings?$/);
    if (ing && w.length > 4) {
      var ip = ing[2], ipp = ing[1];
      if (isV(ip) || (ip === 'y' && !isV(ipp))) count++;
    }
    // Prefixes before a vowel: re-act, co-operate, pre-exist, de-activate, cre-ate
    if (w[0] === 'r' && w[1] === 'e' && isV(w[2]) && startsWithAny(w, 2, RE_ROOTS)) count++;
    else if (w[0] === 'c' && w[1] === 'o' && isV(w[2]) && startsWithAny(w, 2, CO_ROOTS)) count++;
    else if (w.startsWith('pre') && isV(w[3]) && startsWithAny(w, 3, PRE_ROOTS)) count++;
    else if (w.startsWith('de') && isV(w[2]) && startsWithAny(w, 2, DE_ROOTS)) count++;
    else if (w.startsWith('creat')) count++;

    // Silent e inside words: statement, lovely, sometimes, careful
    for (var j = 2; j < n - 1; j++) {
      if (x[j] !== 'e' || isVY(x[j - 1]) || isVY(x[j + 1])) continue;
      if (x[j - 1] === 'l' && !isVY(x[j - 2]) && x[j - 2] !== 'l') continue; // settlement: "tle" is a syllable
      if (!hasVowel(x.slice(0, j - 1))) continue;
      var tail = x.slice(j + 1), head = x.slice(0, j + 1);
      var silent = SILENT_E_SUFFIX.has(tail);
      if (!silent && tail.length >= 3) {
        for (var k = 0; k < SILENT_E_MORPH.length; k++) {
          if (head.endsWith(SILENT_E_MORPH[k])) { silent = true; break; }
        }
      }
      if (silent) count--;
    }
    return Math.max(1, count + add);
  }

  // Letter names for spelled-out acronyms: most are 1 syllable, W is 3.
  function spelled(s) {
    var n = 0;
    for (var i = 0; i < s.length; i++) n += (s[i] === 'w' ? 3 : 1);
    return n;
  }

  var ONES = [2, 1, 1, 1, 1, 1, 1, 2, 1, 1];
  var TEENS = [1, 3, 1, 2, 2, 2, 2, 3, 2, 2];
  var TENS = [0, 0, 2, 2, 2, 2, 2, 3, 2, 2];
  function intSyl(n) {
    if (n < 10) return ONES[n];
    if (n < 20) return TEENS[n - 10];
    if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ONES[n % 10] : 0);
    if (n < 1000) return ONES[Math.floor(n / 100)] + 2 + (n % 100 ? intSyl(n % 100) : 0);
    var units = [[1e9, 2], [1e6, 2], [1e3, 2]];
    for (var i = 0; i < units.length; i++) {
      var u = units[i][0];
      if (n >= u) {
        var hi = Math.floor(n / u), lo = n % u;
        return (hi < 1000 ? intSyl(hi) : String(hi).length) + units[i][1] + (lo ? intSyl(lo) : 0);
      }
    }
    return String(n).length;
  }
  // Spoken-English estimate for a number token ("2026" → twenty twenty-six = 5), capped at 6.
  function numberSyllables(tok) {
    var t = tok.replace(/,/g, '').replace(/(st|nd|rd|th)$/i, '');
    var parts = t.split('.');
    var ip = parts[0], s;
    if (ip.length > 12) s = ip.length;
    else {
      var n = parseInt(ip, 10) || 0;
      if (ip.length === 4 && n >= 1100 && n <= 2099 && n % 100 !== 0 && !(n >= 2000 && n <= 2009)) {
        var lo = n % 100;
        s = intSyl(Math.floor(n / 100)) + (lo < 10 ? 1 + ONES[lo] : intSyl(lo));
      } else s = intSyl(n);
    }
    if (parts.length > 1) {
      s += 1;
      for (var i = 1; i < parts.length; i++) for (var j = 0; j < parts[i].length; j++) s += ONES[+parts[i][j]] || 1;
    }
    return Math.min(6, Math.max(1, s));
  }

  var sylCache = new Map();
  var NT_ONE = wordSet("can't won't don't ain't shan't");

  /** Syllables in one word (any case, may contain ' ’ - .). Exposed for tests. */
  function syllables(word) {
    var key = String(word);
    var hit = sylCache.get(key);
    if (hit !== undefined) return hit;
    var r = computeSyllables(key);
    if (sylCache.size > 50000) sylCache.clear();
    sylCache.set(key, r);
    return r;
  }
  function computeSyllables(raw) {
    if (/^\d/.test(raw)) return numberSyllables(raw);
    var s = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/’/g, "'");
    if (!/[A-Za-z]/.test(s)) return 1;
    // Acronyms: HTML, IIMK, CEO are spelled out; NASA, ISRO are said as words.
    var letters = s.replace(/[^A-Za-z]/g, '');
    if (letters.length >= 2 && letters.length <= 6 && letters === letters.toUpperCase() && /^[A-Z]+$/.test(s)) {
      var L = letters.toLowerCase();
      if (!/[aeiou]/.test(L) || L.length <= 3 || /[aeiou]{2}/.test(L) || /[^aeiou]{3}/.test(L)) return spelled(L);
      return coreSyllables(L);
    }
    var lower = s.toLowerCase();
    // Dotted abbreviations: U.S, e.g, Ph.D
    var dotParts = lower.split('.');
    if (dotParts.length > 1) {
      if (dotParts.every(function (p) { return p.length <= 1; })) return spelled(dotParts.join(''));
      return dotParts.reduce(function (t, p) { return t + (p ? computeSyllables(p) : 0); }, 0);
    }
    var hy = lower.split('-');
    if (hy.length > 1) return hy.reduce(function (t, p) { return t + (/[a-z]/.test(p) ? computeSyllables(p) : 0); }, 0);
    if (lower.indexOf("'") >= 0) {
      if (NT_ONE.has(lower)) return 1;
      var m = lower.match(/^([a-z]+)n't$/);
      if (m) return coreSyllables(m[1]) + (NT_PLUS.has(m[1]) ? 1 : 0);
      if (lower.startsWith("o'")) return 1 + coreSyllables(lower.slice(2).replace(/[^a-z]/g, '') || 'a');
      var base = lower.split("'")[0].replace(/[^a-z]/g, '');
      return base ? coreSyllables(base) : 1;
    }
    var clean = lower.replace(/[^a-z]/g, '');
    return clean ? coreSyllables(clean) : 1;
  }

  /* ================================================================== *
   * Tokens                                                              *
   * ================================================================== */
  var LAT = 'A-Za-z\\u00C0-\\u024F';
  var TOKEN_RE = new RegExp(
    '((?:https?:\\/\\/|www\\.)[^\\s<>"“”\'’)\\]]*[^\\s<>"“”\'’)\\].,;:!?])' +            // 1 url
    '|([A-Za-z0-9._%+\\-]+@[A-Za-z0-9\\-]+(?:\\.[A-Za-z0-9\\-]+)+)' +                     // 2 email
    '|([' + LAT + '](?:[' + LAT + '\\u0300-\\u036F]|[\'’\\-.](?=[' + LAT + ']))*)' +      // 3 latin word
    '|(\\d+(?:[.,]\\d+)*(?:st|nd|rd|th)?)' +                                               // 4 number
    '|([\\p{L}\\p{M}]+)',                                                                   // 5 other script
    'gu'
  );

  /** Tokenise text[from, to) into word objects with absolute offsets. */
  function tokenize(text, from, to) {
    var out = [], m, s = text.slice(from, to);
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(s))) {
      var kind = m[1] || m[2] ? 'url' : m[3] ? 'latin' : m[4] ? 'num' : 'other';
      out.push({ text: m[0], start: from + m.index, end: from + m.index + m[0].length, kind: kind });
    }
    return out;
  }

  /* ================================================================== *
   * Lines, paragraphs, sentences                                        *
   * ================================================================== */
  var BULLET_RE = /^([ \t ]*)((?:#{1,6}|[-*•‣◦▪●·–—+>]|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)]|\(?(?:i{1,3}|iv|vi{0,3}|ix|x)[.)])[ \t ]+)/;
  var HAS_WORDCHAR = /[\p{L}\p{N}]/u;
  var IS_WS = /[\s  -​　]/;

  function getLines(text) {
    var lines = [], i = 0, n = text.length;
    while (i <= n) {
      var j = text.indexOf('\n', i);
      if (j < 0) j = n;
      var e = j;
      if (e > i && text[e - 1] === '\r') e--;
      lines.push({ start: i, end: e });
      if (j >= n) break;
      i = j + 1;
    }
    return lines;
  }

  function lineInfo(text, ln) {
    var s = text.slice(ln.start, ln.end);
    var m = BULLET_RE.exec(s);
    var lead = /^[ \t ]*/.exec(s)[0].length;
    var cs = ln.start + (m && HAS_WORDCHAR.test(s.slice(m[0].length)) ? m[0].length : lead);
    var ce = ln.end;
    while (ce > cs && IS_WS.test(text[ce - 1])) ce--;
    return {
      start: ln.start, end: ln.end, cs: cs, ce: ce,
      isList: !!(m && HAS_WORDCHAR.test(s.slice(m[0].length)) && m[2][0] !== '#'),
      isHash: !!(m && m[2][0] === '#'),
      indent: lead > 0,
      content: text.slice(cs, ce)
    };
  }

  function looksLikeHeading(L, prev, prevBroke, next) {
    var c = L.content;
    if (/[.!?…:;,"”’)\]।॥]$/.test(c)) return false;
    var words = c.split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 10) return false;
    if (HEADING_TAIL.has(words[words.length - 1].toLowerCase())) return false;
    if (prev && !prevBroke && !/[.!?…:।॥]["”’)\]]*$/.test(prev.content)) return false;
    return /^["“‘(]?[\p{Lu}\p{Lo}\p{N}]/u.test(next.content);
  }

  /** Paragraphs → segments (runs of lines that read as one stream of prose). */
  function blocks(text) {
    var lines = getLines(text).map(function (l) { return lineInfo(text, l); });
    var paras = [], cur = null;
    lines.forEach(function (L) {
      if (!HAS_WORDCHAR.test(L.content)) { cur = null; return; } // blank or "* * *" line
      if (!cur) { cur = []; paras.push(cur); }
      cur.push(L);
    });
    return paras.map(function (ls) {
      var segs = [], segStart = ls[0].cs, broke = true;
      for (var i = 0; i < ls.length; i++) {
        var L = ls[i], next = ls[i + 1], brk;
        if (!next) brk = true;
        else if (next.isList || next.isHash) brk = true;
        else if (L.isList && !next.indent) brk = true;
        else if (L.isHash) brk = true;
        else brk = looksLikeHeading(L, ls[i - 1], broke, next);
        if (brk) {
          segs.push([segStart, L.ce]);
          if (next) segStart = next.cs;
        }
        broke = brk;
      }
      var first = ls[0], last = ls[ls.length - 1];
      var ps = first.start;
      while (ps < first.ce && IS_WS.test(text[ps])) ps++;
      return { start: ps, end: last.ce, segs: segs };
    });
  }

  var TERM_RE = /(?:\.{2,}|…|[.!?।॥‽])+["'”’»)\]}]*/g;
  var OPENERS = /["'“‘(\[«¿¡]/;

  function isBoundary(text, idx, term, ns, segEnd) {
    var k = ns;
    while (k < segEnd && OPENERS.test(text[k])) k++;
    var nc = text[k] || '';
    var isLower = /\p{Ll}/u.test(nc);
    if (/[।॥]/.test(term)) return true;
    if (/[!?‽]/.test(term)) return !isLower;
    if (/\.\.|…/.test(term)) return !isLower;
    // single full stop: look at the token before it
    var ts = idx;
    while (ts > 0 && !IS_WS.test(text[ts - 1])) ts--;
    var tok = text.slice(ts, idx).replace(/^["'“‘(\[«]+/, '');
    if (!tok) return true;
    var a = tok.toLowerCase();
    if (ABBR_NEVER.has(a)) return false;
    var nextWord = (/^[\p{L}\p{N}]+/u.exec(text.slice(k, Math.min(segEnd, k + 40))) || [''])[0].toLowerCase();
    if (ABBR_NUMBER.has(a) && /\d/.test(nc)) return false;
    if (ABBR_MAY.has(a) || /^(?:[a-z]\.)+[a-z]$/.test(a) || a.length === 1 ||
        (a.length <= 5 && /^[a-z]+$/.test(a) && !/[aeiouy]/.test(a))) {
      if (isLower) return false;
      return ABBR_LIBERAL.has(a) || STARTERS.has(nextWord);
    }
    return true;
  }

  /** Split one segment into sentence spans [start, end) (untrimmed). */
  function splitSegment(text, segStart, segEnd) {
    var spans = [], cursor = segStart, m;
    TERM_RE.lastIndex = segStart;
    while ((m = TERM_RE.exec(text)) && m.index < segEnd) {
      var end = m.index + m[0].length;
      if (end > segEnd) break;
      if (end < segEnd && !IS_WS.test(text[end])) continue;
      var ns = end;
      while (ns < segEnd && IS_WS.test(text[ns])) ns++;
      if (ns >= segEnd) break;
      var term = m[0].replace(/["'”’»)\]}]+$/, '');
      if (isBoundary(text, m.index, term, ns, segEnd)) {
        spans.push([cursor, end]);
        cursor = ns;
      }
    }
    if (cursor < segEnd) spans.push([cursor, segEnd]);
    return spans;
  }

  function trimSpan(text, s, e) {
    while (s < e && IS_WS.test(text[s])) s++;
    while (e > s && IS_WS.test(text[e - 1])) e--;
    return [s, e];
  }

  /** All sentence spans with paragraph grouping. Exposed for tests. */
  function segmentText(text) {
    var paras = [];
    blocks(text).forEach(function (b) {
      var sents = [];
      b.segs.forEach(function (sg) {
        splitSegment(text, sg[0], sg[1]).forEach(function (sp) {
          var t = trimSpan(text, sp[0], sp[1]);
          if (t[1] > t[0] && /\p{L}/u.test(text.slice(t[0], t[1]))) sents.push(t);
        });
      });
      if (sents.length) paras.push({ start: b.start, end: b.end, sentences: sents });
    });
    return paras;
  }

  /* ================================================================== *
   * Word-level checks                                                   *
   * ================================================================== */
  function phraseIndex(pairs) {
    var idx = new Map();
    pairs.forEach(function (p) {
      var ws = p[0].split(' ');
      var list = idx.get(ws[0]);
      if (!list) idx.set(ws[0], (list = []));
      list.push({ words: ws, value: p[1], phrase: p[0] });
    });
    idx.forEach(function (l) { l.sort(function (a, b) { return b.words.length - a.words.length; }); });
    return idx;
  }
  var PLAIN = phraseIndex(PLAIN_RAW.filter(function (p) { return p[0] !== 'intimate'; }));
  var FILLER = phraseIndex(FILLER_RAW.map(function (f) { return [f, null]; }));
  var HEDGES = wordSet('think believe feel opinion perhaps arguably seemingly');
  var KIND_DET = wordSet('what this that these those any some every which the a an one same other each no all different new right wrong best first only another');
  var ED_PP_OK = wordSet('agreed freed decreed guaranteed refereed disagreed');

  function lemmas(w) {
    var c = [w], n = w.length;
    if (n > 3 && w[n - 1] === 's') { c.push(w.slice(0, -1)); if (w.endsWith('es')) c.push(w.slice(0, -2)); }
    if (n > 4 && w.endsWith('ied')) c.push(w.slice(0, -3) + 'y');
    if (n > 3 && w.endsWith('ed')) { c.push(w.slice(0, -1), w.slice(0, -2)); }
    if (n > 5 && w.endsWith('ing')) { c.push(w.slice(0, -3) + 'e', w.slice(0, -3)); }
    if (n > 4 && w.endsWith('ies')) c.push(w.slice(0, -3) + 'y');
    return c;
  }

  // Match a phrase index at word i (first word may be inflected). Returns {len, entry} or null.
  function matchAt(index, lw, i, gapsOk) {
    var cands = lemmas(lw[i]);
    for (var c = 0; c < cands.length; c++) {
      var list = index.get(cands[c]);
      if (!list) continue;
      for (var e = 0; e < list.length; e++) {
        var ent = list[e], ok = true;
        if (ent.words.length > 1 && c > 0 && index === FILLER) continue;
        for (var k = 1; k < ent.words.length; k++) {
          if (lw[i + k] !== ent.words[k] || !gapsOk(i + k - 1)) { ok = false; break; }
        }
        if (ok) return { len: ent.words.length, entry: ent };
      }
    }
    return null;
  }

  function isParticiple(tok, w) {
    if (tok.kind !== 'latin' || w.indexOf('-') >= 0) return false;
    if (IRREGULAR_PP.has(w)) return true;
    if (w.length < 4 || !w.endsWith('ed') || NOT_PP.has(w)) return false;
    if (w.endsWith('eed') && !ED_PP_OK.has(w)) return false;
    return true;
  }
  function isAdverb(tok, w, first) {
    if (tok.kind !== 'latin' || w.length < 5 || !w.endsWith('ly') || LY_STOP.has(w)) return false;
    if (!first && /^\p{Lu}/u.test(tok.text)) return false;
    if (/[-'.]/.test(w)) return false;
    return true;
  }

  /* ================================================================== *
   * Scoring                                                             *
   * ================================================================== */
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function fre(w, s, syl) { return w ? clamp(206.835 - 1.015 * (w / s) - 84.6 * (syl / w), 0, 100) : 0; }
  function fk(w, s, syl) { return w ? Math.max(0, 0.39 * (w / s) + 11.8 * (syl / w) - 15.59) : 0; }

  function label(e) {
    return e >= 90 ? 'Very easy' : e >= 80 ? 'Easy' : e >= 70 ? 'Fairly easy' : e >= 60 ? 'Plain English' :
      e >= 50 ? 'Fairly difficult' : e >= 30 ? 'Difficult' : 'Very difficult';
  }
  function audience(e) {
    return e >= 90 ? 'Easily understood by an average 11-year-old' :
      e >= 80 ? 'Easily understood by 11- to 12-year-olds' :
      e >= 70 ? 'Easily understood by 12- to 13-year-olds' :
      e >= 60 ? 'Easily understood by 13- to 15-year-olds' :
      e >= 50 ? 'Best for 15- to 18-year-olds' :
      e >= 30 ? 'Best for college-level readers' : 'Best understood by university graduates';
  }
  function letter(e) { return e >= 70 ? 'A' : e >= 60 ? 'B' : e >= 50 ? 'C' : e >= 40 ? 'D' : e >= 30 ? 'E' : 'F'; }

  function q(s) { return '“' + s + '”'; }
  function listWords(arr, max) {
    var seen = [], low = new Set();
    arr.forEach(function (w) { var k = w.toLowerCase(); if (!low.has(k)) { low.add(k); seen.push(w); } });
    return seen.slice(0, max).join(', ') + (seen.length > max ? '…' : '');
  }

  /* ================================================================== *
   * Sentence analysis                                                   *
   * ================================================================== */
  function analyzeSentence(text, sp, index, para, issues) {
    var start = sp[0], end = sp[1], stext = text.slice(start, end);
    var toks = tokenize(text, start, end);
    var n = toks.length, lw = new Array(n);
    var syl = 0, complex = 0, poly = 0, chars = 0, longW = 0, complexList = [];

    for (var i = 0; i < n; i++) {
      var t = toks[i], w = t.text.toLowerCase().replace(/’/g, "'");
      lw[i] = w;
      var sy, letters;
      if (t.kind === 'latin') {
        sy = syllables(t.text);
        letters = t.text.replace(/[^\p{L}]/gu, '').length;
        if (letters >= 7) longW++;
        if (sy >= 3) {
          poly++;
          var proper = (i > 0 && /^\p{Lu}/u.test(t.text)) || (t.text.length > 1 && t.text === t.text.toUpperCase());
          var isComplex = !proper && t.text.indexOf('.') < 0;
          if (isComplex && w.indexOf('-') >= 0) {
            isComplex = w.split('-').some(function (p) { return p && syllables(p) >= 3; });
          }
          if (isComplex) {
            var m = /^(.{3,}?)(ing|ed|es)$/.exec(w);
            if (m && syllables(m[1]) < 3) isComplex = false;
          }
          t.complex = isComplex;
          if (isComplex) { complex++; complexList.push(t.text); }
        }
      } else if (t.kind === 'num') {
        sy = syllables(t.text);
        letters = t.text.replace(/\D/g, '').length;
      } else if (t.kind === 'url') {
        sy = clamp((t.text.match(/[A-Za-z]+/g) || []).length, 1, 4);
        letters = Math.min(10, t.text.replace(/[^A-Za-z0-9]/g, '').length);
      } else {
        sy = 1;
        letters = t.text.replace(/\p{M}/gu, '').length;
      }
      t.syl = sy;
      syl += sy;
      chars += letters;
    }

    // whitespace-only gap between word i and i+1 (no punctuation in between)
    function plainGap(i) {
      if (i + 1 >= n) return false;
      return /^[\s ]+$/.test(text.slice(toks[i].end, toks[i + 1].start));
    }

    var reasons = [], used = new Array(n);
    var passives = [], jargon = [];

    // Passive voice
    for (i = 0; i < n; i++) {
      if (!BE_FORMS.has(lw[i]) || toks[i].kind !== 'latin') continue;
      var j = i + 1, skips = 0;
      while (j < n && skips < 2 && plainGap(j - 1) &&
             (PASSIVE_SKIP.has(lw[j]) || isAdverb(toks[j], lw[j], false))) { j++; skips++; }
      if (j < n && plainGap(j - 1) && isParticiple(toks[j], lw[j])) {
        var s0 = i, k = i - 1, c = 0;
        while (k >= 0 && c < 2 && BE_AUX.has(lw[k]) && plainGap(k)) { s0 = k; k--; c++; }
        var phrase = text.slice(toks[s0].start, toks[j].end);
        passives.push(phrase);
        issues.push({ type: 'passive', start: toks[s0].start, end: toks[j].end, text: phrase,
          message: 'Passive voice: ' + q(phrase), suggestion: 'Use active voice: say who does it, then what they do.' });
        i = j;
      }
    }

    // Plain-English replacements (phrases first, longest match)
    for (i = 0; i < n; i++) {
      if (used[i] || toks[i].kind !== 'latin') continue;
      var pm = matchAt(PLAIN, lw, i, plainGap);
      if (!pm) continue;
      var e2 = i + pm.len - 1, ph = text.slice(toks[i].start, toks[e2].end);
      for (var u = i; u <= e2; u++) used[u] = true;
      jargon.push({ text: ph, alt: pm.entry.value });
      issues.push({ type: 'complex-word', start: toks[i].start, end: toks[e2].end, text: ph,
        message: q(ph) + ' has a simpler alternative: ' + q(pm.entry.value), suggestion: pm.entry.value });
      i = e2;
    }

    // Filler and hedges
    for (i = 0; i < n; i++) {
      if (used[i] || toks[i].kind !== 'latin') continue;
      var fm = matchAt(FILLER, lw, i, plainGap);
      if (!fm || fm.entry.words.length === 1 && fm.entry.phrase !== lw[i]) continue;
      var fw = fm.entry.words;
      if ((fw[0] === 'kind' || fw[0] === 'sort') && i > 0 && KIND_DET.has(lw[i - 1])) continue;
      if (fw[0] === 'rather' && lw[i + 1] === 'than') continue;
      if (fw[0] === 'just' && (lw[i + 1] === 'as' || lw[i + 1] === 'like')) continue;
      var e3 = i + fm.len - 1, fph = text.slice(toks[i].start, toks[e3].end);
      for (u = i; u <= e3; u++) used[u] = true;
      var hedge = HEDGES.has(fw[fw.length - 1]);
      issues.push({ type: 'filler', start: toks[i].start, end: toks[e3].end, text: fph,
        message: hedge ? q(fph) + ' is a hedge — say it directly' : q(fph) + ' adds little — try cutting it',
        suggestion: null });
      i = e3;
    }

    // Repeated words ("the the")
    for (i = 0; i < n - 1; i++) {
      if (used[i] || used[i + 1] || toks[i].kind !== 'latin') continue;
      if (lw[i] === lw[i + 1] && plainGap(i) && lw[i] !== 'had' && lw[i] !== 'that') {
        used[i] = used[i + 1] = true;
        issues.push({ type: 'repeated-word', start: toks[i].start, end: toks[i + 1].end,
          text: text.slice(toks[i].start, toks[i + 1].end),
          message: 'Repeated word: ' + q(toks[i].text + ' ' + toks[i + 1].text), suggestion: toks[i].text });
      }
    }

    // Adverbs
    for (i = 0; i < n; i++) {
      if (used[i] || !isAdverb(toks[i], lw[i], i === 0)) continue;
      issues.push({ type: 'adverb', start: toks[i].start, end: toks[i].end, text: toks[i].text,
        message: 'Adverb ' + q(toks[i].text) + ' — cut it or pick a stronger verb', suggestion: null });
    }

    // Long sentences
    if (n >= 25) {
      var very = n >= 40;
      issues.push({ type: very ? 'very-long-sentence' : 'long-sentence', start: start, end: end, text: stext,
        message: n + ' words — ' + (very ? 'very hard to follow. Split it into two or three.' : 'hard to follow. Split it in two.'),
        suggestion: null });
    }

    // Difficulty (0..100)
    var punct = stext.match(/[,;:()—–]/g) || [];
    var clauses = 0;
    punct.forEach(function (p) { clauses += (p === ',' ? 1 : p === ')' ? 0 : 2); });
    var ratio = n ? complex / n : 0;
    var lengthPts = 40 * clamp((n - 10) / 25, 0, 1);
    // complex-word ratio means little in very short sentences, so it is scaled in by length
    var complexPts = 25 * clamp(ratio / 0.3, 0, 1) * clamp(n / 12, 0, 1);
    var passivePts = Math.min(15, 10 * passives.length);
    var clausePts = 15 * clamp(clauses / 6, 0, 1);
    var jargonPts = 10 * clamp(jargon.length / 2, 0, 1);
    var difficulty = Math.round(lengthPts + complexPts + passivePts + clausePts + jargonPts);
    var lvl = difficulty < 25 ? 'easy' : difficulty < 45 ? 'ok' : difficulty < 65 ? 'hard' : 'very-hard';

    if (n >= 40) reasons.push(n + ' words — split it into two or three');
    else if (n >= 25) reasons.push(n + ' words — split it in two');
    else if (n >= 20) reasons.push(n + ' words — consider shortening it');
    if (complex >= 2) {
      reasons.push(complex + ' long word' + (complex > 1 ? 's' : '') + ': ' + listWords(complexList, 3));
    }
    if (passives.length) reasons.push('Passive voice: ' + passives.slice(0, 2).map(q).join(', '));
    if (clauses >= 4) reasons.push('Many clauses — try full stops instead of commas');
    if (jargon.length) {
      reasons.push('Plain English: ' + jargon.slice(0, 2).map(function (j) { return q(j.text) + ' → ' + q(j.alt); }).join(', '));
    }

    return {
      index: index, start: start, end: end, text: stext, paragraph: para,
      words: n, syllables: syl, complexWords: complex,
      grade: r1(fk(n, 1, syl)), difficulty: difficulty, level: lvl, reasons: reasons, rank: null,
      _poly: poly, _chars: chars, _long: longW, _toks: toks, _lw: lw
    };
  }

  /* ================================================================== *
   * analyze()                                                           *
   * ================================================================== */
  function analyze(input) {
    var text = input == null ? '' : String(input);
    if (!/\p{L}/u.test(text)) return null;
    var paraSpans = segmentText(text);
    if (!paraSpans.length) return null;

    var sentences = [], issues = [], paragraphs = [];
    paraSpans.forEach(function (p, pi) {
      var pw = 0, ps = 0, psyl = 0;
      p.sentences.forEach(function (sp) {
        var s = analyzeSentence(text, sp, sentences.length, pi, issues);
        sentences.push(s);
        pw += s.words; ps++; psyl += s.syllables;
      });
      paragraphs.push({ index: pi, start: p.start, end: p.end, words: pw, fleschReadingEase: r1(fre(pw, ps, psyl)) });
    });

    var W = 0, S = sentences.length, SYL = 0, CX = 0, POLY = 0, CH = 0, LONG = 0;
    var freq = new Map();
    sentences.forEach(function (s) {
      W += s.words; SYL += s.syllables; CX += s.complexWords; POLY += s._poly; CH += s._chars; LONG += s._long;
      for (var i = 0; i < s._toks.length; i++) {
        var w = s._lw[i];
        if (s._toks[i].kind !== 'latin' || w.length < 2 || STOP.has(w) || w.indexOf('.') >= 0) continue;
        freq.set(w, (freq.get(w) || 0) + 1);
      }
      delete s._toks; delete s._lw; delete s._poly; delete s._chars; delete s._long;
    });
    if (!W) return null;

    var asl = W / S, asw = SYL / W;
    var ease = fre(W, S, SYL);
    var gFK = fk(W, S, SYL);
    var gFog = 0.4 * (asl + 100 * CX / W);
    var gSmog = 1.0430 * Math.sqrt(POLY * 30 / S) + 3.1291;
    var L100 = CH / W * 100, S100 = S / W * 100;
    var gCLI = Math.max(0, 0.0588 * L100 - 0.296 * S100 - 15.8);
    var gARI = Math.max(0, 4.71 * (CH / W) + 0.5 * asl - 21.43);
    var grades = [gFK, gFog, gSmog, gCLI, gARI].map(function (g) { return Math.max(0, g); });
    var sorted = grades.slice().sort(function (a, b) { return a - b; });
    var consensus = (sorted[1] + sorted[2] + sorted[3]) / 3; // trimmed mean: drop highest and lowest

    // Five hardest sentences (4+ words)
    var hardest = sentences.filter(function (s) { return s.words >= 4; })
      .sort(function (a, b) { return b.difficulty - a.difficulty || b.grade - a.grade || a.index - b.index; })
      .slice(0, 5);
    hardest.forEach(function (s, i) { s.rank = i + 1; });

    issues.sort(function (a, b) { return a.start - b.start || b.end - a.end; });

    var wordFrequency = Array.from(freq, function (e) { return { word: e[0], count: e[1] }; })
      .sort(function (a, b) { return b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0); })
      .slice(0, 10);

    var chars = text.replace(/[\r\n]/g, '');
    var surrogates = (chars.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || []).length;
    var e1 = r1(ease);

    return {
      stats: {
        words: W, sentences: S, paragraphs: paragraphs.length, characters: chars.length - surrogates,
        syllables: SYL, complexWords: CX, longWords: LONG,
        readingTimeSec: Math.round(W / 238 * 60), speakingTimeSec: Math.round(W / 150 * 60),
        avgWordsPerSentence: r1(asl), avgSyllablesPerWord: r2(asw)
      },
      scores: {
        fleschReadingEase: e1,
        fleschKincaidGrade: r1(grades[0]), gunningFog: r1(grades[1]), smog: r1(grades[2]),
        colemanLiau: r1(grades[3]), ari: r1(grades[4]), consensusGrade: r1(consensus),
        label: label(e1), audience: audience(e1), letter: letter(e1)
      },
      sentences: sentences,
      hardest: hardest,
      issues: issues,
      paragraphs: paragraphs,
      wordFrequency: wordFrequency
    };
  }

  var Readable = {
    analyze: analyze,
    version: VERSION,
    // Internals exposed for tests and power users (not part of the UI contract).
    _syllables: syllables,
    _syllablesRulesOnly: function (w) {
      useExceptions = false;
      try { return computeSyllables(String(w)); } finally { useExceptions = true; }
    },
    _segment: segmentText
  };

  root.Readable = Readable;
  if (typeof module !== 'undefined' && module.exports) module.exports = Readable;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
