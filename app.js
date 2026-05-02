const STORAGE_KEY = "grand_prix_quiz_v1_7_1";
const screens = {
  home: document.getElementById("homeScreen"),
  quiz: document.getElementById("quizScreen"),
  detail: document.getElementById("detailScreen"),
  result: document.getElementById("resultScreen")
};

let allQuestions = [];
let currentCourse = "F1・クルマ総合";
let currentMode = "all";
let currentSet = [];
let currentIndex = 0;
let score = 0;
let selectedChoiceIndexes = [];
let lastAnswer = null;
let questionsReady = false;
let lastSettings = { course: "F1・クルマ総合", mode: "all", count: 10, difficulty: "all", category: "", era: "" };

const $ = (id) => document.getElementById(id);

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
      attempts: 0, correct: 0, wrongIds: [], favoriteIds: [], recentIds: [], recentTopicKeys: []
    };
  } catch {
    return { attempts: 0, correct: 0, wrongIds: [], favoriteIds: [], recentIds: [], recentTopicKeys: [] };
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadQuestions() {
  try {
    const response = await fetch("questions.json", { cache: "no-store" });
    if (!response.ok) throw new Error("questions.jsonを読み込めませんでした");
    allQuestions = normalizeQuestions(await response.json());
  } catch (error) {
    allQuestions = normalizeQuestions(window.GPQ_QUESTIONS || []);
    console.warn("questions.jsonのfetchに失敗。埋め込みデータを使用します。", error);
  }
  questionsReady = true;
  fillSelects();
  updateCourseInfo();
  renderStats();
}


function normalizeQuestions(items) {
  return (items || []).map((q, index) => ({
    ...q,
    id: q.id || `gpq_auto_${index}`,
    choices: Array.isArray(q.choices) ? q.choices : [],
    tags: Array.isArray(q.tags) ? q.tags : []
  }));
}


function getCourseQuestions() {
  return allQuestions.filter(q => (q.questionSet || "F1・クルマ総合") === currentCourse);
}

function updateCourseInfo() {
  const courseQuestions = getCourseQuestions();
  const total = allQuestions.length;
  const current = courseQuestions.length;
  const info = $("courseInfo");
  if (info) {
    info.textContent = `選択中コース：${currentCourse} / ${current.toLocaleString()}問（全体 ${total.toLocaleString()}問）`;
  }
  $("totalQuestions").textContent = current.toLocaleString();
}

function selectCourse(courseName) {
  currentCourse = courseName;
  document.querySelectorAll(".course-button").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.course === courseName);
  });
  fillSelects();
  updateCourseInfo();
}

function fillSelects() {
  const courseQuestions = getCourseQuestions();
  const categories = [...new Set(courseQuestions.map(q => q.category))].sort();
  const eras = [...new Set(courseQuestions.map(q => q.era).filter(Boolean))].sort();

  $("categorySelect").innerHTML = categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  $("eraSelect").innerHTML = eras.map(e => `<option value="${escapeHtml(e)}">${escapeHtml(e)}</option>`).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectMode(mode) {
  currentMode = mode;
  document.querySelectorAll(".course-button").forEach(btn => {
  btn.addEventListener("click", () => {
    selectCourse(btn.dataset.course);
  });
});

document.querySelectorAll(".menu-button").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.mode === mode);
  });
}

function modeLabel(mode = currentMode) {
  const category = $("categorySelect")?.value || "";
  const era = $("eraSelect")?.value || "";
  const labels = {
    all: "総合クイズ",
    category: category ? `カテゴリー別：${category}` : "カテゴリー別",
    era: era ? `年代別：${era}` : "年代別",
    hard: "超難問",
    wrong: "間違えた問題を復習",
    favorite: "お気に入り問題"
  };
  return `${currentCourse} / ${labels[mode] || "総合クイズ"}`;
}

function updateModeTitles() {
  const label = modeLabel();
  ["quizModeTitle", "detailModeTitle", "resultModeTitle"].forEach(id => {
    const el = $(id);
    if (el) el.textContent = label;
  });
}

function getAnswerIndexes(q) {
  const raw = Array.isArray(q.answers) ? q.answers : q.answer;
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map(Number).filter(n => Number.isInteger(n));
}

function isMultiAnswerQuestion(q) {
  return getAnswerIndexes(q).length >= 2 || q.multiAnswer === true || q.multi_answer === true;
}

function arraysSameNumbers(a, b) {
  const x = [...new Set(a.map(Number))].sort((m, n) => m - n);
  const y = [...new Set(b.map(Number))].sort((m, n) => m - n);
  return x.length === y.length && x.every((value, index) => value === y[index]);
}

function formatAnswerText(q, indexes) {
  return indexes
    .map(index => `${index + 1}. ${q.choices[index] ?? ""}`)
    .join(" / ");
}

function topicKeyForQuestion(q) {
  if (q.topicKey) return q.topicKey;

  let text = String(q.question || "");
  text = text.replace(/^(基礎理解|観戦ポイント|専門用語|初心者向け|実践理解|誤解防止|安全面|戦略面|技術面|仕組み|役割|注意点|メリット|弱点|使われ方|比較問題|判断問題|整備目線|ドライバー目線|チーム目線|メカニック目線|観客目線|歴史目線|現代目線|上級確認\d+|知識確認\d+|難問確認\d+|復習確認\d+|応用確認\d+|理解度確認\d+|補足確認\d+)：/, "");
  text = text.replace(/（追加確認\d+）$/, "");

  const termMatch = text.match(/[「『](.+?)[」』]/);
  if (termMatch) return `${q.category}|term|${termMatch[1]}`;

  const yearMatch = text.match(/(\d{4})年/);
  if (yearMatch && /王者|チャンピオン/.test(text)) {
    return `${q.category}|year|${yearMatch[1]}|title`;
  }

  return `${q.category}|${q.era || "all"}|${text.slice(0, 60)}`;
}

function groupKeyForQuestion(q) {
  if (currentMode === "category") return `${q.era || "all"}|${q.difficulty}`;
  if (currentMode === "era") return `${q.category}|${q.difficulty}`;
  if (currentMode === "hard") return `${q.category}|${q.era || "all"}`;
  return `${q.category}|${q.era || "all"}|${q.difficulty}`;
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqueTopicCount(items) {
  return new Set(items.map(q => topicKeyForQuestion(q))).size;
}

function balancedSample(pool, count) {
  const state = loadState();
  const recentIds = Array.isArray(state.recentIds) ? state.recentIds : [];
  const recentTopicKeys = Array.isArray(state.recentTopicKeys) ? state.recentTopicKeys : [];

  let uniquePool = uniqueById(pool);
  const target = Math.min(count, uniquePool.length);

  const noRecentIdPool = uniquePool.filter(q => !recentIds.includes(q.id));
  if (noRecentIdPool.length >= target) uniquePool = noRecentIdPool;

  const topicCapacity = uniqueTopicCount(uniquePool);
  const noRecentTopicPool = uniquePool.filter(q => !recentTopicKeys.includes(topicKeyForQuestion(q)));
  if (uniqueTopicCount(noRecentTopicPool) >= Math.min(target, topicCapacity)) {
    uniquePool = noRecentTopicPool;
  }

  const broadGroups = new Map();
  shuffle(uniquePool).forEach(q => {
    const key = groupKeyForQuestion(q);
    if (!broadGroups.has(key)) broadGroups.set(key, []);
    broadGroups.get(key).push(q);
  });

  let selected = [];
  const usedTopics = new Set();
  let groupEntries = shuffle([...broadGroups.entries()]);

  while (selected.length < target && groupEntries.length) {
    const nextRound = [];
    let addedThisRound = false;

    for (const [key, items] of groupEntries) {
      if (selected.length >= target) break;

      const chosenIndex = items.findIndex(q => !usedTopics.has(topicKeyForQuestion(q)));
      if (chosenIndex >= 0) {
        const [item] = items.splice(chosenIndex, 1);
        selected.push(item);
        usedTopics.add(topicKeyForQuestion(item));
        addedThisRound = true;
      }

      if (items.length) nextRound.push([key, items]);
    }

    if (!addedThisRound) break;
    groupEntries = shuffle(nextRound);
  }

  if (selected.length < target) {
    const selectedIds = new Set(selected.map(q => q.id));
    const rest = shuffle(uniquePool.filter(q => !selectedIds.has(q.id)));
    selected = selected.concat(rest.slice(0, target - selected.length));
  }

  return selected.slice(0, target);
}

function rememberPresentedQuestions(items) {
  const state = loadState();
  const previousIds = Array.isArray(state.recentIds) ? state.recentIds : [];
  const previousTopicKeys = Array.isArray(state.recentTopicKeys) ? state.recentTopicKeys : [];

  const mergedIds = [...items.map(q => q.id), ...previousIds];
  const mergedTopicKeys = [...items.map(q => topicKeyForQuestion(q)), ...previousTopicKeys];

  state.recentIds = [...new Set(mergedIds)].slice(0, 800);
  state.recentTopicKeys = [...new Set(mergedTopicKeys)].slice(0, 500);
  saveState(state);
}

function filterQuestions() {
  const count = Number($("countSelect").value);
  const difficulty = $("difficultySelect").value;
  const category = $("categorySelect").value;
  const era = $("eraSelect").value;
  const state = loadState();

  let pool = [...getCourseQuestions()];

  if (difficulty !== "all") {
    pool = pool.filter(q => String(q.difficulty) === difficulty);
  }

  if (currentMode === "category") {
    pool = pool.filter(q => q.category === category);
  } else if (currentMode === "era") {
    pool = pool.filter(q => q.era === era);
  } else if (currentMode === "hard") {
    pool = pool.filter(q => Number(q.difficulty) >= 4 || q.category === "超難問");
  } else if (currentMode === "wrong") {
    pool = pool.filter(q => state.wrongIds.includes(q.id));
  } else if (currentMode === "favorite") {
    pool = pool.filter(q => state.favoriteIds.includes(q.id));
  }

  lastSettings = { course: currentCourse, mode: currentMode, count, difficulty, category, era };
  const selected = balancedSample(pool, Math.min(count, pool.length));
  rememberPresentedQuestions(selected);
  return selected;
}

function startQuiz() {
  if (!questionsReady || !getCourseQuestions().length) {
    alert("問題データを読み込み中です。少し待ってからもう一度押してください。");
    return;
  }

  currentSet = filterQuestions();
  if (currentSet.length === 0) {
    alert("この条件に合う問題がありません。条件を変えてください。");
    return;
  }
  currentIndex = 0;
  score = 0;
  lastAnswer = null;
  showScreen("quiz");
  renderQuestion();
}

function showScreen(name) {
  Object.values(screens).forEach(el => el.classList.remove("active"));
  screens[name].classList.add("active");
  const shell = $("appShell");
  if (shell) shell.classList.toggle("quiz-active", name !== "home");
  updateModeTitles();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function difficultyLabel(n) {
  const labels = { 1: "入門", 2: "標準", 3: "マニア", 4: "超難問", 5: "鬼ムズ" };
  return labels[n] || `Lv.${n}`;
}

function renderQuestion() {
  const q = currentSet[currentIndex];
  selectedChoiceIndexes = [];
  const multiAnswer = isMultiAnswerQuestion(q);

  $("progressText").textContent = `${currentIndex + 1} / ${currentSet.length}`;
  $("progressBar").style.width = `${(currentIndex / currentSet.length) * 100}%`;
  $("categoryBadge").textContent = q.category;
  $("difficultyBadge").textContent = difficultyLabel(q.difficulty);
  $("multiAnswerBadge").classList.toggle("hidden", !multiAnswer);
  $("questionText").textContent = q.question;
  $("answerButton").textContent = multiAnswer ? "選択した回答で回答する" : "回答する";
  $("answerButton").disabled = true;
  updateModeTitles();

  const state = loadState();
  $("favoriteButton").textContent = state.favoriteIds.includes(q.id) ? "★" : "☆";

  $("choices").innerHTML = q.choices.map((choice, index) => {
    return `<button class="choice" data-index="${index}">${index + 1}. ${escapeHtml(choice)}</button>`;
  }).join("");

  document.querySelectorAll(".choice").forEach(btn => {
    btn.addEventListener("click", () => selectChoice(Number(btn.dataset.index)));
  });
}

function selectChoice(index) {
  const q = currentSet[currentIndex];
  if (isMultiAnswerQuestion(q)) {
    if (selectedChoiceIndexes.includes(index)) {
      selectedChoiceIndexes = selectedChoiceIndexes.filter(value => value !== index);
    } else {
      selectedChoiceIndexes.push(index);
    }
  } else {
    selectedChoiceIndexes = [index];
  }

  document.querySelectorAll(".choice").forEach(btn => {
    btn.classList.toggle("selected", selectedChoiceIndexes.includes(Number(btn.dataset.index)));
  });
  $("answerButton").disabled = selectedChoiceIndexes.length === 0;
}

function submitAnswer() {
  if (!selectedChoiceIndexes.length) {
    alert("先に選択肢を選んでください。");
    return;
  }

  const q = currentSet[currentIndex];
  const correctIndexes = getAnswerIndexes(q);
  const isCorrect = arraysSameNumbers(selectedChoiceIndexes, correctIndexes);
  const state = loadState();

  state.attempts += 1;
  if (isCorrect) {
    score += 1;
    state.correct += 1;
    state.wrongIds = state.wrongIds.filter(id => id !== q.id);
  } else if (!state.wrongIds.includes(q.id)) {
    state.wrongIds.push(q.id);
  }
  saveState(state);

  lastAnswer = {
    question: q,
    selectedIndexes: [...selectedChoiceIndexes],
    correctIndexes,
    isCorrect
  };

  $("answerButton").disabled = true;
  playFeedbackSound(isCorrect);
  showJudgeOverlay(isCorrect);
  renderStats();

  window.setTimeout(() => {
    hideJudgeOverlay();
    renderDetail();
  }, 820);
}

function showJudgeOverlay(isCorrect) {
  const overlay = $("judgeOverlay");
  overlay.className = `judge-overlay ${isCorrect ? "good" : "bad"}`;
  $("judgeMark").textContent = isCorrect ? "○" : "✖︎";
  $("judgeText").textContent = isCorrect ? "正解！" : "不正解";
}

function hideJudgeOverlay() {
  $("judgeOverlay").className = "judge-overlay hidden";
}

function playFeedbackSound(isCorrect) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (isCorrect ? 0.42 : 0.5));

    if (isCorrect) {
      playTone(ctx, gain, 880, 0, 0.13, "sine");
      playTone(ctx, gain, 1320, 0.13, 0.18, "sine");
    } else {
      playTone(ctx, gain, 170, 0, 0.18, "sawtooth");
      playTone(ctx, gain, 120, 0.18, 0.22, "sawtooth");
    }

    window.setTimeout(() => ctx.close(), 800);
  } catch (error) {
    console.warn("効果音を再生できませんでした。", error);
  }
}

function playTone(ctx, gain, frequency, startOffset, duration, type) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + startOffset);
  osc.connect(gain);
  osc.start(ctx.currentTime + startOffset);
  osc.stop(ctx.currentTime + startOffset + duration);
}

function renderDetail() {
  if (!lastAnswer) return;
  const { question: q, selectedIndexes, correctIndexes, isCorrect } = lastAnswer;
  const multiAnswer = isMultiAnswerQuestion(q);

  $("detailProgressText").textContent = `${currentIndex + 1} / ${currentSet.length}`;
  $("detailStatus").textContent = isCorrect ? "正解！" : "不正解";
  $("detailStatus").className = `detail-status ${isCorrect ? "good" : "bad"}`;
  $("detailQuestion").textContent = `${multiAnswer ? "【複数回答あり】" : ""}${q.question}`;
  $("detailSelectedAnswer").textContent = formatAnswerText(q, selectedIndexes);
  $("detailCorrectAnswer").textContent = formatAnswerText(q, correctIndexes);
  $("detailExplanation").textContent = q.explanation || "解説は未登録です。";

  showScreen("detail");
}

function nextQuestion() {
  currentIndex += 1;
  if (currentIndex >= currentSet.length) {
    showResult();
  } else {
    showScreen("quiz");
    renderQuestion();
  }
}

function showResult() {
  $("progressBar").style.width = "100%";
  showScreen("result");
  const rate = Math.round((score / currentSet.length) * 100);
  const rank = rankFor(rate);
  $("scoreText").textContent = `${score} / ${currentSet.length}`;
  $("rankText").textContent = `今回の正答率 ${rate}%`;
  $("sessionRankBadge").textContent = `今回のランク：${rank}`;
}

function rankFor(rate) {
  if (rate >= 98) return "F1百科事典";
  if (rate >= 90) return "ワールドチャンピオン";
  if (rate >= 75) return "表彰台常連";
  if (rate >= 60) return "ポイント圏内";
  if (rate >= 40) return "テストドライバー";
  return "ルーキー";
}

function renderStats() {
  const state = loadState();
  const rate = state.attempts ? Math.round((state.correct / state.attempts) * 100) : 0;
  const rank = rankFor(rate);
  $("statsBox").innerHTML = `
    <div class="stats-rank">現在のユーザーランク<strong>${rank}</strong>通算正答率 ${rate}%</div>
    <div>通算回答数：<strong>${state.attempts}</strong></div>
    <div>通算正解数：<strong>${state.correct}</strong></div>
    <div>復習対象：<strong>${state.wrongIds.length}</strong>問</div>
    <div>お気に入り：<strong>${state.favoriteIds.length}</strong>問</div>
    <div>選択中コース：<strong>${escapeHtml(currentCourse)}</strong></div>
    <div>出題分散：<strong>ON</strong> / 直近出題の再出題を抑制</div>
  `;
}

function toggleFavorite() {
  const q = currentSet[currentIndex];
  const state = loadState();
  if (state.favoriteIds.includes(q.id)) {
    state.favoriteIds = state.favoriteIds.filter(id => id !== q.id);
  } else {
    state.favoriteIds.push(q.id);
  }
  saveState(state);
  $("favoriteButton").textContent = state.favoriteIds.includes(q.id) ? "★" : "☆";
  renderStats();
}

function resetStats() {
  if (!confirm("成績・復習リスト・お気に入りをリセットしますか？")) return;
  localStorage.removeItem(STORAGE_KEY);
  renderStats();
}

document.querySelectorAll(".course-button").forEach(btn => {
  btn.addEventListener("click", () => {
    selectCourse(btn.dataset.course);
  });
});

document.querySelectorAll(".menu-button").forEach(btn => {
  btn.addEventListener("click", () => {
    selectMode(btn.dataset.mode);
    startQuiz();
  });
});

$("startButton").addEventListener("click", startQuiz);
$("answerButton").addEventListener("click", submitAnswer);
$("nextButton").addEventListener("click", nextQuestion);
$("backHomeButton").addEventListener("click", () => showScreen("home"));
$("detailHomeButton").addEventListener("click", () => showScreen("home"));
$("toHomeButton").addEventListener("click", () => showScreen("home"));
$("retryButton").addEventListener("click", () => {
  selectCourse(lastSettings.course || "F1・クルマ総合");
  currentMode = lastSettings.mode;
  $("countSelect").value = String(lastSettings.count);
  $("difficultySelect").value = lastSettings.difficulty;
  selectMode(currentMode);
  if (lastSettings.category) $("categorySelect").value = lastSettings.category;
  if (lastSettings.era) $("eraSelect").value = lastSettings.era;
  startQuiz();
});
$("favoriteButton").addEventListener("click", toggleFavorite);
$("resetStatsButton").addEventListener("click", resetStats);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(console.warn);
  });
}

selectMode("all");
loadQuestions();
