# Implementation Plan: Teacher Engagement Summary, In-App Document Viewer & Arabic-First Dynamic Lessons

Build a visual student engagement summary for teachers, eliminate hardcoded lesson fallbacks (Saint Helena), establish Arabic as the primary language with full RTL support, embed an in-app PPT/PDF/Word viewer without browser redirects, and ensure student views only display features provided by the servant.

---

## 1. User Requirements & Clarifications

1. **Teacher Dashboard Visual Summary**:
   - Visual progress bars and percentage indicators displaying overall student engagement (lesson completion %, quiz participation %, average score, and lesson-by-lesson progress).
2. **Remove Hardcoded Saint Helena Fallbacks & AI Spoken Narration**:
   - Stop defaulting all lessons to Saint Helena slides, verses, audio, and questions.
   - Remove AI Spoken Narration from the student and teacher views.
   - **Strict Zero-Ghost-Feature Rule**: If a servant did not provide a feature (e.g. no voice audio, no slide deck, no video, no memory verse), do **not** show it as an empty or missing feature in the student UI.
3. **Arabic-First with RTL Support**:
   - Default lessons to Arabic (`ar`) with complete right-to-left (`dir="rtl"`) text and layout styling.
   - Keep dual/trilingual support (Coptic / English) accessible via language selector.
4. **Embedded In-App Document Viewer for PPT, PDF, and Word**:
   - View PPTX, PDF, and DOCX files directly inside the application with slide/page navigation controls without kicking the student out to external browser tabs or forcing file downloads.
5. **Rich Written Explanation & Visual Media**:
   - Add dedicated sections for written explanations with image illustrations, alongside slide decks and flashcards.

---

## 2. Proposed Architecture & Component Changes

### A. Visual Engagement Summary Component (`TeacherDashboard.tsx`)
- **New Component**: `src/components/teacher/LessonEngagementSummary.tsx`
  - Visual summary cards showing:
    - **Overall Completion Rate**: Percentage bar and count of students completing lesson content.
    - **Quiz Participation & Score**: Average quiz score bar and submission rates.
    - **Per-Lesson Engagement Grid**: Quick progress bars for each published lesson comparing active students vs completed students.
  - Integration into the top of `TeacherDashboard.tsx` in the Overview and Lessons tabs.

### B. Dynamic Feature Rendering & Helena Removal (`LessonView.tsx` & `SundaySchoolLessonView.tsx`)
- **Audit & Clean Fallbacks in `LessonView.tsx`**:
  - Remove fallback generation of hardcoded Queen Helena questions, 1 Cor 1:18 verses, and synthetic slides.
  - Respect the exact fields present on `lesson`: if a lesson has slides in `slidesUrl` or `version.slides`, use them; otherwise, do not inject Queen Helena slides.
- **Refactor `SundaySchoolLessonView.tsx`**:
  - Remove AI Narration toggle and audio player.
  - Only show `Classroom Voice Explanation` if `effectiveAudioUrl` is provided by the servant.
  - Only show `Classroom Video` if `effectiveVideoUrl` is provided.
  - Only show `Slide Deck / Document Viewer` if slides or document files were uploaded/linked.
  - Only show `Memory Verse Card` if a verse is provided.
  - Only show `Flashcards` if flashcards were created for this lesson.
  - Add support for `Written Explanation & Pictures` with full markdown/rich formatting and inline religious imagery.

### C. In-App Document Viewer (`InAppDocumentViewer.tsx`)
- **New Component**: `src/components/sunday-school/viewers/InAppDocumentViewer.tsx`
  - Supports:
    - **PowerPoint (.pptx, .ppt)**: Embedded slide canvas viewer using Microsoft Office Online embed iframe or native slide deck renderer with slide-by-slide navigation (`Previous`, `Next`, Fullscreen, Thumbnail strip).
    - **PDF (.pdf)**: Embedded in-app PDF canvas/iframe viewer with page jump and zoom controls.
    - **Word Documents (.docx, .doc)**: Embedded document viewer.
    - Clean in-modal or in-page navigation without window opening or forced file downloads.

### D. Arabic-First & Full RTL Support
- Set default `lang` in `LessonView` and student lesson navigation to `'ar'`.
- Add comprehensive RTL styling (`dir="rtl"`, `text-right`, inverted chevrons, Arabic typography) across lesson cards, headers, media controls, and quizzes.

### E. Manual Lesson Studio Upgrades (`ManualLessonStudio.tsx`)
- Update the publishing form to support:
  - Slide presentation file attachment (PPTX / PDF / Google Slides link) with in-studio preview.
  - Written explanation with image URL or uploaded illustration.
  - Optional flashcards creation.
  - Voice explanation recording or audio URL (strictly optional).

---

## 3. Verification Plan

### Automated Verification
- Run `compile_applet` to ensure TypeScript compilation without errors.
- Run `lint_applet` to verify no lint issues or broken imports.

### Manual / Browser Verification
1. Open Teacher Dashboard: Verify the visual engagement summary component renders with progress bars.
2. Publish or inspect a custom lesson without audio: Verify no audio player appears in student view.
3. Inspect a lesson with an uploaded PPT/PDF: Verify the slide presentation displays the actual uploaded document inside the app viewer, not Saint Helena.
4. Verify Arabic is displayed first with right-to-left layout alignment across headings, summary, and quiz questions.
