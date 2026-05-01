const STORAGE_KEY = "grand_prix_quiz_v1";
const screens = {
  home: document.getElementById("homeScreen"),
  quiz: document.getElementById("quizScreen"),
  result: document.getElementById("resultScreen")
};

let allQuestions = [];
let currentMode = "all";
let currentSet = [];
let currentIndex = 0;
let score = 0;
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
  $("categoryWrap").classList.toggle("hidden", mode !== "category");
  $("eraWrap").classList.toggle("hidden", mode !== "era");
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
  currentSet = filterQuestions();
  if (currentSet.length === 0) {
    alert("この条件に合う問題がありません。条件を変えてください。");
    return;
  }
  currentIndex = 0;
  score = 0;
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
  $("progressText").textContent = `${currentIndex + 1} / ${currentSet.length}`;
  $("progressBar").style.width = `${(currentIndex / currentSet.length) * 100}%`;
  $("categoryBadge").textContent = q.category;
  $("difficultyBadge").textContent = difficultyLabel(q.difficulty);
  $("questionText").textContent = q.question;
  $("resultBox").className = "result-box hidden";
  $("resultBox").textContent = "";
  $("nextButton").classList.add("hidden");

  const state = loadState();
  $("favoriteButton").textContent = state.favoriteIds.includes(q.id) ? "★" : "☆";

  $("choices").innerHTML = q.choices.map((choice, index) => {
    return `<button class="choice" data-index="${index}">${index + 1}. ${escapeHtml(choice)}</button>`;
  }).join("");

  document.querySelectorAll(".choice").forEach(btn => {
    btn.addEventListener("click", () => answerQuestion(Number(btn.dataset.index)));
  });
}

function answerQuestion(selectedIndex) {
  const q = currentSet[currentIndex];
  const isCorrect = selectedIndex === q.answer;
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

  document.querySelectorAll(".choice").forEach(btn => {
    const idx = Number(btn.dataset.index);
    btn.disabled = true;
    if (idx === q.answer) btn.classList.add("correct");
    if (idx === selectedIndex && !isCorrect) btn.classList.add("wrong");
  });

  const resultBox = $("resultBox");
  resultBox.className = `result-box ${isCorrect ? "good" : "bad"}`;
  resultBox.innerHTML = `
    <strong>${isCorrect ? "正解！" : "不正解"}</strong><br>
    正解：${q.answer + 1}. ${escapeHtml(q.choices[q.answer])}<br>
    ${escapeHtml(q.explanation || "")}
  `;
  $("nextButton").classList.remove("hidden");
  renderStats();
}

function nextQuestion() {
  currentIndex += 1;
  if (currentIndex >= currentSet.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

function showResult() {
  $("progressBar").style.width = "100%";
  showScreen("result");
  const rate = Math.round((score / currentSet.length) * 100);
  $("scoreText").textContent = `${score} / ${currentSet.length}`;
  $("rankText").textContent = `正答率 ${rate}%：${rankFor(rate)}`;
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
  $("statsBox").innerHTML = `
    <div>通算回答数：<strong>${state.attempts}</strong></div>
    <div>通算正解数：<strong>${state.correct}</strong></div>
    <div>通算正答率：<strong>${rate}%</strong></div>
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
  btn.addEventListener("click", () => selectMode(btn.dataset.mode));
});

$("startButton").addEventListener("click", startQuiz);
$("nextButton").addEventListener("click", nextQuestion);
$("backHomeButton").addEventListener("click", () => showScreen("home"));
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
