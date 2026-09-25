import { useCallback, useEffect, useMemo, useState } from "react";
import { questionBank } from "./data/questionBank";
import TemplateHomePage from "./pages/home/Index";
import TemplateNotFoundPage from "./pages/not-found/Index";
import { 

  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Bookmark,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  FileCheck2,
  Flag,
  ExternalLink,
  Gauge,
  Instagram,
  LayoutDashboard,
  Library,
  Menu,
  MessageCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Settings,
  Share2,
  Sparkles,
  Target,
  TimerReset,
  Trophy,
  X,
  XCircle,
} from "lucide-react";

const chapters = [
  { id: "law", title: "法例、警權、證據", count: 380, icon: "01", tone: "navy", detail: "拘捕、搜查、證據及程序基礎" },
  { id: "command", title: "管理、指揮、紀律、行政", count: 150, icon: "02", tone: "blue", detail: "管理責任、紀律及行政指引" },
  { id: "ops", title: "警務行動、現場處理、案件程序", count: 100, icon: "03", tone: "teal", detail: "現場判斷、行動及案件處理" },
  { id: "supervision", title: "SG督導及管理", count: 370, icon: "04", tone: "slate", detail: "督導溝通、資源及人員管理" },
] as const;

const questions = questionBank.map((question) => ({
  id: question.id,
  number: question.number,
  chapter: question.chapter,
  type: question.type,
  stem: question.stem,
  options: question.options,
  answer: question.answer,
  explanation: question.explanation,
  reference: question.reference,
}));

const navItems = [
  { id: "dashboard", label: "總覽", icon: LayoutDashboard },
  { id: "practice", label: "章節練習", icon: BookOpen },
  { id: "exam", label: "模擬考試", icon: FileCheck2 },
  { id: "library", label: "錯題／收藏", icon: Library },
  { id: "progress", label: "學習進度", icon: BarChart3 },
  { id: "terms", label: "使用條文", icon: FileCheck2 },
  { id: "disclaimer", label: "免責聲明", icon: ShieldCheck },
  { id: "feedback", label: "意見收集", icon: CircleHelp },
  { id: "share", label: "分享好友", icon: ExternalLink },
  { id: "settings", label: "設定", icon: Settings },
] as const;

type Screen = (typeof navItems)[number]["id"];
type PracticeMode = "select" | "question" | "result";
type ExamMode = "setup" | "running" | "result";
type AnswerRecord = { questionId: string; chapter: string; correct: boolean };
type ChapterStat = (typeof chapters)[number] & { answered: number; completed: number; correct: number; incorrect: number; accuracy: number | null; completion: number; wrongInLibrary: number };

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function StudyCenterLogo({ className = "h-8 w-8" }: { className?: string }) {
  return <img src="/images/wenxibao-logo.png" alt="温習寶 Logo" className={cn("rounded-lg object-contain", className)} />;
}

function App() {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [accountName, setAccountName] = useState("陳先生");
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [practiceMode, setPracticeMode] = useState<PracticeMode>("select");
  const [practiceSource, setPracticeSource] = useState<"chapter" | "random" | "wrong">("chapter");
  const [practiceChapter, setPracticeChapter] = useState("law");
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answered, setAnswered] = useState(false);
  const [practiceCorrect, setPracticeCorrect] = useState(0);
  const [practiceQuestions, setPracticeQuestions] = useState<typeof questions | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [wrongPracticeIds, setWrongPracticeIds] = useState<string[]>([]);
  const [answerRecords, setAnswerRecords] = useState<AnswerRecord[]>([]);
  const [examMode, setExamMode] = useState<ExamMode>("setup");
  const [examQuestions, setExamQuestions] = useState<typeof questions>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<string, string>>({});
  const [examSeconds, setExamSeconds] = useState(1800);
  const [examSubmitted, setExamSubmitted] = useState(false);
  const [examRecorded, setExamRecorded] = useState(false);
  const [toast, setToast] = useState("");

  const visiblePracticeQuestions = useMemo(
    () => questions.filter((question) => question.chapter === practiceChapter),
    [practiceChapter],
  );
  const activePracticeQuestions = practiceQuestions ?? visiblePracticeQuestions;
  const currentPracticeQuestion = activePracticeQuestions[practiceIndex % activePracticeQuestions.length] ?? questions[0];
  const currentExamQuestion = examQuestions[examIndex] ?? questions[0];
  const examCorrect = examQuestions.reduce(
    (total, question) => total + (examAnswers[question.id] === question.answer ? 1 : 0),
    0,
  );
  const chapterStats = useMemo<ChapterStat[]>(
    () => chapters.map((chapter) => {
      const records = answerRecords.filter((record) => record.chapter === chapter.id);
      const answeredQuestionIds = new Set(records.map((record) => record.questionId));
      const correct = records.filter((record) => record.correct).length;
      const wrongInLibrary = wrongIds.filter((id) => questions.find((question) => question.id === id)?.chapter === chapter.id).length;
      return {
        ...chapter,
        answered: records.length,
        completed: answeredQuestionIds.size,
        correct,
        incorrect: records.length - correct,
        accuracy: records.length ? Math.round((correct / records.length) * 100) : null,
        completion: Math.min(100, Math.round((answeredQuestionIds.size / chapter.count) * 100)),
        wrongInLibrary,
      };
    }),
    [answerRecords, wrongIds],
  );
  const totalAnswered = answerRecords.length;
  const totalCorrect = answerRecords.filter((record) => record.correct).length;
  const overallAccuracy = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : null;
  const weakestChapter = chapterStats
    .filter((chapter) => chapter.answered > 0 || chapter.wrongInLibrary > 0)
    .sort((a, b) => {
      if (b.wrongInLibrary !== a.wrongInLibrary) return b.wrongInLibrary - a.wrongInLibrary;
      return (a.accuracy ?? 101) - (b.accuracy ?? 101);
    })[0];

  const finishExam = useCallback(() => {
    if (examRecorded) return;
    const records = examQuestions
      .filter((question) => examAnswers[question.id])
      .map((question) => ({ questionId: question.id, chapter: question.chapter, correct: examAnswers[question.id] === question.answer }));
    setAnswerRecords((items) => [...items, ...records]);
    setWrongIds((items) => {
      const next = new Set(items);
      records.forEach((record) => record.correct ? next.delete(record.questionId) : next.add(record.questionId));
      return [...next];
    });
    setExamRecorded(true);
    setExamSubmitted(true);
    setExamMode("result");
  }, [examAnswers, examQuestions, examRecorded]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (examMode !== "running" || examSubmitted) return;
    const timer = window.setInterval(() => {
      setExamSeconds((seconds) => {
        if (seconds <= 1) {
          finishExam();
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examMode, examSubmitted, finishExam]);

  // 登入後從瀏覽器本地儲存還原學習進度
  useEffect(() => {
    if (!loggedIn || !accountName) return;
    try {
      const raw = window.localStorage.getItem(`wenxibao-progress:${accountName}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as { answerRecords?: AnswerRecord[]; wrongIds?: string[]; favorites?: string[] };
      if (Array.isArray(saved.answerRecords) && saved.answerRecords.length) setAnswerRecords(saved.answerRecords);
      if (Array.isArray(saved.wrongIds) && saved.wrongIds.length) setWrongIds(saved.wrongIds);
      if (Array.isArray(saved.favorites) && saved.favorites.length) setFavorites(saved.favorites);
    } catch {
      // 本地儲存資料無效時靜默忽略，重新開始
    }
  }, [loggedIn, accountName]);

  // 學習進度變更時保存至瀏覽器本地儲存
  useEffect(() => {
    if (!loggedIn || !accountName) return;
    try {
      window.localStorage.setItem(
        `wenxibao-progress:${accountName}`,
        JSON.stringify({ answerRecords, wrongIds, favorites }),
      );
    } catch {
      // 儲存空間不足或無法寫入時靜默失敗
    }
  }, [loggedIn, accountName, answerRecords, wrongIds, favorites]);

  function goTo(nextScreen: Screen) {
    setScreen(nextScreen);
    setMobileNavOpen(false);
    if (nextScreen === "practice") {
      setPracticeMode("select");
      setPracticeSource("chapter");
      setPracticeQuestions(null);
    }
    if (nextScreen === "exam") setExamMode("setup");
  }

  function showToast(message: string) {
    setToast(message);
  }

  function startPractice(chapterId = practiceChapter, questionId?: string) {
    const chapterQuestions = questions.filter((question) => question.chapter === chapterId);
    const targetIndex = questionId ? chapterQuestions.findIndex((question) => question.id === questionId) : 0;
    setPracticeSource("chapter");
    setPracticeChapter(chapterId);
    setPracticeQuestions(null);
    setPracticeIndex(Math.max(0, targetIndex));
    setSelectedAnswer("");
    setAnswered(false);
    setPracticeCorrect(0);
    setPracticeMode("question");
    setScreen("practice");
  }

  function startRandomPractice(chapterId = practiceChapter, _isTodayTask = false) {
    const randomQuestions = [...questions]
      .filter((question) => question.chapter === chapterId)
      .sort(() => Math.random() - 0.5)
      .slice(0, 20);
    setPracticeSource("random");
    setPracticeChapter(chapterId);
    setPracticeQuestions(randomQuestions);
    setPracticeIndex(0);
    setSelectedAnswer("");
    setAnswered(false);
    setPracticeCorrect(0);
    setPracticeMode("question");
    setScreen("practice");
  }

  function startWrongPractice(questionId: string) {
    const wrongQuestions = wrongIds
      .map((id) => questions.find((question) => question.id === id))
      .filter((question): question is (typeof questions)[number] => Boolean(question));
    const targetIndex = Math.max(0, wrongQuestions.findIndex((question) => question.id === questionId));
    const targetQuestion = wrongQuestions[targetIndex];
    setPracticeSource("wrong");
    setWrongPracticeIds(wrongIds);
    setPracticeChapter(targetQuestion?.chapter ?? practiceChapter);
    setPracticeQuestions(wrongQuestions);
    setPracticeIndex(targetIndex);
    setSelectedAnswer("");
    setAnswered(false);
    setPracticeCorrect(0);
    setPracticeMode(wrongQuestions.length ? "question" : "result");
    setScreen("practice");
  }

  function submitPractice() {
    if (!selectedAnswer) {
      showToast("請先選擇一個答案");
      return;
    }
    if (answered) return;
    const correct = selectedAnswer === currentPracticeQuestion.answer;
    setAnswered(true);
    setPracticeCorrect((value) => value + (correct ? 1 : 0));
    setAnswerRecords((records) => [...records, { questionId: currentPracticeQuestion.id, chapter: currentPracticeQuestion.chapter, correct }]);
    if (practiceSource === "wrong") {
      setWrongPracticeIds((items) => correct
        ? items.filter((id) => id !== currentPracticeQuestion.id)
        : items.includes(currentPracticeQuestion.id) ? items : [...items, currentPracticeQuestion.id]);
    }
    setWrongIds((items) => correct
      ? items.filter((id) => id !== currentPracticeQuestion.id)
      : items.includes(currentPracticeQuestion.id) ? items : [...items, currentPracticeQuestion.id]);
  }

  function nextPractice() {
    if (practiceSource === "wrong") {
      const remainingWrongIds = new Set(wrongPracticeIds);
      const queueLength = activePracticeQuestions.length;
      const nextIndex = Array.from({ length: queueLength }, (_, step) => (practiceIndex + step + 1) % queueLength)
        .find((candidateIndex) => remainingWrongIds.has(activePracticeQuestions[candidateIndex]?.id));
      if (remainingWrongIds.size === 0) {
        setPracticeMode("result");
        return;
      }
      setPracticeIndex(nextIndex ?? practiceIndex);
      setSelectedAnswer("");
      setAnswered(false);
      return;
    }
    if (practiceIndex + 1 >= activePracticeQuestions.length) {
      setPracticeMode("result");
      return;
    }
    setPracticeIndex((value) => value + 1);
    setSelectedAnswer("");
    setAnswered(false);
  }

  function toggleFavorite(questionId: string) {
    setFavorites((items) =>
      items.includes(questionId) ? items.filter((id) => id !== questionId) : [...items, questionId],
    );
    showToast(favorites.includes(questionId) ? "已取消收藏" : "已加入收藏");
  }

  function startExam() {
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, 50);
    setExamQuestions(shuffled);
    setExamIndex(0);
    setExamAnswers({});
    setExamSeconds(1800);
    setExamSubmitted(false);
    setExamRecorded(false);
    setExamMode("running");
  }

  if (!privacyAccepted) {
    return <PrivacyPolicyScreen onAccept={() => setPrivacyAccepted(true)} />;
  }

  if (!loggedIn) {
    return <LoginScreen onLogin={(name) => { setAccountName(name); setLoggedIn(true); }} />;
  }

  const accountInitial = accountName.trim().charAt(0) || "陳";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-sm">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button className="icon-button lg:hidden" aria-label="開啟選單" onClick={() => setMobileNavOpen((value) => !value)}>
              <Menu className="h-5 w-5" />
            </button>
            <div className="brand-mark"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <div className="text-sm font-bold tracking-tight text-primary">筆試溫習中心</div>
              <div className="hidden text-[11px] text-muted-foreground sm:block">跨裝置互動式溫習平台</div>
            </div>
            <StudyCenterLogo className="h-9 w-9 sm:h-10 sm:w-10" />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="status-pill"><span className="status-dot" />已登入</span>
            <div className="hidden items-center gap-2 border-l border-border pl-3 sm:flex">
              <div className="avatar">{accountInitial}</div>
              <div className="hidden text-right md:block"><div className="text-xs font-semibold">{accountName}</div><div className="text-[11px] text-muted-foreground">在職溫習者</div></div>
            </div>
            <button className="icon-button" aria-label="開啟設定" onClick={() => goTo("settings")}><Settings className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      <div className="flex min-h-[calc(100vh-4rem)]">
        <aside className={cn("sidebar", mobileNavOpen && "sidebar-open")}>
          <nav className="space-y-1">
            <div className="mb-5 px-3 text-[10px] font-bold uppercase tracking-[0.22em] text-sidebar-foreground/45">Study workspace</div>
            {navItems.map((item) => {
              const Icon = item.icon;
              return <button key={item.id} className={cn("nav-item", screen === item.id && "nav-item-active")} onClick={() => goTo(item.id)}><Icon className="h-[18px] w-[18px]" /><span>{item.label}</span>{item.id === "library" && wrongIds.length > 0 && <span className="ml-auto rounded-full bg-sidebar-primary px-2 py-0.5 text-[10px] font-bold text-sidebar-primary-foreground">{wrongIds.length}</span>}</button>;
            })}
          </nav>
          <div className="mt-auto space-y-3">
            <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3.5">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-sidebar-foreground"><Sparkles className="h-4 w-4 text-chart-4" />溫習提示</div>
              <p className="text-[11px] leading-5 text-sidebar-foreground/65">每日完成一組章節練習，配合錯題重做，穩步提升筆試準備。</p>
            </div>
            <button className="nav-item text-sidebar-foreground/60" onClick={() => setLoggedIn(false)}><X className="h-[18px] w-[18px]" />登出</button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            {screen === "dashboard" && <Dashboard onNavigate={goTo} onStartToday={() => startRandomPractice("law", true)} chapterStats={chapterStats} />}
            {screen === "practice" && <PracticeView mode={practiceMode} setMode={setPracticeMode} source={practiceSource} chapters={chapters} chapterStats={chapterStats} selectedChapter={practiceChapter} setSelectedChapter={setPracticeChapter} question={currentPracticeQuestion} index={practiceIndex} total={activePracticeQuestions.length} selectedAnswer={selectedAnswer} setSelectedAnswer={setSelectedAnswer} answered={answered} onSubmit={submitPractice} onNext={nextPractice} correct={practiceCorrect} onStart={startPractice} onStartRandom={startRandomPractice} isFavorite={favorites.includes(currentPracticeQuestion.id)} onFavorite={() => toggleFavorite(currentPracticeQuestion.id)} onExitWrong={() => goTo("library")} />}
            {screen === "exam" && <ExamView mode={examMode} question={currentExamQuestion} index={examIndex} total={examQuestions.length || 50} examQuestions={examQuestions} answers={examAnswers} seconds={examSeconds} onStart={startExam} onSelect={(answer) => setExamAnswers((items) => ({ ...items, [currentExamQuestion.id]: answer }))} onJump={setExamIndex} onNext={() => setExamIndex((value) => Math.min((examQuestions.length || 50) - 1, value + 1))} onBack={() => setExamIndex((value) => Math.max(0, value - 1))} onFinish={finishExam} score={examCorrect} />}
            {screen === "library" && <LibraryView wrongIds={wrongIds} favorites={favorites} questions={questions} onFavorite={toggleFavorite} onPractice={startWrongPractice} />}
            {screen === "progress" && <ProgressView chapterStats={chapterStats} totalAnswered={totalAnswered} totalCorrect={totalCorrect} overallAccuracy={overallAccuracy} wrongCount={wrongIds.length} favoriteCount={favorites.length} weakestChapter={weakestChapter} />}
            {screen === "terms" && <TermsView />}
            {screen === "disclaimer" && <DisclaimerView />}
            {screen === "feedback" && <FeedbackView />}
            {screen === "share" && <ShareView onToast={showToast} />}
            {screen === "settings" && <SettingsView accountName={accountName} onLogout={() => setLoggedIn(false)} onToast={showToast} />}
          </div>
        </main>
      </div>
      {toast && <div className="toast"><CircleHelp className="h-4 w-4" />{toast}</div>}
    </div>
  );
}

const APP_TERMS = `APP使用條文
1. 適用範圍
本平台為互動式溫習平台。完成介紹碼驗證後，使用者可使用章節練習、模擬考試、錯題／收藏及學習進度等功能。
2. 使用資格及帳戶資料
介紹碼用作進入資格驗證，不代表正式身份認證。使用者須提供準確資料，並不得冒用他人資料、繞過存取限制或干擾平台運作。
3. 題庫及知識產權
題庫為非官方研習材料，僅供個人溫習及內部非商業交流。除適用法律容許者外，使用者不得未經授權複製、出售、出租、公開傳播、批量上載、製作收費課程或將內容用作商業用途。使用任何受版權保護的內容時，仍須遵守香港《版權條例》（第528章）及其他適用規定。
4. 使用者責任
使用者須自行確保其使用方式合法、適當及不侵犯他人權利。平台如發現涉嫌違反本條文、侵權或不當使用，可限制或終止存取；如知悉涉嫌侵權內容，會按情況採取合理處理措施。
5. 非官方性質及資料更新
本平台並非警務處官方產品，亦不代表任何官方立場或正式考試範圍。題目及解釋只作溫習參考；使用者應以最新生效法例、現行授權及內部指引為準。
6. 私隱及免責聲明
個人資料處理安排以「系統及私隱政策」為準；與內容準確性、專業意見及其他風險相關的說明，請參閱獨立的「免責聲明」頁面。
7. 條文更新
本平台可因功能、內容或法律要求而更新本條文。繼續使用本平台即表示使用者同意受更新後條文約束。`;

function TermsCard() {
  return <div className="mt-7 rounded-xl border border-border bg-muted p-5 text-sm leading-7 whitespace-pre-wrap">{APP_TERMS}</div>;
}

function PrivacyPolicyScreen({ onAccept }: { onAccept: () => void }) {
  const [consentChecked, setConsentChecked] = useState(false);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/90 px-2 py-1 text-primary-foreground backdrop-blur-sm sm:px-4 sm:py-3"><div role="dialog" aria-modal="true" aria-labelledby="privacy-policy-title" className="flex h-[calc(100vh-0.5rem)] max-h-[calc(100vh-0.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl shadow-black/30 sm:h-[calc(100vh-1.5rem)] sm:max-h-[calc(100vh-1.5rem)]"><div className="relative shrink-0 border-b border-border p-4 sm:p-6"><div className="flex items-start gap-4 pr-32 sm:pr-40"><div className="brand-mark shrink-0"><ShieldCheck className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="eyebrow text-[8px] leading-4 tracking-[0.12em] sm:text-[9px]">WELCOME · PRIVACY FIRST</div><h1 id="privacy-policy-title" className="mt-2 text-lg font-bold tracking-tight sm:text-xl">系統及私隱政策</h1></div></div><StudyCenterLogo className="absolute right-4 top-4 h-12 w-12 shrink-0 sm:right-6 sm:top-6" /><p className="mt-3 text-left text-sm leading-6 text-muted-foreground sm:ml-14">請先閱讀以下系統及私隱政策與使用條文，並確認你的同意聲明。</p></div><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6"><section className="space-y-4 rounded-xl bg-muted p-5 text-sm leading-6"><h2 className="font-semibold">系統及私隱政策</h2><div><div className="font-semibold">資料用途</div><p className="mt-1 text-muted-foreground">本網站用於提供考試練習流程，所有作答紀錄均儲存於使用者瀏覽器本地端。</p></div><div><div className="font-semibold">個人資料</div><p className="mt-1 text-muted-foreground">註冊表單中的帳戶名稱與電郵將加密傳送至本平台的 Cloudflare 資料庫以建立帳戶；密碼不會以明文儲存，而是以 PBKDF2 單向雜湊技術處理後保存。介紹碼僅用於資格驗證，不會另作儲存。</p></div><div><div className="font-semibold">介紹碼用途</div><p className="mt-1 text-muted-foreground">介紹碼用作進入資格驗證；未能提供有效介紹碼的使用者不能完成註冊或登入學習工作台。</p></div><div><div className="font-semibold">帳戶資料儲存</div><p className="mt-1 text-muted-foreground">帳戶資料儲存於本平台的 Cloudflare D1 資料庫；作答紀錄、錯題本及收藏則儲存於使用者瀏覽器本地端。你可隨時在「設定」頁面永久刪除帳戶資料。</p></div></section><TermsCard /><div className="mt-6 rounded-xl border border-primary/15 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground"><div className="flex items-start gap-3"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>本政策及條文適用於本平台；如未來新增遠端服務，將另行提供更新的私隱政策及使用條款。</span></div></div></div><div className="shrink-0 border-t border-border bg-card p-5 sm:p-7"><label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={consentChecked} onChange={(event) => setConsentChecked(event.target.checked)} /><span>我已閱讀並明白上述系統及私隱政策與使用條文，同意進入登入／註冊流程。</span></label><button className="primary-button mt-4 w-full justify-center disabled:pointer-events-none disabled:opacity-50" disabled={!consentChecked} onClick={onAccept}>同意並進入登入中心 <ArrowRight className="h-4 w-4" /></button><div className="mt-3 text-center text-[9px] leading-4 text-muted-foreground">溫習寶 · 筆試溫習平台</div></div></div></div>;
}

function LoginScreen({ onLogin }: { onLogin: (accountName: string) => void }) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerAccount, setRegisterAccount] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loginAccount, setLoginAccount] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"error" | "success" | "info">("info");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [legalView, setLegalView] = useState<"terms" | "privacy" | null>(null);

  useEffect(() => {
    try {
      const savedAccount = window.localStorage.getItem("wenxibao-remember-account");
      if (savedAccount) {
        setLoginAccount(savedAccount);
        setRememberMe(true);
      }
    } catch {
      // 無法讀取本地儲存時靜默忽略
    }
  }, []);

  async function submitDemo(message: string) {
    if (accessCode.trim() !== "01347") {
      setNoticeType("error");
      setNotice("介紹碼不正確。請輸入有效介紹碼後才可註冊或登入。");
      return;
    }
    if (mode === "register" && !registerAccount.trim()) {
      setNoticeType("error");
      setNotice("請輸入帳戶名稱");
      return;
    }
    if (mode === "register" && registerAccount.trim().length > 40) {
      setNoticeType("error");
      setNotice("帳戶名稱不可超過 40 個字元");
      return;
    }
    if (mode === "register" && !registerEmail.trim()) {
      setNoticeType("error");
      setNotice("請輸入電郵號碼");
      return;
    }
    if (mode === "register" && !/^\S+@\S+\.\S+$/.test(registerEmail.trim())) {
      setNoticeType("error");
      setNotice("請輸入有效的電郵號碼");
      return;
    }
    if (mode === "register" && !registerPassword) {
      setNoticeType("error");
      setNotice("請輸入登入密碼");
      return;
    }
    if (mode === "register" && registerPassword.length < 8) {
      setNoticeType("error");
      setNotice("登入密碼最少需要 8 個字元");
      return;
    }
    if (mode === "register" && registerPassword.length > 128) {
      setNoticeType("error");
      setNotice("登入密碼不可超過 128 個字元");
      return;
    }
    if (mode === "register" && !confirmPassword) {
      setNoticeType("error");
      setNotice("請再次輸入密碼以確認");
      return;
    }
    if (mode === "register" && registerPassword !== confirmPassword) {
      setNoticeType("error");
      setNotice("兩次輸入的密碼不一致，請重新確認");
      return;
    }

    if (mode === "register") {
      setNoticeType("info");
      setNotice("正在建立帳戶，請稍候...");
      try {
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accessCode: accessCode.trim(),
            accountName: registerAccount.trim(),
            email: registerEmail.trim(),
            password: registerPassword,
          }),
        });
        const result = await response.json().catch(() => ({ message: "註冊暫時未能完成，請稍後再試。" }));
        if (!response.ok || !result.ok) {
          setNoticeType("error");
          setNotice(result.message || "註冊暫時未能完成，請稍後再試。");
          return;
        }
        setNoticeType("success");
        setNotice(result.message || message);
        try {
          if (rememberMe) window.localStorage.setItem("wenxibao-remember-account", (result.user?.accountName || registerAccount).trim());
          else window.localStorage.removeItem("wenxibao-remember-account");
        } catch { /* 忽略本地儲存失敗 */ }
        onLogin(result.user?.accountName || registerAccount.trim());
        return;
      } catch {
        setNoticeType("error");
        setNotice("未能連接註冊服務，請檢查網絡後再試。");
        return;
      }
    }

    if (mode === "login") {
      if (!loginAccount.trim()) {
        setNoticeType("error");
        setNotice("請輸入帳戶名稱");
        return;
      }
      if (!loginPassword) {
        setNoticeType("error");
        setNotice("請輸入登入密碼");
        return;
      }
      setNoticeType("info");
      setNotice("正在登入，請稍候...");
      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            accessCode: accessCode.trim(),
            accountName: loginAccount.trim(),
            password: loginPassword,
          }),
        });
        const result = await response.json().catch(() => ({ message: "登入暫時未能完成，請稍後再試。" }));
        if (!response.ok || !result.ok) {
          setNoticeType("error");
          setNotice(result.message || "登入暫時未能完成，請稍後再試。");
          return;
        }
        setNoticeType("success");
        setNotice(result.message || message);
        try {
          if (rememberMe) window.localStorage.setItem("wenxibao-remember-account", (result.user?.accountName || loginAccount).trim());
          else window.localStorage.removeItem("wenxibao-remember-account");
        } catch { /* 忽略本地儲存失敗 */ }
        onLogin(result.user?.accountName || loginAccount.trim());
        return;
      } catch {
        setNoticeType("error");
        setNotice("未能連接登入服務，請檢查網絡後再試。");
        return;
      }
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        {/* Brand header */}
        <div className="auth-brand-header">
          <div className="auth-brand-mark">
            <img src="/images/wenxibao-logo.png" alt="温習寶" />
          </div>
          <div className="auth-brand-name">温習寶</div>
          <div className="auth-brand-tag">筆試溫習中心</div>
        </div>

        {/* Card */}
        <div className="auth-card">
          {/* Mode switch tabs */}
          {mode !== "forgot" && (
            <div className="auth-tabs">
              <button
                className={`auth-tab ${mode === "login" ? "auth-tab-active" : ""}`}
                onClick={() => { setMode("login"); setNotice(""); }}
              >
                登入
              </button>
              <button
                className={`auth-tab ${mode === "register" ? "auth-tab-active" : ""}`}
                onClick={() => { setMode("register"); setNotice(""); }}
              >
                註冊
              </button>
            </div>
          )}

          {/* 介紹碼 — always visible except forgot */}
          {mode !== "forgot" && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="access-code">介紹碼</label>
              <input
                id="access-code"
                className="auth-input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="請輸入介紹碼"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
              />
              <div className="auth-input-hint">有效介紹碼是完成註冊及登入學習工作台的必要條件。</div>
            </div>
          )}

          {/* Login mode */}
          {mode === "login" && (
            <>
              <div className="auth-field">
                <label className="auth-label" htmlFor="login-account">賬戶名稱</label>
                <input id="login-account" className="auth-input" placeholder="例如：HK-EXAM-001" autoComplete="username" value={loginAccount} onChange={(e) => setLoginAccount(e.target.value)} />
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="login-password">登入密碼</label>
                <div className="auth-password-wrap">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    className="auth-input"
                    placeholder="輸入登入密碼"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="auth-row-between">
                <label className="auth-checkbox-label">
                  <input type="checkbox" className="auth-checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                  記住我
                </label>
                <button className="auth-link" onClick={() => { setMode("forgot"); setNotice(""); }}>忘記密碼？</button>
              </div>
              <button className="auth-btn-primary" onClick={() => submitDemo("登入成功")}>
                進入我的溫習中心 <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Register mode */}
          {mode === "register" && (
            <>
              <div className="auth-field">
                <label className="auth-label" htmlFor="register-account">帳戶名稱</label>
                <input id="register-account" className="auth-input" placeholder="設定帳戶名稱" value={registerAccount} onChange={(e) => setRegisterAccount(e.target.value)} />
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="register-email">電郵號碼</label>
                <input id="register-email" type="email" className="auth-input" placeholder="輸入電郵地址" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} />
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="register-password">登入密碼</label>
                <div className="auth-password-wrap">
                  <input id="register-password" type={showPassword ? "text" : "password"} className="auth-input" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} placeholder="輸入登入密碼" />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="register-confirm-password">確認密碼</label>
                <div className="auth-password-wrap">
                  <input id="register-confirm-password" type={showConfirmPassword ? "text" : "password"} className="auth-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次輸入登入密碼" />
                  <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div className="auth-input-hint">密碼會經安全雜湊處理後儲存，不會保存明文密碼。</div>
              <button className="auth-btn-primary" onClick={() => submitDemo("註冊完成")}>
                完成註冊並登入 <ArrowRight className="h-4 w-4" />
              </button>
            </>
          )}

          {/* Forgot mode */}
          {mode === "forgot" && (
            <>
              <div className="auth-notice auth-notice-info">
                <CircleHelp className="h-4 w-4 shrink-0 mt-0.5" />
                <span>本平台暫未提供自動尋回密碼功能。如忘記密碼，請電郵 feedback@example.com，並提供你的帳戶名稱及註冊電郵，管理員核實身份後會為你重設密碼。</span>
              </div>
              <a className="auth-btn-primary" href="mailto:feedback@example.com?subject=%E5%B0%8B%E5%9B%9E%E5%B8%B3%E6%88%B6%E5%AF%86%E7%A2%BC">
                電郵管理員重設密碼 <ArrowRight className="h-4 w-4" />
              </a>
              <button className="auth-btn-text" onClick={() => { setMode("login"); setNotice(""); }}>
                <ArrowLeft className="h-4 w-4" /> 返回登入
              </button>
            </>
          )}

          {/* Notice */}
          {notice && (
            <div className={`auth-notice auth-notice-${noticeType}`}>
              {noticeType === "error" ? <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> : noticeType === "success" ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <CircleHelp className="h-4 w-4 shrink-0 mt-0.5" />}
              <span>{notice}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="auth-footer">
          溫習寶 · 筆試溫習平台
          <div className="auth-footer-links">
            <button onClick={() => setLegalView("terms")}>使用條款</button>
            <button onClick={() => setLegalView("privacy")}>私隱政策</button>
          </div>
        </div>
      </div>

      {/* Terms / Privacy modal */}
      {legalView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" onClick={() => setLegalView(null)}>
          <div role="dialog" aria-modal="true" className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-card text-card-foreground shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-border p-4">
              <h2 className="text-base font-bold">{legalView === "terms" ? "使用條文" : "系統及私隱政策"}</h2>
              <button className="secondary-button" onClick={() => setLegalView(null)}>關閉</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm leading-7 text-muted-foreground">
              {legalView === "terms" ? (
                <div className="whitespace-pre-wrap">{APP_TERMS}</div>
              ) : (
                <div className="space-y-4">
                  <div><div className="font-semibold text-foreground">資料用途</div><p className="mt-1">本網站用於提供考試練習流程，所有作答紀錄均儲存於使用者瀏覽器本地端。</p></div>
                  <div><div className="font-semibold text-foreground">個人資料</div><p className="mt-1">註冊表單中的帳戶名稱與電郵將加密傳送至本平台的 Cloudflare 資料庫以建立帳戶；密碼不會以明文儲存，而是以 PBKDF2 單向雜湊技術處理後保存。介紹碼僅用於資格驗證，不會另作儲存。</p></div>
                  <div><div className="font-semibold text-foreground">介紹碼用途</div><p className="mt-1">介紹碼用作進入資格驗證；未能提供有效介紹碼的使用者不能完成註冊或登入學習工作台。</p></div>
                  <div><div className="font-semibold text-foreground">帳戶資料儲存</div><p className="mt-1">帳戶資料儲存於本平台的 Cloudflare D1 資料庫；作答紀錄、錯題本及收藏則儲存於使用者瀏覽器本地端。你可隨時在「設定」頁面永久刪除帳戶資料。</p></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard({ onNavigate, onStartToday, chapterStats }: { onNavigate: (screen: Screen) => void; onStartToday: () => void; chapterStats: ChapterStat[] }) {
  return <div className="mx-auto w-full max-w-[520px] space-y-6 pb-5 sm:max-w-2xl sm:space-y-7 lg:max-w-3xl">
    <div className="px-1 pt-1 sm:px-0">
      <div className="font-mono text-[10px] font-semibold tracking-[0.2em] text-[#718096]">QUICK START</div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="mt-2 text-[30px] font-bold tracking-[-0.04em] text-[#2D3748] sm:text-4xl">今日任務</h1><span className="status-pill bg-[#E8F0F8] text-[#1A365D]">會員登入後可用</span></div>
    </div>

    <section className="rounded-[22px] border border-[#D6E5F2] bg-[#E8F0F8] p-5 text-[#1A365D] shadow-[6px_8px_22px_rgba(26,54,93,0.08),-4px_-4px_12px_rgba(255,255,255,0.92)] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.16em] text-[#1A365D]/60">RECOMMENDED PRACTICE</div>
          <h2 className="mt-2 break-words text-[21px] font-bold tracking-[-0.03em] text-[#1A365D]">法例基礎·第1組</h2>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1A365D]/10 text-[#1A365D] shadow-[inset_2px_2px_5px_rgba(26,54,93,0.08)]"><Play className="h-5 w-5 fill-current" /></div>
      </div>
      <div className="mt-6 grid grid-cols-3 gap-3 border-t border-[#1A365D]/15 pt-4">
        <div><div className="font-mono text-xl font-bold">20</div><div className="mt-1 text-[11px] text-[#1A365D]/60">題目</div></div>
        <div><div className="font-mono text-xl font-bold">15</div><div className="mt-1 text-[11px] text-[#1A365D]/60">分鐘</div></div>
        <div><div className="font-mono text-xl font-bold">{chapterStats[0]?.answered ?? 0}</div><div className="mt-1 text-[11px] text-[#1A365D]/60">已答紀錄</div></div>
      </div>
    </section>

    <div className="space-y-3">
      <button className="primary-button min-h-12 w-full justify-center rounded-xl bg-[#1A365D] text-[14px] shadow-[0_8px_18px_rgba(26,54,93,0.18)]" onClick={onStartToday}>開始今日練習 <ArrowRight className="h-4 w-4" /></button>
      <button className="mx-auto flex min-h-11 items-center justify-center gap-2 px-3 text-[12px] font-semibold text-[#1A365D]" onClick={() => onNavigate("exam")}>進行一次模擬考 <ExternalLink className="h-3.5 w-3.5" /></button>
    </div>

    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4 px-1 sm:px-0">
        <div className="min-w-0">
          <div className="font-mono text-[10px] font-semibold tracking-[0.2em] text-[#718096]">YOUR STUDY PATH</div>
          <h2 className="mt-2 text-[24px] font-bold tracking-[-0.04em] text-[#2D3748] sm:text-3xl">四大範疇</h2>
        </div>
        <button className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#1A365D] transition hover:bg-[#E8F0F8]" onClick={() => onNavigate("practice")}>查看全部 <ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="space-y-3">
        {chapterStats.map((chapter) => <article key={chapter.id} className="rounded-[18px] border border-[#E1E8F0] bg-white p-4 shadow-[5px_7px_18px_rgba(26,54,93,0.06),-3px_-3px_10px_rgba(255,255,255,0.9)] sm:p-5">
          <div className="flex items-start gap-3.5">
            <div className={cn("chapter-number h-10 w-10 rounded-xl text-[11px]", `chapter-${chapter.tone}`)}>{chapter.icon}</div>
            <div className="min-w-0 flex-1">
              <h3 className="break-words text-[14px] font-bold leading-6 text-[#2D3748]">{chapter.title}</h3>
              <p className="mt-1 break-words text-[11px] leading-5 text-[#718096]">{chapter.detail}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#E8F0F8]" aria-label={`${chapter.title} 已完成 ${chapter.completion}%`}><div className="h-full rounded-full bg-[#34A686]" style={{ width: `${chapter.completion}%` }} /></div>
                <span className="shrink-0 font-mono text-[10px] font-semibold text-[#718096]">{chapter.completion}%</span>
              </div>
            </div>
          </div>
        </article>)}
      </div>
    </section>

    <p className="px-1 text-center text-[11px] leading-5 text-[#718096]">作答紀錄儲存於瀏覽器本地端，方便隨時溫習。</p>
  </div>;
}

function StatCard({ label, value, detail, icon: Icon, tone, progress }: { label: string; value: string; detail: string; icon: typeof Target; tone: string; progress: number }) {
  return <div className="panel stat-card"><div className={cn("stat-icon", `stat-${tone}`)}><Icon className="h-4 w-4" /></div><div className="mt-4 text-[11px] font-semibold text-muted-foreground">{label}</div><div className="mt-1 font-mono text-2xl font-bold tracking-tight">{value}</div><div className="mt-1 text-[11px] text-muted-foreground">{detail}</div><div className="mt-4 h-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", `bar-${tone}`)} style={{ width: `${progress}%` }} /></div></div>;
}

function PracticeView({ mode, setMode, source, chapters: chapterList, chapterStats, selectedChapter, setSelectedChapter, question, index, total, selectedAnswer, setSelectedAnswer, answered, onSubmit, onNext, correct, onStart, onStartRandom, isFavorite, onFavorite, onExitWrong }: { mode: PracticeMode; setMode: (mode: PracticeMode) => void; source: "chapter" | "random" | "wrong"; chapters: typeof chapters; chapterStats: ChapterStat[]; selectedChapter: string; setSelectedChapter: (id: string) => void; question: (typeof questions)[number]; index: number; total: number; selectedAnswer: string; setSelectedAnswer: (value: string) => void; answered: boolean; onSubmit: () => void; onNext: () => void; correct: number; onStart: (id?: string) => void; onStartRandom: (id?: string) => void; isFavorite: boolean; onFavorite: () => void; onExitWrong: () => void }) {
  const practiceStatus = correct >= 45
    ? { label: "冇得頂", className: "text-red-600" }
    : correct >= 15
      ? { label: "你好優秀", className: "text-blue-600" }
      : correct <= 10
        ? { label: "你仍需努力", className: "text-green-600" }
        : null;
  if (mode === "select") return <div className="mx-auto max-w-4xl space-y-7"><PageIntro eyebrow="PRACTICE LIBRARY" title="章節練習" description="按範疇選擇練習內容，答題後即時查看回饋及參考解釋。" /><section className="rounded-[18px] border border-border bg-card/80 p-3 shadow-[0_12px_30px_color-mix(in_srgb,var(--primary)_6%,transparent)] sm:p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1"><div><div className="eyebrow">CHOOSE A MODULE</div><h2 className="mt-1 text-base font-bold tracking-tight">選擇溫習範疇</h2></div><span className="text-xs text-muted-foreground">點選卡片查看並開始練習</span></div><div className="space-y-3">{chapterList.map((chapter) => { const stat = chapterStats.find((item) => item.id === chapter.id); return <article key={chapter.id} className={cn("rounded-2xl border bg-card p-4 shadow-[0_8px_20px_color-mix(in_srgb,var(--primary)_5%,transparent)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_12px_24px_color-mix(in_srgb,var(--primary)_10%,transparent)]", selectedChapter === chapter.id ? "border-primary/70 ring-2 ring-primary/10" : "border-border")}><button type="button" className="group flex min-h-28 w-full min-w-0 items-start gap-3 text-left sm:gap-4" aria-pressed={selectedChapter === chapter.id} onClick={() => setSelectedChapter(chapter.id)}><div className={cn("chapter-number mt-0.5 h-11 w-11 rounded-xl text-[13px]", `chapter-${chapter.tone}`)}>{chapter.icon}</div><div className="min-w-0 flex-1"><div className="flex min-w-0 items-start justify-between gap-3"><h2 className="min-w-0 break-words text-[15px] font-bold leading-6 text-foreground sm:text-base">{chapter.title}</h2><span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 font-mono text-[11px] font-semibold text-primary">{chapter.count}題</span></div><p className="mt-1.5 break-words text-xs leading-5 text-muted-foreground">{chapter.detail}</p><div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-5 text-muted-foreground"><span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-chart-3" />已完成 {stat?.answered ?? 0} 題</span><span className="text-border">｜</span><span>正確率 {stat?.accuracy === null || stat?.accuracy === undefined ? "尚未記錄" : `${stat.accuracy}%`}</span></div></div><ChevronRight className="mt-3 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" /></button><button type="button" className="primary-button mt-4 w-full justify-center" onClick={() => onStart(chapter.id)}>開始練習 <ArrowRight className="h-4 w-4" /></button></article>; })}</div></section><section className="panel flex flex-col items-start justify-between gap-5 border-primary/10 bg-primary/[0.025] sm:flex-row sm:items-center"><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-bold"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><TimerReset className="h-4 w-4" /></span>隨機練習</div><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">從目前選取的範疇隨機抽取20題，快速檢查掌握程度。</p></div><button type="button" className="primary-button w-full justify-center sm:w-auto" onClick={() => onStartRandom(selectedChapter)}>開始隨機20題 <ArrowRight className="h-4 w-4" /></button></section></div>;
  if (mode === "result") return <div className="mx-auto max-w-2xl"><div className="panel text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-chart-3/15 text-chart-3"><Trophy className="h-8 w-8" /></div><div className="eyebrow mt-6">{source === "wrong" ? "WRONG ANSWERS COMPLETE" : "PRACTICE COMPLETE"}</div><h1 className="mt-2 text-3xl font-bold">{source === "wrong" ? "錯題重做完成" : "這組練習完成了"}</h1>{source !== "wrong" && practiceStatus && <div className={cn("mt-4 text-2xl font-bold", practiceStatus.className)}>{practiceStatus.label}</div>}<p className="mt-2 text-sm text-muted-foreground">{source === "wrong" ? "目前已沒有剩餘錯題，這組錯題已從錯題本移除。" : `你答對 ${correct} / ${total} 題，繼續累積每一次正確判斷。`}</p>{source !== "wrong" && <><div className="mx-auto mt-7 max-w-sm"><div className="h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-3" style={{ width: `${Math.round((correct / Math.max(total, 1)) * 100)}%` }} /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>正確率</span><span className="font-mono font-bold text-foreground">{Math.round((correct / Math.max(total, 1)) * 100)}%</span></div></div></>}<div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">{source === "wrong" ? <button className="primary-button justify-center" onClick={onExitWrong}><Library className="h-4 w-4" />返回錯題本</button> : <><button className="secondary-button justify-center" onClick={() => setMode("select")}><RotateCcw className="h-4 w-4" />選擇其他範疇</button><button className="primary-button justify-center" onClick={() => onStart(selectedChapter)}>再做一次 <ArrowRight className="h-4 w-4" /></button></>}</div></div></div>;
  return <div className="mx-auto max-w-4xl space-y-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><button className="text-button" onClick={source === "wrong" ? onExitWrong : () => setMode("select")}><ArrowLeft className="h-3.5 w-3.5" />{source === "wrong" ? "結束錯題重做" : "返回範疇"}</button><div className="flex items-center gap-3"><span className="status-pill">{source === "wrong" ? "錯題連續重做" : source === "random" ? "隨機練習" : "章節練習"}</span><span className="font-mono text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span><button className={cn("icon-button", isFavorite && "icon-button-active")} aria-label="收藏題目" onClick={onFavorite}><Bookmark className={cn("h-4 w-4", isFavorite && "fill-current")} /></button></div></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} /></div><div className="panel question-panel"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="question-number">Q{question.number}</span><span className="text-xs font-semibold text-muted-foreground">{question.type}</span></div><span className="text-xs text-muted-foreground">來源標記：使用者提供匯入資料</span></div><h1 className="mt-7 max-w-3xl text-xl font-bold leading-8 tracking-tight sm:text-2xl">{question.stem}</h1><div className="mt-7 space-y-3">{question.options.map(([key, text]) => { const isSelected = selectedAnswer === key; const isCorrect = answered && key === question.answer; const isWrong = answered && isSelected && !isCorrect; return <button key={key} className={cn("answer-option", isSelected && "answer-option-selected", isCorrect && "answer-option-correct", isWrong && "answer-option-wrong")} onClick={() => !answered && setSelectedAnswer(key)}><span className="answer-key">{key}</span><span className="flex-1 text-left text-sm leading-6">{text}</span>{isCorrect && <Check className="h-5 w-5 text-chart-3" />}{isWrong && <XCircle className="h-5 w-5 text-destructive" />}</button>; })}</div>{answered && <div className={cn("feedback-box", selectedAnswer === question.answer ? "feedback-correct" : "feedback-wrong")}><div className="flex items-center gap-2 text-sm font-bold">{selectedAnswer === question.answer ? <><Check className="h-4 w-4" />回答正確</> : <><XCircle className="h-4 w-4" />答案不正確 · 正確答案是 {question.answer}</>}</div><p className="mt-2 text-xs leading-6 text-muted-foreground">{question.explanation}</p><p className="mt-2 border-t border-border/70 pt-2 text-xs leading-6 text-muted-foreground"><span className="font-semibold text-foreground">參考：</span>{question.reference}</p></div>}<div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-border pt-5 sm:flex-row"><span className="self-center text-xs text-muted-foreground">{source === "wrong" ? "答錯會保留在錯題本，答對會即時移除。" : "作答後會加入學習紀錄"}</span>{!answered ? <button className="primary-button justify-center" onClick={onSubmit}>提交答案 <Check className="h-4 w-4" /></button> : <button className="primary-button justify-center" onClick={onNext}>{source === "wrong" ? "下一道錯題" : index + 1 >= total ? "查看結果" : "下一題"} <ArrowRight className="h-4 w-4" /></button>}</div></div></div>;
}

function ExamView({ mode, question, index, total, examQuestions, answers, seconds, onStart, onSelect, onJump, onNext, onBack, onFinish, score }: { mode: ExamMode; question: (typeof questions)[number]; index: number; total: number; examQuestions: typeof questions; answers: Record<string, string>; seconds: number; onStart: () => void; onSelect: (answer: string) => void; onJump: (index: number) => void; onNext: () => void; onBack: () => void; onFinish: () => void; score: number }) {
  const resultStatus = score >= 45
    ? { label: "優良", className: "text-red-600" }
    : score >= 25
      ? { label: "合格", className: "text-blue-600" }
      : { label: "不合格", className: "text-green-600" };
  if (mode === "setup") return <div className="space-y-7"><PageIntro eyebrow="MOCK EXAMINATION" title="模擬考試" description="從1,000題本地匯入題庫隨機抽取50題，在限定時間內完成並於交卷後查看結果。" action={<span className="status-pill status-pill-warning"><Clock3 className="h-3.5 w-3.5" />30:00 模式</span>} /><div className="grid gap-5 lg:grid-cols-[1fr_0.8fr]"><div className="panel"><div className="eyebrow">EXAM BRIEF</div><h2 className="mt-2 text-xl font-bold">筆試綜合模擬 · 第 01 回</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">涵蓋四大範疇的綜合題組，每次隨機抽取50題，完成後會顯示得分及正確率。</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><ExamMeta icon={FileCheck2} value="50" label="題目" /><ExamMeta icon={Clock3} value="30:00" label="時間" /><ExamMeta icon={Target} value="自動" label="評分" /></div><button className="primary-button mt-8 w-full justify-center sm:w-auto" onClick={onStart}>開始模擬考 <Play className="h-4 w-4 fill-current" /></button></div><div className="panel bg-primary text-primary-foreground"><div className="flex items-center gap-2 text-sm font-semibold"><CircleHelp className="h-4 w-4 text-chart-4" />考試提示</div><ul className="mt-5 space-y-4 text-xs leading-6 text-primary-foreground/70"><li className="flex gap-3"><span className="font-mono text-chart-4">01</span><span>倒數30分鐘開始後，系統會持續保留目前作答進度。</span></li><li className="flex gap-3"><span className="font-mono text-chart-4">02</span><span>可使用50題導覽返回及跳到已看過的題目。</span></li><li className="flex gap-3"><span className="font-mono text-chart-4">03</span><span>交卷後才會顯示分數及答案解析。</span></li></ul></div></div></div>;
  if (mode === "result") return <div className="mx-auto max-w-2xl"><div className="panel text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><Trophy className="h-8 w-8" /></div><div className="eyebrow mt-6">EXAM RESULT</div><h1 className="mt-2 text-3xl font-bold">模擬考完成</h1><div className={cn("mt-4 text-2xl font-bold", resultStatus.className)}>{resultStatus.label}</div><p className="mt-1 text-xs text-muted-foreground">按答對題數評定：45分或以上為優良，25至44分為合格，低於25分為不合格。</p><div className="mt-7 grid grid-cols-3 gap-3"><div className="result-stat"><div className="font-mono text-3xl font-bold text-primary">{Math.round((score / total) * 100)}%</div><div>總正確率</div></div><div className="result-stat"><div className="font-mono text-3xl font-bold">{score}</div><div>答對題數</div></div><div className="result-stat"><div className="font-mono text-3xl font-bold">{total}</div><div>總題數</div></div></div><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><button className="secondary-button justify-center" onClick={onStart}><RotateCcw className="h-4 w-4" />重新設定</button><button className="primary-button justify-center" onClick={onStart}>再考一次 <ArrowRight className="h-4 w-4" /></button></div></div></div>;
  return <div className="mx-auto max-w-5xl space-y-5"><div className="exam-topbar"><div><div className="eyebrow text-primary-foreground/45">MOCK EXAM · 01</div><div className="mt-1 text-sm font-bold text-primary-foreground">筆試綜合模擬</div></div><div className="flex items-center gap-4"><div className="hidden text-right sm:block"><div className="text-[10px] uppercase tracking-wider text-primary-foreground/45">回答進度</div><div className="font-mono text-sm text-primary-foreground">{Object.keys(answers).length} / {total}</div></div><div className="timer"><Clock3 className="h-4 w-4" />{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</div></div></div><div className="grid gap-5 lg:grid-cols-[1fr_240px]"><div className="panel question-panel"><div className="flex items-center justify-between"><span className="question-number">Q{question.number}</span><span className="text-xs text-muted-foreground">{question.type}</span></div><h1 className="mt-7 text-xl font-bold leading-8 sm:text-2xl">{question.stem}</h1><div className="mt-7 space-y-3">{question.options.map(([key, text]) => <button key={key} className={cn("answer-option", answers[question.id] === key && "answer-option-selected")} onClick={() => onSelect(key)}><span className="answer-key">{key}</span><span className="flex-1 text-left text-sm leading-6">{text}</span>{answers[question.id] === key && <Check className="h-5 w-5 text-primary" />}</button>)}</div><div className="mt-8 border-t border-border pt-5"><div className="flex flex-col gap-3 sm:flex-row"><button className="secondary-button justify-center" onClick={onBack} disabled={index === 0}><ArrowLeft className="h-4 w-4" />上一題</button><button className="secondary-button justify-center" onClick={onNext} disabled={index >= total - 1}>下一題 <ArrowRight className="h-4 w-4" /></button></div></div></div><div className="panel h-fit"><div className="text-xs font-bold">題目導覽（{total}題）</div><div className="mt-4 grid max-h-80 grid-cols-5 gap-2 overflow-y-auto">{examQuestions.map((item, itemIndex) => <button key={item.id} className={cn("question-chip", itemIndex === index && "question-chip-active", answers[item.id] && "question-chip-done")} onClick={() => onJump(itemIndex)}>{itemIndex + 1}</button>)}</div><div className="mt-5 border-t border-border pt-4 text-[11px] leading-5 text-muted-foreground"><div className="flex min-h-11 items-center justify-between gap-2"><div className="flex items-center gap-2"><span className="legend-dot legend-active" />目前題目</div><button className="primary-button min-h-11 shrink-0 justify-center px-3 text-xs" onClick={onFinish}>交卷 <Flag className="h-4 w-4" /></button></div><div className="mt-1 flex items-center gap-2"><span className="legend-dot legend-done" />已作答</div><div className="mt-1 flex items-center gap-2"><span className="legend-dot legend-empty" />未作答</div></div></div></div></div>;
}

function ExamMeta({ icon: Icon, value, label }: { icon: typeof FileCheck2; value: string; label: string }) { return <div className="rounded-xl bg-muted p-4"><Icon className="h-4 w-4 text-primary" /><div className="mt-3 font-mono text-lg font-bold">{value}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></div>; }

function LibraryView({ wrongIds, favorites, questions: questionList, onFavorite, onPractice }: { wrongIds: string[]; favorites: string[]; questions: typeof questions; onFavorite: (id: string) => void; onPractice: (id: string) => void }) {
  const [tab, setTab] = useState<"wrong" | "favorites">("wrong");
  const ids = tab === "wrong" ? wrongIds : favorites;
  return <div className="space-y-7"><PageIntro eyebrow="YOUR LIBRARY" title="錯題與收藏" description="集中整理需要重溫的題目，讓每次回看都有明確目的。" action={<span className="status-pill">本地狀態已保存</span>} /><div className="tab-bar"><button className={cn("tab-button", tab === "wrong" && "tab-button-active")} onClick={() => setTab("wrong")}><RotateCcw className="h-4 w-4" />錯題本 <span>{wrongIds.length}</span></button><button className={cn("tab-button", tab === "favorites" && "tab-button-active")} onClick={() => setTab("favorites")}><Bookmark className="h-4 w-4" />收藏 <span>{favorites.length}</span></button></div><div className="space-y-3">{ids.map((id) => { const question = questionList.find((item) => item.id === id); if (!question) return null; return <div className="panel library-row flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:gap-4" key={id}><div className="flex min-w-0 flex-1 items-start gap-3"><div className="question-number mt-0.5 shrink-0">Q{question.number}</div><div className="min-w-0 flex-1"><div className="mb-2 break-words text-sm font-semibold leading-6 [overflow-wrap:anywhere]">{question.stem}</div><div className="break-words text-xs leading-5 text-muted-foreground">{chapters.find((chapter) => chapter.id === question.chapter)?.title ?? "未分類範疇"} · {question.type}</div></div></div><div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end"><button className="secondary-button min-h-11 flex-1 justify-center sm:flex-none" onClick={() => onPractice(id)}>重做 <Play className="h-3.5 w-3.5" /></button><button className={cn("icon-button", favorites.includes(id) && "icon-button-active")} aria-label="切換收藏" onClick={() => onFavorite(id)}><Bookmark className={cn("h-4 w-4", favorites.includes(id) && "fill-current")} /></button></div></div>; })}{ids.length === 0 && <div className="panel py-12 text-center"><Library className="mx-auto h-8 w-8 text-muted-foreground/50" /><p className="mt-3 text-sm font-semibold">這裡暫時沒有題目</p><p className="mt-1 text-xs text-muted-foreground">完成練習後，題目會按需要出現在這裡。</p></div>}</div></div>;
}

function ProgressView({ chapterStats, totalAnswered, totalCorrect, overallAccuracy, wrongCount, favoriteCount, weakestChapter }: { chapterStats: ChapterStat[]; totalAnswered: number; totalCorrect: number; overallAccuracy: number | null; wrongCount: number; favoriteCount: number; weakestChapter?: ChapterStat }) {
  const completedCount = chapterStats.reduce((total, chapter) => total + chapter.completed, 0);
  const totalQuestions = questions.length;
  const overallCompletion = totalQuestions ? Math.min(100, Math.round((completedCount / totalQuestions) * 100)) : 0;
  const hasLearningData = totalAnswered > 0 || wrongCount > 0 || favoriteCount > 0;
  const accuracyLabel = overallAccuracy === null ? "尚未記錄" : `${overallAccuracy}%`;
  const recommendation = weakestChapter
    ? weakestChapter.wrongInLibrary > 0
      ? `先重做「${weakestChapter.title}」錯題本內的 ${weakestChapter.wrongInLibrary} 題，完成後再以同一範疇練習鞏固。`
      : `先在「${weakestChapter.title}」完成一組練習，累積更多紀錄後再觀察正確率變化。`
    : "先完成至少一組章節練習；系統會按實際作答紀錄整理較弱範疇。";

  return <div className="space-y-7"><PageIntro eyebrow="LEARNING ANALYTICS" title="學習進度" description="由本地作答紀錄、錯題本及收藏狀態整理你的學習報告。" action={<span className="status-pill"><BarChart3 className="h-3.5 w-3.5" />學習報告</span>} /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><div className="panel progress-highlight"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Target className="h-4 w-4 text-primary" />已完成題目</div><div className="mt-2 font-mono text-4xl font-bold text-primary">{completedCount}</div><div className="mt-2 text-xs text-muted-foreground">共 {totalQuestions} 題 · {overallCompletion}%</div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${overallCompletion}%` }} /></div></div><div className="panel progress-highlight"><div className="flex items-center gap-2 text-xs text-muted-foreground"><BookOpen className="h-4 w-4 text-chart-2" />作答次數</div><div className="mt-2 font-mono text-4xl font-bold">{totalAnswered}</div><div className="mt-2 text-xs text-muted-foreground">每次提交均會記錄</div></div><div className="panel progress-highlight"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Gauge className="h-4 w-4 text-chart-3" />整體正確率</div><div className="mt-2 font-mono text-4xl font-bold text-chart-3">{accuracyLabel}</div><div className="mt-2 text-xs text-muted-foreground">答對 {totalCorrect} 題</div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-3" style={{ width: `${overallAccuracy ?? 0}%` }} /></div></div><div className="panel progress-highlight"><div className="flex items-center gap-2 text-xs text-muted-foreground"><RotateCcw className="h-4 w-4 text-destructive" />錯題本</div><div className="mt-2 font-mono text-4xl font-bold text-destructive">{wrongCount}</div><div className="mt-2 text-xs text-muted-foreground">待重溫題目</div></div><div className="panel progress-highlight"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Bookmark className="h-4 w-4 text-chart-4" />收藏題目</div><div className="mt-2 font-mono text-4xl font-bold">{favoriteCount}</div><div className="mt-2 text-xs text-muted-foreground">已加入收藏</div></div></div><div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><section className="panel"><div className="section-heading"><div><div className="eyebrow">CHAPTER MASTERY</div><h2 className="section-title">範疇掌握度</h2></div><span className="text-xs text-muted-foreground">完成題目／正確率</span></div><div className="mt-6 space-y-5">{chapterStats.map((chapter) => <div key={chapter.id}><div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-semibold">{chapter.title}</span><span className="font-mono text-xs text-muted-foreground">{chapter.completed} / {chapter.count} 題 · {chapter.accuracy === null ? "尚未記錄" : `${chapter.accuracy}%`}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", `chapter-${chapter.tone}`)} style={{ width: `${chapter.completion}%` }} /></div><div className="mt-1 text-[11px] text-muted-foreground">作答 {chapter.answered} 次 · 錯題本 {chapter.wrongInLibrary} 題</div></div>)}</div></section><section className="panel"><div className="eyebrow">LEARNING REPORT</div><h2 className="section-title mt-1">學習報告</h2><div className="mt-5 rounded-xl border border-primary/10 bg-primary/[0.035] p-4"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></div><div className="min-w-0"><div className="text-sm font-semibold">目前較弱範疇</div>{hasLearningData && weakestChapter ? <><p className="mt-1 text-base font-bold text-primary">{weakestChapter.title}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">作答 {weakestChapter.answered} 次、正確率 {weakestChapter.accuracy === null ? "尚未記錄" : `${weakestChapter.accuracy}%`}、錯題本 {weakestChapter.wrongInLibrary} 題。</p></> : <p className="mt-1 text-xs leading-5 text-muted-foreground">暫未有足夠作答紀錄判斷較弱範疇。</p>}</div></div></div><div className="mt-4 rounded-xl border border-border bg-muted/45 p-4"><div className="text-sm font-semibold">需要加強的方向</div><p className="mt-2 text-xs leading-6 text-muted-foreground">{recommendation}</p></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-border p-3"><div className="text-[11px] text-muted-foreground">報告依據</div><div className="mt-1 text-sm font-semibold">{totalAnswered} 次作答 · {wrongCount} 題錯題</div></div><div className="rounded-xl border border-border p-3"><div className="text-[11px] text-muted-foreground">收藏參考</div><div className="mt-1 text-sm font-semibold">{favoriteCount} 題收藏</div></div></div></section></div><div className="notice-banner"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/20 text-warning"><CircleHelp className="h-5 w-5" /></div><div><div className="text-sm font-semibold">學習數據說明</div><p className="mt-1 text-xs leading-5 text-muted-foreground">以上數據來自瀏覽器本地作答紀錄，重新整理後可能重置。</p></div></div></div>;
}

function ShareView({ onToast }: { onToast: (message: string) => void }) {
  const [shareUrl, setShareUrl] = useState("");
  const shareText = "我正在使用筆試溫習中心，一起開始筆試練習吧！";

  useEffect(() => {
    setShareUrl(window.location.href);
  }, []);

  async function copyCurrentUrl(message = "網址已複製，可貼到 WeChat 或其他聊天工具分享") {
    if (!shareUrl) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.setAttribute("readonly", "");
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        document.body.removeChild(textArea);
        if (!copied) throw new Error("copy failed");
      }
      onToast(message);
    } catch {
      onToast("未能自動複製，請直接選取下方網址後複製");
    }
  }

  async function shareToInstagram() {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "筆試溫習中心", text: shareText, url: shareUrl });
        onToast("已開啟手機分享面板");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyCurrentUrl("網址已複製，請在 Instagram 或手機分享面板中貼上");
  }

  const whatsappUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(`${shareText}\\n${shareUrl}`)}`
    : "#";

  return <div className="mx-auto max-w-4xl space-y-7">
    <PageIntro eyebrow="SHARE WITH FRIENDS" title="分享好友" description="邀請朋友一起使用筆試溫習中心，分享目前網站網址即可開始。" action={<span className="status-pill">跨裝置分享</span>} />
    <section className="panel border-primary/10 bg-primary/[0.025]">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Share2 className="h-5 w-5" /></div>
        <div className="min-w-0">
          <h2 className="text-base font-bold">先複製目前網址</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">網址會按你目前開啟的網站頁面即時讀取，不會使用舊版本或預設連結。</p>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input className="input-demo min-h-11 min-w-0 flex-1 text-xs" aria-label="目前網站網址" value={shareUrl || "正在讀取目前網址…"} readOnly />
        <button type="button" className="secondary-button min-h-11 justify-center sm:shrink-0" onClick={() => copyCurrentUrl()} disabled={!shareUrl}><Copy className="h-4 w-4" />複製網址</button>
      </div>
    </section>

    <section className="grid gap-4 md:grid-cols-3">
      <article className="panel flex h-full flex-col border-[#25D366]/25 bg-[#25D366]/[0.035]">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#128C7E]"><MessageCircle className="h-5 w-5" /></div><div><h2 className="font-bold">WhatsApp</h2><p className="text-[11px] text-muted-foreground">直接開啟分享連結</p></div></div>
        <p className="mt-4 flex-1 text-xs leading-6 text-muted-foreground">按下後會開啟 WhatsApp，並預先填入網站網址及邀請訊息。</p>
        <a className={cn("primary-button mt-5 min-h-11 justify-center bg-[#128C7E] hover:bg-[#0f766e]", !shareUrl && "pointer-events-none opacity-50")} href={whatsappUrl} target="_blank" rel="noreferrer" aria-disabled={!shareUrl}>開啟 WhatsApp <ExternalLink className="h-4 w-4" /></a>
      </article>

      <article className="panel flex h-full flex-col border-[#34A686]/25 bg-[#34A686]/[0.035]">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#34A686]/15 text-[#23866d] font-bold">微</div><div><h2 className="font-bold">WeChat</h2><p className="text-[11px] text-muted-foreground">複製網址後貼上分享</p></div></div>
        <p className="mt-4 flex-1 text-xs leading-6 text-muted-foreground">瀏覽器通常不提供直接開啟 WeChat 好友分享的網頁介面，因此使用複製網址方式，手機及桌面瀏覽器都適用。</p>
        <button type="button" className="primary-button mt-5 min-h-11 justify-center bg-[#23866d] hover:bg-[#1d705b]" onClick={() => copyCurrentUrl("網址已複製，請貼到 WeChat 對話中分享")} disabled={!shareUrl}><Copy className="h-4 w-4" />複製到 WeChat</button>
      </article>

      <article className="panel flex h-full flex-col border-[#C13584]/25 bg-[#C13584]/[0.035]">
        <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#C13584]/15 text-[#C13584]"><Instagram className="h-5 w-5" /></div><div><h2 className="font-bold">Instagram</h2><p className="text-[11px] text-muted-foreground">使用系統分享或複製網址</p></div></div>
        <p className="mt-4 flex-1 text-xs leading-6 text-muted-foreground">Instagram 沒有通用的網頁分享網址；手機會優先開啟系統分享面板，其他情況則複製網址。</p>
        <button type="button" className="primary-button mt-5 min-h-11 justify-center bg-[#C13584] hover:bg-[#a52d70]" onClick={shareToInstagram} disabled={!shareUrl}><Share2 className="h-4 w-4" />分享至 Instagram</button>
      </article>
    </section>

    <div className="notice-banner"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/20 text-warning"><CircleHelp className="h-5 w-5" /></div><div><div className="text-sm font-semibold">分享功能說明</div><p className="mt-1 text-xs leading-5 text-muted-foreground">WhatsApp 使用公開分享連結；WeChat 及 Instagram 的實際分享方式會按瀏覽器、手機系統及 App 支援情況而定。本頁不會保存或追蹤分享紀錄。</p></div></div>
  </div>;
}

function TermsView() {
  return <div className="mx-auto max-w-4xl space-y-7"><PageIntro eyebrow="APP TERMS" title="使用條文" description="登入會員可使用本應用內的章節練習、模擬考試、錯題／收藏及學習進度功能。" action={<span className="status-pill">會員登入後可用</span>} /><section className="panel"><TermsCard /></section><div className="notice-banner"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/20 text-warning"><CircleHelp className="h-5 w-5" /></div><div><div className="text-sm font-semibold">學習數據說明</div><p className="mt-1 text-xs leading-5 text-muted-foreground">以上條文為本平台的完整使用條文。</p></div></div></div>;
}

function DisclaimerView() {
  const statements = [
    { title: "1. 原創聲明", body: "本應用程式內所有試題、答案及解釋，均為原創設計，並未抄襲、複製或改編自香港警務處歷年公開試題、內部考核試題或任何第三方題庫。" },
    { title: "2. 非官方性質", body: "本應用程式與香港警務處並無任何關聯，並非官方產品，亦未經香港警務處認可、授權或贊助。內容不代表香港警務處的立場或意見。" },
    { title: "3. 參考用途", body: "本應用程式內容僅供使用者個人溫習及參考之用，不構成任何正式訓練、考核或評核之依據。使用者應自行判斷內容的適用性。" },
    { title: "4. 官方文件為準", body: "所有題目之答案及解釋，僅供輔助學習。實際執法、程序及法律適用，應以香港警務處現行生效之《警察通例》（PGO）、《程序手冊》（FPM）、相關法例及官方指引為最終標準。" },
    { title: "5. 責任說明", body: "使用者應自行核實官方最新規定，並對使用本應用程式作出的判斷及行動負責。在適用法律容許的範圍內，開發者不就使用本應用程式所產生的間接或後果性損失（包括考試成績、職位晉升或紀律處分）作出保證或承擔責任。" },
    { title: "6. 版權與使用", body: "本應用程式內容版權歸開發者所有，僅供個人非商業用途。未經許可，不得轉載、販售或用作商業教學。" },
  ];

  return <div className="mx-auto max-w-4xl space-y-7"><PageIntro eyebrow="DISCLAIMER" title="免責聲明" description="請在使用本應用程式前閱讀以下聲明。" action={<span className="status-pill">現行版本</span>} /><section className="panel"><div className="space-y-6 text-sm leading-7 text-muted-foreground">{statements.map((statement) => <section key={statement.title}><h2 className="font-semibold text-foreground">{statement.title}</h2><p className="mt-2">{statement.body}</p></section>)}<p className="border-t border-border pt-5 font-medium text-foreground">如有任何疑問，請以香港警務處官方公佈之文件為準。</p></div></section><div className="notice-banner"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-4/20 text-warning"><CircleHelp className="h-5 w-5" /></div><div><div className="text-sm font-semibold">使用提示</div><p className="mt-1 text-xs leading-5 text-muted-foreground">「使用條文」處理帳戶及平台使用規則；本頁集中說明原創、非官方性質、參考用途、官方文件優先及責任範圍，避免內容重複。</p></div></div></div>;
}

function FeedbackView() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const subject = encodeURIComponent("筆試溫習中心意見回饋");
  const body = encodeURIComponent(`學員電郵：${email}\n\n意見內容：\n${message}`);
  return <div className="mx-auto max-w-3xl space-y-7"><PageIntro eyebrow="STUDY WORKPLACE" title="意見收集" description="歡迎分享使用體驗、題庫建議或介面改善方向。" action={<span className="status-pill">意見收集</span>} /><div className="notice-banner"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><CircleHelp className="h-5 w-5" /></div><div><div className="text-sm font-semibold">意見收集說明</div><p className="mt-1 text-xs leading-5 text-muted-foreground">按下電郵按鈕會開啟你的電郵程式，以地址 feedback@example.com 建立草稿。</p></div></div><form className="panel space-y-5" onSubmit={(event) => event.preventDefault()}><div><label className="field-label" htmlFor="feedback-email">學員電郵</label><input id="feedback-email" type="email" required className="input-demo mt-2 w-full" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div><label className="field-label" htmlFor="feedback-message">意見內容</label><textarea id="feedback-message" required className="input-demo mt-2 min-h-40 w-full resize-y" placeholder="請輸入你的意見或建議" value={message} onChange={(event) => setMessage(event.target.value)} /></div><a className={cn("primary-button inline-flex justify-center", (!email || !message) && "pointer-events-none opacity-50")} href={`mailto:feedback@example.com?subject=${subject}&body=${body}`}>以電郵反映意見 <ArrowRight className="h-4 w-4" /></a><p className="text-xs text-muted-foreground">收件地址：feedback@example.com · 表單內容不會由本平台保存。</p></form></div>;
}


function SettingsView({ accountName, onLogout, onToast }: { accountName: string; onLogout: () => void; onToast: (message: string) => void }) {
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");

  async function clearOfflineCache() {
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      onToast("離線快取已清除，重新載入後會重新建立。");
    } catch {
      onToast("清除快取暫時未能完成，請稍後再試。");
    }
  }

  async function deleteAccount() {
    if (!deletePassword) {
      setDeleteError("請輸入登入密碼以確認刪除。");
      return;
    }
    if (!deleteConfirm) {
      setDeleteError("請先勾選確認方格。");
      return;
    }
    setDeleting(true);
    setDeleteError("");
    setDeleteMessage("正在刪除帳號，請稍候...");
    try {
      const response = await fetch("/api/delete-account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountName: accountName.trim(), password: deletePassword }),
      });
      const result = await response.json().catch(() => ({ message: "刪除帳號暫時未能完成，請稍後再試。" }));
      if (!response.ok || !result.ok) {
        setDeleting(false);
        setDeleteMessage("");
        setDeleteError(result.message || "刪除帳號暫時未能完成，請稍後再試。");
        return;
      }
      try {
        window.localStorage.removeItem(`wenxibao-progress:${accountName.trim()}`);
        window.localStorage.removeItem("wenxibao-remember-account");
      } catch { /* 忽略本地儲存失敗 */ }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      onLogout();
    } catch {
      setDeleting(false);
      setDeleteMessage("");
      setDeleteError("未能連接刪除服務，請檢查網絡後再試。");
    }
  }

  return <div className="mx-auto max-w-3xl space-y-7">
    <PageIntro eyebrow="ACCOUNT SETTINGS" title="設定" description="管理帳戶、離線資料及應用程式資訊。" action={<span className="status-pill">帳戶設定</span>} />
    <div className="notice-banner"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Settings className="h-5 w-5" /></div><div><div className="text-sm font-semibold">設定說明</div><p className="mt-1 text-xs leading-5 text-muted-foreground">此頁管理目前登入帳戶及本機離線資料。刪除帳號前請先完成重要溫習紀錄備份。</p></div></div>
    <section className="panel space-y-4">
      <div className="flex items-center gap-3">
        <div className="avatar">{accountName.trim().charAt(0) || "溫"}</div>
        <div><div className="text-sm font-semibold">{accountName}</div><div className="text-[11px] text-muted-foreground">在職溫習者 · 已登入</div></div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button className="secondary-button justify-center" onClick={clearOfflineCache}><RotateCcw className="h-4 w-4" />清除離線快取</button>
        <button className="secondary-button justify-center" onClick={onLogout}><X className="h-4 w-4" />登出帳戶</button>
      </div>
      <p className="text-xs text-muted-foreground">清除離線快取會移除手機／電腦上暫存的頁面資源，下次開啟時會自動重新下載；登出後需重新輸入帳戶名稱及密碼登入。</p>
    </section>
    <section className="panel space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />刪除帳號</div>
      <p className="text-xs leading-5 text-muted-foreground">刪除帳號會永久移除伺服器上的帳戶名稱、電郵及密碼資料，無法復原。瀏覽器內的作答紀錄不會因此刪除。</p>
      <div>
        <label className="field-label" htmlFor="delete-password">登入密碼（確認身份）</label>
        <input id="delete-password" type="password" className="input-demo mt-2 w-full" placeholder="請輸入目前帳戶的登入密碼" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} disabled={deleting} />
      </div>
      <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-muted-foreground">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-primary" checked={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.checked)} disabled={deleting} />
        <span>我明白刪除帳號後帳戶資料無法復原，並確認要永久刪除此帳號。</span>
      </label>
      {deleteMessage && <p className="text-xs text-primary">{deleteMessage}</p>}
      {deleteError && <p className="text-xs" style={{ color: "var(--destructive)" }}>{deleteError}</p>}
      <button className="secondary-button justify-center" style={{ borderColor: "var(--destructive)", color: "var(--destructive)" }} disabled={deleting || !deletePassword || !deleteConfirm} onClick={deleteAccount}><XCircle className="h-4 w-4" />永久刪除帳號</button>
    </section>
    <section className="panel space-y-2">
      <div className="text-sm font-semibold">關於</div>
      <div className="text-xs leading-5 text-muted-foreground">溫習寶 · 筆試溫習中心（PWA 版本）<br />作答紀錄儲存於瀏覽器本地端；帳戶資料經加密密碼驗證後儲存於平台資料庫。</div>
    </section>
  </div>;
}


function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="eyebrow">{eyebrow}</div><h1 className="page-title">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{action}</div>; }

export default App;
