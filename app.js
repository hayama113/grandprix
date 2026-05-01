const STORAGE_KEY = "grand_prix_quiz_v1";
const screens = {
  home: document.getElementById("homeScreen"),
  quiz: document.getElementById("quizScreen"),
  detail: document.getElementById("detailScreen"),
  result: document.getElementById("resultScreen")
};

let allQuestions = [];
let currentMode = "all";
let currentSet = [];
let currentIndex = 0;
let score = 0;
let selectedChoiceIndex = null;
let lastAnswer = null;
let questionsReady = false;
let lastSettings = { mode: "all", count: 10, difficulty: "all", category: "", era: "" };

const $ = (id) => document.getElementById(id);

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
      attempts: 0, correct: 0, wrongIds: [], favoriteIds: []
    };
  } catch {
    return { attempts: 0, correct: 0, wrongIds: [], favoriteIds: [] };
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
    allQuestions = await response.json();
  } catch (error) {
    allQuestions = window.GPQ_QUESTIONS || [];
    console.warn("questions.jsonのfetchに失敗。埋め込みデータを使用します。", error);
  }
  questionsReady = true;
  $("totalQuestions").textContent = allQuestions.length.toLocaleString();
  fillSelects();
  renderStats();
}

function fillSelects() {
  const categories = [...new Set(allQuestions.map(q => q.category))].sort();
  const eras = [...new Set(allQuestions.map(q => q.era).filter(Boolean))].sort();

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
  document.querySelectorAll(".menu-button").forEach(btn => {
    btn.classList.toggle("selected", btn.dataset.mode === mode);
  });
}

function filterQuestions() {
  const count = Number($("countSelect").value);
  const difficulty = $("difficultySelect").value;
  const category = $("categorySelect").value;
  const era = $("eraSelect").value;
  const state = loadState();

  let pool = [...allQuestions];

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

  lastSettings = { mode: currentMode, count, difficulty, category, era };
  return shuffle(pool).slice(0, Math.min(count, pool.length));
}

function startQuiz() {
  if (!questionsReady || !allQuestions.length) {
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
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function difficultyLabel(n) {
  const labels = { 1: "入門", 2: "標準", 3: "マニア", 4: "超難問", 5: "鬼ムズ" };
  return labels[n] || `Lv.${n}`;
}

function renderQuestion() {
  const q = currentSet[currentIndex];
  selectedChoiceIndex = null;

  $("progressText").textContent = `${currentIndex + 1} / ${currentSet.length}`;
  $("progressBar").style.width = `${(currentIndex / currentSet.length) * 100}%`;
  $("categoryBadge").textContent = q.category;
  $("difficultyBadge").textContent = difficultyLabel(q.difficulty);
  $("questionText").textContent = q.question;
  $("answerButton").disabled = true;

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
  selectedChoiceIndex = index;
  document.querySelectorAll(".choice").forEach(btn => {
    btn.classList.toggle("selected", Number(btn.dataset.index) === index);
  });
  $("answerButton").disabled = false;
}

function submitAnswer() {
  if (selectedChoiceIndex === null) {
    alert("先に選択肢を選んでください。");
    return;
  }

  const q = currentSet[currentIndex];
  const isCorrect = selectedChoiceIndex === q.answer;
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
    selectedIndex: selectedChoiceIndex,
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
  const { question: q, selectedIndex, isCorrect } = lastAnswer;

  $("detailProgressText").textContent = `${currentIndex + 1} / ${currentSet.length}`;
  $("detailStatus").textContent = isCorrect ? "正解！" : "不正解";
  $("detailStatus").className = `detail-status ${isCorrect ? "good" : "bad"}`;
  $("detailQuestion").textContent = q.question;
  $("detailSelectedAnswer").textContent = `${selectedIndex + 1}. ${q.choices[selectedIndex]}`;
  $("detailCorrectAnswer").textContent = `${q.answer + 1}. ${q.choices[q.answer]}`;
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
