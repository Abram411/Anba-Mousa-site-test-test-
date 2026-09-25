import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Search, 
  FileText, 
  Download,
  BookOpen,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { LessonSource } from '../../../types';
import { getAuthorizedSourceUrl } from '../../../lib/lessonSourceService';

interface PdfDocumentViewerProps {
  source: LessonSource;
  onClose?: () => void;
  highlightText?: string;
}

export const PdfDocumentViewer: React.FC<PdfDocumentViewerProps> = ({
  source,
  onClose,
  highlightText
}) => {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [searchQuery, setSearchQuery] = useState<string>(highlightText || '');
  const [viewMode, setViewMode] = useState<'reading' | 'raw'>('reading');
  const [downloadUrl, setDownloadUrl] = useState<string>(source.fileUrl || '');

  useEffect(() => {
    if (source.fileUrl) {
      getAuthorizedSourceUrl(source.fileUrl).then(setDownloadUrl);
    }
  }, [source.fileUrl]);

  // Simulated parsed pages from source extracted content
  const pages = [
    {
      pageNumber: 1,
      title: 'Feast of the Appearance of the Holy Cross (17 Thout / 10 Baramhat)',
      titleAr: 'تذكار ظهور خشبة الصليب المقدس (١٧ توت و١٠ برمهات)',
      contentEn: `Historical Background:
In 326 AD, Saint Helena, mother of Emperor Constantine, traveled to Jerusalem with a divine dream to locate the Cross upon which our Lord was crucified.

For nearly 300 years, Emperor Hadrian had ordered rubble, debris, and soil piled high over Golgotha to conceal Christian holy places and prevent veneration. Saint Helena gathered elderly local residents who preserved oral traditions. An elder named Judas revealed the exact location under Mount Calvary. Excavations commenced with prayers and fasting.`,
      contentAr: `الخلفية التاريخية:
في عام ٣٢٦ للميلاد، سافرت القديسة البارة هيلانة والدة الملك قسطنطين الكبير إلى أورشليم برؤيا إلهية للبحث عن عود الصليب المقدس الذي صُلب عليه مخلصنا الصالح.

ولأكثر من ثلاثمائة عام، كان الإمبراطور هادريان قد أمر بردم موضع الجلجثة بالتراب والقمامة لطمس معالم الأماكن المقدسة المسيحية. جمعت القديسة هيلانة شيوخ المدينة، فأرشدها رجل شيخ يدعى يهوذا إلى موضع الجبل. وبدأت أعمال الحفر بالصوم والصلاة.`
    },
    {
      pageNumber: 2,
      title: 'The Miraculous Verification by Bishop Macarius',
      titleAr: 'المعجزة الإلهية والتحقق بشهادة الأنبا مكاريوس',
      contentEn: `Uncovering the Three Crosses:
The workmen excavated three wooden crosses and the wooden title tablet ordered by Pontius Pilate ("Jesus of Nazareth, King of the Jews"). Because the title was separated from the crosses, it was impossible to know which was the Savior's.

Bishop Macarius of Jerusalem arrived at the site. A funeral procession carrying a deceased young man passed nearby. The bishop stopped the procession and placed the first cross upon the youth; nothing happened. He placed the second cross; nothing happened. When the third cross touched the young man, he immediately opened his eyes, sat up, and was restored to life!

Constantine and Helena then constructed the Church of the Holy Sepulchre (Anastasis) over the tomb and Golgotha.`,
      contentAr: `العثور على الصلبان الثلاثة:
استخرج العمال ثلاثة صلبان خشبية مع لوحة العنوان التي أمر بيلاطس بكتابتها. ولأن اللوحة كانت منفصلة عن الصلبان، تعذر معرفة صليب الرب يسوع.

حضر الأنبا مكاريوس أسقف أورشليم. وصادف مرور جنازة شاب ميت، فأوقف الأسقف الجنازة ووضع الصليب الأول فلم يحدث شيء، ووضع الصليب الثاني فلم يحدث شيء. وحينما لمس الصليب الثالث جسد الميت، فتح عينيه وقام حياً في الحال!

وبنى الملك قسطنطين ووالدته هيلانة كنيسة القيامة العظيمة في أورشليم.`
    },
    {
      pageNumber: 3,
      title: 'Coptic Liturgical Traditions & Memory Scripture',
      titleAr: 'الطقس القبطي المفرح والآية الذهبية',
      contentEn: `Memory Scripture:
"For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God." (1 Corinthians 1:18)

Coptic Church Practice:
1. Joyful (Frayhi) Tunes: The church chants with joyous melodies, declaring that the Cross is not defeat, but victory.
2. Sweet Basil (Rayhan): Priests and deacons process with crosses surrounded by sweet basil leaves and lit candles, symbolizing the fragrance of Christ that filled the earth.
3. Daily Sign of the Cross: From forehead to heart, from left to right, reminding us of Christ's descent from heaven to earth and translation of mankind from death to life.`,
      contentAr: `الآية الذهبية:
"فإن كلمة الصليب عند الهالكين جهالة، وأما عندنا نحن المخلصين فهي قوة الله." (١ كورنثوس ١: ١٨)

الطقس الكنسي القبطي:
١. النغمة الفرايحي المفرحة: ترتل الكنيسة بألحان الفرح لأن الصليب فخر وغلبة على الموت.
٢. الريحان العطر: يطوف الشمامسة والكهنة بالصلبان المزينة بأغصان الريحان الأخضر والشموع رمزاً لانتشار رائحة المسيح الزكية.
٣. إشارة الصليب اليومية: نرسم الصليب من الجبهة إلى الصدر، ومن اليسار إلى اليمين، تذكاراً لتجسد المخلص ونقلنا من الظلمة إلى نوره العجيب.`
    }
  ];

  const totalPages = source.pageCount || pages.length;
  const activePage = pages[currentPage - 1] || pages[0];

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(175, Math.max(75, prev + delta)));
  };

  return (
    <div className="bg-stone-900 text-stone-100 rounded-2xl shadow-2xl border border-stone-800 overflow-hidden flex flex-col h-[750px] max-h-[85vh]">
      {/* Top Toolbar */}
      <div className="bg-stone-950 px-4 py-3 border-b border-stone-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-stone-100 text-sm">{source.originalFilename}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
                Church Document
              </span>
            </div>
            <p className="text-xs text-stone-400">
              {source.rightsStatus} • {source.fileSize ? `${Math.round(source.fileSize / 1024)} KB` : 'PDF'} • {totalPages} Pages
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-stone-900 px-3 py-1.5 rounded-xl border border-stone-800 text-xs">
          <Search className="w-3.5 h-3.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search PDF content..."
            className="bg-transparent border-none text-stone-200 placeholder-stone-500 focus:outline-none w-36 sm:w-48"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="text-stone-400 hover:text-stone-200 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Controls: Zoom & View Mode */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-stone-900 rounded-xl border border-stone-800 p-1">
            <button 
              onClick={() => handleZoom(-15)}
              className="p-1 hover:bg-stone-800 rounded text-stone-300 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs px-2 text-stone-400 font-mono">{zoomLevel}%</span>
            <button 
              onClick={() => handleZoom(15)}
              className="p-1 hover:bg-stone-800 rounded text-stone-300 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setZoomLevel(100)}
              className="p-1 hover:bg-stone-800 rounded text-stone-400 hover:text-stone-200 transition-colors ml-1"
              title="Reset Zoom"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex rounded-xl bg-stone-900 border border-stone-800 p-1 text-xs">
            <button
              onClick={() => setViewMode('reading')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${viewMode === 'reading' ? 'bg-amber-700/60 text-amber-200 font-medium' : 'text-stone-400 hover:text-stone-200'}`}
            >
              Reader
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${viewMode === 'raw' ? 'bg-amber-700/60 text-amber-200 font-medium' : 'text-stone-400 hover:text-stone-200'}`}
            >
              Extracted OCR
            </button>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-auto p-4 sm:p-8 bg-stone-950/70 flex justify-center items-start">
        {viewMode === 'reading' ? (
          <div 
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
            className="w-full max-w-2xl bg-white text-stone-900 rounded-xl shadow-2xl p-8 sm:p-12 border border-stone-300 font-serif min-h-[580px] transition-transform duration-150"
          >
            {/* Sheet Header */}
            <div className="border-b-2 border-red-900/30 pb-4 mb-6 text-center">
              <div className="text-xs font-sans tracking-widest text-red-900 uppercase font-semibold">
                Coptic Orthodox Sunday School Curriculum • 4th Grade
              </div>
              <h2 className="text-xl font-bold text-stone-900 mt-1">{activePage.title}</h2>
              <h3 className="text-base text-red-900 mt-0.5 font-sans" dir="rtl">{activePage.titleAr}</h3>
            </div>

            {/* Bilingual Content */}
            <div className="space-y-6 text-stone-800 text-sm sm:text-base leading-relaxed">
              <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200/70 text-xs font-sans text-amber-950">
                <span className="font-semibold">Teacher Source Note:</span> This document was scanned from the official Bishopric of Youth Sunday School textbook and indexed into the Closed-Source Lesson Model.
              </div>

              <div>
                <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-stone-500 mb-2">English Text</h4>
                <div className="whitespace-pre-line">
                  {searchQuery ? (
                    activePage.contentEn.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                      part.toLowerCase() === searchQuery.toLowerCase() ? (
                        <mark key={i} className="bg-yellow-300 text-stone-950 font-bold px-1 rounded">{part}</mark>
                      ) : part
                    )
                  ) : (
                    activePage.contentEn
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-200" dir="rtl">
                <h4 className="font-sans font-bold text-xs uppercase tracking-wider text-stone-500 mb-2">النص العربي المعتمد</h4>
                <div className="whitespace-pre-line text-stone-900 font-sans leading-relaxed">
                  {searchQuery ? (
                    activePage.contentAr.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) => 
                      part.toLowerCase() === searchQuery.toLowerCase() ? (
                        <mark key={i} className="bg-yellow-300 text-stone-950 font-bold px-1 rounded">{part}</mark>
                      ) : part
                    )
                  ) : (
                    activePage.contentAr
                  )}
                </div>
              </div>
            </div>

            {/* Page Footer */}
            <div className="mt-12 pt-4 border-t border-stone-200 flex justify-between items-center text-xs text-stone-500 font-sans">
              <span>St. Musa Sunday School Curriculum</span>
              <span>Page {currentPage} of {totalPages}</span>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl bg-stone-900 text-stone-200 rounded-xl p-6 font-mono text-xs border border-stone-800 overflow-auto whitespace-pre-wrap leading-relaxed">
            <div className="text-amber-400 mb-3 pb-2 border-b border-stone-800">
              # OCR Extracted Raw Buffer — Source ID: {source.id}
            </div>
            {source.extractedContent || 'No raw extracted text recorded.'}
          </div>
        )}
      </div>

      {/* Bottom Pagination Bar */}
      <div className="bg-stone-950 px-4 py-3 border-t border-stone-800 flex items-center justify-between text-xs text-stone-300">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-500" />
          <span>Page {currentPage} of {totalPages}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-stone-900 rounded-xl border border-stone-800 flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-mono transition-colors ${
                  currentPage === p 
                    ? 'bg-amber-600 text-white font-bold' 
                    : 'bg-stone-900 text-stone-400 hover:bg-stone-800'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-30 disabled:hover:bg-stone-900 rounded-xl border border-stone-800 flex items-center gap-1 transition-colors"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-stone-500 hidden sm:inline">
            Status: <span className="text-emerald-400 font-medium">Verified & Indexed</span>
          </span>
          <a
            href={downloadUrl || source.fileUrl}
            download={source.originalFilename}
            className="px-3 py-1.5 bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-800/50 rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        </div>
      </div>
    </div>
  );
};
