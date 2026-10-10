/*!
 * Readable engine v3 — readability analysis for the browser (and Node, for tests).
 * Plain script, no dependencies. Exposes window.Readable / module.exports.
 * See ENGINE.md for the API and the heuristics behind it.
 */
(function (root) {
  'use strict';

  var VERSION = '3.0.0';

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
  var MODALS = wordSet("will shall would should can could may might must won't wouldn't shouldn't can't cannot couldn't mustn't");
  var PASSIVE_SKIP = wordSet(
    'not never also always often already still just all both then now usually sometimes ' +
    'generally widely being been ever only once largely mostly fully partly rarely seldom'
  );
  // Irregular past participles: participle:base[:past] (past is the participle when left out).
  var PP_INFO = new Map();
  ('written:write:wrote made:make taken:take:took given:give:gave done:do:did seen:see:saw known:know:knew ' +
   'shown:show:showed told:tell sold:sell sent:send built:build bought:buy brought:bring caught:catch ' +
   'chosen:choose:chose found:find held:hold kept:keep led:lead left:leave lost:lose met:meet paid:pay put:put ' +
   'read:read run:run:ran said:say set:set spent:spend taught:teach thought:think understood:understand won:win ' +
   'worn:wear:wore broken:break:broke driven:drive:drove eaten:eat:ate fallen:fall:fell forgotten:forget:forgot ' +
   'forgiven:forgive:forgave frozen:freeze:froze grown:grow:grew hidden:hide:hid hit:hit hurt:hurt laid:lay ' +
   'meant:mean spoken:speak:spoke stolen:steal:stole struck:strike sworn:swear:swore thrown:throw:threw ' +
   'woken:wake:woke withdrawn:withdraw:withdrew withheld:withhold upheld:uphold undertaken:undertake:undertook ' +
   'overseen:oversee:oversaw drawn:draw:drew begun:begin:began bound:bind cut:cut dealt:deal fed:feed felt:feel ' +
   'fought:fight heard:hear lent:lend lit:light sought:seek shut:shut spread:spread stood:stand stuck:stick ' +
   'swept:sweep torn:tear:tore beaten:beat:beat bitten:bite:bit blown:blow:blew bred:breed burnt:burn dug:dig ' +
   'flown:fly:flew hung:hang proven:prove:proved ridden:ride:rode risen:rise:rose rung:ring:rang shaken:shake:shook ' +
   'sung:sing:sang sunk:sink:sank spun:spin wound:wind rewritten:rewrite:rewrote rebuilt:rebuild redone:redo:redid ' +
   'misled:mislead mistaken:mistake:mistook misunderstood:misunderstand overtaken:overtake:overtook ' +
   'overheard:overhear overpaid:overpay broadcast:broadcast forecast:forecast underpaid:underpay ' +
   'underwritten:underwrite:underwrote foreseen:foresee:foresaw gotten:get:got fled:flee slept:sleep slid:slide ' +
   'split:split thrust:thrust drunk:drink:drank forbidden:forbid:forbade forsaken:forsake:forsook ' +
   'stricken:strike:struck shaven:shave:shaved sown:sow:sowed sewn:sew:sewed learnt:learn spelt:spell spilt:spill ' +
   'dreamt:dream wed:wed wept:weep arisen:arise:arose awoken:awake:awoke bled:bleed clung:cling crept:creep ' +
   'flung:fling ground:grind knelt:kneel lain:lie:lay leant:lean mown:mow:mowed outgrown:outgrow:outgrew ' +
   'outdone:outdo:outdid overthrown:overthrow:overthrew overrun:overrun:overran rid:rid shorn:shear:sheared ' +
   'slain:slay:slew slung:sling slit:slit smelt:smell sped:speed spat:spit spoilt:spoil sprung:spring:sprang ' +
   'stung:sting stunk:stink:stank strewn:strew:strewed striven:strive:strove strung:string swollen:swell:swelled ' +
   'swum:swim:swam swung:swing trodden:tread:trod undone:undo:undid wrung:wring retold:retell foretold:foretell ' +
   'mislaid:mislay waylaid:waylay beset:beset bidden:bid:bade cleft:cleave hewn:hew:hewed shod:shoe ' +
   'thriven:thrive:throve unbound:unbind unwound:unwind outlawed:outlaw underestimated:underestimate')
    .split(' ').forEach(function (e) { var p = e.split(':'); PP_INFO.set(p[0], [p[1], p[2] || p[0]]); });
  var IRREGULAR_PP = new Set(PP_INFO.keys());
  // -ed words that are not past participles (or are adjectives we should not flag).
  var NOT_PP = wordSet(
    'need seed feed speed bleed breed deed weed greed heed steed indeed proceed succeed exceed ' +
    'bed red shed sled shred wed bred fled hundred kindred naked sacred wicked rugged ragged ' +
    'crooked beloved jagged hatred embed'
  );
  // Verbs that are not in the familiar list but often appear as participles in formal text.
  var EXTRA_VERBS = wordSet(
    'retain determine submit require notify indemnify reimburse terminate allocate approve assess calculate ' +
    'comprise constitute deem designate disclose dispose enforce evaluate execute exempt exercise expire extend ' +
    'furnish grant impose incur initiate levy mandate obtain process procure reconcile render repay revoke ' +
    'specify stipulate verify waive withhold implement facilitate utilize utilise commence ascertain endeavour ' +
    'endeavor acquire accompany alleviate ameliorate anticipate attain consolidate disseminate eliminate ' +
    'elucidate encounter expedite finalize finalise initiate modify necessitate participate possess reside ' +
    'solicit transmit criticise criticize introduce reserve gather express publish sign agree free secure ' +
    'issue value continue declare ignore store score handle settle consume assume define examine combine ' +
    'decline estimate locate rate note name hope use base close cause raise release increase please'
  );

  /* ------------------------------------------------------------------ *
   * Familiar words: about 5,000 everyday English lemmas (plus common     *
   * Indian-English, business, school, food and tech words). A word is    *
   * "familiar" when it, its inflection (-s -ed -ing -er -est -ly) or a   *
   * transparent derivation (-ness -ment -ation -ity -ence…) of a listed  *
   * word is here. Readers do not stumble on familiar words, however long. *
   * ------------------------------------------------------------------ */
  var FAMILIAR = wordSet([
    // function words, pronouns, numbers, days, months
    'a an the and or but nor so yet for of to in on at by with from into onto upon over under about above below ' +
    'across after against along among around as before behind beside besides between beyond down during except ' +
    'inside near off out outside past since than through throughout till toward towards until up via within without ' +
    'i me my mine myself you your yours yourself yourselves he him his himself she her hers herself it its itself ' +
    'we us our ours ourselves they them their theirs themselves this that these those who whom whose which what ' +
    'whatever whoever whichever whenever wherever when where why how there here then now not no yes ok okay all ' +
    'any both each either neither every few many much more most less least some such same other another own ' +
    'enough several plenty lot lots can could may might must shall should will would ought be am is are was were ' +
    'been being do does did done doing have has had having get got gotten if unless whether because although though ' +
    'while once also too very just only even still already almost quite rather really perhaps maybe probably ' +
    'sometimes often always never ever usually again soon later today tonight tomorrow yesterday ago away back ' +
    'else instead indeed therefore however otherwise anyway meanwhile thus hence besides altogether ' +
    'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen ' +
    'eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million billion ' +
    'trillion lakh lakhs crore crores first second third fourth fifth sixth seventh eighth ninth tenth half ' +
    'quarter double triple dozen zero monday tuesday wednesday thursday friday saturday sunday january february ' +
    'march april may june july august september october november december weekday weekend morning afternoon ' +
    'evening night noon midnight',
    // A
    'able ability abroad absence absent absolute absolutely absorb abstract abuse academic academy accent accept ' +
    'acceptable access accident accidentally accommodation according account accountant accuracy accurate accuse ' +
    'ache achieve achievement acid acre act action active activist activity actor actress actual actually ad adapt ' +
    'add addict addition address admin administration administrative admire admission admit adopt adore adult ' +
    'advance advanced advantage adventure advert advertise advertisement advertising advice advise adviser advisor ' +
    'aeroplane affair affect affection afford afraid afternoon afterwards age agency agenda agent aggressive agree ' +
    'agreement agriculture ahead aid aim air aircraft airline airplane airport alarm album alcohol alert algorithm ' +
    'alien alike alive alley alliance allow allowance ally alone alongside aloud alphabet alright alter alternative ' +
    'always amateur amaze amazed amazing ambassador ambition ambitious ambulance amendment amount amuse analyse ' +
    'analysis analyst analytics analyze ancestor ancient angel anger angle angry animal ankle anniversary announce ' +
    'announcement annoy annoyed annual answer ant anxiety anxious anybody anymore anyone anything anywhere apart ' +
    'apartment apologise apologize apology app apparent apparently appeal appear appearance appetite applaud ' +
    'applause apple appliance applicant application apply appoint appointment appreciate appreciation approach ' +
    'appropriate approval approve approximate apron aquarium arch architect architecture archive area arena argue ' +
    'argument arise arm armed army arrange arrangement arrest arrival arrive arrow art article artificial artist ' +
    'artistic ash ashamed aside ask asleep aspect assemble assembly assess assessment asset assign assignment ' +
    'assist assistant associate association assume assumption assure athlete atmosphere atom attach attack attempt ' +
    'attend attendance attention attic attitude attorney attract attraction attractive auction audience audio ' +
    'audit aunt aunty author authority auto automatic automatically automobile autumn availability available ' +
    'avenue average avoid await awake award aware awareness awesome awful awkward axe',
    // B
    'baby background backup backward backwards bacon bad badge badly badminton bag baggage bake baker bakery ' +
    'balance balcony bald ball balloon ban banana band bandage bang bank banker banking bar barber bare barely ' +
    'bargain bark barn barrel barrier base baseball basement basic basically basin basis basket basketball bat ' +
    'batch bath bathroom batsman battery battle bay beach bead beam bean bear beard beast beat beautiful beauty ' +
    'become bed bedroom bee beef beer beg begin beginner beginning behalf behave behaviour behavior belief believe ' +
    'bell belly belong beloved belt bench bend beneath benefit best bet better bicycle bid big bike bill billing ' +
    'bin bind biology bird birth birthday biscuit bit bite bitter black blade blame blank blanket blast bleed ' +
    'blend bless blind block blog blogger blonde blood blow blue board boat body boil bold bomb bond bone bonus ' +
    'book booking bookshop boom boost boot border bored boring born borrow boss bother bottle bottom bounce bound ' +
    'boundary bow bowl bowler box boxing boy boyfriend brain brake branch brand brave bread break breakfast ' +
    'breast breath breathe breed breeze brick bride bridge brief briefly bright brilliant bring broad broadband ' +
    'broadcast broken brother brown browse browser brush bubble bucket budget buffet bug build builder building ' +
    'bulb bull bullet bump bunch bunny burden burger burn burst bury bus bush business businessman ' +
    'businesswoman busy butter butterfly button buy buyer buzz bye',
    // C
    'cab cabin cabinet cable cafe cage cake calculate calculation calculator calendar call calm camel camera camp ' +
    'campaign campus can canal cancel cancer candidate candle candy canteen cap capable capacity capital captain ' +
    'caption capture car carbon card care career careful careless cargo carpet carrot carry cart cartoon case cash ' +
    'cashback cashier cast castle casual cat catch category cattle cause caution cave ceiling celebrate ' +
    'celebration celebrity cell cement cent centre center central century cereal ceremony certain certainly ' +
    'certainty certificate chai chain chair chairman chairperson chalk challenge champion championship chance ' +
    'change channel chaos chapati chapter character charge charger charity charm chart chase chat chatbot cheap ' +
    'cheat check checkout cheek cheer cheerful cheese chef chemical chemistry cheque chess chest chicken chief ' +
    'child childhood children chilli chilly chin chip chocolate choice choir choose chop chorus church cigarette ' +
    'cinema circle circuit circumstance citizen city civil claim clap clarify class classic classical classmate ' +
    'classroom clause clean clear clearly clerk clever click client cliff climate climb clinic clip clock close ' +
    'closed cloth clothes clothing cloud club clue coach coaching coal coast coat code coffee coin cold collapse ' +
    'collar colleague collect collection college colony colour color colourful colorful column comb combination ' +
    'combine come comedy comfort comfortable comic command comment commerce commercial commission commit ' +
    'commitment committee common commonly communicate communication community commute company compare comparison ' +
    'compete competition competitive competitor complain complaint complete completely complex complicated ' +
    'component compose composer composition computer concentrate concentration concept concern concerned concert ' +
    'conclude conclusion concrete condition conduct conference confidence confident confirm conflict confuse ' +
    'confused confusing confusion congratulate congratulations connect connection conscious consent consequence ' +
    'conservative consider considerable consideration consist consistent constant constantly constitution ' +
    'construct construction consult consultant consume consumer contact contain container content contest context ' +
    'continent continue continuous contract contrast contribute contribution control controversial convenient ' +
    'conversation convert convince cook cooker cookie cooking cool cooperate cooperation cope copy core corn ' +
    'corner corporate corporation correct correction cost costly costume cottage cotton couch cough could council ' +
    'count counter country countryside county couple coupon courage course court cousin cover cow crack craft ' +
    'crash crazy cream create creation creative creator creature credit crew cricket crime criminal crisis ' +
    'criteria critic critical criticism criticise criticize crop cross crowd crowded crown crucial cruel crush ' +
    'cry crystal cucumber culture cup cupboard cure curd curious currency current currently curriculum curry ' +
    'curtain curve custom customer cut cute cycle cyclone',
    // D
    'dad daddy daily dairy dal damage damp dance dancer danger dangerous dare dark darling dashboard data database ' +
    'date daughter dawn day dead deadline deaf deal dealer dear death debate debit debt decade decide decision deck ' +
    'declare decline decorate decoration decrease deep deeply deer defeat defence defense defend define definite ' +
    'definitely definition degree delay delete deliberately delicate delicious delight delighted deliver delivery ' +
    'demand democracy democratic demonstrate demonstration dentist deny depart department departure depend ' +
    'deposit depressed depression depth describe description desert deserve design designer desire desk despite ' +
    'dessert destination destroy destruction detail detailed detect detective determine develop developer ' +
    'development device devil diagram dial dialogue diamond diary dice dictionary die diesel diet differ difference ' +
    'different difficult difficulty dig digital dimension dine dinner dip direct direction directly director dirt ' +
    'dirty disability disabled disadvantage disagree disappear disappoint disappointed disappointment disaster ' +
    'disc discipline discount discover discovery discuss discussion disease dish disk dislike dismiss display ' +
    'distance distant distribute district disturb dive divide division divorce doctor document documentary dog ' +
    'doll dollar domestic donate donation door dose dot double doubt dough down download downstairs downtown draft ' +
    'drag drain drama dramatic draw drawer drawing dream dress drink drive driver drop drought drown drug drum ' +
    'drunk dry duck due dull dump dust duty',
    // E
    'eager ear early earn earnings earth earthquake ease easily east eastern easy eat economic economics economy ' +
    'edge edit edition editor educate education educational effect effective effectively efficiency efficient ' +
    'effort egg eighty either elbow elder elderly elect election electric electrical electricity electronic ' +
    'electronics elegant element elementary elephant elevator eligible else elsewhere email embarrass embarrassed ' +
    'embarrassing embassy emergency emotion emotional emphasis empire employ employee employer employment empty ' +
    'enable encourage encouragement end ending enemy energy engage engaged engagement engine engineer engineering ' +
    'enjoy enormous enquiry enter entertain entertainment enthusiasm enthusiastic entire entirely entrance entry ' +
    'envelope environment environmental episode equal equality equally equipment error escape especially essay ' +
    'essential establish estate estimate ethnic euro evaluate evaluation even event eventually everybody everyday ' +
    'everyone everything everywhere evidence evil exact exactly exam examination examine example excellent except ' +
    'exception exchange excite excited excitement exciting exclusive excuse executive exercise exhausted ' +
    'exhibition exist existence exit expand expansion expect expectation expense expensive experience experiment ' +
    'expert explain explanation explode explore explosion export expose express expression extend extension ' +
    'extent extra extraordinary extreme extremely eye',
    // F
    'fabric face facility fact factor factory fail failure faint fair fairly faith fake fall false fame familiar ' +
    'family famous fan fancy fantastic far fare farm farmer farming fashion fast fat fate father fault favour ' +
    'favor favourite favorite fear feature fee feed feedback feel feeling fellow female fence festival fetch ' +
    'fever fewer fiction field fight fighter figure file fill film filter final finally finance financial find ' +
    'finding fine finger finish fire firm fish fishing fit fitness fix flag flame flash flat flavour flavor fleet ' +
    'flight float flood floor flour flow flower flu fly focus fog fold folder folk follow follower following fond ' +
    'food fool foolish foot football force forecast foreign forest forever forget forgive fork form formal format ' +
    'former formula fort forth fortnight fortunate fortunately fortune forum forward found foundation founder fox ' +
    'frame free freedom freeze freezer frequent fresh fresher freshers fridge friend friendly friendship frighten ' +
    'frog front frozen fruit frustrated fry fuel full fully fun function fund funding funeral funny fur furniture ' +
    'further future',
    // G
    'gain gallery game gaming gang gap garage garbage garden garlic gas gate gather gear gender general generally ' +
    'generate generation generous genius gentle gentleman genuine geography ghee ghost giant gift ginger girl ' +
    'girlfriend give glad glance glass global glove glow glue go goal goat god gold golden golf good goodbye goods ' +
    'gossip govern government governor grab grade gradually graduate graduation grain gram grammar grand ' +
    'grandchild granddaughter grandfather grandma grandmother grandpa grandparent grandson granny grant grape ' +
    'graph graphic grass grateful grave gravy great greet green grey gray grief grill grin grind grip grocery ' +
    'gross ground group grow growth guarantee guard guess guest guidance guide guideline guilty guitar gun guy gym',
    // H
    'habit hair haircut half hall hammer hand handbag handle handsome hang happen happily happiness happy harbour ' +
    'harbor hard hardly hardware harm harmful hat hate head headache heading headline headphones headquarters heal ' +
    'health healthy hear heart heat heater heaven heavy height helicopter hell hello helmet help helpful hen hero ' +
    'hesitate hey hi hide high highlight highly highway hill hint hip hire history hit hobby hockey hold holder ' +
    'hole holiday hollow holy home homework honest honestly honey honour honor hook hope hopefully horrible horror ' +
    'horse hospital host hostel hot hotel hour house household housewife housing hug huge human humour humor ' +
    'hundred hungry hunt hurry hurt husband hut',
    // I
    'ice idea ideal identify identity idiot ignore ill illegal illness image imagination imagine immediate ' +
    'immediately immigrant immigration impact import importance important impossible impress impression ' +
    'impressive improve improvement inch incident include including income increase increasingly incredible ' +
    'indeed independence independent index individual indoor industrial industry infant infection inflation ' +
    'influence influencer inform information infrastructure ingredient initiative injure injury ink inner innocent ' +
    'innovation input insect inside insist inspector inspiration install installation instance instant instantly ' +
    'instead institute institution instruction instrument insurance intelligence intelligent intend intention ' +
    'interest interested interesting internal international internet internship interpret interrupt interval ' +
    'interview introduce introduction invent invention invest investigate investigation investment investor ' +
    'invitation invite invoice involve involved iron island issue item',
    // J K
    'jacket jail jam jar jaw jazz jealous jeans jelly jewel jewellery jewelry job join joint joke journal ' +
    'journalist journey joy judge judgement judgment juice jump junior junk jury justice justify ' +
    'keen keep kettle key keyboard kick kid kidney kill kilo kilogram kilometre kilometer kind kindness king ' +
    'kingdom kiss kit kitchen kite kitten knee knife knock knot know knowledge',
    // L
    'lab label laboratory labour labor lack ladder lady lake lamp land landing landlord landscape lane language ' +
    'laptop large largely last late lately later latest laugh laughter launch laundry law lawn lawyer lay layer ' +
    'layout lazy lead leader leadership leaf league leak lean learn learner learning lease leather leave lecture ' +
    'left leg legal legend leisure lemon lend length lentil lesson let letter level liberal library licence ' +
    'license lid lie life lifestyle lifetime lift light like likely limit limited line link lion lip liquid list ' +
    'listen literally literature litre liter little live lively living load loan lobby local locate location lock ' +
    'log logic login logo lonely long look loose lord lorry lose loser loss lost lot loud love lovely lover low ' +
    'lower loyal loyalty luck lucky luggage lunch lung luxury',
    // M
    'machine mad madam magazine magic magnet mail main mainly maintain maintenance major majority make maker ' +
    'makeup male mall man manage management manager mango manner manual manufacture manufacturer many map marble ' +
    'march margin mark market marketing marriage married marry mask mass massive master masala match mate ' +
    'material math maths mathematics matter maximum mayor meal mean meaning means meanwhile measure measurement ' +
    'meat mechanic mechanical medal media medical medicine medium meet meeting melt member membership memory ' +
    'mental mention mentor menu merchant mercy mere merely merit mess message metal method metre meter metro ' +
    'middle mild mile military milk mill mind mineral minimum minister ministry minor minority minus minute ' +
    'miracle mirror miss missing mission mistake mix mixture mobile mode model moderate modern mom moment mommy ' +
    'money monitor monkey monsoon month monthly mood moon moral moreover morning mosque mosquito mother motion ' +
    'motivate motivation motor motorbike mountain mouse mouth move movement movie mr mrs ms mud mug multiple ' +
    'multiply mum mummy municipal murder muscle museum mushroom music musical musician must mutton mutual mystery',
    // N
    'nail name narrow nation national nationwide native natural naturally nature naughty navy near nearby ' +
    'nearly neat necessary necessarily neck need needle negative neighbour neighbor neighbourhood neighborhood ' +
    'nephew nerve nervous nest net network neutral never nevertheless new newly news newsletter newspaper next ' +
    'nice niece night nobody nod noise noisy none nonsense noodle normal normally north northern nose note ' +
    'notebook nothing notice notification novel nowhere number nurse nursery nut',
    // O
    'oath obey object objective observation observe obvious obviously occasion occasional occasionally occupation ' +
    'occupy occur ocean odd offence offense offer office officer official offline often oil old olive ' +
    'online onion onto open opening opera operate operation operator opinion opponent opportunity oppose ' +
    'opposite opposition option orange orbit order ordinary organ organic organisation organization organise ' +
    'organize origin original originally orphan otherwise outcome outdoor outer outfit outline output outstanding ' +
    'oven overall overcome overseas owe owner ownership oxygen',
    // P
    'pace pack package packet pad page pain painful paint painter painting pair palace pale palm pan pancake panel ' +
    'paneer panic pants paper parade paragraph parcel pardon parent park parking parliament part participant ' +
    'participate participation particular particularly partly partner partnership party pass passage passenger ' +
    'passion passionate passport password past pasta paste path patience patient pattern pause pay payment peace ' +
    'peaceful peak peanut pear pen penalty pencil penny pension people pepper per percent percentage perfect ' +
    'perfectly perform performance perfume perhaps period permanent permission person personal personality ' +
    'personally perspective persuade pet petrol phase philosophy phone photo photograph photographer photography ' +
    'phrase physical physically physics piano pick picnic picture pie piece pig pile pill pillow pilot pin pink ' +
    'pipe pitch pity pizza place placement plain plan plane planet planning plant plastic plate platform play ' +
    'player playground pleasant please pleased pleasure plenty plot plug plus pocket poem poet poetry point ' +
    'poison pole police policy polish polite political politician politics poll pollution pond pool poor pop ' +
    'popular popularity population pork port portal portion portrait position positive possibility possible ' +
    'possibly post postcard poster pot potato potential pound pour poverty powder power powerful practical ' +
    'practice practise praise pray prayer predict prediction prefer preference pregnant premium preparation ' +
    'prepare prescription presence present presentation preserve president press pressure pretend pretty prevent ' +
    'previous previously price pricing pride priest primary prime prince princess principal principle print ' +
    'printer priority prison prisoner privacy private prize probably problem procedure process produce producer ' +
    'product production profession professional professor profile profit program programme programmer ' +
    'programming progress project promise promote promotion prompt proof proper properly property proportion ' +
    'proposal propose protect protection protest proud prove provide province public publicity publish publisher ' +
    'pull pulse pump punch punish punishment pupil puppy purchase pure purple purpose purse push put puzzle',
    // Q R
    'qualification qualify quality quantity quarrel quarter quarterly queen query question questionnaire queue ' +
    'quick quickly quiet quietly quit quiz quote race racing radio rail railway rain rainbow raise rally range rank ' +
    'rapid rapidly rare rarely rat rate ratio raw reach react reaction read reader reading ready real realistic ' +
    'reality realise realize really rear reason reasonable reasonably rebel receipt receive recent recently ' +
    'reception recipe recognise recognize recommend recommendation record recover recovery recruit red reduce ' +
    'reduction refer referee reference reflect reform refresh refrigerator refund refuse regard region regional ' +
    'register registration regret regular regularly regulation reject relate related relation relationship ' +
    'relative relatively relax relaxed release relevant reliable relief relieve religion religious rely remain ' +
    'remark remarkable remember remind reminder remote remove rent repair repeat replace reply report reporter ' +
    'represent representative republic reputation request require requirement rescue research researcher ' +
    'reservation reserve resident resign resist resolve resort resource respect respond response responsibility ' +
    'responsible rest restaurant result retail retire retired retirement return reveal revenue review revise ' +
    'revision revolution reward rhythm rice rich rickshaw rid ride right ring rise risk river road roast rob robot ' +
    'rock role roll romance romantic roof room root rope rose rotate roti rough round route routine row royal rub ' +
    'rubber rubbish rude rugby ruin rule ruler rumour rumor run runner rupee rupees rural rush',
    // S
    'sack sad sadly safe safely safety sail salad salary sale salt same sample sand sandwich satellite ' +
    'satisfaction satisfied satisfy sauce save saving savings say scale scan scare scared scary scene schedule ' +
    'scheme scholarship school science scientific scientist scissors scooter score scream screen screenshot screw ' +
    'script sea seal search season seat second secondary secret secretary section sector secure security see ' +
    'seed seek seem select selection self selfie sell semester seminar send senior sense sensible sensitive ' +
    'sentence separate separately sequence series serious seriously servant serve server service session set ' +
    'setting settle setup seven severe sew sex shade shadow shake shall shallow shame shampoo shape share sharp ' +
    'shave sheep sheet shelf shell shelter shift shine ship shipping shirt shock shoe shoot shop shopkeeper ' +
    'shopping shore short shortly shot should shoulder shout show shower shut shy sick side sight sign signal ' +
    'signature significant significantly silence silent silk silly silver similar similarly simple simply sing ' +
    'singer single sink sir sister sit site situation size skill skilled skin skip skirt sky sleep sleepy slice ' +
    'slide slight slightly slim slip slogan slow slowly small smart smartphone smell smile smoke smooth snack snake ' +
    'snow soap soccer social socially society sock sofa soft software soil solar soldier sole solid solution solve ' +
    'somebody somehow someone something sometimes somewhat somewhere son song sore sorry sort soul sound soup sour ' +
    'source south southern space spare speak speaker special specialist species specific specifically speech speed ' +
    'spell spend spice spicy spider spin spirit spiritual spite split spoil sponsor spoon sport sports spot spray ' +
    'spread spring square squeeze stable stadium staff stage stair stairs stall stamp stand standard star stare ' +
    'start startup state statement station statistic statistics statue status stay steady steal steam steel ' +
    'step stick sticker still stipend stir stock stomach stone stop storage store storm story stove straight ' +
    'strange stranger strategy stream street strength stress stressed stretch strict strike string strip stroke ' +
    'strong structure struggle stubborn student studio study stuff stupid style subject submit subscribe ' +
    'subscription subsidy substance subtract suburb succeed success successful successfully such sudden suddenly ' +
    'suffer sugar suggest suggestion suit suitable suitcase summary summer sun sunny super superb supermarket ' +
    'supervisor supply support supporter suppose sure surely surface surgeon surgery surname surprise surprised ' +
    'surprising surround surroundings survey survive suspect sustainable swallow swear sweat sweater sweep sweet ' +
    'swim swimming swing switch syllabus symbol sympathy symptom system',
    // T
    'table tablet tag tail tailor take tale talent talented talk tall tank tap tape target task taste tasty tax ' +
    'taxi tea teach teacher teaching team tear teaspoon tablespoon technical technique technology teen teenage ' +
    'teenager telephone television tell temperature temple temporary ten tend tender tennis tension tent term ' +
    'terms terrible terribly terrorist test text textbook thank thankful thanks theatre theater theft theme then ' +
    'theory therapy thick thief thin thing think thinking thirsty thorough thought thousand thread threat threaten ' +
    'throat throw thumb ticket tidy tie tiger tight tile time timeline timetable timing tin tiny tip tired title ' +
    'toast toe together toilet token tomato ton tone tongue tool tooth top topic topper torch total totally touch ' +
    'tough tour tourism tourist tournament towel tower town toy track trade trader tradition traditional traffic ' +
    'tragedy trail train trainer training transaction transfer transform translate translation transport ' +
    'transportation trap trash travel traveller traveler tray treat treatment tree trend trial triangle trick trip ' +
    'trophy trouble trousers truck true truly trust truth try tube tuition tune tunnel turmeric turn tutor tutorial ' +
    'twice twin twist type typical typically tyre tire',
    // U V
    'ugly ultimate ultimately umbrella unable uncle underground understand understanding underwear unemployed ' +
    'unemployment unfair unfortunate unfortunately uniform union unique unit unite united unity universal universe ' +
    'university unknown unless unlike unlikely unlock unusual update upgrade upload upper upset upstairs urban ' +
    'urge urgent urgently usage use used useful useless user username usual usually utility vacancy vacation ' +
    'vaccine valid valley valuable value van variety various vary vast vegetable vegetarian vehicle venue verify ' +
    'version very vessel veteran victim victory video view viewer village villager violence violent viral virtual ' +
    'virus visa visible vision visit visitor visual vital vitamin voice volume volunteer vote voter voucher',
    // W–Z
    'wage wait waiter waitress wake walk wall wallet wander want war ward warm warmth warn warning wash washing ' +
    'waste watch water wave way weak weakness wealth wealthy weapon wear weather web webinar website wedding week ' +
    'weekly weigh weight weird welcome welfare well west western wet whale wheat wheel whisper whistle white whole ' +
    'wholesale wide widely width wife wifi wild wildlife willing win wind window wine wing winner winter wire wise ' +
    'wish witness woman women wonder wonderful wood wooden wool word work worker workout workplace workshop world ' +
    'worldwide worm worried worry worse worst worth worthy would wound wow wrap wrist write writer writing wrong ' +
    'yard yeah year yearly yellow yesterday yoga yogurt young youngster youth youtube zone zoo',
    // irregular forms
    'went gone made took taken gave given saw seen knew known came became thought brought bought caught taught ' +
    'told sold said paid found felt kept left lost meant met ran sat stood understood wrote written spoke spoken ' +
    'broke chose chosen drove driven ate eaten fell fallen forgot forgotten froze grew grown hid hidden rode ' +
    'ridden rose risen sang sung swam threw thrown wore worn won woke woken built sent spent lent heard held led ' +
    'fed fled fought slept swept shot shut hit hurt cut put set let cost read began begun drank drunk flew flown ' +
    'men feet teeth mice geese lives wives knives leaves thieves halves selves people children',
    // everyday verbs
    'bathe chew clap crawl dine fasten fold gaze grate grease hop hug hum itch jog juggle kneel knit lick limp ' +
    'mend moan nod obey pack paddle peel pinch plug poke pop preach prick rinse rot scatter scold scorch scrape ' +
    'scratch scribble scrub shiver shrug sigh sip ski skip slap smash snatch sneeze sniff snore soak soothe spark ' +
    'sparkle sprout squash squeak squeal stain steer stitch strap tame tease tempt thaw tick tickle tow trace ' +
    'tremble trot tug tumble wail whine whip whirl wink wipe wobble wreck wrestle wriggle yawn yell zip zoom ' +
    'remove reuse rewrite rebuild restart reset retry recycle rename resize reply react rewind replay',
    // school, college, work
    'assignment attendance batch bench blackboard board canteen certificate class classmate coaching college ' +
    'course coursework curriculum dean degree diploma elective entrance exam examiner faculty fees fresher ' +
    'grade graduate hostel homework intern internship lecture lecturer library marks mentor notes paper placement ' +
    'presentation principal professor project quiz rank result scholarship semester seminar stipend student ' +
    'syllabus teacher term test thesis timetable topper tuition tutor university viva workshop ' +
    'boss career colleague deadline department designation employee employer hiring interview job manager ' +
    'meeting office offer onboarding payroll promotion recruiter resume salary schedule shift staff startup team ' +
    'teammate training workplace appraisal increment leave bonus incentive',
    // money, business, India
    'account amount atm balance bank bill budget business buyer cash cashback cheque coin cost credit crore debit ' +
    'debt deposit discount dividend earn earning economy emi expense export fare fee finance fund gold growth gst ' +
    'import income inflation instalment installment insurance interest invest investment invoice lakh lender ' +
    'lending loan loss market money mortgage net offer paise pay payment pension premium price profit purchase ' +
    'rate receipt refund rent repay repayment rupee salary sale saving savings seller share shop spend stock ' +
    'subsidy tax trade transaction turnover upi value wage wallet wealth customer client brand product service ' +
    'company firm startup founder investor shareholder stake ceo director chairman board revenue sales marketing ' +
    'advertising campaign launch strategy growth target goal plan quarter forecast report data review feedback ' +
    'feature delivery shipping order checkout cart warranty guarantee retail wholesale supplier vendor dealer ' +
    'distributor factory industry sector economy government ministry minister policy scheme reform tariff ' +
    'repo bank banking banker deposit withdrawal branch passbook aadhaar pan kyc ration panchayat village ' +
    'district state city town metro auto rickshaw chai tiffin dhaba bazaar mandi kirana diwali holi eid ' +
    'cricket kabaddi monsoon flat society colony aunty uncle bhaiya didi beta namaste',
    // food and kitchen
    'bake batter boil bowl bread butter cardamom chapati chickpea chilli chutney cinnamon coconut coriander cumin ' +
    'curd curry dal dough flour fry garlic ghee ginger gram grill heat jaggery knead lentil lid masala mint mix ' +
    'mustard naan noodle oil omelette onion oven paneer pan pepper pickle potato pulao rice roast roti saffron ' +
    'salt sauce simmer slice spice spinach spoon stir sugar tamarind teaspoon tablespoon tomato turmeric ' +
    'vegetable vinegar wheat yogurt biryani dosa idli samosa paratha halwa kheer lassi pakora raita sambar ' +
    'crisp crispy golden fluffy tender juicy delicious tasty fresh frozen chopped sliced grated minced',
    // tech and the web
    'app application backend browser bug cache cloud code coder coding command component computer config ' +
    'configure connect cookie data database debug deploy deployment desktop developer device digital directory ' +
    'domain download editor email error feature file folder font framework frontend function hardware host ' +
    'hosting icon install internet keyboard laptop library link linux login logout module mouse network node ' +
    'notification offline online open package page password platform plugin port printer privacy program ' +
    'programmer project pull push react release repo repository router script scroll search server settings ' +
    'setup signup site software source storage stream sync tab tablet template terminal test theme token tool ' +
    'tutorial update upgrade upload url user username version video web webpage website wifi window windows ' +
    'workflow',
    // common adult vocabulary (long but well known)
    'absolutely academic accommodation accountability accuracy accurately acknowledge additionally ' +
    'administration administrator adolescent advertisement affordable aggressive agricultural alternative ' +
    'ambulance anniversary anonymous apparently appreciate appreciation appropriate approximately architecture ' +
    'association atmosphere attractive authority automatically availability biography biology calculation ' +
    'capability category celebration certificate characteristic circumstances classification collaboration ' +
    'combination comfortable commercial communication community comparison competition competitive complicated ' +
    'composition comprehensive concentration confidential consequence considerable consideration consistent ' +
    'constitution construction contemporary continuous contribution controversial conversation cooperation ' +
    'corporation curriculum decoration definitely democracy democratic demonstration department dependent ' +
    'description development dictionary difference difficulty dimension disability disappointment ' +
    'discrimination documentary economy economics education effectively efficiency electricity electronic ' +
    'elementary eligible emergency emotional encouragement engineering entertainment enthusiasm environment ' +
    'environmental equipment especially essential establishment evaluation eventually evidence examination ' +
    'exhibition expectation experience experiment explanation extraordinary facility familiar fundamental ' +
    'generation geography government graduation historical hospitality identification identity immediately ' +
    'immigration imagination importantly impossible improvement independence independent indicate individual ' +
    'industrial inflation information infrastructure initiative innovation inspiration institution insurance ' +
    'intelligence intelligent interaction interesting international interpretation interview introduction ' +
    'investigation investment involvement journalism laboratory literature location maintenance management ' +
    'manufacturer mathematics measurement mechanical medication membership military minimum ministry ' +
    'motivation municipal necessary negotiation neighbourhood occupation operation opportunity opposition ' +
    'organisation organization original participation particular partnership performance permanent personality ' +
    'perspective philosophy photography political politician population possibility potential practical ' +
    'preparation presentation president previously primarily priority probability procedure production ' +
    'professional profession programme property proportion protection psychology publication qualification ' +
    'reasonable recommendation recognition registration regulation relationship relatively reliable religious ' +
    'remarkable representative reputation requirement reservation residential resolution responsibility ' +
    'responsible restaurant revolution satisfaction scientific secretary security significant similarity ' +
    'situation specific specifically sponsorship statistics strategy subscription successful suggestion ' +
    'supervisor sustainable technical technology telephone television temperature territory tradition ' +
    'traditional transportation unemployment unfortunately uniform universal university unnecessary valuable ' +
    'variety vegetable vocabulary volunteer vulnerable wonderful',
    // more everyday nouns and adjectives
    'accent acre actor alarm alley angel apron arrow ash attic awning backpack badge bait bakery balloon bamboo ' +
    'bandage banner barber basket bead beak bean beard bee beetle bell belt berry bin blade blanket blossom boot ' +
    'bottle bouquet bow bracelet brick broom bubble bucket buckle bud buffalo bull bundle bunk cabbage cactus ' +
    'cage calf camel candle cane canvas cape carpet carriage carton cattle cauliflower cave chalk chamber cherry ' +
    'chimney cloak clover cobweb cockroach collar comb compass cork costume cot cottage crab cradle crate crayon ' +
    'crocodile crow crumb crust cub cushion daisy deer desert dew diamond donkey dove dragon drawer drum dune ' +
    'eagle easel elbow fairy feather fern ferry fig flask flute foam forehead fork fountain fox frost fudge ' +
    'galaxy gem giraffe glacier goose gorilla grapes grasshopper gravel hammock hamster harbour hawk hay hedge ' +
    'helmet hippo honey hoof horn hose hut iceberg igloo insect ivory jaguar jar jellyfish jug kangaroo kettle ' +
    'koala ladder lamb lantern lap lawn leopard lettuce lighthouse lily lizard llama lobster locker lollipop loom ' +
    'magpie mane maple marble mattress meadow melon mitten mole moth mound mug mule nail napkin nest net nut oak ' +
    'oar octopus orchard ostrich otter owl ox pail palm panda parrot peach peacock pear pearl pebble pelican ' +
    'penguin petal pigeon pillar pine pineapple pirate pit plum pole pony porch pumpkin quilt rabbit raft raven ' +
    'rhino ribbon robe rocket rooster rug sack saddle sail salmon sandal saucer scarf seal seed shark shed shrimp ' +
    'skate skeleton skull sled slipper snail sparrow spinach squirrel stable stool straw strawberry swan ' +
    'sword tadpole tent thorn thread throne thunder tortoise tractor trolley trumpet trunk tulip turkey turtle ' +
    'twig umbrella unicorn vase vest violin vulture wagon walnut wand wasp web whisker wig windmill wolf ' +
    'woodpecker wreath yacht yak zebra',
    // feelings, qualities, common adjectives
    'afraid alive amazed angry anxious ashamed asleep awake bored brave bright calm careful cheerful clever ' +
    'confident cosy cozy crazy cruel curious cute delighted depressed eager excited exhausted fair fierce fit ' +
    'foolish fond free friendly frightened frustrated funny gentle glad gloomy graceful grateful greedy grumpy ' +
    'guilty handsome happy hardworking healthy helpful helpless honest hopeful hopeless humble hungry jealous ' +
    'jolly joyful kind lazy lonely loud lovely loyal lucky mad mean messy modest naughty neat nervous noble ' +
    'obedient patient peaceful pleasant polite poor popular pretty proud puzzled quiet rich rude sad scared selfish ' +
    'sensible serious sharp shy silly sincere sleepy slim smart smooth sneaky sorry spoilt stiff strange strict ' +
    'strong stubborn stupid successful sweet talented tense thankful thoughtful tidy tired tough truthful ugly ' +
    'upset useful useless warm weak wealthy weird wicked wild wise worried wrong young',
    // news, society, health
    'accident activist agency aid alliance ambulance arrest assault attack ballot bomb border bribe budget ' +
    'cabinet campaign candidate casualty ceasefire census charge citizen civil climate coalition collapse ' +
    'conflict constitution corruption council coup court crash crime crisis curfew damage deal debate defeat ' +
    'deficit democracy deputy disaster dispute drought economy election embassy emergency epidemic evacuate ' +
    'evidence explosion famine fatal flood fraud funeral governor hostage immigrant inquiry investigation ' +
    'judge jury justice landslide lawmaker leader legislation majority mayor militant minister minority ' +
    'mission murder nation nuclear opposition outbreak pandemic parliament party peace petition pilot poll ' +
    'pollution poverty premier president prime prison protest rally rebel refugee relief rescue resign riot ' +
    'ruling sanction scandal senate senator shortage soldier spokesperson strike suicide summit supreme ' +
    'survivor suspect tension terror testimony threat treaty trial troops verdict victim violence vote war ' +
    'warning weapon wildfire witness ' +
    'ache allergy ambulance appointment bandage blood bone brain cancer clinic cold cough cure dentist diabetes ' +
    'diet disease doctor dose fever flu headache health heart hospital illness infection injury medicine ' +
    'mental nurse operation pain patient pill pregnancy prescription recovery sick sickness stomach stress ' +
    'surgery symptom tablet therapy treatment vaccine virus wound fitness exercise sleep weight',
    // gap fill from calibration
    'erupt implement consumption enterprise liability remedy controversy satisfactory sacrifice contrary ' +
    'transition economist philosopher realist obligation simplify relevance seamless dioxide oxygen mat rug pan lid cap hat bag box jar mug tin tap pin pen net jet van cab bus kit mop bun jam shown sped enclose sewn sown',
    // everyday nouns, verbs and adjectives (second pass)
    'abandon adjust anchor armour armor axis blink blush boast bolt bore brass buddy canoe ' +
    'carve chap chick chill chore chunk cigar cling clown cobra cocoa coil comet cone ' +
    'cord cram crane creek crib cube cuff curl curse cyclist dam dash decay deed ' +
    'dent depot dim ditch dizzy dock dome drift drill drip dusk dwarf echo eel ' +
    'elf embrace ember emerald envy fable fade fang feast fiber fibre fist flake flap ' +
    'flea flee flesh flick flock foe foil fossil freak frown fumble fuss gadget gale ' +
    'gallon gamble gasp giggle glare glee glide glimpse globe gloom glory gorgeous gown grace ' +
    'grasp graze greed groan groom grove growl grudge grunt guilt gulf gum gust gutter ' +
    'hail harvest hatch hazard haze heap heel heir hem herb herd hike hoist hood ' +
    'hoop hound howl hub hull hump hunger hurdle hurl hush hymn idle idol inn ' +
    'jeep jerk jockey jungle kayak kennel kidnap kin knob lace lad lame lapse lash ' +
    'latch leap leash ledge lens limb lime linen lining liver loaf lodge loft loop ' +
    'lottery lump lunar lure maid manor mare mast maze mellow mesh midday mime mist ' +
    'mob mock monk moose moss motto mould mold mount mourn myth nap nickel notch ' +
    'nun oat oats odour odor offend omen ornament oval oyster pane pang pant patch ' +
    'paw pea peas pedal peek peg perch pest pier pint plank plea pledge plough ' +
    'plow plumber plunge pose pouch poultry prank prey probe prop prune pub pudding puddle ' +
    'puff puppet quack quake quest rack radar rag rage raid rake ram ranch rattle ' +
    'ray razor reap reef reel rib riddle rifle rig rim rip ripe ripple roam ' +
    'roar rod rodent rotten rumble rust saint sausage scalp scar scent scoop scrap sculpture ' +
    'seam shaft shield shin shovel shrine shrub siren sketch skid slab slam sleeve sling ' +
    'slope slot slug slum smog snap snout sob soda sow spade spear spike spill ' +
    'spine spit splash sponge spur squad stab stack stem stew sting stink stoop stork ' +
    'stray streak stripe stroll stud stump sum sunrise sunset swamp swap swarm sway swell ' +
    'swift swirl syrup tack tan tar tart teapot thigh thrill thump tide toad toll ' +
    'tomb tongs toss tram tramp tread trench tribe trim trio trout tub tuna tusk ' +
    'umpire vault veil vein velvet vent verse vet vine void volcano vow wade wag ' +
    'waist wardrobe wax weave wed weed whisk witch wizard womb wren yolk decent endless ' +
    'flexible frank fulfil fulfill inspire mature possess precious probable restore seize steep tremendous vague ' +
    'afar afterward airy amid annually apiece ashore astray awhile beforehand downhill downward eastward halfway ' +
    'hereby indoors inland lengthwise meantime nowadays offshore onward outdoors overnight sideways someday thereby upward ' +
    'westward almond anthem backyard bandwidth banquet beverage blizzard bonfire bookshelf boulder boutique brochure broth ' +
    'bruise bulletin bungalow cafeteria campfire canyon capsule caravan cardboard carnival cashew cassette catalogue catalog ' +
    'cathedral cavity cellar champagne chapel charcoal checklist chemist chimpanzee chopstick circus closet cockpit coffin ' +
    'comedian commuter condo conductor courtyard coyote crossroad cruise cupcake custard cutlery daylight deodorant diaper ' +
    'dinosaur dolphin doorbell doorway dormitory driveway drizzle dumpling dungeon earring eclipse emoji eyebrow eyelash ' +
    'fairground farmhouse faucet fireplace fireworks flashlight flipper footpath freeway fuse gazebo geyser gingerbread goalkeeper ' +
    'goggles graffiti granite greenhouse guitarist gymnasium hairbrush hallway hamburger handshake hangar heatwave hedgehog hemisphere ' +
    'hilltop homeland honeymoon horizon hotdog hurricane inkpot intercom jackpot jigsaw keyhole kindergarten kiosk lagoon ' +
    'landmark lawnmower lemonade lifeguard limestone lipstick lounge lunchbox mailbox mammal mansion marathon margarine marshmallow ' +
    'mascot mayonnaise meatball microwave milestone milkshake mixer motel motorway muffin necklace newsroom nightmare oatmeal ' +
    'orchestra outback outlet overcoat paddock pajamas pyjamas pantry paperback parachute parasol pastry pavement pedestrian ' +
    'pharmacy photocopy pickup pistachio pitcher placard plaza podcast pollen popcorn porcupine porridge postman pottery ' +
    'prawn pretzel pyramid racket radish raincoat rainforest raisin ranger raspberry reindeer reptile riverbank roadside ' +
    'rollercoaster rooftop rosebud runway salesman sandcastle saucepan scarecrow scorpion scrapbook seafood seagull seashell seaside ' +
    'sheriff shipment shoelace shortcut sidewalk signpost skateboard skyline skyscraper sleepover smartwatch snowball snowflake snowman ' +
    'spaghetti spotlight staircase stapler starfish stationery steamer stopwatch storeroom streetlight submarine subway sunflower sunglasses ' +
    'sunscreen surfboard sweatshirt swimsuit tablecloth tambourine tangerine teddy telescope terrace thermometer thunderstorm toaster toddler ' +
    'toffee toothbrush toothpaste tornado tortilla trampoline treadmill treehouse trombone tsunami tugboat tuxedo vacuum vanilla ' +
    'veranda volleyball waffle walkway walrus warehouse washroom waterfall watermelon wetland wheelbarrow wheelchair whiteboard windscreen ' +
    'windshield workbench wristwatch yoghurt zipper zucchini'
  ].join(' '));

  /* ------------------------------------------------------------------ *
   * Plain-English replacements. [word or phrase, plain alternative,     *
   * part of speech, rules]. Verbs ("v") are inflected to match the text  *
   * (utilized → used). Rules keep every suggestion a valid drop-in:      *
   *  D skip after a determiner (noun use)   A skip after "a"/"an"        *
   *  P -ed form only after a pronoun or has/have/had (never passive)   *
   *  I only at the start of a sentence or clause                         *
   *  Q needs a following word                E not before "opportunity" *
   *  O needs an object pronoun next          T needs a determiner or     *
   *  S skip before "to"                        pronoun next              *
   *  B skip before "a"/"an"                  F skip after "since"/"from" *
   *  Y skip after "of"                       M "of" when a determiner    *
   *                                            follows (most of the)     *
   * ------------------------------------------------------------------ */
  var PLAIN_RAW = [
    ['utilize', 'use', 'v'], ['utilise', 'use', 'v'], ['utilization', 'use', 'n'], ['utilisation', 'use', 'n'],
    ['commence', 'start', 'v'], ['commencement', 'start', 'n'], ['notwithstanding', 'despite', 'x', 'Q'],
    ['subsequently', 'later', 'x'], ['subsequent', 'later', 'a'], ['subsequent to', 'after', 'x'],
    ['approximately', 'about', 'x'], ['facilitate', 'help with', 'v', 'P'], ['in order to', 'to', 'x'],
    ['prior to', 'before', 'x'], ['endeavour', 'try', 'v', 'D', 'effort'], ['endeavor', 'try', 'v', 'D', 'effort'],
    ['aforementioned', 'above', 'a'], ['ascertain', 'find out', 'v', 'P'], ['accordingly', 'so', 'x', 'I'],
    ['acquire', 'get', 'v', 'P'], ['additional', 'extra', 'a'], ['adequate', 'enough', 'a', 'A'],
    ['adjacent to', 'next to', 'x'], ['advise', 'tell', 'v', 'O'], ['allocate', 'give', 'v', 'P'], ['alleviate', 'ease', 'v'],
    ['ameliorate', 'improve', 'v'], ['anticipate', 'expect', 'v'], ['appreciable', 'large', 'a'],
    ['assist', 'help', 'v', 'P'], ['assistance', 'help', 'n'], ['at this point in time', 'now', 'x'],
    ['at the present time', 'now', 'x'], ['at this moment in time', 'now', 'x'], ['attempt', 'try', 'v', 'D'],
    ['in an attempt to', 'to', 'x'], ['attain', 'reach', 'v'], ['beverage', 'drink', 'n'], ['by means of', 'by', 'x'],
    ['cognizant', 'aware', 'a'], ['cognisant', 'aware', 'a'], ['commensurate with', 'in line with', 'x'],
    ['comprised of', 'made up of', 'x'], ['comprise', 'consist of', 'v', 'P'], ['concerning', 'about', 'x', 'T'],
    ['consequently', 'so', 'x'], ['constitute', 'make up', 'v', 'PB'], ['consolidate', 'combine', 'v'],
    ['demonstrate', 'show', 'v'], ['disseminate', 'share', 'v'], ['due to the fact that', 'because', 'x'],
    ['during the course of', 'during', 'x'], ['in the course of', 'during', 'x'], ['eliminate', 'remove', 'v'],
    ['elucidate', 'explain', 'v'], ['encounter', 'run into', 'v', 'DP'], ['ensure that', 'make sure that', 'v'],
    ['equivalent to', 'equal to', 'x'], ['exhibit', 'show', 'v', 'D'], ['expedite', 'speed up', 'v', 'P'],
    ['expeditious', 'fast', 'a'], ['expenditure', 'spending', 'n'], ['feasible', 'possible', 'a'],
    ['finalize', 'finish', 'v'], ['finalise', 'finish', 'v'], ['for the purpose of', 'for', 'x'],
    ['forthwith', 'at once', 'x'], ['furthermore', 'also', 'x', 'I'], ['henceforth', 'from now on', 'x'],
    ['herein', 'here', 'x'], ['heretofore', 'until now', 'x'], ['in accordance with', 'in line with', 'x'],
    ['in an effort to', 'to', 'x'], ['in lieu of', 'instead of', 'x'], ['in the event that', 'if', 'x'],
    ['in the event of', 'if there is', 'x'], ['in the near future', 'soon', 'x'], ['inception', 'start', 'n', 'F'],
    ['initiate', 'start', 'v'], ['in excess of', 'more than', 'x'], ['leverage', 'use', 'v', 'DT'],
    ['magnitude', 'size', 'n', 'Y'], ['methodology', 'method', 'n'], ['modify', 'change', 'v'],
    ['necessitate', 'need', 'v', 'P'], ['numerous', 'many', 'a'], ['obtain', 'get', 'v', 'P'],
    ['optimum', 'best', 'a'], ['optimal', 'best', 'a'], ['owing to', 'because of', 'x'],
    ['participate', 'take part', 'v', 'P'], ['particulars', 'details', 'n'], ['pertaining to', 'about', 'x'],
    ['possess', 'have', 'v', 'P'], ['predominantly', 'mostly', 'x'], ['procure', 'buy', 'v'],
    ['provided that', 'if', 'x'], ['purchase', 'buy', 'v', 'DY'], ['pursuant to', 'under', 'x'],
    ['reimbursement', 'refund', 'n'], ['remainder', 'rest', 'n'], ['remuneration', 'pay', 'n'],
    ['reside', 'live', 'v'], ['retain', 'keep', 'v'], ['solicit', 'ask for', 'v', 'P'], ['substantial', 'large', 'a'],
    ['sufficient', 'enough', 'a', 'A'], ['terminate', 'end', 'v', 'P'], ['thereafter', 'after that', 'x'],
    ['therein', 'in it', 'x'], ['transmit', 'send', 'v'], ['whereas', 'while', 'x'],
    ['with regard to', 'about', 'x'], ['with respect to', 'about', 'x'], ['in regard to', 'about', 'x'],
    ['with the exception of', 'except', 'x'], ['a majority of', 'most', 'x', 'M'], ['the majority of', 'most', 'x', 'M'],
    ['a number of', 'several', 'x', 'M'], ['at all times', 'always', 'x'], ['in the absence of', 'without', 'x'],
    ['in close proximity to', 'near', 'x'], ['in view of the fact that', 'because', 'x'],
    ['on a daily basis', 'daily', 'x'], ['on a regular basis', 'regularly', 'x'], ['on a weekly basis', 'weekly', 'x'],
    ['on a monthly basis', 'monthly', 'x'], ['on the grounds that', 'because', 'x'], ['until such time as', 'until', 'x'],
    ['whilst', 'while', 'x'], ['amongst', 'among', 'x'], ['cease', 'stop', 'v', 'S'],
    ['collaborate', 'work together', 'v', 'P'], ['comply with', 'follow', 'v'], ['deem', 'consider', 'v'],
    ['discontinue', 'stop', 'v', 'P'], ['enquire', 'ask', 'v', 'P'], ['inquire', 'ask', 'v', 'P'], ['locate', 'find', 'v', 'P'],
    ['notify', 'tell', 'v'], ['paradigm', 'model', 'n'], ['perceive', 'see', 'v', 'P'], ['regarding', 'about', 'x', 'T'],
    ['synergy', 'teamwork', 'n'], ['indicate', 'show', 'v'], ['initial', 'first', 'a'], ['frequently', 'often', 'x'],
    ['nevertheless', 'still', 'x'], ['permit', 'allow', 'v', 'D'], ['require', 'need', 'v', 'P'],
    ['enclosed herewith', 'enclosed', 'x'], ['kindly', 'please', 'x', 'I'], ['do the needful', 'do what is needed', 'x'],
    ['revert back', 'reply', 'v'], ['prepone', 'bring forward', 'v'], ['avail of', 'use', 'v'],
    ['avail yourself of', 'use', 'x'], ['avail themselves of', 'use', 'x'], ['at the earliest', 'soon', 'x', 'E'],
    ['is able to', 'can', 'x'], ['are able to', 'can', 'x'], ['was able to', 'could', 'x'], ['were able to', 'could', 'x'],
    ['has the ability to', 'can', 'x'], ['have the ability to', 'can', 'x'],
    ['despite the fact that', 'although', 'x'], ['in spite of the fact that', 'although', 'x'],
    ['in a timely manner', 'promptly', 'x']
  ];
  // Verb forms used by the suggestions: base → [past, past participle, -ing, -s].
  var IRR_VERB = {
    get: ['got', 'got', 'getting'], find: ['found', 'found'], make: ['made', 'made', 'making'],
    take: ['took', 'taken', 'taking'], give: ['gave', 'given', 'giving'], go: ['went', 'gone', 'going', 'goes'],
    show: ['showed', 'shown'], tell: ['told', 'told'], keep: ['kept', 'kept'], meet: ['met', 'met', 'meeting'],
    send: ['sent', 'sent'], speed: ['sped', 'sped'], run: ['ran', 'run', 'running'], have: ['had', 'had', 'having', 'has'],
    buy: ['bought', 'bought'], put: ['put', 'put', 'putting'], let: ['let', 'let', 'letting'],
    bring: ['brought', 'brought'], do: ['did', 'done', 'doing', 'does'], see: ['saw', 'seen'], say: ['said', 'said'],
    pay: ['paid', 'paid'], stop: ['stopped', 'stopped', 'stopping'], begin: ['began', 'begun', 'beginning'],
    be: ['was', 'been', 'being', 'is']
  };

  /* Filler / hedge words and phrases; phrases that add nothing ("cut"). */
  var FILLER_RAW = [
    'very', 'really', 'basically', 'actually', 'just', 'quite', 'simply', 'literally', 'totally',
    'rather', 'somewhat', 'fairly', 'essentially', 'virtually', 'practically', 'truly', 'honestly',
    'obviously', 'arguably', 'seemingly', 'perhaps', 'in fact', 'kind of', 'sort of', 'a bit',
    'a little bit', 'needless to say', 'it goes without saying', 'for all intents and purposes',
    'at the end of the day', 'as a matter of fact', 'to be honest', 'i think', 'i believe', 'i feel',
    'in my opinion', 'each and every', 'first and foremost'
  ];
  var CUT_RAW = ['hereby', 'herewith', 'it is important to note that', 'it should be noted that', 'please note that',
    'it is worth noting that', 'the fact that'];
  // "very important" → "crucial": only pairs where one word is a safe drop-in.
  var STRONG = new Map([
    ['important', 'crucial'], ['big', 'huge'], ['large', 'huge'], ['small', 'tiny'], ['good', 'excellent'],
    ['bad', 'terrible'], ['happy', 'delighted'], ['tired', 'exhausted'], ['hungry', 'starving'], ['cold', 'freezing'],
    ['hot', 'boiling'], ['scared', 'terrified'], ['angry', 'furious'], ['beautiful', 'stunning'], ['clean', 'spotless'],
    ['dirty', 'filthy'], ['funny', 'hilarious'], ['interesting', 'fascinating'], ['surprised', 'astonished'],
    ['sure', 'certain'], ['full', 'packed'], ['loud', 'deafening'], ['smart', 'brilliant'], ['old', 'ancient'],
    ['sad', 'heartbroken'], ['afraid', 'terrified']
  ]);
  STRONG.delete('old'); // "very old person" → "ancient person" is rude, not plain
  var STRONG_LEAD = wordSet('very really extremely so');

  /* Adverbs worth flagging: weak intensifiers, and -ly manner adverbs next to a weak verb. */
  var INTENSIFIERS = wordSet(
    'extremely absolutely definitely highly completely incredibly utterly entirely terribly awfully hugely ' +
    'massively insanely seriously genuinely certainly surely undoubtedly unbelievably exceptionally ' +
    'remarkably tremendously enormously super'
  );
  var WEAK_VERBS = wordSet(
    'say said says saying go goes went going gone walk walked walking walks run ran running runs look looked ' +
    'looking looks move moved moving moves get got gets getting come came comes coming speak spoke spoken speaks ' +
    'speaking talk talked talks talking ask asked asks asking reply replied replies answer answered answers ' +
    'eat ate eaten eats eating sit sat sits sitting stand stood stands standing put puts take took taken takes ' +
    'make made makes making do did done does doing'
  );
  var NON_MANNER = wordSet(
    'recently currently previously usually generally normally typically eventually finally initially ' +
    'originally subsequently already nearly mostly mainly merely largely partly fully exactly approximately ' +
    'roughly hardly barely rarely seldom frequently occasionally regularly constantly continuously repeatedly ' +
    'immediately directly instantly shortly lately formerly publicly privately officially personally ' +
    'separately together only early daily weekly monthly yearly likely really simply actually basically ' +
    'literally totally honestly obviously seemingly truly virtually practically essentially ultimately ' +
    'apparently clearly certainly probably possibly especially particularly specifically'
  );
  var ADVERB_SWAP = new Map([
    ['said quietly', 'whispered'], ['said softly', 'whispered'], ['quietly said', 'whispered'],
    ['softly said', 'whispered'], ['said loudly', 'shouted'], ['loudly said', 'shouted'],
    ['said angrily', 'snapped'], ['angrily said', 'snapped'], ['ran quickly', 'raced'], ['quickly ran', 'raced'],
    ['walked slowly', 'strolled'], ['slowly walked', 'strolled'], ['went quickly', 'hurried'],
    ['quickly went', 'hurried'], ['looked quickly', 'glanced'], ['quickly looked', 'glanced'],
    ['ate quickly', 'gulped'], ['spoke quietly', 'murmured'], ['spoke softly', 'murmured'],
    ['says quietly', 'whispers'], ['says loudly', 'shouts']
  ]);

  /* -ly words that are not adverbs at all. */
  var LY_STOP = wordSet(
    'only family early reply apply supply imply comply multiply july italy holy ugly ' +
    'friendly lovely lonely lively likely unlikely deadly costly daily weekly monthly yearly hourly ' +
    'nightly quarterly elderly silly jolly belly bully rally ally fly lily assembly anomaly butterfly ' +
    'firefly jelly folly hilly curly smelly chilly sly rely emily billy sally kelly molly holly ' +
    'gully tally dolly sully melancholy monopoly homily wily oily burly surly orderly scholarly ' +
    'motherly fatherly brotherly sisterly manly womanly cowardly ghastly ghostly godly heavenly ' +
    'leisurely lowly portly princely saintly seemly shapely sickly stately unruly wobbly worldly ' +
    'prickly bubbly cuddly bodily timely comely neighbourly neighborly beastly gravelly ' +
    'sicily natalie kindly ply doily hurly wholly woolly'
  );

  /* Stopwords for the word-frequency list and the noun-stack check. */
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
    'back really quite etc'
  );
  var DETS = wordSet('a an the this that these those my your his her its our their each every any no some ' +
    'another which whose what all both either neither such same other own first second last next');
  var OBJ_PRON = wordSet('me you him her it us them everyone everybody someone anyone customers clients users members staff');
  var SUBJ_START = wordSet('i we they he she it you this that these those there the a an our their his her its my ' +
    'your some many most all each both no one people everyone nobody something everything we\'ll they\'ll it\'s');

  /* Sentence splitting: abbreviation classes (lower-case, no trailing dot). */
  var ABBR_NEVER = wordSet(
    'mr mrs ms mx dr prof rev hon gen col capt lt sgt cmdr adm gov sen rep fr st smt shri sh kum ' +
    'messrs mme mlle e.g i.e eg ie vs cf viz approx esp incl ca hon\'ble adv er'
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

  /* Nominalisations (only flagged in "make a decision" / "the decision of" patterns). */
  var NOMINAL = new Map();
  ('investigation:investigate implementation:implement consideration:consider determination:determine ' +
   'examination:examine evaluation:evaluate assessment:assess establishment:establish achievement:achieve ' +
   'reduction:reduce completion:complete submission:submit provision:provide approval:approve decision:decide ' +
   'recommendation:recommend observation:observe utilization:use utilisation:use analysis:analyse ' +
   'discussion:discuss adjustment:adjust allocation:allocate acceptance:accept compliance:comply ' +
   'continuation:continue enforcement:enforce identification:identify indication:indicate inclusion:include ' +
   'maintenance:maintain modification:modify notification:notify preparation:prepare prevention:prevent ' +
   'reliance:rely removal:remove replacement:replace resolution:resolve selection:select ' +
   'specification:specify verification:verify clarification:clarify collection:collect ' +
   'contribution:contribute cancellation:cancel confirmation:confirm correction:correct creation:create ' +
   'distribution:distribute elimination:eliminate explanation:explain interpretation:interpret ' +
   'intervention:intervene measurement:measure payment:pay presentation:present publication:publish ' +
   'registration:register revision:revise settlement:settle arrangement:arrange agreement:agree ' +
   'development:develop discovery:discover enhancement:improve encouragement:encourage adoption:adopt ' +
   'conclusion:conclude description:describe retention:keep suggestion:suggest termination:end ' +
   'transformation:transform appointment:appoint authorization:authorize authorisation:authorise ' +
   'calculation:calculate comparison:compare consultation:consult expansion:expand assistance:help ' +
   'reimbursement:repay disclosure:disclose application:apply delivery:deliver production:produce ' +
   'reference:refer attempt:try inquiry:ask enquiry:ask investment:invest examination:examine ' +
   'consolidation:combine facilitation:help commencement:start acquisition:buy')
    .split(' ').forEach(function (e) { var p = e.split(':'); NOMINAL.set(p[0], p[1]); });
  var LIGHT_VERBS = wordSet('make take give conduct perform undertake provide reach carry effect do have hold come arrive');
  var LIGHT_ADJ = wordSet('further full final formal detailed thorough careful quick proper timely prompt brief short ' +
    'initial comprehensive complete new regular necessary appropriate careful early immediate');

  /* Noun-stack check: words that read as nouns in "risk management framework" style chains. */
  var STACK_NOUNS = wordSet(
    'data policy risk market credit card customer service user system process project team cost price rate ' +
    'interest tax bank loan growth sales quality security access control budget revenue supply chain value ' +
    'account network platform content software health care energy water safety income product brand business ' +
    'framework strategy standard standards asset capital equity debt fund insurance claim transfer liquidity ' +
    'consumer demand capacity infrastructure labour labor law reform sector industry company firm office board ' +
    'committee council agency department plan program programme scheme cycle model structure review report ' +
    'audit oversight logistics shipping procurement supplier vendor contract deadline timeline milestone target ' +
    'goal outcome output input feedback level ratio margin profit loss fee charge pricing banking marketing ' +
    'funding training testing learning lending spending planning reporting monitoring rating risk portfolio ' +
    'yield bond stock repo deposit payment payments user users member members employee staff student school ' +
    'exam course traffic road city state government policy property housing land power grid fuel oil gas ' +
    'carbon emission emissions climate privacy cyber cloud server app web site page search engine'
  );
  var NOUN_SUFFIX = /(?:tion|sion|ment|ance|ence|ancy|ency|ity|ism|ship|ness|ure|cy|ics|ogy|ery|ist|ology)s?$/;
  var ADJ_SUFFIX = /(?:al|ary|ive|ic|ical|ous|ful|less|able|ible|ial|ent|ant|ory|ar)$/;

  /* Openers that start a lead-in clause before the main point. */
  var LEADIN = wordSet(
    'although though while whereas despite notwithstanding given following upon after before since because if ' +
    'when unless pursuant subject owing due as for under according regarding considering having being during ' +
    'by on at in with without once until whether in_order further with_regard'
  );

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
   * Familiarity                                                         *
   * ================================================================== */
  var DERIV = [
    ['ness', ['']], ['ment', ['', 'e']], ['ments', ['', 'e']], ['ful', ['']], ['less', ['']], ['ication', ['y']],
    ['ation', ['', 'e', 'ate']], ['ations', ['', 'e', 'ate']], ['ition', ['', 'e']], ['ion', ['', 'e']],
    ['ions', ['', 'e']], ['ity', ['', 'e']], ['ities', ['', 'e']], ['ance', ['', 'e', 'ant']],
    ['ence', ['', 'e', 'ent']], ['ency', ['ent']], ['ancy', ['ant']], ['er', ['', 'e', 'y']], ['ers', ['', 'e', 'y']], ['ability', ['able']], ['ibility', ['ible']], ['iance', ['y']], ['ify', ['', 'e', 'y']],
    ['or', ['', 'e']], ['ors', ['', 'e']], ['ist', ['', 'e', 'y']], ['ists', ['', 'e', 'y']], ['al', ['', 'e']],
    ['ally', ['al', '']], ['ive', ['', 'e']], ['ous', ['', 'e']], ['ize', ['']], ['ise', ['']],
    ['able', ['', 'e']], ['ably', ['', 'e']], ['ship', ['']], ['hood', ['']], ['ward', ['']], ['wards', ['']],
    ['ism', ['']], ['y', ['', 'e']], ['en', ['', 'e']], ['ic', ['']], ['ical', ['']], ['ically', ['']]
  ];
  var PREFIXES = ['un', 're', 'in', 'im', 'dis', 'mis', 'non', 'pre', 'over', 'under', 'out', 'sub', 'super',
    'inter', 'multi', 'mini', 'micro', 'anti', 'semi', 'up', 'down', 'self', 'co', 'ex', 'counter', 'cross'];

  function inflBases(w) {
    var c = [], n = w.length, b;
    if (n > 3 && w[n - 1] === 's') {
      c.push(w.slice(0, -1));
      if (w.endsWith('es')) c.push(w.slice(0, -2));
      if (w.endsWith('ies')) c.push(w.slice(0, -3) + 'y');
      if (w.endsWith("'s")) c.push(w.slice(0, -2));
    }
    if (n > 3 && w.endsWith('ed')) {
      b = w.slice(0, -2);
      c.push(w.slice(0, -1), b);
      if (w.endsWith('ied')) c.push(w.slice(0, -3) + 'y');
      if (/([b-df-hj-np-tv-z])\1$/.test(b)) c.push(b.slice(0, -1));
    }
    if (n > 4 && w.endsWith('ing')) {
      b = w.slice(0, -3);
      c.push(b, b + 'e');
      if (/([b-df-hj-np-tv-z])\1$/.test(b)) c.push(b.slice(0, -1));
    }
    if (n > 4 && /(?:er|est)$/.test(w)) {
      b = w.replace(/(?:er|est)$/, '');
      c.push(b, b + 'e');
      if (/i$/.test(b)) c.push(b.slice(0, -1) + 'y');
      if (/([b-df-hj-np-tv-z])\1$/.test(b)) c.push(b.slice(0, -1));
    }
    if (n > 4 && w.endsWith('ly')) {
      b = w.slice(0, -2);
      c.push(b, b + 'e');
      if (/i$/.test(b)) c.push(b.slice(0, -1) + 'y');
      if (w.endsWith('ally')) c.push(w.slice(0, -4));
      if (w.endsWith('ily')) c.push(w.slice(0, -3) + 'y');
    }
    return c;
  }
  function famDirect(w) {
    if (FAMILIAR.has(w)) return true;
    var c = inflBases(w);
    for (var i = 0; i < c.length; i++) if (FAMILIAR.has(c[i])) return true;
    return false;
  }
  var famMemo = new Map();
  function famCheck(w, depth) {
    if (depth === 1) {                       // stems recur across words: memoise the inner level
      var hit = famMemo.get(w);
      if (hit === undefined) {
        if (famMemo.size > 50000) famMemo.clear();
        famMemo.set(w, hit = famCheck0(w, 1));
      }
      return hit;
    }
    return famCheck0(w, depth);
  }
  function famCheck0(w, depth) {
    if (famDirect(w)) return true;
    if (depth > 1) return false;
    var i, j, k, d, stem;
    var forms = [w].concat(inflBases(w));
    for (k = 0; k < forms.length; k++) {
      var f = forms[k];
      for (i = 0; i < DERIV.length; i++) {
        d = DERIV[i];
        if (f.length < d[0].length + 3 || !f.endsWith(d[0])) continue;
        stem = f.slice(0, -d[0].length);
        for (j = 0; j < d[1].length; j++) {
          var s2 = stem + d[1][j];
          if (s2.length >= 3 && famCheck(s2, depth + 1)) return true;
          if (/([b-df-hj-np-tv-z])\1$/.test(stem) && famDirect(stem.slice(0, -1))) return true; // running, winner
        }
      }
    }
    for (i = 0; i < PREFIXES.length; i++) {
      var p = PREFIXES[i];
      if (w.length - p.length >= 4 && w.startsWith(p) && famCheck(w.slice(p.length), depth + 1)) return true;
    }
    if (depth === 0 && w.length >= 7) { // compounds: homework, smartphone, thereafter
      for (k = 3; k <= w.length - 3; k++) {
        if (FAMILIAR.has(w.slice(0, k)) && famDirect(w.slice(k))) return true;
      }
    }
    return false;
  }
  var famCache = new Map();
  /** Is this lower-case word familiar to most adult readers? Exposed for tests. */
  function isFamiliar(word) {
    var hit = famCache.get(word);
    if (hit !== undefined) return hit;
    var w = String(word).toLowerCase().replace(/’/g, "'");
    hit = famCache.get(w);
    if (hit !== undefined) return hit;
    var r;
    if (w.length <= 2 || /\d/.test(w) || w.indexOf('.') >= 0) r = true;
    else if (w.indexOf("'") >= 0) { var b = w.split("'")[0]; r = !b || b.length <= 2 || isFamiliar(b); }
    else if (w.indexOf('-') >= 0) r = w.split('-').every(function (p) { return !p || isFamiliar(p); });
    else r = famCheck(w, 0);
    if (famCache.size > 50000) famCache.clear();
    famCache.set(w, r);
    return r;
  }

  /* ================================================================== *
   * Verb helpers (rewrites, suggestions)                                *
   * ================================================================== */
  function isVowelSound(w) {
    w = w.toLowerCase();
    if (/^(?:hour|honest|honou?r|heir)/.test(w)) return true;
    if (/^(?:uni|use|usu|ura|eu|one|once|ewe)/.test(w)) return false;
    return /^[aeiou]/.test(w);
  }
  function verb3(base) {
    if (base === 'have') return 'has';
    if (base === 'be') return 'is';
    if (/(?:s|sh|ch|x|z|o)$/.test(base)) return base + 'es';
    if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + 'ies';
    return base + 's';
  }
  function verbPast(base, pp) {
    var irr = IRR_VERB[base];
    if (irr) return pp ? irr[1] : irr[0];
    if (/e$/.test(base)) return base + 'd';
    if (/[^aeiou]y$/.test(base)) return base.slice(0, -1) + 'ied';
    return base + 'ed';
  }
  function verbIng(base) {
    var irr = IRR_VERB[base];
    if (irr && irr[2]) return irr[2];
    if (/ie$/.test(base)) return base.slice(0, -2) + 'ying';
    if (/[^e]e$/.test(base)) return base.slice(0, -1) + 'ing';
    return base + 'ing';
  }
  function verbS(base) {
    var irr = IRR_VERB[base];
    if (irr && irr[3]) return irr[3];
    return verb3(base);
  }
  // Inflect the first word of a (possibly multi-word) verb phrase: "find out" + ed → "found out".
  function inflectPhrase(phrase, form, pp) {
    var ws = phrase.split(' '), b = ws[0];
    if (form === 'ed') ws[0] = verbPast(b, pp);
    else if (form === 'ing') ws[0] = verbIng(b);
    else if (form === 's') ws[0] = verbS(b);
    return ws.join(' ');
  }
  // Regular or irregular past participle → base verb ("retained" → "retain", "written" → "write").
  function ppBase(pp) {
    var info = PP_INFO.get(pp);
    if (info) return info[0];
    if (!/ed$/.test(pp)) return pp;
    if (/^[a-z]{1,2}ied$/.test(pp)) return pp.slice(0, -1);            // died, tied
    var a = pp.slice(0, -1), b = pp.slice(0, -2);
    var known = function (x) { return FAMILIAR.has(x) || EXTRA_VERBS.has(x); };
    if (/ied$/.test(pp) && known(pp.slice(0, -3) + 'y')) return pp.slice(0, -3) + 'y';
    if (known(a)) return a;
    if (known(b)) return b;
    if (/([b-df-hj-np-tv-z])\1$/.test(b) && known(b.slice(0, -1))) return b.slice(0, -1);
    if (/ied$/.test(pp)) return pp.slice(0, -3) + 'y';
    if (/([b-df-hjkmnp-tv-z])\1$/.test(b)) return b.slice(0, -1);       // submitted, planned
    if (/(?:[vcz]|[rd]g|[^aeiou](?:at|in|ir|ur|ar|or|um|l)|[aeiouy]s|u)$/.test(b) && !/ss$/.test(b)) return b + 'e';
    if (/^[^aeiou]*[aeiou][^aeiouwxy]$/.test(b)) return b + 'e';         // named, rated
    return b;
  }
  function ppPast(pp) { var info = PP_INFO.get(pp); return info ? info[1] : pp; }
  var PRON_OBJ = { i: 'me', we: 'us', they: 'them', he: 'him', she: 'her', it: 'it', you: 'you', this: 'it',
    that: 'it', these: 'them', those: 'them', who: 'them', which: 'it' };
  var PLURAL_IRR = wordSet('people children men women data staff police cattle media teeth feet mice');
  function looksPlural(w) {
    if (PLURAL_IRR.has(w)) return true;
    return /[^s']s$/.test(w) && !/(?:ss|us|is|ics|news|ous|ss)$/.test(w);
  }
  function capFirst(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ================================================================== *
   * Masking: code, URLs, emails, paths and markup are not prose         *
   * ================================================================== */
  var MASK = '\u001F';
  var FILE_EXT_RE = /\.(?:m?js|cjs|tsx?|jsx|json|mdx?|html?|s?css|py|java|go|rb|php|ya?ml|toml|txt|csv|xlsx?|pdf|docx?|pptx?|png|jpe?g|gif|svg|webp|sh|bat|ps1|env|lock|xml|cpp|hpp|rs|kt|swift|sql|ipynb|log|ini|cfg|conf|zip|exe|dll|vue|svelte|c|h)$/i;
  var CAMEL_OK = wordSet('iphone ipad ipod imac ios macos icloud itunes ebay');
  var CLI_CMDS = wordSet('npm npx yarn pnpm pip pip3 brew sudo apt apt-get docker kubectl git curl wget mkdir chmod cargo bun deno');
  var CLI_RE = /(^|\s)(npm|npx|yarn|pnpm|pip3?|brew|sudo|apt-get|apt|docker|kubectl|git|curl|wget|mkdir|chmod|cargo|bun|deno)(?=[ \t]+\S)/g;
  var CLI_STOP = wordSet('to and in then or for from the with on at if inside first again once before after when ' +
    'which that it this you we so but is are was will can should a an your our of as by into until');
  var URL_TAIL = '[^\\s<>"“”\'’)\\]]*[^\\s<>"“”\'’)\\].,;:!?*]';
  var URL_RES = [
    new RegExp('\\b(?:https?|ftp):\\/\\/' + URL_TAIL, 'g'),
    new RegExp('\\bwww\\.' + URL_TAIL, 'g'),
    null, // emails: see emailSpans()
    new RegExp('\\blocalhost(?::\\d+)?(?:\\/' + URL_TAIL + ')?', 'g'),
    /\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g,
    new RegExp('\\b[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)*\\.(?:com|org|net|io|in|co|app|dev|ai|edu|gov|uk|us|me|info|xyz|tech|gg)\\b(?:\\/' + URL_TAIL + ')?', 'g')
  ];

  var DOMAIN_HINT = /\.(?:com|org|net|io|in|co|app|dev|ai|edu|gov|uk|us|me|info|xyz|tech|gg)\b/i;
  var CODE_HINT = /[\/\\_=(@$]|\.\w|[a-z][A-Z]|^-/;
  var EMAIL_LOCAL = /[A-Za-z0-9._%+\-]/, EMAIL_DOMAIN = /[A-Za-z0-9\-]+(?:\.[A-Za-z0-9\-]+)+/y;
  function emailSpans(text) {
    var out = [], at = text.indexOf('@');
    while (at >= 0) {
      var s = at;
      while (s > 0 && EMAIL_LOCAL.test(text[s - 1])) s--;
      EMAIL_DOMAIN.lastIndex = at + 1;
      var dm = EMAIL_DOMAIN.exec(text);
      if (s < at && dm) out.push([s, at + 1 + dm[0].length]);
      at = text.indexOf('@', at + 1);
    }
    return out;
  }
  function isCodeToken(c) {
    if (c.length < 2 || !/[A-Za-z]/.test(c)) return false;
    if (/^[A-Za-z]:\\/.test(c) || /\w\\\w/.test(c)) return true;                       // C:\Users, src\app
    if (/^(?:~|\.{1,2})?\/[\w.@~%+-]+(?:\/[\w.@~%+-]*)*$/.test(c)) return true;        // /api/users, ./src
    if (/^[\w.@%+-]+(?:\/[\w.@%+-]+)+\/?$/.test(c)) {                                  // app/page.js
      if (FILE_EXT_RE.test(c) || c.split('/').filter(Boolean).length >= 3 || /[_@]/.test(c)) return true;
      return false;                                                                    // and/or, his/her stay words
    }
    if (FILE_EXT_RE.test(c) && /^[\w-]+(?:\.[\w-]+)*\.[A-Za-z0-9]+$/.test(c) && !/^[A-Z][a-z]+\.js$/.test(c) &&
        !/^(?:[A-Za-z]\.)+[A-Za-z]$/.test(c)) return true;                             // package.json (not Node.js, U.S)
    if (/^[a-z][a-z0-9]*[A-Z][A-Za-z0-9]*$/.test(c) && c.length >= 5 && !CAMEL_OK.has(c.toLowerCase())) return true;
    if (/^[A-Za-z0-9]+_[A-Za-z0-9_]+$/.test(c)) return true;                           // snake_case
    if (/^[A-Za-z_$][\w$.]*\([^\s]*\)$/.test(c)) return true;                          // print(), useState()
    if (/^--?[a-z][\w-]*(?:=\S+)?$/.test(c) && c.length > 3 && c[1] === '-') return true; // --save-dev
    if (/^\w+=\S+$/.test(c)) return true;                                              // key=value
    if (/^[a-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+$/.test(c) &&
        c.split('.').every(function (p) { return p.length >= 2; }) && !ABBR_MAY.has(c)) return true; // console.log
    return false;
  }

  /** Build a "clean" copy of the text: same length, code-like spans replaced. Exposed for tests. */
  function buildMask(text) {
    var n = text.length, m = new Uint8Array(n), spans = 0, codeChars = 0, re, x, i;
    function mark(s, e, link) {
      var any = 0;
      for (var k = s; k < e; k++) if (!m[k]) { m[k] = 1; if (!/\s/.test(text[k])) any++; }
      if (any && !link) { spans++; codeChars += any; }
    }
    // fenced code blocks: whole lines become blank lines
    var lines = getLines(text), inFence = false, fences = 0;
    lines.forEach(function (ln) {
      var fence = /^[ \t]*(?:```|~~~)/.test(text.slice(ln.start, ln.end));
      if (fence || inFence) for (var k = ln.start; k < ln.end; k++) m[k] = 2;
      if (fence) { inFence = !inFence; fences++; }
      else if (/^[ \t]*\|/.test(text.slice(ln.start, ln.end))) {               // table row: hide the pipes
        for (var q = ln.start; q < ln.end; q++) if (text[q] === '|') m[q] = 3;
      }
    });
    re = /(`+)[^`\n]+?\1/g;                                    // inline code
    while ((x = re.exec(text))) mark(x.index, x.index + x[0].length);
    re = /!\[[^\]\n]*\]\([^)\n]*\)/g;                          // markdown image
    while ((x = re.exec(text))) mark(x.index, x.index + x[0].length, true);
    re = /\]\([^)\s]+(?:\s+"[^"\n]*")?\)/g;                    // markdown link target
    while ((x = re.exec(text))) mark(x.index + 1, x.index + x[0].length, true);
    re = /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>\n]{0,200})?\/?>/g; // HTML tags
    while ((x = re.exec(text))) mark(x.index, x.index + x[0].length, true);
    var need = [/:\/\//.test(text), /www\./i.test(text), text.indexOf('@') >= 0, /localhost/.test(text),
      /\d\.\d{1,3}\.\d/.test(text), DOMAIN_HINT.test(text)];
    for (i = 0; i < URL_RES.length; i++) {
      if (!need[i]) continue;
      if (!URL_RES[i]) { emailSpans(text).forEach(function (sp) { if (!m[sp[0]]) mark(sp[0], sp[1], true); }); continue; }
      re = URL_RES[i]; re.lastIndex = 0;
      while ((x = re.exec(text))) {
        if (m[x.index]) continue;
        mark(x.index, x.index + x[0].length, !/localhost|^\d/.test(x[0]));
      }
    }
    // token rules: paths, file names, identifiers, flags, shell commands
    function coreOf(s, e) {
      var raw = text.slice(s, e);
      var lead = /^[("'“‘<\[{*_]+/.exec(raw), tail = /[)"'”’>\]}.,;:!?*_]+$/.exec(raw);
      var cs = s + (lead ? lead[0].length : 0), ce = e - (tail ? tail[0].length : 0);
      return ce > cs ? { s: cs, e: ce, core: text.slice(cs, ce), end: e, punct: !!tail && /[.,;:!?]/.test(tail[0]) } : null;
    }
    re = /\S+/g;
    while ((x = re.exec(text))) {
      if (!CODE_HINT.test(x[0])) continue;                       // most words: nothing code-like
      var tk = coreOf(x.index, x.index + x[0].length);
      if (tk && !m[tk.s] && isCodeToken(tk.core)) mark(tk.s, tk.e);
    }
    // shell commands: "npm run dev", "git clone repo"
    re = CLI_RE; re.lastIndex = 0;
    while ((x = re.exec(text))) {
      var cs0 = x.index + x[1].length;
      if (m[cs0]) continue;
      var lastT = coreOf(cs0, cs0 + x[2].length), nx = /[ \t]+(\S+)/y, steps = 0;
      if (!lastT) continue;
      nx.lastIndex = lastT.end;
      var y;
      while (!lastT.punct && steps < 6 && (y = nx.exec(text))) {
        var ct = coreOf(y.index + y[0].length - y[1].length, y.index + y[0].length);
        if (!ct || CLI_STOP.has(ct.core.toLowerCase()) || !/^[\w@./:=~^-]+$/.test(ct.core)) break;
        lastT = ct; steps++;
        nx.lastIndex = ct.end;
      }
      mark(cs0, lastT.e);
      re.lastIndex = Math.max(re.lastIndex, lastT.e);
    }
    var clean = text;
    if (spans || fences || m.indexOf(1) >= 0 || m.indexOf(3) >= 0) {
      var out = new Array(n);
      for (i = 0; i < n; i++) {
        var ch = text[i];
        if (!m[i] || ch === '\n' || ch === '\r') out[i] = ch;
        else { out[i] = m[i] === 2 || m[i] === 3 ? ' ' : MASK; if (m[i] === 2 && !/\s/.test(ch)) codeChars++; }
      }
      clean = out.join('');
    }
    return { clean: clean, spans: spans, fences: Math.ceil(fences / 2), codeChars: codeChars };
  }

  /* ================================================================== *
   * Tokens                                                              *
   * ================================================================== */
  var LAT = 'A-Za-z\\u00C0-\\u024F';
  var TOKEN_RE = new RegExp(
    '([' + LAT + '](?:[' + LAT + '\\u0300-\\u036F]|[\'’\\-.](?=[' + LAT + ']))*)' +   // 1 latin word
    '|(\\d+(?:[.,]\\d+)*(?:st|nd|rd|th)?)' +                                            // 2 number
    '|([\\p{L}\\p{M}]+)',                                                                // 3 other script
    'gu'
  );

  // Same pattern without Unicode property classes: much faster, used when the text is Latin-only.
  var TOKEN_RE_FAST = new RegExp(
    '([' + LAT + '](?:[' + LAT + '\\u0300-\\u036F]|[\'’\\-.](?=[' + LAT + ']))*)' +
    '|(\\d+(?:[.,]\\d+)*(?:st|nd|rd|th)?)', 'g');
  var NON_LATIN = /[^\u0000-ɏ̀-ͯ -⁯₠-⃏℀-⇿]/;

  /** Tokenise clean[from, to) into word objects with absolute offsets. */
  function tokenize(clean, from, to) {
    var out = [], m, s = clean.slice(from, to);
    var re = NON_LATIN.test(s) ? TOKEN_RE : TOKEN_RE_FAST;
    re.lastIndex = 0;
    while ((m = re.exec(s))) {
      var kind = m[1] ? 'latin' : m[2] ? 'num' : 'other';
      out.push({ text: m[0], start: from + m.index, end: from + m.index + m[0].length, kind: kind });
    }
    return out;
  }

  /* ================================================================== *
   * Lines, paragraphs, sentences                                        *
   * ================================================================== */
  var BULLET_RE = /^([ \t\u00A0]*)((?:#{1,6}|[-*•‣◦▪●·–—+>✓✔✗✘➤►▶→☐☑★☆]|\p{Extended_Pictographic}\uFE0F?|\(?\d{1,3}[.)]|\(?[a-zA-Z][.)]|\(?(?:i{1,3}|iv|vi{0,3}|ix|x)[.)])[ \t\u00A0]+)/u;
  var HAS_WORDCHAR = /[\p{L}\p{N}]/u;
  var IS_WS = /[\s\u00A0\u2000-\u200B\u3000]/;
  var GREET_RE = /^(?:hi|hello|hey|hiya|dear|greetings|good\s+(?:morning|afternoon|evening))\b[^.!?]{0,40}[,!.]?$/i;
  var SIGNOFF_RE = /^(?:regards|best regards|kind regards|warm regards|warmly|thanks|thanks again|thank you|many thanks|cheers|best|sincerely|yours sincerely|yours faithfully|yours truly|love|take care)\b[^.!?]{0,30}[,.!]?$/i;

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

  function lineInfo(text, clean, ln) {
    var s = clean.slice(ln.start, ln.end);
    var m = BULLET_RE.exec(s);
    var lead = /^[ \t\u00A0]*/.exec(s)[0].length;
    var hasBody = !!(m && HAS_WORDCHAR.test(s.slice(m[0].length)));
    var cs = ln.start + (hasBody ? m[0].length : lead);
    var ce = ln.end;
    while (ce > cs && (IS_WS.test(clean[ce - 1]))) ce--;
    var content = clean.slice(cs, ce);
    return {
      start: ln.start, end: ln.end, cs: cs, ce: ce,
      isList: (hasBody && m[2][0] !== '#') || /^[ \t]*\|/.test(text.slice(ln.start, ln.end)),
      isHash: !!(m && m[2][0] === '#'),
      indent: lead > 0,
      greet: content.length < 60 && (GREET_RE.test(content) || SIGNOFF_RE.test(content)),
      content: content
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
  // Short unpunctuated lines (chat messages, poems) are separate sentences, not wrapped prose.
  var LINE_TAIL = wordSet('a an the and or but nor so of to in on at for with by from as is are was were be that ' +
    'this these those my your our their his her its into onto over under about across after before between ' +
    'through during without within than if when while because which who whose very');
  function shortLineBreak(L, next) {
    var c = L.content;
    if (c.length >= 40 || next.content.length >= 45 || /[,;:\-–—(]$/.test(c)) return false;
    var words = c.split(/\s+/).filter(Boolean);
    return words.length > 0 && !LINE_TAIL.has(words[words.length - 1].toLowerCase());
  }

  /** Paragraphs → segments (runs of lines that read as one stream of prose). */
  function blocks(text, clean) {
    var lines = getLines(clean).map(function (l) { return lineInfo(text, clean, l); });
    var paras = [], cur = null;
    lines.forEach(function (L) {
      if (!HAS_WORDCHAR.test(L.content)) { cur = null; return; } // blank, code or "* * *" line
      if (!cur) { cur = []; paras.push(cur); }
      cur.push(L);
    });
    return paras.map(function (ls, pIdx) {
      var segs = [], segStart = ls[0].cs, segFirst = 0, broke = true;
      for (var i = 0; i < ls.length; i++) {
        var L = ls[i], next = ls[i + 1], brk, heading = false;
        if (!next) brk = true;
        else if (next.isList || next.isHash) brk = true;
        else if (L.isList && !next.indent) brk = true;
        else if (L.isHash) brk = true;
        else if (L.greet) brk = true;
        else if (/:$/.test(L.content) && /^["“‘(]?[\p{Lu}\p{N}]/u.test(next.content)) brk = true;
        else if (shortLineBreak(L, next)) brk = true;
        else brk = heading = looksLikeHeading(L, ls[i - 1], broke, next);
        if (brk) {
          var F = ls[segFirst], single = segFirst === i;
          var words = L.content.split(/\s+/).filter(Boolean).length;
          segs.push({
            s: segStart, e: L.ce, list: F.isList, greet: single && L.greet,
            heading: single && (L.isHash || heading || (/:$/.test(L.content) && words <= 8 && !L.isList) ||
              (ls.length === 1 && !!next === false && paras.length > 1 && pIdx < paras.length - 1 &&
               words <= 10 && !/[.!?…:;,"”’)\]।॥]$/.test(L.content) && !L.isList && !L.greet))
          });
          if (next) { segStart = next.cs; segFirst = i + 1; }
        }
        broke = brk;
      }
      var first = ls[0], last = ls[ls.length - 1];
      var ps = first.start;
      while (ps < first.ce && IS_WS.test(clean[ps])) ps++;
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
    var tok = text.slice(ts, idx).replace(/^["'“‘(\[«*_]+/, '');
    if (!tok || tok.indexOf(MASK) >= 0) return true;
    var a = tok.toLowerCase().replace(/’/g, "'");
    if (ABBR_NEVER.has(a)) return false;
    var nextWord = (/^[\p{L}\p{N}]+/u.exec(text.slice(k, Math.min(segEnd, k + 40))) || [''])[0].toLowerCase();
    if (ABBR_NUMBER.has(a) && /\d/.test(nc)) return false;
    if (ABBR_MAY.has(a) || /^(?:[a-z]\.)+[a-z]$/.test(a) || /^[a-z]{1,2}\.[a-z]{1,4}$/.test(a) || a.length === 1 ||
        (a.length <= 5 && /^[a-z]+$/.test(a) && !/[aeiouy]/.test(a))) {
      if (isLower) return false;
      return ABBR_LIBERAL.has(a) || STARTERS.has(nextWord);
    }
    return true;
  }

  /** Split one segment into sentence spans [start, end) (untrimmed). */
  function splitSegment(clean, segStart, segEnd) {
    var spans = [], cursor = segStart, m;
    TERM_RE.lastIndex = segStart;
    while ((m = TERM_RE.exec(clean)) && m.index < segEnd) {
      var end = m.index + m[0].length;
      if (end > segEnd) break;
      if (end < segEnd && !IS_WS.test(clean[end])) continue;
      var ns = end;
      while (ns < segEnd && IS_WS.test(clean[ns])) ns++;
      if (ns >= segEnd) break;
      var term = m[0].replace(/["'”’»)\]}]+$/, '');
      if (isBoundary(clean, m.index, term, ns, segEnd)) {
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
  function segmentText(text, clean) {
    if (clean === undefined) clean = buildMask(text).clean;
    var paras = [];
    blocks(text, clean).forEach(function (b) {
      var sents = [];
      b.segs.forEach(function (sg) {
        splitSegment(clean, sg.s, sg.e).forEach(function (sp) {
          var t = trimSpan(text, sp[0], sp[1]);
          if (t[1] > t[0] && /\p{L}/u.test(clean.slice(t[0], t[1]))) {
            t.list = sg.list; t.heading = sg.heading; t.greet = sg.greet;
            sents.push(t);
          }
        });
      });
      if (sents.length) paras.push({ start: b.start, end: b.end, sentences: sents });
    });
    return paras;
  }

  /* ================================================================== *
   * Word-level helpers                                                  *
   * ================================================================== */
  function phraseIndex(rows) {
    var idx = new Map();
    rows.forEach(function (p) {
      var ws = p[0].split(' ');
      var list = idx.get(ws[0]);
      if (!list) idx.set(ws[0], (list = []));
      list.push({ words: ws, value: p[1], pos: p[2] || 'x', flags: p[3] || '', noun: p[4] || null, phrase: p[0] });
    });
    idx.forEach(function (l) { l.sort(function (a, b) { return b.words.length - a.words.length; }); });
    return idx;
  }
  var PLAIN = phraseIndex(PLAIN_RAW);
  var FILLER = phraseIndex(FILLER_RAW.map(function (f) { return [f, null, 'x', '']; }));
  var CUT = phraseIndex(CUT_RAW.map(function (f) { return [f, null, 'x', '']; }));
  var HEDGES = wordSet('think believe feel opinion perhaps arguably seemingly');
  var KIND_DET = wordSet('what this that these those any some every which the a an one same other each no all different new right wrong best first only another');
  var ED_PP_OK = wordSet('agreed freed decreed guaranteed refereed disagreed');
  var PLAIN_WORDS = new Set();
  PLAIN_RAW.forEach(function (p) { if (p[0].indexOf(' ') < 0) PLAIN_WORDS.add(p[0]); });

  // Candidate lemmas for a word with the inflection that produced it.
  var lemmaCache = new Map();
  function lemmaForms(w) {
    var hit = lemmaCache.get(w);
    if (hit) return hit;
    if (lemmaCache.size > 50000) lemmaCache.clear();
    var c = [[w, '']], n = w.length, b;
    lemmaCache.set(w, c);
    if (n > 3 && w[n - 1] === 's' && w[n - 2] !== 's') {
      c.push([w.slice(0, -1), 's']);
      if (w.endsWith('es')) c.push([w.slice(0, -2), 's']);
      if (w.endsWith('ies')) c.push([w.slice(0, -3) + 'y', 's']);
    }
    if (n > 3 && w.endsWith('ed')) {
      b = w.slice(0, -2);
      c.push([w.slice(0, -1), 'ed'], [b, 'ed']);
      if (w.endsWith('ied')) c.push([w.slice(0, -3) + 'y', 'ed']);
      if (/([b-df-hj-np-tv-z])\1$/.test(b)) c.push([b.slice(0, -1), 'ed']);
    }
    if (n > 5 && w.endsWith('ing')) {
      b = w.slice(0, -3);
      c.push([b + 'e', 'ing'], [b, 'ing']);
      if (/([b-df-hj-np-tv-z])\1$/.test(b)) c.push([b.slice(0, -1), 'ing']);
    }
    return c;
  }

  // Match a phrase index at word i (first word may be inflected for verbs). Returns {len, entry, form} or null.
  function indexHits(index, w) {
    var cache = index.hits || (index.hits = new Map());
    var hit = cache.get(w);
    if (hit) return hit;
    if (cache.size > 50000) cache.clear();
    hit = [];
    var cands = lemmaForms(w);
    for (var c = 0; c < cands.length; c++) {
      var list = index.get(cands[c][0]);
      if (list) hit.push({ c: c, list: list, form: cands[c][1] });
    }
    cache.set(w, hit);
    return hit;
  }
  function matchAt(index, lw, i, gapsOk, inflectOk) {
    var hits = indexHits(index, lw[i]);
    for (var h = 0; h < hits.length; h++) {
      var list = hits[h].list, c = hits[h].c;
      for (var e = 0; e < list.length; e++) {
        var ent = list[e], ok = true, form = hits[h].form;
        if (c > 0 && !(inflectOk && (ent.pos === 'v' || (ent.pos === 'n' && form === 's')))) continue;
        for (var k = 1; k < ent.words.length; k++) {
          if (lw[i + k] !== ent.words[k] || !gapsOk(i + k - 1)) { ok = false; break; }
        }
        if (ok) return { len: ent.words.length, entry: ent, form: form };
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
  function isLyAdverb(tok, w) {
    if (tok.kind !== 'latin' || w.length < 5 || !w.endsWith('ly') || LY_STOP.has(w)) return false;
    if (/[-'.]/.test(w)) return false;
    return true;
  }

  /* ================================================================== *
   * Scoring helpers                                                     *
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
  // School grade → reading-ease scale (Flesch bands), so one number drives label, letter and audience.
  var GRADE_EASE = [[0, 100], [1, 100], [5, 90], [6, 80], [7, 70], [9, 60], [12, 50], [14, 40], [16, 30],
    [18, 20], [20, 10], [22, 0]];
  function easeFromGrade(g) {
    if (!(g > 0)) return 100;
    for (var i = 1; i < GRADE_EASE.length; i++) {
      var a = GRADE_EASE[i - 1], b = GRADE_EASE[i];
      if (g <= b[0]) return a[1] + (b[1] - a[1]) * (g - a[0]) / (b[0] - a[0]);
    }
    return 0;
  }
  // Dale–Chall raw score → grade (published conversion table, midpoints).
  function dcGrade(raw) {
    return raw < 5 ? 4 : raw < 6 ? 5.5 : raw < 7 ? 7.5 : raw < 8 ? 9.5 : raw < 9 ? 11.5 : raw < 10 ? 14 : 16;
  }

  function q(s) { return '“' + s + '”'; }
  function uniq(arr) {
    var seen = [], low = new Set();
    arr.forEach(function (w) { var k = w.toLowerCase(); if (!low.has(k)) { low.add(k); seen.push(w); } });
    return seen;
  }
  function listWords(arr, max) {
    var u = uniq(arr);
    return u.slice(0, max).join(', ') + (u.length > max ? '…' : '');
  }
  var NUM_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
  function numWord(n, lower) { var w = n < NUM_WORDS.length ? NUM_WORDS[n] : String(n); return lower ? w.toLowerCase() : w; }

  /* ================================================================== *
   * Sentence analysis                                                   *
   * ================================================================== */
  var AGENT_STOP = wordSet('in on at for with to from of during under after before within until since as and or but ' +
    'which who that when where if because while through into over without per via than');
  var MEANS = wordSet('email post hand law default mistake car bus train air phone cheque cash card courier force rail ' +
    'road sea mail accident chance design hand');
  var TIME_HEAD = wordSet('end time date deadline day week month year morning evening night noon midnight today ' +
    'tomorrow monday tuesday wednesday thursday friday saturday sunday');
  var CLAUSE_BREAK = wordSet('that which who whom whose if when because and but or so while although though whereas ' +
    'unless until since where');
  var LIGHT_FORMS = wordSet('make makes made making take takes took taken taking give gives gave given giving conduct ' +
    'conducts conducted conducting perform performs performed performing undertake undertakes undertook undertaken ' +
    'undertaking provide provides provided providing reach reaches reached reaching carry carries carried carrying ' +
    'effect effects effected do does did done doing hold holds held holding come comes came coming arrive arrives ' +
    'arrived arriving');
  var NOM_SKIP = wordSet('out to at into');
  var UNCOUNT = wordSet('use help pay spending teamwork start information advice');
  var SUBJ_PRON = wordSet('i we they he she you who');
  var SPACES_RE = /^[\s\u00A0]+$/;
  function isUpper(c) { return !!c && c !== c.toLowerCase() && c === c.toUpperCase(); }
  var PARTICIPLE_SAY = { saying: 'said', adding: 'added', noting: 'noted', arguing: 'argued', warning: 'warned',
    claiming: 'claimed', stating: 'stated', explaining: 'explained', insisting: 'insisted', suggesting: 'suggested' };
  var ADJ_PP = wordSet('tired excited married worried bored scared pleased surprised satisfied supposed used qualified ' +
    'experienced crowded talented complicated confused disappointed embarrassed frightened amazed amused annoyed ' +
    'ashamed delighted depressed exhausted relaxed stressed shocked thrilled obsessed convinced dedicated committed ' +
    'interested involved concerned overwhelmed puzzled terrified horrified fascinated impressed motivated ' +
    'inspired engaged organised organized');
  var STATIVE_PP = wordSet('spread located situated based positioned scattered divided composed made known called named ' +
    'termed dubbed dressed connected related linked attached associated equipped covered filled surrounded ' +
    'designed meant supposed entitled headquartered');
  var BE_ALL = wordSet("be been being is are was were am isn't aren't wasn't weren't");
  var PERFECT = wordSet("has have had having hasn't haven't hadn't 've 's");

  function pluralize(w) {
    if (/(?:s|x|ch|sh)$/.test(w)) return w + 'es';
    if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
    return w + 's';
  }

  function analyzeSentence(ctx, a, index, para, issues) {
    var text = ctx.text, clean = ctx.clean, start = a.s, end = a.e;
    var stext = text.slice(start, end), toks = a.toks, n = toks.length;
    var lw = new Array(n), i, j, k, t, u;
    var capsN = 0, latN = 0;
    for (i = 0; i < n; i++) {
      t = toks[i];
      lw[i] = t.text.toLowerCase().replace(/’/g, "'");
      if (t.kind === 'latin' && t.text.length > 1) {
        latN++;
        if (/[A-Z]/.test(t.text) && t.text === t.text.toUpperCase()) capsN++;
      }
    }
    var shouting = latN >= 3 && capsN / latN > 0.6;

    // gaps[k] = text between token k-1 and token k; plain[k] = that gap is only spaces
    var gaps = new Array(n), plain = new Array(n);
    for (i = 0; i < n; i++) {
      gaps[i] = clean.slice(i ? toks[i - 1].end : start, toks[i].start);
      plain[i] = i > 0 && SPACES_RE.test(gaps[i]);
    }
    function plainGap(k) { return k >= 0 && k + 1 < n && plain[k + 1]; }
    function before(k) { return gaps[k]; }
    function prevWord(k) { return k > 0 && plainGap(k - 1) ? lw[k - 1] : null; }
    function nextWord(k) { return plainGap(k) ? lw[k + 1] : null; }
    function isCapTok(k) { return toks[k].kind === 'latin' && isUpper(toks[k].text[0]); }
    function firstIsName() {
      var w0 = lw[0];
      if (!isCapTok(0) || isFamiliar(w0) || PLAIN_WORDS.has(w0) || LEADIN.has(w0) ||
          /(?:ly|ing|ed|tion|sion|ment|ness|ity|ous|ive|al)$/.test(w0)) return false;
      if (ctx.capOnly(w0)) return true;
      return n > 1 && plainGap(0) && isCapTok(1) && toks[1].text !== 'I';
    }

    /* --- words: syllables, familiarity, Gunning complex words --- */
    var syl = 0, complex = 0, poly = 0, chars = 0, longW = 0, unfam = 0, hardList = [];
    for (i = 0; i < n; i++) {
      t = toks[i];
      var w = lw[i], sy, letters;
      if (t.kind === 'latin') {
        var cap = isUpper(t.text[0]);
        var acr = !shouting && /^[A-Z][A-Z&]*[A-Z](?:'?s)?$/.test(t.text);
        var proper = acr || (!shouting && cap && (i > 0 || firstIsName()));
        var full = syllables(t.text);
        sy = proper ? Math.min(full, 2) : full;        // names and acronyms are read as units: neutral cost
        letters = /['’.\-\u0300-\u036F]/.test(t.text) ? t.text.replace(/[^\p{L}]/gu, '').length : t.text.length;
        if (letters >= 7) longW++;
        t.proper = proper;
        if (!proper && !isFamiliar(w)) {
          unfam++;
          if (letters >= 4 && (sy >= 3 || letters >= 9)) { t.hard = true; hardList.push(t.text); }
        }
        if (sy >= 3) {
          poly++;
          var isComplex = !proper && w.indexOf('.') < 0;
          if (isComplex && w.indexOf('-') >= 0) {
            isComplex = w.split('-').some(function (p) { return p && syllables(p) >= 3; });
          }
          if (isComplex) {
            var mm = /^(.{3,}?)(ing|ed|es)$/.exec(w);
            if (mm && syllables(mm[1]) < 3) isComplex = false;
          }
          if (isComplex) complex++;
        }
      } else if (t.kind === 'num') {
        sy = Math.min(2, syllables(t.text));          // numbers: neutral cost, not "one thousand two hundred"
        letters = Math.max(1, Math.min(4, t.text.replace(/\D/g, '').length));
      } else {
        sy = 1;
        letters = t.text.replace(/\p{M}/gu, '').length;
      }
      t.syl = sy;
      syl += sy;
      chars += letters;
    }

    /* --- passive voice --- */
    var passives = [];
    function findAgent(j) {
      if (!(j + 1 < n && lw[j + 1] === 'by' && plainGap(j))) return null;
      var k = j + 2, parts = [];
      while (k < n && plainGap(k - 1) && parts.length < 5 && toks[k].kind === 'latin' && !AGENT_STOP.has(lw[k]) &&
             !isLyAdverb(toks[k], lw[k]) && !(parts.length === 0 && /ing$/.test(lw[k]))) { parts.push(k); k++; }
      while (parts.length && (DETS.has(lw[parts[parts.length - 1]]) || BE_ALL.has(lw[parts[parts.length - 1]]))) parts.pop();
      if (!parts.length) return null;
      var last = parts[parts.length - 1], head = lw[last];
      if ((parts.length === 1 && MEANS.has(head)) || TIME_HEAD.has(head) || /ing$/.test(lw[parts[0]])) return null;
      return { text: text.slice(toks[parts[0]].start, toks[last].end), first: parts[0], last: last, head: head,
        name: toks[parts[0]].proper };
    }
    function subjectOf(s0) {
      var idx = [], k = s0 - 1, rel = -1;
      if (s0 > 0 && /[,;:(—–]/.test(before(s0))) {
        // "procedures, which were introduced …, have been criticised": find the noun before "which/who"
        for (k = s0 - 1; k > 0; k--) {
          if (/,/.test(before(k)) && /^(?:which|who|that)$/.test(lw[k])) { rel = k; break; }
        }
        return { idx: [], rel: rel, atStart: false };
      }
      while (k >= 0) {
        if (CLAUSE_BREAK.has(lw[k])) { rel = k; break; }
        idx.unshift(k);
        if (k > 0 && /[,;:(—–“"]/.test(before(k))) break;
        k--;
      }
      return { idx: idx, rel: rel, atStart: idx.length > 0 && idx[0] === 0 };
    }
    function objPronoun(sub) {
      if (!sub.idx.length) return sub.rel > 0 && looksPlural(lw[sub.rel - 1]) ? 'them' : 'it';
      var hi = sub.idx.length - 1;                    // head noun: last word before "of/in/for…"
      for (var x = 1; x < sub.idx.length; x++) if (AGENT_STOP.has(lw[sub.idx[x]])) { hi = x - 1; break; }
      var head = lw[sub.idx[hi]];
      if (PRON_OBJ[head]) return PRON_OBJ[head];
      return looksPlural(head) ? 'them' : 'it';
    }
    function passiveParts(P) {
      var aux = lw.slice(P.s0, P.be).filter(function (w) { return w !== 'not' && w !== 'never'; });
      return { pp: lw[P.pp], base: ppBase(lw[P.pp]), aux: aux, be: lw[P.be] };
    }
    function passiveQuestion(P) {
      var x = passiveParts(P), obj = objPronoun(subjectOf(P.s0)), v;
      if (P.prog) v = 'is ' + verbIng(x.base);
      else if (x.aux.indexOf('has') >= 0 || x.aux.indexOf('have') >= 0) v = 'has ' + x.pp;
      else if (x.aux.indexOf('had') >= 0) v = 'had ' + x.pp;
      else if (x.be === 'was' || x.be === 'were' || x.be === "wasn't" || x.be === "weren't") v = ppPast(x.pp);
      else v = verb3(x.base);
      return 'who ' + v + ' ' + obj + '?';
    }
    function passiveRewrite(P) {
      var ag = P.agent;
      if (!ag || P.prog) return null;
      var sub = subjectOf(P.s0);
      if (!sub.atStart || sub.idx.length > 6) return null;
      var x = passiveParts(P), plural = looksPlural(ag.head) || / and /i.test(ag.text);
      var adv = P.advs.length ? P.advs.join(' ').toLowerCase() + ' ' : '', neg = P.neg, vp;
      var modal = x.aux.filter(function (m) { return MODALS.has(m); })[0];
      if (modal) vp = modal + (neg ? ' ' + neg : '') + ' ' + adv + x.base;
      else if (x.aux.indexOf('has') >= 0 || x.aux.indexOf('have') >= 0) vp = (plural ? 'have' : 'has') + (neg ? ' ' + neg : '') + ' ' + adv + x.pp;
      else if (x.aux.indexOf('had') >= 0) vp = 'had' + (neg ? ' ' + neg : '') + ' ' + adv + x.pp;
      else if (x.aux.length) return null;
      else if (x.be === 'was' || x.be === 'were') vp = neg === 'not' ? 'did not ' + adv + x.base : (neg ? neg + ' ' : '') + adv + ppPast(x.pp);
      else if (x.be === 'is' || x.be === 'are' || x.be === 'am') vp = neg === 'not' ? (plural ? 'do not ' : 'does not ') + adv + x.base : (neg ? neg + ' ' : '') + adv + (plural ? x.base : verb3(x.base));
      else return null;
      var s0 = sub.idx[0], s1 = sub.idx[sub.idx.length - 1], obj;
      var subjText = text.slice(toks[s0].start, toks[s1].end);
      if (sub.idx.length === 1 && lw[s0] === 'it' && ag.last + 1 < n && /^(?:that|to|whether)$/.test(lw[ag.last + 1])) obj = '';
      else if (sub.idx.length === 1 && PRON_OBJ[lw[s0]]) obj = PRON_OBJ[lw[s0]];
      else obj = DETS.has(lw[s0]) ? subjText.charAt(0).toLowerCase() + subjText.slice(1) : subjText;
      var agentText = ag.name ? ag.text : capFirst(ag.text);
      var rest = text.slice(toks[ag.last].end, end).replace(/[\s.!?…"”’']+$/, '');
      var out = (agentText + ' ' + vp + (obj ? ' ' + obj : '') + rest).replace(/\s+/g, ' ');
      var ws = out.split(' ');
      if (ws.length > 16) out = ws.slice(0, 14).join(' ').replace(/[,;:]$/, '') + ' …';
      else out += /\?["”’]?$/.test(stext) ? '?' : '.';
      return out;
    }
    for (i = 0; i < n; i++) {
      if (!BE_FORMS.has(lw[i]) || toks[i].kind !== 'latin') continue;
      j = i + 1;
      var skips = 0, neg = null, advs = [], prog = lw[i] === 'being';
      while (j < n && skips < 2 && plainGap(j - 1) &&
             (PASSIVE_SKIP.has(lw[j]) || (isLyAdverb(toks[j], lw[j]) && !isCapTok(j)))) {
        if (lw[j] === 'not' || lw[j] === 'never') neg = lw[j];
        else if (lw[j] === 'being') prog = true;
        else if (lw[j] !== 'been') advs.push(lw[j]);
        j++; skips++;
      }
      var after = j + 1 < n && plainGap(j) ? lw[j + 1] : null;
      if (j < n && plainGap(j - 1) && isParticiple(toks[j], lw[j]) &&
          !(after !== 'by' && (ADJ_PP.has(lw[j]) || (after && STATIVE_PP.has(lw[j]))))) {
        var s0 = i, c = 0;
        k = i - 1;
        while (k >= 0 && c < 3 && plainGap(k) && (BE_AUX.has(lw[k]) ||
               ((lw[k] === 'not' || lw[k] === 'never') && k > 0 && BE_AUX.has(lw[k - 1])))) {
          if (lw[k] === 'not' || lw[k] === 'never') neg = neg || lw[k];
          s0 = k; k--; c++;
        }
        var phrase = text.slice(toks[s0].start, toks[j].end);
        var P = { s0: s0, be: i, pp: j, neg: neg, advs: advs, prog: prog, phrase: phrase, agent: findAgent(j) };
        P.ask = passiveQuestion(P);
        P.rewrite = passives.length ? null : passiveRewrite(P);
        passives.push(P);
        issues.push({ type: 'passive', start: toks[s0].start, end: toks[j].end, text: phrase,
          message: 'Passive voice: ' + q(phrase),
          suggestion: P.rewrite ? 'Active: ' + q(P.rewrite) :
            P.agent ? 'Lead with ' + q(P.agent.text) + ' and say what they did.' : capFirst(P.ask) + ' Name them first.' });
        i = j;
      }
    }

    /* --- plain-English replacements --- */
    function beBefore(i) {
      for (var k = i - 1, c = 0; k >= 0 && c < 3 && plainGap(k); k--, c++) {
        if (BE_ALL.has(lw[k])) return true;
        if (!(PASSIVE_SKIP.has(lw[k]) || isLyAdverb(toks[k], lw[k]))) return false;
      }
      return false;
    }
    function perfectBefore(i) {
      for (var k = i - 1, c = 0; k >= 0 && c < 3 && plainGap(k); k--, c++) {
        if (BE_ALL.has(lw[k]) || PERFECT.has(lw[k])) return true;
        if (!(PASSIVE_SKIP.has(lw[k]) || isLyAdverb(toks[k], lw[k]))) return false;
      }
      return false;
    }
    var used = new Array(n), jargon = [];
    for (i = 0; i < n; i++) {
      if (used[i] || toks[i].kind !== 'latin') continue;
      var pm = matchAt(PLAIN, lw, i, plainGap, true);
      if (!pm) continue;
      var e2 = i + pm.len - 1, ent = pm.entry, fl = ent.flags, form = pm.form;
      var pw = prevWord(i), nw = nextWord(e2);
      var clauseInit = i === 0 || /[,;:(“"—–]/.test(before(i));
      var skip = false, asNoun = false;
      if (/D/.test(fl) && pw && (DETS.has(pw) || pw === 'of')) { if (ent.noun) asNoun = true; else skip = true; }
      if (/A/.test(fl) && (pw === 'a' || pw === 'an')) skip = true;
      if (/I/.test(fl) && !clauseInit) skip = true;
      if (/Q/.test(fl) && !nw) skip = true;
      if (/E/.test(fl) && nw && /^(?:opportunity|possible|convenience|date|moment|chance)$/.test(nw)) skip = true;
      if (/O/.test(fl) && !(nw && OBJ_PRON.has(nw))) skip = true;
      if (/T/.test(fl) && !(nw && (DETS.has(nw) || OBJ_PRON.has(nw) || /^(?:whether|how|what|why|when|where|who)$/.test(nw)))) skip = true;
      if (/S/.test(fl) && nw === 'to') skip = true;
      if (/B/.test(fl) && (nw === 'a' || nw === 'an')) skip = true;
      if (/F/.test(fl) && (pw === 'since' || pw === 'from')) skip = true;
      if (/Y/.test(fl) && pw === 'of') skip = true;
      if (ent.pos === 'v' && !asNoun && form === 'ed' && pw && DETS.has(pw)) skip = true;      // "the allocated budget"
      if (/P/.test(fl) && form === 'ed' && !(pw && (PERFECT.has(pw) || SUBJ_PRON.has(pw)))) skip = true; // "can be obtained", "data obtained from"
      if (skip) continue;
      var value = ent.value, s1 = i;
      if (asNoun) value = ent.noun + (form === 's' ? 's' : '');
      else if (ent.pos === 'v' && form) value = inflectPhrase(value, form, form === 'ed' && perfectBefore(i));
      else if (ent.pos === 'n' && form === 's' && !UNCOUNT.has(value)) value = pluralize(value);
      if (/M/.test(fl) && nw && DETS.has(nw)) value += ' of';
      if ((ent.pos === 'a' || ent.pos === 'n' || asNoun) && (pw === 'a' || pw === 'an')) {
        var art = null;
        if (value === 'best') art = 'the';
        else if ((pw === 'an') !== isVowelSound(value)) art = pw === 'an' ? 'a' : 'an';
        if (art) {
          s1 = i - 1;
          value = (/^A/.test(toks[i - 1].text) ? capFirst(art) : art) + ' ' + value;
        }
      }
      if (/^\p{Lu}/u.test(toks[s1].text) && !/^\p{Lu}/u.test(value)) value = capFirst(value);
      for (u = s1; u <= e2; u++) used[u] = true;
      var ph = text.slice(toks[s1].start, toks[e2].end);
      jargon.push({ text: ph, alt: value, i: s1, e: e2 });
      issues.push({ type: 'complex-word', start: toks[s1].start, end: toks[e2].end, text: ph,
        message: q(ph) + ' has a simpler alternative: ' + q(value), suggestion: value });
      i = e2;
    }

    /* --- filler, hedges, padding, intensifier pairs --- */
    for (i = 0; i < n; i++) {
      if (used[i] || toks[i].kind !== 'latin') continue;
      var cm = matchAt(CUT, lw, i, plainGap, false), e3, fph;
      if (cm) {
        e3 = i + cm.len - 1;
        fph = text.slice(toks[i].start, toks[e3].end);
        for (u = i; u <= e3; u++) used[u] = true;
        issues.push({ type: 'filler', start: toks[i].start, end: toks[e3].end, text: fph,
          message: q(fph) + ' adds nothing — cut it', suggestion: null });
        i = e3;
        continue;
      }
      if (STRONG_LEAD.has(lw[i]) && plainGap(i) && !used[i + 1] && STRONG.has(lw[i + 1]) &&
          !/^(?:that|as)$/.test(lw[i + 2] || '')) {
        var alt = STRONG.get(lw[i + 1]);
        if (isCapTok(i)) alt = capFirst(alt);
        fph = text.slice(toks[i].start, toks[i + 1].end);
        used[i] = used[i + 1] = true;
        issues.push({ type: lw[i] === 'extremely' ? 'adverb' : 'filler', start: toks[i].start, end: toks[i + 1].end,
          text: fph, message: q(fph) + ' — one stronger word reads better: ' + q(alt), suggestion: alt });
        i++;
        continue;
      }
      var fm = matchAt(FILLER, lw, i, plainGap, false);
      if (!fm) continue;
      var fw = fm.entry.words;
      if ((fw[0] === 'kind' || fw[0] === 'sort') && i > 0 && KIND_DET.has(lw[i - 1])) continue;
      if (fw[0] === 'rather' && lw[i + 1] === 'than') continue;
      if (fw[0] === 'just' && (lw[i + 1] === 'as' || lw[i + 1] === 'like')) continue;
      e3 = i + fm.len - 1;
      fph = text.slice(toks[i].start, toks[e3].end);
      for (u = i; u <= e3; u++) used[u] = true;
      var hedge = HEDGES.has(fw[fw.length - 1]);
      issues.push({ type: 'filler', start: toks[i].start, end: toks[e3].end, text: fph,
        message: hedge ? q(fph) + ' is a hedge — say it directly' : q(fph) + ' adds little — try cutting it',
        suggestion: null });
      i = e3;
    }

    /* --- repeated words ("the the") --- */
    for (i = 0; i < n - 1; i++) {
      if (used[i] || used[i + 1] || toks[i].kind !== 'latin') continue;
      if (lw[i] === lw[i + 1] && plainGap(i) && lw[i] !== 'had' && lw[i] !== 'that') {
        used[i] = used[i + 1] = true;
        issues.push({ type: 'repeated-word', start: toks[i].start, end: toks[i + 1].end,
          text: text.slice(toks[i].start, toks[i + 1].end),
          message: 'Repeated word: ' + q(toks[i].text + ' ' + toks[i + 1].text), suggestion: toks[i].text });
      }
    }

    /* --- adverbs: weak intensifiers, and -ly adverbs propping up a weak verb --- */
    for (i = 0; i < n; i++) {
      if (used[i] || toks[i].kind !== 'latin' || (i > 0 && isCapTok(i))) continue;
      if (INTENSIFIERS.has(lw[i])) {
        used[i] = true;
        issues.push({ type: 'adverb', start: toks[i].start, end: toks[i].end, text: toks[i].text,
          message: q(toks[i].text) + ' is an intensifier — cut it or choose a stronger word', suggestion: null });
        continue;
      }
      if (!isLyAdverb(toks[i], lw[i]) || NON_MANNER.has(lw[i])) continue;
      var vb = plainGap(i) && WEAK_VERBS.has(lw[i + 1]) ? i + 1 : (i > 0 && plainGap(i - 1) && WEAK_VERBS.has(lw[i - 1]) ? i - 1 : -1);
      if (vb < 0) continue;
      var a0 = Math.min(i, vb), a1 = Math.max(i, vb);
      var pairText = text.slice(toks[a0].start, toks[a1].end), swap = ADVERB_SWAP.get(lw[a0] + ' ' + lw[a1]);
      if (swap && !used[vb]) {
        used[vb] = true;
        issues.push({ type: 'adverb', start: toks[a0].start, end: toks[a1].end, text: pairText,
          message: q(pairText) + ' — one precise verb beats verb + adverb', suggestion: swap });
      } else {
        issues.push({ type: 'adverb', start: toks[i].start, end: toks[i].end, text: toks[i].text,
          message: q(pairText) + ' — a more precise verb would not need the adverb', suggestion: null });
      }
      used[i] = true;
    }

    /* --- nominalisations: "conduct an investigation", "the approval of" --- */
    var noms = [];
    for (i = 0; i < n; i++) {
      if (toks[i].kind !== 'latin') continue;
      var nomKey = NOMINAL.has(lw[i]) ? lw[i] : (/s$/.test(lw[i]) && NOMINAL.has(lw[i].slice(0, -1)) ? lw[i].slice(0, -1) : null);
      if (!nomKey) continue;
      var hit = null;
      if (nomKey === lw[i] && i > 0 && i + 1 < n && lw[i + 1] === 'of' && plainGap(i) && plainGap(i - 1) && /^(?:the|a|an|any)$/.test(lw[i - 1])) {
        hit = [i - 1, i + 1];
      } else {
        k = i - 1;
        var hops = 0;
        while (k >= 0 && hops < 3 && plainGap(k) && (DETS.has(lw[k]) || LIGHT_ADJ.has(lw[k]) || NOM_SKIP.has(lw[k]))) { k--; hops++; }
        if (k >= 0 && plainGap(k) && LIGHT_FORMS.has(lw[k]) && !(lw[k] === 'provided' && beBefore(k))) hit = [k, i];
      }
      if (hit && !noms.some(function (x) { return x.nom === nomKey; })) {
        noms.push({ nom: nomKey, verb: NOMINAL.get(nomKey), text: text.slice(toks[hit[0]].start, toks[hit[1]].end) });
      }
    }

    /* --- noun stacks: three or more nouns/adjectives in a row --- */
    var stacks = [];
    var stackCache = [];
    function stackKind(k) {
      if (stackCache[k] !== undefined) return stackCache[k];
      return (stackCache[k] = stackKind0(k));
    }
    function stackKind0(k) {
      var t = toks[k], w = lw[k];
      if (t.kind !== 'latin' || t.proper || w.length < 3 || STOP.has(w) || DETS.has(w) || w.indexOf("'") >= 0) return 0;
      if ((/ly$/.test(w) || /ed$/.test(w) || /ing$/.test(w)) && !STACK_NOUNS.has(w)) return 0;
      if (w.length >= 6 && NOUN_SUFFIX.test(w)) return 3;
      if (STACK_NOUNS.has(w) || STACK_NOUNS.has(w.replace(/s$/, ''))) return 2;
      if (w.length >= 5 && ADJ_SUFFIX.test(w)) return 1;
      return 0;
    }
    for (i = 0; i < n;) {
      if (!stackKind(i)) { i++; continue; }
      var kinds = [];
      j = i;
      while (j < n && (j === i || plainGap(j - 1)) && (k = stackKind(j))) { kinds.push(k); j++; }
      var lastN = j - 1;
      while (lastN >= i && kinds[lastN - i] === 1) lastN--;
      var len = lastN - i + 1, suf = 0, nouns = 0;
      for (k = i; k <= lastN; k++) { if (kinds[k - i] === 3) suf++; if (kinds[k - i] >= 2) nouns++; }
      if (len >= 3 && nouns >= 2 && (suf >= 2 || (len >= 4 && suf >= 1))) {
        stacks.push({ text: text.slice(toks[i].start, toks[lastN].end), words: toks.slice(i, lastN + 1).map(function (x) { return x.text; }) });
      }
      i = j;
    }

    /* --- long lead-in before the main clause --- */
    var leadIn = 0, leadEnd = -1;
    if (toks[0].kind === 'latin' && (LEADIN.has(lw[0]) || (/ing$/.test(lw[0]) && lw[0].length > 4) ||
        (/ed$/.test(lw[0]) && lw[0].length > 5 && !NOT_PP.has(lw[0])))) {
      for (k = 1; k < n; k++) {
        if (!/[,;:—–]/.test(before(k))) continue;
        if (toks[k].kind === 'num') continue;                          // "the Act, 1949, the Bank …"
        break;
      }
      if (k < n) leadEnd = k;
      if (k >= 8 && n - k >= 8) leadIn = k;
    }

    /* --- where to split a long sentence --- */
    function subjectLike(k) { return k < n && (SUBJ_START.has(lw[k]) || (isCapTok(k) && toks[k].proper)); }
    function listBefore(k) {
      for (var b = k - 1; b >= Math.max(1, k - 4); b--) if (/,/.test(before(b))) return true;
      return false;
    }
    function commaSoon(k, span) {
      for (var b = k + 1; b < Math.min(n, k + 1 + span); b++) if (/[,;:)]/.test(before(b))) return true;
      return false;
    }
    function findSplit() {
      if (n < 16) return null;
      var best = null;
      for (var k = 6; k <= n - 6; k++) {
        var g = before(k), nx = lw[k], kind = null, wgt = 0;
        if (k === leadEnd) continue;
        if (/;/.test(g)) { kind = 'semicolon'; wgt = 5; }
        else if (!/,/.test(g)) continue;
        else if (PARTICIPLE_SAY[nx] && k + 1 < n) { kind = 'saying'; wgt = 4; }
        else if (commaSoon(k, 4)) continue;                           // "inflation, although easing, remained"
        else if (/^(?:and|but|so|yet)$/.test(nx) && subjectLike(k + 1) && lw[k + 1] !== 'that' && !listBefore(k)) { kind = 'conj'; wgt = 4; }
        else if (nx === 'which') { kind = 'which'; wgt = 3; }
        else if (lw[k + 1] === 'of' && /^(?:which|whom)$/.test(lw[k + 2] || '') && /^(?:many|some|most|all|none|each|both|several|one|two|three|few|any)$/.test(nx)) { kind = 'ofwhich'; wgt = 3; }
        else if (nx === 'because') { kind = 'because'; wgt = 3; }
        else if (/^(?:although|though|whereas)$/.test(nx) || (nx === 'while' && subjectLike(k + 1))) { kind = 'contrast'; wgt = 3; }
        else if (subjectLike(k) && !/^(?:the|a|an|this|that|these|those)$/.test(nx) && !listBefore(k)) { kind = 'comma'; wgt = 2; }
        else if (n >= 30 && !listBefore(k) && toks[k].kind === 'latin') { kind = 'soft'; wgt = 1; }
        if (!kind) continue;
        var score = wgt * 10 - Math.abs(k - n / 2) / n * 30;
        if (!best || score > best.score) best = { k: k, kind: kind, score: score };
      }
      if (!best) return null;
      var at = best.k, rest;
      best.after = toks[at - 1].text;
      if (best.kind === 'conj') rest = lw[at] === 'but' ? ['But'].concat(words(at + 1, 3)) : [capFirst(toks[at + 1].proper ? toks[at + 1].text : lw[at + 1])].concat(words(at + 2, 3));
      else if (best.kind === 'which') rest = ['This'].concat(words(at + 1, 3));
      else if (best.kind === 'ofwhich') rest = [capFirst(lw[at]), 'of', 'them'].concat(words(at + 3, 2));
      else if (best.kind === 'saying') rest = [sentenceSubject(), PARTICIPLE_SAY[lw[at]]].concat(words(at + 1, 2));
      else if (best.kind === 'because') rest = ['This', 'is', 'because'].concat(words(at + 1, 2));
      else if (best.kind === 'contrast') rest = ['However,'].concat(words(at + 1, 3));
      else rest = [toks[at].proper ? toks[at].text : capFirst(lw[at])].concat(words(at + 1, 3));
      best.next = rest.join(' ');
      return best;
    }
    // "The Reserve Bank of India …" → "It"; "Economists …" → "They"
    function sentenceSubject() {
      var w0 = lw[0];
      if (PRON_OBJ[w0] && /^(?:i|we|they|he|she|it|you)$/.test(w0)) return toks[0].text === 'I' ? 'I' : capFirst(w0);
      var head = null;
      for (var k = 0; k < Math.min(n, 7); k++) {
        if (k > 0 && (AGENT_STOP.has(lw[k]) || BE_ALL.has(lw[k]) || /[,;:]/.test(before(k)))) break;
        if (!DETS.has(lw[k])) head = lw[k];
      }
      return head && looksPlural(head) ? 'They' : 'It';
    }
    function words(from, count) {
      var out = [];
      for (var k = from; k < n && out.length < count; k++) {
        if (k > from && /[,;:()—–]/.test(before(k))) break;            // previews stop at a comma
        out.push(toks[k].proper || toks[k].text === 'I' ? toks[k].text : lw[k]);
      }
      return out;
    }
    var split = n >= 16 && /[,;]/.test(clean.slice(start, end)) ? findSplit() : null;

    /* --- clauses (punctuation outside code, numbers and URLs) --- */
    var sc = clean.slice(start, end), clauses = 0, cm2, cre = /,(?=\s)|;(?=\s)|:(?=\s)|\(|—|\s[–-]\s/g;
    while ((cm2 = cre.exec(sc))) {
      var pc = cm2[0].trim();
      clauses += pc === ';' ? 2 : 1;
    }

    /* --- difficulty (0–100) --- */
    var lengthPts = 40 * clamp((n - 10) / 25, 0, 1);
    var hardPts = 30 * (1 - Math.exp(-hardList.length / 2));
    var passivePts = Math.min(15, 10 * passives.length);
    var clausePts = 15 * clamp(clauses / 6, 0, 1);
    var jargonPts = 10 * clamp(jargon.length / 2, 0, 1);
    var nomPts = Math.min(10, 5 * noms.length);
    var stackPts = Math.min(8, 5 * stacks.length);
    var leadPts = leadIn ? 5 : 0;
    var difficulty = Math.round(clamp(lengthPts + hardPts + passivePts + clausePts + jargonPts + nomPts + stackPts + leadPts, 0, 100));
    var lvl = difficulty < 25 ? 'easy' : difficulty < 45 ? 'ok' : difficulty < 65 ? 'hard' : 'very-hard';

    /* --- reasons (specific, actionable) --- */
    var reasons = [];
    var jargonWords = new Set();
    jargon.forEach(function (jg) { for (var x = jg.i; x <= jg.e; x++) jargonWords.add(lw[x]); });
    var unfamiliarShown = uniq(hardList.filter(function (h) { return !jargonWords.has(h.toLowerCase()); }));
    function lengthReason() {
      if (!split) return n + ' words with no natural break — say it as two sentences';
      if (split.kind === 'soft' && leadIn) return n + ' words — put the main point first, then split off the ' + leadIn + '-word opening';
      var w = q(split.after);
      switch (split.kind) {
        case 'semicolon': return n + ' words — the semicolon after ' + w + ' can be a full stop';
        case 'which': return n + ' words — split after ' + w + ' and give the “which …” part its own sentence';
        case 'because': return n + ' words — split after ' + w + ' and give the reason its own sentence';
        case 'contrast': return n + ' words — split after ' + w + ', where the contrast starts';
        case 'soft': return n + ' words — break it after ' + w + ' and rework the rest as a new sentence';
        default: return n + ' words — split after ' + w + ', where a new idea starts';
      }
    }
    if (n >= 25) reasons.push(lengthReason());
    else if (n >= 20 && split) reasons.push(n + ' words — could split after ' + q(split.after));
    if (unfamiliarShown.length) {
      reasons.push((unfamiliarShown.length === 1 ? 'Unfamiliar word: ' : unfamiliarShown.length + ' unfamiliar words: ') +
        listWords(unfamiliarShown, 3));
    }
    if (passives.length) {
      var P0 = passives[0];
      reasons.push('Passive: ' + (P0.agent ? q(P0.phrase + ' by ' + P0.agent.text) + ' — start with ' + q(P0.agent.text)
        : q(P0.phrase) + ' — ' + P0.ask) + (passives.length > 1 ? ' (+' + (passives.length - 1) + ' more)' : ''));
    }
    if (jargon.length) {
      reasons.push('Plain English: ' + jargon.slice(0, 2).map(function (jg) { return q(jg.text) + ' → ' + q(jg.alt); }).join(', ') +
        (jargon.length > 2 ? ' (+' + (jargon.length - 2) + ' more)' : ''));
    }
    if (noms.length) {
      reasons.push((noms.length > 1 ? 'Nominalisations: ' : 'Nominalisation: ') +
        noms.slice(0, 2).map(function (x) { return x.nom + ' → ' + x.verb; }).join(', '));
    }
    if (stacks.length) reasons.push('Stacked nouns: ' + q(stacks[0].text));
    if (leadIn) reasons.push('Starts with a ' + leadIn + '-word lead-in before the main point');
    if (clauses >= 4 && n < 25) {
      reasons.push(split ? 'Strings ' + (clauses + 1) + ' clauses together — end the first after ' + q(split.after)
        : 'Strings ' + (clauses + 1) + ' clauses together — give one its own sentence');
    }

    /* --- one concrete next step (tip) --- */
    function tipFor(kind) {
      switch (kind) {
        case 'length':
        case 'clauses':
          if (split && split.kind === 'soft' && leadIn) return tipFor('leadin');
          if (split && split.kind === 'soft') return 'Put a full stop after ' + q(split.after) + ' and turn ' + q(split.next.charAt(0).toLowerCase() + split.next.slice(1) + ' …') + ' into a sentence of its own, with its own subject and verb.';
          if (split) return 'Put a full stop after ' + q(split.after) + ' and start the next sentence: ' + q(split.next + ' …');
          if (leadIn) return tipFor('leadin');
          if (n >= 25) {
            for (var d = 0; d <= 5; d++) {
              var cands = [Math.round(n / 2) + d, Math.round(n / 2) - d];
              for (var ci = 0; ci < 2; ci++) {
                var kk = cands[ci];
                if (kk > 4 && kk < n - 4 && !commaSoon(kk, 3) && (/^(?:which|because|whereas|although)$/.test(lw[kk]) ||
                    (/^(?:and|but|so|while)$/.test(lw[kk]) && subjectLike(kk + 1) && lw[kk + 1] !== 'that'))) {
                  return 'Cut it to one point per sentence — try ending the first sentence before ' + q(lw[kk] + ' ' + words(kk + 1, 2).join(' ') + ' …') + '.';
                }
              }
            }
          }
          return null;
        case 'passive':
          var P0 = passives[0];
          if (P0.rewrite) return 'Make it active: ' + q(P0.rewrite);
          return 'Say ' + P0.ask.replace(/\?$/, '') + ', and make them the subject.';
        case 'hard':
          if (!unfamiliarShown.length) return null;
          return q(unfamiliarShown[0]) + (unfamiliarShown[1] ? ' and ' + q(unfamiliarShown[1]) : '') +
            ' may stop readers — use an everyday word or add a short explanation.';
        case 'jargon':
          return 'Swap ' + jargon.slice(0, 3).map(function (jg) { return q(jg.text) + ' for ' + q(jg.alt); }).join(', ') + '.';
        case 'nominal':
          return 'Use the verb: ' + q(noms[0].verb) + ' instead of ' + q(noms[0].text) + '.';
        case 'stack':
          var sw = stacks[0].words;
          var unpacked = sw[sw.length - 1].toLowerCase() + ' of ' + sw.slice(0, -1).join(' ').toLowerCase();
          return 'Unpack ' + q(stacks[0].text) + ' — for example ' + q(unpacked) + '.';
        case 'leadin':
          return 'Lead with the main point (' + q(capFirst(words(leadEnd, 4).join(' ')) + ' …') + '), then add the ' +
            leadIn + '-word opening after it.';
      }
      return null;
    }
    var comps = [['length', lengthPts], ['hard', hardPts], ['passive', passivePts], ['clauses', clausePts],
      ['jargon', jargonPts], ['nominal', nomPts], ['stack', stackPts], ['leadin', leadPts]]
      .filter(function (c) { return c[1] > 0; })
      .map(function (c) {
        var bonus = (c[0] === 'jargon' && jargon.length >= 2) || (c[0] === 'passive' && passives[0].rewrite) ? 8 : 0;
        return [c[0], c[1] + bonus];
      })
      .sort(function (x, y) { return y[1] - x[1]; });
    var tip = null, main = null;
    for (k = 0; k < comps.length && !tip; k++) {
      if (comps[k][0] === 'length' && n < 20 && !split) continue;
      tip = tipFor(comps[k][0]);
      if (tip) main = comps[k][0];
    }
    if (!main && comps.length) main = comps[0][0];
    if (lvl === 'easy' && !passives.length && !jargon.length && !noms.length) tip = null;

    /* --- long-sentence issue --- */
    if (n >= 25) {
      var very = n >= 40;
      issues.push({ type: very ? 'very-long-sentence' : 'long-sentence', start: start, end: end, text: stext,
        message: n + ' words — ' + (very ? 'very hard to follow. ' : 'hard to follow. ') +
          (split ? 'Split it after ' + q(split.after) + '.' : very ? 'Split it into two or three.' : 'Split it in two.'),
        suggestion: null });
    }

    return {
      index: index, start: start, end: end, text: stext, paragraph: para,
      words: n, syllables: syl, complexWords: complex,
      grade: r1(fk(n, 1, syl)), difficulty: difficulty, level: lvl, reasons: reasons, rank: null,
      flagged: false, tip: tip,
      _x: { poly: poly, chars: chars, long: longW, unfam: unfam, toks: toks, lw: lw, main: main, hard: unfamiliarShown }
    };
  }

  /* ================================================================== *
   * analyze()                                                           *
   * ================================================================== */
  var FRAGMENT_RE = /^(?:hi|hello|hey|hiya|dear|thanks|thank you|cheers|regards|best|sincerely|ok|okay|yes|no|sure|great|cool|noted)\b/i;

  function analyze(input) {
    var text = input == null ? '' : String(input);
    if (!/\p{L}/u.test(text)) return null;
    var mk = buildMask(text), clean = mk.clean;
    var paraSpans = segmentText(text, clean);
    if (!paraSpans.length) return null;

    // tokens first, so names can be recognised at the start of a sentence
    var capMid = new Set(), lowerSeen = new Set();
    paraSpans.forEach(function (p) {
      p.items = [];
      p.sentences.forEach(function (sp) {
        var toks = tokenize(clean, sp[0], sp[1]);
        if (!toks.length) return;
        p.items.push({ s: sp[0], e: sp[1], toks: toks, list: sp.list, heading: sp.heading, greet: sp.greet });
        toks.forEach(function (t, i) {
          if (t.kind !== 'latin') return;
          var w = t.text.toLowerCase();
          if (/^\p{Lu}/u.test(t.text)) { if (i > 0) capMid.add(w); } else lowerSeen.add(w);
        });
      });
    });
    var ctx = { text: text, clean: clean, capOnly: function (w) { return capMid.has(w) && !lowerSeen.has(w); } };

    var sentences = [], issues = [], paraObjs = [];
    paraSpans.forEach(function (p) {
      if (!p.items.length) return;
      var pi = paraObjs.length, list = [];
      p.items.forEach(function (it) {
        var s = analyzeSentence(ctx, it, sentences.length, pi, issues);
        var terminal = /[.!?…।॥‽]["'”’)\]]*$/.test(s.text);
        s._x.role = it.heading ? 'heading' : it.list ? 'list' : 'prose';
        s._x.incl = !it.heading && !(s.words <= 3 && (it.list || it.greet || !terminal || FRAGMENT_RE.test(s.text)));
        s._x.quote = /[“”"]/.test(s.text);
        sentences.push(s);
        list.push(s);
      });
      paraObjs.push({ index: pi, start: p.start, end: p.end, list: list });
    });
    if (!sentences.length) return null;

    function sum(list) {
      var o = { W: 0, S: list.length, SYL: 0, CX: 0, POLY: 0, CH: 0, LONG: 0, UNF: 0 };
      list.forEach(function (s) {
        o.W += s.words; o.SYL += s.syllables; o.CX += s.complexWords; o.POLY += s._x.poly; o.CH += s._x.chars;
        o.LONG += s._x.long; o.UNF += s._x.unfam;
      });
      return o;
    }
    var body = sentences.filter(function (s) { return s._x.incl; });
    if (!body.length) body = sentences;
    var all = sum(sentences), B = sum(body);
    if (!all.W) return null;

    var W = B.W, S = B.S, asl = W / S;
    var ease = fre(W, S, B.SYL);
    var gFK = fk(W, S, B.SYL);
    var gFog = 0.4 * (asl + 100 * B.CX / W);
    var gSmog = 1.0430 * Math.sqrt(B.POLY * 30 / S) + 3.1291;
    var L100 = B.CH / W * 100, S100 = S / W * 100;
    var gCLI = Math.max(0, 0.0588 * L100 - 0.296 * S100 - 15.8);
    var gARI = Math.max(0, 4.71 * (B.CH / W) + 0.5 * asl - 21.43);
    var grades = [gFK, gFog, gSmog, gCLI, gARI].map(function (g) { return Math.max(0, g); });
    var sorted = grades.slice().sort(function (a, b) { return a - b; });
    var consensus = (sorted[1] + sorted[2] + sorted[3]) / 3; // trimmed mean: drop highest and lowest
    var pdw = 100 * B.UNF / W;
    var dc = 0.1579 * pdw + 0.0496 * asl + (pdw > 5 ? 3.6365 : 0);
    var cEase = r1(easeFromGrade(r1(consensus)));

    var paragraphs = paraObjs.map(function (p) {
      var inc = p.list.filter(function (s) { return s._x.incl; });
      var ps = sum(inc.length ? inc : p.list);
      return { index: p.index, start: p.start, end: p.end, words: sum(p.list).W, fleschReadingEase: r1(fre(ps.W, ps.S, ps.SYL)) };
    });

    // Hardest: only sentences that are genuinely hard (level hard / very-hard).
    sentences.forEach(function (s) {
      s.flagged = (s.level === 'hard' || s.level === 'very-hard') && s.words >= 4 && s._x.role !== 'heading';
    });
    var flagged = sentences.filter(function (s) { return s.flagged; })
      .sort(function (a, b) { return b.difficulty - a.difficulty || b.grade - a.grade || a.index - b.index; });
    var hardest = flagged.slice(0, 5);
    hardest.forEach(function (s, i) { s.rank = i + 1; });
    var F = flagged.length, SB = body.length;
    var hardestNote = !F ? 'No sentence here is hard to read.' :
      F > 5 ? F + ' sentences are hard to read — these are the 5 hardest.' :
      F <= Math.max(2, SB / 3) ? 'Only ' + (F === 1 ? 'one sentence stands out.' : numWord(F, true) + ' sentences stand out.') :
      (F === SB ? 'All ' + SB + ' sentences are hard to read.' : numWord(F) + ' of ' + SB + ' sentences are hard to read.');

    // Text type
    var listN = 0, quoteN = 0;
    sentences.forEach(function (s) { if (s._x.role === 'list') listN++; if (s._x.quote) quoteN++; });
    var nonSpace = text.replace(/\s/g, '').length || 1, SA = sentences.length;
    var textType = (mk.fences > 0 || mk.spans >= 3 || mk.codeChars / nonSpace > 0.08) ? 'technical' :
      listN / SA >= 0.5 ? 'list' :
      quoteN >= 2 && quoteN / SA >= 0.3 ? 'dialogue' :
      listN >= 2 && listN / SA >= 0.2 ? 'mixed' : 'prose';

    // Confidence
    var confidence = all.W < 60 || SB < 3 ? { level: 'low', note: 'Short text — scores are a rough guide.' } :
      all.W < 100 || SB < 5 ? { level: 'medium', note: 'Under 100 words — one sentence can swing the scores.' } :
      textType === 'list' ? { level: 'medium', note: 'Mostly list items — the formulas are built for full sentences.' } :
      { level: 'high', note: 'Long enough for stable scores.' };

    // Summary: the main problem in one or two plain sentences
    var L = letter(cEase);
    var opener = { A: 'Clear and easy to read.', B: 'Mostly clear.', C: 'Fairly readable, but it takes some effort.',
      D: 'Hard going in places.', E: 'Hard to read.', F: 'Very hard to read.' }[L];
    var summary, longest = [];
    if (!F) {
      var pool = [];
      sentences.forEach(function (s) {
        s._x.toks.forEach(function (t, i) { if (t.kind === 'latin' && !t.proper && t.syl >= 3 && !STOP.has(s._x.lw[i])) pool.push(t); });
      });
      pool.sort(function (a, b) { return b.syl - a.syl || b.text.length - a.text.length; });
      longest = pool.map(function (t) { return t.text.toLowerCase(); });
      var docHard = [];
      sentences.forEach(function (s) { docHard = docHard.concat(s._x.hard); });
      docHard = uniq(docHard);
      if (L === 'A' || L === 'B') summary = opener + ' No sentence needs fixing.';
      else if (pdw >= 12 && docHard.length) summary = opener + ' The words, not the sentences, slow readers down — swap ' +
        q(docHard[0]) + (docHard[1] ? ' and ' + q(docHard[1]) : '') + ' for everyday words.';
      else if (asl >= 22) summary = opener + ' Sentences average ' + Math.round(asl) + ' words — aim for 15 to 20.';
      else {
        var longOnes = uniq(longest).slice(0, 2);
        summary = opener + ' No single sentence is the problem' + (longOnes.length ?
          ' — long words like ' + longOnes.map(q).join(' and ') + ' add up; use shorter ones where you can.' :
          ' — the sentences run long overall; aim for 15 to 20 words each.');
      }
    } else {
      var counts = {}, dom = null;
      flagged.forEach(function (s) { var m = s._x.main || 'length'; counts[m] = (counts[m] || 0) + 1; if (!dom || counts[m] > counts[dom]) dom = m; });
      var ADJ = { length: 'long', clauses: 'long', passive: 'passive', hard: 'jargon-heavy', jargon: 'wordy',
        nominal: 'wordy', stack: 'dense', leadin: 'slow-starting' };
      var ACT = { length: ['split it', 'split them'], clauses: ['break it at the commas', 'break them at the commas'],
        passive: ['say who does what', 'say who does what'], hard: ['swap the long words for everyday ones', 'swap the long words for everyday ones'],
        jargon: ['use the plain alternatives', 'use the plain alternatives'], nominal: ['use verbs instead of “-tion” nouns', 'use verbs instead of “-tion” nouns'],
        stack: ['unpack the noun stacks', 'unpack the noun stacks'], leadin: ['lead with the main point', 'lead with the main point'] };
      if (F / SB >= 0.5 && SB >= 3) summary = opener + ' Most sentences are ' + ADJ[dom] + ' — ' + ACT[dom][1] + '.';
      else {
        var gentle = L === 'A' || L === 'B';
        summary = opener + ' ' + numWord(F) + ' ' + ADJ[dom] + (F === 1 ? ' sentence ' : ' sentences ') +
          (gentle ? (F === 1 ? 'stands out' : 'stand out') : (F === 1 ? 'drags the score down' : 'drag the score down')) +
          ' — ' + ACT[dom][F === 1 ? 0 : 1] + '.';
      }
    }

    issues.sort(function (a, b) { return a.start - b.start || b.end - a.end; });

    var freq = new Map();
    sentences.forEach(function (s) {
      for (var i = 0; i < s._x.toks.length; i++) {
        var w = s._x.lw[i];
        if (s._x.toks[i].kind !== 'latin' || w.length < 2 || STOP.has(w) || w.indexOf('.') >= 0) continue;
        freq.set(w, (freq.get(w) || 0) + 1);
      }
    });
    sentences.forEach(function (s) {
      delete s._x;
    });
    var wordFrequency = Array.from(freq, function (e) { return { word: e[0], count: e[1] }; })
      .sort(function (a, b) { return b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0); })
      .slice(0, 10);

    var chars = text.replace(/[\r\n]/g, '');
    var surrogates = (chars.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g) || []).length;
    var aslAll = all.W / all.S;

    return {
      stats: {
        words: all.W, sentences: all.S, paragraphs: paragraphs.length, characters: chars.length - surrogates,
        syllables: all.SYL, complexWords: all.CX, longWords: all.LONG, unfamiliarWords: all.UNF,
        readingTimeSec: Math.round(all.W / 238 * 60), speakingTimeSec: Math.round(all.W / 150 * 60),
        avgWordsPerSentence: r1(aslAll), avgSyllablesPerWord: r2(all.SYL / all.W)
      },
      scores: {
        fleschReadingEase: r1(ease),
        fleschKincaidGrade: r1(grades[0]), gunningFog: r1(grades[1]), smog: r1(grades[2]),
        colemanLiau: r1(grades[3]), ari: r1(grades[4]), consensusGrade: r1(consensus),
        daleChall: r1(dc), consensusEase: cEase,
        label: label(cEase), audience: audience(cEase), letter: L
      },
      confidence: confidence,
      textType: textType,
      summary: summary,
      sentences: sentences,
      hardest: hardest,
      hardestNote: hardestNote,
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
    _segment: segmentText,
    _isFamiliar: isFamiliar,
    _mask: function (t) { return buildMask(String(t)).clean; },
    _plainEntries: PLAIN_RAW.map(function (p) { return { phrase: p[0], value: p[1], pos: p[2] || 'x', flags: p[3] || '' }; }),
    _familiarCount: FAMILIAR.size
  };

  root.Readable = Readable;
  if (typeof module !== 'undefined' && module.exports) module.exports = Readable;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
