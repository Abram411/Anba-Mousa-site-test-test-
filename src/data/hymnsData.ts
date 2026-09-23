/**
 * Coptic Hymns School (مدرسة الألحان القبطية) Dataset
 * Includes Coptic text, Coptic-Arabized pronunciation, Arabic translation, Hazat guidance, audio references.
 */

export interface HymnLyricLine {
  id: number;
  coptic: string;
  arabized: string;
  arabic: string;
  hazatNotes?: string;
  startTimeSec?: number;
}

export interface CopticHymnItem {
  id: string;
  titleAr: string;
  titleEn: string;
  titleCoptic: string;
  seasonAr: string;
  seasonEn: string;
  occasionTag: 'annual' | 'kiahk' | 'lent' | 'pascha' | 'resurrection' | 'st_mary';
  difficulty: 'easy' | 'medium' | 'advanced';
  audioUrl: string;
  durationSec: number;
  hazatExplanationAr: string;
  hazatExplanationEn: string;
  lines: HymnLyricLine[];
}

export const COPTIC_HYMNS_COLLECTION: CopticHymnItem[] = [
  {
    id: 'ep_oro',
    titleAr: 'لحن إبؤورو (يا ملك السلام)',
    titleEn: 'Ep-Oro (O King of Peace)',
    titleCoptic: 'Ⲉⲡⲟⲩⲣⲟ ⲛ̀ⲧⲉ ϯϩⲓⲣⲏⲛⲏ',
    seasonAr: 'طقس سنوي وفرايحي وخاتمة التسبحة والصلوات',
    seasonEn: 'Annual & Festive / Conclusion of Praises',
    occasionTag: 'annual',
    difficulty: 'easy',
    audioUrl: 'https://archive.org/download/CopticHymnsCollection/Eporo_Annual.mp3',
    durationSec: 135,
    hazatExplanationAr: 'لحن شجي مريح بهزات ثلاثية هادئة (٣ هزات ناعمة على كلمة Ⲉⲡⲟⲩⲣⲟ ومقطع ⲙⲟⲓ ⲛⲁⲛ). يُرتل في ختام الصلوات لطلب السلام.',
    hazatExplanationEn: 'A comforting, melodic hymn with gentle 3-beat rhythm pauses on "Ep-Oro" and "Moi Nan" asking the King of Peace for tranquility.',
    lines: [
      {
        id: 1,
        coptic: 'Ⲉⲡⲟⲩⲣⲟ ⲛ̀ⲧⲉ ϯϩⲓⲣⲏⲛⲏ: ⲙⲟⲓ ⲛⲁⲛ ⲛ̀ⲧⲉⲕϩⲓⲣⲏⲛⲏ: ⲥⲉⲙⲛⲓ ⲛⲁⲛ ⲛ̀ⲧⲉⲕϩⲓⲣⲏⲛⲏ: ⲭⲁ ⲛⲉⲛⲛⲟⲃⲓ ⲛⲁⲛ ⲉ̀ⲃⲟⲗ.',
        arabized: 'إبـؤورو إنتي تي هيريني: موي نان إنتيـك هيريني: سيمني نان إنتيـك هيريني: خـا نين نوفي نان إيفول.',
        arabic: 'يا ملك السلام، أعطنا سلامك، قرر لنا سلامك، واغفر لنا خطايانا.',
        hazatNotes: '٣ هزات متدرجة مع مد الصوت في إبـؤووورو',
        startTimeSec: 0
      },
      {
        id: 2,
        coptic: 'Ϫⲱⲣ ⲉ̀ⲃⲟⲗ ⲛ̀ⲛⲓϫⲁϫⲓ: ⲛ̀ⲧⲉ ϯⲈⲕⲕⲗⲏⲥⲓⲁ: ⲁ̀ⲣⲓⲥⲟⲃⲧ ⲉ̀ⲣⲟⲥ: ⲛ̀ⲛⲉⲥⲕⲓⲙ ϣⲁ ⲉ̀ⲛⲉϩ.',
        arabized: 'جور إيفول إن ني جاجي: إنتي تي إككليسيا: أري سوفت إيروس: إن نيس كيم شا إينيه.',
        arabic: 'فرق أعداء الكنيسة، وحصنها لكي لا تتزعزع إلى الأبد.',
        hazatNotes: 'وقفة هادئة عند نهاية إككليسيا',
        startTimeSec: 35
      },
      {
        id: 3,
        coptic: 'Ⲡⲓⲭ̀ⲣⲓⲥⲧⲟⲥ Ⲡⲉⲛⲛⲟⲩϯ: ⲁϥⲙⲟⲩ ϧⲁⲣⲟⲛ: ϧⲉⲛ ⲡⲉϥⲟⲩⲱϣ ⲙ̀ⲙⲓⲛ ⲙ̀ⲙⲟϥ: ⲁϥⲥⲱϯ ⲙ̀ⲙⲟⲛ.',
        arabized: 'بي خرستوس بين نوتي: إفمو خارون: خين بيف أوش إممين إمموف: إفسوتي إممون.',
        arabic: 'المسيح إلهنا مات عنا، بإرادته ومسرته، وفدانا.',
        hazatNotes: 'تأكيد بالنغمة على إفسوتي إممون (وفدانا)',
        startTimeSec: 70
      },
      {
        id: 4,
        coptic: 'Ⲙⲁⲣⲉⲛϩⲱⲥ ⲉ̀ⲣⲟϥ: ⲙⲁⲣⲉⲛϭⲓⲥⲓ ⲙ̀ⲡⲉϥⲣⲁⲛ: ϫⲉ ⲟⲩⲁ̀ⲅⲁⲑⲟⲥ ⲡⲉ: ⲟⲩⲟϩ ⲙ̀ⲙⲁⲓⲣⲱⲙⲓ.',
        arabized: 'مارين هوس إيروف: مارين تشيسي إمبيف ران: جي أو أغاثوس بي: أووه إمماي رومي.',
        arabic: 'فلنسبحه ونرفع اسمه، لأنه صالح ومحب للبشر.',
        hazatNotes: 'نغمة ختامية هادئة مع انخفاض النغمة',
        startTimeSec: 105
      }
    ]
  },
  {
    id: 'agios',
    titleAr: 'لحن أجيوس الثلاث تقديسات (قدوس الله)',
    titleEn: 'Agios (The Thrice-Holy Hymn)',
    titleCoptic: 'Ⲁ̀ⲅⲓⲟⲥ ⲟ̀ Ⲑⲉⲟⲥ',
    seasonAr: 'يُصلى في كل قداس إلهي قبل قراءة الإنجيل المقدس',
    seasonEn: 'Every Divine Liturgy before Gospel',
    occasionTag: 'annual',
    difficulty: 'easy',
    audioUrl: 'https://archive.org/download/CopticHymnsCollection/Agios_Annual.mp3',
    durationSec: 120,
    hazatExplanationAr: 'لحن خاشع مقدس يُعلن لاهوت وتجسد وفداء ربنا يسوع المسيح. في كل ربع هزتان خشوعيتان مع إحناء الرأس.',
    hazatExplanationEn: 'Solemn hymn proclaiming Christ divinity, incarnation, crucifixion, and resurrection. Sung with deep reverence.',
    lines: [
      {
        id: 1,
        coptic: 'Ⲁ̀ⲅⲓⲟⲥ ⲟ̀ Ⲑⲉⲟⲥ: Ⲁ̀ⲅⲓⲟⲥ Ⲓⲥⲭⲩⲣⲟⲥ: Ⲁ̀ⲅⲓⲟⲥ Ⲁ̀ⲑⲁⲛⲁⲧⲟⲥ: ⲟ̀ ⲉⲕ ⲡⲁⲣⲑⲉⲛⲟⲩ ⲅⲉⲛⲛⲏⲑⲓⲥ: ⲉ̀ⲗⲉⲏ̀ⲥⲟⲛ ⲏ̀ⲙⲁⲥ.',
        arabized: 'أجيوس أو ثيئوس: أجيوس إسشيروس: أجيوس أثاناتوس: أو إك بارثينو جينيثيس: إليسون إيماس.',
        arabic: 'قدوس الله، قدوس القوي، قدوس الذي لا يموت، الذي ولد من العذراء، ارحمنا.',
        hazatNotes: 'هزة مد عند "إليسون إيماس"',
        startTimeSec: 0
      },
      {
        id: 2,
        coptic: 'Ⲁ̀ⲅⲓⲟⲥ ⲟ̀ Ⲑⲉⲟⲥ: Ⲁ̀ⲅⲓⲟⲥ Ⲓⲥⲭⲩⲣⲟⲥ: Ⲁ̀ⲅⲓⲟⲥ Ⲁ̀ⲑⲁⲛⲁⲧⲟⲥ: ⲟ̀ ⲥⲧⲁⲩⲣⲱⲑⲓⲥ ⲇⲓ ⲏ̀ⲙⲁⲥ: ⲉ̀ⲗⲉⲏ̀ⲥⲟⲛ ⲏ̀ⲙⲁⲥ.',
        arabized: 'أجيوس أو ثيئوس: أجيوس إسشيروس: أجيوس أثاناتوس: أو ستافروثيس دي إيماس: إليسون إيماس.',
        arabic: 'قدوس الله، قدوس القوي، قدوس الذي لا يموت، الذي صُلب عنا، ارحمنا.',
        hazatNotes: 'رشم الصليب وإحناء الرأس عند "ستافروثيس دي إيماس"',
        startTimeSec: 40
      },
      {
        id: 3,
        coptic: 'Ⲁ̀ⲅⲓⲟⲥ ⲟ̀ Ⲑⲉⲟⲥ: Ⲁ̀ⲅⲓⲟⲥ Ⲓⲥⲭⲩⲣⲟⲥ: Ⲁ̀ⲅⲓⲟⲥ Ⲁ̀ⲑⲁⲛⲁⲧⲟⲥ: ⲟ̀ ⲁ̀ⲛⲁⲥⲧⲁⲥ ⲉⲕ ⲧⲱⲛ ⲛⲉⲕⲣⲱⲛ: ⲕⲉ ⲁ̀ⲛⲉⲗⲑⲱⲛ ⲓⲥ ⲧⲟⲩⲥ ⲟⲩⲣⲁⲛⲟⲩⲥ: ⲉ̀ⲗⲉⲏ̀ⲥⲟⲛ ⲏ̀ⲙⲁⲥ.',
        arabized: 'أجيوس أو ثيئوس: أجيوس إسشيروس: أجيوس أثاناتوس: أو أناستاس إك تون نيكرون: كيه أنيلثون إيس توس أورانوس: إليسون إيماس.',
        arabic: 'قدوس الله، قدوس القوي، قدوس الذي لا يموت، الذي قام من بين الأموات وصعد إلى السموات، ارحمنا.',
        hazatNotes: 'نغمة تصاعدية متهللة بالقيامة والصعود',
        startTimeSec: 80
      }
    ]
  },
  {
    id: 'teno_oosht',
    titleAr: 'لحن تين أو أووشت (فلنسجد للآب والابن)',
    titleEn: 'Teno-Oosht (Let Us Worship)',
    titleCoptic: 'Ⲧⲉⲛⲟⲩⲱϣⲧ ⲙ̀Ⲫⲓⲱⲧ ⲛⲉⲙ Ⲡϣⲏⲣⲓ',
    seasonAr: 'مقدمة التسبحة الكنسية وقداس المؤمنين',
    seasonEn: 'Introduction of Praises',
    occasionTag: 'annual',
    difficulty: 'easy',
    audioUrl: 'https://archive.org/download/CopticHymnsCollection/Teno-oosht.mp3',
    durationSec: 90,
    hazatExplanationAr: 'لحن سجود وتسبيح للثالوث القدوس. هزات انسيابية رقيقة.',
    hazatExplanationEn: 'Reverent prostration hymn honoring the Holy Trinity.',
    lines: [
      {
        id: 1,
        coptic: 'Ⲧⲉⲛⲟⲩⲱϣⲧ ⲙ̀Ⲫⲓⲱⲧ ⲛⲉⲙ Ⲡϣⲏⲣⲓ: ⲛⲉⲙ Ⲡⲓⲡ̀ⲛⲉⲩⲙⲁ Ⲉⲑⲟⲩⲁⲃ: ⲭⲉⲣⲉ ϯⲈⲕⲕⲗⲏⲥⲓⲁ: ⲡ̀ⲏⲓ ⲛ̀ⲧⲉ ⲛⲓⲁⲅⲅⲉⲗⲟⲥ.',
        arabized: 'تين أو أوشت إمفيوت نيم بشيري: نيم بي بنيفما إثؤواب: شيري تي إككليسيا: بي إي إنتي ني أنجيلوس.',
        arabic: 'نسجد للآب والابن والروح القدس، السلام للكنيسة بيت الملائكة.',
        hazatNotes: 'مد رخيم في تين أوووو أوشت',
        startTimeSec: 0
      },
      {
        id: 2,
        coptic: 'Ⲭⲉⲣⲉ ϯⲠⲁⲣⲑⲉⲛⲟⲥ: ⲉ̀ⲧⲁⲥⲙⲓⲥⲓ ⲙ̀Ⲡⲉⲛⲥⲱⲧⲏⲣ: ⲭⲉⲣⲉ Ⲙⲓⲭⲁⲏⲗ: ⲡⲓⲁⲣⲭⲏⲁⲅⲅⲉⲗⲟⲥ.',
        arabized: 'شيري تي بارثينوس: إي تاس ميسي إمبين سوتير: شيري ميخائيل: بي أرشي أنجيلوس.',
        arabic: 'السلام للعذراء التي ولدت مخلصنا، السلام لميخائيل رئيس الملائكة.',
        hazatNotes: 'توقف ناعم عند ختام كل اسم',
        startTimeSec: 45
      }
    ]
  },
  {
    id: 'hos_erof',
    titleAr: 'الهوس الثالث (هوس إيروف - سبحوه وزيدوه علواً)',
    titleEn: 'Hos Erof (Third Canticle)',
    titleCoptic: 'Ϩⲱⲥ ⲉ̀ⲣⲟϥ ⲁ̀ⲣⲓϩⲟⲩⲟ̀ ϭⲁⲥϥ',
    seasonAr: 'تسبحة نصف الليل الكيهكية والسنوية (تسبحة الثلاثة فتية القديسين)',
    seasonEn: 'Midnight Praises (Three Holy Youths)',
    occasionTag: 'kiahk',
    difficulty: 'medium',
    audioUrl: 'https://archive.org/download/CopticHymnsCollection/Hos_Erof_Third_Canticle.mp3',
    durationSec: 180,
    hazatExplanationAr: 'تسبحة الفتية الثلاثة في أتون النار. إيقاع بهيج بالدف والمثلث يملأ الروح حماساً وفرحاً.',
    hazatExplanationEn: 'Praise of the Three Saintly Youths in the fiery furnace with joyous cymbals and triangle.',
    lines: [
      {
        id: 1,
        coptic: 'Ϩⲱⲥ ⲉ̀ⲣⲟϥ ⲁ̀ⲣⲓϩⲟⲩⲟ̀ ϭⲁⲥϥ: ⲉ̀ⲛⲓⲉ̀ⲛⲉϩ: ⲁ̀ⲣⲓϩⲟⲩⲟ̀ ϭⲁⲥϥ ϣⲁ ⲛⲓⲉ̀ⲛⲉϩ.',
        arabized: 'هوس إيروف أري هو أو تشاسف: إينيه نيه: أري هو أو تشاسف شا ني إينيه.',
        arabic: 'سبحوه وزيدوه علواً إلى الآباد، زيدوه رفعة إلى كل الدهور.',
        hazatNotes: 'إيقاع ثنائي نشيط مع ضرب الدف والمثلث',
        startTimeSec: 0
      },
      {
        id: 2,
        coptic: 'Ϩⲱⲥ ⲉ̀Ⲡϭⲟⲓⲥ ⲛⲓϩⲃⲏⲟⲩⲓ̀ ⲧⲏⲣⲟⲩ ⲛ̀ⲧⲉ Ⲡϭⲟⲓⲥ: Ϩⲱⲥ ⲉ̀ⲣⲟϥ ⲁ̀ⲣⲓϩⲟⲩⲟ̀ ϭⲁⲥϥ ϣⲁ ⲛⲓⲉ̀ⲛⲉϩ.',
        arabized: 'هوس إيبشويس ني هفيؤوي تيرو إنتي إبشويس: هوس إيروف أري هو أو تشاسف شا ني إينيه.',
        arabic: 'سبحوا الرب يا جميع أعمال الرب، سبحوه وزيدوه علواً إلى الآباد.',
        hazatNotes: 'مرد جماعي مبهج لكل ربع',
        startTimeSec: 45
      }
    ]
  },
  {
    id: 'pek_thronos',
    titleAr: 'لحن بيك إثرونوس (كرسيك يا الله إلى دهر الدهور)',
    titleEn: 'Pek-Thronos (Your Throne, O God)',
    titleCoptic: 'Ⲡⲉⲕⲑ̀ⲣⲟⲛⲟⲥ Ⲫϯ ϣⲁ ⲉ̀ⲛⲉϩ ⲛ̀ⲧⲉ ⲡⲓⲉ̀ⲛⲉϩ',
    seasonAr: 'الجمعة العظيمة المقدسة (الساعة الثانية عشرة من يوم الجمعة العظيمة)',
    seasonEn: 'Good Friday (12th Hour)',
    occasionTag: 'pascha',
    difficulty: 'advanced',
    audioUrl: 'https://archive.org/download/CopticHymnsCollection/Pek_Thronos.mp3',
    durationSec: 210,
    hazatExplanationAr: 'من أروع وأطول ألحان الكنيسة القبطية على الإطلاق بالنغمة الحزايني المؤثرة. يعلن ملوكية المسيح حتى وهو على الصليب.',
    hazatExplanationEn: 'One of the deepest masterworks of Coptic hymnology chanted on Good Friday, declaring the eternal Kingship of Christ.',
    lines: [
      {
        id: 1,
        coptic: 'Ⲡⲉⲕⲑ̀ⲣⲟⲛⲟⲥ Ⲫϯ: ϣⲁ ⲉ̀ⲛⲉϩ ⲛ̀ⲧⲉ ⲡⲓⲉ̀ⲛⲉϩ: ⲡⲓϣ̀ⲃⲱⲧ ⲛ̀ⲧⲉ ⲡⲉⲕⲙⲉⲑⲙⲏⲓ.',
        arabized: 'بيك إثرونوس إفنوتي: شا إينيه إنتي بي إينيه: بي إشفوت إنتي بيك ميثمي.',
        arabic: 'كرسيك يا الله إلى دهر الدهور، قضيب الاستقامة هو قضيب ملكك.',
        hazatNotes: 'هزات بطيئة خاشعة تتصاعد بنغمة الآلام المهيبة',
        startTimeSec: 0
      }
    ]
  }
];
