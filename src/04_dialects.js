/*! NAMARI | MIT License | (c) 2026 4n5-Studio */
/* ============================================================
   NAMARI — data: regions, dialects, voice presets, emotion presets
   dialect fields:
     id, name, region, sampleText
     convertHint        vocabulary / endings handed to the conversion prompt
     voiceDesignPrompt  English phrase describing the accent; it follows the
                        preset persona ("A young woman in her 20s, ...")
     defaultPreset      voice preset used when the user picks 「自動」
     beta               minor / hard dialects: shown with a β badge
     standard           no conversion (text is read as written)
   ============================================================ */
(() => {
'use strict';

N.REGIONS = ['北海道', '東北', '関東', '中部', '近畿', '中国', '四国', '九州', '沖縄'];

N.DIALECTS = [
  /* ---------- 北海道 ---------- */
  {
    id: 'hokkaido', name: '北海道弁', region: '北海道', defaultPreset: 'f-young',
    sampleText: 'なまら寒いっしょ。手袋はいてったほうがいいべさ。',
    convertHint: '語尾「〜べ」「〜べさ」「〜っしょ（〜でしょ）」「〜さ」「〜したっけ（〜したら）」、「なまら（とても）」「したっけ（じゃあね）」「なんもなんも（いえいえ）」「めんこい（かわいい）」「投げる（捨てる）」「手袋をはく（はめる）」「こわい（疲れた）」「わや（めちゃくちゃ）」「しばれる（冷え込む）」「〜さる（自然とそうなる：押ささる）」。イントネーションは標準語に近く、語尾と語彙で北海道らしさを出す。',
    voiceDesignPrompt: 'born and raised in Sapporo, Hokkaido, speaking Japanese with a mild Hokkaido accent, close to standard Japanese but with relaxed, friendly Hokkaido intonation.',
  },
  /* ---------- 東北 ---------- */
  {
    id: 'tsugaru', name: '津軽弁', region: '東北', beta: true, defaultPreset: 'm-old',
    sampleText: 'わいは！ めやぐだの。',
    convertHint: '語尾「〜だべ」「〜じゃ」「〜の」「〜はんで（〜だから）」「〜へ（〜しなさい）」、一人称「わ」、二人称「な」、「めやぐ（すまない・ありがとう）」「わいは（驚き）」「どさ（どこへ）」「け（食べて）」「なんも（いいえ・どういたしまして）」。短い言葉が多く、濁音が多い。強くしても、文字で読んで意味が追える程度にとどめる。',
    voiceDesignPrompt: 'born and raised in the Tsugaru region of Aomori, speaking Japanese with a strong rural Tsugaru (northern Tohoku) accent, soft voiced consonants and a slow, warm rhythm.',
  },
  {
    id: 'akita', name: '秋田弁', region: '東北', beta: true, defaultPreset: 'm-old',
    sampleText: 'んだんだ。まんず、けっけ。',
    convertHint: '語尾「〜だべ」「〜だがら（〜だから）」「〜ねが（〜しないか）」「〜すべ（〜しよう）」「〜だっす（丁寧）」、「んだ（そうだ）」「まんず（まず・とにかく）」「け（食べて・来て）」「めんこい（かわいい）」「おめ（あなた）」「おら（私）」「しゃっこい（冷たい）」「ねまる（座る）」「あべ（行こう）」「ぼっこれる（壊れる）」。語中のカ行・タ行が濁りやすい（あかい→あがい、はたけ→はだげ）。強くしても、文字で読んで意味が追える程度にとどめる。',
    voiceDesignPrompt: 'born and raised in rural Akita, speaking Japanese with a strong Akita (northern Tohoku) accent, nasal, voiced consonants and a soft, unhurried rhythm.',
  },
  {
    id: 'sendai', name: '仙台弁', region: '東北', beta: true, defaultPreset: 'm-young',
    sampleText: 'いぎなりうめぇっちゃ。行くべっちゃ。',
    convertHint: '語尾「〜っちゃ（〜だよ）」「〜だっちゃ」「〜べ」「〜すっぺ（〜しよう）」「〜がら（〜から）」「〜だべした」、「いぎなり（とても）」「いずい（しっくりこない）」「おだづ（ふざける）」「ごしゃぐ（怒る）」「めんこい（かわいい）」「かだる（仲間に入る）」「ねっぱす（くっつける）」。語中のカ行・タ行が少し濁る。',
    voiceDesignPrompt: 'born and raised in Sendai, Miyagi, speaking Japanese with a natural Sendai (southern Tohoku) accent, slightly voiced consonants and a flat, gentle intonation.',
  },
  /* ---------- 関東 ---------- */
  {
    id: 'ibaraki', name: '茨城弁', region: '関東', beta: true, defaultPreset: 'm-old',
    sampleText: 'そうだっぺ？ ごじゃっぺ言うでねぇよ。',
    convertHint: '語尾「〜だっぺ」「〜だっぺよ」「〜べ」「〜け？（〜かい？）」「〜さ（〜へ）」「〜でねぇ（〜ではない）」、「ごじゃっぺ（いいかげん）」「いじやける（腹が立つ）」「でれすけ（だらしない人）」「こわい（疲れた）」「ぶっこく（投げる）」「おっぺす（押す）」。抑揚が少なく平らに話す。',
    voiceDesignPrompt: 'born and raised in rural Ibaraki, speaking Japanese with a flat, accentless Ibaraki (northern Kanto) intonation and a blunt but good-natured tone.',
  },
  {
    id: 'edokko', name: '江戸っ子（べらんめえ）', region: '関東', defaultPreset: 'm-old',
    sampleText: 'てやんでえ、べらぼうめ！ ちゃっちゃとしやがれ。',
    convertHint: '東京下町の威勢のいい話し言葉。「ない→ねえ」「たいへん→てえへん」「うまい→うめえ」のように「あい・おい」を「えー」にする、「ひ」を「し」にする（ひとつ→しとつ、ひがし→しがし）。「てやんでえ」「べらぼうめ」「〜しやがれ」「おいら」「あたぼうよ（当たり前だ）」「こちとら」「おめえさん」「ちげえねえ（違いない）」「〜ってんだ」「粋」。早口で歯切れよく。',
    voiceDesignPrompt: 'born and raised in shitamachi, old downtown Tokyo, speaking Japanese in brisk, rough Edokko (Beranmee) style, with rapid delivery and punchy, spirited intonation.',
  },
  {
    id: 'standard', name: '標準語', region: '関東', standard: true, defaultPreset: 'f-young',
    sampleText: 'ありがとうございます。とても助かりました。',
    convertHint: '',
    voiceDesignPrompt: 'speaking clear, standard Tokyo Japanese with a neutral accent and natural, friendly intonation.',
  },
  /* ---------- 中部 ---------- */
  {
    id: 'nagoya', name: '名古屋弁', region: '中部', defaultPreset: 'm-young',
    sampleText: 'でらうまいがや。はよ食べやあ。',
    convertHint: '語尾「〜だがや」「〜だがね」「〜でよ」「〜がや」「〜やあ（勧め・軽い命令：はよしやあ）」「〜してまった（〜してしまった）」「〜しとる」、「でら／どえりゃあ（とても）」「えらい（疲れた）」「かんわ（だめだ）」「たわけ」「ときんときん（とがっている）」。「〜ない」は「〜にゃあ」になりやすい。',
    voiceDesignPrompt: 'born and raised in Nagoya, speaking Japanese with a distinctive Nagoya (Owari) accent, drawn-out vowels and a cheerful, down-to-earth tone.',
  },
  {
    id: 'kanazawa', name: '金沢弁', region: '中部', beta: true, defaultPreset: 'f-old',
    sampleText: 'あんやと。ゆっくりしていきまっし。',
    convertHint: '語尾「〜まっし（〜しなさい：食べまっし）」「〜やじ（〜だよ）」「〜げん（〜のだ）」「〜がや」「〜ねんて」「〜しとる」、「あんやと（ありがとう）」「きのどくな（恐縮です・ありがとう）」「だらぶち（ばか）」「ちゃべちゃべ（おしゃべり）」「かたがる（傾く）」。語尾をゆったりのばし、うねるように話す。',
    voiceDesignPrompt: 'born and raised in Kanazawa, Ishikawa, speaking Japanese with a soft Kanazawa (Hokuriku) accent, gently undulating intonation and elegant, drawn-out sentence endings.',
  },
  /* ---------- 近畿 ---------- */
  {
    id: 'kyoto', name: '京都弁', region: '近畿', defaultPreset: 'f-young',
    sampleText: 'おおきに。またおこしやす。',
    convertHint: '語尾「〜どす」「〜え」「〜はる（敬語）」「〜しとくれやす」「〜へん（否定）」「〜やろか」「〜よし（〜しなさい：食べよし）」、「おおきに」「おこしやす」「かんにん（ごめん）」「はんなり」「いけず（意地悪）」「ほかす（捨てる）」。大阪弁よりやわらかく上品で、ゆったり話す。',
    voiceDesignPrompt: 'born and raised in Kyoto, speaking Japanese with a soft, elegant Kyoto accent, gentle and graceful intonation at a slow, refined pace.',
  },
  {
    id: 'osaka', name: '大阪弁', region: '近畿', defaultPreset: 'f-young',
    sampleText: 'ほんまおおきに。めっちゃ助かったわ。',
    convertHint: '語尾「〜や」「〜やん」「〜やで」「〜やねん」「〜へん（否定）」「〜はる（軽い敬語）」「〜してもうた」、「めっちゃ」「ほんま」「あかん」「せや」「おおきに」「なんぼ」「しんどい」「かまへん」。テンポよく、ツッコミやノリのある話し言葉。',
    voiceDesignPrompt: 'born and raised in Osaka, speaking Japanese with a natural, lively Osaka (Kansai) accent and a friendly, humorous rhythm.',
  },
  {
    id: 'kobe', name: '神戸弁', region: '近畿', defaultPreset: 'f-young',
    sampleText: '何しとう？ 今日めっちゃええ天気やん。',
    convertHint: '語尾「〜とう（〜している：何しとう？）」「〜とった」「〜よう（〜している：雨降りよう）」「〜やん」「〜へん」「〜しい（〜しなさい）」、「めっちゃ」「ほんま」「べっちょない（大丈夫）」「だぼ（ばか）」。大阪弁より少しやわらかく、「〜とう」「〜よう」で神戸らしさを出す。',
    voiceDesignPrompt: 'born and raised in Kobe, Hyogo, speaking Japanese with a light, urban Kobe (Kansai) accent, casual and breezy, a little softer than Osaka speech.',
  },
  /* ---------- 中国 ---------- */
  {
    id: 'hiroshima', name: '広島弁', region: '中国', defaultPreset: 'm-young',
    sampleText: 'ぶちうまいけぇ、食べてみんさい。',
    convertHint: '語尾「〜じゃけぇ（〜だから）」「〜じゃ」「〜けぇ」「〜しんさい（〜しなさい）」「〜しょーる（〜している最中）」「〜しとる（〜してある）」「〜のう」「〜ん？（〜の？）」、「ぶち（とても）」「たいぎい（面倒）」「はぶてる（すねる）」「いなげな（変な）」「みやすい（簡単）」「たう（届く）」。',
    voiceDesignPrompt: 'born and raised in Hiroshima, speaking Japanese with a hearty Hiroshima (Chugoku) accent, strong and straightforward, with a warm, rough-edged tone.',
  },
  {
    id: 'okayama', name: '岡山弁', region: '中国', defaultPreset: 'f-old',
    sampleText: 'でーれーうめえが。はよ来られぇ。',
    convertHint: '語尾「〜じゃ」「〜が（〜だよ）」「〜けぇ（〜だから）」「〜られぇ（〜しなさい：来られぇ）」「〜んじゃ」「〜しょーる（〜している）」、「でーれー／ぼっけー（とても）」「もんげー（すごい）」「おえん（だめだ）」「きょーてー（怖い）」。「すごい→すげー」「うまい→うめえ」のように母音をのばす。',
    voiceDesignPrompt: 'born and raised in Okayama, speaking Japanese with a broad Okayama (Chugoku) accent, drawn-out vowels and an easygoing, friendly tone.',
  },
  /* ---------- 四国 ---------- */
  {
    id: 'tosa', name: '土佐弁', region: '四国', defaultPreset: 'm-young',
    sampleText: 'まっこと、えいがやき。',
    convertHint: '語尾「〜ぜよ」「〜がや（〜なのだ）」「〜やき／〜きに（〜だから）」「〜ゆう（〜している：言いゆう）」「〜ちゅう（〜してある：しちゅう）」「〜ろう（〜だろう）」「〜いかん」、「まっこと（本当に）」「こじゃんと（とても・たくさん）」「えい（よい）」「たまるか（驚き）」「のうが悪い（具合が悪い）」。力強く豪快に。',
    voiceDesignPrompt: 'born and raised in Kochi (Tosa), speaking Japanese with a bold Tosa (Shikoku) accent, confident and hearty, with a big, open-hearted delivery.',
  },
  {
    id: 'iyo', name: '伊予弁', region: '四国', beta: true, defaultPreset: 'f-old',
    sampleText: 'ほうじゃけん、がんばろや。',
    convertHint: '語尾「〜けん（〜だから）」「〜ぞな」「〜もし（ていねい：〜ですよ）」「〜なもし」「〜とる」「〜んよ」「〜ろや（〜しよう）」「〜しよる（〜している）」、「ほうじゃ（そうだ）」「ほやけん（だから）」「いなげな（変な）」「〜しとうみ（〜してごらん）」。のんびり、やわらかく話す。',
    voiceDesignPrompt: 'born and raised in Matsuyama, Ehime, speaking Japanese with a mellow Iyo (Ehime) accent, slow and gentle, with a laid-back, kindly tone.',
  },
  /* ---------- 九州 ---------- */
  {
    id: 'hakata', name: '博多弁', region: '九州', defaultPreset: 'f-young',
    sampleText: 'なんしよーと？ 今日はばり寒かね。',
    convertHint: '語尾「〜と？（〜の？）」「〜ちゃん」「〜けん（〜だから）」「〜ばい」「〜たい」「〜やけん」「〜しとー（〜している）」「〜ちゃ」、「ばり（とても）」「よか（よい）」「なんしよーと（何してるの）」「好いとーよ」「〜してみらん？（〜してみない？）」。形容詞は「寒か」「よか」のように「〜か」になることがある。',
    voiceDesignPrompt: 'born and raised in Hakata, Fukuoka, speaking Japanese with a warm Hakata (northern Kyushu) accent and soft, affectionate intonation.',
  },
  {
    id: 'nagasaki', name: '長崎弁', region: '九州', beta: true, defaultPreset: 'f-young',
    sampleText: 'よかよか。ばってん、雨の降りよるけん気をつけんばよ。',
    convertHint: '語尾「〜ばい」「〜さ」「〜けん（〜だから）」「〜と？（〜の？）」「〜んば（〜しなければ：せんば）」「〜よる（〜している）」「〜ごたる（〜のようだ）」、「ばってん（でも）」「よか（よい）」「ばさらか（とても）」「こがん（こんな）」「あがん（あんな）」「さるく（ぶらぶら歩く）」「うっちゃる（捨てる）」。主語に「の」を使う（雨の降りよる）。',
    voiceDesignPrompt: 'born and raised in Nagasaki, speaking Japanese with a warm Nagasaki (western Kyushu) accent, a rolling rhythm and relaxed, harbor-town friendliness.',
  },
  {
    id: 'kumamoto', name: '熊本弁', region: '九州', defaultPreset: 'm-young',
    sampleText: 'むしゃんよか！ はよ食べなっせ。',
    convertHint: '語尾「〜ばい」「〜たい」「〜けん（〜だから）」「〜と？（〜の？）」「〜なっせ（〜しなさい：食べなっせ）」「〜ごたる（〜のようだ）」「〜しよる（〜している）」、「ばってん（でも）」「むしゃんよか（かっこいい）」「あとぜき（開けたら閉める）」「がまだす（がんばる）」「好いとっと」。形容詞は「寒か」「よか」のように「〜か」になる。',
    voiceDesignPrompt: 'born and raised in Kumamoto, speaking Japanese with a strong Kumamoto (central Kyushu) accent, hearty and direct, with a steady, grounded tone.',
  },
  {
    id: 'kagoshima', name: '鹿児島弁', region: '九州', beta: true, defaultPreset: 'm-old',
    sampleText: 'おやっとさぁ。まこて、よか天気じゃっど。',
    convertHint: '語尾「〜じゃっど（〜だよ）」「〜ごわす（〜です：古風）」「〜が（〜のだ）」「〜け？（〜か？）」「〜しやんせ（〜してください）」「〜しちょっ（〜している）」、「おやっとさぁ（お疲れさま）」「まこて（本当に）」「わっぜ（とても）」「てげてげ（ほどほど）」「だれやめ（晩酌）」「げんねか（恥ずかしい）」。語末の音がつまる（行く→いっ）。本格的な鹿児島弁は聞き取りにくいので、意味が追える程度にとどめる。',
    voiceDesignPrompt: 'born and raised in Kagoshima, speaking Japanese with a strong Kagoshima (Satsuma, southern Kyushu) accent, clipped word endings and a proud, sturdy tone.',
  },
  /* ---------- 沖縄 ---------- */
  {
    id: 'okinawa', name: 'ウチナーヤマトグチ', region: '沖縄', beta: true, defaultPreset: 'f-old',
    sampleText: 'なんくるないさ〜。ゆっくりしていってね〜。',
    convertHint: '沖縄の人が話す日本語（ウチナーヤマトグチ）。本格的な琉球語（ウチナーグチ）にはしない。語尾「〜さ」「〜さぁ」「〜ね〜」「〜よ〜」「〜はず（〜だろう）」「〜してからに」、「なんくるないさ（なんとかなる）」「でーじ（とても）」「ちばりよー（がんばれ）」「めんそーれ（いらっしゃい）」「あきさみよー（驚き・あきれ）」「〜ですよね〜」。語尾がのびやかで、やわらかい。',
    voiceDesignPrompt: 'born and raised in Okinawa, speaking Japanese with a gentle Okinawan accent (Uchinaa-Yamatoguchi), a relaxed island rhythm and warm, easygoing intonation.',
  },
];N.dialect = id => N.DIALECTS.find(d => d.id === id) || null;

/* voice presets (option A: a designed voice per dialect x preset, created on first use) */
N.VOICE_PRESETS = [
  { id: 'f-young', label: '女性・若め', persona: 'A young woman in her 20s,', gender: 'female', fallback: 'Leda' },
  { id: 'f-old', label: '女性・年配', persona: 'A woman in her 60s,', gender: 'female', fallback: 'Gacrux' },
  { id: 'm-young', label: '男性・若め', persona: 'A young man in his 20s,', gender: 'male', fallback: 'Puck' },
  { id: 'm-old', label: '男性・年配', persona: 'A man in his 60s,', gender: 'male', fallback: 'Algenib' },
];
N.voicePreset = (id, dialect) => N.VOICE_PRESETS.find(p => p.id === (id === 'auto' && dialect ? dialect.defaultPreset : id)) || N.VOICE_PRESETS[0];
N.voiceDesignText = (dialect, preset) => `${preset.persona} ${dialect.voiceDesignPrompt}`;
N.voiceDisplayName = (dialect, preset, model) => `NAMARI ${dialect.id} ${preset.id} ${/lite/.test(model) ? 'lite' : 'flash'}`;
N.voiceCacheKey = (dialect, preset, model) => `${dialect.id}:${preset.id}:${model}`;

/* emotion presets -> speech_metadata.style (emotion / tempo / volume only, never accent) */
N.EMOTIONS = [
  { id: 'none', label: 'なし（おすすめ）', style: '' },
  { id: 'cheerful', label: '明るく', style: 'cheerful and friendly' },
  { id: 'energetic', label: '元気に', style: 'energetic and excited' },
  { id: 'calm', label: '落ち着いて', style: 'calm and relaxed' },
  { id: 'slow', label: 'ゆっくり', style: 'speaking slowly' },
  { id: 'whisper', label: 'ささやき', style: 'whispering' },
  { id: 'sad', label: 'しんみり', style: 'sad and quiet' },
];

/* inline tag buttons (tags stay in English even inside Japanese text) */
N.TAG_BUTTONS = [
  { tag: '<laugh>', label: '笑い' },
  { tag: '<sigh>', label: 'ため息' },
  { tag: '<short pause>', label: '間' },
  { tag: '<breath>', label: '息' },
];
})();
