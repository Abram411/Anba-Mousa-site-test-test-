/**
 * Weekly Family Altar Prompts (مذبح العائلة الأسبوعي)
 * Designed for Christian households to gather once a week, read scripture, discuss, and pray together.
 */

export interface FamilyAltarPrompt {
  id: string;
  weekNumber: number;
  themeAr: string;
  themeEn: string;
  titleAr: string;
  titleEn: string;
  scriptureRefAr: string;
  scriptureRefEn: string;
  scriptureTextAr: string;
  scriptureTextEn: string;
  discussionQuestionsAr: string[];
  discussionQuestionsEn: string[];
  prayerAr: string;
  prayerEn: string;
  practicalActionAr: string;
  practicalActionEn: string;
}

export const WEEKLY_FAMILY_ALTAR_PROMPTS: FamilyAltarPrompt[] = [
  {
    id: 'altar_w1',
    weekNumber: 1,
    themeAr: 'المحبة والتسامح داخل بيتنا',
    themeEn: 'Love & Forgiveness in Our Home',
    titleAr: '«أَحِبُّوا بَعْضُكُمْ بَعْضًا» - بركة البيت المحب',
    titleEn: '"Love One Another" - The Blessing of a Loving Home',
    scriptureRefAr: 'رسالة يوحنا الأولى ٤: ٧-١٢',
    scriptureRefEn: '1 John 4:7-12',
    scriptureTextAr: '«أَيُّهَا الأَحِبَّاءُ، لِنُحِبَّ بَعْضُنَا بَعْضًا، لأَنَّ الْمَحَبَّةَ هِيَ مِنَ اللهِ، وَكُلُّ مَنْ يُحِبُّ فَقَدْ وُلِدَ مِنَ اللهِ وَيَعْرِفُ اللهَ.»',
    scriptureTextEn: '"Beloved, let us love one another, for love is of God; and everyone who loves is born of God and knows God."',
    discussionQuestionsAr: [
      'ما هو الموقف هذا الأسبوع الذي شعر فيه أحدنا بالمحبة والدفء في بيتنا؟',
      'هل هناك زعل أو سوء تفاهم نحتاج أن نتسامح فيه ونقول لبعضنا: "حقك عليّ"؟',
      'كيف يمكننا كعائلة أن نساعد جاراً أو قريباً محتاجاً هذا الأسبوع؟'
    ],
    discussionQuestionsEn: [
      'What was a moment this week when you felt truly loved and supported at home?',
      'Is there any unspoken hurt or disagreement we can forgive right now with a warm hug?',
      'How can our family reach out to help a neighbor or relative in need this week?'
    ],
    prayerAr: 'يا رب يسوع، اجعل بيتنا كنيسة صغيرة، يملأه سلامك ومحبتك. بارك بابا وماما وإخوتي، واطرد من بيتنا كل خصام أو غضب، واجعلنا نراك في وجوه بعضنا البعض كل يوم. آمين.',
    prayerEn: 'Lord Jesus, make our home a little church filled with Your peace and love. Bless our parents and siblings, cast away all anger or strife, and help us see Your face in each other every day. Amen.',
    practicalActionAr: 'يصنع كل فرد في العائلة كوب شاي أو يقدم خدمة بسيطة للآخر بمحبة ودون أن يُطلب منه.',
    practicalActionEn: 'Each family member surprises another with a small act of kindness or chore without being asked.'
  },
  {
    id: 'altar_w2',
    weekNumber: 2,
    themeAr: 'شكر الله في كل الظروف',
    themeEn: 'Giving Thanks in All Circumstances',
    titleAr: '«اشْكُرُوا فِي كُلِّ شَيْءٍ» - قوة صلاة الشكر',
    titleEn: '"In Everything Give Thanks" - The Power of Gratitude',
    scriptureRefAr: 'رسالة تسالونيكي الأولى ٥: ١٦-١٨',
    scriptureRefEn: '1 Thessalonians 5:16-18',
    scriptureTextAr: '«افْرَحُوا كُلَّ حِينٍ. صَلُّوا بِلاَ انْقِطَاعٍ. اشْكُرُوا فِي كُلِّ شَيْءٍ، لأَنَّ هذِهِ هِيَ مَشِيئَةُ اللهِ فِي الْمَسِيحِ يَسُوعَ مِنْ جِهَتِكُمْ.»',
    scriptureTextEn: '"Rejoice always, pray without ceasing, in everything give thanks; for this is the will of God in Christ Jesus for you."',
    discussionQuestionsAr: [
      'ما هي ٣ نعم من عند ربنا نعتبرها عادية ولكنها هدايا عظيمة (الصحة، السقف، الأكل، المحبة)؟',
      'عندما نمر بيوم صعب في المدرسة أو العمل، كيف يساعدنا شكر ربنا على استعادة السلام؟',
      'ما هو أكثر شيء تشكر الله عليه في أفراد عائلتك اليوم؟'
    ],
    discussionQuestionsEn: [
      'What are 3 blessings from God we often take for granted that are actually huge gifts?',
      'When having a tough day at work or school, how does thanking God restore our inner peace?',
      'What is one specific quality you thank God for in each member of our family today?'
    ],
    prayerAr: 'نشكرك يا رب على كل حال ومن أجل كل حال وفي كل حال. نشكرك على سترك ومعونتك، وعلى الخبز والماء والمأوى. علمنا أن نرى يدك الحانية في كل تفاصيل يومنا ونعيش فرحانين بك دائماً. آمين.',
    prayerEn: 'We thank You, Lord, for everything, concerning everything, and in everything. Thank You for Your shelter, help, bread, and warmth. Teach us to see Your tender hand in daily life and rejoice in You. Amen.',
    practicalActionAr: 'نكتب بطاقة شكر صغيرة لكل فرد في البيت ونضعها بجانب وسادته قبل النوم.',
    practicalActionEn: 'Write a small sticky note thanking someone in the house and leave it by their pillow.'
  },
  {
    id: 'altar_w3',
    weekNumber: 3,
    themeAr: 'الصدق والأمانة',
    themeEn: 'Honesty & Faithfulness',
    titleAr: '«كُونُوا أُمَنَاءَ» - النور الذي يضيء أمام الناس',
    titleEn: '"Be Faithful" - The Light that Shines Before Others',
    scriptureRefAr: 'إنجيل متى ٥: ١٤-١٦',
    scriptureRefEn: 'Matthew 5:14-16',
    scriptureTextAr: '«أَنْتُمْ نُورُ الْعَالَمِ. لاَ يُمْكِنُ أَنْ تُخْفَى مَدِينَةٌ مَوْضُوعَةٌ عَلَى جَبَلٍ... فَلْيُضِئْ نُورُكُمْ هكَذَا قُدَّامَ النَّاسِ.»',
    scriptureTextEn: '"You are the light of the world. A city that is set on a hill cannot be hidden... Let your light so shine before men."',
    discussionQuestionsAr: [
      'لماذا الصدق مهم حتى لو كان الاعتراف بالحقيقة صعباً أحياناً؟',
      'كيف نكون شهوداً حقيقيين للرب يسوع بين زملائنا في المدرسة والشغل دون خجل؟',
      'ما هو القرار الذي سنتخذه هذا الأسبوع لنكون أكثر أمانة في وقتنا وصلواتنا ومذاكرتنا؟'
    ],
    discussionQuestionsEn: [
      'Why is speaking truth so crucial, even when admitting a mistake feels intimidating?',
      'How can we be authentic witnesses for Christ among our school or work peers without shame?',
      'What is one commitment we can make this week to be faithful stewards of our study and prayer time?'
    ],
    prayerAr: 'أيها الرب الصادق الأمين، اجعلنا نوراً حقيقياً في عالمنا. احفظ شفاهنا من الكذب، وأعيننا من النظر الباطل، وقلوبنا من الخداع. اجعل كلامنا دائماً بالنعمة مصلحاً بملح الإنجيل. آمين.',
    prayerEn: 'O Faithful and True Lord, make us true lights in our world. Guard our lips from deceit, our eyes from vanity, and our hearts from pride. May our words always be seasoned with Gospel salt. Amen.',
    practicalActionAr: 'أن نصلي معاً من أجل شخص في ضيقة أو مريض نعرفه بالاسم قبل النوم.',
    practicalActionEn: 'Dedicate 2 minutes of bedtime prayer for a specific sick friend or relative by name.'
  }
];

export function getCurrentWeekFamilyAltar(): FamilyAltarPrompt {
  // Rotate weekly prompts deterministically based on week number of the year
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const pastDaysOfYear = (now.getTime() - startOfYear.getTime()) / 86400000;
  const weekIndex = Math.floor(pastDaysOfYear / 7) % WEEKLY_FAMILY_ALTAR_PROMPTS.length;
  return WEEKLY_FAMILY_ALTAR_PROMPTS[weekIndex];
}
