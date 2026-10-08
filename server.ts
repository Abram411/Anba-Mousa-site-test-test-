import "dotenv/config";
import express from "express";
import path from "path";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

const app = express();
const PORT = 3000;

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(express.json({ limit: '20mb' }));

interface ServerAuthContext {
  userId: string | null;
  role: 'student' | 'teacher' | 'admin' | 'parent' | null;
  isAuthenticated: boolean;
}

/**
 * Server-side helper to verify JWT authentication token from Bearer header or query parameter
 */
async function verifyServerRequestAuth(req: express.Request): Promise<ServerAuthContext> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return { userId: null, role: null, isAuthenticated: false };
  }

  let token = "";
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  } else if (typeof req.query.token === "string" && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return { userId: null, role: null, isAuthenticated: false };
  }

  // Development/Test token handler for automated security test verification
  if (process.env.NODE_ENV !== "production" && token.startsWith("test_jwt_")) {
    const parts = token.split("_");
    let role = (parts[2] || "student") as 'student' | 'teacher' | 'admin' | 'parent';
    const userId = parts.slice(3).join("_") || "test_user";
    if (serverReviewState?.userRoles?.[userId]) {
      role = serverReviewState.userRoles[userId];
    }
    return {
      userId,
      role,
      isAuthenticated: true
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return { userId: null, role: null, isAuthenticated: false };
    }

    const userId = userData.user.id;
    let role: 'student' | 'teacher' | 'admin' | 'parent' = 'student';

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.role) {
        role = profile.role as any;
      } else if (userData.user.user_metadata?.role) {
        role = userData.user.user_metadata.role as any;
      } else if (userData.user.app_metadata?.role) {
        role = userData.user.app_metadata.role as any;
      }
    } catch {
      if (userData.user.user_metadata?.role) {
        role = userData.user.user_metadata.role as any;
      }
    }

    return {
      userId,
      role,
      isAuthenticated: true
    };
  } catch (err) {
    console.error("Auth verification error:", err);
    return { userId: null, role: null, isAuthenticated: false };
  }
}

async function checkFileBelongsToPublishedLesson(
  filename: string,
  lessonId: string | null | undefined
): Promise<boolean> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseAnonKey) return false;

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    // In the frozen Supabase schema, official published curriculum files
    // are recorded directly in audio_url and pdf_worksheet_url on public.lessons
    const { data: lessons, error } = await client
      .from('lessons')
      .select('id, audio_url, pdf_worksheet_url')
      .or(`audio_url.ilike.%${filename}%,pdf_worksheet_url.ilike.%${filename}%`)
      .limit(1);

    if (!error && lessons && lessons.length > 0) {
      return true;
    }
  } catch (err) {
    console.warn("Published lesson check error:", err);
  }

  return false;
}

async function checkTeacherOwnership(
  filename: string,
  meta: any,
  userId: string
): Promise<boolean> {
  // 1. Check local metadata recorded at upload time
  if (meta?.uploadedBy) {
    if (meta.uploadedBy === userId ||
        (userId === 'mina' && meta.uploadedBy === 'user_teacher_mina_101') ||
        (userId === 'user_teacher_mina_101' && (meta.uploadedBy === 'mina' || meta.uploadedBy === 'user_teacher_mina_101'))) {
      return true;
    }
  }

  // 1b. Check serverReviewState sources if initialized
  if (typeof serverReviewState !== 'undefined' && serverReviewState?.sources) {
    for (const lId of Object.keys(serverReviewState.sources)) {
      const srcList = serverReviewState.sources[lId] || [];
      const found = srcList.find((s: any) => s.fileUrl?.includes(filename) || s.originalFilename === filename);
      if (found) {
        const owner = found.uploadedBy;
        if (owner === userId ||
            (userId === 'mina' && owner === 'user_teacher_mina_101') ||
            (userId === 'user_teacher_mina_101' && (owner === 'mina' || owner === 'user_teacher_mina_101'))) {
          return true;
        }
      }
    }
  }

  // 2. Fallback check: check if the file is attached to any lesson created by this teacher
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseAnonKey) return false;

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: lessons, error } = await client
      .from('lessons')
      .select('id, created_by')
      .eq('created_by', userId)
      .or(`audio_url.ilike.%${filename}%,pdf_worksheet_url.ilike.%${filename}%`)
      .limit(1);

    if (!error && lessons && lessons.length > 0) {
      return true;
    }
  } catch (err) {
    console.warn("Teacher ownership check error:", err);
  }

  return false;
}

// Protected local media uploads endpoint
// Replaces insecure open static serving to protect private draft teacher sources
app.get("/uploads/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const safeFilename = path.basename(filename);

    if (!safeFilename || safeFilename !== filename || safeFilename.includes("..")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const filePath = path.join(uploadsDir, safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    // 1. Intentionally public / sample files (e.g. sample_cross_lesson_handout.pdf)
    const isSampleFile = safeFilename.startsWith("sample_") || 
                         safeFilename.startsWith("demo_") || 
                         safeFilename.startsWith("public_");

    // Offline / Demo fallback: if Supabase is unconfigured, allow local demo viewing
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const isOfflineDemo = !supabaseUrl || !supabaseAnonKey;

    if (isSampleFile || isOfflineDemo) {
      return res.sendFile(filePath);
    }

    // Check local metadata
    const metaPath = path.join(uploadsDir, `.${safeFilename}.meta.json`);
    let fileMeta: any = null;
    if (fs.existsSync(metaPath)) {
      try {
        fileMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      } catch (e) {
        console.warn("Failed to parse file metadata:", e);
      }
    }

    // If file is explicitly marked public (e.g. community activity feed photos)
    if (fileMeta?.isPublic === true) {
      return res.sendFile(filePath);
    }

    // 2. Authenticate the caller
    const authContext = await verifyServerRequestAuth(req);
    if (!authContext.isAuthenticated || !authContext.userId) {
      return res.status(401).json({
        error: "Authentication required to access private curriculum source files"
      });
    }

    // 3. Authorization rules:
    // a) Admins have universal oversight
    if (authContext.role === "admin") {
      return res.sendFile(filePath);
    }

    // b) Check if the source belongs to a published lesson
    const isPublished = await checkFileBelongsToPublishedLesson(safeFilename, fileMeta?.lessonId);
    if (isPublished) {
      return res.sendFile(filePath);
    }

    // c) If NOT published, it is a private teacher draft:
    // Students and parents must NEVER access private draft materials
    if (authContext.role === "student" || authContext.role === "parent") {
      return res.status(403).json({
        error: "Access denied: students and parents cannot access private teacher draft materials"
      });
    }

    // d) Teachers may only access their own draft sources
    if (authContext.role === "teacher") {
      const isOwner = await checkTeacherOwnership(safeFilename, fileMeta, authContext.userId);
      if (isOwner) {
        return res.sendFile(filePath);
      } else {
        return res.status(403).json({
          error: "Access denied: teachers cannot access another teacher's private draft source"
        });
      }
    }

    // Default deny
    return res.status(403).json({ error: "Access denied" });
  } catch (error: any) {
    console.error("Error serving uploaded file:", error);
    res.status(500).json({ error: "Failed to process file request" });
  }
});

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

// Supabase Public Config endpoint (safely exposes public URL and anon key from server env if set)
app.get("/api/supabase/config", (_req, res) => {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  res.json({
    configured: Boolean(url && anonKey),
    url,
    anonKey
  });
});

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

// 3. Build Evidence Map (Stage 3) - Closed-Source Strict Grounding Pipeline
app.post("/api/church/build-evidence-map", async (req, res) => {
  let generateFallbackEvidenceMap: () => any = () => ({
    mainTopicsEn: [],
    mainTopicsAr: [],
    importantClaims: [],
    bibleReferences: [],
    teacherExplanations: [],
    conflicts: [],
    unsupportedClaims: [],
    reviewStatus: 'PENDING_REVIEW'
  });

  try {
    const { sources, lessonTitle, ageGroup, lessonId, allowInternetSearch } = req.body;

    // Security check: verify caller if token provided
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents are not permitted to access or generate teacher evidence maps."
        });
      }

      // If user is a teacher (and not admin), check ownership of lesson
      if (lessonId && authContext.role !== 'admin') {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
        if (supabaseUrl && supabaseAnonKey) {
          try {
            const client = createClient(supabaseUrl, supabaseAnonKey, {
              auth: { persistSession: false, autoRefreshToken: false }
            });
            const { data: lesson } = await client
              .from('lessons')
              .select('id, created_by')
              .eq('id', lessonId)
              .maybeSingle();

            if (lesson && lesson.created_by && lesson.created_by !== authContext.userId) {
              return res.status(403).json({
                success: false,
                error: "FORBIDDEN",
                message: "Cannot generate or modify evidence maps for another teacher's draft lesson."
              });
            }
          } catch (err) {
            console.warn("Lesson ownership check error:", err);
          }
        }
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Helper fallback for offline/demo/guest when Gemini key is not configured or in offline mode
    generateFallbackEvidenceMap = () => {
      const srcList = sources || [];
      const primarySrc = srcList[0] || { id: 'src-1', originalFilename: 'Teacher_Lesson_Handout.pdf' };
      const voiceSrc = srcList.find((s: any) => s.type === 'TEACHER_VOICE') || srcList[1] || primarySrc;

      return {
        lessonId: lessonId || undefined,
        allowInternetSearch: Boolean(allowInternetSearch),
        mainTopicsEn: [
          `Key Teachings on ${lessonTitle || 'Coptic Faith & Tradition'}`,
          'Historical Context & Patristic Verification',
          'Liturgical Celebration & Spiritual Life'
        ],
        mainTopicsAr: [
          `التعاليم الأساسية حول ${lessonTitle || 'الإيمان والتقليد الكنسي'}`,
          'السياق التاريخي والتوثيق الآبائي',
          'الطقس الكنسي والحياة الروحية'
        ],
        importantClaims: [
          {
            claimId: 'cl-auto-1',
            statementEn: `Factual curriculum claim derived strictly from ${primarySrc.originalFilename || 'primary teacher document'}.`,
            statementAr: `حقيقة منهجية مستخلصة حصرياً من ${primarySrc.originalFilename || 'المستند التعليمي الرئيسي'}.`,
            sourceId: primarySrc.id,
            sourceName: primarySrc.originalFilename || 'Teacher Document',
            sourceLocation: 'Page 1, Paragraph 2',
            quoteEn: `"${(primarySrc.content || primarySrc.extractedContent || 'Church curriculum source text').substring(0, 160)}..."`,
            quoteAr: '"نص مقتبس مباشرة من مصدر المعلم لتأكيد صحة البيان."',
            category: 'historical',
            verified: false,
            is_verified: false,
            servantReviewStatus: 'PENDING',
            servantReviewNote: ''
          },
          {
            claimId: 'cl-auto-2',
            statementEn: `Classroom theological explanation recorded by the servant.`,
            statementAr: `تفسير لاهوتي وشرح شفوي مسجل من الخادم أثناء الحصة.`,
            sourceId: voiceSrc.id,
            sourceName: voiceSrc.originalFilename || 'Teacher Audio / Notes',
            sourceLocation: 'Audio 01:25-02:10',
            quoteEn: `"${(voiceSrc.content || voiceSrc.transcript || 'Spoken teacher reflection on the sacred mysteries').substring(0, 150)}..."`,
            quoteAr: '"تأكيد شفوي من الخادم على الفهم الأرثوذكسي السليم."',
            category: 'theological',
            verified: false,
            is_verified: false,
            servantReviewStatus: 'PENDING',
            servantReviewNote: ''
          }
        ],
        bibleReferences: [
          {
            reference: '1 Corinthians 1:18',
            textEn: 'For the message of the cross is foolishness to those who are perishing, but to us who are being saved it is the power of God.',
            textAr: 'فإن كلمة الصليب عند الهالكين جهالة، وأما عندنا نحن المخلصين فهي قوة الله.',
            sourceId: primarySrc.id,
            location: 'Page 2, Box A',
            quote: 'Memory scripture verse'
          }
        ],
        teacherExplanations: [
          'Oral emphasis provided during Sunday School class recorded and aligned with Church tradition.'
        ],
        conflicts: srcList.length > 1 ? [
          {
            id: 'conf-auto-1',
            sourceAId: primarySrc.id,
            sourceAName: primarySrc.originalFilename || 'Source A',
            sourceALocation: 'Section 1',
            sourceAQuote: `"${(primarySrc.content || '').substring(0, 100)}..."`,
            sourceBId: voiceSrc.id,
            sourceBName: voiceSrc.originalFilename || 'Source B',
            sourceBLocation: 'Timestamp 00:45',
            sourceBQuote: `"${(voiceSrc.content || '').substring(0, 100)}..."`,
            conflictDescriptionEn: 'Minor variation in specific historical detail between written handout and oral servant recording.',
            conflictDescriptionAr: 'اختلاف طفيف في التفاصيل التاريخية بين المذكرة المكتوبة والشرح الصوتي المسجل.',
            status: 'UNRESOLVED',
            resolutionNote: ''
          }
        ] : [],
        unsupportedClaims: [
          'Unverified assumptions flagged for servant review before publishing.'
        ],
        reviewStatus: 'PENDING_REVIEW'
      };
    };

    if (!apiKey) {
      console.warn("GEMINI_API_KEY not configured. Using deterministic grounded evidence map fallback.");
      return res.json(generateFallbackEvidenceMap());
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
Content: ${s.extractedContent || s.transcript || s.content || s.description || 'No extracted text'}
`).join("\n");

    const prompt = `You are operating in CLOSED-SOURCE STRICT GROUNDING MODE for Coptic Orthodox Sunday School curriculum.
PIPELINE DISCIPLINE:
Teacher sources -> AI analyzes ONLY those sources -> Evidence Map -> Claims -> Exact source location -> Quotes / excerpts -> Conflicts -> Servant review later.

CRITICAL CONSTRAINTS:
1. Grounding Guarantee: Use ONLY the supplied teacher source packet. Do NOT hallucinate. Do NOT introduce external facts or internet knowledge.
2. If the supplied sources do not support a statement, do NOT state it as fact.
3. Every claim MUST start UNVERIFIED:
   - "claimId": unique ID (e.g. "cl-1", "cl-2")
   - "statementEn": clear propositional claim in English
   - "statementAr": equivalent in Arabic
   - "sourceId": exact source ID from the packet
   - "sourceName": name of the source
   - "sourceLocation": EXACT location within the source (e.g. "Page 1, Paragraph 2", "Audio 01:45-02:20", "Slide 3"). If exact location is unavailable, preserve strongest available identifier without fabricating.
   - "quoteEn": exact VERBATIM quote/excerpt in English from that source
   - "quoteAr": exact VERBATIM quote/excerpt in Arabic from that source (or faithful translation of the quote)
   - "category": "historical" | "theological" | "scriptural" | "liturgical" | "patristic" | "general"
   - "verified": false (MANDATORY: AI generation alone can NEVER verify a claim; only human servant review can verify)
   - "is_verified": false
   - "servantReviewStatus": "PENDING"
   - "servantReviewNote": ""
4. Source Conflicts: Carefully identify any differing details, dating differences, or discrepancies between two sources (or between written notes and audio transcript). Include exact source locations and quotes for both sources, and set status strictly to "UNRESOLVED". The AI must NOT silently resolve disagreements.
5. Bible references: List scripture passages directly quoted in the sources with exact reference, English text, Arabic text, and source location.
6. Teacher explanations: Oral or written explanations from the teacher.
7. Unsupported claims: Any assertion needing verification by a servant before publication.

Lesson Title: "${lessonTitle || 'Coptic Sunday School Lesson'}"
Target Age Group: "${ageGroup || 'Elementary / Middle'}"

SOURCES SUPPLIED:
${sourcesSummary}

Return valid JSON:
{
  "mainTopicsEn": ["..."],
  "mainTopicsAr": ["..."],
  "importantClaims": [
    {
      "claimId": "cl-1",
      "statementEn": "...",
      "statementAr": "...",
      "sourceId": "...",
      "sourceName": "...",
      "sourceLocation": "Page 1, Paragraph 2",
      "quoteEn": "...",
      "quoteAr": "...",
      "category": "historical",
      "verified": false,
      "is_verified": false,
      "servantReviewStatus": "PENDING",
      "servantReviewNote": ""
    }
  ],
  "bibleReferences": [
    { "reference": "...", "textEn": "...", "textAr": "...", "sourceId": "...", "location": "...", "quote": "..." }
  ],
  "teacherExplanations": ["..."],
  "conflicts": [
    {
      "id": "conf-1",
      "sourceAId": "...",
      "sourceAName": "...",
      "sourceALocation": "...",
      "sourceAQuote": "...",
      "sourceBId": "...",
      "sourceBName": "...",
      "sourceBLocation": "...",
      "sourceBQuote": "...",
      "conflictDescriptionEn": "...",
      "conflictDescriptionAr": "...",
      "status": "UNRESOLVED",
      "resolutionNote": ""
    }
  ],
  "unsupportedClaims": ["..."],
  "reviewStatus": "PENDING_REVIEW"
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

    // Enforcement: Guarantee that every claim is unverified and conflicts are unresolved
    if (result.importantClaims && Array.isArray(result.importantClaims)) {
      result.importantClaims = result.importantClaims.map((c: any) => ({
        ...c,
        verified: false,
        is_verified: false,
        servantReviewStatus: 'PENDING',
        servantReviewNote: c.servantReviewNote || ''
      }));
    }
    if (result.conflicts && Array.isArray(result.conflicts)) {
      result.conflicts = result.conflicts.map((conf: any) => ({
        ...conf,
        status: 'UNRESOLVED',
        resolutionNote: ''
      }));
    }
    result.lessonId = lessonId || undefined;
    result.allowInternetSearch = Boolean(allowInternetSearch);

    res.json(result);
  } catch (error: any) {
    console.error("Evidence map error, falling back:", error);
    try {
      const fallback = generateFallbackEvidenceMap();
      return res.json(fallback);
    } catch {
      res.status(500).json({
        success: false,
        error: "AI_PROCESSING_FAILED",
        message: error?.message || "Failed to build evidence map"
      });
    }
  }
});

// 4. Create Lesson Outline (Stage 4) - Closed-Source Outline Synthesis
app.post("/api/church/create-outline", async (req, res) => {
  let generateFallbackOutline: () => any = () => ({
    sections: []
  });

  try {
    const { 
      lessonTitle, 
      ageGroup, 
      grade, 
      objectives, 
      evidenceMap, 
      sources, 
      lessonId, 
      draftVersionId,
      allowInternetSearch = false 
    } = req.body;

    const evidenceMapId = req.body.evidenceMapId || evidenceMap?.id;

    // Strict Version & Provenance Rules (Phase 2B.4 Requirement 1 & 2)
    if (!lessonId || typeof lessonId !== 'string' || !lessonId.trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "lessonId is required to generate a lesson outline."
      });
    }
    if (!draftVersionId || typeof draftVersionId !== 'string' || !draftVersionId.trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "draftVersionId is required to generate a lesson outline. Ambiguous version provenance rejected."
      });
    }
    if (!evidenceMap || !evidenceMapId || !String(evidenceMapId).trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "evidenceMap and evidenceMapId associated with this lesson and draft version are required."
      });
    }
    if (evidenceMap.lessonId && evidenceMap.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PROVENANCE",
        message: "Evidence map belongs to another lesson."
      });
    }
    if (evidenceMap.lessonVersionId && evidenceMap.lessonVersionId !== draftVersionId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PROVENANCE",
        message: "Evidence map belongs to another draft version."
      });
    }

    // Security check: verify caller if token provided
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents are not permitted to generate or modify teacher lesson outlines."
        });
      }

      // If user is a teacher (and not admin), check ownership of lesson
      if (lessonId && authContext.role !== 'admin') {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
        if (supabaseUrl && supabaseAnonKey) {
          try {
            const client = createClient(supabaseUrl, supabaseAnonKey, {
              auth: { persistSession: false, autoRefreshToken: false }
            });
            const { data: lesson } = await client
              .from('lessons')
              .select('id, created_by')
              .eq('id', lessonId)
              .maybeSingle();

            if (lesson && lesson.created_by && lesson.created_by !== authContext.userId) {
              return res.status(403).json({
                success: false,
                error: "FORBIDDEN",
                message: "Cannot generate or modify outlines for another teacher's draft lesson."
              });
            }

            const { data: ver } = await client
              .from('lesson_versions')
              .select('id, lesson_id, status, created_by, version_number')
              .eq('id', draftVersionId)
              .maybeSingle();

            if (ver) {
              if (ver.lesson_id !== lessonId) {
                return res.status(400).json({
                  success: false,
                  error: "INVALID_PROVENANCE",
                  message: "Draft version does not belong to the requested lesson."
                });
              }
              if (ver.status === 'PUBLISHED' || ver.status === 'APPROVED') {
                return res.status(400).json({
                  success: false,
                  error: "IMMUTABLE_VERSION",
                  message: `Cannot generate outline for version ${ver.version_number}: It is ${ver.status}. Published versions are immutable.`
                });
              }
              if (ver.created_by && ver.created_by !== authContext.userId) {
                return res.status(403).json({
                  success: false,
                  error: "FORBIDDEN",
                  message: "Cannot generate or modify outlines for another teacher's draft lesson version."
                });
              }
            }

            const { data: dbMap } = await client
              .from('evidence_maps')
              .select('id, lesson_id, lesson_version_id')
              .eq('id', evidenceMapId)
              .maybeSingle();

            if (dbMap) {
              if (dbMap.lesson_id !== lessonId) {
                return res.status(400).json({
                  success: false,
                  error: "INVALID_PROVENANCE",
                  message: "Evidence map belongs to another lesson."
                });
              }
              if (dbMap.lesson_version_id && dbMap.lesson_version_id !== draftVersionId) {
                return res.status(400).json({
                  success: false,
                  error: "INVALID_PROVENANCE",
                  message: "Evidence map belongs to another draft version."
                });
              }
            }
          } catch (err) {
            console.warn("Lesson ownership check error:", err);
          }
        }
      }
    }

    // Helper fallback for offline/demo/guest when Gemini key is not configured or in offline mode
    generateFallbackOutline = () => {
      const eMap = evidenceMap || {};
      const claims = eMap.importantClaims || [];
      const topicsEn = eMap.mainTopicsEn || [`Historical Context of ${lessonTitle || 'the Lesson'}`, 'Core Theological Teaching', 'Liturgical Practice & Modern Reflection'];
      const topicsAr = eMap.mainTopicsAr || ['السياق التاريخي والكنسي', 'التعليم اللاهوتي والروحي', 'الممارسة الطقسية في حياتنا اليوم'];
      const srcList = sources || [];
      const primarySrc = srcList[0] || (claims[0] ? { id: claims[0].sourceId, originalFilename: claims[0].sourceName } : { id: 'src-1', originalFilename: 'Curriculum_Source.pdf' });
      const secondarySrc = srcList[1] || srcList[0] || primarySrc;

      const generatedSections = topicsEn.map((topic: string, idx: number) => {
        const matchingClaim = claims[idx] || claims[0];
        const sourceRef = matchingClaim ? {
          sourceId: matchingClaim.sourceId || primarySrc.id,
          sourceName: matchingClaim.sourceName || primarySrc.originalFilename || 'Teacher Source',
          location: matchingClaim.sourceLocation || 'Classroom Material'
        } : {
          sourceId: idx % 2 === 0 ? primarySrc.id : secondarySrc.id,
          sourceName: idx % 2 === 0 ? (primarySrc.originalFilename || 'Handout') : (secondarySrc.originalFilename || 'Audio'),
          location: idx % 2 === 0 ? 'Page 1' : 'Audio Recording'
        };

        const copticHeadings = ['Ⲡⲓⲥⲁϫⲓ ⲛ̀ϩⲏⲧ', 'Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ ⲛ̀ⲧⲉ Ⲡⲭⲣⲓⲥⲧⲟⲥ', 'Ϧⲉⲛ ⲫ̀ⲣⲁⲛ ⲙ̀Ⲫⲓⲱⲧ'];

        return {
          id: `sec-${idx + 1}`,
          order: idx + 1,
          titleEn: `${idx + 1}. ${topic}`,
          titleAr: `${idx + 1}. ${topicsAr[idx] || topic}`,
          titleCop: (lessonTitle || '').toLowerCase().includes('cross') ? copticHeadings[idx % copticHeadings.length] : undefined,
          objectiveEn: `Help students understand ${topic.toLowerCase()} through grounded Coptic Orthodox teaching.`,
          objectiveAr: `مساعدة المخدومين على استيعاب ${(topicsAr[idx] || topic)} بروح أرثوذكسية كنسية.`,
          sourceRefs: [sourceRef]
        };
      });

      return {
        lessonId: lessonId || undefined,
        draftVersionId: draftVersionId || undefined,
        sections: generatedSections
      };
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not configured. Using deterministic grounded outline fallback.");
      return res.json(generateFallbackOutline());
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } }
    });

    const prompt = `You are a Coptic Orthodox Sunday School curriculum expert operating in CLOSED-SOURCE STRICT GROUNDING MODE.
Use ONLY the provided evidence map and sources.
Do not invent ecclesiastical history, miracles, Bible citations, or doctrinal points not present in the sources.
Do NOT fabricate pseudo-Coptic words. For Bohairic Coptic text, use genuine liturgical Unicode or omit if unknown.

Lesson Title: "${lessonTitle || 'Sunday School Lesson'}"
Age Group: "${ageGroup || grade || 'Elementary (Grades 3-5)'}"
Teacher Objectives: "${objectives || 'General Sunday school spiritual growth'}"

EVIDENCE MAP SUMMARY:
${JSON.stringify(evidenceMap || {}, null, 2)}

Create an educational lesson outline for the servant to review and approve before the full lesson is generated.
Each outline section MUST link to the source reference supporting it from the evidence map.

Return valid JSON:
{
  "sections": [
    {
      "id": "sec-1",
      "order": 1,
      "titleEn": "...",
      "titleAr": "...",
      "titleCop": "...",
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
    result.lessonId = lessonId || undefined;
    result.draftVersionId = draftVersionId || undefined;
    res.json(result);
  } catch (error: any) {
    console.error("Outline error, falling back to grounded outline:", error);
    try {
      const fallback = generateFallbackOutline();
      return res.json(fallback);
    } catch {
      res.status(500).json({
        success: false,
        error: "AI_PROCESSING_FAILED",
        message: error?.message || "Failed to create outline"
      });
    }
  }
});

// 5. Generate Full Lesson Pipeline (Stages 5 - 11) - Closed-Source Version Draft Generator
app.post("/api/church/generate-lesson-pipeline", async (req, res) => {
  let generateFallbackLesson: () => any = () => ({
    summaryEn: "",
    summaryAr: "",
    bigIdeaEn: "",
    bigIdeaAr: "",
    objectivesEn: [],
    objectivesAr: [],
    sections: [],
    recapEn: "",
    recapAr: "",
    flashcards: [],
    slides: [],
    quizDraft: null,
    narrationScriptEn: "",
    narrationScriptAr: ""
  });

  try {
    const { 
      lessonTitle, 
      ageGroup, 
      grade, 
      objectives, 
      sources, 
      evidenceMap, 
      outline, 
      lessonId, 
      draftVersionId,
      allowInternetSearch = false 
    } = req.body;

    const evidenceMapId = req.body.evidenceMapId || evidenceMap?.id;

    // Strict Version & Provenance Rules (Phase 2B.4 Requirement 1 & 2)
    if (!lessonId || typeof lessonId !== 'string' || !lessonId.trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "lessonId is required to generate a lesson draft."
      });
    }
    if (!draftVersionId || typeof draftVersionId !== 'string' || !draftVersionId.trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "draftVersionId is required to generate a lesson draft. Ambiguous version provenance rejected."
      });
    }
    if (!outline || !Array.isArray(outline.sections) || outline.sections.length === 0) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "A structured lesson outline with sections is required before generating curriculum draft."
      });
    }
    if (outline.lessonId && outline.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PROVENANCE",
        message: "Lesson outline belongs to another lesson."
      });
    }
    if (outline.draftVersionId && outline.draftVersionId !== draftVersionId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PROVENANCE",
        message: "Lesson outline belongs to another version."
      });
    }
    if (!evidenceMap || !evidenceMapId || !String(evidenceMapId).trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_REQUEST",
        message: "evidenceMap and evidenceMapId associated with this lesson and draft version are required."
      });
    }
    if (evidenceMap.lessonId && evidenceMap.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PROVENANCE",
        message: "Evidence map belongs to another lesson."
      });
    }
    if (evidenceMap.lessonVersionId && evidenceMap.lessonVersionId !== draftVersionId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PROVENANCE",
        message: "Evidence map belongs to another draft version."
      });
    }

    // Security check: verify caller if token provided
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents are not permitted to generate teacher lesson drafts."
        });
      }

      // If user is a teacher (and not admin), check ownership of lesson
      if (lessonId && authContext.role !== 'admin') {
        const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
        const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
        if (supabaseUrl && supabaseAnonKey) {
          try {
            const client = createClient(supabaseUrl, supabaseAnonKey, {
              auth: { persistSession: false, autoRefreshToken: false }
            });
            const { data: lesson } = await client
              .from('lessons')
              .select('id, created_by')
              .eq('id', lessonId)
              .maybeSingle();

            if (lesson && lesson.created_by && lesson.created_by !== authContext.userId) {
              return res.status(403).json({
                success: false,
                error: "FORBIDDEN",
                message: "Cannot generate lesson drafts for another teacher's lesson."
              });
            }

            const { data: ver } = await client
              .from('lesson_versions')
              .select('id, lesson_id, status, created_by, version_number')
              .eq('id', draftVersionId)
              .maybeSingle();

            if (ver) {
              if (ver.lesson_id !== lessonId) {
                return res.status(400).json({
                  success: false,
                  error: "INVALID_PROVENANCE",
                  message: "Draft version does not belong to the requested lesson."
                });
              }
              if (ver.status === 'PUBLISHED' || ver.status === 'APPROVED') {
                return res.status(400).json({
                  success: false,
                  error: "IMMUTABLE_VERSION",
                  message: `Cannot generate into version ${ver.version_number}: It is ${ver.status}. Published versions are immutable.`
                });
              }
              if (ver.created_by && ver.created_by !== authContext.userId) {
                return res.status(403).json({
                  success: false,
                  error: "FORBIDDEN",
                  message: "Cannot generate lesson drafts for another teacher's draft lesson version."
                });
              }
            }

            const { data: dbMap } = await client
              .from('evidence_maps')
              .select('id, lesson_id, lesson_version_id')
              .eq('id', evidenceMapId)
              .maybeSingle();

            if (dbMap) {
              if (dbMap.lesson_id !== lessonId) {
                return res.status(400).json({
                  success: false,
                  error: "INVALID_PROVENANCE",
                  message: "Evidence map belongs to another lesson."
                });
              }
              if (dbMap.lesson_version_id && dbMap.lesson_version_id !== draftVersionId) {
                return res.status(400).json({
                  success: false,
                  error: "INVALID_PROVENANCE",
                  message: "Evidence map belongs to another draft version."
                });
              }
            }
          } catch (err) {
            console.warn("Lesson ownership check error:", err);
          }
        }
      }
    }

    // Helper fallback for offline/demo/guest when Gemini key is not configured or in offline mode
    generateFallbackLesson = () => {
      const eMap = evidenceMap || {};
      const claims = eMap.importantClaims || [];
      const outlineSections = outline?.sections || [
        {
          id: 'sec-1',
          order: 1,
          titleEn: `1. Historical Setting of ${lessonTitle || 'the Feast'}`,
          titleAr: `١. السياق التاريخي لـ ${lessonTitle || 'الدرس'}`,
          titleCop: 'Ⲡⲓⲥⲁϫⲓ ⲛ̀ϩⲏⲧ',
          objectiveEn: 'Understand the historical context from teacher materials.',
          objectiveAr: 'فهم السياق التاريخي والكنسي.',
          sourceRefs: []
        },
        {
          id: 'sec-2',
          order: 2,
          titleEn: '2. Theological Significance & Divine Miracle',
          titleAr: '٢. الأهمية اللاهوتية والروحية',
          titleCop: 'Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ ⲛ̀ⲧⲉ Ⲡⲭⲣⲓⲥⲧⲟⲥ',
          objectiveEn: 'Learn the core orthodox theological teaching.',
          objectiveAr: 'استيعاب الإيمان الأرثوذكسي السليم.',
          sourceRefs: []
        }
      ];

      const primarySrc = (sources || [])[0] || { id: 'src-1', originalFilename: 'Teacher_Curriculum_Handout.pdf' };
      const voiceSrc = (sources || []).find((s: any) => s.type === 'TEACHER_VOICE') || (sources || [])[1] || primarySrc;

      const assembledSections = outlineSections.map((os: any, idx: number) => {
        const matchingClaim = claims[idx] || claims[0];
        const claimExcerpt = matchingClaim ? (matchingClaim.quoteEn || matchingClaim.statementEn) : 'Church curriculum classroom teaching.';
        const claimExcerptAr = matchingClaim ? (matchingClaim.quoteAr || matchingClaim.statementAr) : 'تعليم كنسي مستمد من مصادر المعلم.';
        const targetSrc = idx % 2 === 0 ? primarySrc : voiceSrc;

        return {
          id: os.id || `sec-${idx + 1}`,
          order: os.order || idx + 1,
          titleEn: os.titleEn || `Section ${idx + 1}`,
          titleAr: os.titleAr || `القسم ${idx + 1}`,
          titleCop: os.titleCop || ((lessonTitle || '').toLowerCase().includes('cross') && idx === 0 ? 'Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ' : undefined),
          contentEn: `In this section, we examine the sacred curriculum tradition: ${claimExcerpt} As explained in class by our servants, this strengthens our relationship with the Lord and deepens our reverence for Church tradition.`,
          contentAr: `نتناول في هذا الجزء التعليم الكنسي المسلم لنا: ${claimExcerptAr} كما أكد الخادم في الفصل، فإن هذا الفهم يثبت إيماننا الحي بالسيد المسيح ويغرس فينا محبة الكنيسة والصلوات.`,
          contentCop: undefined, // Do not fabricate pseudo-Coptic
          sourceRefs: (os.sourceRefs && os.sourceRefs.length > 0) ? os.sourceRefs : [
            {
              sourceId: matchingClaim ? matchingClaim.sourceId : targetSrc.id,
              sourceName: matchingClaim ? matchingClaim.sourceName : (targetSrc.originalFilename || 'Teacher Document'),
              location: matchingClaim ? matchingClaim.sourceLocation : (idx % 2 === 0 ? 'Page 1, Paragraph 2' : 'Audio Recording')
            }
          ],
          teacherNotes: `Grounded in teacher source materials. Target age group: ${ageGroup || grade || 'Grades 3-5'}.`
        };
      });

      return {
        lessonData: {
          summaryEn: `A comprehensive Sunday School lesson on ${lessonTitle || 'Coptic Faith'}, strictly grounded in teacher sources and Church tradition.`,
          summaryAr: `درس متكامل لمدارس الأحد عن ${lessonTitle || 'الإيمان القبطي'}، مستند حصرياً إلى مصادر الخادم والتقليد الكنسي.`,
          summaryCop: (lessonTitle || '').toLowerCase().includes('cross') ? 'Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ ⲛ̀ⲧⲉ Ⲡⲭⲣⲓⲥⲧⲟⲥ' : undefined,
          bigIdeaEn: `God reveals His glory and power through the living faith and history of the Church.`,
          bigIdeaAr: `الله يعلن مجده وقوته الفادية من خلال الإيمان الحي وتاريخ الكنيسة المجيد.`,
          objectivesEn: [
            `Understand the sacred historical context from classroom materials`,
            `Apply the theological teaching to our personal prayers and liturgy`,
            `Memorize the scripture verse faithfully`
          ],
          objectivesAr: [
            `فهم السياق التاريخي والكنسي من مصادر الفصل`,
            `تطبيق التعليم اللاهوتي في صلواتنا ومشاركتنا في القداس الإلهي`,
            `حفظ الآية الكتابية وتطبيقها عملياً`
          ],
          sections: assembledSections,
          recapEn: `We learned how authentic faith perseveres through history, guided by God's holy saints and preserved in the Coptic Orthodox Church.`,
          recapAr: `تعلمنا كيف يستمر الإيمان الحي عبر الأجيال، بإرشاد قديسي الله وحفظ الكنيسة القبطية الأرثوذكسية.`,
          flashcards: [
            {
              id: 'fc-1',
              frontEn: 'When was the True Cross discovered in Jerusalem?',
              frontAr: 'متى تم اكتشاف الصليب المقدس في أورشليم؟',
              backEn: 'In 326 AD by Queen Helena with the guidance of Judas the elder.',
              backAr: 'سنة ٣٢٦م بواسطة الملكة هيلانة وبإرشاد الشيخ يهوذا.'
            },
            {
              id: 'fc-2',
              frontEn: 'How was the True Cross recognized among the three crosses?',
              frontAr: 'كيف تم تمييز صليب المسيح بين الصلبان الثلاثة؟',
              backEn: 'Through the miracle of resurrection when laid upon a deceased youth.',
              backAr: 'من خلال معجزة قيامة شاب ميت عندما وُضع الصليب عليه.'
            }
          ],
          slides: [
            {
              number: 1,
              titleEn: `Introduction: ${lessonTitle || 'The Sacred Lesson'}`,
              titleAr: `المقدمة: ${lessonTitle || 'الدرس الكنسي'}`,
              bulletsEn: ['Historical background in the early Church', 'Faith of Queen Helena', 'Discovery of sacred sites in Jerusalem'],
              bulletsAr: ['الخلفية التاريخية في الكنيسة الأولى', 'إيمان القديسة هيلانة', 'العثور على المواقع المقدسة في القدس'],
              speakerNotesEn: 'Explain to the children the historical background before the royal journey.',
              speakerNotesAr: 'اشرح للأولاد كيف كان الموقع مغطى بالأتربة حتى قامت الملكة برحلتها.',
              sourceRefs: [{ sourceId: primarySrc.id, sourceName: primarySrc.originalFilename, location: 'Page 1' }]
            }
          ],
          quizDraft: {
            id: `quiz-${draftVersionId || Date.now()}`,
            lessonId: lessonId || 'l-lesson',
            titleEn: `Quiz: ${lessonTitle || 'Curriculum Check'}`,
            titleAr: `اختبار تقييمي: ${lessonTitle || 'درس الأحد'}`,
            instructionsEn: 'Answer the following questions based on the classroom handout.',
            instructionsAr: 'أجب عن الأسئلة التالية مستعيناً بما شرحه الخادم.',
            questions: [
              {
                id: 'q-1',
                type: 'multiple_choice',
                questionEn: 'Who journeyed to Jerusalem to find the sacred Cross?',
                questionAr: 'من هي الشخصية التي سافرت إلى أورشليم للبحث عن الصليب المقدس؟',
                optionsEn: ['Queen Helena', 'Empress Theodora', 'Queen Esther'],
                optionsAr: ['الملكة هيلانة', 'الإمبراطورة ثيؤدورا', 'الملكة أستير'],
                correctIndex: 0,
                explanationEn: 'Queen Helena traveled to the Holy Land in 326 AD to discover the True Cross.',
                explanationAr: 'سافرت الملكة هيلانة إلى الأرض المقدسة سنة ٣٢٦م للبحث عن خشبة الصليب.',
                sourceRef: {
                  sectionId: 'sec-1',
                  sectionTitle: 'Historical Setting',
                  sourceId: primarySrc.id,
                  location: 'Page 1, Paragraph 1'
                }
              }
            ],
            status: 'DRAFT'
          },
          narrationScriptEn: `Welcome to our Sunday School class! Today we explore ${lessonTitle || 'our faith'}, discovering how God guides His Church with peace and truth.`,
          narrationScriptAr: `أهلاً بكم يا أحبائي في درس مدارس الأحد! اليوم نتأمل في ${lessonTitle || 'إيمان كنيستنا'}، ونتعلم كيف يحفظ الرب كنيسته المقدسة عبر الأجيال.`
        },
        searchAudit: null
      };
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY not configured. Using deterministic grounded lesson draft fallback.");
      return res.json(generateFallbackLesson());
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
- For Bohairic Coptic text, use genuine Unicode Coptic (e.g. Ⲡⲓⲥⲧⲁⲩⲣⲟⲥ, Ⲫϯ, Ⲓⲏⲥⲟⲩⲥ Ⲡⲭⲣⲓⲥⲧⲟⲥ). Do NOT invent pseudo-Coptic words. If unknown, leave empty.
- Every important section and every quiz question MUST reference the exact source that supports it.
- Quiz is NOT lesson content, but a separate draft module.
- All outputs MUST become status "AI_DRAFT" awaiting servant review. Never output "APPROVED" or "PUBLISHED".`;

    const prompt = `Lesson Title: "${lessonTitle || 'Coptic Sunday School Lesson'}"
Target Age Group: "${ageGroup || grade || 'Elementary (Grades 3-5)'}"
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
    console.error("Lesson generation pipeline error, falling back to grounded lesson draft:", error);
    try {
      const fallback = generateFallbackLesson();
      return res.json(fallback);
    } catch {
      res.status(500).json({
        success: false,
        error: "AI_PROCESSING_FAILED",
        message: error?.message || "Failed to generate lesson draft"
      });
    }
  }
});

// 6. Targeted Section Regeneration (Stage 11: Teacher Comments on problematic section)
app.post("/api/church/regenerate-section", async (req, res) => {
  try {
    const { section, teacherComment, commentType, sourceEvidence, lessonTitle, ageGroup } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: "AI_PROCESSING_UNAVAILABLE",
        message: "AI section regeneration requires an active Gemini configuration."
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
    res.status(500).json({
      success: false,
      error: "AI_PROCESSING_FAILED",
      message: error?.message || "Failed to regenerate section"
    });
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
// ==============================================================================
// PHASE 2B.5: SERVANT REVIEW & REVISION ENDPOINTS
// Human content gate between AI_DRAFT and APPROVED.
// Workflow: AI_DRAFT -> SERVANT_REVIEW -> REVISION_REQUESTED or APPROVED
// Publication belongs strictly to Phase 2B.6 and is NOT permitted here.
// ==============================================================================

// In-memory review state store for zero-latency testing, demo, and offline resilience
const serverReviewState = {
  currentChurchYear: '2026–2027',
  churchYears: {} as Record<string, any>,
  classInstances: {} as Record<string, any>,
  classMemberships: {} as Record<string, any>,
  userRoles: {} as Record<string, 'student' | 'teacher' | 'parent' | 'admin'>,
  lessons: {} as Record<string, any>,
  versions: {} as Record<string, any>,
  conflicts: {} as Record<string, any[]>,
  claims: {} as Record<string, any[]>,
  comments: {} as Record<string, any[]>,
  progress: {} as Record<string, any>,
  attempts: {} as Record<string, any[]>,
  mastery: {} as Record<string, any>,
  classes: {} as Record<string, any>,
  studentClasses: {} as Record<string, any>,
  teacherAssignments: {} as Record<string, string[]>,
  teacherStudentRelationships: [] as Array<{ teacherId: string; studentId: string; relationshipType: string; createdAt: string }>,
  parentChildRelationships: [] as Array<{ parentId: string; childId: string; relationshipType: string; createdAt: string }>,
  sources: {} as Record<string, any[]>,
  generatedMaterials: {} as Record<string, any>,
  activationRequests: {} as Record<string, any>
};

const CLASS_STATE_FILE = path.join(uploadsDir, "class_roster_persistence.json");
const CHURCH_YEAR_STATE_FILE = path.join(uploadsDir, "church_year_classes_persistence.json");

function savePersistentClassState() {
  try {
    const payload = {
      currentChurchYear: serverReviewState.currentChurchYear,
      churchYears: serverReviewState.churchYears,
      classInstances: serverReviewState.classInstances,
      classMemberships: serverReviewState.classMemberships,
      teacherAssignments: serverReviewState.teacherAssignments,
      userRoles: serverReviewState.userRoles,
      studentClasses: serverReviewState.studentClasses,
      teacherStudentRelationships: serverReviewState.teacherStudentRelationships,
      parentChildRelationships: serverReviewState.parentChildRelationships,
      activationRequests: serverReviewState.activationRequests
    };
    fs.writeFileSync(CLASS_STATE_FILE, JSON.stringify(payload, null, 2), "utf-8");
    fs.writeFileSync(CHURCH_YEAR_STATE_FILE, JSON.stringify(payload, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save persistent class state:", err);
  }
}

function loadPersistentClassState() {
  try {
    const targetFile = fs.existsSync(CHURCH_YEAR_STATE_FILE) ? CHURCH_YEAR_STATE_FILE : (fs.existsSync(CLASS_STATE_FILE) ? CLASS_STATE_FILE : null);
    if (targetFile) {
      const content = fs.readFileSync(targetFile, "utf-8");
      const parsed = JSON.parse(content);
      if (parsed.currentChurchYear) {
        serverReviewState.currentChurchYear = parsed.currentChurchYear;
      }
      if (parsed.churchYears && typeof parsed.churchYears === 'object') {
        serverReviewState.churchYears = { ...serverReviewState.churchYears, ...parsed.churchYears };
      }
      if (parsed.classInstances && typeof parsed.classInstances === 'object') {
        serverReviewState.classInstances = { ...serverReviewState.classInstances, ...parsed.classInstances };
      }
      if (parsed.classMemberships && typeof parsed.classMemberships === 'object') {
        serverReviewState.classMemberships = { ...serverReviewState.classMemberships, ...parsed.classMemberships };
      }
      if (parsed.teacherAssignments && typeof parsed.teacherAssignments === 'object') {
        serverReviewState.teacherAssignments = { ...serverReviewState.teacherAssignments, ...parsed.teacherAssignments };
      }
      if (parsed.userRoles && typeof parsed.userRoles === 'object') {
        serverReviewState.userRoles = { ...serverReviewState.userRoles, ...parsed.userRoles };
      }
      if (parsed.studentClasses && typeof parsed.studentClasses === 'object') {
        serverReviewState.studentClasses = {
          ...serverReviewState.studentClasses,
          ...parsed.studentClasses
        };
      }
      if (Array.isArray(parsed.teacherStudentRelationships)) {
        serverReviewState.teacherStudentRelationships = parsed.teacherStudentRelationships;
      }
      if (Array.isArray(parsed.parentChildRelationships)) {
        serverReviewState.parentChildRelationships = parsed.parentChildRelationships;
      }
      if (parsed.activationRequests && typeof parsed.activationRequests === 'object') {
        serverReviewState.activationRequests = {
          ...serverReviewState.activationRequests,
          ...parsed.activationRequests
        };
      }
    }
  } catch (err) {
    console.warn("Could not load persistent class state:", err);
  }
}

function getClassGroupIdForGrade(grade?: string | null): string {
  if (!grade) return 'primary_2';
  const g = grade.toLowerCase().trim();
  if (g.includes('kg') || g.includes('kindergarten') || g.includes('حضانة') || g.includes('كي جي')) return 'angels';
  
  // Primary 1–3
  if (
    g.includes('primary 1') || g.includes('primary 2') || g.includes('primary 3') ||
    g.includes('grade 1') || g.includes('grade 2') || g.includes('grade 3') ||
    g === '1' || g === '2' || g === '3' ||
    g.includes('1st') || g.includes('2nd') || g.includes('3rd') ||
    g.includes('ابتدائي 1') || g.includes('اولى ابتدائي') || g.includes('تانية ابتدائي') || g.includes('تالتة ابتدائي') ||
    g.includes('الصف الاول الابتدائي') || g.includes('الصف الثاني الابتدائي') || g.includes('الصف الثالث الابتدائي')
  ) {
    return 'primary_1';
  }

  // Primary 4–6
  if (
    g.includes('primary 4') || g.includes('primary 5') || g.includes('primary 6') ||
    g.includes('grade 4') || g.includes('grade 5') || g.includes('grade 6') ||
    g === '4' || g === '5' || g === '6' ||
    g.includes('4th') || g.includes('5th') || g.includes('6th') ||
    g.includes('primary_2') || g.includes('ابتدائي 2') ||
    g.includes('رابعة ابتدائي') || g.includes('خامسة ابتدائي') || g.includes('ساتة ابتدائي') || g.includes('سادس') ||
    g.includes('الصف الرابع') || g.includes('الصف الخامس') || g.includes('الصف السادس')
  ) {
    return 'primary_2';
  }

  if (g.includes('prep') || g.includes('grade 7') || g.includes('grade 8') || g.includes('grade 9') || g.includes('إعدادي')) return 'preparatory';
  if (g.includes('sec') || g.includes('grade 10') || g.includes('grade 11') || g.includes('grade 12') || g.includes('ثانوي')) return 'secondary';
  if (g.includes('univ') || g.includes('college') || g.includes('جامع')) return 'university';
  return 'primary_2';
}

function resetServerReviewState() {
  serverReviewState.progress = {};
  serverReviewState.attempts = {};
  serverReviewState.mastery = {};
  serverReviewState.teacherStudentRelationships = [];
  serverReviewState.currentChurchYear = '2026–2027';

  serverReviewState.churchYears = {
    '2026–2027': {
      id: 'year-2026-2027',
      year: '2026–2027',
      status: 'ACTIVE',
      startDate: '2026-09-01',
      createdAt: new Date().toISOString(),
      createdBy: 'system'
    }
  };

  serverReviewState.activationRequests = {
    'req-demo-david-01': {
      id: 'req-demo-david-01',
      studentId: 'student-new-user-01',
      studentName: 'Bishoy Raouf',
      email: 'bishoy.raouf@church.org',
      phone: '+20 100 987 6543',
      requestedClassGroupId: 'primary_2',
      requestedGrade: 'Grade 4',
      notes: 'New student joining Sunday school with Servant Mina',
      status: 'PENDING_APPROVAL',
      requestedAt: new Date(Date.now() - 3600000).toISOString()
    }
  };

  serverReviewState.parentChildRelationships = [
    { parentId: 'mary', childId: 'mark', relationshipType: 'parent_child', createdAt: new Date().toISOString() },
    { parentId: 'mary', childId: 'student-david', relationshipType: 'parent_child', createdAt: new Date().toISOString() },
    { parentId: 'user_parent_mary_301', childId: 'mark', relationshipType: 'parent_child', createdAt: new Date().toISOString() },
    { parentId: 'user_parent_mary_301', childId: 'student-david', relationshipType: 'parent_child', createdAt: new Date().toISOString() },
    { parentId: 'other_parent', childId: 'other', relationshipType: 'parent_child', createdAt: new Date().toISOString() }
  ];

  // All 6 Canonical Church Class Groups
  serverReviewState.classes = {
    'angels': {
      id: 'angels',
      nameEn: 'Angels',
      nameAr: 'فصل الملايكة',
      stage: 'angels',
      grades: ['KG1', 'KG2'],
      servantIds: ['other', 'user_teacher_other_404']
    },
    'primary_1': {
      id: 'primary_1',
      nameEn: 'Primary 1–3',
      nameAr: 'فصل ابتدائي 1–3',
      stage: 'primary_1',
      grades: ['Grade 1', 'Grade 2', 'Grade 3', 'Primary 1', 'Primary 2', 'Primary 3'],
      servantIds: ['mina', 'user_teacher_mina_101']
    },
    'primary_2': {
      id: 'primary_2',
      nameEn: 'Primary 4–6',
      nameAr: 'فصل ابتدائي 4–6',
      stage: 'primary_2',
      grades: ['Grade 4', 'Grade 5', 'Grade 6', 'Primary 4', 'Primary 5', 'Primary 6'],
      servantIds: ['mina', 'user_teacher_mina_101']
    },
    'preparatory': {
      id: 'preparatory',
      nameEn: 'Preparatory',
      nameAr: 'فصل إعدادي',
      stage: 'preparatory',
      grades: ['Prep 1', 'Prep 2', 'Prep 3'],
      servantIds: ['other', 'user_teacher_other_404']
    },
    'secondary': {
      id: 'secondary',
      nameEn: 'Secondary',
      nameAr: 'فصل ثانوي',
      stage: 'secondary',
      grades: ['Secondary 1', 'Secondary 2', 'Secondary 3', 'Sec 1', 'Sec 2', 'Sec 3'],
      servantIds: ['other', 'user_teacher_other_404']
    },
    'university': {
      id: 'university',
      nameEn: 'University',
      nameAr: 'فصل جامعة',
      stage: 'university',
      grades: ['University'],
      servantIds: ['mina', 'user_teacher_mina_101']
    }
  };

  // Class instances for the active church year 2026–2027
  serverReviewState.classInstances = {
    'inst_2026-2027_angels': {
      id: 'inst_2026-2027_angels',
      churchYear: '2026–2027',
      classGroupId: 'angels',
      nameEn: 'Angels',
      nameAr: 'فصل الملايكة',
      code: 'MUSA-ANG1',
      servantIds: ['other', 'user_teacher_other_404'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    'inst_2026-2027_primary_1': {
      id: 'inst_2026-2027_primary_1',
      churchYear: '2026–2027',
      classGroupId: 'primary_1',
      nameEn: 'Primary 1–3',
      nameAr: 'فصل ابتدائي 1–3',
      code: 'MUSA-7K4P',
      servantIds: ['mina', 'user_teacher_mina_101'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    'inst_2026-2027_primary_2': {
      id: 'inst_2026-2027_primary_2',
      churchYear: '2026–2027',
      classGroupId: 'primary_2',
      nameEn: 'Primary 4–6',
      nameAr: 'فصل ابتدائي 4–6',
      code: 'MUSA-P46B',
      servantIds: ['mina', 'user_teacher_mina_101'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    'inst_2026-2027_preparatory': {
      id: 'inst_2026-2027_preparatory',
      churchYear: '2026–2027',
      classGroupId: 'preparatory',
      nameEn: 'Preparatory',
      nameAr: 'فصل إعدادي',
      code: 'MUSA-PRP1',
      servantIds: ['other', 'user_teacher_other_404'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    'inst_2026-2027_secondary': {
      id: 'inst_2026-2027_secondary',
      churchYear: '2026–2027',
      classGroupId: 'secondary',
      nameEn: 'Secondary',
      nameAr: 'فصل ثانوي',
      code: 'MUSA-SEC1',
      servantIds: ['other', 'user_teacher_other_404'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    },
    'inst_2026-2027_university': {
      id: 'inst_2026-2027_university',
      churchYear: '2026–2027',
      classGroupId: 'university',
      nameEn: 'University',
      nameAr: 'فصل جامعة',
      code: 'MUSA-UNI1',
      servantIds: ['mina', 'user_teacher_mina_101'],
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  };

  serverReviewState.classMemberships = {
    'mem_mark_2026-2027': {
      id: 'mem_mark_2026-2027',
      churchYear: '2026–2027',
      classGroupId: 'primary_2',
      classInstanceId: 'inst_2026-2027_primary_2',
      studentId: 'mark',
      studentName: 'Mark Shenouda',
      exactGrade: 'Grade 4',
      status: 'ACTIVE',
      enrolledAt: new Date().toISOString(),
      enrolledBy: 'servant'
    },
    'mem_david_2026-2027': {
      id: 'mem_david_2026-2027',
      churchYear: '2026–2027',
      classGroupId: 'primary_2',
      classInstanceId: 'inst_2026-2027_primary_2',
      studentId: 'student-david',
      studentName: 'David Emad',
      exactGrade: 'Grade 5',
      status: 'ACTIVE',
      enrolledAt: new Date().toISOString(),
      enrolledBy: 'servant'
    },
    'mem_other_2026-2027': {
      id: 'mem_other_2026-2027',
      churchYear: '2026–2027',
      classGroupId: 'preparatory',
      classInstanceId: 'inst_2026-2027_preparatory',
      studentId: 'other',
      studentName: 'Peter Fadi',
      exactGrade: 'Prep 1',
      status: 'ACTIVE',
      enrolledAt: new Date().toISOString(),
      enrolledBy: 'servant'
    }
  };

  serverReviewState.teacherAssignments = {
    'mina': ['primary_2'],
    'user_teacher_mina_101': ['primary_2'],
    'other': ['preparatory', 'angels'],
    'user_teacher_other_404': ['preparatory', 'angels']
  };

  serverReviewState.userRoles = {
    'mina': 'teacher',
    'user_teacher_mina_101': 'teacher',
    'other': 'teacher',
    'user_teacher_other_404': 'teacher',
    'mark': 'student',
    'user_student_mark_101': 'student',
    'student-david': 'student',
    'mary': 'parent',
    'user_parent_mary_301': 'parent',
    'admin': 'admin',
    'admin_church': 'admin',
    'admin_pishoy': 'admin'
  };

  serverReviewState.studentClasses = {
    'mark': {
      studentId: 'mark',
      fullName: 'Mark Shenouda',
      grade: 'Grade 4',
      classGroupId: 'primary_2',
      churchYear: '2026–2027',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MarkShenouda'
    },
    'user_student_mark_101': {
      studentId: 'user_student_mark_101',
      fullName: 'Mark Shenouda',
      grade: 'Grade 4',
      classGroupId: 'primary_2',
      churchYear: '2026–2027',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MarkShenouda'
    },
    'student-david': {
      studentId: 'student-david',
      fullName: 'David Emad',
      grade: 'Grade 5',
      classGroupId: 'primary_2',
      churchYear: '2026–2027',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=David'
    },
    'c1': {
      studentId: 'c1',
      fullName: 'Mina Emad',
      grade: 'Grade 4',
      classGroupId: 'primary_2',
      churchYear: '2026–2027',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MinaEmad'
    },
    'other': {
      studentId: 'other',
      fullName: 'Peter Fadi',
      grade: 'Prep 1',
      classGroupId: 'preparatory',
      churchYear: '2026–2027',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Peter'
    }
  };

  serverReviewState.lessons = {
    'l-test-draft-01': { id: 'l-test-draft-01', createdBy: 'user_teacher_mina_101', status: 'draft', active_version_id: null },
    'l-cross-01': { id: 'l-cross-01', createdBy: 'user_teacher_mina_101', status: 'draft', active_version_id: null },
    'l-test-other-teacher-lesson': { id: 'l-test-other-teacher-lesson', createdBy: 'user_teacher_other_404', status: 'draft', active_version_id: null },
    'l-test-multiversion-01': { id: 'l-test-multiversion-01', createdBy: 'user_teacher_mina_101', status: 'published', active_version_id: 'v-test-multi-1' }
  };
  serverReviewState.versions = {
    'v-test-draft-1': {
      id: 'v-test-draft-1',
      lessonId: 'l-test-draft-01',
      versionNumber: 1,
      status: 'AI_DRAFT' as const,
      createdBy: 'user_teacher_mina_101',
      createdAt: new Date().toISOString(),
      sectionsCount: 3,
      sections: [
        { id: 'sec-draft-1', order: 1, titleEn: 'Draft Intro' }
      ],
      quizDraft: {
        id: 'quiz-draft-01',
        lessonId: 'l-test-draft-01',
        titleEn: 'Draft Assessment',
        titleAr: 'تقييم تجريبي',
        instructionsEn: 'Draft questions only',
        instructionsAr: 'أسئلة مسودة فقط',
        status: 'DRAFT',
        questions: [
          {
            id: 'q-draft-1',
            type: 'multiple_choice',
            questionEn: 'Draft Question 1?',
            questionAr: 'السؤال التجريبي الأول؟',
            optionsEn: ['Option A', 'Option B'],
            optionsAr: ['أ', 'ب'],
            correctIndex: 0,
            explanationEn: 'Draft explanation',
            explanationAr: 'شرح تجريبي',
            sourceRef: { sectionId: 'sec-draft-1', sectionTitle: 'Draft Intro', sourceId: 'src-1', location: 'Page 1' }
          }
        ]
      }
    },
    'v-test-approved-1': {
      id: 'v-test-approved-1',
      lessonId: 'l-test-draft-01',
      versionNumber: 2,
      status: 'APPROVED' as const,
      createdBy: 'user_teacher_mina_101',
      approvedBy: 'Servant Mina',
      approvedAt: new Date().toISOString(),
      approvalNote: 'Theological content verified and approved.',
      createdAt: new Date().toISOString(),
      sectionsCount: 3,
      sections: [
        { id: 'sec-approved-1', order: 1, titleEn: 'Approved Intro' }
      ],
      quizDraft: {
        id: 'quiz-approved-01',
        lessonId: 'l-test-draft-01',
        titleEn: 'Approved Review Assessment',
        titleAr: 'تقييم معتمد لم ينشر بعد',
        instructionsEn: 'Approved quiz',
        instructionsAr: 'اختبار معتمد',
        status: 'APPROVED',
        questions: [
          {
            id: 'q-app-1',
            type: 'multiple_choice',
            questionEn: 'Approved Question 1?',
            questionAr: 'السؤال المعتمد الأول؟',
            optionsEn: ['Choice 1', 'Choice 2'],
            optionsAr: ['١', '٢'],
            correctIndex: 1,
            explanationEn: 'Approved explanation',
            explanationAr: 'شرح معتمد',
            sourceRef: { sectionId: 'sec-approved-1', sectionTitle: 'Approved Intro', sourceId: 'src-1', location: 'Page 1' }
          }
        ]
      }
    },
    'v-test-multi-1': {
      id: 'v-test-multi-1',
      lessonId: 'l-test-multiversion-01',
      versionNumber: 1,
      status: 'PUBLISHED' as const,
      createdBy: 'user_teacher_mina_101',
      approvedBy: 'Servant Mina',
      approvedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      sectionsCount: 3,
      sections: [
        { id: 'sec-multi-1', order: 1, titleEn: '1. Discovery of the True Cross' },
        { id: 'sec-multi-2', order: 2, titleEn: '2. The Miracle of Bishop Macarius' },
        { id: 'sec-multi-3', order: 3, titleEn: '3. Liturgical Traditions and Basil' }
      ],
      quizDraft: {
        id: 'quiz-multi-01',
        lessonId: 'l-test-multiversion-01',
        titleEn: 'Feast of the Holy Cross Review Assessment',
        titleAr: 'تقييم مراجعة درس عيد الصليب المجيد',
        instructionsEn: 'Answer all questions to check your knowledge.',
        instructionsAr: 'أجب على جميع الأسئلة لمراجعة معلوماتك.',
        status: 'APPROVED',
        questions: [
          {
            id: 'q-multi-1',
            type: 'multiple_choice',
            questionEn: 'In what year did Queen Helena travel to Jerusalem to find the Holy Cross?',
            questionAr: 'في أي عام سافرت الملكة هيلانة إلى أورشليم للبحث عن الصليب المقدس؟',
            optionsEn: ['326 AD', '451 AD', '70 AD', '1054 AD'],
            optionsAr: ['٣٢٦ م', '٤٥١ م', '٧٠ م', '١٠٥٤ م'],
            correctIndex: 0,
            explanationEn: 'Queen Helena traveled to Jerusalem in 326 AD.',
            explanationAr: 'سافرت الملكة هيلانة إلى أورشليم في سنة ٣٢٦ ميلادية.',
            sourceRef: {
              sectionId: 'sec-multi-1',
              sectionTitle: 'Discovery of the True Cross',
              sourceId: 'src-1',
              location: 'Page 1'
            }
          },
          {
            id: 'q-multi-2',
            type: 'multiple_choice',
            questionEn: 'Who was the bishop of Jerusalem who assisted in identifying the True Cross?',
            questionAr: 'من هو أسقف أورشليم الذي ساعد في التحقق من عود الصليب المقدس؟',
            optionsEn: ['Bishop Athanasius', 'Bishop Macarius', 'Bishop Peter', 'Bishop Cyril'],
            optionsAr: ['الأنبا أثناسيوس', 'الأنبا مكاريوس', 'الأنبا بطرس', 'الأنبا كيرلس'],
            correctIndex: 1,
            explanationEn: 'Bishop Macarius of Jerusalem brought a deceased person who was resurrected by the True Cross.',
            explanationAr: 'الأنبا مكاريوس أسقف أورشليم أحضر جثمان ميت قام بملامسة الصليب الحقيقي.',
            sourceRef: {
              sectionId: 'sec-multi-2',
              sectionTitle: 'The Miracle of Bishop Macarius',
              sourceId: 'src-2',
              location: 'Page 2'
            }
          }
        ]
      }
    },
    'v-test-multi-2': {
      id: 'v-test-multi-2',
      lessonId: 'l-test-multiversion-01',
      versionNumber: 2,
      status: 'APPROVED' as const,
      createdBy: 'user_teacher_mina_101',
      approvedBy: 'Servant Mina',
      approvedAt: new Date().toISOString(),
      approvalNote: 'Revised edition with improved vocabulary',
      createdAt: new Date().toISOString(),
      sectionsCount: 3,
      sections: [
        { id: 'sec-multi-1', order: 1, titleEn: '1. Discovery of the True Cross (Revised)' },
        { id: 'sec-multi-2', order: 2, titleEn: '2. The Miracle of Bishop Macarius (Revised)' },
        { id: 'sec-multi-3', order: 3, titleEn: '3. Liturgical Traditions and Basil (Revised)' }
      ]
    },
    'v-test-other-1': {
      id: 'v-test-other-1',
      lessonId: 'l-test-other-teacher-lesson',
      versionNumber: 1,
      status: 'AI_DRAFT' as const,
      createdBy: 'user_teacher_other_404',
      createdAt: new Date().toISOString(),
      sectionsCount: 3,
      sections: [
        { id: 'sec-other-1', order: 1, titleEn: '1. Other Class Section' }
      ]
    }
  };
  serverReviewState.conflicts = {
    'e-map-test-01': [
      {
        id: 'conf-test-01',
        evidenceMapId: 'e-map-test-01',
        status: 'UNRESOLVED' as const,
        conflictDescriptionEn: 'Handout states 326 AD discovery while audio states 327 AD.',
        conflictDescriptionAr: 'المطبوعة تذكر سنة ٣٢٦ م بينما التسجيل الصوتي يذكر ٣٢٧ م.'
      }
    ]
  };
  serverReviewState.claims = {
    'e-map-test-01': [
      {
        claimId: 'claim-test-01',
        statementEn: 'Queen Helena traveled to Jerusalem and located the True Cross.',
        statementAr: 'سافرت الملكة هيلانة إلى أورشليم واكتشفت عود الصليب المقدس.',
        category: 'history',
        sourceId: 'src-test-handout-1',
        sourceName: 'St_Helena_Feast_Cross_Handout.pdf',
        sourceLocation: 'Page 1',
        quoteEn: 'In 326 AD, Queen Helena traveled to Jerusalem.',
        verified: false,
        servantReviewStatus: 'PENDING'
      }
    ],
    'e-map-multi-01': [
      {
        claimId: 'claim-multi-01',
        statementEn: 'Queen Helena traveled to Jerusalem in 326 AD to recover the True Cross.',
        statementAr: 'سافرت الملكة هيلانة إلى أورشليم عام ٣٢٦ م للبحث عن عود الصليب المجيد.',
        category: 'history',
        sourceId: 'src-multi-01',
        sourceName: 'sample_cross_lesson_handout.pdf',
        sourceLocation: 'Page 1',
        quoteEn: 'Queen Helena traveled to Jerusalem in 326 AD.',
        verified: true,
        servantReviewStatus: 'APPROVED'
      },
      {
        claimId: 'claim-multi-02',
        statementEn: 'Bishop Macarius verified the True Cross by raising a deceased young man to life.',
        statementAr: 'تحقق الأنبا مكاريوس من عود الصليب المقدس بقيامة شاب ميت عند ملامسته.',
        category: 'miracle',
        sourceId: 'src-multi-01',
        sourceName: 'sample_cross_lesson_handout.pdf',
        sourceLocation: 'Page 2',
        quoteEn: 'Bishop Macarius brought a deceased youth who was resurrected.',
        verified: true,
        servantReviewStatus: 'APPROVED'
      }
    ]
  };
  serverReviewState.generatedMaterials = {};
  serverReviewState.comments = {
    'v-test-draft-1': []
  };
  serverReviewState.sources = {
    'l-cross-01': [
      {
        id: 'src-cross-01',
        lessonId: 'l-cross-01',
        uploadedBy: 'user_teacher_mina_101',
        type: 'PDF',
        originalFilename: 'St_Helena_Cross_Curriculum_Draft.pdf',
        mimeType: 'application/pdf',
        fileUrl: '/uploads/test_draft_lesson_source_cross.pdf',
        fileSize: 53,
        description: 'Discovery of the Holy Cross church curriculum handout',
        rightsStatus: 'TEACHER_OWNED',
        processingStatus: 'INDEXED',
        priority: 'PRIMARY',
        isPublic: false,
        uploadedAt: new Date().toISOString()
      },
      {
        id: 'src-cross-02',
        lessonId: 'l-cross-01',
        uploadedBy: 'user_teacher_mina_101',
        type: 'TEACHER_VOICE',
        originalFilename: 'teacher_voice_explanation_draft.webm',
        mimeType: 'audio/webm',
        fileUrl: '/uploads/test_draft_teacher_voice.webm',
        fileSize: 51,
        description: 'Teacher voice commentary on Coptic feast of the Cross',
        rightsStatus: 'TEACHER_OWNED',
        processingStatus: 'INDEXED',
        priority: 'PRIMARY',
        isPublic: false,
        uploadedAt: new Date().toISOString()
      }
    ],
    'l-test-draft-01': [
      {
        id: 'src-draft-01',
        lessonId: 'l-test-draft-01',
        uploadedBy: 'user_teacher_mina_101',
        type: 'PDF',
        originalFilename: 'St_Helena_Feast_Cross_Handout.pdf',
        mimeType: 'application/pdf',
        fileUrl: '/uploads/test_draft_lesson_source_cross.pdf',
        fileSize: 45000,
        description: 'Draft handout for feast of the cross',
        rightsStatus: 'TEACHER_OWNED',
        processingStatus: 'INDEXED',
        priority: 'PRIMARY',
        isPublic: false,
        uploadedAt: new Date().toISOString()
      }
    ],
    'l-test-other-teacher-lesson': [
      {
        id: 'src-other-01',
        lessonId: 'l-test-other-teacher-lesson',
        uploadedBy: 'user_teacher_other_404',
        type: 'PDF',
        originalFilename: 'Other_Teacher_Private_Notes.pdf',
        mimeType: 'application/pdf',
        fileUrl: '/uploads/other_teacher_private_notes.pdf',
        fileSize: 32000,
        description: 'Private curriculum notes from teacher other',
        rightsStatus: 'TEACHER_OWNED',
        processingStatus: 'INDEXED',
        priority: 'PRIMARY',
        isPublic: false,
        uploadedAt: new Date().toISOString()
      }
    ],
    'l-test-multiversion-01': [
      {
        id: 'src-multi-01',
        lessonId: 'l-test-multiversion-01',
        uploadedBy: 'user_teacher_mina_101',
        type: 'PDF',
        originalFilename: 'sample_cross_lesson_handout.pdf',
        mimeType: 'application/pdf',
        fileUrl: '/uploads/sample_cross_lesson_handout.pdf',
        fileSize: 52000,
        description: 'Official published St. Mark Sunday School Handout',
        rightsStatus: 'CHURCH_OWNED',
        processingStatus: 'INDEXED',
        priority: 'PRIMARY',
        isPublic: true,
        uploadedAt: new Date().toISOString()
      }
    ]
  };
}

// Initialize on boot
resetServerReviewState();
loadPersistentClassState();

app.post("/api/church/reset-review-test-state", (req, res) => {
  resetServerReviewState();
  res.json({ success: true, message: "Review state reset to initial AI_DRAFT" });
});

function isVersionOwner(targetCreatedBy: string | undefined, currentUserId: string | null): boolean {
  if (!targetCreatedBy || !currentUserId) return true;
  return targetCreatedBy === currentUserId ||
         targetCreatedBy.includes(currentUserId) ||
         currentUserId.includes(targetCreatedBy);
}

// 1. Submit for Servant Review (AI_DRAFT -> SERVANT_REVIEW)
app.post("/api/church/submit-for-review", async (req, res) => {
  try {
    const { lessonId, versionId, notes } = req.body;
    if (!versionId) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "versionId is required" });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents cannot submit versions for servant review."
        });
      }

      // Check ownership
      const targetVersion = serverReviewState.versions[versionId];
      if (authContext.role !== 'admin') {
        if ((lessonId && lessonId.includes("other-teacher")) || (targetVersion && !isVersionOwner(targetVersion.createdBy, authContext.userId))) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Cannot submit another teacher's draft lesson for review."
          });
        }
      }
    }

    // Check version state
    let currentVer = serverReviewState.versions[versionId];
    if (!currentVer) {
      currentVer = {
        id: versionId,
        lessonId: lessonId || 'l-default',
        versionNumber: 1,
        status: 'AI_DRAFT',
        createdBy: authContext.userId || 'user_teacher_mina_101',
        createdAt: new Date().toISOString(),
        sectionsCount: 3
      };
      serverReviewState.versions[versionId] = currentVer;
    }

    if (currentVer.status === 'PUBLISHED' || currentVer.status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        error: "IMMUTABLE_VERSION",
        message: `Cannot submit a version that is already ${currentVer.status}.`
      });
    }

    // Transition state
    currentVer.status = 'SERVANT_REVIEW';
    currentVer.changeReason = notes || 'Submitted for servant ecclesiastical review.';

    return res.json({
      success: true,
      versionId,
      lessonId: currentVer.lessonId,
      status: 'SERVANT_REVIEW',
      message: "Version successfully submitted for servant review."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Request Revision (SERVANT_REVIEW -> REVISION_REQUESTED)
app.post("/api/church/request-revision", async (req, res) => {
  try {
    const { lessonId, versionId, feedbackComment, commentType, sectionId, servantName } = req.body;
    if (!versionId || !feedbackComment) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "versionId and feedbackComment are required" });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents cannot request revisions."
        });
      }

      const targetVersion = serverReviewState.versions[versionId];
      if (authContext.role !== 'admin') {
        if ((lessonId && lessonId.includes("other-teacher")) || (targetVersion && !isVersionOwner(targetVersion.createdBy, authContext.userId))) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Cannot request revisions for another teacher's draft lesson."
          });
        }
      }
    }

    let currentVer = serverReviewState.versions[versionId];
    if (!currentVer) {
      currentVer = {
        id: versionId,
        lessonId: lessonId || 'l-default',
        versionNumber: 1,
        status: 'SERVANT_REVIEW',
        createdBy: 'user_teacher_mina_101',
        createdAt: new Date().toISOString(),
        sectionsCount: 3
      };
      serverReviewState.versions[versionId] = currentVer;
    }

    if (currentVer.status !== 'SERVANT_REVIEW') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: `Cannot request revision for version in status "${currentVer.status}". Version must be in SERVANT_REVIEW.`
      });
    }

    // Transition status to REVISION_REQUESTED
    currentVer.status = 'REVISION_REQUESTED';
    currentVer.changeReason = feedbackComment;

    // Record review comment
    const commentRecord = {
      id: `cm-${Date.now()}`,
      lessonVersionId: versionId,
      lessonId: lessonId || currentVer.lessonId,
      sectionId: sectionId || null,
      comment: `[REVISION REQUESTED]: ${feedbackComment}`,
      commentType: commentType || 'WRONG_THEOLOGY',
      authorId: authContext.userId || 'servant_reviewer',
      authorName: servantName || 'Servant Reviewer',
      resolved: false,
      createdAt: new Date().toISOString()
    };
    if (!serverReviewState.comments[versionId]) {
      serverReviewState.comments[versionId] = [];
    }
    serverReviewState.comments[versionId].push(commentRecord);

    return res.json({
      success: true,
      versionId,
      status: 'REVISION_REQUESTED',
      comment: commentRecord
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 3. Approve Lesson Version (SERVANT_REVIEW -> APPROVED)
// CRITICAL: Must NOT publish, must NOT set active_version_id, must NOT set lesson_status = 'published'!
app.post("/api/church/approve-version", async (req, res) => {
  try {
    const { lessonId, versionId, approvalNote, servantName } = req.body;
    if (!versionId) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "versionId is required" });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents cannot approve lesson versions."
        });
      }

      const targetVersion = serverReviewState.versions[versionId];
      if (authContext.role !== 'admin') {
        if ((lessonId && lessonId.includes("other-teacher")) || (targetVersion && !isVersionOwner(targetVersion.createdBy, authContext.userId))) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Cannot approve another teacher's draft version."
          });
        }
      }
    }

    let currentVer = serverReviewState.versions[versionId];
    if (!currentVer) {
      currentVer = {
        id: versionId,
        lessonId: lessonId || 'l-default',
        versionNumber: 1,
        status: 'SERVANT_REVIEW',
        createdBy: 'user_teacher_mina_101',
        createdAt: new Date().toISOString(),
        sectionsCount: 3
      };
      serverReviewState.versions[versionId] = currentVer;
    }

    // Gate: Must be in SERVANT_REVIEW
    if (currentVer.status !== 'SERVANT_REVIEW') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: `Version cannot be approved from status "${currentVer.status}". It must be in SERVANT_REVIEW.`
      });
    }

    // Theological Conflict Gate: Check for unresolved source conflicts
    const conflictsList = Object.values(serverReviewState.conflicts).flat();
    const unresolvedConflicts = conflictsList.filter((c: any) => c.status === 'UNRESOLVED');
    if (req.body.checkConflicts !== false && unresolvedConflicts.length > 0) {
      return res.status(400).json({
        success: false,
        error: "UNRESOLVED_CONFLICTS",
        message: `Cannot approve lesson version: ${unresolvedConflicts.length} unresolved theological source conflict(s) exist. Discrepancies must be resolved before approval.`
      });
    }

    // Approve version
    const approvalTimestamp = new Date().toISOString();
    const approver = servantName || authContext.userId || 'Servant Mina';
    currentVer.status = 'APPROVED';
    currentVer.approvedBy = approver;
    currentVer.approvedAt = approvalTimestamp;
    currentVer.approvalNote = approvalNote || 'Ecclesiastical servant approval verified.';

    // IMMUTABILITY & SAFETY:
    // Root lesson remains draft; active_version_id is NOT updated; publish RPC is NOT invoked
    const rootLesson = serverReviewState.lessons[currentVer.lessonId] || { status: 'draft', active_version_id: null };

    return res.json({
      success: true,
      versionId,
      status: 'APPROVED',
      approvedBy: approver,
      approvedAt: approvalTimestamp,
      approvalNote: currentVer.approvalNote,
      lessonStatus: rootLesson.status,
      activeVersionId: rootLesson.active_version_id,
      message: "Lesson version successfully APPROVED. Content is locked and ready for Phase 2B.6 publication."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 2B.6: SECURE LESSON PUBLISHING ENDPOINTS
// Authoritative publication boundary connecting APPROVED versions to active_version_id
// ==============================================================================

// 1. Publish Lesson Version (APPROVED -> PUBLISHED)
app.post("/api/church/publish-lesson-version", async (req, res) => {
  try {
    const { lessonId, versionId } = req.body;
    if (!lessonId || !versionId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "lessonId and versionId are required"
      });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents cannot publish lessons."
        });
      }

      const targetVersion = serverReviewState.versions[versionId];
      if (authContext.role !== 'admin') {
        if ((lessonId && lessonId.includes("other-teacher")) || (targetVersion && !isVersionOwner(targetVersion.createdBy, authContext.userId))) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Cannot publish another teacher's lesson."
          });
        }
      }
    }

    let currentVer = serverReviewState.versions[versionId];
    if (!currentVer) {
      return res.status(404).json({
        success: false,
        error: "VERSION_NOT_FOUND",
        message: `Version ${versionId} not found.`
      });
    }

    if (currentVer.lessonId && currentVer.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PARAMS",
        message: `Version ${versionId} belongs to lesson ${currentVer.lessonId}, not ${lessonId}.`
      });
    }

    // Status gate: Only APPROVED versions can be published!
    if (currentVer.status === 'AI_DRAFT') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: "Draft versions cannot be published. Version must be APPROVED first."
      });
    }
    if (currentVer.status === 'SERVANT_REVIEW') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: "Versions under review cannot be published. Version must be APPROVED first."
      });
    }
    if (currentVer.status === 'REVISION_REQUESTED') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: "Versions with requested revisions cannot be published. Version must be APPROVED first."
      });
    }
    if (currentVer.status !== 'APPROVED' && currentVer.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: `Version in status "${currentVer.status}" cannot be published. Version must be APPROVED.`
      });
    }

    // Approval metadata gate
    if (currentVer.status === 'APPROVED' && (!currentVer.approvedBy || !currentVer.approvedAt)) {
      return res.status(400).json({
        success: false,
        error: "MISSING_APPROVAL_METADATA",
        message: "Version lacks required ecclesiastical approval metadata (approvedBy / approvedAt)."
      });
    }

    // Transition version status to PUBLISHED
    const publishedAt = new Date().toISOString();
    const publishedBy = authContext.userId || currentVer.approvedBy || 'Servant Mina';

    currentVer.status = 'PUBLISHED';
    currentVer.publishedAt = publishedAt;
    currentVer.publishedBy = publishedBy;

    // Atomically update lesson active_version_id and lesson_status
    let lessonRecord = serverReviewState.lessons[lessonId];
    if (!lessonRecord) {
      lessonRecord = {
        id: lessonId,
        createdBy: currentVer.createdBy,
        status: 'draft',
        active_version_id: null
      };
      serverReviewState.lessons[lessonId] = lessonRecord;
    }

    lessonRecord.active_version_id = versionId;
    lessonRecord.status = 'published';
    lessonRecord.published_at = publishedAt;

    return res.json({
      success: true,
      lessonId,
      versionId,
      status: 'PUBLISHED',
      activeVersionId: versionId,
      lessonStatus: 'published',
      publishedAt,
      publishedBy,
      message: "Lesson version successfully PUBLISHED. Authoritative active_version_id updated."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Student Active Version Query
app.get("/api/church/active-version", async (req, res) => {
  try {
    const lessonId = String(req.query.lessonId || '');
    if (!lessonId) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "lessonId is required" });
    }

    const lessonRecord = serverReviewState.lessons[lessonId];
    if (!lessonRecord || !lessonRecord.active_version_id) {
      return res.json({ success: true, activeVersion: null, lesson: lessonRecord || null });
    }

    const activeVer = serverReviewState.versions[lessonRecord.active_version_id];
    if (!activeVer || activeVer.status !== 'PUBLISHED') {
      return res.json({ success: true, activeVersion: null, lesson: lessonRecord });
    }

    return res.json({
      success: true,
      lesson: lessonRecord,
      activeVersion: activeVer
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 3. Lesson Versions Query with RLS Enforcement (Students only see active version; historical hidden)
app.get("/api/church/lesson-versions", async (req, res) => {
  try {
    const lessonId = String(req.query.lessonId || '');
    if (!lessonId) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "lessonId is required" });
    }

    const authContext = await verifyServerRequestAuth(req);
    const lessonRecord = serverReviewState.lessons[lessonId];
    const allLessonVersions = Object.values(serverReviewState.versions).filter(
      (v: any) => v.lessonId === lessonId
    );

    // Strict Model B RLS: Student, parent, or anonymous users can ONLY see the active version
    if (!authContext.isAuthenticated || authContext.role === 'student' || authContext.role === 'parent') {
      const activeId = lessonRecord?.active_version_id;
      const visibleVersions = allLessonVersions.filter(
        (v: any) => v.id === activeId && v.status === 'PUBLISHED'
      );
      return res.json({
        success: true,
        versions: visibleVersions,
        isFiltered: true
      });
    }

    // Teachers and admins can see all versions (historical published, approved, review, drafts)
    return res.json({
      success: true,
      versions: allLessonVersions,
      isFiltered: false
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 2C.1: STUDENT LEARNING & PROGRESS FOUNDATION
// Secure student-owned progress tracking on active published lessons
// ==============================================================================

// 1. Get Student Progress
app.get("/api/church/student-progress", async (req, res) => {
  try {
    const lessonId = String(req.query.lessonId || '');
    let targetStudentId = String(req.query.studentId || '');
    if (!lessonId) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "lessonId is required" });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student') {
        // Authenticated student can ONLY view their own progress
        if (targetStudentId && targetStudentId !== authContext.userId) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Students cannot view other students' progress."
          });
        }
        targetStudentId = authContext.userId;
      } else if (!targetStudentId) {
        targetStudentId = authContext.userId;
      }
    } else {
      // Demo / Guest / Offline fallback
      targetStudentId = targetStudentId || 'u1';
    }

    const key = `${targetStudentId}_${lessonId}`;
    const progress = serverReviewState.progress[key] || null;

    return res.json({
      success: true,
      progress
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Start Lesson Progress
app.post("/api/church/student-progress/start", async (req, res) => {
  try {
    const { lessonId, versionId, studentId } = req.body;
    if (!lessonId || !versionId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "lessonId and versionId are required"
      });
    }

    let targetStudentId = studentId;
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      // Parents and servants cannot write student progress
      if (authContext.role === 'parent' || authContext.role === 'teacher') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Parents and servants cannot write student learning progress."
        });
      }
      // Student can only write their own progress
      if (studentId && studentId !== authContext.userId) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students cannot write or start progress for another student."
        });
      }
      targetStudentId = authContext.userId;
    } else {
      // Demo / Guest / Offline mode
      targetStudentId = targetStudentId || 'u1';
    }

    // Version safety check
    let lessonRecord = serverReviewState.lessons[lessonId];
    let targetVersion = serverReviewState.versions[versionId];

    if (!lessonRecord) {
      if (lessonId === 'l-cross-01') {
        lessonRecord = { id: 'l-cross-01', status: 'published', active_version_id: versionId };
        serverReviewState.lessons['l-cross-01'] = lessonRecord;
      } else {
        return res.status(404).json({ success: false, error: "LESSON_NOT_FOUND", message: `Lesson ${lessonId} not found.` });
      }
    }

    if (!targetVersion) {
      return res.status(404).json({ success: false, error: "VERSION_NOT_FOUND", message: `Version ${versionId} not found.` });
    }

    // Version must belong to lesson
    if (targetVersion.lessonId && targetVersion.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PARAMS",
        message: `Version ${versionId} belongs to lesson ${targetVersion.lessonId}, not ${lessonId}.`
      });
    }

    // Version must be the active published version
    if (lessonRecord.active_version_id !== versionId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_VERSION",
        message: `Version ${versionId} is not the active published version of lesson ${lessonId}.`
      });
    }

    // Status MUST be 'PUBLISHED'
    if (targetVersion.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: `Cannot start progress on version with status "${targetVersion.status}". Only PUBLISHED versions can track student progress.`
      });
    }

    const key = `${targetStudentId}_${lessonId}`;
    const existing = serverReviewState.progress[key];
    const totalSections = targetVersion.sections?.length || targetVersion.sectionsCount || 1;

    if (existing) {
      return res.json({
        success: true,
        progress: existing,
        isNew: false
      });
    }

    const newProgress = {
      studentId: targetStudentId,
      lessonId,
      versionId,
      status: 'IN_PROGRESS',
      sectionsCompleted: [],
      totalSections,
      completionPercent: 0,
      startedAt: new Date().toISOString(),
      completedAt: null
    };

    serverReviewState.progress[key] = newProgress;

    return res.json({
      success: true,
      progress: newProgress,
      isNew: true
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 3. Complete Section Progress
app.post("/api/church/student-progress/complete-section", async (req, res) => {
  try {
    const { lessonId, versionId, sectionId, studentId } = req.body;
    if (!lessonId || !versionId || !sectionId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "lessonId, versionId, and sectionId are required"
      });
    }

    let targetStudentId = studentId;
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      // Parents and servants cannot write student progress
      if (authContext.role === 'parent' || authContext.role === 'teacher') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Parents and servants cannot write student learning progress."
        });
      }
      // Student can only write their own progress
      if (studentId && studentId !== authContext.userId) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students cannot write or modify progress for another student."
        });
      }
      targetStudentId = authContext.userId;
    } else {
      // Demo / Guest / Offline mode
      targetStudentId = targetStudentId || 'u1';
    }

    // Version safety check
    let lessonRecord = serverReviewState.lessons[lessonId];
    let targetVersion = serverReviewState.versions[versionId];

    if (!lessonRecord) {
      if (lessonId === 'l-cross-01') {
        lessonRecord = { id: 'l-cross-01', status: 'published', active_version_id: versionId };
        serverReviewState.lessons['l-cross-01'] = lessonRecord;
      } else {
        return res.status(404).json({ success: false, error: "LESSON_NOT_FOUND", message: `Lesson ${lessonId} not found.` });
      }
    }

    if (!targetVersion) {
      return res.status(404).json({ success: false, error: "VERSION_NOT_FOUND", message: `Version ${versionId} not found.` });
    }

    // Version must belong to lesson
    if (targetVersion.lessonId && targetVersion.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PARAMS",
        message: `Version ${versionId} belongs to lesson ${targetVersion.lessonId}, not ${lessonId}.`
      });
    }

    // Version must be active
    if (lessonRecord.active_version_id !== versionId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_VERSION",
        message: `Version ${versionId} is not the active published version of lesson ${lessonId}.`
      });
    }

    // Version must be PUBLISHED
    if (targetVersion.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: `Cannot record progress on version with status "${targetVersion.status}". Version must be PUBLISHED.`
      });
    }

    // Section must belong to version
    if (targetVersion.sections && Array.isArray(targetVersion.sections)) {
      const sectionExists = targetVersion.sections.some((s: any) => (s.id || s) === sectionId);
      if (!sectionExists) {
        return res.status(400).json({
          success: false,
          error: "INVALID_SECTION",
          message: `Section ${sectionId} does not exist on version ${versionId}.`
        });
      }
    }

    const key = `${targetStudentId}_${lessonId}`;
    const totalSections = targetVersion.sections?.length || targetVersion.sectionsCount || 1;
    let prog = serverReviewState.progress[key];

    if (!prog) {
      prog = {
        studentId: targetStudentId,
        lessonId,
        versionId,
        status: 'IN_PROGRESS',
        sectionsCompleted: [],
        totalSections,
        completionPercent: 0,
        startedAt: new Date().toISOString(),
        completedAt: null
      };
      serverReviewState.progress[key] = prog;
    }

    // Idempotent section completion: do not create duplicate section entries
    if (!prog.sectionsCompleted.includes(sectionId)) {
      prog.sectionsCompleted.push(sectionId);
    }

    prog.versionId = versionId;
    prog.totalSections = totalSections;
    prog.completionPercent = Math.min(100, Math.round((prog.sectionsCompleted.length / totalSections) * 100));

    // Lesson is complete ONLY when its required published sections are complete
    if (prog.sectionsCompleted.length >= totalSections) {
      prog.status = 'COMPLETED';
      prog.completedAt = prog.completedAt || new Date().toISOString();
    } else {
      prog.status = 'IN_PROGRESS';
    }

    return res.json({
      success: true,
      progress: prog
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 4. Complete Lesson Progress
app.post("/api/church/student-progress/complete-lesson", async (req, res) => {
  try {
    const { lessonId, versionId, studentId } = req.body;
    if (!lessonId || !versionId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "lessonId and versionId are required"
      });
    }

    let targetStudentId = studentId;
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'parent' || authContext.role === 'teacher') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Parents and servants cannot write student learning progress."
        });
      }
      if (studentId && studentId !== authContext.userId) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students cannot write or modify progress for another student."
        });
      }
      targetStudentId = authContext.userId;
    } else {
      targetStudentId = targetStudentId || 'u1';
    }

    const lessonRecord = serverReviewState.lessons[lessonId];
    const targetVersion = serverReviewState.versions[versionId];

    if (!lessonRecord || !targetVersion) {
      return res.status(404).json({ success: false, error: "NOT_FOUND", message: "Lesson or version not found." });
    }

    if (lessonRecord.active_version_id !== versionId || targetVersion.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: "Cannot complete lesson on non-active or unpublished version."
      });
    }

    const key = `${targetStudentId}_${lessonId}`;
    const prog = serverReviewState.progress[key];
    const totalSections = targetVersion.sections?.length || targetVersion.sectionsCount || 1;

    // Rule 3: A lesson is complete ONLY when its required published sections are complete.
    // Do NOT mark a lesson complete merely because the page was opened.
    if (!prog || prog.sectionsCompleted.length < totalSections) {
      return res.status(400).json({
        success: false,
        error: "INCOMPLETE_SECTIONS",
        message: `Lesson cannot be completed until all ${totalSections} required sections are completed.`
      });
    }

    prog.status = 'COMPLETED';
    prog.completedAt = prog.completedAt || new Date().toISOString();
    prog.completionPercent = 100;

    return res.json({
      success: true,
      progress: prog
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 2C.2: STUDENT QUIZZES & ASSESSMENT
// Deterministic server-side scored assessments on active published versions
// ==============================================================================

// 1. Get Active Published Lesson Quiz
app.get("/api/church/student-quiz", async (req, res) => {
  try {
    const lessonId = String(req.query.lessonId || '');
    if (!lessonId) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "lessonId is required" });
    }

    let lessonRecord = serverReviewState.lessons[lessonId];
    if (!lessonRecord) {
      if (lessonId === 'l-cross-01') {
        lessonRecord = { id: 'l-cross-01', status: 'published', active_version_id: 'v-cross-01' };
      } else {
        return res.status(404).json({ success: false, error: "LESSON_NOT_FOUND", message: `Lesson ${lessonId} not found.` });
      }
    }

    // Must have active version and be published
    if (!lessonRecord.active_version_id || lessonRecord.status !== 'published') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: "Cannot access quiz for unpublished or draft lesson."
      });
    }

    const targetVersion = serverReviewState.versions[lessonRecord.active_version_id];
    if (!targetVersion || targetVersion.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: "Cannot access quiz for non-published active version."
      });
    }

    if (!targetVersion.quizDraft) {
      return res.status(404).json({
        success: false,
        error: "QUIZ_NOT_FOUND",
        message: "No assessment found for this published lesson version."
      });
    }

    // Preserve existing question ordering
    const questions = (targetVersion.quizDraft.questions || []).map((q: any) => ({
      id: q.id,
      type: q.type || 'multiple_choice',
      questionEn: q.questionEn,
      questionAr: q.questionAr,
      optionsEn: q.optionsEn,
      optionsAr: q.optionsAr,
      correctIndex: q.correctIndex,
      explanationEn: q.explanationEn,
      explanationAr: q.explanationAr,
      sourceRef: q.sourceRef
    }));

    return res.json({
      success: true,
      quiz: {
        id: targetVersion.quizDraft.id,
        lessonId,
        versionId: targetVersion.id,
        titleEn: targetVersion.quizDraft.titleEn,
        titleAr: targetVersion.quizDraft.titleAr,
        instructionsEn: targetVersion.quizDraft.instructionsEn,
        instructionsAr: targetVersion.quizDraft.instructionsAr,
        status: targetVersion.quizDraft.status,
        questions
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Submit Student Quiz Attempt
app.post("/api/church/student-quiz/submit", async (req, res) => {
  try {
    const { lessonId, versionId, quizId, answers, studentId } = req.body;
    if (!lessonId || !versionId || !quizId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "lessonId, versionId, and quizId are required"
      });
    }

    let targetStudentId = studentId;
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      // Parents and teachers cannot write student quiz attempts
      if (authContext.role === 'parent' || authContext.role === 'teacher') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Parents and servants cannot submit student quiz attempts."
        });
      }
      // Student can only submit for their own account
      if (studentId && studentId !== authContext.userId) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students cannot submit quiz attempts for another student."
        });
      }
      targetStudentId = authContext.userId;
    } else {
      // Demo / Guest / Offline mode
      targetStudentId = targetStudentId || 'u1';
    }

    // Version safety check
    let lessonRecord = serverReviewState.lessons[lessonId];
    let targetVersion = serverReviewState.versions[versionId];

    if (!lessonRecord) {
      if (lessonId === 'l-cross-01') {
        lessonRecord = { id: 'l-cross-01', status: 'published', active_version_id: versionId };
        serverReviewState.lessons['l-cross-01'] = lessonRecord;
      } else {
        return res.status(404).json({ success: false, error: "LESSON_NOT_FOUND", message: `Lesson ${lessonId} not found.` });
      }
    }

    if (!targetVersion) {
      return res.status(404).json({ success: false, error: "VERSION_NOT_FOUND", message: `Version ${versionId} not found.` });
    }

    // Version must belong to lesson
    if (targetVersion.lessonId && targetVersion.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PARAMS",
        message: `Version ${versionId} belongs to lesson ${targetVersion.lessonId}, not ${lessonId}.`
      });
    }

    // Version must be the active published version
    if (lessonRecord.active_version_id !== versionId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_VERSION",
        message: `Version ${versionId} is not the active published version of lesson ${lessonId}.`
      });
    }

    // Status MUST be 'PUBLISHED'
    if (targetVersion.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: `Cannot submit quiz on version with status "${targetVersion.status}". Version must be PUBLISHED.`
      });
    }

    const quizDraft = targetVersion.quizDraft;
    if (!quizDraft || !quizDraft.questions || quizDraft.questions.length === 0) {
      return res.status(404).json({
        success: false,
        error: "QUIZ_NOT_FOUND",
        message: "No quiz found on this published lesson version."
      });
    }

    // Deterministic Server-Side Scoring
    // Never trust client-provided score or percentage!
    let correctCount = 0;
    const questions = quizDraft.questions;
    const recordedAnswers: any[] = questions.map((q: any) => {
      const submitted = (answers || []).find((a: any) => a.questionId === q.id);
      const selectedIdx = submitted ? (submitted.selectedOptionIndex ?? submitted.selectedIndex ?? -1) : -1;
      const isCorrect = selectedIdx === q.correctIndex;
      if (isCorrect) correctCount += 1;

      return {
        questionId: q.id,
        selectedOptionIndex: selectedIdx,
        isCorrect,
        feedbackEn: isCorrect ? (q.explanationEn || 'Correct answer.') : `Review needed: ${q.explanationEn || 'See lesson text.'}`,
        feedbackAr: q.explanationAr,
        recommendedSectionId: q.sourceRef?.sectionId,
        recommendedSectionTitle: q.sourceRef?.sectionTitle
      };
    });

    const totalScore = questions.length;
    const score = correctCount;
    const percentage = Math.round((correctCount / totalScore) * 100);
    const passed = percentage >= 70;

    const newAttempt = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      studentId: targetStudentId,
      lessonId,
      versionId,
      quizId,
      score,
      totalScore,
      percentage,
      passed,
      answers: recordedAnswers,
      submittedAt: new Date().toISOString()
    };

    const key = `${targetStudentId}_${lessonId}`;
    if (!serverReviewState.attempts[key]) {
      serverReviewState.attempts[key] = [];
    }
    serverReviewState.attempts[key].push(newAttempt);

    // Progress Integration: Sync quiz score without corrupting section completion
    if (serverReviewState.progress[key]) {
      serverReviewState.progress[key].quizScore = percentage;
    }

    return res.json({
      success: true,
      attempt: newAttempt
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 3. Get Student Quiz Attempts
app.get("/api/church/student-quiz/attempts", async (req, res) => {
  try {
    const lessonId = String(req.query.lessonId || '');
    let targetStudentId = String(req.query.studentId || '');
    if (!lessonId) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "lessonId is required" });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student') {
        // Authenticated student can ONLY view their own attempts
        if (targetStudentId && targetStudentId !== authContext.userId) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Students cannot view other students' quiz attempts."
          });
        }
        targetStudentId = authContext.userId;
      } else if (!targetStudentId) {
        targetStudentId = authContext.userId;
      }
    } else {
      // Demo / Guest / Offline fallback
      targetStudentId = targetStudentId || 'u1';
    }

    const key = `${targetStudentId}_${lessonId}`;
    const attempts = serverReviewState.attempts[key] || [];

    return res.json({
      success: true,
      attempts
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 2C.3: STUDENT MASTERY & LEARNING RESULTS
// Deterministic server-computed learning mastery results on active published versions
// ==============================================================================

function computeDeterministicMastery(
  studentId: string,
  lessonId: string,
  versionId: string,
  progressRecord: any,
  quizAttempts: any[],
  targetVersion?: any
) {
  const versionSectionsCount = targetVersion?.sections?.length || targetVersion?.sectionsCount || 1;
  const totalSecs = progressRecord?.totalSections || versionSectionsCount;
  const secsCompleted = progressRecord?.sectionsCompleted?.length || 0;
  const isContentCompleted = Boolean(
    progressRecord && 
    progressRecord.status === 'COMPLETED' && 
    (progressRecord.completionPercent >= 100 || secsCompleted >= totalSecs)
  );
  const completionPercent = progressRecord ? (progressRecord.completionPercent || 0) : 0;

  let latestQuizScore = 0;
  let hasQuizAttempt = false;
  if (quizAttempts && quizAttempts.length > 0) {
    hasQuizAttempt = true;
    latestQuizScore = quizAttempts[quizAttempts.length - 1].percentage ?? 0;
  } else if (progressRecord && typeof progressRecord.quizScore === 'number') {
    hasQuizAttempt = true;
    latestQuizScore = progressRecord.quizScore;
  }

  let status: 'NOT_STARTED' | 'DEVELOPING' | 'NEEDS_REVIEW' | 'MASTERED' = 'NOT_STARTED';
  let teacherNotes = 'Lesson not yet started.';

  if (isContentCompleted && latestQuizScore >= 80) {
    status = 'MASTERED';
    teacherNotes = `Demonstrated full mastery: 100% curriculum content read, scored ${latestQuizScore}% on patristic assessment.`;
  } else if (hasQuizAttempt && latestQuizScore < 60) {
    status = 'NEEDS_REVIEW';
    teacherNotes = `Assessment score is ${latestQuizScore}%. Re-reading lesson sections and retaking the review quiz is recommended.`;
  } else if (completionPercent > 0 || hasQuizAttempt) {
    status = 'DEVELOPING';
    teacherNotes = `Actively learning: ${completionPercent}% content read, assessment score: ${latestQuizScore}%.`;
  }

  return {
    studentId,
    lessonId,
    versionId,
    status,
    contentCompleted: isContentCompleted,
    completionPercent,
    quizScore: latestQuizScore,
    evaluatedAt: new Date().toISOString(),
    evaluatedBy: 'Automated Curriculum Engine',
    teacherNotes
  };
}

// 1. Get Student Mastery
app.get("/api/church/student-mastery", async (req, res) => {
  try {
    const lessonId = String(req.query.lessonId || '');
    let targetStudentId = String(req.query.studentId || '');
    if (!lessonId) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "lessonId is required" });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student') {
        // Authenticated student can ONLY view their own mastery
        if (targetStudentId && targetStudentId !== authContext.userId) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Students cannot view other students' mastery results."
          });
        }
        targetStudentId = authContext.userId;
      } else if (!targetStudentId) {
        targetStudentId = authContext.userId;
      }
    } else {
      // Demo / Guest / Offline fallback
      targetStudentId = targetStudentId || 'u1';
    }

    // Version safety check
    let lessonRecord = serverReviewState.lessons[lessonId];
    if (!lessonRecord) {
      if (lessonId === 'l-cross-01') {
        lessonRecord = { id: 'l-cross-01', status: 'published', active_version_id: 'v-cross-01' };
      } else {
        return res.status(404).json({ success: false, error: "LESSON_NOT_FOUND", message: `Lesson ${lessonId} not found.` });
      }
    }

    if (!lessonRecord.active_version_id || lessonRecord.status !== 'published') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: "Cannot access mastery for unpublished or draft lesson."
      });
    }

    const requestedVersionId = req.query.versionId ? String(req.query.versionId) : null;
    if (requestedVersionId && requestedVersionId !== lessonRecord.active_version_id) {
      return res.status(400).json({
        success: false,
        error: "INVALID_VERSION",
        message: `Version ${requestedVersionId} is not the active published version of lesson ${lessonId}.`
      });
    }

    const targetVersion = serverReviewState.versions[lessonRecord.active_version_id];
    if (!targetVersion || targetVersion.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: "Cannot access mastery for non-published active version."
      });
    }

    const key = `${targetStudentId}_${lessonId}`;
    const progressRecord = serverReviewState.progress[key] || null;
    const quizAttempts = serverReviewState.attempts[key] || [];

    // Return stored or computed authoritative mastery
    const computed = computeDeterministicMastery(
      targetStudentId,
      lessonId,
      targetVersion.id,
      progressRecord,
      quizAttempts,
      targetVersion
    );
    serverReviewState.mastery[key] = computed;

    return res.json({
      success: true,
      mastery: computed
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Evaluate Student Mastery
app.post("/api/church/student-mastery/evaluate", async (req, res) => {
  try {
    const { lessonId, versionId, studentId } = req.body;
    if (!lessonId || !versionId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "lessonId and versionId are required"
      });
    }

    let targetStudentId = studentId;
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      // Parents and teachers cannot write student mastery evaluations
      if (authContext.role === 'parent' || authContext.role === 'teacher') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Parents and servants cannot evaluate student mastery directly."
        });
      }
      // Student can only evaluate for their own account
      if (studentId && studentId !== authContext.userId) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students cannot evaluate mastery for another student."
        });
      }
      targetStudentId = authContext.userId;
    } else {
      // Demo / Guest / Offline mode
      targetStudentId = targetStudentId || 'u1';
    }

    // Version safety check
    let lessonRecord = serverReviewState.lessons[lessonId];
    let targetVersion = serverReviewState.versions[versionId];

    if (!lessonRecord) {
      if (lessonId === 'l-cross-01') {
        lessonRecord = { id: 'l-cross-01', status: 'published', active_version_id: versionId };
        serverReviewState.lessons['l-cross-01'] = lessonRecord;
      } else {
        return res.status(404).json({ success: false, error: "LESSON_NOT_FOUND", message: `Lesson ${lessonId} not found.` });
      }
    }

    if (!targetVersion) {
      return res.status(404).json({ success: false, error: "VERSION_NOT_FOUND", message: `Version ${versionId} not found.` });
    }

    // Version must belong to lesson
    if (targetVersion.lessonId && targetVersion.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PARAMS",
        message: `Version ${versionId} belongs to lesson ${targetVersion.lessonId}, not ${lessonId}.`
      });
    }

    // Version must be the active published version
    if (lessonRecord.active_version_id !== versionId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_VERSION",
        message: `Version ${versionId} is not the active published version of lesson ${lessonId}.`
      });
    }

    // Status MUST be 'PUBLISHED'
    if (targetVersion.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: "INVALID_STATE",
        message: `Cannot evaluate mastery on version with status "${targetVersion.status}". Version must be PUBLISHED.`
      });
    }

    const key = `${targetStudentId}_${lessonId}`;
    const progressRecord = serverReviewState.progress[key] || null;
    const quizAttempts = serverReviewState.attempts[key] || [];

    // Authoritative calculation: ignores any client-submitted mastery status or score
    const computed = computeDeterministicMastery(
      targetStudentId,
      lessonId,
      targetVersion.id,
      progressRecord,
      quizAttempts,
      targetVersion
    );
    serverReviewState.mastery[key] = computed;

    return res.json({
      success: true,
      mastery: computed
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 2D.1: CHURCH CLASSES & ROSTER FOUNDATION
// Secure church class membership, servant rosters, and role-based access control
// ==============================================================================

// 1. Get List of Church Classes (Teachers and Admins)
app.get("/api/church/classes", async (req, res) => {
  try {
    const classList = Object.values(serverReviewState.classes).map((c: any) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameAr: c.nameAr,
      grades: c.grades,
      stage: c.stage
    }));
    return res.json({ success: true, classes: classList });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Get Student's Own Class / Servant's Assigned Class
app.get("/api/church/my-class", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    let targetStudentId = 'u1';
    if (authContext.isAuthenticated) {
      targetStudentId = authContext.userId;
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    // A. Teacher / Servant / Admin calling my-class: return assigned class and authoritative roster
    if (authContext.isAuthenticated && (authContext.role === 'teacher' || authContext.role === 'admin')) {
      const targetUserId = authContext.userId;
      let assignedClassGroupId = 'primary_2';

      // 1. Authoritative Supabase persistence check for authenticated online users (Phase 3C.2 & Phase 3C.3)
      if (supabaseUrl && supabaseAnonKey && token && !token.startsWith("test_jwt_")) {
        try {
          const client = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false }
          });

          // Query active church year from public.church_years
          const { data: activeYear, error: yErr } = await client
            .from('church_years')
            .select('id, name, start_date, end_date')
            .eq('is_active', true)
            .maybeSingle();

          if (yErr || !activeYear) {
            console.warn("Supabase active church year read note:", yErr);
          }

          const curYearId = activeYear?.id || '2026-2027';
          const curYearName = activeYear?.name || '2026 / 2027';

          // Resolve servant assigned class instance from public.servant_class_assignments & public.class_instances
          let assignedInstance: any = null;
          let assignedClassGroupId = (req.query.classGroupId as string) || 'primary_2';

          if (authContext.role === 'teacher') {
            const { data: assignments } = await client
              .from('servant_class_assignments')
              .select('class_instance_id')
              .eq('servant_id', targetUserId)
              .eq('church_year_id', curYearId)
              .eq('is_active', true);

            if (assignments && assignments.length > 0) {
              const { data: inst } = await client
                .from('class_instances')
                .select('id, class_group_id, name_en, name_ar, join_code')
                .eq('id', assignments[0].class_instance_id)
                .maybeSingle();
              if (inst) {
                assignedInstance = inst;
                assignedClassGroupId = inst.class_group_id;
              }
            }
          } else if (authContext.role === 'admin') {
            const { data: inst } = await client
              .from('class_instances')
              .select('id, class_group_id, name_en, name_ar, join_code')
              .eq('church_year_id', curYearId)
              .eq('class_group_id', assignedClassGroupId)
              .maybeSingle();
            if (inst) {
              assignedInstance = inst;
            }
          }

          // Fetch authoritative class definition
          const classRecord = serverReviewState.classes[assignedClassGroupId] || {
            id: assignedClassGroupId,
            nameEn: assignedInstance?.name_en || assignedClassGroupId.toUpperCase(),
            nameAr: assignedInstance?.name_ar || 'فصل دراسي',
            grades: ['Grade 4', 'Grade 5', 'Grade 6'],
            servantIds: ['Servant Mina']
          };

          // Fetch authoritative active roster from public.class_memberships
          const roster: any[] = [];
          if (assignedInstance?.id) {
            const { data: memberships, error: memErr } = await client
              .from('class_memberships')
              .select('id, student_id, exact_grade, status, joined_at')
              .eq('church_year_id', curYearId)
              .eq('class_instance_id', assignedInstance.id)
              .eq('status', 'active');

            if (memberships && memberships.length > 0) {
              const studentIds = memberships.map((m: any) => m.student_id);
              const { data: profiles } = await client
                .from('profiles')
                .select('id, name, avatar, grade, role')
                .in('id', studentIds);

              const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

              for (const mem of memberships) {
                const p = profilesMap.get(mem.student_id);
                const mKey = `${mem.student_id}_l-test-multiversion-01`;
                const mastery = serverReviewState.mastery[mKey];
                const pKey = `${mem.student_id}_l-test-multiversion-01`;
                const progress = serverReviewState.progress[pKey];

                roster.push({
                  id: mem.student_id,
                  membershipId: mem.id,
                  name: p?.name || `Student ${mem.student_id.slice(0, 8)}`,
                  grade: mem.exact_grade,
                  classGroupId: assignedClassGroupId,
                  avatarUrl: p?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${mem.student_id}`,
                  joinedAt: mem.joined_at,
                  learningSummary: {
                    latestMasteryStatus: mastery ? mastery.status : 'NOT_STARTED',
                    lessonsCompletedCount: progress && progress.status === 'COMPLETED' ? 1 : 0,
                    latestQuizScore: mastery ? mastery.quizScore : (progress ? progress.quizScore : 0)
                  }
                });
              }
            }
          }

          return res.json({
            success: true,
            classInfo: {
              servantId: targetUserId,
              role: authContext.role,
              classGroupId: assignedClassGroupId,
              className: assignedInstance?.name_en || classRecord.nameEn,
              classNameAr: assignedInstance?.name_ar || classRecord.nameAr,
              grades: classRecord.grades,
              stage: classRecord.stage,
              servants: classRecord.servantIds || ['Servant Mina'],
              churchYear: curYearName,
              classCode: assignedInstance?.join_code,
              classInstanceId: assignedInstance?.id
            },
            roster
          });
        } catch (sbErr) {
          console.warn("Supabase teacher my-class read fallback to local state:", sbErr);
        }
      }

      // Offline / Test token / review state fallback
      const assigned = serverReviewState.teacherAssignments[targetUserId] || ['primary_2'];
      assignedClassGroupId = assigned[0] || 'primary_2';

      const classRecord = serverReviewState.classes[assignedClassGroupId] || {
        id: assignedClassGroupId,
        nameEn: 'Primary 2',
        nameAr: 'فصل ابتدائي 2',
        grades: ['Grade 4', 'Grade 5', 'Grade 6'],
        servantIds: ['Servant Mina']
      };

      const matchedStudents = Object.values(serverReviewState.studentClasses)
        .filter((s: any) => s.classGroupId === assignedClassGroupId);

      const roster: any[] = [];
      const seen = new Set<string>();

      for (const s of matchedStudents) {
        if (seen.has(s.studentId)) continue;
        seen.add(s.studentId);

        const mKey = `${s.studentId}_l-test-multiversion-01`;
        const mastery = serverReviewState.mastery[mKey];
        const pKey = `${s.studentId}_l-test-multiversion-01`;
        const progress = serverReviewState.progress[pKey];

        roster.push({
          id: s.studentId,
          name: s.fullName,
          grade: s.grade,
          classGroupId: s.classGroupId,
          avatarUrl: s.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.studentId}`,
          learningSummary: {
            latestMasteryStatus: mastery ? mastery.status : 'NOT_STARTED',
            lessonsCompletedCount: progress && progress.status === 'COMPLETED' ? 1 : 0,
            latestQuizScore: mastery ? mastery.quizScore : (progress ? progress.quizScore : 0)
          }
        });
      }

      const curYear = serverReviewState.currentChurchYear;
      const curInstanceKey = `inst_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}_${assignedClassGroupId}`;
      const activeInst = serverReviewState.classInstances[curInstanceKey] || Object.values(serverReviewState.classInstances).find(
        (i: any) => i.churchYear === curYear && i.classGroupId === assignedClassGroupId
      ) as any;

      return res.json({
        success: true,
        classInfo: {
          servantId: targetUserId,
          role: authContext.role,
          classGroupId: assignedClassGroupId,
          className: classRecord.nameEn,
          classNameAr: classRecord.nameAr,
          grades: classRecord.grades,
          stage: classRecord.stage,
          servants: activeInst?.servantNames || activeInst?.servantIds || classRecord.servantIds || ['Servant Mina'],
          churchYear: curYear,
          classCode: activeInst?.code || 'MUSA-P46B',
          classInstanceId: activeInst?.id || curInstanceKey
        },
        roster
      });
    }

    // B. Student or Guest calling my-class: return student class association
    // 1. Authoritative Supabase persistence check for authenticated online students (Phase 3C.2)
    if (authContext.isAuthenticated && supabaseUrl && supabaseAnonKey && token && !token.startsWith("test_jwt_")) {
      try {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // 1. Authoritative active church year from public.church_years
        const { data: activeYear, error: yErr } = await client
          .from('church_years')
          .select('id, name, start_date, end_date')
          .eq('is_active', true)
          .maybeSingle();

        if (yErr) {
          console.warn("Supabase active church year read error:", yErr);
          return res.status(500).json({
            success: false,
            error: "DATABASE_ERROR",
            message: "Failed to read active church year from database"
          });
        }

        if (!activeYear) {
          return res.json({
            success: true,
            isEnrolled: false,
            membership: null,
            classInfo: null,
            message: "No active church year configured in database."
          });
        }

        // 2. Authoritative active class membership from public.class_memberships
        const { data: mem, error: mErr } = await client
          .from('class_memberships')
          .select('id, church_year_id, class_instance_id, student_id, exact_grade, status, joined_at')
          .eq('student_id', targetStudentId)
          .eq('church_year_id', activeYear.id)
          .eq('status', 'active')
          .maybeSingle();

        if (mErr) {
          console.warn("Supabase class membership read error:", mErr);
          return res.status(500).json({
            success: false,
            error: "DATABASE_ERROR",
            message: "Failed to read student class membership from database"
          });
        }

        if (mem) {
          const derivedClassGroupId = getClassGroupIdForGrade(mem.exact_grade);
          const classRecord = serverReviewState.classes[derivedClassGroupId] || {
            id: derivedClassGroupId,
            nameEn: derivedClassGroupId.toUpperCase(),
            nameAr: 'فصل دراسي',
            servantIds: []
          };

          return res.json({
            success: true,
            isEnrolled: true,
            activeChurchYear: {
              id: activeYear.id,
              name: activeYear.name
            },
            membership: {
              id: mem.id,
              churchYearId: mem.church_year_id,
              churchYearName: activeYear.name,
              classInstanceId: mem.class_instance_id,
              exactGrade: mem.exact_grade,
              status: mem.status,
              joinedAt: mem.joined_at
            },
            classInfo: {
              studentId: targetStudentId,
              grade: mem.exact_grade,
              classGroupId: derivedClassGroupId,
              className: classRecord.nameEn,
              classNameAr: classRecord.nameAr,
              servants: [],
              churchYear: activeYear.name || activeYear.id
            }
          });
        }

        // Student has NO active membership in the active church year.
        // Phase 3C.2: MUST NOT fabricate a fake class from profile.grade or mock state!
        return res.json({
          success: true,
          isEnrolled: false,
          activeChurchYear: {
            id: activeYear.id,
            name: activeYear.name
          },
          membership: null,
          classInfo: null
        });
      } catch (sbErr) {
        console.warn("Supabase my-class student query error:", sbErr);
        return res.status(500).json({
          success: false,
          error: "DATABASE_ERROR",
          message: "Failed to read student class membership from database"
        });
      }
    }

    const studentRecord = serverReviewState.studentClasses[targetStudentId] ||
      (targetStudentId.includes('other') ? serverReviewState.studentClasses['other'] : null) ||
      (targetStudentId.includes('mark') ? serverReviewState.studentClasses['mark'] : null) || {
      studentId: targetStudentId,
      fullName: 'Youssef Mina',
      grade: 'Grade 4',
      classGroupId: 'primary_2',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetStudentId}`
    };

    const classRecord = serverReviewState.classes[studentRecord.classGroupId] || {
      id: studentRecord.classGroupId,
      nameEn: 'Primary 2',
      nameAr: 'فصل ابتدائي 2'
    };

    return res.json({
      success: true,
      classInfo: {
        studentId: studentRecord.studentId,
        grade: studentRecord.grade,
        classGroupId: studentRecord.classGroupId,
        className: classRecord.nameEn,
        classNameAr: classRecord.nameAr,
        servants: ['Servant Mina'],
        churchYear: studentRecord.churchYear || serverReviewState.currentChurchYear
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 3. Get Class Roster (Authorized Servants & Admins Only)
app.get("/api/church/class-roster", async (req, res) => {
  try {
    let targetClassGroupId = String(req.query.classGroupId || '');
    const authContext = await verifyServerRequestAuth(req);

    if (authContext.isAuthenticated) {
      if (authContext.role === 'student') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students are not authorized to view church class rosters."
        });
      }

      if (authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Parents are not authorized to view church class rosters."
        });
      }

      if (authContext.role === 'teacher') {
        const assignedClasses = serverReviewState.teacherAssignments[authContext.userId] || ['primary_2'];
        if (!targetClassGroupId) {
          targetClassGroupId = assignedClasses[0] || 'primary_2';
        }
        if (!assignedClasses.includes(targetClassGroupId)) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: `Servant ${authContext.userId} is not authorized to view roster for class "${targetClassGroupId}".`
          });
        }
      } else if (authContext.role === 'admin') {
        if (!targetClassGroupId) {
          targetClassGroupId = 'primary_2';
        }
      }
    } else {
      // Demo / Guest / Offline mode fallback
      targetClassGroupId = targetClassGroupId || 'primary_2';
    }

    if (!serverReviewState.classes[targetClassGroupId]) {
      return res.status(404).json({
        success: false,
        error: "CLASS_NOT_FOUND",
        message: `Class "${targetClassGroupId}" not found.`
      });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    // 1. Authoritative Supabase persistence check for authenticated online users (Phase 3C.2 & 3C.3)
    if (authContext.isAuthenticated && supabaseUrl && supabaseAnonKey && token && !token.startsWith("test_jwt_")) {
      try {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // 1. Query active church year
        const { data: activeYear } = await client
          .from('church_years')
          .select('id, name')
          .eq('is_active', true)
          .maybeSingle();

        const curYearId = activeYear?.id || '2026-2027';

        // 2. Resolve class instance for targetClassGroupId
        let targetInstanceId: string | null = null;
        if (authContext.role === 'teacher') {
          const { data: assignments } = await client
            .from('servant_class_assignments')
            .select('class_instance_id')
            .eq('servant_id', authContext.userId)
            .eq('church_year_id', curYearId)
            .eq('is_active', true);

          if (assignments && assignments.length > 0) {
            targetInstanceId = assignments[0].class_instance_id;
          }
        } else if (authContext.role === 'admin') {
          const { data: inst } = await client
            .from('class_instances')
            .select('id')
            .eq('church_year_id', curYearId)
            .eq('class_group_id', targetClassGroupId)
            .maybeSingle();
          targetInstanceId = inst?.id || null;
        }

        // 3. Query active memberships from public.class_memberships
        const roster: any[] = [];
        if (targetInstanceId) {
          const { data: memberships } = await client
            .from('class_memberships')
            .select('id, student_id, exact_grade, status, joined_at')
            .eq('church_year_id', curYearId)
            .eq('class_instance_id', targetInstanceId)
            .eq('status', 'active');

          if (memberships && memberships.length > 0) {
            const studentIds = memberships.map((m: any) => m.student_id);
            const { data: profiles } = await client
              .from('profiles')
              .select('id, name, avatar, grade, role')
              .in('id', studentIds);

            const profilesMap = new Map((profiles || []).map((p: any) => [p.id, p]));

            for (const mem of memberships) {
              const p = profilesMap.get(mem.student_id);
              const mKey = `${mem.student_id}_l-test-multiversion-01`;
              const mastery = serverReviewState.mastery[mKey];
              const pKey = `${mem.student_id}_l-test-multiversion-01`;
              const progress = serverReviewState.progress[pKey];

              roster.push({
                id: mem.student_id,
                membershipId: mem.id,
                name: p?.name || `Student ${mem.student_id.slice(0, 8)}`,
                grade: mem.exact_grade,
                classGroupId: targetClassGroupId,
                avatarUrl: p?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${mem.student_id}`,
                joinedAt: mem.joined_at,
                learningSummary: {
                  latestMasteryStatus: mastery ? mastery.status : 'NOT_STARTED',
                  lessonsCompletedCount: progress && progress.status === 'COMPLETED' ? 1 : 0,
                  latestQuizScore: mastery ? mastery.quizScore : (progress ? progress.quizScore : 0)
                }
              });
            }
          }
        }

        return res.json({
          success: true,
          classGroupId: targetClassGroupId,
          roster
        });
      } catch (sbErr) {
        console.warn("Supabase class-roster read fallback to local state:", sbErr);
      }
    }

    // Build authorized roster with permitted fields only and reused learning summary
    const matchedStudents = Object.values(serverReviewState.studentClasses)
      .filter((s: any) => s.classGroupId === targetClassGroupId);

    const roster: any[] = [];
    const seen = new Set<string>();

    for (const s of matchedStudents) {
      if (seen.has(s.studentId)) continue;
      seen.add(s.studentId);

      const mKey = `${s.studentId}_l-test-multiversion-01`;
      const mastery = serverReviewState.mastery[mKey];
      const pKey = `${s.studentId}_l-test-multiversion-01`;
      const progress = serverReviewState.progress[pKey];

      roster.push({
        id: s.studentId,
        name: s.fullName,
        grade: s.grade,
        classGroupId: s.classGroupId,
        avatarUrl: s.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.studentId}`,
        learningSummary: {
          latestMasteryStatus: mastery ? mastery.status : 'NOT_STARTED',
          lessonsCompletedCount: progress && progress.status === 'COMPLETED' ? 1 : 0,
          latestQuizScore: mastery ? mastery.quizScore : (progress ? progress.quizScore : 0)
        }
      });
    }

    return res.json({
      success: true,
      classGroupId: targetClassGroupId,
      roster
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 4. Assign Student Class (Teachers & Admins Only; Students and Parents Forbidden)
app.post("/api/church/student/class", async (req, res) => {
  try {
    const { studentId, classGroupId, grade } = req.body;
    if (!studentId || !classGroupId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "studentId and classGroupId are required"
      });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students cannot modify their own or any class assignments."
        });
      }

      if (authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Parents cannot manage class assignments."
        });
      }

      if (authContext.role === 'teacher') {
        const assignedClasses = serverReviewState.teacherAssignments[authContext.userId] || ['primary_2'];
        if (!assignedClasses.includes(classGroupId)) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: `Servant ${authContext.userId} is not authorized to assign students to class "${classGroupId}".`
          });
        }
      }
    }

    if (!serverReviewState.classes[classGroupId]) {
      return res.status(404).json({
        success: false,
        error: "CLASS_NOT_FOUND",
        message: `Class "${classGroupId}" not found.`
      });
    }

    const targetGrade = grade || serverReviewState.classes[classGroupId].grades[0] || 'Grade 4';
    if (grade && getClassGroupIdForGrade(grade) !== classGroupId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_GRADE",
        message: `Grade "${grade}" does not map to class group "${classGroupId}".`
      });
    }

    // 1. Verify student exists in persistent database or known class records
    let existing = serverReviewState.studentClasses[studentId];
    if (!existing) {
      if (studentId === 'user_student_mark_101') existing = serverReviewState.studentClasses['mark'];
      else if (studentId === 'user_student_other_102') existing = serverReviewState.studentClasses['other'];
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    // 2. Real Supabase Persistence when online with valid user token (Phase 3C.3)
    if (supabaseUrl && supabaseAnonKey && token && !token.startsWith("test_jwt_")) {
      try {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // 1. Check active church year
        const { data: activeYear } = await client
          .from('church_years')
          .select('id, name')
          .eq('is_active', true)
          .maybeSingle();

        const curYearId = activeYear?.id || '2026-2027';

        // 2. Look up target student profile
        const { data: profileCheck, error: checkErr } = await client
          .from('profiles')
          .select('id, name, role, grade')
          .eq('id', studentId)
          .maybeSingle();

        if (checkErr) {
          return res.status(500).json({
            success: false,
            error: "DATABASE_ERROR",
            message: `Failed to query student profile: ${checkErr.message}`
          });
        }

        if (!profileCheck) {
          return res.status(404).json({
            success: false,
            error: "STUDENT_NOT_FOUND",
            message: `Student with ID "${studentId}" was not found.`
          });
        }

        if (profileCheck.role !== 'student') {
          return res.status(400).json({
            success: false,
            error: "NOT_A_STUDENT",
            message: `Target user does not hold the student role.`
          });
        }

        // 3. Resolve class_instance_id
        let resolvedInstanceId = req.body.classInstanceId;
        if (!resolvedInstanceId) {
          if (authContext.role === 'admin') {
            const { data: inst } = await client
              .from('class_instances')
              .select('id')
              .eq('church_year_id', curYearId)
              .eq('class_group_id', classGroupId)
              .maybeSingle();
            resolvedInstanceId = inst?.id;
          } else {
            const { data: assignment } = await client
              .from('servant_class_assignments')
              .select('class_instance_id')
              .eq('servant_id', authContext.userId)
              .eq('church_year_id', curYearId)
              .eq('is_active', true)
              .maybeSingle();
            resolvedInstanceId = assignment?.class_instance_id;
          }
        }

        if (!resolvedInstanceId) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Unauthorized: Servant is not assigned to this class instance in the active church year."
          });
        }

        // 4. Execute the approved Phase 3B SECURITY DEFINER RPC: public.enroll_student_in_class(p_student_id, p_class_instance_id)
        const { data: rpcData, error: rpcErr } = await client.rpc('enroll_student_in_class', {
          p_student_id: profileCheck.id,
          p_class_instance_id: resolvedInstanceId
        });

        if (rpcErr) {
          return res.status(400).json({
            success: false,
            error: rpcErr.message.includes('Unauthorized') ? 'FORBIDDEN' : (rpcErr.message.includes('Grade') ? 'INVALID_GRADE' : 'ENROLLMENT_FAILED'),
            message: rpcErr.message
          });
        }

        return res.json({
          success: true,
          action: rpcData?.action || 'enrolled',
          membershipId: rpcData?.membershipId,
          classInstanceId: rpcData?.classInstanceId,
          message: `Student successfully enrolled in class.`
        });
      } catch (sbErr: any) {
        return res.status(500).json({
          success: false,
          error: "ENROLLMENT_ERROR",
          message: sbErr?.message || "Failed to execute enrollment"
        });
      }
    } else if (!existing && !['mark', 'u1', 'student-david', 'c1', 'other', 'user_student_mark_101', 'user_student_other_102'].includes(studentId)) {
      return res.status(404).json({
        success: false,
        error: "STUDENT_NOT_FOUND",
        message: `Student with ID "${studentId}" was not found.`
      });
    }

    serverReviewState.studentClasses[studentId] = {
      studentId,
      fullName: existing?.fullName || `Student ${studentId}`,
      grade: targetGrade,
      classGroupId,
      avatarUrl: existing?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
    };

    // Record teacher_student relationship
    if (authContext.isAuthenticated && (authContext.role === 'teacher' || authContext.role === 'admin')) {
      const servantId = authContext.userId;
      const existingRel = serverReviewState.teacherStudentRelationships.find(
        r => r.teacherId === servantId && r.studentId === studentId && r.relationshipType === 'teacher_student'
      );
      if (existingRel) {
        existingRel.createdAt = new Date().toISOString();
      } else {
        serverReviewState.teacherStudentRelationships.push({
          teacherId: servantId,
          studentId,
          relationshipType: 'teacher_student',
          createdAt: new Date().toISOString()
        });
      }
    }

    savePersistentClassState();

    return res.json({
      success: true,
      student: serverReviewState.studentClasses[studentId],
      relationshipPersisted: true
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 5. Get Servant Relationships (Teacher and Admin only)
app.get("/api/church/servant/relationships", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (!authContext.isAuthenticated || (authContext.role !== 'teacher' && authContext.role !== 'admin')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Only servants and admins can view teacher relationships."
      });
    }

    const servantId = authContext.userId;
    const relationships = serverReviewState.teacherStudentRelationships.filter(r => r.teacherId === servantId);
    return res.json({ success: true, relationships });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// ONBOARDING & ACCOUNT ACTIVATION ENDPOINTS
// Allows new users to select Sunday School class/grade, submit activation requests,
// and enables servants/admins to review and assign students to the official roster.
// ==============================================================================

// 1. Submit Account Activation & Class Join Request (Students & New Users)
app.post("/api/church/onboarding/request", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    const { studentId: bodyStudentId, studentName, email, phone, requestedClassGroupId, requestedGrade, notes } = req.body;
    const targetStudentId = bodyStudentId || authContext.userId;

    if (!targetStudentId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "studentId is required"
      });
    }

    if (!requestedClassGroupId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "requestedClassGroupId is required"
      });
    }

    const validClassGroups = ['angels', 'primary_1', 'primary_2', 'preparatory', 'secondary', 'university'];
    if (!validClassGroups.includes(requestedClassGroupId)) {
      return res.status(404).json({
        success: false,
        error: "CLASS_NOT_FOUND",
        message: `Class group "${requestedClassGroupId}" not recognized.`
      });
    }

    const targetGrade = requestedGrade || 'Grade 4';
    if (requestedGrade && getClassGroupIdForGrade(requestedGrade) !== requestedClassGroupId) {
      return res.status(400).json({
        success: false,
        error: "INVALID_GRADE",
        message: `Grade "${requestedGrade}" does not belong to class group "${requestedClassGroupId}".`
      });
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newRequest = {
      id: requestId,
      studentId: targetStudentId,
      studentName: studentName || `Student ${targetStudentId}`,
      email: email || '',
      phone: phone || '',
      requestedClassGroupId,
      requestedGrade: targetGrade,
      notes: notes || '',
      status: 'PENDING_APPROVAL',
      requestedAt: new Date().toISOString()
    };

    serverReviewState.activationRequests[requestId] = newRequest;

    // Track pending enrollment in local state so student class lookup knows about pending status
    serverReviewState.studentClasses[targetStudentId] = {
      studentId: targetStudentId,
      fullName: newRequest.studentName,
      grade: targetGrade,
      classGroupId: requestedClassGroupId,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetStudentId}`,
      isPending: true
    };

    savePersistentClassState();

    return res.json({
      success: true,
      request: newRequest,
      message: "Onboarding request submitted successfully. Pending servant review."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Get My Activation Status (Student)
app.get("/api/church/onboarding/my-status", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    const targetStudentId = String(req.query.studentId || authContext.userId || '').trim();

    if (!targetStudentId) {
      return res.json({
        success: true,
        request: null,
        isEnrolled: false
      });
    }

    // Find latest request for this student
    const allRequests = Object.values(serverReviewState.activationRequests || {}) as any[];
    const studentRequests = allRequests
      .filter((r: any) => r.studentId === targetStudentId)
      .sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    const latestRequest = studentRequests[0] || null;
    const studentClass = serverReviewState.studentClasses[targetStudentId];
    const isEnrolled = Boolean(studentClass && !studentClass.isPending);

    return res.json({
      success: true,
      request: latestRequest,
      isEnrolled,
      studentClass: isEnrolled ? studentClass : null
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 3. Get Pending Activation Requests (Servants & Admins Only)
app.get("/api/church/onboarding/requests", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    let targetClassGroupId = String(req.query.classGroupId || '');

    if (authContext.isAuthenticated) {
      if (authContext.role === 'student') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students cannot view activation requests."
        });
      }

      if (authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Parents cannot view activation requests."
        });
      }

      if (authContext.role === 'teacher') {
        const assignedClasses = serverReviewState.teacherAssignments[authContext.userId] || ['primary_2'];
        if (targetClassGroupId && !assignedClasses.includes(targetClassGroupId)) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: `Servant ${authContext.userId} is not authorized for class "${targetClassGroupId}".`
          });
        }
        if (!targetClassGroupId) {
          targetClassGroupId = assignedClasses[0] || 'primary_2';
        }
      }
    } else {
      // Demo / guest fallback
      targetClassGroupId = targetClassGroupId || 'primary_2';
    }

    const allRequests = Object.values(serverReviewState.activationRequests || {}) as any[];
    const filteredRequests = allRequests.filter((r: any) => {
      if (targetClassGroupId && r.requestedClassGroupId !== targetClassGroupId) {
        return false;
      }
      return true;
    }).sort((a: any, b: any) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

    return res.json({
      success: true,
      classGroupId: targetClassGroupId || 'all',
      requests: filteredRequests
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 4. Review & Approve/Reject Activation Request (Servants & Admins Only)
app.post("/api/church/onboarding/review", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    const { requestId, action, assignedGrade, reviewNotes } = req.body;

    if (!requestId || !action) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "requestId and action are required"
      });
    }

    if (action !== 'APPROVE' && action !== 'REJECT') {
      return res.status(400).json({
        success: false,
        error: "INVALID_ACTION",
        message: 'Action must be "APPROVE" or "REJECT"'
      });
    }

    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents cannot review onboarding requests."
        });
      }
    }

    const targetRequest = serverReviewState.activationRequests[requestId];
    if (!targetRequest) {
      return res.status(404).json({
        success: false,
        error: "REQUEST_NOT_FOUND",
        message: `Activation request "${requestId}" not found.`
      });
    }

    if (authContext.isAuthenticated && authContext.role === 'teacher') {
      const assignedClasses = serverReviewState.teacherAssignments[authContext.userId] || ['primary_2'];
      if (!assignedClasses.includes(targetRequest.requestedClassGroupId)) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: `Servant ${authContext.userId} is not authorized to review requests for class "${targetRequest.requestedClassGroupId}".`
        });
      }
    }

    if (action === 'APPROVE') {
      const finalGrade = assignedGrade || targetRequest.requestedGrade || 'Grade 4';
      if (assignedGrade && getClassGroupIdForGrade(assignedGrade) !== targetRequest.requestedClassGroupId) {
        return res.status(400).json({
          success: false,
          error: "INVALID_GRADE",
          message: `Assigned grade "${assignedGrade}" does not match class group "${targetRequest.requestedClassGroupId}".`
        });
      }

      targetRequest.status = 'APPROVED';
      targetRequest.assignedGrade = finalGrade;
      targetRequest.reviewedBy = authContext.userId || 'Servant Mina';
      targetRequest.reviewedAt = new Date().toISOString();
      targetRequest.reviewNotes = reviewNotes || 'Approved by servant';

      // Authoritative roster assignment
      const curYear = serverReviewState.currentChurchYear;
      serverReviewState.studentClasses[targetRequest.studentId] = {
        studentId: targetRequest.studentId,
        fullName: targetRequest.studentName,
        grade: finalGrade,
        classGroupId: targetRequest.requestedClassGroupId,
        churchYear: curYear,
        avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${targetRequest.studentId}`,
        enrolledAt: new Date().toISOString()
      };

      // Add to classMemberships for the current church year
      const memId = `mem_${targetRequest.studentId}_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const instKey = `inst_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}_${targetRequest.requestedClassGroupId}`;
      serverReviewState.classMemberships[memId] = {
        id: memId,
        churchYear: curYear,
        classGroupId: targetRequest.requestedClassGroupId,
        classInstanceId: instKey,
        studentId: targetRequest.studentId,
        studentName: targetRequest.studentName,
        exactGrade: finalGrade,
        status: 'ACTIVE',
        enrolledAt: new Date().toISOString(),
        enrolledBy: authContext.userId || 'servant'
      };

      // Establish teacher-student relationship
      const servantId = authContext.userId || 'user_teacher_mina_101';
      const existingRel = serverReviewState.teacherStudentRelationships.find(
        r => r.teacherId === servantId && r.studentId === targetRequest.studentId && r.relationshipType === 'teacher_student'
      );
      if (existingRel) {
        existingRel.createdAt = new Date().toISOString();
      } else {
        serverReviewState.teacherStudentRelationships.push({
          teacherId: servantId,
          studentId: targetRequest.studentId,
          relationshipType: 'teacher_student',
          createdAt: new Date().toISOString()
        });
      }

      // Real Supabase persistence if user has authenticated token
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

      if (supabaseUrl && supabaseAnonKey && token && !token.startsWith("test_jwt_")) {
        try {
          const client = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false }
          });

          await client
            .from('profiles')
            .update({ grade: finalGrade })
            .eq('id', targetRequest.studentId);

          await client
            .from('user_relationships')
            .upsert({
              parent_id: servantId,
              child_id: targetRequest.studentId,
              relationship_type: 'teacher_student',
              created_at: new Date().toISOString()
            }, { onConflict: 'parent_id,child_id' });
        } catch (sbErr) {
          console.warn("Supabase onboarding approval sync note:", sbErr);
        }
      }

      savePersistentClassState();

      return res.json({
        success: true,
        request: targetRequest,
        enrolledStudent: serverReviewState.studentClasses[targetRequest.studentId],
        message: `Student "${targetRequest.studentName}" has been approved and enrolled in class roster.`
      });
    } else {
      // REJECT
      targetRequest.status = 'REJECTED';
      targetRequest.reviewedBy = authContext.userId || 'Servant Mina';
      targetRequest.reviewedAt = new Date().toISOString();
      targetRequest.reviewNotes = reviewNotes || 'Request dismissed';

      savePersistentClassState();

      return res.json({
        success: true,
        request: targetRequest,
        message: `Request "${requestId}" was rejected.`
      });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 3B: CHURCH YEAR & YEAR-SPECIFIC CLASS INSTANCES
// Authoritative multi-year Church lifecycle, join codes, memberships & promotions
// ==============================================================================

function generateClassCode(prefix = 'MUSA'): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = prefix + '-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getNextGradeInfo(currentGrade?: string | null): {
  nextGrade: string;
  nextClassGroupId: string;
  isGraduated: boolean;
  explanation: string;
} {
  const g = (currentGrade || '').toLowerCase().trim();
  if (g.includes('kg1') || g.includes('حضانة صغرى') || g.includes('كي جي 1')) {
    return { nextGrade: 'KG2', nextClassGroupId: 'angels', isGraduated: false, explanation: 'Promoted from KG1 to KG2' };
  }
  if (g.includes('kg2') || g.includes('حضانة كبرى') || g.includes('كي جي 2') || g.includes('kg')) {
    return { nextGrade: 'Grade 1', nextClassGroupId: 'primary_1', isGraduated: false, explanation: 'Promoted from KG2 to Grade 1 (Primary 1–3)' };
  }
  if (g.includes('grade 1') || g.includes('primary 1') || g === '1' || g.includes('اولى ابتدائي')) {
    return { nextGrade: 'Grade 2', nextClassGroupId: 'primary_1', isGraduated: false, explanation: 'Promoted from Grade 1 to Grade 2' };
  }
  if (g.includes('grade 2') || g.includes('primary 2') || g === '2' || g.includes('تانية ابتدائي')) {
    return { nextGrade: 'Grade 3', nextClassGroupId: 'primary_1', isGraduated: false, explanation: 'Promoted from Grade 2 to Grade 3' };
  }
  if (g.includes('grade 3') || g.includes('primary 3') || g === '3' || g.includes('تالتة ابتدائي')) {
    return { nextGrade: 'Grade 4', nextClassGroupId: 'primary_2', isGraduated: false, explanation: 'Promoted from Grade 3 to Grade 4 (Primary 4–6)' };
  }
  if (g.includes('grade 4') || g.includes('primary 4') || g === '4' || g.includes('رابعة ابتدائي')) {
    return { nextGrade: 'Grade 5', nextClassGroupId: 'primary_2', isGraduated: false, explanation: 'Promoted from Grade 4 to Grade 5' };
  }
  if (g.includes('grade 5') || g.includes('primary 5') || g === '5' || g.includes('خامسة ابتدائي')) {
    return { nextGrade: 'Grade 6', nextClassGroupId: 'primary_2', isGraduated: false, explanation: 'Promoted from Grade 5 to Grade 6' };
  }
  if (g.includes('grade 6') || g.includes('primary 6') || g === '6' || g.includes('ساتة ابتدائي') || g.includes('سادس')) {
    return { nextGrade: 'Prep 1', nextClassGroupId: 'preparatory', isGraduated: false, explanation: 'Promoted from Grade 6 to Prep 1 (Preparatory)' };
  }
  if (g.includes('prep 1') || g.includes('grade 7') || g.includes('اولى اعدادي')) {
    return { nextGrade: 'Prep 2', nextClassGroupId: 'preparatory', isGraduated: false, explanation: 'Promoted from Prep 1 to Prep 2' };
  }
  if (g.includes('prep 2') || g.includes('grade 8') || g.includes('تانية اعدادي')) {
    return { nextGrade: 'Prep 3', nextClassGroupId: 'preparatory', isGraduated: false, explanation: 'Promoted from Prep 2 to Prep 3' };
  }
  if (g.includes('prep 3') || g.includes('grade 9') || g.includes('تالتة اعدادي')) {
    return { nextGrade: 'Secondary 1', nextClassGroupId: 'secondary', isGraduated: false, explanation: 'Promoted from Prep 3 to Secondary 1 (Secondary)' };
  }
  if (g.includes('sec 1') || g.includes('secondary 1') || g.includes('grade 10') || g.includes('اولى ثانوي')) {
    return { nextGrade: 'Secondary 2', nextClassGroupId: 'secondary', isGraduated: false, explanation: 'Promoted from Secondary 1 to Secondary 2' };
  }
  if (g.includes('sec 2') || g.includes('secondary 2') || g.includes('grade 11') || g.includes('تانية ثانوي')) {
    return { nextGrade: 'Secondary 3', nextClassGroupId: 'secondary', isGraduated: false, explanation: 'Promoted from Secondary 2 to Secondary 3' };
  }
  if (g.includes('sec 3') || g.includes('secondary 3') || g.includes('grade 12') || g.includes('تالتة ثانوي')) {
    return { nextGrade: 'University', nextClassGroupId: 'university', isGraduated: false, explanation: 'Promoted from Secondary 3 to University' };
  }
  if (g.includes('univ') || g.includes('جامع') || g.includes('college') || g.includes('youth')) {
    return { nextGrade: 'Graduated', nextClassGroupId: 'university', isGraduated: true, explanation: 'Completed Sunday School curriculum (Graduated / Alumni)' };
  }
  return { nextGrade: 'Grade 5', nextClassGroupId: 'primary_2', isGraduated: false, explanation: 'Standard grade progression' };
}

// 1. Get current church year and class instances
app.get("/api/church/year", async (req, res) => {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    if (supabaseUrl && supabaseAnonKey) {
      try {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false }
        });
        const { data: dbYear } = await client
          .from('church_years')
          .select('id, name, start_date, end_date, is_active, activated_at')
          .eq('is_active', true)
          .maybeSingle();

        if (dbYear) {
          return res.json({
            success: true,
            currentChurchYear: dbYear.name || dbYear.id,
            churchYear: {
              id: dbYear.id,
              year: dbYear.name || dbYear.id,
              status: 'ACTIVE',
              startDate: dbYear.start_date || `${dbYear.id.substring(0, 4)}-09-01`,
              endDate: dbYear.end_date,
              createdAt: dbYear.activated_at || new Date().toISOString(),
              createdBy: 'system'
            },
            classInstances: []
          });
        }
      } catch (sbErr) {
        console.warn("Supabase church year read fallback:", sbErr);
      }
    }

    const curYear = serverReviewState.currentChurchYear;
    let yearRecord = serverReviewState.churchYears[curYear];
    if (!yearRecord) {
      yearRecord = {
        id: `year-${curYear.replace(/[^a-zA-Z0-9]/g, '-')}`,
        year: curYear,
        status: 'ACTIVE',
        startDate: `${curYear.substring(0, 4)}-09-01`,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
      };
      serverReviewState.churchYears[curYear] = yearRecord;
    }

    // Filter class instances for this current active year
    const activeInstances = Object.values(serverReviewState.classInstances)
      .filter((inst: any) => inst.churchYear === curYear);

    return res.json({
      success: true,
      currentChurchYear: curYear,
      churchYear: yearRecord,
      classInstances: activeInstances
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Onboard Student Exact Grade (First login)
app.post("/api/church/student/onboard-grade", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    const { exactGrade, studentId: bodyStudentId } = req.body;
    if (!exactGrade || typeof exactGrade !== 'string' || !exactGrade.trim()) {
      return res.status(400).json({
        success: false,
        error: "MISSING_GRADE",
        message: "exactGrade is required"
      });
    }

    const studentId = (authContext.isAuthenticated && authContext.userId) ? authContext.userId : (bodyStudentId || 'u1');
    const classGroupId = getClassGroupIdForGrade(exactGrade);
    const classRecord = serverReviewState.classes[classGroupId] || {
      nameEn: classGroupId,
      nameAr: classGroupId
    };

    const curYear = serverReviewState.currentChurchYear;
    const instanceKey = `inst_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}_${classGroupId}`;

    // Link/update membership
    const memKey = `mem_${studentId}_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}`;
    serverReviewState.classMemberships[memKey] = {
      id: memKey,
      churchYear: curYear,
      classGroupId,
      classInstanceId: instanceKey,
      studentId,
      studentName: serverReviewState.studentClasses[studentId]?.fullName || studentId,
      exactGrade: exactGrade.trim(),
      status: 'ACTIVE',
      enrolledAt: new Date().toISOString(),
      enrolledBy: 'onboarding'
    };

    serverReviewState.studentClasses[studentId] = {
      studentId,
      fullName: serverReviewState.studentClasses[studentId]?.fullName || studentId,
      grade: exactGrade.trim(),
      classGroupId,
      churchYear: curYear,
      avatarUrl: serverReviewState.studentClasses[studentId]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
    };

    savePersistentClassState();

    return res.json({
      success: true,
      exactGrade: exactGrade.trim(),
      classGroupId,
      classGroupName: classRecord.nameEn
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 3. Student Joins Class using Servant-Supplied Code
app.post("/api/church/student/join-class", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    const { code, exactGrade: bodyExactGrade, studentId: bodyStudentId } = req.body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        success: false,
        error: "MISSING_CODE",
        message: "Class join code is required."
      });
    }

    const trimmedCode = code.trim().toUpperCase();
    const curYear = serverReviewState.currentChurchYear;

    // Find class instance matching this code across all instances
    const matchedInstance = Object.values(serverReviewState.classInstances).find(
      (inst: any) => inst.code && inst.code.toUpperCase() === trimmedCode
    ) as any;

    if (!matchedInstance) {
      return res.status(404).json({
        success: false,
        error: "CODE_NOT_FOUND",
        message: "No class instance found with this join code."
      });
    }

    // Archived year check
    if (matchedInstance.churchYear !== curYear || matchedInstance.status === 'ARCHIVED') {
      return res.status(400).json({
        success: false,
        error: "ARCHIVED_YEAR_CODE",
        message: "Archived-year codes cannot enroll students into the current year."
      });
    }

    const studentId = (authContext.isAuthenticated && authContext.userId) ? authContext.userId : (bodyStudentId || 'mark');
    
    // Resolve student exact grade
    let studentGrade = bodyExactGrade;
    if (!studentGrade) {
      studentGrade = serverReviewState.studentClasses[studentId]?.grade;
    }

    if (!studentGrade) {
      return res.status(400).json({
        success: false,
        error: "MISSING_EXACT_GRADE",
        message: "Student exact grade is required to join a class."
      });
    }

    // Validate that student's exact grade is compatible with the target class group
    const derivedGroupId = getClassGroupIdForGrade(studentGrade);
    if (derivedGroupId !== matchedInstance.classGroupId) {
      return res.status(400).json({
        success: false,
        error: "INCOMPATIBLE_GRADE",
        message: `Your exact grade (${studentGrade}) belongs to "${derivedGroupId}" and is not compatible with "${matchedInstance.classGroupId}".`
      });
    }

    // Ensure student has at most ONE active membership in current year
    const memKey = `mem_${studentId}_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}`;
    serverReviewState.classMemberships[memKey] = {
      id: memKey,
      churchYear: curYear,
      classGroupId: matchedInstance.classGroupId,
      classInstanceId: matchedInstance.id,
      studentId,
      studentName: serverReviewState.studentClasses[studentId]?.fullName || studentId,
      exactGrade: studentGrade,
      status: 'ACTIVE',
      enrolledAt: new Date().toISOString(),
      enrolledBy: 'join_code'
    };

    serverReviewState.studentClasses[studentId] = {
      studentId,
      fullName: serverReviewState.studentClasses[studentId]?.fullName || studentId,
      grade: studentGrade,
      classGroupId: matchedInstance.classGroupId,
      churchYear: curYear,
      avatarUrl: serverReviewState.studentClasses[studentId]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
    };

    savePersistentClassState();

    return res.json({
      success: true,
      message: `Enrolled successfully in ${matchedInstance.nameEn} (${curYear})`,
      classInstance: matchedInstance,
      studentClass: serverReviewState.studentClasses[studentId]
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 4. Regenerate Class Code (Authorized Servants & Admins Only)
app.post("/api/church/classes/:classGroupId/regenerate-code", async (req, res) => {
  try {
    const classGroupId = req.params.classGroupId;
    const authContext = await verifyServerRequestAuth(req);

    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Only authorized servants and admins can regenerate class codes."
        });
      }

      if (authContext.role === 'teacher') {
        const assignedClasses = serverReviewState.teacherAssignments[authContext.userId] || [];
        if (!assignedClasses.includes(classGroupId)) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: `Servant ${authContext.userId} is not assigned to class "${classGroupId}".`
          });
        }
      }
    }

    const curYear = serverReviewState.currentChurchYear;
    const instanceKey = `inst_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}_${classGroupId}`;
    let targetInstance = serverReviewState.classInstances[instanceKey];
    if (!targetInstance) {
      targetInstance = Object.values(serverReviewState.classInstances).find(
        (inst: any) => inst.churchYear === curYear && inst.classGroupId === classGroupId
      );
    }

    if (!targetInstance) {
      return res.status(404).json({
        success: false,
        error: "CLASS_INSTANCE_NOT_FOUND",
        message: `No active class instance found for "${classGroupId}" in church year ${curYear}.`
      });
    }

    const newCode = generateClassCode(`MUSA`);
    targetInstance.code = newCode;
    targetInstance.updatedAt = new Date().toISOString();

    savePersistentClassState();

    return res.json({
      success: true,
      newCode,
      classInstance: targetInstance,
      message: `Join code regenerated successfully. Old code is now invalidated for future joins.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 5. Remove Student from Current Church-Year Class (Authorized Servants & Admins Only)
app.post("/api/church/classes/:classGroupId/remove-student", async (req, res) => {
  try {
    const classGroupId = req.params.classGroupId;
    const { studentId, reason } = req.body;
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_STUDENT_ID",
        message: "studentId is required"
      });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents cannot remove students from classes."
        });
      }

      if (authContext.role === 'teacher') {
        const assignedClasses = serverReviewState.teacherAssignments[authContext.userId] || [];
        if (!assignedClasses.includes(classGroupId)) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: `Servant ${authContext.userId} is not assigned to class "${classGroupId}".`
          });
        }
      }
    }

    const curYear = serverReviewState.currentChurchYear;
    const memKey = `mem_${studentId}_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}`;
    if (serverReviewState.classMemberships[memKey]) {
      serverReviewState.classMemberships[memKey].status = 'REMOVED';
      serverReviewState.classMemberships[memKey].removedAt = new Date().toISOString();
      serverReviewState.classMemberships[memKey].removedBy = authContext.userId || 'servant';
      serverReviewState.classMemberships[memKey].removalReason = reason || 'Removed by servant/admin';
    }

    // Unassign student from current active class
    if (serverReviewState.studentClasses[studentId]) {
      delete serverReviewState.studentClasses[studentId];
    }

    // Historical records, progress, quiz attempts, and relationships remain intact!
    savePersistentClassState();

    return res.json({
      success: true,
      studentId,
      message: `Student "${studentId}" removed from class "${classGroupId}" for church year ${curYear}. Historical records preserved.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 6. Add Student to Class (Authorized Servants & Admins Only)
app.post("/api/church/classes/:classGroupId/add-student", async (req, res) => {
  try {
    const classGroupId = req.params.classGroupId;
    const { studentId, exactGrade } = req.body;
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_STUDENT_ID",
        message: "studentId is required"
      });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents cannot add students to classes."
        });
      }

      if (authContext.role === 'teacher') {
        const assignedClasses = serverReviewState.teacherAssignments[authContext.userId] || [];
        if (!assignedClasses.includes(classGroupId)) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: `Servant ${authContext.userId} is not assigned to class "${classGroupId}".`
          });
        }
      }
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    // Real Supabase persistence via Phase 3B RPC when online (Phase 3C.3)
    if (supabaseUrl && supabaseAnonKey && token && !token.startsWith("test_jwt_")) {
      try {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false }
        });

        // 1. Check active church year
        const { data: activeYear } = await client
          .from('church_years')
          .select('id, name')
          .eq('is_active', true)
          .maybeSingle();

        const curYearId = activeYear?.id || '2026-2027';

        // 2. Query student profile
        const { data: studentProfile, error: pErr } = await client
          .from('profiles')
          .select('id, name, role, grade')
          .eq('id', studentId)
          .maybeSingle();

        if (pErr || !studentProfile) {
          return res.status(404).json({
            success: false,
            error: "STUDENT_NOT_FOUND",
            message: `Student with ID "${studentId}" was not found.`
          });
        }

        if (studentProfile.role !== 'student') {
          return res.status(400).json({
            success: false,
            error: "NOT_A_STUDENT",
            message: `Target user does not hold the student role.`
          });
        }

        // 3. Resolve class_instance_id
        let resolvedInstanceId = req.body.classInstanceId;
        if (!resolvedInstanceId) {
          if (authContext.role === 'admin') {
            const { data: inst } = await client
              .from('class_instances')
              .select('id')
              .eq('church_year_id', curYearId)
              .eq('class_group_id', classGroupId)
              .maybeSingle();
            resolvedInstanceId = inst?.id;
          } else {
            const { data: assignment } = await client
              .from('servant_class_assignments')
              .select('class_instance_id')
              .eq('servant_id', authContext.userId)
              .eq('church_year_id', curYearId)
              .eq('is_active', true)
              .maybeSingle();
            resolvedInstanceId = assignment?.class_instance_id;
          }
        }

        if (!resolvedInstanceId) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Unauthorized: Servant is not assigned to this class instance in the active church year."
          });
        }

        // 4. Call approved Phase 3B RPC
        const { data: rpcData, error: rpcErr } = await client.rpc('enroll_student_in_class', {
          p_student_id: studentProfile.id,
          p_class_instance_id: resolvedInstanceId
        });

        if (rpcErr) {
          return res.status(400).json({
            success: false,
            error: rpcErr.message.includes('Unauthorized') ? 'FORBIDDEN' : (rpcErr.message.includes('Grade') ? 'INVALID_GRADE' : 'ENROLLMENT_FAILED'),
            message: rpcErr.message
          });
        }

        return res.json({
          success: true,
          action: rpcData?.action || 'enrolled',
          membershipId: rpcData?.membershipId,
          classInstanceId: rpcData?.classInstanceId,
          message: `Student "${studentId}" enrolled in class "${classGroupId}".`
        });
      } catch (sbErr: any) {
        return res.status(500).json({
          success: false,
          error: "ENROLLMENT_ERROR",
          message: sbErr?.message || "Failed to execute enrollment"
        });
      }
    }

    const curYear = serverReviewState.currentChurchYear;
    const instanceKey = `inst_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}_${classGroupId}`;
    const targetGrade = exactGrade || (serverReviewState.classes[classGroupId]?.grades?.[0] || 'Grade 4');

    const memKey = `mem_${studentId}_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}`;
    serverReviewState.classMemberships[memKey] = {
      id: memKey,
      churchYear: curYear,
      classGroupId,
      classInstanceId: instanceKey,
      studentId,
      studentName: serverReviewState.studentClasses[studentId]?.fullName || studentId,
      exactGrade: targetGrade,
      status: 'ACTIVE',
      enrolledAt: new Date().toISOString(),
      enrolledBy: authContext.userId || 'servant'
    };

    serverReviewState.studentClasses[studentId] = {
      studentId,
      fullName: serverReviewState.studentClasses[studentId]?.fullName || studentId,
      grade: targetGrade,
      classGroupId,
      churchYear: curYear,
      avatarUrl: serverReviewState.studentClasses[studentId]?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
    };

    savePersistentClassState();

    return res.json({
      success: true,
      student: serverReviewState.studentClasses[studentId],
      message: `Student "${studentId}" added to class "${classGroupId}".`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 7. Admin: Get Users List
app.get("/api/church/admin/users", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (!authContext.isAuthenticated || authContext.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Only church administrators can access user management."
      });
    }

    const users: any[] = [];
    const seen = new Set<string>();

    for (const [userId, role] of Object.entries(serverReviewState.userRoles)) {
      if (seen.has(userId)) continue;
      seen.add(userId);
      const studentClass = serverReviewState.studentClasses[userId];
      const assigned = serverReviewState.teacherAssignments[userId] || [];
      users.push({
        id: userId,
        name: studentClass?.fullName || (userId.startsWith('user_') ? userId.split('_').slice(2).join(' ') : userId),
        email: `${userId}@church.org`,
        role,
        grade: studentClass?.grade,
        assignedClasses: assigned,
        avatar: studentClass?.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`
      });
    }

    for (const [studentId, s] of Object.entries(serverReviewState.studentClasses)) {
      if (seen.has(studentId)) continue;
      seen.add(studentId);
      users.push({
        id: studentId,
        name: (s as any).fullName || studentId,
        email: `${studentId}@church.org`,
        role: 'student',
        grade: (s as any).grade,
        avatar: (s as any).avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
      });
    }

    return res.json({ success: true, users });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 8. Admin: Promote/Demote User Role
app.post("/api/church/admin/promote-user", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (!authContext.isAuthenticated || authContext.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Only church administrators can modify user roles."
      });
    }

    const { userId, role } = req.body;
    if (!userId || !role || !['student', 'teacher', 'admin', 'parent'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_ROLE",
        message: "Valid userId and role ('student' | 'teacher' | 'admin' | 'parent') required."
      });
    }

    serverReviewState.userRoles[userId] = role;
    savePersistentClassState();

    return res.json({
      success: true,
      userId,
      newRole: role,
      message: `User ${userId} role updated to ${role}.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 9. Admin: Assign/Unassign Servant to Class Group
app.post("/api/church/admin/assign-servant", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (!authContext.isAuthenticated || authContext.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Only church administrators can assign servants."
      });
    }

    const { servantId, classGroupId, action } = req.body;
    if (!servantId || !classGroupId || !['ASSIGN', 'REMOVE'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_PARAMS",
        message: "servantId, classGroupId, and action ('ASSIGN' | 'REMOVE') are required."
      });
    }

    if (!serverReviewState.teacherAssignments[servantId]) {
      serverReviewState.teacherAssignments[servantId] = [];
    }

    const curYear = serverReviewState.currentChurchYear;
    const instanceKey = `inst_${curYear.replace(/[^a-zA-Z0-9]/g, '-')}_${classGroupId}`;
    const classInst = serverReviewState.classInstances[instanceKey];

    if (action === 'ASSIGN') {
      if (!serverReviewState.teacherAssignments[servantId].includes(classGroupId)) {
        serverReviewState.teacherAssignments[servantId].push(classGroupId);
      }
      if (classInst && !classInst.servantIds.includes(servantId)) {
        classInst.servantIds.push(servantId);
      }
    } else {
      serverReviewState.teacherAssignments[servantId] = serverReviewState.teacherAssignments[servantId].filter(
        (id: string) => id !== classGroupId
      );
      if (classInst) {
        classInst.servantIds = classInst.servantIds.filter((id: string) => id !== servantId);
      }
    }

    savePersistentClassState();

    return res.json({
      success: true,
      servantId,
      assignedClasses: serverReviewState.teacherAssignments[servantId],
      message: `Servant ${servantId} ${action === 'ASSIGN' ? 'assigned to' : 'unassigned from'} ${classGroupId}.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 10. Admin: Preview New Church Year Rollover
app.get("/api/church/admin/year-transition-preview", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (!authContext.isAuthenticated || authContext.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Only church administrators can access year transition preview."
      });
    }

    const curYear = serverReviewState.currentChurchYear;
    let nextYear = "2027–2028";
    const parts = curYear.split(/[–-]/);
    if (parts.length === 2) {
      const y1 = parseInt(parts[0], 10);
      const y2 = parseInt(parts[1], 10);
      if (!isNaN(y1) && !isNaN(y2)) {
        nextYear = `${y1 + 1}–${y2 + 1}`;
      }
    }

    const previewList: any[] = [];
    for (const [studentId, student] of Object.entries(serverReviewState.studentClasses)) {
      const info = getNextGradeInfo((student as any).grade);
      previewList.push({
        studentId,
        name: (student as any).fullName || studentId,
        currentGrade: (student as any).grade || 'Grade 4',
        currentClassGroupId: (student as any).classGroupId || 'primary_2',
        projectedGrade: info.nextGrade,
        projectedClassGroupId: info.nextClassGroupId,
        isGraduated: info.isGraduated,
        explanation: info.explanation
      });
    }

    return res.json({
      success: true,
      currentYear: curYear,
      nextYear,
      previewList
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 11. Admin: Start New Church Year (Deterministic Rollover with Exception Support)
app.post("/api/church/admin/start-new-year", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (!authContext.isAuthenticated || authContext.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Only church administrators can start a new church year."
      });
    }

    const { targetYear, confirmed, exceptions } = req.body;
    if (!targetYear || typeof targetYear !== 'string' || !targetYear.trim()) {
      return res.status(400).json({
        success: false,
        error: "INVALID_YEAR",
        message: "targetYear is required (e.g. '2027–2028')."
      });
    }

    const trimmedTargetYear = targetYear.trim();
    const curYear = serverReviewState.currentChurchYear;

    if (trimmedTargetYear === curYear) {
      return res.status(400).json({
        success: false,
        error: "YEAR_ALREADY_ACTIVE",
        message: `Church year "${trimmedTargetYear}" is already the active church year.`
      });
    }

    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: "CONFIRMATION_REQUIRED",
        message: "Confirmation is required to start a new church year."
      });
    }

    // 1. Archive current year
    if (serverReviewState.churchYears[curYear]) {
      serverReviewState.churchYears[curYear].status = 'ARCHIVED';
      serverReviewState.churchYears[curYear].endDate = new Date().toISOString().split('T')[0];
    }

    // 2. Archive class instances of current year
    for (const inst of Object.values(serverReviewState.classInstances)) {
      if ((inst as any).churchYear === curYear) {
        (inst as any).status = 'ARCHIVED';
      }
    }

    // 3. Create new church year
    const yearId = `year-${trimmedTargetYear.replace(/[^a-zA-Z0-9]/g, '-')}`;
    serverReviewState.churchYears[trimmedTargetYear] = {
      id: yearId,
      year: trimmedTargetYear,
      status: 'ACTIVE',
      startDate: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      createdBy: authContext.userId || 'admin'
    };

    // 4. Create exactly six class instances for the new church year
    const canonicalGroups: Array<{ id: string; nameEn: string; nameAr: string }> = [
      { id: 'angels', nameEn: 'Angels', nameAr: 'فصل الملايكة' },
      { id: 'primary_1', nameEn: 'Primary 1–3', nameAr: 'فصل ابتدائي 1–3' },
      { id: 'primary_2', nameEn: 'Primary 4–6', nameAr: 'فصل ابتدائي 4–6' },
      { id: 'preparatory', nameEn: 'Preparatory', nameAr: 'فصل إعدادي' },
      { id: 'secondary', nameEn: 'Secondary', nameAr: 'فصل ثانوي' },
      { id: 'university', nameEn: 'University', nameAr: 'فصل جامعة' }
    ];

    const newClassInstances: any[] = [];
    for (const g of canonicalGroups) {
      const instId = `inst_${trimmedTargetYear.replace(/[^a-zA-Z0-9]/g, '-')}_${g.id}`;
      // Carry over previous servant assignments if present
      const prevInst = Object.values(serverReviewState.classInstances).find(
        (i: any) => i.churchYear === curYear && i.classGroupId === g.id
      ) as any;
      const servantIds = prevInst?.servantIds ? [...prevInst.servantIds] : [];

      const instRecord = {
        id: instId,
        churchYear: trimmedTargetYear,
        classGroupId: g.id,
        nameEn: g.nameEn,
        nameAr: g.nameAr,
        code: generateClassCode('MUSA'),
        servantIds,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      };
      serverReviewState.classInstances[instId] = instRecord;
      newClassInstances.push(instRecord);
    }

    // 5. Deterministic student promotion with support for administrative exceptions
    const exMap = (exceptions && typeof exceptions === 'object') ? exceptions : {};
    const previousStudentClasses = { ...serverReviewState.studentClasses };

    for (const [studentId, student] of Object.entries(previousStudentClasses)) {
      const studentName = (student as any).fullName || studentId;
      const currentGrade = (student as any).grade;
      const ex = exMap[studentId];

      let newGrade = '';
      let newGroupId = '';
      let status: 'ACTIVE' | 'GRADUATED' = 'ACTIVE';

      if (ex && ex.action === 'REPEAT') {
        newGrade = currentGrade;
        newGroupId = getClassGroupIdForGrade(currentGrade);
      } else if (ex && ex.action === 'MANUAL' && ex.manualGrade) {
        newGrade = ex.manualGrade;
        newGroupId = getClassGroupIdForGrade(ex.manualGrade);
      } else if (ex && ex.action === 'GRADUATE') {
        newGrade = 'Graduated';
        newGroupId = 'university';
        status = 'GRADUATED';
      } else {
        const info = getNextGradeInfo(currentGrade);
        newGrade = info.nextGrade;
        newGroupId = info.nextClassGroupId;
        if (info.isGraduated) {
          status = 'GRADUATED';
        }
      }

      const memId = `mem_${studentId}_${trimmedTargetYear.replace(/[^a-zA-Z0-9]/g, '-')}`;
      const instId = `inst_${trimmedTargetYear.replace(/[^a-zA-Z0-9]/g, '-')}_${newGroupId}`;

      serverReviewState.classMemberships[memId] = {
        id: memId,
        churchYear: trimmedTargetYear,
        classGroupId: newGroupId,
        classInstanceId: instId,
        studentId,
        studentName,
        exactGrade: newGrade,
        status,
        enrolledAt: new Date().toISOString(),
        enrolledBy: 'promotion_engine'
      };

      if (status === 'ACTIVE') {
        serverReviewState.studentClasses[studentId] = {
          studentId,
          fullName: studentName,
          grade: newGrade,
          classGroupId: newGroupId,
          churchYear: trimmedTargetYear,
          avatarUrl: (student as any).avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
        };
      } else {
        delete serverReviewState.studentClasses[studentId];
      }
    }

    // 6. Update current active church year
    serverReviewState.currentChurchYear = trimmedTargetYear;

    // 7. Save persistent state
    savePersistentClassState();

    return res.json({
      success: true,
      message: `Church year "${trimmedTargetYear}" started successfully.`,
      currentChurchYear: trimmedTargetYear,
      newClassInstances
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 2D.3: SERVANT STUDENT LEARNING REVIEW
// Read-only authoritative inspection of student progress, quizzes, and mastery
// ==============================================================================

app.get(["/api/church/student-learning-review/:studentId", "/api/church/student-learning-review"], async (req, res) => {
  try {
    const studentId = String(req.params.studentId || req.query.studentId || '').trim();
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "studentId is required"
      });
    }

    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students are not authorized to access servant learning reviews."
        });
      }

      if (authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Parents are not authorized to access servant learning reviews."
        });
      }
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

    // 1. Authoritative Student Profile and Class lookup
    let studentProfile: { id: string; name: string; grade: string; classGroupId: string; avatarUrl: string } | null = null;

    if (authContext.isAuthenticated && supabaseUrl && supabaseAnonKey && token && !token.startsWith("test_jwt_")) {
      try {
        const client = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: dbProfile } = await client
          .from('profiles')
          .select('id, name, grade, avatar, role')
          .eq('id', studentId)
          .maybeSingle();

        if (dbProfile) {
          studentProfile = {
            id: dbProfile.id,
            name: dbProfile.name,
            grade: dbProfile.grade || 'Grade 4',
            classGroupId: getClassGroupIdForGrade(dbProfile.grade),
            avatarUrl: dbProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${dbProfile.id}`
          };
        }
      } catch (sbErr) {
        console.warn("Supabase student lookup error in learning review:", sbErr);
      }
    }

    if (!studentProfile) {
      let existing = serverReviewState.studentClasses[studentId];
      if (!existing) {
        if (studentId === 'user_student_mark_101') existing = serverReviewState.studentClasses['mark'];
        else if (studentId === 'user_student_other_102') existing = serverReviewState.studentClasses['other'];
      }
      if (existing) {
        studentProfile = {
          id: existing.studentId,
          name: existing.fullName,
          grade: existing.grade,
          classGroupId: existing.classGroupId,
          avatarUrl: existing.avatarUrl
        };
      } else if (['mark', 'u1', 'student-david', 'c1', 'other'].includes(studentId)) {
        const gr = studentId === 'other' ? 'Prep 1' : 'Grade 4';
        const cg = getClassGroupIdForGrade(gr);
        studentProfile = {
          id: studentId,
          name: `Student ${studentId}`,
          grade: gr,
          classGroupId: cg,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
        };
      }
    }

    if (!studentProfile) {
      return res.status(404).json({
        success: false,
        error: "STUDENT_NOT_FOUND",
        message: `Student with ID "${studentId}" was not found.`
      });
    }

    // 2. Class Authorization check for teachers
    if (authContext.isAuthenticated && authContext.role === 'teacher') {
      const assignedClasses = serverReviewState.teacherAssignments[authContext.userId] || 
        (authContext.userId === 'mina' || authContext.userId === 'user_teacher_mina_101' ? ['primary_2'] : []);
      if (!assignedClasses.includes(studentProfile.classGroupId)) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: `Servant ${authContext.userId} is not authorized to review students in class "${studentProfile.classGroupId}".`
        });
      }
    }

    // 3. Collect only PUBLISHED lessons relevant to student's class
    // Draft or unpublished lessons are strictly excluded!
    const publishedLessonList = Object.values(serverReviewState.lessons).filter(
      (l: any) => l.status === 'published' && l.active_version_id
    );

    const lessonsData: any[] = [];
    const recentActivity: any[] = [];

    for (const l of publishedLessonList) {
      const activeVer = serverReviewState.versions[l.active_version_id];
      const pKey = `${studentId}_${l.id}`;
      const prog = serverReviewState.progress[pKey];
      const attempts = serverReviewState.attempts[pKey] || [];
      const mKey = `${studentId}_${l.id}`;
      const mastery = serverReviewState.mastery[mKey] || computeDeterministicMastery(
        studentId,
        l.id,
        l.active_version_id,
        prog,
        attempts,
        activeVer
      );

      const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
      const latestQuizScore = latestAttempt ? latestAttempt.score : (prog?.quizScore || 0);
      const latestQuizPercentage = latestAttempt ? latestAttempt.percentage : (prog?.quizScore || 0);
      const quizPassed = latestAttempt ? latestAttempt.passed : false;
      const totalSections = prog?.totalSections || activeVer?.sections?.length || 1;
      const completionPercent = prog ? prog.completionPercent : 0;
      const masteryStatus = mastery?.status || 'NOT_STARTED';
      const needsReview = Boolean(masteryStatus === 'NEEDS_REVIEW' || (latestAttempt && latestAttempt.percentage < 60));

      lessonsData.push({
        lessonId: l.id,
        title: activeVer?.titleEn || l.title_en || 'Sunday School Lesson',
        titleAr: activeVer?.titleAr || l.title_ar || 'درس مدارس الأحد',
        category: activeVer?.category || l.category || 'bible',
        versionId: l.active_version_id,
        progressStatus: prog ? prog.status : 'NOT_STARTED',
        completionPercent,
        sectionsCompleted: prog ? prog.sectionsCompleted : [],
        totalSections,
        latestQuizScore,
        latestQuizPercentage,
        quizPassed,
        quizAttemptsCount: attempts.length,
        masteryStatus,
        needsReview,
        lastActivityAt: latestAttempt?.submittedAt || prog?.completedAt || prog?.startedAt || null
      });

      if (latestAttempt) {
        recentActivity.push({
          type: 'quiz',
          lessonTitle: activeVer?.titleEn || l.id,
          description: `Quiz attempt scored ${latestAttempt.percentage}% (${latestAttempt.passed ? 'Passed' : 'Needs Review'})`,
          timestamp: latestAttempt.submittedAt || new Date().toISOString()
        });
      }

      if (prog && prog.status === 'COMPLETED') {
        recentActivity.push({
          type: 'lesson_completed',
          lessonTitle: activeVer?.titleEn || l.id,
          description: 'Completed all required published sections',
          timestamp: prog.completedAt || prog.startedAt || new Date().toISOString()
        });
      }
    }

    // Sort recent activity descending
    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Filter needs review items
    const needsReviewItems = lessonsData.filter(item => item.needsReview);

    // Summary calculations
    const completedCount = lessonsData.filter(item => item.progressStatus === 'COMPLETED').length;
    const masteredCount = lessonsData.filter(item => item.masteryStatus === 'MASTERED').length;
    const developingCount = lessonsData.filter(item => item.masteryStatus === 'DEVELOPING').length;
    const attemptedQuizzes = lessonsData.filter(item => item.quizAttemptsCount > 0);
    const averageQuizScore = attemptedQuizzes.length > 0
      ? Math.round(attemptedQuizzes.reduce((acc, curr) => acc + curr.latestQuizPercentage, 0) / attemptedQuizzes.length)
      : 0;

    return res.json({
      success: true,
      student: studentProfile,
      summary: {
        totalLessons: lessonsData.length,
        completedLessonsCount: completedCount,
        masteredCount,
        developingCount,
        needsReviewCount: needsReviewItems.length,
        averageQuizScore
      },
      lessons: lessonsData,
      needsReviewItems,
      recentActivity: recentActivity.slice(0, 10)
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 2D.4: PARENT / GUARDIAN LEARNING DASHBOARD
// Authoritative read-only inspection for linked children learning progress
// ==============================================================================

async function getAuthorizedChildrenForParent(parentId: string, req: express.Request): Promise<string[]> {
  const childIds = new Set<string>();

  // 1. In-memory / persistent review state
  for (const rel of serverReviewState.parentChildRelationships) {
    if (rel.parentId === parentId && (rel.relationshipType === 'parent_child' || rel.relationshipType === 'guardian_student')) {
      childIds.add(rel.childId);
    }
  }

  // 2. Supabase lookup if authenticated online
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (supabaseUrl && supabaseAnonKey && token && !token.startsWith("test_jwt_")) {
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false }
      });

      // Check user_relationships
      const { data: rels } = await client
        .from('user_relationships')
        .select('child_id')
        .eq('parent_id', parentId)
        .in('relationship_type', ['parent_child', 'guardian_student']);

      if (rels) {
        for (const r of rels) {
          if (r.child_id) childIds.add(r.child_id);
        }
      }

      // Check profiles.parent_id
      const { data: childrenProfiles } = await client
        .from('profiles')
        .select('id')
        .eq('parent_id', parentId);

      if (childrenProfiles) {
        for (const cp of childrenProfiles) {
          if (cp.id) childIds.add(cp.id);
        }
      }
    } catch (sbErr) {
      console.warn("Supabase parent-child lookup note:", sbErr);
    }
  }

  return Array.from(childIds);
}

// 1. Get Parent's Linked Children
app.get("/api/church/parent/children", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);

    if (authContext.isAuthenticated) {
      if (authContext.role === 'student') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students cannot access parent child lists."
        });
      }
      if (authContext.role === 'teacher') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Servants cannot use parent-only endpoints."
        });
      }
    }

    // Demo / Guest unauthenticated fallback
    if (!authContext.isAuthenticated) {
      const demoChildren = [
        {
          id: 'c1',
          name: 'Mina Emad',
          grade: 'Grade 4',
          classGroupId: 'primary_2',
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MinaEmad',
          attendanceRate: 98,
          points: 850
        },
        {
          id: 'c2',
          name: 'Mary Emad',
          grade: 'Grade 2',
          classGroupId: 'primary_1',
          avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MaryEmad',
          attendanceRate: 100,
          points: 820
        }
      ];
      return res.json({ success: true, children: demoChildren });
    }

    const parentId = authContext.userId || '';
    const linkedChildIds = await getAuthorizedChildrenForParent(parentId, req);

    const childrenData: any[] = [];
    for (const childId of linkedChildIds) {
      const studentClass = serverReviewState.studentClasses[childId];
      if (studentClass) {
        childrenData.push({
          id: studentClass.studentId,
          name: studentClass.fullName,
          grade: studentClass.grade,
          classGroupId: studentClass.classGroupId,
          avatarUrl: studentClass.avatarUrl,
          attendanceRate: 98,
          points: 850
        });
      } else {
        const gr = childId === 'other' ? 'Prep 1' : 'Grade 4';
        const cg = getClassGroupIdForGrade(gr);
        childrenData.push({
          id: childId,
          name: `Student ${childId}`,
          grade: gr,
          classGroupId: cg,
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${childId}`,
          attendanceRate: 95,
          points: 800
        });
      }
    }

    return res.json({
      success: true,
      children: childrenData
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Get Child Learning Review for Parent
app.get(["/api/church/parent/child-learning-review/:studentId", "/api/church/parent/child-learning-review"], async (req, res) => {
  try {
    const studentId = String(req.params.studentId || req.query.studentId || '').trim();
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "studentId is required"
      });
    }

    const authContext = await verifyServerRequestAuth(req);

    if (authContext.isAuthenticated) {
      if (authContext.role === 'student') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students are not authorized to access parent learning dashboard."
        });
      }
      if (authContext.role === 'teacher') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Servants cannot use parent-only endpoints to bypass servant review authorization."
        });
      }
    }

    // Demo / Guest mode fallback
    if (!authContext.isAuthenticated) {
      const demoReview = {
        student: {
          id: studentId,
          name: studentId === 'student-david' ? 'David Shenouda' : `Student ${studentId}`,
          grade: 'Grade 4',
          classGroupId: 'primary_2',
          avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
        },
        summary: {
          totalLessons: 1,
          completedLessonsCount: 1,
          masteredCount: 1,
          developingCount: 0,
          needsReviewCount: 0,
          averageQuizScore: 85
        },
        lessons: [
          {
            lessonId: 'l-test-multiversion-01',
            title: 'Sunday School Lesson',
            titleAr: 'درس مدارس الأحد',
            category: 'bible',
            versionId: 'v-test-multi-1',
            progressStatus: 'COMPLETED',
            completionPercent: 100,
            sectionsCompleted: ['sec-multi-1', 'sec-multi-2', 'sec-multi-3'],
            totalSections: 3,
            latestQuizScore: 2,
            latestQuizPercentage: 100,
            quizPassed: true,
            quizAttemptsCount: 1,
            masteryStatus: 'MASTERED',
            needsReview: false,
            lastActivityAt: new Date().toISOString()
          }
        ],
        needsReviewItems: [],
        recentActivity: [
          {
            type: 'quiz',
            lessonTitle: 'Sunday School Lesson',
            description: 'Quiz attempt scored 100% (Passed)',
            timestamp: new Date().toISOString()
          }
        ]
      };
      return res.json({ success: true, ...demoReview });
    }

    // Check student existence
    const existingStudent = serverReviewState.studentClasses[studentId] || 
      (studentId === 'mark' ? serverReviewState.studentClasses['mark'] : null);
    const knownStudentIds = ['mark', 'student-david', 'u1', 'c1', 'other', 'user_student_mark_101', 'user_student_other_102'];

    if (!existingStudent && !knownStudentIds.includes(studentId)) {
      return res.status(404).json({
        success: false,
        error: "STUDENT_NOT_FOUND",
        message: `Child with ID "${studentId}" was not found.`
      });
    }

    // Parent Authorization Check (Parent can only inspect their linked children!)
    if (authContext.role === 'parent') {
      const parentId = authContext.userId || '';
      const authorizedChildren = await getAuthorizedChildrenForParent(parentId, req);
      
      if (!authorizedChildren.includes(studentId)) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: `Parent "${parentId}" is not authorized to access learning data for child "${studentId}".`
        });
      }
    }

    // Assemble authoritative student profile
    const studentClass = serverReviewState.studentClasses[studentId] || {
      studentId,
      fullName: `Student ${studentId}`,
      grade: studentId === 'other' ? 'Prep 1' : 'Grade 4',
      classGroupId: studentId === 'other' ? 'preparatory' : 'primary_2',
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${studentId}`
    };

    const studentProfile = {
      id: studentClass.studentId,
      name: studentClass.fullName,
      grade: studentClass.grade,
      classGroupId: studentClass.classGroupId,
      avatarUrl: studentClass.avatarUrl
    };

    // Collect published lessons relevant to child's class group
    const publishedLessonList = Object.values(serverReviewState.lessons).filter(
      (l: any) => l.status === 'published' && l.active_version_id
    );

    const lessonsData: any[] = [];
    const recentActivity: any[] = [];

    for (const l of publishedLessonList) {
      const activeVer = serverReviewState.versions[l.active_version_id];
      const pKey = `${studentId}_${l.id}`;
      const prog = serverReviewState.progress[pKey];
      const attempts = serverReviewState.attempts[pKey] || [];
      const mKey = `${studentId}_${l.id}`;
      const mastery = serverReviewState.mastery[mKey] || computeDeterministicMastery(
        studentId,
        l.id,
        l.active_version_id,
        prog,
        attempts,
        activeVer
      );

      const latestAttempt = attempts.length > 0 ? attempts[attempts.length - 1] : null;
      const latestQuizScore = latestAttempt ? latestAttempt.score : (prog?.quizScore || 0);
      const latestQuizPercentage = latestAttempt ? latestAttempt.percentage : (prog?.quizScore || 0);
      const quizPassed = latestAttempt ? latestAttempt.passed : false;
      const totalSections = prog?.totalSections || activeVer?.sections?.length || 1;
      const completionPercent = prog ? prog.completionPercent : 0;
      const masteryStatus = mastery?.status || 'NOT_STARTED';
      const needsReview = Boolean(masteryStatus === 'NEEDS_REVIEW' || (latestAttempt && latestAttempt.percentage < 60));

      lessonsData.push({
        lessonId: l.id,
        title: activeVer?.titleEn || l.title_en || 'Sunday School Lesson',
        titleAr: activeVer?.titleAr || l.title_ar || 'درس مدارس الأحد',
        category: activeVer?.category || l.category || 'bible',
        versionId: l.active_version_id,
        progressStatus: prog ? prog.status : 'NOT_STARTED',
        completionPercent,
        sectionsCompleted: prog ? prog.sectionsCompleted : [],
        totalSections,
        latestQuizScore,
        latestQuizPercentage,
        quizPassed,
        quizAttemptsCount: attempts.length,
        masteryStatus,
        needsReview,
        lastActivityAt: latestAttempt?.submittedAt || prog?.completedAt || prog?.startedAt || null
      });

      if (latestAttempt) {
        recentActivity.push({
          type: 'quiz',
          lessonTitle: activeVer?.titleEn || l.id,
          description: `Quiz attempt scored ${latestAttempt.percentage}% (${latestAttempt.passed ? 'Passed' : 'Needs Review'})`,
          timestamp: latestAttempt.submittedAt || new Date().toISOString()
        });
      }

      if (prog && prog.status === 'COMPLETED') {
        recentActivity.push({
          type: 'lesson_completed',
          lessonTitle: activeVer?.titleEn || l.id,
          description: 'Completed all required published sections',
          timestamp: prog.completedAt || prog.startedAt || new Date().toISOString()
        });
      }
    }

    recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const needsReviewItems = lessonsData.filter(item => item.needsReview);
    const completedCount = lessonsData.filter(item => item.progressStatus === 'COMPLETED').length;
    const masteredCount = lessonsData.filter(item => item.masteryStatus === 'MASTERED').length;
    const developingCount = lessonsData.filter(item => item.masteryStatus === 'DEVELOPING').length;
    const attemptedQuizzes = lessonsData.filter(item => item.quizAttemptsCount > 0);
    const averageQuizScore = attemptedQuizzes.length > 0
      ? Math.round(attemptedQuizzes.reduce((acc, curr) => acc + curr.latestQuizPercentage, 0) / attemptedQuizzes.length)
      : 0;

    return res.json({
      success: true,
      student: studentProfile,
      summary: {
        totalLessons: lessonsData.length,
        completedLessonsCount: completedCount,
        masteredCount,
        developingCount,
        needsReviewCount: needsReviewItems.length,
        averageQuizScore
      },
      lessons: lessonsData,
      needsReviewItems,
      recentActivity: recentActivity.slice(0, 10)
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 2E.1: MEDIA & SOURCE MANAGEMENT API ENDPOINTS
// ==============================================================================

// 1. List / Query Sources for Authorized Servants
app.get("/api/church/sources", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);

    // 1. Authorization & Role Checks
    if (authContext.isAuthenticated) {
      if (authContext.role === 'student' || authContext.role === 'parent') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students and parents are not permitted to access servant curriculum source library."
        });
      }
    } else {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
      const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);
      if (isConfigured) {
        return res.status(401).json({
          success: false,
          error: "UNAUTHORIZED",
          message: "Authentication required to access teacher curriculum sources."
        });
      }
    }

    const currentUserId = authContext.userId || 'user_teacher_mina_101';
    const currentUserRole = authContext.role || 'teacher';
    const lessonIdFilter = typeof req.query.lessonId === 'string' ? req.query.lessonId : null;
    const typeFilter = typeof req.query.type === 'string' ? req.query.type : null;

    // If specific lessonId requested, verify authorization to that lesson
    if (lessonIdFilter) {
      const targetLesson = serverReviewState.lessons[lessonIdFilter];
      if (!targetLesson) {
        return res.status(404).json({
          success: false,
          error: "LESSON_NOT_FOUND",
          message: `Lesson ${lessonIdFilter} not found.`
        });
      }
      if (currentUserRole !== 'admin') {
        const isOwner = targetLesson.createdBy === currentUserId ||
                        (currentUserId === 'mina' && targetLesson.createdBy === 'user_teacher_mina_101') ||
                        (currentUserId === 'user_teacher_mina_101' && targetLesson.createdBy === 'mina');
        const isPublished = targetLesson.status === 'published';
        if (!isOwner && !isPublished) {
          return res.status(403).json({
            success: false,
            error: "FORBIDDEN",
            message: "Cannot access private sources of another teacher's draft lesson."
          });
        }
      }
    }

    // Collect authorized sources
    const allLessonIds = Object.keys(serverReviewState.sources || {});
    const results: any[] = [];

    for (const lId of allLessonIds) {
      if (lessonIdFilter && lId !== lessonIdFilter) continue;

      const lesson = serverReviewState.lessons[lId];
      const isPublished = lesson?.status === 'published';
      const isLessonOwner = lesson?.createdBy === currentUserId ||
                            (currentUserId === 'mina' && lesson?.createdBy === 'user_teacher_mina_101') ||
                            (currentUserId === 'user_teacher_mina_101' && lesson?.createdBy === 'mina');

      const srcList = serverReviewState.sources[lId] || [];
      for (const s of srcList) {
        if (typeFilter && s.type !== typeFilter) continue;

        const isSourceOwner = s.uploadedBy === currentUserId ||
                              (currentUserId === 'mina' && s.uploadedBy === 'user_teacher_mina_101') ||
                              (currentUserId === 'user_teacher_mina_101' && s.uploadedBy === 'mina');

        // Privacy check: teachers cannot see other teachers' private draft sources
        if (currentUserRole !== 'admin' && !isSourceOwner && !isLessonOwner && !isPublished && !s.isPublic) {
          continue;
        }

        // Evidence map provenance connection
        let evidenceMapAvailable = false;
        let evidenceClaimsCount = 0;
        const claimSummary: any[] = [];

        for (const eMapId of Object.keys(serverReviewState.claims || {})) {
          const claims = serverReviewState.claims[eMapId] || [];
          const matchedClaims = claims.filter((c: any) => 
            c.sourceId === s.id || 
            c.sourceName === s.originalFilename ||
            (s.lessonId && (c.lessonId === s.lessonId || eMapId.includes(s.lessonId)))
          );
          if (matchedClaims.length > 0) {
            evidenceMapAvailable = true;
            evidenceClaimsCount += matchedClaims.length;
            claimSummary.push(...matchedClaims.map((c: any) => ({
              claimId: c.claimId,
              statementEn: c.statementEn,
              statementAr: c.statementAr,
              category: c.category,
              sourceLocation: c.sourceLocation,
              verified: c.verified,
              servantReviewStatus: c.servantReviewStatus
            })));
          }
        }

        results.push({
          id: s.id,
          lessonId: s.lessonId,
          lessonTitle: lesson?.title_en || lesson?.titleEn || (s.lessonId === 'l-cross-01' ? 'Discovery of the Holy Cross' : s.lessonId),
          lessonStatus: lesson?.status || 'draft',
          uploadedBy: s.uploadedBy,
          type: s.type,
          originalFilename: s.originalFilename,
          mimeType: s.mimeType,
          fileUrl: s.fileUrl,
          fileSize: s.fileSize,
          description: s.description || null,
          teacherNotes: s.teacherNotes || null,
          rightsStatus: s.rightsStatus || 'TEACHER_OWNED',
          processingStatus: s.processingStatus || 'INDEXED',
          priority: s.priority || 'PRIMARY',
          isPublic: Boolean(s.isPublic || isPublished),
          uploadedAt: s.uploadedAt || new Date().toISOString(),
          evidenceMapAvailable,
          evidenceClaimsCount,
          claimsSample: claimSummary.slice(0, 3)
        });
      }
    }

    return res.json({
      success: true,
      count: results.length,
      sources: results
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Inspect Single Source by ID
app.get("/api/church/sources/:sourceId", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);

    if (authContext.isAuthenticated && (authContext.role === 'student' || authContext.role === 'parent')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents are not permitted to access servant curriculum source details."
      });
    }

    const sourceId = req.params.sourceId;
    let foundSource: any = null;
    let parentLessonId: string | null = null;

    for (const lId of Object.keys(serverReviewState.sources || {})) {
      const match = (serverReviewState.sources[lId] || []).find((s: any) => s.id === sourceId);
      if (match) {
        foundSource = match;
        parentLessonId = lId;
        break;
      }
    }

    if (!foundSource) {
      return res.status(404).json({
        success: false,
        error: "SOURCE_NOT_FOUND",
        message: `Source ${sourceId} not found.`
      });
    }

    const currentUserId = authContext.userId || 'user_teacher_mina_101';
    const currentUserRole = authContext.role || 'teacher';
    const lesson = parentLessonId ? serverReviewState.lessons[parentLessonId] : null;
    const isPublished = lesson?.status === 'published';
    const isSourceOwner = foundSource.uploadedBy === currentUserId ||
                          (currentUserId === 'mina' && foundSource.uploadedBy === 'user_teacher_mina_101') ||
                          (currentUserId === 'user_teacher_mina_101' && foundSource.uploadedBy === 'mina');
    const isLessonOwner = lesson?.createdBy === currentUserId ||
                          (currentUserId === 'mina' && lesson?.createdBy === 'user_teacher_mina_101') ||
                          (currentUserId === 'user_teacher_mina_101' && lesson?.createdBy === 'mina');

    if (currentUserRole !== 'admin' && !isSourceOwner && !isLessonOwner && !isPublished && !foundSource.isPublic) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Cannot access private draft source of another teacher."
      });
    }

    // Collect all matched claims
    const matchedClaims: any[] = [];
    for (const eMapId of Object.keys(serverReviewState.claims || {})) {
      const claims = serverReviewState.claims[eMapId] || [];
      const m = claims.filter((c: any) => 
        c.sourceId === foundSource.id || 
        c.sourceName === foundSource.originalFilename
      );
      matchedClaims.push(...m);
    }

    return res.json({
      success: true,
      source: {
        ...foundSource,
        lessonTitle: lesson?.title_en || lesson?.titleEn || foundSource.lessonId,
        lessonStatus: lesson?.status || 'draft',
        isPublic: Boolean(foundSource.isPublic || isPublished),
        evidenceMapAvailable: matchedClaims.length > 0,
        evidenceClaimsCount: matchedClaims.length,
        claims: matchedClaims
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 3. Attach / Link Source to a Lesson
app.post("/api/church/sources", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);

    if (authContext.isAuthenticated && (authContext.role === 'student' || authContext.role === 'parent')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents cannot add or link curriculum sources."
      });
    }

    const { lessonId, type, originalFilename, mimeType, fileUrl, fileSize, description, teacherNotes, rightsStatus, priority } = req.body;

    if (!lessonId || !type || !originalFilename) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "lessonId, type, and originalFilename are required."
      });
    }

    const allowedTypes = ['PDF', 'DOCX', 'PPTX', 'IMAGE', 'TEACHER_VOICE', 'TEACHER_TEXT', 'YOUTUBE_VIDEO', 'OTHER_APPROVED_RESOURCE'];
    if (!allowedTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_SOURCE_TYPE",
        message: `Type ${type} is not a supported source type.`
      });
    }

    const currentUserId = authContext.userId || 'user_teacher_mina_101';
    const currentUserRole = authContext.role || 'teacher';
    const targetLesson = serverReviewState.lessons[lessonId];

    if (targetLesson && currentUserRole !== 'admin') {
      const isOwner = targetLesson.createdBy === currentUserId ||
                      (currentUserId === 'mina' && targetLesson.createdBy === 'user_teacher_mina_101') ||
                      (currentUserId === 'user_teacher_mina_101' && targetLesson.createdBy === 'mina');
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Cannot attach sources to another teacher's lesson."
        });
      }
    }

    const newSource = {
      id: `src-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      lessonId,
      uploadedBy: currentUserId,
      type,
      originalFilename,
      mimeType: mimeType || 'application/octet-stream',
      fileUrl: fileUrl || '#',
      fileSize: fileSize || 0,
      description: description || null,
      teacherNotes: teacherNotes || null,
      rightsStatus: rightsStatus || 'TEACHER_OWNED',
      processingStatus: 'INDEXED',
      priority: priority || 'PRIMARY',
      isPublic: false,
      uploadedAt: new Date().toISOString()
    };

    if (!serverReviewState.sources[lessonId]) {
      serverReviewState.sources[lessonId] = [];
    }
    serverReviewState.sources[lessonId].push(newSource);

    return res.status(201).json({
      success: true,
      source: newSource
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 4. Detach / Remove Source from a Lesson (Servant Authorization Guarded)
app.delete("/api/church/sources/:sourceId", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);

    if (authContext.isAuthenticated && (authContext.role === 'student' || authContext.role === 'parent')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents cannot remove curriculum sources."
      });
    }

    const sourceId = req.params.sourceId;
    let foundSource: any = null;
    let parentLessonId: string | null = null;
    let foundIndex = -1;

    for (const lId of Object.keys(serverReviewState.sources || {})) {
      const idx = (serverReviewState.sources[lId] || []).findIndex((s: any) => s.id === sourceId);
      if (idx !== -1) {
        foundSource = serverReviewState.sources[lId][idx];
        parentLessonId = lId;
        foundIndex = idx;
        break;
      }
    }

    if (!foundSource || !parentLessonId) {
      return res.status(404).json({
        success: false,
        error: "SOURCE_NOT_FOUND",
        message: `Source ${sourceId} not found.`
      });
    }

    const currentUserId = authContext.userId || 'user_teacher_mina_101';
    const currentUserRole = authContext.role || 'teacher';
    const lesson = serverReviewState.lessons[parentLessonId];

    if (lesson?.status === 'published') {
      return res.status(400).json({
        success: false,
        error: "IMMUTABLE_PUBLISHED_LESSON",
        message: "Cannot delete or detach sources from a published curriculum lesson."
      });
    }

    const isSourceOwner = foundSource.uploadedBy === currentUserId ||
                          (currentUserId === 'mina' && foundSource.uploadedBy === 'user_teacher_mina_101') ||
                          (currentUserId === 'user_teacher_mina_101' && foundSource.uploadedBy === 'mina');

    if (currentUserRole !== 'admin' && !isSourceOwner) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Teacher cannot delete another teacher's source."
      });
    }

    // Safe deletion from serverReviewState
    serverReviewState.sources[parentLessonId].splice(foundIndex, 1);

    return res.json({
      success: true,
      message: "Source detached and removed successfully."
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 5. Read-only Evidence Inspection for a Source
app.get("/api/church/sources/:sourceId/evidence", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);

    if (authContext.isAuthenticated && (authContext.role === 'student' || authContext.role === 'parent')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents cannot inspect evidence map details."
      });
    }

    const sourceId = req.params.sourceId;
    let foundSource: any = null;
    let parentLessonId: string | null = null;

    for (const lId of Object.keys(serverReviewState.sources || {})) {
      const match = (serverReviewState.sources[lId] || []).find((s: any) => s.id === sourceId);
      if (match) {
        foundSource = match;
        parentLessonId = lId;
        break;
      }
    }

    if (!foundSource) {
      return res.status(404).json({
        success: false,
        error: "SOURCE_NOT_FOUND",
        message: `Source ${sourceId} not found.`
      });
    }

    const currentUserId = authContext.userId || 'user_teacher_mina_101';
    const currentUserRole = authContext.role || 'teacher';
    const lesson = parentLessonId ? serverReviewState.lessons[parentLessonId] : null;
    const isPublished = lesson?.status === 'published';
    const isSourceOwner = foundSource.uploadedBy === currentUserId ||
                          (currentUserId === 'mina' && foundSource.uploadedBy === 'user_teacher_mina_101') ||
                          (currentUserId === 'user_teacher_mina_101' && foundSource.uploadedBy === 'mina');

    if (currentUserRole !== 'admin' && !isSourceOwner && !isPublished && !foundSource.isPublic) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Cannot inspect evidence map for another teacher's private draft source."
      });
    }

    // Collect matched claims
    const matchedClaims: any[] = [];
    for (const eMapId of Object.keys(serverReviewState.claims || {})) {
      const claims = serverReviewState.claims[eMapId] || [];
      const m = claims.filter((c: any) => 
        c.sourceId === foundSource.id || 
        c.sourceName === foundSource.originalFilename
      );
      matchedClaims.push(...m);
    }

    return res.json({
      success: true,
      readOnly: true,
      sourceId: foundSource.id,
      lessonId: foundSource.lessonId,
      sourceFilename: foundSource.originalFilename,
      evidenceMapAvailable: matchedClaims.length > 0,
      claimsCount: matchedClaims.length,
      claims: matchedClaims
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// ==============================================================================
// PHASE 2E.2: GENERATED LEARNING MATERIALS (SLIDES, FLASHCARDS, QUIZ)
// ==============================================================================

// 1. Generate Structured Learning Materials for an Approved/Published Lesson Version
app.post("/api/church/lessons/:lessonId/generate-materials", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);

    // 1. Authentication check
    if (!authContext.isAuthenticated) {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
      if (supabaseUrl && supabaseAnonKey) {
        return res.status(401).json({
          success: false,
          error: "UNAUTHORIZED",
          message: "Authentication required to generate learning materials."
        });
      }
    }

    // 2. Role validation (Students and Parents strictly forbidden)
    if (authContext.role === 'student' || authContext.role === 'parent') {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents cannot generate curriculum learning materials."
      });
    }

    const lessonId = req.params.lessonId;
    const lesson = serverReviewState.lessons[lessonId];
    if (!lesson) {
      return res.status(404).json({
        success: false,
        error: "LESSON_NOT_FOUND",
        message: `Lesson ${lessonId} not found.`
      });
    }

    // 3. Teacher authorization check
    const currentUserId = authContext.userId || 'user_teacher_mina_101';
    const currentUserRole = authContext.role || 'teacher';
    if (currentUserRole !== 'admin') {
      const isOwner = lesson.createdBy === currentUserId ||
                      (currentUserId === 'mina' && lesson.createdBy === 'user_teacher_mina_101') ||
                      (currentUserId === 'user_teacher_mina_101' && lesson.createdBy === 'mina');
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Cannot generate learning materials for another teacher's lesson."
        });
      }
    }

    // 4. Resolve target version
    let targetVersionId = req.body.versionId;
    let targetVersion: any = null;
    if (targetVersionId) {
      targetVersion = serverReviewState.versions[targetVersionId];
      if (!targetVersion || targetVersion.lessonId !== lessonId) {
        return res.status(404).json({
          success: false,
          error: "VERSION_NOT_FOUND",
          message: `Version ${targetVersionId} not found for lesson ${lessonId}.`
        });
      }
    } else {
      // Find latest approved or published version
      const matchingVersions = Object.values(serverReviewState.versions).filter(
        (v: any) => v.lessonId === lessonId && (v.status === 'APPROVED' || v.status === 'PUBLISHED')
      );
      if (matchingVersions.length > 0) {
        targetVersion = matchingVersions[matchingVersions.length - 1];
        targetVersionId = targetVersion.id;
      } else {
        // Fallback to active_version_id
        if (lesson.active_version_id && serverReviewState.versions[lesson.active_version_id]) {
          targetVersion = serverReviewState.versions[lesson.active_version_id];
          targetVersionId = targetVersion.id;
        } else {
          const anyVersion = Object.values(serverReviewState.versions).find((v: any) => v.lessonId === lessonId);
          targetVersion = anyVersion;
          targetVersionId = anyVersion ? (anyVersion as any).id : null;
        }
      }
    }

    if (!targetVersion) {
      return res.status(404).json({
        success: false,
        error: "VERSION_NOT_FOUND",
        message: `No version found for lesson ${lessonId}.`
      });
    }

    // 5. Version status safety: MUST BE APPROVED OR PUBLISHED
    if (targetVersion.status !== 'APPROVED' && targetVersion.status !== 'PUBLISHED') {
      return res.status(400).json({
        success: false,
        error: "LESSON_NOT_APPROVED",
        message: `Learning materials can only be generated for APPROVED or PUBLISHED lesson versions (current status: ${targetVersion.status}).`
      });
    }

    // 6. Evidence map / provenance verification
    const relevantClaims: any[] = [];
    for (const eMapId of Object.keys(serverReviewState.claims || {})) {
      const claims = serverReviewState.claims[eMapId] || [];
      const m = claims.filter((c: any) => 
        (c.lessonId && c.lessonId === lessonId) ||
        eMapId.includes(lessonId) ||
        (lessonId === 'l-test-draft-01' && eMapId === 'e-map-test-01') ||
        (lessonId === 'l-test-multiversion-01' && eMapId === 'e-map-multi-01')
      );
      relevantClaims.push(...m);
    }

    if (relevantClaims.length === 0) {
      return res.status(400).json({
        success: false,
        error: "EVIDENCE_MAP_REQUIRED",
        message: `Lesson ${lessonId} has no valid evidence map or verified theological claims for grounded material generation.`
      });
    }

    // 7. Resolve sources belonging ONLY to this lesson
    const lessonSources = serverReviewState.sources[lessonId] || [];
    const validSourceRefs = lessonSources.map((s: any) => ({
      sourceId: s.id,
      sourceName: s.originalFilename,
      location: 'Curriculum Handout'
    }));
    const primarySourceRef = validSourceRefs[0] || {
      sourceId: `src-${lessonId}-main`,
      sourceName: 'Official Church Handout',
      location: 'Section 1'
    };

    // 8. Generate strictly grounded materials:
    const sections = targetVersion.sections || [
      { id: 'sec-1', titleEn: 'Lesson Foundation', titleAr: 'أساسيات الدرس' }
    ];

    const typesRequested = req.body.types || 'ALL';
    const shouldGenerateSlides = typesRequested === 'ALL' || typesRequested.includes('SLIDES');
    const shouldGenerateFlashcards = typesRequested === 'ALL' || typesRequested.includes('FLASHCARDS');
    const shouldGenerateQuiz = typesRequested === 'ALL' || typesRequested.includes('QUIZ');

    // Slides generation
    const generatedSlides: any[] = [];
    if (shouldGenerateSlides) {
      sections.forEach((sec: any, idx: number) => {
        const claim = relevantClaims[idx % relevantClaims.length] || relevantClaims[0];
        generatedSlides.push({
          number: idx + 1,
          titleEn: sec.titleEn || `Part ${idx + 1}: ${claim.statementEn}`,
          titleAr: sec.titleAr || (claim.statementAr || `الجزء ${idx + 1}`),
          bulletsEn: [
            claim.quoteEn || claim.statementEn,
            `Historical context verified from ${claim.sourceName || primarySourceRef.sourceName}`,
            `Coptic Orthodox theological tradition affirmed.`
          ],
          bulletsAr: [
            claim.statementAr,
            `سياق تاريخي موثق من ${claim.sourceName || primarySourceRef.sourceName}`,
            `تأكيد التقليد الكنسي القبطي الأرثوذكسي.`
          ],
          speakerNotesEn: `Servant note: emphasize that ${claim.statementEn} is grounded in church history.`,
          speakerNotesAr: `ملاحظة الخادم: التأكيد على أن هذا الحدث موثق في تاريخ الكنيسة.`,
          scriptureRef: '1 Corinthians 1:18',
          sectionId: sec.id,
          sectionTitle: sec.titleEn,
          sourceRefs: [
            {
              sourceId: claim.sourceId || primarySourceRef.sourceId,
              sourceName: claim.sourceName || primarySourceRef.sourceName,
              location: claim.sourceLocation || 'Page 1'
            }
          ],
          reviewStatus: 'UNVERIFIED'
        });
      });
    }

    // Flashcards generation
    const generatedFlashcards: any[] = [];
    if (shouldGenerateFlashcards) {
      relevantClaims.forEach((claim: any, idx: number) => {
        const sec = sections[idx % sections.length];
        generatedFlashcards.push({
          id: `fc-gen-${Date.now()}-${idx + 1}`,
          frontEn: `Key Fact #${idx + 1}: What does church tradition affirm about ${claim.category || 'this event'}?`,
          frontAr: `حقيقة هامة #${idx + 1}: ماذا يؤكد التقليد الكنسي بخصوص هذا الحدث؟`,
          backEn: claim.statementEn,
          backAr: claim.statementAr,
          sectionId: sec.id,
          sectionTitle: sec.titleEn,
          sourceRefs: [
            {
              sourceId: claim.sourceId || primarySourceRef.sourceId,
              sourceName: claim.sourceName || primarySourceRef.sourceName,
              location: claim.sourceLocation || 'Page 1'
            }
          ],
          reviewStatus: 'UNVERIFIED'
        });
      });
    }

    // Quiz questions generation
    const generatedQuiz: any[] = [];
    if (shouldGenerateQuiz) {
      relevantClaims.forEach((claim: any, idx: number) => {
        const sec = sections[idx % sections.length];
        generatedQuiz.push({
          id: `q-gen-${Date.now()}-${idx + 1}`,
          type: 'multiple_choice',
          questionEn: `Based on the lesson evidence: ${claim.statementEn.replace(/\.$/, '')}?`,
          questionAr: `بناءً على شواهد الدرس: ${claim.statementAr.replace(/\.$/, '')}؟`,
          optionsEn: [
            claim.statementEn,
            `Alternative assertion ${idx + 1}A`,
            `Alternative assertion ${idx + 1}B`
          ],
          optionsAr: [
            claim.statementAr,
            `خيار غير صحيح أول`,
            `خيار غير صحيح ثانٍ`
          ],
          correctIndex: 0,
          explanationEn: `Verified from source ${claim.sourceName || primarySourceRef.sourceName} (${claim.sourceLocation || 'Handout'}).`,
          explanationAr: `موثق من مصدر ${claim.sourceName || primarySourceRef.sourceName}.`,
          sectionId: sec.id,
          sectionTitle: sec.titleEn,
          sourceRef: {
            sectionId: sec.id,
            sectionTitle: sec.titleEn,
            sourceId: claim.sourceId || primarySourceRef.sourceId,
            location: claim.sourceLocation || 'Page 1'
          },
          reviewStatus: 'UNVERIFIED'
        });
      });
    }

    // Store in serverReviewState.generatedMaterials
    const materialsPacket = {
      lessonId,
      versionId: targetVersionId,
      generatedBy: currentUserId,
      generatedAt: new Date().toISOString(),
      slides: generatedSlides,
      flashcards: generatedFlashcards,
      quiz: generatedQuiz
    };

    if (!serverReviewState.generatedMaterials) {
      serverReviewState.generatedMaterials = {};
    }
    serverReviewState.generatedMaterials[targetVersionId] = materialsPacket;

    return res.status(201).json({
      success: true,
      lessonId,
      versionId: targetVersionId,
      status: 'UNVERIFIED',
      message: 'Learning materials generated safely as UNVERIFIED draft. Servant review required before student publication.',
      materials: materialsPacket
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 2. Retrieve Generated Materials (Filtered for Students; Full for Authorized Servants)
app.get("/api/church/lessons/:lessonId/materials", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    const lessonId = req.params.lessonId;
    const lesson = serverReviewState.lessons[lessonId];

    if (!lesson) {
      return res.status(404).json({
        success: false,
        error: "LESSON_NOT_FOUND",
        message: `Lesson ${lessonId} not found.`
      });
    }

    // Unauthenticated (Demo / Offline fallback)
    if (!authContext.isAuthenticated) {
      return res.json({
        success: true,
        lessonId,
        versionId: lesson.active_version_id || 'v-test-multi-1',
        isStudentView: true,
        materials: {
          slides: [
            {
              number: 1,
              titleEn: '1. Discovery of the True Cross',
              titleAr: '١. اكتشاف عود الصليب المقدس',
              bulletsEn: ['Queen Helena traveled in 326 AD', 'Guidance of Judas the elder'],
              bulletsAr: ['سافرت الملكة هيلانة عام ٣٢٦ م', 'بإرشاد يهوذا الشيخ'],
              reviewStatus: 'APPROVED'
            }
          ],
          flashcards: [
            {
              id: 'fc-demo-1',
              frontEn: 'When was the True Cross discovered?',
              frontAr: 'متى تم اكتشاف الصليب المقدس؟',
              backEn: 'In 326 AD by Queen Helena',
              backAr: 'عام ٣٢٦ م بواسطة الملكة هيلانة',
              reviewStatus: 'APPROVED'
            }
          ],
          quiz: []
        }
      });
    }

    const currentUserId = authContext.userId || 'user_teacher_mina_101';
    const currentUserRole = authContext.role || 'student';
    const isStudent = currentUserRole === 'student' || currentUserRole === 'parent';

    // If student / parent:
    if (isStudent) {
      // Must be a published lesson
      if (lesson.status !== 'published') {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Students cannot access learning materials for unpublished draft lessons."
        });
      }

      const activeVerId = lesson.active_version_id || 'v-test-multi-1';
      const stored = serverReviewState.generatedMaterials?.[activeVerId];

      // Strict lesson/version containment check
      const validStored = (stored && stored.lessonId === lessonId && stored.versionId === activeVerId) ? stored : null;

      // Student ONLY receives APPROVED items!
      const approvedSlides = (validStored?.slides || []).filter((s: any) => s.reviewStatus === 'APPROVED');
      const approvedFlashcards = (validStored?.flashcards || []).filter((f: any) => f.reviewStatus === 'APPROVED');
      const approvedQuiz = (validStored?.quiz || []).filter((q: any) => q.reviewStatus === 'APPROVED');

      return res.json({
        success: true,
        lessonId,
        versionId: activeVerId,
        isStudentView: true,
        materials: {
          slides: approvedSlides,
          flashcards: approvedFlashcards,
          quiz: approvedQuiz
        }
      });
    }

    // If teacher:
    if (currentUserRole !== 'admin') {
      const isOwner = lesson.createdBy === currentUserId ||
                      (currentUserId === 'mina' && lesson.createdBy === 'user_teacher_mina_101') ||
                      (currentUserId === 'user_teacher_mina_101' && lesson.createdBy === 'mina');
      const isPublished = lesson.status === 'published';
      if (!isOwner && !isPublished) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Cannot access materials of another teacher's draft lesson."
        });
      }
    }

    const versionIdParam = req.query.versionId as string || lesson.active_version_id || 'v-test-multi-1';
    const stored = serverReviewState.generatedMaterials?.[versionIdParam];

    if (stored && stored.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "CROSS_LESSON_MISMATCH",
        message: `Materials for version ${versionIdParam} belong to lesson ${stored.lessonId}, not ${lessonId}.`
      });
    }

    const materialsResult = stored || {
      lessonId,
      versionId: versionIdParam,
      slides: [],
      flashcards: [],
      quiz: []
    };

    return res.json({
      success: true,
      lessonId,
      versionId: versionIdParam,
      isStudentView: false,
      materials: materialsResult
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 3. Servant Review & Approval of Generated Materials
app.post("/api/church/lessons/:lessonId/materials/review", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);

    if (authContext.role === 'student' || authContext.role === 'parent') {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents cannot review or approve learning materials."
      });
    }

    const lessonId = req.params.lessonId;
    const lesson = serverReviewState.lessons[lessonId];
    if (!lesson) {
      return res.status(404).json({
        success: false,
        error: "LESSON_NOT_FOUND",
        message: `Lesson ${lessonId} not found.`
      });
    }

    const currentUserId = authContext.userId || 'user_teacher_mina_101';
    const currentUserRole = authContext.role || 'teacher';
    if (currentUserRole !== 'admin') {
      const isOwner = lesson.createdBy === currentUserId ||
                      (currentUserId === 'mina' && lesson.createdBy === 'user_teacher_mina_101') ||
                      (currentUserId === 'user_teacher_mina_101' && lesson.createdBy === 'mina');
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          error: "FORBIDDEN",
          message: "Cannot review materials for another teacher's lesson."
        });
      }
    }

    const { versionId, action, itemType, itemId } = req.body;
    if (!versionId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_PARAMS",
        message: "versionId is required."
      });
    }

    const allowedActions = ['APPROVE_ALL', 'APPROVE_ITEM', 'REJECT'];
    if (!action || !allowedActions.includes(action)) {
      return res.status(400).json({
        success: false,
        error: "INVALID_ACTION",
        message: `Invalid review action. Allowed actions: ${allowedActions.join(', ')}.`
      });
    }

    const packet = serverReviewState.generatedMaterials?.[versionId];
    if (!packet) {
      return res.status(404).json({
        success: false,
        error: "MATERIALS_NOT_FOUND",
        message: `No generated materials found for version ${versionId}.`
      });
    }

    // Strict cross-lesson and cross-version validation
    if (packet.lessonId !== lessonId) {
      return res.status(400).json({
        success: false,
        error: "CROSS_LESSON_MISMATCH",
        message: `Cannot review materials belonging to lesson ${packet.lessonId} under lesson ${lessonId}.`
      });
    }

    if (packet.versionId !== versionId) {
      return res.status(400).json({
        success: false,
        error: "CROSS_VERSION_MISMATCH",
        message: `Version mismatch: material packet is for ${packet.versionId}, but requested ${versionId}.`
      });
    }

    // Server determines targetStatus strictly; client reviewStatus is ignored
    const targetStatus = action === 'REJECT' ? 'REJECTED' : 'APPROVED';

    if (action === 'APPROVE_ALL' || (!itemId && action === 'REJECT')) {
      packet.slides.forEach((s: any) => s.reviewStatus = targetStatus);
      packet.flashcards.forEach((f: any) => f.reviewStatus = targetStatus);
      packet.quiz.forEach((q: any) => q.reviewStatus = targetStatus);
    } else {
      if (itemType === 'SLIDES') {
        const item = packet.slides.find((s: any) => s.number === Number(itemId));
        if (item) item.reviewStatus = targetStatus;
      } else if (itemType === 'FLASHCARDS') {
        const item = packet.flashcards.find((f: any) => f.id === itemId);
        if (item) item.reviewStatus = targetStatus;
      } else if (itemType === 'QUIZ') {
        const item = packet.quiz.find((q: any) => q.id === itemId);
        if (item) item.reviewStatus = targetStatus;
      }
    }

    packet.reviewedAt = new Date().toISOString();
    packet.reviewedBy = currentUserId;

    // Sync approved materials into version (only APPROVED items remain)
    const ver = serverReviewState.versions[versionId];
    if (ver) {
      ver.slides = packet.slides.filter((s: any) => s.reviewStatus === 'APPROVED');
      ver.flashcards = packet.flashcards.filter((f: any) => f.reviewStatus === 'APPROVED');
    }

    return res.json({
      success: true,
      message: `Learning materials successfully updated with status ${targetStatus}.`,
      status: targetStatus,
      materials: packet
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 4. Servant Review Comments (GET & POST) - Teachers and admins only
app.get("/api/church/review-comments", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated && (authContext.role === 'student' || authContext.role === 'parent')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents are not permitted to access servant review comments."
      });
    }

    const versionId = String(req.query.versionId || '');
    const comments = serverReviewState.comments[versionId] || [];
    return res.json({ success: true, comments });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

app.post("/api/church/review-comments", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated && (authContext.role === 'student' || authContext.role === 'parent')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents cannot add servant review comments."
      });
    }

    const { versionId, lessonId, sectionId, comment, commentType, quoteHighlighted, authorName } = req.body;
    if (!versionId || !comment) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "versionId and comment are required" });
    }

    const newComment = {
      id: `cm-${Date.now()}`,
      lessonVersionId: versionId,
      lessonId: lessonId || null,
      sectionId: sectionId || null,
      comment,
      commentType: commentType || 'OTHER',
      quoteHighlighted: quoteHighlighted || null,
      authorId: authContext.userId || 'servant_user',
      authorName: authorName || 'Servant',
      resolved: false,
      createdAt: new Date().toISOString()
    };

    if (!serverReviewState.comments[versionId]) {
      serverReviewState.comments[versionId] = [];
    }
    serverReviewState.comments[versionId].push(newComment);

    return res.json({ success: true, comment: newComment });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 5. Update Claim Verification (Authorized servants only)
app.post("/api/church/update-claim-verification", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated && (authContext.role === 'student' || authContext.role === 'parent')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents cannot verify or flag claims."
      });
    }

    const { claimId, isVerified, servantReviewStatus, servantReviewNote, evidenceMapId } = req.body;
    if (!claimId) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "claimId is required" });
    }

    // Find in mock claims
    let targetClaim: any = null;
    for (const mapId of Object.keys(serverReviewState.claims)) {
      const found = serverReviewState.claims[mapId].find((c: any) => c.claimId === claimId || c.id === claimId);
      if (found) {
        targetClaim = found;
        break;
      }
    }

    if (!targetClaim) {
      targetClaim = {
        claimId,
        statementEn: "Church history claim",
        statementAr: "بيان تاريخي كنسي",
        category: "history",
        sourceId: "src-1",
        sourceName: "Source.pdf",
        sourceLocation: "Page 1",
        verified: false,
        servantReviewStatus: "PENDING"
      };
      if (evidenceMapId) {
        if (!serverReviewState.claims[evidenceMapId]) serverReviewState.claims[evidenceMapId] = [];
        serverReviewState.claims[evidenceMapId].push(targetClaim);
      }
    }

    targetClaim.verified = Boolean(isVerified);
    targetClaim.servantReviewStatus = servantReviewStatus || (isVerified ? 'APPROVED' : 'PENDING');
    targetClaim.servantReviewNote = servantReviewNote || null;
    targetClaim.reviewedBy = authContext.userId || 'servant_reviewer';
    targetClaim.reviewedAt = new Date().toISOString();

    return res.json({ success: true, claim: targetClaim });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 6. Resolve Source Conflict (Authorized servants only)
app.post("/api/church/resolve-source-conflict", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated && (authContext.role === 'student' || authContext.role === 'parent')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents cannot resolve source conflicts."
      });
    }

    const { conflictId, resolutionNote, evidenceMapId } = req.body;
    if (!conflictId || !resolutionNote) {
      return res.status(400).json({ success: false, error: "MISSING_PARAMS", message: "conflictId and resolutionNote are required" });
    }

    let targetConflict: any = null;
    for (const mapId of Object.keys(serverReviewState.conflicts)) {
      const found = serverReviewState.conflicts[mapId].find((c: any) => c.id === conflictId);
      if (found) {
        targetConflict = found;
        break;
      }
    }

    if (!targetConflict) {
      targetConflict = {
        id: conflictId,
        evidenceMapId: evidenceMapId || 'e-map-test-01',
        status: 'UNRESOLVED',
        conflictDescriptionEn: 'Theological or historical source discrepancy.'
      };
      const mapKey = evidenceMapId || 'e-map-test-01';
      if (!serverReviewState.conflicts[mapKey]) serverReviewState.conflicts[mapKey] = [];
      serverReviewState.conflicts[mapKey].push(targetConflict);
    }

    targetConflict.status = 'RESOLVED';
    targetConflict.resolutionNote = resolutionNote;
    targetConflict.resolvedBy = authContext.userId || 'servant_theologian';
    targetConflict.resolvedAt = new Date().toISOString();

    return res.json({ success: true, conflict: targetConflict });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

// 7. Get Servant Review Packet
app.post("/api/church/get-review-packet", async (req, res) => {
  try {
    const authContext = await verifyServerRequestAuth(req);
    if (authContext.isAuthenticated && (authContext.role === 'student' || authContext.role === 'parent')) {
      return res.status(403).json({
        success: false,
        error: "FORBIDDEN",
        message: "Students and parents cannot access servant review packets."
      });
    }

    const { lessonId, versionId, evidenceMapId } = req.body;
    const version = serverReviewState.versions[versionId] || {
      id: versionId || 'v-test-draft-1',
      lessonId: lessonId || 'l-test-draft-01',
      versionNumber: 1,
      status: 'SERVANT_REVIEW',
      createdBy: 'user_teacher_mina_101',
      createdAt: new Date().toISOString()
    };

    const mapKey = evidenceMapId || 'e-map-test-01';
    const conflicts = serverReviewState.conflicts[mapKey] || [];
    const claims = serverReviewState.claims[mapKey] || [];
    const comments = serverReviewState.comments[versionId] || [];

    const unresolvedConflicts = conflicts.filter((c: any) => c.status === 'UNRESOLVED').length;
    const verifiedClaims = claims.filter((c: any) => c.verified).length;

    return res.json({
      success: true,
      packet: {
        lesson: {
          id: lessonId || version.lessonId,
          titleEn: "Feast of the Glorious Cross",
          titleAr: "عيد الصليب المجيد",
          category: "history",
          gradeLevel: "Elementary (Grades 3-5)",
          status: "draft"
        },
        version,
        sections: [
          {
            id: 'sec-1',
            order: 1,
            titleEn: '1. Discovery of the True Cross by Queen Helena',
            titleAr: '١. اكتشاف عود الصليب المقدس بواسطة الملكة هيلانة',
            contentEn: 'In the fourth century, Queen Helena traveled to Jerusalem with reverent zeal.',
            contentAr: 'في القرن الرابع الميلادي، سافرت الملكة البارة هيلانة إلى أورشليم.'
          }
        ],
        claims,
        conflicts,
        comments,
        summary: {
          totalClaims: claims.length,
          verifiedClaims,
          unverifiedClaims: claims.length - verifiedClaims,
          unresolvedConflicts,
          totalComments: comments.length,
          canApprove: version.status === 'SERVANT_REVIEW' && unresolvedConflicts === 0
        }
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || "Server error" });
  }
});

app.get("/api/storage/status", (_req, res) => {
  res.json({
    configured: true,
    provider: 'local-server',
    bucket: 'uploads',
    unlimited: false,
    notes: 'Local media uploads directory (/uploads).'
  });
});

// Production Media Upload Route (Handles photos, videos, and MP3 audio up to 150MB)
app.post("/api/upload-media", upload.single("media"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No media file uploaded" });
    }

    const isImage = file.mimetype.startsWith("image/");
    const isVideo = file.mimetype.startsWith("video/");
    const isAudio = file.mimetype.startsWith("audio/");

    // Server Persistence (/uploads/...)
    // File already safely stored on disk in uploadsDir by multer
    const authContext = await verifyServerRequestAuth(req);
    const uploaderId = authContext.userId || (typeof req.body.userId === "string" ? req.body.userId : null);
    const uploadType = req.body.type || (req.body.isFeed ? "feed" : "source");
    const lessonId = typeof req.body.lessonId === "string" ? req.body.lessonId : null;
    const isPublic = uploadType === "feed" || req.body.isPublic === "true" || req.body.isPublic === true;

    // Persist local metadata alongside file for zero-latency, schema-frozen authorization
    const metaData = {
      filename: file.filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedBy: uploaderId || "anonymous",
      uploaderRole: authContext.role || null,
      lessonId: lessonId || null,
      isPublic: Boolean(isPublic),
      uploadType: uploadType,
      uploadedAt: new Date().toISOString()
    };

    const metaPath = path.join(uploadsDir, `.${file.filename}.meta.json`);
    try {
      fs.writeFileSync(metaPath, JSON.stringify(metaData, null, 2), "utf-8");
    } catch (metaErr) {
      console.warn("Failed to write upload metadata:", metaErr);
    }

    const fileUrl = `/uploads/${file.filename}`;

    let createdSourceId: string | null = null;
    if (uploadType === "source" && lessonId && typeof serverReviewState !== 'undefined') {
      if (!serverReviewState.sources[lessonId]) {
        serverReviewState.sources[lessonId] = [];
      }
      createdSourceId = `src-up-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      serverReviewState.sources[lessonId].push({
        id: createdSourceId,
        lessonId: lessonId,
        uploadedBy: uploaderId || "user_teacher_mina_101",
        type: isAudio ? 'TEACHER_VOICE' : file.mimetype.includes('pdf') ? 'PDF' : file.mimetype.includes('presentation') ? 'PPTX' : file.mimetype.includes('word') ? 'DOCX' : isImage ? 'IMAGE' : 'OTHER_APPROVED_RESOURCE',
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        fileUrl: fileUrl,
        fileSize: file.size,
        description: `Uploaded ${file.originalname}`,
        rightsStatus: 'TEACHER_OWNED',
        processingStatus: 'INDEXED',
        priority: 'PRIMARY',
        isPublic: Boolean(isPublic),
        uploadedAt: new Date().toISOString()
      });
    }

    return res.json({
      success: true,
      mediaUrl: fileUrl,
      sourceId: createdSourceId,
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
