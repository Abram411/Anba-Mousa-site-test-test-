import { TerminologyGlossaryItem } from '../types';

/**
 * Shared Coptic Orthodox Ecclesiastical and Liturgical Terminology Glossary
 * Single source of truth for theological, sacramental, and liturgical terms.
 */
export const COPTIC_GLOSSARY: TerminologyGlossaryItem[] = [
  {
    termId: 'church',
    concept: 'The Church / Sacred Assembly',
    english: 'Church',
    arabic: 'الكنيسة',
    coptic: 'Ϯⲉⲕⲕⲗⲏⲥⲓⲁ',
    copticSource: 'Coptic Divine Liturgy (Liturgy of St. Basil)',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ϯⲉⲕⲕⲗⲏⲥⲓⲁ',
    notes: 'Standard ecclesiastical Bohairic term used in all liturgical texts.'
  },
  {
    termId: 'sunday_school',
    concept: 'Sunday School / Church Education',
    english: 'Sunday School',
    arabic: 'مدارس الأحد',
    coptic: 'Ⲛⲓⲥⲃⲱ ⲛ̀ⲧⲉ ϯⲕⲩⲣⲓⲁⲕⲏ',
    copticSource: 'Coptic Orthodox Patriarchate Sunday School Curriculum',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲛⲓⲥⲃⲱ ⲛ̀ⲧⲉ ϯⲕⲩⲣⲓⲁⲕⲏ',
    notes: 'Established ecclesiastical term for Sunday Christian education.'
  },
  {
    termId: 'hymn',
    concept: 'Church Hymn / Sacred Chant',
    english: 'Hymn',
    arabic: 'لحن كنسي',
    coptic: 'Ⲡⲓϩⲱⲥ',
    copticSource: 'Coptic Psalmodia (Tasbeha)',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲡⲓϩⲱⲥ',
    notes: 'Plural: Ⲛⲓϩⲱⲥ (Hymns). From the root ϩⲱⲥ (to praise/sing).'
  },
  {
    termId: 'prayer',
    concept: 'Prayer / Supplication',
    english: 'Prayer',
    arabic: 'صلاة',
    coptic: 'Ϯⲉⲩⲭⲏ',
    copticSource: 'Coptic Euchologion (Khoolagy)',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ϯⲉⲩⲭⲏ',
    notes: 'Also Ⲡⲓϣⲗⲏⲗ. Ϯⲉⲩⲭⲏ is the liturgical form.'
  },
  {
    termId: 'agpeya',
    concept: 'The Book of the Seven Canonical Hours',
    english: 'Agpeya',
    arabic: 'الأجبية (كتاب السبع صلوات)',
    coptic: 'Ϯⲁϫⲡⲓⲁ',
    copticSource: 'Coptic Horologion (Agpeya)',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ϯⲁϫⲡⲓⲁ',
    notes: 'From ⲁϫⲡ (hour). The canonical prayer book of the Coptic Church.'
  },
  {
    termId: 'synaxarium',
    concept: 'Lives and Commemorations of Saints and Feasts',
    english: 'Synaxarium',
    arabic: 'السنكسار القبطي',
    coptic: 'Ⲡⲓⲥⲩⲛⲁⲝⲁⲣⲓⲟⲛ',
    copticSource: 'Coptic Synaxarion',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲡⲓⲥⲩⲛⲁⲝⲁⲣⲓⲟⲛ',
    notes: 'Daily commemorative ecclesiastical calendar.'
  },
  {
    termId: 'liturgy',
    concept: 'The Holy Divine Liturgy / Eucharist',
    english: 'Liturgy',
    arabic: 'القداس الإلهي',
    coptic: 'Ϯⲗⲓⲧⲟⲩⲣⲅⲓⲁ',
    copticSource: 'Coptic Euchologion',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ϯⲗⲓⲧⲟⲩⲣⲅⲓⲁ',
    notes: 'Also ϯⲁⲛⲁⲫⲟⲣⲁ (The Anaphora).'
  },
  {
    termId: 'psalm',
    concept: 'Holy Scripture Psalm of David',
    english: 'Psalm',
    arabic: 'مزمور',
    coptic: 'Ⲡⲓⲯⲁⲗⲙⲟⲥ',
    copticSource: 'Bohairic Coptic Psalter',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲡⲓⲯⲁⲗⲙⲟⲥ',
    notes: 'Plural: Ⲛⲓⲯⲁⲗⲙⲟⲥ.'
  },
  {
    termId: 'gospel',
    concept: 'The Holy Gospel of Jesus Christ',
    english: 'Holy Gospel',
    arabic: 'الإنجيل المقدس',
    coptic: 'Ⲡⲓⲉⲩⲁⲅⲅⲉⲗⲓⲟⲛ ⲉⲑⲟⲩⲁⲃ',
    copticSource: 'Coptic Katameros & New Testament',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲡⲓⲉⲩⲁⲅⲅⲉⲗⲓⲟⲛ ⲉⲑⲟⲩⲁⲃ',
    notes: 'Standard liturgical introduction in every service.'
  },
  {
    termId: 'listen',
    concept: 'To listen to audio / sacred recitation',
    english: 'Listen',
    arabic: 'استمع',
    coptic: 'Ⲥⲱⲧⲉⲙ',
    copticSource: 'Bohairic Coptic Gospel & Liturgy',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲥⲱⲧⲉⲙ',
    forbiddenAlternatives: ['ⲛⲁⲩ', 'ⲥⲁϫⲓ'],
    notes: 'Imperative form in Bohairic Coptic. Consistent across audio player and lessons.'
  },
  {
    termId: 'read',
    concept: 'To read liturgical or biblical text',
    english: 'Read',
    arabic: 'اقرأ',
    coptic: 'Ⲱϣ',
    copticSource: 'Bohairic Coptic Katameros',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲱϣ',
    notes: 'Imperative/infinitive: ⲱϣ (to read, recite, announce).'
  },
  {
    termId: 'pray',
    concept: 'To pray / offer prayers',
    english: 'Pray',
    arabic: 'صلِّ',
    coptic: 'Ⲧⲱⲃϩ',
    copticSource: 'Liturgy Deacon Response',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲧⲱⲃϩ',
    notes: 'Liturgical response: Ⲧⲱⲃϩ ⲉ̀ϩⲣⲏⲓ (Pray for...).'
  },
  {
    termId: 'peace',
    concept: 'Ecclesiastical Peace / Grace',
    english: 'Peace',
    arabic: 'سلام',
    coptic: 'Ϯϩⲓⲣⲏⲛⲏ',
    copticSource: 'Coptic Liturgy Priest Blessing',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ϯϩⲓⲣⲏⲛⲏ',
    notes: 'Priestly blessing: Ⲓⲣⲏⲛⲏ ⲡⲁⲥⲓ (Peace be with all).'
  },
  {
    termId: 'amen',
    concept: 'Amen / Verily so',
    english: 'Amen',
    arabic: 'آمين',
    coptic: 'Ⲁⲙⲏⲛ',
    copticSource: 'Coptic Liturgical Responses',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲁⲙⲏⲛ',
    notes: 'Universal Coptic Orthodox response.'
  },
  {
    termId: 'alleluia',
    concept: 'Praise the Lord',
    english: 'Alleluia',
    arabic: 'هلليلويا',
    coptic: 'Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ',
    copticSource: 'Coptic Psalmodia & Hymnology',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲁⲗⲗⲏⲗⲟⲩⲓⲁ',
    notes: 'Ecclesiastical doxological chant.'
  },
  {
    termId: 'servant',
    concept: 'Church Sunday School Servant / Deacon',
    english: 'Servant',
    arabic: 'خادم كنسي',
    coptic: 'Ⲡⲓⲇⲓⲁⲕⲟⲛⲟⲥ',
    copticSource: 'Coptic Church Ecclesiastical Orders',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲡⲓⲇⲓⲁⲕⲟⲛⲟⲥ',
    notes: 'Also Ⲡⲓⲣⲉϥϣⲉⲙϣⲓ for general minister/servant.'
  },
  {
    termId: 'student',
    concept: 'Student / Disciple in Sunday School',
    english: 'Student',
    arabic: 'تلميذ',
    coptic: 'Ⲡⲓⲙⲁⲑⲏⲧⲏⲥ',
    copticSource: 'Coptic Orthodox Tradition',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲡⲓⲙⲁⲑⲏⲧⲏⲥ',
    notes: 'From Greek/Coptic ecclesiastical heritage.'
  },
  {
    termId: 'family',
    concept: 'Christian Family / Household',
    english: 'Family',
    arabic: 'الأسرة',
    coptic: 'Ⲡⲓⲏⲓ',
    copticSource: 'Coptic Orthodox Pastoral Guidance',
    reviewStatus: 'APPROVED',
    preferredTerm: 'Ⲡⲓⲏⲓ',
    notes: 'Literally "the House/Household" in liturgical texts; also Ⲛⲓⲓⲟϯ for parents.'
  }
];
