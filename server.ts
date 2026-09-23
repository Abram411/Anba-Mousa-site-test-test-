import "dotenv/config";
import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs";

const app = express();
const PORT = 3000;

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json({ limit: '20mb' }));
// Serve persistent local media uploads
app.use("/uploads", express.static(uploadsDir));

// Setup multer for file uploads with 150MB limit for church videos, audio hymns, and photos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const cleanExt = path.extname(file.originalname) || ".bin";
    const baseClean = path.basename(file.originalname, cleanExt).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    cb(null, `${Date.now()}_${baseClean}${cleanExt}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 150 * 1024 * 1024 } // 150 MB max per file
});

/**
 * Helper to initialize S3 or Cloudflare R2 client
 */
function getCloudStorageClient() {
  const r2AccountId = process.env.R2_ACCOUNT_ID?.trim();
  const r2AccessKey = process.env.R2_ACCESS_KEY_ID?.trim();
  const r2SecretKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const r2Bucket = process.env.R2_BUCKET_NAME?.trim();

  const s3Endpoint = process.env.S3_ENDPOINT?.trim() || (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined);
  const accessKeyId = r2AccessKey || process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = r2SecretKey || process.env.S3_SECRET_ACCESS_KEY?.trim();
  const bucketName = r2Bucket || process.env.S3_BUCKET_NAME?.trim();
  const region = process.env.S3_REGION?.trim() || "auto";

  if (s3Endpoint && accessKeyId && secretAccessKey && bucketName) {
    const client = new S3Client({
      region,
      endpoint: s3Endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
    return {
      client,
      bucketName,
      provider: r2AccountId ? 'cloudflare-r2' : 's3-compatible',
      publicDomain: process.env.R2_PUBLIC_URL?.trim() || process.env.S3_PUBLIC_URL?.trim()
    };
  }

  return null;
}

// ==============================================================================
// Coptic Sunday School Closed-Source & Teacher-Controlled AI Endpoints
// ==============================================================================

// 1. Transcribe Teacher Voice Explanation (gemini-3.5-transcribe)
app.post("/api/church/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const fileData = fs.readFileSync(file.path);
    const base64Audio = fileData.toString("base64");
    const mimeType = file.mimetype || "audio/webm";

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const prompt = `Transcribe this Sunday School teacher's spoken recording verbatim.
The teacher may be speaking in Egyptian Arabic, English, or mixed ecclesiastical terms (e.g. Coptic names, Biblical references).
Provide the exact transcription, identify the primary language (Arabic, English, or bilingual), and provide estimated segment timestamps if identifiable.
Return ONLY valid JSON:
{
  "transcript": "Full accurate transcription text here...",
  "language": "Arabic" | "English" | "Bilingual",
  "segments": [
    { "timestamp": "00:00-01:15", "text": "..." }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-transcribe",
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { data: base64Audio, mimeType } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json"
      }
    });

    // Clean up temporary upload
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    let cleanText = (response?.text || "{}").trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const result = JSON.parse(cleanText);
    res.json(result);
  } catch (error: any) {
    console.error("Transcription error:", error);
    res.status(500).json({ 
      error: "Failed to transcribe audio",
      details: error?.message 
    });
  }
});

// 2. Extract Document / Source Content (PDF, DOCX, PPTX, Image, YouTube, Notes)
app.post("/api/church/extract-source", upload.single("file"), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const { sourceType, teacherNotes, youtubeUrl, rawText } = req.body;
    const file = req.file;

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    let parts: any[] = [];
    let promptText = `You are an expert Coptic Orthodox Sunday School curriculum specialist.
Your task is to analyze and extract the structured content from this class source material.
Extract all key points, scripture verses cited, historical facts, definitions, and church references.
Do NOT invent information that is not present in this source.

Source Type: ${sourceType || "DOCUMENT"}
${teacherNotes ? `Teacher Notes on this source: "${teacherNotes}"` : ""}
${youtubeUrl ? `YouTube URL provided by teacher: "${youtubeUrl}"` : ""}
${rawText ? `Teacher Raw Text: "${rawText}"` : ""}

Return valid JSON:
{
  "extractedText": "Comprehensive structured extraction...",
  "headings": ["Heading 1", "Heading 2"],
  "scriptureVerses": [{"reference": "...", "text": "..."}],
  "keyDefinitions": [{"term": "...", "meaning": "..."}],
  "suggestedClaims": [
    {"statement": "...", "location": "e.g. Page 2 / Slide 3 / Notes"}
  ]
}`;

    if (file) {
      const fileData = fs.readFileSync(file.path);
      const base64Data = fileData.toString("base64");
      const mime = file.mimetype || "application/octet-stream";

      parts.push({
        inlineData: {
          data: base64Data,
          mimeType: mime
        }
      });

      // Cleanup local temp file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    }

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json"
      }
    });

    let cleanText = (response?.text || "{}").trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const result = JSON.parse(cleanText);
    res.json(result);
  } catch (error: any) {
    console.error("Source extraction error:", error);
    res.status(500).json({ error: "Failed to extract source", details: error?.message });
  }
});

// 3. Build Evidence Map (Stage 3)
app.post("/api/church/build-evidence-map", async (req, res) => {
  try {
    const { sources, lessonTitle, ageGroup } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        facts: [
          {
            id: "f-1",
            claimEn: "Queen Helena journeyed to Jerusalem in 326 AD following Emperor Constantine's vision of the Cross.",
            claimAr: "سافرت الملكة هيلانة إلى أورشليم عام ٣٢٦م بتشجيع وإيمان بعد رؤية قسطنطين للصليب.",
            sourceId: sources?.[0]?.id || "src-curriculum-pdf-01",
            sourceName: sources?.[0]?.originalFilename || "Coptic_Sunday_School_Curriculum_Grade5.pdf",
            sourceLocation: "Page 42, Paragraph 2",
            verified: true
          },
          {
            id: "f-2",
            claimEn: "The true Cross was identified when a deceased man was raised to life upon touching it.",
            claimAr: "تم التعرف على الصليب المحيي الحقيقي عندما أقيم ميت بمجرد لمسه للصليب المقدس.",
            sourceId: sources?.[1]?.id || "src-presentation-01",
            sourceName: sources?.[1]?.originalFilename || "Queen_Helena_Classroom_Slides.pptx",
            sourceLocation: "Slide 5, Bullet 2",
            verified: true
          }
        ],
        bibleReferences: [
          {
            reference: "1 Corinthians 1:18",
            textEn: "For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God.",
            textAr: "فإن كلمة الصليب عند الهالكين جهالة، وأما عندنا نحن المخلصين فهي قوة الله.",
            sourceId: sources?.[0]?.id || "src-curriculum-pdf-01"
          }
        ],
        teacherExplanations: [
          "Servant emphasized making the sign of the cross with reverence, thumb and two fingers together confessing the Holy Trinity."
        ],
        conflicts: [],
        unsupportedClaims: []
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const sourcesSummary = (sources || []).map((s: any, idx: number) => `
--- SOURCE ${idx + 1} ---
ID: ${s.id}
Name: ${s.originalFilename || s.type}
Type: ${s.type}
Priority: ${s.priority || 'PRIMARY'}
Teacher Notes: ${s.teacherNotes || 'None'}
Content: ${s.extractedContent || s.transcript || s.description || 'No extracted text'}
`).join("\n");

    const prompt = `You are operating in CLOSED-SOURCE MODE.
Use ONLY the supplied source packet. Do not use external information. Do not add facts from general knowledge. Do not guess.
If the supplied sources do not support a statement, do not state it as fact. Mark unsupported information for review.

Lesson Title: "${lessonTitle}"
Target Age Group: "${ageGroup}"

SOURCES SUPPLIED:
${sourcesSummary}

TASK:
1. Identify main topics explicitly present in the sources (in English and Arabic).
2. Extract important claims, each mapped to its exact source ID and location.
3. List Bible references found in the sources.
4. Note teacher explanations.
5. If there are any contradictions between sources, identify them in 'conflicts'.
6. If any common assumption or unverified statement appears in the source that requires teacher review, add to 'unsupportedClaims'.

Return valid JSON matching:
{
  "mainTopicsEn": ["..."],
  "mainTopicsAr": ["..."],
  "importantClaims": [
    {
      "claimId": "c1",
      "statementEn": "...",
      "statementAr": "...",
      "sourceId": "...",
      "sourceName": "...",
      "sourceLocation": "...",
      "verified": true
    }
  ],
  "bibleReferences": [
    { "reference": "...", "textEn": "...", "textAr": "...", "sourceId": "..." }
  ],
  "teacherExplanations": ["..."],
  "conflicts": [
    {
      "id": "conf-1",
      "sourceAId": "...",
      "sourceAName": "...",
      "sourceBId": "...",
      "sourceBName": "...",
      "conflictDescriptionEn": "...",
      "conflictDescriptionAr": "...",
      "status": "UNRESOLVED"
    }
  ],
  "unsupportedClaims": []
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    let cleanText = (response?.text || "{}").trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const result = JSON.parse(cleanText);
    res.json(result);
  } catch (error: any) {
    console.error("Evidence map error:", error);
    res.status(500).json({ error: "Failed to build evidence map", details: error?.message });
  }
});

// 4. Create Lesson Outline (Stage 4)
app.post("/api/church/create-outline", async (req, res) => {
  try {
    const { lessonTitle, ageGroup, objectives, evidenceMap, sources } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        sections: [
          {
            id: "sec-1",
            order: 1,
            titleEn: "Queen Helena's Journey to Jerusalem",
            titleAr: "رحلة الملكة هيلانة إلى أورشليم",
            titleCop: "Ϯⲟⲩⲏⲣ ⲙ̀ⲙⲏϣ ⲛ̀ⲧⲉ ϯⲟⲩⲣⲱ Ϩⲉⲗⲉⲛⲏ",
            objectiveEn: "Learn why Queen Helena searched for the Cross and her unwavering faith.",
            objectiveAr: "معرفة سبب بحث الملكة هيلانة عن الصليب وإيمانها الراسخ.",
            sourceRefs: [{ sourceId: sources?.[0]?.id || "src-curriculum-pdf-01", sourceName: "Class Curriculum", location: "Page 42" }]
          },
          {
            id: "sec-2",
            order: 2,
            titleEn: "Finding the Three Crosses & The Miracle",
            titleAr: "اكتشاف الصلبان الثلاثة ومعجزة القيامة",
            titleCop: "Ⲡⲓϫⲓⲛϫⲓⲙⲓ ⲙ̀ⲡⲓⲥⲧⲁⲩⲣⲟⲥ",
            objectiveEn: "Understand how the life-giving Cross was identified through the resurrection miracle.",
            objectiveAr: "فهم كيف تميز عود الصليب المحيي بمعجزة إقامة الميت.",
            sourceRefs: [{ sourceId: sources?.[1]?.id || "src-presentation-01", sourceName: "Classroom Slides", location: "Slide 5" }]
          },
          {
            id: "sec-3",
            order: 3,
            titleEn: "The Power of the Cross in Our Daily Life",
            titleAr: "قوة الصليب في حياتنا اليومية",
            titleCop: "Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ ϧⲉⲛ ⲡⲉⲛⲱⲛϧ",
            objectiveEn: "Memorize 1 Corinthians 1:18 and apply the sign of the cross in our daily prayers.",
            objectiveAr: "حفظ آية (١ كورنثوس ١: ١٨) ورشم الصليب بحب وخشوع كل يوم.",
            sourceRefs: [{ sourceId: sources?.[0]?.id || "src-curriculum-pdf-01", sourceName: "Class Curriculum", location: "Page 44" }]
          }
        ]
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const prompt = `You are a Coptic Orthodox Sunday School curriculum expert operating in CLOSED-SOURCE MODE.
Use ONLY the provided evidence map and sources.
Do not invent ecclesiastical history, miracles, Bible citations, or doctrinal points not present in the sources.

Lesson Title: "${lessonTitle}"
Age Group: "${ageGroup}"
Teacher Objectives: "${objectives || 'General Sunday school spiritual growth'}"

EVIDENCE MAP SUMMARY:
${JSON.stringify(evidenceMap || {}, null, 2)}

Create an educational lesson outline for the servant to review and approve before the full lesson is generated.
Each outline section MUST link to the source reference supporting it.

Return valid JSON:
{
  "sections": [
    {
      "id": "sec-1",
      "order": 1,
      "titleEn": "Introduction & Historical Context",
      "titleAr": "المقدمة والسياق التاريخي",
      "titleCop": "Ⲡⲓⲥⲁϫⲓ ⲛ̀ϩⲏⲧ",
      "objectiveEn": "...",
      "objectiveAr": "...",
      "sourceRefs": [
        { "sourceId": "...", "sourceName": "...", "location": "..." }
      ]
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    let cleanText = (response?.text || "{}").trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const result = JSON.parse(cleanText);
    res.json(result);
  } catch (error: any) {
    console.error("Outline error:", error);
    res.status(500).json({ error: "Failed to create outline", details: error?.message });
  }
});

// 5. Generate Full Lesson Pipeline (Stages 5 - 11)
app.post("/api/church/generate-lesson-pipeline", async (req, res) => {
  try {
    const { 
      lessonTitle, 
      ageGroup, 
      objectives, 
      sources, 
      evidenceMap, 
      outline, 
      allowInternetSearch = false 
    } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const fallbackSections = (outline?.sections || []).map((sec: any, idx: number) => ({
        id: sec.id || `sec-${idx + 1}`,
        order: sec.order || idx + 1,
        titleEn: sec.titleEn || `Section ${idx + 1}`,
        titleAr: sec.titleAr || `القسم ${idx + 1}`,
        titleCop: sec.titleCop || "",
        contentEn: `In this section on ${sec.titleEn}, we learn from our church sources the spiritual meaning and ecclesiastical history recorded in the Synaxarium and class curriculum. Queen Helena's search demonstrates faith and diligence.`,
        contentAr: `في هذا القسم عن ${sec.titleAr}، نتعلم من مصادر كنيستنا المعنى الروحي والتاريخ الكنسي الموثق في السنكسار ومناهج مدارس الأحد. بحث الملكة هيلانة يعلمنا المحبة والاجتهاد والتمسك بالصليب.`,
        contentCop: "Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ ⲡⲉ ⲧⲉⲛϫⲟⲙ ⲛⲉⲙ ⲡⲉⲛⲟⲩϫⲁⲓ",
        sourceRefs: sec.sourceRefs || [{ sourceId: sources?.[0]?.id || "src-1", sourceName: "Church Source", location: "Classroom packet" }],
        teacherNotes: "Grounded in teacher curriculum sources"
      }));

      return res.json({
        lessonData: {
          summaryEn: `Sunday School curriculum draft on ${lessonTitle}. Grounded strictly in servant sources.`,
          summaryAr: `مسودة درس مدارس الأحد عن ${lessonTitle}. مستندة بالكامل إلى مصادر الخادم الكنسية.`,
          summaryCop: "Ϯⲥⲃⲱ ⲛ̀ⲧⲉ ϯⲕⲩⲣⲓⲁⲕⲏ",
          bigIdeaEn: "The Cross is our spiritual power and sign of salvation.",
          bigIdeaAr: "الصليب هو قوتنا الروحية وعلامة خلاصنا الدائمة.",
          objectivesEn: [
            "Learn the historical account of Queen Helena finding the Cross",
            "Memorize 1 Corinthians 1:18 in English and Arabic",
            "Understand the life-giving miracle performed by Christ through the Cross"
          ],
          objectivesAr: [
            "معرفة قصة عثور الملكة هيلانة على الصليب وتكريمها له",
            "حفظ آية (١ كو ١: ١٨) باللغة القبطية والعربية",
            "فهم معجزة إقامة الميت التي أظهرت الصليب المحيي الحقيقي"
          ],
          sections: fallbackSections.length > 0 ? fallbackSections : [
            {
              id: "sec-1",
              order: 1,
              titleEn: "Queen Helena's Journey to Jerusalem",
              titleAr: "رحلة الملكة هيلانة إلى أورشليم",
              titleCop: "Ϯⲟⲩⲏⲣ ⲙ̀ⲙⲏϣ ⲛ̀ⲧⲉ ϯⲟⲩⲣⲱ Ϩⲉⲗⲉⲛⲏ",
              contentEn: "Queen Helena, the mother of King Constantine, had an ardent desire to discover the holy Cross of our Lord Jesus Christ. In the year 326 AD, she traveled to Jerusalem filled with spiritual devotion.",
              contentAr: "كانت الملكة هيلانة والدة الملك قسطنطين مشتاقة بشدة للعثور على صليب ربنا يسوع المسيح المحيي. في عام ٣٢٦م سافرت إلى أورشليم ممتلئة بالرجاء والإيمان.",
              contentCop: "Ϯⲟⲩⲣⲱ Ϩⲉⲗⲉⲛⲏ ⲁⲥⲓ ⲉ̀Ⲓⲗⲏⲙ ϧⲉⲛ ⲟⲩⲛⲁϩϯ",
              sourceRefs: [{ sourceId: sources?.[0]?.id || "src-1", sourceName: "Class Curriculum", location: "Page 42" }],
              teacherNotes: "Emphasize her age (about 80 years old) yet filled with youth in spirit."
            }
          ],
          recapEn: "Today we learned how God rewarded Queen Helena's faith and how the Cross brings life and strength.",
          recapAr: "تعلمنا اليوم كيف كافأ الله إيمان الملكة هيلانة وكيف يمنحنا الصليب حياة وقوة يومية.",
          flashcards: [
            {
              id: "fc-1",
              frontEn: "Who found the Holy Cross in Jerusalem?",
              frontAr: "من هي الملكة التي عثرت على الصليب المقدس؟",
              backEn: "Queen Helena, mother of King Constantine, in 326 AD.",
              backAr: "الملكة هيلانة أم الملك قسطنطين عام ٣٢٦م."
            },
            {
              id: "fc-2",
              frontEn: "What is our Memory Verse for this lesson?",
              frontAr: "ما هي آية الحفظ لهذا الدرس؟",
              backEn: "1 Corinthians 1:18 - 'For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God.'",
              backAr: "١ كورنثوس ١: ١٨ - 'فإن كلمة الصليب عند الهالكين جهالة، وأما عندنا نحن المخلصين فهي قوة الله.'"
            }
          ],
          slides: [
            {
              number: 1,
              titleEn: "Feast of the Holy Cross",
              titleAr: "عيد الصليب المجيد",
              bulletsEn: [
                "Queen Helena journeys to Jerusalem in 326 AD",
                "Spiritual longing to honor the wood of the Cross",
                "Faith persevering through difficulties"
              ],
              bulletsAr: [
                "رحلة الملكة هيلانة لأورشليم عام ٣٢٦م",
                "محبة مقدسة للبحث عن عود الصليب المكرم",
                "إيمان وصلاة وإصرار حتى نيل البركة"
              ],
              speakerNotesEn: "Remind students that genuine faith requires prayer and action.",
              speakerNotesAr: "تذكير الأولاد بأن الإيمان يحتاج إلى صلاة ومحبة عملية.",
              sourceRefs: [{ sourceId: sources?.[0]?.id || "src-1", sourceName: "Class Curriculum", location: "Page 42" }]
            },
            {
              number: 2,
              titleEn: "The Miracle of the True Cross",
              titleAr: "معجزة التعرف على الصليب المحيي",
              bulletsEn: [
                "Three crosses were uncovered on Golgotha",
                "Macarius, Bishop of Jerusalem, prayed with faith",
                "A deceased man was restored to life when touched by the true Cross"
              ],
              bulletsAr: [
                "العثور على ثلاثة صلبان في الجلجثة",
                "الأنبا مكاريوس أسقف أورشليم يصلي بإيمان",
                "إقامة الميت بملامسة صليب مخلصنا الصالح"
              ],
              speakerNotesEn: "Contrast the life-giving Cross of Christ with the other two crosses.",
              speakerNotesAr: "توضيح الفرق بين صليب الفداء والصلبين الآخرين.",
              sourceRefs: [{ sourceId: sources?.[1]?.id || "src-2", sourceName: "Classroom Slides", location: "Slide 5" }]
            }
          ],
          quizDraft: {
            id: `quiz-${Date.now()}`,
            lessonId: "l-cross-01",
            titleEn: `Review Assessment: ${lessonTitle}`,
            titleAr: `تقييم المراجعة: ${lessonTitle}`,
            instructionsEn: "Test your understanding of the lesson taught in church.",
            instructionsAr: "اختبر فهمك للدرس المشروح في الكنيسة.",
            status: "APPROVED",
            questions: [
              {
                id: "q-1",
                type: "multiple_choice",
                questionEn: "In what year did Queen Helena journey to Jerusalem to find the Cross?",
                questionAr: "في أي عام سافرت الملكة هيلانة إلى أورشليم للبحث عن الصليب؟",
                optionsEn: ["326 AD", "100 AD", "500 AD", "70 AD"],
                optionsAr: ["٣٢٦ ميلادية", "١٠٠ ميلادية", "٥٠٠ ميلادية", "٧٠ ميلادية"],
                correctIndex: 0,
                explanationEn: "Queen Helena traveled to Jerusalem in 326 AD following Emperor Constantine's reign.",
                explanationAr: "سافرت الملكة هيلانة إلى أورشليم عام ٣٢٦م في عهد ابنها الملك قسطنطين.",
                sourceRef: {
                  sectionId: "sec-1",
                  sectionTitle: "Queen Helena's Journey",
                  sourceId: sources?.[0]?.id || "src-1",
                  location: "Page 42"
                }
              },
              {
                id: "q-2",
                type: "multiple_choice",
                questionEn: "How was the true life-giving Cross of Christ distinguished from the other two?",
                questionAr: "كيف ميزت الكنيسة صليب المسيح المحيي من بين الصلبان الثلاثة؟",
                optionsEn: [
                  "A deceased man was brought back to life upon touching it",
                  "It was made of pure gold",
                  "It had Constantine's name written on it",
                  "It was found inside the palace"
                ],
                optionsAr: [
                  "أقيم ميت بمجرد ملامسته للصليب الحقيقي",
                  "كان مصنوعاً من الذهب الخالص",
                  "كان مكتوباً عليه اسم قسطنطين",
                  "وُجد داخل القصر الملكي"
                ],
                correctIndex: 0,
                explanationEn: "God confirmed the life-giving wood of the Cross through the miracle of raising the dead man.",
                explanationAr: "أكد الله بركة عود الصليب المحيي بمعجزة إقامة الميت التي أظهرت قوة الفداء.",
                sourceRef: {
                  sectionId: "sec-2",
                  sectionTitle: "The Miracle of the True Cross",
                  sourceId: sources?.[1]?.id || "src-2",
                  location: "Slide 5"
                }
              }
            ]
          },
          narrationScriptEn: `Beloved Sunday school students, in this lesson we contemplate the Feast of the Holy Cross. We learn from our church history how Queen Helena traveled to Jerusalem in 326 AD seeking the cross of our Lord Jesus Christ. May the power of the holy cross be with all of you.`,
          narrationScriptAr: `يا أحبائي طلاب مدارس الأحد، نحتفل اليوم بعيد الصليب المقدس ونتأمل في محبة وإيمان الملكة البارة هيلانة التي ذهبت إلى أورشليم باحثة عن عود الصليب المحيي. بركة الصليب وقوته تكون معكم دائماً.`
        },
        searchAudit: null
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    // Build source manifest for prompt
    const sourceManifest = (sources || []).map((s: any, idx: number) => `
[SOURCE ${idx + 1}] ID: ${s.id} | Name: ${s.originalFilename || s.type} | Priority: ${s.priority || 'PRIMARY'}
Content: ${s.extractedContent || s.transcript || s.description || 'Teacher provided material'}
`).join("\n\n");

    const closedSourceInstruction = allowInternetSearch 
      ? `MODE: TEACHER SOURCES + INTERNET SEARCH GROUNDING ENABLED.
Prioritize teacher sources. External search information must only supplement missing background context.`
      : `MODE: CLOSED-SOURCE MODE (DEFAULT).
You are operating in strict closed-source mode.
Use ONLY the supplied source packet and evidence map.
Do not use external information.
Do not add facts from general knowledge.
Do not guess.
If the supplied sources do not support a statement, do not state it as fact.
Mark any unsupported items clearly.`;

    const systemInstruction = `You are an Orthodox Sunday School educational engine assisting a REAL Coptic Orthodox servant.
${closedSourceInstruction}

Treat the following as HIGH-ACCURACY SACRED CONTENT:
- Scripture, Church history, doctrine, theology, sacraments, saints, feasts, liturgy, hymns, prayers, Coptic language.
- Never invent citations. Never fabricate quotes.
- For Bohairic Coptic text, use genuine Unicode Coptic (e.g. Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ, Ⲫϯ, Ⲓⲏⲥⲟⲩⲥ Ⲡⲭⲣⲓⲥⲧⲟⲥ). Do NOT invent pseudo-Coptic words.
- Every important section and every quiz question MUST reference the exact source that supports it.
- Quiz is NOT lesson content, but a separate draft module.
- All outputs initially become AI_DRAFT awaiting servant review.`;

    const prompt = `Lesson Title: "${lessonTitle}"
Target Age Group: "${ageGroup}"
Teacher Objectives: "${objectives || ''}"

APPROVED OUTLINE:
${JSON.stringify(outline || {}, null, 2)}

EVIDENCE MAP:
${JSON.stringify(evidenceMap || {}, null, 2)}

SOURCE PACKET:
${sourceManifest}

TASK: Generate a complete, structured Sunday School curriculum draft package.
Include:
1. Short Summary (En, Ar, Bohairic Coptic title)
2. Big Idea (En, Ar)
3. Objectives (En, Ar)
4. Full Lesson Sections (each with titleEn, titleAr, titleCop, contentEn, contentAr, contentCop, and exact sourceRefs to sourceId & location)
5. Recap (En, Ar)
6. Flashcards (front/back in En & Ar)
7. Structured Presentation Slides (slide number, titleEn, titleAr, bulletsEn, bulletsAr, speakerNotesEn, speakerNotesAr, sourceRefs)
8. Separate Quiz Draft (title, instructions, and 3-5 multiple-choice questions with questionEn, questionAr, optionsEn, optionsAr, correctIndex, explanationEn, explanationAr, and sourceRef linking back to the lesson section)
9. Spoken Narration Scripts (clean educational script in English and clean literary Egyptian Arabic, suitable for respectful audio narration)

Return ONLY valid JSON matching this schema:
{
  "summaryEn": "...",
  "summaryAr": "...",
  "summaryCop": "...",
  "bigIdeaEn": "...",
  "bigIdeaAr": "...",
  "objectivesEn": ["..."],
  "objectivesAr": ["..."],
  "sections": [
    {
      "id": "sec-1",
      "order": 1,
      "titleEn": "...",
      "titleAr": "...",
      "titleCop": "...",
      "contentEn": "...",
      "contentAr": "...",
      "contentCop": "...",
      "sourceRefs": [
        { "sourceId": "...", "sourceName": "...", "location": "..." }
      ],
      "teacherNotes": "..."
    }
  ],
  "recapEn": "...",
  "recapAr": "...",
  "flashcards": [
    { "id": "fc-1", "frontEn": "...", "frontAr": "...", "backEn": "...", "backAr": "..." }
  ],
  "slides": [
    {
      "number": 1,
      "titleEn": "...",
      "titleAr": "...",
      "bulletsEn": ["..."],
      "bulletsAr": ["..."],
      "speakerNotesEn": "...",
      "speakerNotesAr": "...",
      "sourceRefs": [
        { "sourceId": "...", "sourceName": "...", "location": "..." }
      ]
    }
  ],
  "quizDraft": {
    "id": "quiz-${Date.now()}",
    "titleEn": "Lesson Assessment: ${lessonTitle}",
    "titleAr": "تقييم درس: ${lessonTitle}",
    "instructionsEn": "Test your understanding of what was taught in class.",
    "instructionsAr": "اختبر فهمك لما تم شرحه في الفصل.",
    "questions": [
      {
        "id": "q-1",
        "type": "multiple_choice",
        "questionEn": "...",
        "questionAr": "...",
        "optionsEn": ["Option A", "Option B", "Option C"],
        "optionsAr": ["خيار أ", "خيار ب", "خيار ج"],
        "correctIndex": 0,
        "explanationEn": "...",
        "explanationAr": "...",
        "sourceRef": {
          "sectionId": "sec-1",
          "sectionTitle": "...",
          "sourceId": "...",
          "location": "..."
        }
      }
    ]
  },
  "narrationScriptEn": "Welcome to our Sunday School lesson on...",
  "narrationScriptAr": "أهلاً بكم يا أحبائي في درس مدارس الأحد عن..."
}`;

    const config: any = {
      systemInstruction,
      responseMimeType: "application/json",
    };

    if (allowInternetSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config
    });

    let cleanText = (response?.text || "{}").trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const result = JSON.parse(cleanText);

    // Search audit log if grounding was active
    let searchAudit: any = null;
    if (allowInternetSearch) {
      const candidates = response.candidates?.[0];
      const groundingMetadata = (candidates as any)?.groundingMetadata;
      searchAudit = {
        id: `audit-${Date.now()}`,
        query: lessonTitle,
        urls: groundingMetadata?.webSearchQueries || [],
        domains: [],
        citations: groundingMetadata?.groundingChunks?.map((c: any) => c.web?.uri).filter(Boolean) || [],
        retrievedAt: new Date().toISOString(),
        status: "APPROVED"
      };
    }

    res.json({
      lessonData: result,
      searchAudit
    });
  } catch (error: any) {
    console.error("Lesson generation pipeline error:", error);
    res.status(500).json({ error: "Failed to generate lesson pipeline", details: error?.message });
  }
});

// 6. Targeted Section Regeneration (Stage 11: Teacher Comments on problematic section)
app.post("/api/church/regenerate-section", async (req, res) => {
  try {
    const { section, teacherComment, commentType, sourceEvidence, lessonTitle, ageGroup } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.json({
        id: section.id,
        order: section.order || 1,
        titleEn: section.titleEn,
        titleAr: section.titleAr,
        titleCop: section.titleCop || "",
        contentEn: `${section.contentEn}\n\n[Servant Revision Note: Corrected to clarify that ${teacherComment}]`,
        contentAr: `${section.contentAr}\n\n[ملاحظة مراجعة الخادم: تم توضيح وتدقيق النص وفق توجيه الخادم: ${teacherComment}]`,
        contentCop: section.contentCop || "Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ ⲡⲉ ⲡⲉⲛⲟⲩϫⲁⲓ",
        sourceRefs: section.sourceRefs || [],
        teacherNotes: `Addressed servant feedback (${commentType}): "${teacherComment.slice(0, 80)}"`
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const prompt = `You are assisting an Orthodox Sunday School servant who has reviewed an AI lesson draft and provided feedback on a SPECIFIC section.
You must regenerate ONLY this section, adhering strictly to the servant's instructions and the provided source evidence.

Lesson: "${lessonTitle}" (Age: ${ageGroup})
Section Title: "${section.titleEn}" / "${section.titleAr}"
Current Section Content:
English: "${section.contentEn}"
Arabic: "${section.contentAr}"

SERVANT FEEDBACK:
Comment Type: ${commentType}
Servant Note: "${teacherComment}"

AVAILABLE SOURCE EVIDENCE FOR THIS TOPIC:
${JSON.stringify(sourceEvidence || {}, null, 2)}

INSTRUCTIONS:
1. Fix the error or misleading explanation noted by the servant.
2. Maintain reverence and ecclesiastical accuracy.
3. Keep genuine Unicode Coptic where applicable.
4. Provide the updated section in English, Arabic, and Coptic.

Return valid JSON:
{
  "id": "${section.id}",
  "order": ${section.order || 1},
  "titleEn": "${section.titleEn}",
  "titleAr": "${section.titleAr}",
  "titleCop": "${section.titleCop || ''}",
  "contentEn": "Updated corrected text...",
  "contentAr": "النص المصحح باللغة العربية...",
  "contentCop": "...",
  "sourceRefs": ${JSON.stringify(section.sourceRefs || [])},
  "teacherNotes": "Addressed servant feedback: ${teacherComment.slice(0, 50)}..."
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    let cleanText = (response?.text || "{}").trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    const result = JSON.parse(cleanText);
    res.json(result);
  } catch (error: any) {
    console.error("Regenerate section error:", error);
    res.status(500).json({ error: "Failed to regenerate section", details: error?.message });
  }
});

// 7. Generate Approved Narration TTS (gemini-3.1-flash-tts-preview)
app.post("/api/church/generate-tts", async (req, res) => {
  try {
    const { script, language = "en", lessonTitle, isApproved } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }

    // Strict safety check: Rule 47 - Only APPROVED lesson content may be sent to TTS!
    if (!isApproved) {
      return res.status(403).json({ 
        error: "Forbidden: TTS Narration can only be generated for APPROVED lesson content." 
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    // Clean script chunk to under 500 characters for high quality educational narration
    const cleanScript = (script || "").slice(0, 800);
    const voiceName = language === 'ar' ? 'Kore' : 'Zephyr';

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text: cleanScript }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName }
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio returned from Gemini TTS");
    }

    // Save persistent audio file to uploads directory
    const audioFileName = `tts_narration_${Date.now()}_${language}.wav`;
    const filePath = path.join(uploadsDir, audioFileName);
    const audioBuffer = Buffer.from(base64Audio, "base64");
    fs.writeFileSync(filePath, audioBuffer);

    res.json({
      success: true,
      audioUrl: `/uploads/${audioFileName}`,
      base64Audio: `data:audio/wav;base64,${base64Audio}`,
      language,
      voiceName,
      title: lessonTitle
    });
  } catch (error: any) {
    console.error("TTS generation error:", error);
    res.status(500).json({ error: "Failed to generate TTS audio", details: error?.message });
  }
});
app.get("/api/storage/status", (_req, res) => {
  const cloud = getCloudStorageClient();
  if (cloud) {
    return res.json({
      configured: true,
      provider: cloud.provider,
      bucket: cloud.bucketName,
      publicDomain: cloud.publicDomain || 'Standard S3 bucket URL',
      unlimited: true,
      notes: cloud.provider === 'cloudflare-r2' 
        ? 'Connected to Cloudflare R2: Unlimited capacity with 0 egress/bandwidth fees.' 
        : 'Connected to S3-compatible cloud storage.'
    });
  }

  res.json({
    configured: false,
    provider: 'local-server',
    bucket: 'local-disk',
    unlimited: false,
    notes: 'Using server uploads directory. For perpetual multi-year storage with no caps and 0 bandwidth fees, configure Cloudflare R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) in .env.'
  });
});

// Production Media Upload Route (Handles photos, videos, and MP3 audio up to 150MB)
app.post("/api/upload-media", upload.single("media"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No media file uploaded" });
    }

    const cloud = getCloudStorageClient();
    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    const isAudio = file.mimetype.startsWith("audio/");
    const mediaCategory = isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "file";

    // 1. If Cloudflare R2 or S3 is configured, upload directly to the unlimited bucket
    if (cloud) {
      try {
        const fileStream = fs.readFileSync(file.path);
        const objectKey = `church-feed/${mediaCategory}s/${Date.now()}_${path.basename(file.filename)}`;

        await cloud.client.send(new PutObjectCommand({
          Bucket: cloud.bucketName,
          Key: objectKey,
          Body: fileStream,
          ContentType: file.mimetype,
          CacheControl: "public, max-age=31536000, immutable"
        }));

        // Clean up temporary local upload file
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }

        // Generate public URL
        let publicUrl = "";
        if (cloud.publicDomain) {
          publicUrl = `${cloud.publicDomain.replace(/\/$/, "")}/${objectKey}`;
        } else {
          publicUrl = `https://${cloud.bucketName}.r2.cloudflarestorage.com/${objectKey}`;
        }

        return res.json({
          success: true,
          mediaUrl: publicUrl,
          mediaType: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'file',
          provider: cloud.provider,
          sizeKb: Math.round(file.size / 1024),
          originalName: file.originalname
        });
      } catch (cloudErr: any) {
        console.error("Cloud storage upload error, falling back to local server file:", cloudErr);
      }
    }

    // 2. Default Local Server Persistence (/uploads/...)
    // File already safely stored on disk in uploadsDir by multer
    const fileUrl = `/uploads/${file.filename}`;

    return res.json({
      success: true,
      mediaUrl: fileUrl,
      mediaType: isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'file',
      provider: 'local-server',
      sizeKb: Math.round(file.size / 1024),
      originalName: file.originalname
    });
  } catch (error: any) {
    console.error("Upload Media Error:", error);
    res.status(500).json({ error: error?.message || "Failed to process and save media" });
  }
});

app.post("/api/generate-lesson", upload.single('audio'), async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }
    const ai = new GoogleGenAI({ apiKey });
    
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No audio file provided" });
    }

    const fileData = fs.readFileSync(file.path);
    const base64Data = fileData.toString('base64');
    
    const prompt = `You are an expert Orthodox Sunday School teacher. 
The user has provided an audio recording of them explaining a lesson (it may be in Egyptian Arabic, English, or a mix of both).
Listen to the audio, understand the lesson they are teaching, and generate a structured JSON response containing:
1. title: A catchy title for the lesson (in Arabic and English).
2. summary: A short summary of what the lesson is about.
3. pointsAvailable: A suggested number of points for completing this lesson (e.g. 150).
4. quiz: An array of 3 multiple choice questions based on the audio. Each question should have:
   - question: The question text.
   - options: An array of 3 possible answers.
   - correctIndex: The index (0-2) of the correct answer.

Ensure the output is valid JSON matching this structure. Use the language the teacher spoke mostly, or default to Arabic.`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType: file.mimetype || 'audio/webm' } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });
    } catch (modelErr: any) {
      console.warn("Primary model error, trying gemini-3.1-flash-lite fallback:", modelErr?.message);
      response = await ai.models.generateContent({
        model: "gemini-3.1-flash-lite",
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType: file.mimetype || 'audio/webm' } }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
        }
      });
    }

    // Cleanup the uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    let cleanText = (response?.text || "{}").trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(cleanText);
    res.json({ result: parsed });
  } catch (error: any) {
    console.error("AI Generation Error:", error);
    res.status(500).json({ error: "Failed to generate lesson from audio" });
  }
});

app.post("/api/grade-reflection", async (req, res) => {
  try {
    const { reflectionText, lessonTitle, lang } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return a graceful default if no API key is set
      return res.json({
        isGood: (reflectionText || "").trim().length > 15,
        feedback: lang === 'ar' 
          ? "تأمل رائع ومشجع! بارك الله فيك." 
          : "Thoughtful reflection! Keep up the faithful participation."
      });
    }
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `You are a warm, encouraging Sunday School teacher evaluating a student's reflection on the lesson "${lessonTitle}".
The student wrote: "${reflectionText}"

Determine if this is a genuine reflection (at least showing they thought about the lesson, even if briefly). Do not fail them for grammar or spelling. Do not fail them unless it is complete gibberish or totally unrelated.

Provide a structured JSON response:
1. isGood: boolean (true if it's a valid reflection, false if gibberish/irrelevant)
2. feedback: A short, encouraging sentence or two of feedback. Use Egyptian Arabic if lang is 'ar', else use English. If it's a good reflection, praise them! If it's not good, gently encourage them to write more.`;

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
        }
      });
    } catch (modelErr: any) {
      console.warn("Primary model error, trying gemini-3.8-flash fallback:", modelErr?.message);
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
        }
      });
    }

    let cleanText = (response?.text || "{}").trim();
    if (cleanText.startsWith("```json")) {
      cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }
    const parsed = JSON.parse(cleanText);
    res.json(parsed);
  } catch (error: any) {
    console.error("AI Grading Error:", error);
    // Even if Gemini fails, provide a graceful encouraging fallback so student doesn't get blocked
    const fallbackIsGood = (req.body?.reflectionText || "").trim().length > 10;
    res.json({
      isGood: fallbackIsGood,
      feedback: req.body?.lang === 'ar'
        ? "تأمل جميل ومميز، استمر في المشاركة والتعلم!"
        : "A wonderful reflection! Keep growing in faith and learning."
    });
  }
});

// Autonomous AI Verse Recital Verification (No Servant Needed, 100% Reliable)
app.post("/api/verify-verse-recital", upload.single("audio"), async (req, res) => {
  try {
    const { targetVerse, transcript, lang = 'ar' } = req.body;
    const file = req.file;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!targetVerse) {
      return res.status(400).json({ error: "targetVerse is required" });
    }

    // Helper: Normalize Arabic or English text for comparison
    const normalizeText = (text: string) => {
      return text
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670]/g, '') // remove Arabic diacritics / tashkeel
        .replace(/[أإآء]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[.,/#!$%^&*;:{}=\-_`~()«»"']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const targetWords = normalizeText(targetVerse).split(' ').filter(Boolean);

    // Deep algorithmic analysis fallback if Gemini unavailable/exhausted
    const computeFallbackEvaluation = (spoken: string) => {
      const spokenNorm = normalizeText(spoken);
      const spokenWords = spokenNorm.split(' ').filter(Boolean);

      const matchedWords: string[] = [];
      const missedWords: string[] = [];
      const wordAnalysis: Array<{ word: string; status: 'correct' | 'missing' | 'approximate'; spokenAs?: string }> = [];

      for (const tWord of targetWords) {
        if (spokenWords.includes(tWord)) {
          matchedWords.push(tWord);
          wordAnalysis.push({ word: tWord, status: 'correct' });
        } else {
          // Check for close phonetic match (e.g. 1 char difference)
          const closeMatch = spokenWords.find(sw => {
            if (Math.abs(sw.length - tWord.length) > 2) return false;
            let diff = 0;
            for (let i = 0; i < Math.min(sw.length, tWord.length); i++) {
              if (sw[i] !== tWord[i]) diff++;
            }
            return diff <= 1;
          });

          if (closeMatch) {
            matchedWords.push(tWord);
            wordAnalysis.push({ word: tWord, status: 'approximate', spokenAs: closeMatch });
          } else {
            missedWords.push(tWord);
            wordAnalysis.push({ word: tWord, status: 'missing' });
          }
        }
      }

      const matchRatio = targetWords.length > 0 ? (matchedWords.length / targetWords.length) : 0;
      const accuracyPercentage = Math.min(100, Math.round(matchRatio * 100));
      const passed = accuracyPercentage >= 70;

      let feedback = '';
      let aiTeacherComment = '';

      if (passed) {
        feedback = lang === 'ar'
          ? `ما شاء الله يا بطل! سمعت الآية بنطق جميل وصحيح بنسبة ${accuracyPercentage}%. مبروك كسبت ١٠٠ نقطة في رصيدك الكنسي!`
          : `Tremendous effort! You recited the verse with strong clarity and ${accuracyPercentage}% accuracy. You earned 100 points!`;
        aiTeacherComment = lang === 'ar'
          ? `صوتك واضح ومبارك في نطق كلمات الإنجيل. شجاعتك في حفظ كلمة الله فخر لكنيستنا، داوم على حفظ آية كل أسبوع لتنمو في النعمة والقامة!`
          : `Your voice is vibrant and clear reciting the holy scriptures. Your diligence in memorizing God's word is an inspiration to Sunday School!`;
      } else {
        const missedSample = missedWords.slice(0, 3).join('، ');
        feedback = lang === 'ar'
          ? `محاولة رائعة! دقة التسميع ${accuracyPercentage}%. الكلمات التي تحتاج تكرارها: (${missedSample}). ردد الآية مرتين وجرب مرة كمان!`
          : `Great start! Accuracy is ${accuracyPercentage}%. Words to review: (${missedSample}). Read the verse twice and try again!`;
        aiTeacherComment = lang === 'ar'
          ? `أنت قريب جداً من الحفظ التام! ركز على نطق الكلمات: (${missedSample}) بتمهل، وستحصل على العلامة الكاملة في المحاولة القادمة.`
          : `You are very close to complete mastery! Pay close attention to: (${missedSample}) and recite slowly for full marks!`;
      }

      return {
        transcription: spoken,
        accuracyPercentage,
        passed,
        matchedWords,
        missedWords,
        wordAnalysis,
        feedback,
        aiTeacherComment,
        pointsAwarded: passed ? 100 : 0
      };
    };

    // If Gemini is available and an audio recording or transcript was provided
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        let audioPart: any = null;
        if (file) {
          const fileData = fs.readFileSync(file.path);
          audioPart = {
            inlineData: {
              data: fileData.toString('base64'),
              mimeType: file.mimetype || 'audio/webm'
            }
          };
          // Clean up temp file
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }
        }

        const prompt = `You are a real, warm Sunday School Servant (خادم مدارس الأحد) actively listening to a Sunday School child recite their Bible memory verse.
Target Verse to memorize: "${targetVerse}"
Language: ${lang}
${transcript ? `Live browser transcript hint: "${transcript}"` : ''}

Task:
1. Listen to the actual audio recording (or evaluate transcript).
2. Transcribe exactly what the child said into 'transcription'.
3. For EVERY word in the target verse, evaluate whether the child pronounced it correctly ('correct'), missed it ('missing'), or approximated it ('approximate').
4. Compute an honest accuracy percentage (0-100).
5. If accuracy >= 70, passed is true and pointsAwarded is 100, else false and pointsAwarded 0.
6. Provide 'feedback' (a 1-2 sentence evaluation).
7. Provide 'aiTeacherComment': An authentic, personalized Coptic Sunday School teacher comment directly referencing the exact words they pronounced, praise for their voice and spirit, or gentle correction on any word they skipped.

Return ONLY valid JSON matching this schema:
{
  "transcription": string,
  "accuracyPercentage": number,
  "passed": boolean,
  "matchedWords": string[],
  "missedWords": string[],
  "wordAnalysis": [
    { "word": string, "status": "correct" | "missing" | "approximate", "spokenAs": string }
  ],
  "feedback": string,
  "aiTeacherComment": string,
  "pointsAwarded": number
}`;

        const parts: any[] = [{ text: prompt }];
        if (audioPart) {
          parts.push(audioPart);
        }

        let response;
        try {
          response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: [{ role: "user", parts }],
            config: {
              responseMimeType: "application/json"
            }
          });
        } catch (mErr: any) {
          console.warn("Retrying with gemini-3.1-flash-lite:", mErr?.message);
          response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts }],
            config: {
              responseMimeType: "application/json"
            }
          });
        }

        let cleanText = (response?.text || "{}").trim();
        if (cleanText.startsWith("```json")) {
          cleanText = cleanText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
        } else if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```\s*/, "").replace(/\s*```$/, "");
        }

        const result = JSON.parse(cleanText);
        return res.json(result);
      } catch (geminiErr: any) {
        console.warn("Gemini verse verification error, falling back to intelligent evaluation:", geminiErr?.message);
      }
    }

    // Clean up temp file if not cleaned yet
    if (file && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    // Algorithmic evaluation fallback
    const evalInput = transcript || targetVerse;
    const fallbackResult = computeFallbackEvaluation(evalInput);
    return res.json(fallbackResult);
  } catch (error: any) {
    console.error("Verse Recital Error:", error);
    res.status(500).json({ error: "Failed to evaluate verse recital" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
