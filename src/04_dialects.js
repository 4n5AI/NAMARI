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
  {
    id: 'tsugaru', name: '津軽弁', region: '東北', beta: true, defaultPreset: 'm-old',
    sampleText: 'わいは！ めやぐだの。',
    convertHint: '語尾「〜だべ」「〜じゃ」「〜の」「〜はんで（〜だから）」「〜へ（〜しなさい）」、一人称「わ」、二人称「な」、「めやぐ（すまない・ありがとう）」「わいは（驚き）」「どさ（どこへ）」「け（食べて）」「なんも（いいえ・どういたしまして）」。短い言葉が多く、濁音が多い。強くしても、文字で読んで意味が追える程度にとどめる。',
    voiceDesignPrompt: 'born and raised in the Tsugaru region of Aomori, speaking Japanese with a strong rural Tsugaru (northern Tohoku) accent, soft voiced consonants and a slow, warm rhythm.',
  },
  {
    id: 'standard', name: '標準語', region: '関東', standard: true, defaultPreset: 'f-young',
    sampleText: 'ありがとうございます。とても助かりました。',
    convertHint: '',
    voiceDesignPrompt: 'speaking clear, standard Tokyo Japanese with a neutral accent and natural, friendly intonation.',
  },
  {
    id: 'nagoya', name: '名古屋弁', region: '中部', defaultPreset: 'm-young',
    sampleText: 'でらうまいがや。はよ食べやあ。',
    convertHint: '語尾「〜だがや」「〜だがね」「〜でよ」「〜がや」「〜やあ（勧め・軽い命令：はよしやあ）」「〜してまった（〜してしまった）」「〜しとる」、「でら／どえりゃあ（とても）」「えらい（疲れた）」「かんわ（だめだ）」「たわけ」「ときんときん（とがっている）」。「〜ない」は「〜にゃあ」になりやすい。',
    voiceDesignPrompt: 'born and raised in Nagoya, speaking Japanese with a distinctive Nagoya (Owari) accent, drawn-out vowels and a cheerful, down-to-earth tone.',
  },
  {
    id: 'osaka', name: '大阪弁', region: '近畿', defaultPreset: 'f-young',
    sampleText: 'ほんまおおきに。めっちゃ助かったわ。',
    convertHint: '語尾「〜や」「〜やん」「〜やで」「〜やねん」「〜へん（否定）」「〜はる（軽い敬語）」「〜してもうた」、「めっちゃ」「ほんま」「あかん」「せや」「おおきに」「なんぼ」「しんどい」「かまへん」。テンポよく、ツッコミやノリのある話し言葉。',
    voiceDesignPrompt: 'born and raised in Osaka, speaking Japanese with a natural, lively Osaka (Kansai) accent and a friendly, humorous rhythm.',
  },
  {
    id: 'hakata', name: '博多弁', region: '九州', defaultPreset: 'f-young',
    sampleText: 'なんしよーと？ 今日はばり寒かね。',
    convertHint: '語尾「〜と？（〜の？）」「〜ちゃん」「〜けん（〜だから）」「〜ばい」「〜たい」「〜やけん」「〜しとー（〜している）」「〜ちゃ」、「ばり（とても）」「よか（よい）」「なんしよーと（何してるの）」「好いとーよ」「〜してみらん？（〜してみない？）」。形容詞は「寒か」「よか」のように「〜か」になることがある。',
    voiceDesignPrompt: 'born and raised in Hakata, Fukuoka, speaking Japanese with a warm Hakata (northern Kyushu) accent and soft, affectionate intonation.',
  },
  {
    id: 'okinawa', name: 'ウチナーヤマトグチ', region: '沖縄', beta: true, defaultPreset: 'f-old',
    sampleText: 'なんくるないさ〜。ゆっくりしていってね〜。',
    convertHint: '沖縄の人が話す日本語（ウチナーヤマトグチ）。本格的な琉球語（ウチナーグチ）にはしない。語尾「〜さ」「〜さぁ」「〜ね〜」「〜よ〜」「〜はず（〜だろう）」「〜してからに」、「なんくるないさ（なんとかなる）」「でーじ（とても）」「ちばりよー（がんばれ）」「めんそーれ（いらっしゃい）」「あきさみよー（驚き・あきれ）」「〜ですよね〜」。語尾がのびやかで、やわらかい。',
    voiceDesignPrompt: 'born and raised in Okinawa, speaking Japanese with a gentle Okinawan accent (Uchinaa-Yamatoguchi), a relaxed island rhythm and warm, easygoing intonation.',
  },
];
N.dialect = id => N.DIALECTS.find(d => d.id === id) || null;

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
