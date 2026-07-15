const STORAGE_KEY = "lock-in-local-records-v1";
const CUSTOM_SKILLS_KEY = "lock-in-custom-skills-v1";
const DAILY_SONGS_KEY = "lock-in-daily-songs-v1";
const CUSTOM_SKILL_ICON = "✣";
const CUSTOM_SKILL_LIMIT = 20;
const DEFAULT_ALBUM_COVER = "./default-album-cover.webp";
const NETEASE_LOOKUP_ENDPOINT = "https://api.injahow.cn/meting/?server=netease&type=song&id=";
const SKILLS = [
  { name: "Lock", icon: "L!" },
  { name: "Point", icon: "→" },
  { name: "Wrist Roll", icon: "↻" },
  { name: "Scooby Doo", icon: "S" },
  { name: "Stop & Go", icon: "▮▶" },
  { name: "Groove", icon: "≈" },
  { name: "Freestyle", icon: "✦" },
];
const ENERGY_LEVELS = [
  { label: "轻松热身", short: "轻", symbol: "○" },
  { label: "有点慢热", short: "热", symbol: "◔" },
  { label: "稳稳在线", short: "稳", symbol: "◑" },
  { label: "状态很棒", short: "燃", symbol: "◕" },
  { label: "全场最佳", short: "炸", symbol: "●" },
];
const ALL_FILTER = "__all__";

const dateInput = document.querySelector("#practiceDate");
const durationInput = document.querySelector("#duration");
const noteInput = document.querySelector("#note");
const songTitleInput = document.querySelector("#songTitle");
const songArtistInput = document.querySelector("#songArtist");
const songBpmInput = document.querySelector("#songBpm");
const songUrlInput = document.querySelector("#songUrl");
const songLinkState = document.querySelector("#songLinkState");
const songPreview = document.querySelector("#songPreview");
const songCover = document.querySelector("#songCover");
const songPreviewTitle = document.querySelector("#songPreviewTitle");
const songPreviewArtist = document.querySelector("#songPreviewArtist");
const songLookupStatus = document.querySelector("#songLookupStatus");
const heroAlbumStage = document.querySelector("#heroAlbumStage");
const heroAlbumCover = document.querySelector("#heroAlbumCover");
const form = document.querySelector("#practiceForm");
const skillPicker = document.querySelector("#skillPicker");
const energyPicker = document.querySelector("#energyPicker");
const energyLabel = document.querySelector("#energyLabel");
const historyList = document.querySelector("#historyList");
const filterRow = document.querySelector("#filterRow");
const formMessage = document.querySelector("#formMessage");
const calendarGrid = document.querySelector("#calendarGrid");
const calendarDetail = document.querySelector("#calendarDetail");
const editBadge = document.querySelector("#editBadge");
const cancelEditButton = document.querySelector("#cancelEdit");
const saveButton = document.querySelector("#saveButton");
const installButton = document.querySelector("#installButton");
const installDialog = document.querySelector("#installHelpDialog");
const customSkillDialog = document.querySelector("#customSkillDialog");
const customSkillForm = document.querySelector("#customSkillForm");
const customSkillInput = document.querySelector("#customSkillName");
const customSkillList = document.querySelector("#customSkillList");
const customSkillMessage = document.querySelector("#customSkillMessage");
const toast = document.querySelector("#toast");

let customSkills = loadCustomSkills();
let records = loadRecords();
let dailySongs = loadDailySongs();
let selectedSkills = new Set(["Lock", "Groove"]);
let selectedEnergy = 4;
let activeFilter = ALL_FILTER;
let selectedCalendarDate = localDate();
let calendarCursor = monthStart(new Date());
let editingId = null;
let justStampedDate = null;
let deferredInstallPrompt = null;
let toastTimer = null;
let todayLiveContext = null;
let calendarDropTimeline = null;
let songUiContext = null;
let currentSongCover = DEFAULT_ALBUM_COVER;
let currentSongId = "";
let songLookupTimer = null;
let songLookupToken = 0;

dateInput.value = localDate();

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function dateFromIso(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function monthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord).map(normalizeRecord).sort(sortRecords);
  } catch {
    return [];
  }
}

function cleanSkillName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 24);
}

function loadCustomSkills() {
  try {
    const parsed = JSON.parse(localStorage.getItem(CUSTOM_SKILLS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    const baseNames = new Set(SKILLS.map((skill) => skill.name.toLocaleLowerCase()));
    return [...new Set(parsed
      .filter((name) => typeof name === "string")
      .map(cleanSkillName)
      .filter((name) => name && !baseNames.has(name.toLocaleLowerCase())))]
      .slice(0, CUSTOM_SKILL_LIMIT);
  } catch {
    return [];
  }
}

function saveCustomSkills() {
  localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(customSkills));
}

function normalizeBpm(value) {
  const bpm = Number(value);
  return Number.isInteger(bpm) && bpm >= 40 && bpm <= 240 ? bpm : null;
}

function normalizeCoverUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || /(?:^|\/)default-album-cover\.webp(?:[?#]|$)/i.test(raw)) return DEFAULT_ALBUM_COVER;
  if (raw.startsWith("//")) return `https:${raw}`;
  try {
    const url = new URL(raw, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : DEFAULT_ALBUM_COVER;
  } catch {
    return DEFAULT_ALBUM_COVER;
  }
}

function normalizeDailySong(song, date) {
  if (!song || typeof song !== "object") return null;
  const title = typeof song.title === "string" ? song.title.trim().slice(0, 100) : "";
  const artist = typeof song.artist === "string" ? song.artist.trim().slice(0, 120) : "";
  const url = normalizeNeteaseUrl(song.url || "");
  if (!title && !artist && !url) return null;
  return {
    date,
    id: /^\d+$/.test(String(song.id || "")) ? String(song.id) : extractNeteaseSongId(url),
    title: title || "未识别歌名",
    artist: artist || "未知歌手",
    coverUrl: normalizeCoverUrl(song.coverUrl),
    url,
    bpm: normalizeBpm(song.bpm),
    updatedAt: typeof song.updatedAt === "string" ? song.updatedAt : new Date().toISOString(),
  };
}

function loadDailySongs() {
  const normalized = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(DAILY_SONGS_KEY) || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      Object.entries(parsed).forEach(([date, song]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const item = normalizeDailySong(song, date);
        if (item) normalized[date] = item;
      });
    }
  } catch {
    // Fall through to legacy-record migration.
  }

  records.forEach((record) => {
    if (normalized[record.date] || (!record.songTitle && !record.songUrl)) return;
    const migrated = normalizeDailySong({
      title: record.songTitle,
      artist: record.songArtist,
      coverUrl: record.songCoverUrl,
      url: record.songUrl,
      bpm: record.songBpm,
    }, record.date);
    if (migrated) normalized[record.date] = migrated;
  });
  localStorage.setItem(DAILY_SONGS_KEY, JSON.stringify(normalized));
  return normalized;
}

function saveDailySongs() {
  localStorage.setItem(DAILY_SONGS_KEY, JSON.stringify(dailySongs));
}

function dailySongFor(date) {
  return dailySongs[date] || null;
}

function syncLegacySongFields(date) {
  const song = dailySongFor(date);
  records = records.map((record) => record.date !== date ? record : {
    ...record,
    songTitle: song?.title || "",
    songArtist: song?.artist || "",
    songCoverUrl: song?.coverUrl || "",
    songUrl: song?.url || "",
    songBpm: song?.bpm || null,
  });
  saveRecords();
}

function isRecord(record) {
  return Boolean(
    record &&
    typeof record.id === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.date) &&
    Number.isInteger(record.minutes) &&
    record.minutes >= 5 &&
    record.minutes <= 480 &&
    Array.isArray(record.skills) &&
    record.skills.length > 0 &&
    record.skills.every((skill) => typeof skill === "string" && Boolean(skill.trim())) &&
    Number.isInteger(record.energy) &&
    record.energy >= 1 &&
    record.energy <= 5
  );
}

function normalizeRecord(record) {
  return {
    ...record,
    skills: [...new Set(record.skills.map(cleanSkillName).filter(Boolean))].slice(0, 30),
    note: typeof record.note === "string" ? record.note.slice(0, 300) : "",
    songTitle: typeof record.songTitle === "string" ? record.songTitle.slice(0, 100) : "",
    songArtist: typeof record.songArtist === "string" ? record.songArtist.slice(0, 120) : "",
    songCoverUrl: typeof record.songCoverUrl === "string" ? normalizeCoverUrl(record.songCoverUrl) : "",
    songUrl: normalizeNeteaseUrl(record.songUrl || ""),
    songBpm: normalizeBpm(record.songBpm),
  };
}

function sortRecords(a, b) {
  return `${b.date}-${b.createdAt || ""}`.localeCompare(`${a.date}-${a.createdAt || ""}`);
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function weekStart(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
  return result;
}

function formatMonth(date) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(date);
}

function formatDate(dateString, options = { month: "numeric", day: "numeric", weekday: "short" }) {
  return new Intl.DateTimeFormat("zh-CN", options).format(dateFromIso(dateString));
}

function shiftDate(dateString, days) {
  const date = dateFromIso(dateString);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function skillInfo(name) {
  const builtIn = SKILLS.find((skill) => skill.name === name);
  return builtIn ? { ...builtIn, custom: false } : { name, icon: CUSTOM_SKILL_ICON, custom: true };
}

function selectableSkills() {
  return [...SKILLS.map((skill) => ({ ...skill, custom: false })), ...customSkills.map((name) => skillInfo(name))];
}

function normalizeNeteaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/https?:\/\/[^\s，。；、]+/i);
  if (!match) return "";
  try {
    const url = new URL(match[0].replace(/[)\]}>]+$/, ""));
    const host = url.hostname.toLowerCase();
    const allowed = host === "music.163.com" || host.endsWith(".music.163.com") || host === "163cn.tv" || host.endsWith(".163cn.tv") || host === "163.fm" || host.endsWith(".163.fm");
    return allowed && ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function extractNeteaseSongId(value) {
  let text = String(value || "");
  for (let index = 0; index < 2; index += 1) {
    try { text = decodeURIComponent(text); } catch { break; }
  }
  if (!/song/i.test(text)) return "";
  return text.match(/[?&#]id=(\d{3,})/i)?.[1] || text.match(/\/song\/(\d{3,})/i)?.[1] || "";
}

async function fetchNeteaseSong(songId) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(`${NETEASE_LOOKUP_ENDPOINT}${encodeURIComponent(songId)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error("lookup-failed");
    const payload = await response.json();
    const song = Array.isArray(payload) ? payload[0] : null;
    if (!song?.name) throw new Error("song-not-found");
    return {
      id: String(songId),
      title: String(song.name).trim().slice(0, 100),
      artist: String(song.artist || "未知歌手").trim().slice(0, 120),
      coverUrl: normalizeCoverUrl(song.pic),
    };
  } finally {
    window.clearTimeout(timeout);
  }
}

async function resolveNeteaseSongId(value) {
  const directId = extractNeteaseSongId(value);
  if (directId) return directId;
  const normalized = normalizeNeteaseUrl(value);
  if (!normalized) return "";
  let host = "";
  try { host = new URL(normalized).hostname.toLowerCase(); } catch { return ""; }
  if (!host.endsWith("163cn.tv") && !host.endsWith("163.fm")) return "";

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://unshorten.me/json/${normalized}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) return "";
    const payload = await response.json();
    return payload?.success ? extractNeteaseSongId(payload.resolved_url || "") : "";
  } catch {
    return "";
  } finally {
    window.clearTimeout(timeout);
  }
}

function renderSongPreview(state = "auto", message = "") {
  const title = songTitleInput.value.trim();
  const artist = songArtistInput.value.trim();
  const hasSong = Boolean(title || artist || songUrlInput.value.trim());
  songPreviewTitle.textContent = title || "今天最喜欢";
  songPreviewArtist.textContent = artist || (hasSong ? "未知歌手" : "等待一首歌");
  delete songCover.dataset.fallbackApplied;
  songCover.src = currentSongCover || DEFAULT_ALBUM_COVER;
  songPreview.dataset.state = state === "auto" ? (hasSong ? "ready" : "empty") : state;
  songLookupStatus.textContent = message || (hasSong ? "★ 今日唯一一首" : "↗ 粘贴网易云链接");
  window.requestAnimationFrame(refreshSongMotions);
}

function loadSongIntoForm(date) {
  const song = dailySongFor(date);
  songTitleInput.value = song?.title || "";
  songArtistInput.value = song?.artist || "";
  songUrlInput.value = song?.url || "";
  songBpmInput.value = song?.bpm || "";
  currentSongCover = song?.coverUrl || DEFAULT_ALBUM_COVER;
  currentSongId = song?.id || extractNeteaseSongId(song?.url || "");
  updateSongLinkState();
  renderSongPreview(song ? "ready" : "empty", song ? "★ 今日唯一一首" : "↗ 粘贴网易云链接");
}

async function recognizeSongLink() {
  const token = ++songLookupToken;
  const raw = songUrlInput.value.trim();
  const normalized = normalizeNeteaseUrl(raw);
  if (!raw) {
    currentSongId = "";
    currentSongCover = DEFAULT_ALBUM_COVER;
    renderSongPreview("empty", "↗ 粘贴网易云链接");
    return null;
  }
  if (!normalized) {
    renderSongPreview("error", "! 仅支持网易云歌曲链接");
    return null;
  }
  renderSongPreview("loading", extractNeteaseSongId(normalized) ? "… 正在识别" : "… 正在解析短链接");
  try {
    const songId = await resolveNeteaseSongId(normalized);
    if (token !== songLookupToken) return null;
    if (!songId) throw new Error("song-id-not-found");
    const song = await fetchNeteaseSong(songId);
    if (token !== songLookupToken) return null;
    currentSongId = song.id;
    currentSongCover = song.coverUrl || DEFAULT_ALBUM_COVER;
    songTitleInput.value = song.title;
    songArtistInput.value = song.artist;
    songUrlInput.value = normalized;
    updateSongLinkState();
    renderSongPreview("ready", "✓ 已识别 · 今日唯一一首");
    return song;
  } catch {
    if (token !== songLookupToken) return null;
    currentSongId = extractNeteaseSongId(normalized);
    currentSongCover = DEFAULT_ALBUM_COVER;
    renderSongPreview("error", "! 未识别，可手动补充或换完整链接");
    return null;
  }
}

function scheduleSongLookup() {
  window.clearTimeout(songLookupTimer);
  updateSongLinkState();
  const raw = songUrlInput.value.trim();
  if (!raw) {
    songLookupToken += 1;
    currentSongId = "";
    currentSongCover = DEFAULT_ALBUM_COVER;
    songTitleInput.value = "";
    songArtistInput.value = "";
    renderSongPreview("empty", "↗ 粘贴网易云链接");
    return;
  }
  currentSongId = "";
  currentSongCover = DEFAULT_ALBUM_COVER;
  songTitleInput.value = "";
  songArtistInput.value = "";
  renderSongPreview(normalizeNeteaseUrl(raw) ? "loading" : "error", normalizeNeteaseUrl(raw) ? "… 准备识别" : "! 仅支持网易云链接");
  songLookupTimer = window.setTimeout(recognizeSongLink, 420);
}

function buildDailySongFromForm(date) {
  const title = songTitleInput.value.trim();
  const artist = songArtistInput.value.trim();
  const url = normalizeNeteaseUrl(songUrlInput.value);
  if (!title && !artist && !url) return null;
  return normalizeDailySong({
    id: currentSongId || extractNeteaseSongId(url),
    title,
    artist,
    coverUrl: currentSongCover,
    url,
    bpm: songBpmInput.value,
    updatedAt: new Date().toISOString(),
  }, date);
}

function updateSongLinkState() {
  const raw = songUrlInput.value.trim();
  const parsed = normalizeNeteaseUrl(raw);
  songUrlInput.classList.toggle("invalid", Boolean(raw && !parsed));
  songLinkState.textContent = raw ? (parsed ? "✓" : "!") : "";
  songLinkState.classList.toggle("valid", Boolean(parsed));
}

function renderSkillPicker() {
  skillPicker.innerHTML = `${selectableSkills().map((skill) => `
    <button class="skill-chip${skill.custom ? " custom" : ""}${selectedSkills.has(skill.name) ? " active" : ""}" type="button" data-skill="${escapeHtml(skill.name)}" aria-pressed="${selectedSkills.has(skill.name)}" title="${escapeHtml(skill.name)}">
      <b aria-hidden="true">${escapeHtml(skill.icon)}</b><small>${escapeHtml(skill.name)}</small>
    </button>
  `).join("")}
    <button class="skill-chip add-custom" type="button" data-action="add-custom" aria-label="添加自定义元素" title="添加自定义元素">
      <b aria-hidden="true">＋</b><small>自定义</small>
    </button>`;
}

function renderCustomSkillList() {
  customSkillList.innerHTML = customSkills.length ? customSkills.map((name) => `
    <div class="custom-skill-row">
      <span class="custom-symbol" aria-hidden="true">${CUSTOM_SKILL_ICON}</span>
      <strong>${escapeHtml(name)}</strong>
      <button type="button" data-remove-custom="${escapeHtml(name)}" aria-label="移除 ${escapeHtml(name)}" title="移除">×</button>
    </div>
  `).join("") : '<p class="custom-skill-empty">＋ 还没有自定义元素</p>';
}

function renderEnergyPicker() {
  const current = ENERGY_LEVELS[selectedEnergy - 1];
  energyLabel.textContent = `${current.symbol} ${current.short}`;
  energyPicker.innerHTML = ENERGY_LEVELS.map((level, index) => {
    const value = index + 1;
    return `<button class="energy-button${selectedEnergy === value ? " active" : ""}" type="button" data-energy="${value}" aria-label="状态 ${value} 分：${level.label}" aria-pressed="${selectedEnergy === value}" title="${level.label}">${level.symbol}</button>`;
  }).join("");
}

function renderHeroSong() {
  const song = dailySongFor(localDate());
  heroAlbumStage.classList.toggle("has-song", Boolean(song));
  delete heroAlbumCover.dataset.fallbackApplied;
  heroAlbumCover.src = song?.coverUrl || DEFAULT_ALBUM_COVER;
  heroAlbumStage.title = song ? `${song.title} · ${song.artist}` : "";
}

function songCardMarkup(song, date, variant) {
  if (!song) return "";
  const isLive = date === localDate();
  const tag = song.url ? "a" : "div";
  const attributes = song.url ? ` href="${escapeHtml(song.url)}" target="_blank" rel="noopener" aria-label="在网易云打开 ${escapeHtml(song.title)}"` : "";
  return `
    <${tag} class="song-card ${variant}${isLive ? " live-song" : ""}"${attributes}>
      <div class="album-motion">
        <span class="album-notes" aria-hidden="true"><i>♪</i><i>♫</i><i>♩</i></span>
        <div class="song-album"><img data-album-cover src="${escapeHtml(song.coverUrl || DEFAULT_ALBUM_COVER)}" alt="" /><span aria-hidden="true">♫</span></div>
      </div>
      <div class="song-card-copy">
        <div class="marquee-line song-card-title"><span data-marquee>${escapeHtml(song.title)}</span></div>
        <div class="marquee-line song-card-artist"><span data-marquee>${escapeHtml(song.artist)}</span></div>
      </div>
      ${song.bpm ? `<small>${song.bpm}<b>BPM</b></small>` : ""}
      ${song.url ? '<i class="song-open" aria-hidden="true">↗</i>' : ""}
    </${tag}>
  `;
}

function renderStats() {
  const start = weekStart();
  const weekly = records.filter((record) => dateFromIso(record.date) >= start);
  const minutes = weekly.reduce((total, record) => total + record.minutes, 0);
  const days = new Set(weekly.map((record) => record.date)).size;
  const average = weekly.length ? (weekly.reduce((total, record) => total + record.energy, 0) / weekly.length).toFixed(1) : "—";
  const values = [
    [document.querySelector("#minutesStat"), String(minutes)],
    [document.querySelector("#daysStat"), String(days)],
    [document.querySelector("#energyStat"), average],
    [document.querySelector("#streakStat"), String(currentStreak())],
  ];
  const changed = values.filter(([element, value]) => element.textContent !== value).map(([element]) => element);
  values.forEach(([element, value]) => { element.textContent = value; });
  if (motionEnabled() && document.documentElement.classList.contains("motion-ready") && changed.length) {
    window.gsap.fromTo(changed, { y: -10, scale: 1.22, color: "#e4422f" }, {
      y: 0,
      scale: 1,
      color: "inherit",
      duration: 0.55,
      stagger: 0.05,
      ease: "back.out(1.8)",
      clearProps: "transform,color",
    });
  }
}

function currentStreak() {
  const practiced = new Set(records.map((record) => record.date));
  let cursor = localDate();
  if (!practiced.has(cursor)) cursor = shiftDate(cursor, -1);
  let streak = 0;
  while (practiced.has(cursor)) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function renderCalendar({ animateStickers = false, strong = false, direction = 0 } = {}) {
  if (calendarDropTimeline) {
    calendarDropTimeline.kill();
    calendarDropTimeline = null;
  }
  stopTodayLiveMotion();
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthRecords = records.filter((record) => record.date.startsWith(monthPrefix));
  const byDate = new Map();
  monthRecords.forEach((record) => {
    if (!byDate.has(record.date)) byDate.set(record.date, []);
    byDate.get(record.date).push(record);
  });

  document.querySelector("#calendarMonth").textContent = formatMonth(calendarCursor);
  document.querySelector("#monthSessions").textContent = String(monthRecords.length);
  document.querySelector("#monthMinutes").textContent = String(monthRecords.reduce((total, record) => total + record.minutes, 0));
  const practicedDates = [...new Set(monthRecords.map((record) => record.date))];
  document.querySelector("#monthMusic").textContent = String(practicedDates.filter((date) => dailySongFor(date)).length);

  const firstOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const dayCount = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let index = 0; index < firstOffset; index += 1) cells.push('<span class="calendar-blank" aria-hidden="true"></span>');

  for (let day = 1; day <= dayCount; day += 1) {
    const date = `${monthPrefix}-${String(day).padStart(2, "0")}`;
    const dayRecords = byDate.get(date) || [];
    const minutes = dayRecords.reduce((total, record) => total + record.minutes, 0);
    const averageEnergy = dayRecords.length ? Math.round(dayRecords.reduce((total, record) => total + record.energy, 0) / dayRecords.length) : 0;
    const hasMusic = Boolean(dailySongFor(date));
    const classes = ["calendar-day"];
    if (dayRecords.length) classes.push("has-record", `energy-${averageEnergy}`);
    if (date === localDate()) classes.push("today");
    if (date === localDate() && dayRecords.length) classes.push("today-live");
    if (date === selectedCalendarDate) classes.push("selected");
    if (date === justStampedDate && !motionEnabled()) classes.push("just-stamped");
    const recordSummary = dayRecords.length ? `，${dayRecords.length} 次练习，共 ${minutes} 分钟` : "，没有记录";
    cells.push(`
      <button class="${classes.join(" ")}" type="button" role="gridcell" data-date="${date}" aria-label="${formatDate(date, { month: "long", day: "numeric", weekday: "long" })}${recordSummary}">
        <span class="day-number">${day}</span>
        ${date === localDate() && dayRecords.length ? '<span class="today-notes" aria-hidden="true"><i>♪</i><i>♫</i><i>♩</i></span>' : ""}
        ${dayRecords.length ? `<span class="groove-sticker" aria-hidden="true"><b>L!</b></span>${hasMusic ? '<i class="day-music-marker" aria-hidden="true">♫</i>' : ""}${dayRecords.length > 1 ? `<em class="session-count" aria-hidden="true">${dayRecords.length}</em>` : ""}` : '<span class="empty-dot" aria-hidden="true"></span>'}
      </button>
    `);
  }
  calendarGrid.innerHTML = cells.join("");
  if (animateStickers) {
    window.requestAnimationFrame(() => {
      animateMonthHeader(direction);
      animateCalendarStickers({ strong });
    });
  } else {
    window.requestAnimationFrame(startTodayLiveMotion);
  }
}

function renderCalendarDetail() {
  if (!selectedCalendarDate) {
    calendarDetail.replaceChildren();
    window.requestAnimationFrame(refreshSongMotions);
    return;
  }
  const dayRecords = records.filter((record) => record.date === selectedCalendarDate);
  const daySong = dailySongFor(selectedCalendarDate);
  const dateLabel = formatDate(selectedCalendarDate, { month: "long", day: "numeric", weekday: "short" });
  if (!dayRecords.length) {
    calendarDetail.innerHTML = `
      ${songCardMarkup(daySong, selectedCalendarDate, "day-song-card")}
      <div class="empty-day">
        <span>${escapeHtml(dateLabel)}</span>
        <button type="button" data-action="new" data-date="${selectedCalendarDate}" aria-label="在 ${escapeHtml(dateLabel)} 添加练习" title="添加练习">＋</button>
      </div>
    `;
    window.requestAnimationFrame(refreshSongMotions);
    return;
  }

  const total = dayRecords.reduce((sum, record) => sum + record.minutes, 0);
  calendarDetail.innerHTML = `
    <div class="day-detail-head"><strong>${escapeHtml(dateLabel)}</strong><span>◷ ${total}</span></div>
    ${songCardMarkup(daySong, selectedCalendarDate, "day-song-card")}
    <div class="day-session-list">
      ${dayRecords.map((record) => {
        return `
          <article class="day-session">
            <span class="mini-vinyl energy-${record.energy}" aria-hidden="true">L!</span>
            <div><strong>${record.minutes}<small>MIN</small></strong><p>${record.skills.map((skill) => escapeHtml(skillInfo(skill).icon)).join(" · ")}</p></div>
            <button type="button" data-action="edit" data-id="${escapeHtml(record.id)}" aria-label="编辑这次练习" title="编辑">✎</button>
          </article>
        `;
      }).join("")}
    </div>
  `;
  window.requestAnimationFrame(refreshSongMotions);
}

function renderFilters() {
  const names = [...new Set(records.flatMap((record) => record.skills))];
  const visibleSkills = names.map(skillInfo);
  if (activeFilter !== ALL_FILTER && !names.includes(activeFilter)) activeFilter = ALL_FILTER;
  const filters = [{ name: ALL_FILTER, icon: "◎", label: "全部记录", custom: false }, ...visibleSkills.map((skill) => ({ name: skill.name, icon: skill.icon, label: skill.name, custom: skill.custom }))];
  filterRow.innerHTML = filters.map((filter) => `
    <button class="filter-button${filter.custom ? " custom-filter" : ""}${activeFilter === filter.name ? " active" : ""}" type="button" data-filter="${escapeHtml(filter.name)}" aria-label="筛选：${escapeHtml(filter.label)}" aria-pressed="${activeFilter === filter.name}" title="${escapeHtml(filter.label)}">${escapeHtml(filter.icon)}${filter.custom ? `<small>${escapeHtml(filter.label)}</small>` : ""}</button>
  `).join("");
}

function renderHistory() {
  const visible = activeFilter === ALL_FILTER ? records : records.filter((record) => record.skills.includes(activeFilter));
  if (!visible.length) {
    historyList.innerHTML = '<div class="empty-history"><span aria-hidden="true">◎</span><strong>DROP YOUR FIRST BEAT</strong><a href="#log" aria-label="记录第一次练习">＋</a></div>';
    window.requestAnimationFrame(refreshSongMotions);
    return;
  }

  const renderedSongDates = new Set();
  historyList.innerHTML = visible.map((record) => {
    const date = dateFromIso(record.date);
    const dateMain = `${date.getMonth() + 1}/${date.getDate()}`;
    const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
    const skills = record.skills.map((skill) => {
      const item = skillInfo(skill);
      return `<span class="${item.custom ? "custom" : ""}" title="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">${escapeHtml(item.icon)}</span>`;
    }).join("");
    const daySong = dailySongFor(record.date);
    const music = daySong && !renderedSongDates.has(record.date) ? songCardMarkup(daySong, record.date, "record-music") : "";
    if (daySong) renderedSongDates.add(record.date);
    return `
      <article class="history-card">
        <div class="history-stamp energy-${record.energy}"><span aria-hidden="true">L!</span><b>${dateMain}</b><small>${escapeHtml(weekday)}</small></div>
        <div class="history-main">
          <div class="record-meta"><strong>${record.minutes}<small>MIN</small></strong><span aria-label="状态 ${record.energy} 分">${ENERGY_LEVELS[record.energy - 1].symbol}</span></div>
          <div class="record-skills">${skills}</div>
          ${music}
          ${record.note ? `<p class="record-note">${escapeHtml(record.note)}</p>` : ""}
        </div>
        <div class="record-actions">
          <button type="button" data-action="edit" data-id="${escapeHtml(record.id)}" aria-label="编辑 ${record.date} 的记录" title="编辑">✎</button>
          <button type="button" data-action="delete" data-id="${escapeHtml(record.id)}" aria-label="删除 ${record.date} 的记录" title="删除">×</button>
        </div>
      </article>
    `;
  }).join("");
  window.requestAnimationFrame(refreshSongMotions);
}

function renderAll({ animateCalendar = false, strong = false } = {}) {
  renderHeroSong();
  renderStats();
  renderCalendar({ animateStickers: animateCalendar, strong });
  renderCalendarDetail();
  renderFilters();
  renderHistory();
  refreshMotionLayout();
  window.requestAnimationFrame(refreshSongMotions);
}

function resetFormState({ keepDate = true } = {}) {
  const date = keepDate ? dateInput.value || localDate() : localDate();
  form.reset();
  dateInput.value = date;
  durationInput.value = "60";
  selectedSkills = new Set(["Lock", "Groove"]);
  selectedEnergy = 4;
  editingId = null;
  editBadge.hidden = true;
  cancelEditButton.hidden = true;
  saveButton.setAttribute("aria-label", "保存练习");
  saveButton.title = "保存练习";
  renderSkillPicker();
  renderEnergyPicker();
  loadSongIntoForm(date);
}

function beginEdit(id) {
  const record = records.find((item) => item.id === id);
  if (!record) return;
  editingId = record.id;
  dateInput.value = record.date;
  durationInput.value = String(record.minutes);
  selectedSkills = new Set(record.skills);
  selectedEnergy = record.energy;
  noteInput.value = record.note || "";
  editBadge.hidden = false;
  cancelEditButton.hidden = false;
  saveButton.setAttribute("aria-label", "保存修改");
  saveButton.title = "保存修改";
  selectedCalendarDate = record.date;
  calendarCursor = monthStart(dateFromIso(record.date));
  renderSkillPicker();
  renderEnergyPicker();
  loadSongIntoForm(record.date);
  renderCalendar();
  renderCalendarDetail();
  document.querySelector("#log").scrollIntoView({ behavior: "smooth", block: "start" });
  showToast("✎ EDIT");
}

function startNewRecord(date = localDate()) {
  resetFormState({ keepDate: false });
  dateInput.value = date;
  loadSongIntoForm(date);
  selectedCalendarDate = date;
  document.querySelector("#log").scrollIntoView({ behavior: "smooth", block: "start" });
}

function removeRecord(id) {
  const record = records.find((item) => item.id === id);
  if (!record || !window.confirm(`删除 ${formatDate(record.date)} 的记录吗？`)) return;
  records = records.filter((item) => item.id !== id);
  if (editingId === id) resetFormState();
  saveRecords();
  renderAll({ animateCalendar: true });
  showToast("× DELETED");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 1800);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}

function motionEnabled() {
  return Boolean(window.gsap) && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function refreshSongMotions() {
  if (songUiContext) {
    songUiContext.revert();
    songUiContext = null;
  }
  if (!motionEnabled()) return;

  songUiContext = window.gsap.context(() => {
    const spinningAlbums = [
      ...document.querySelectorAll("#heroAlbumStage.has-song .hero-vinyl"),
      ...document.querySelectorAll('.song-preview[data-state="ready"] .song-album'),
      ...document.querySelectorAll(".day-song-card.live-song .song-album"),
    ];
    spinningAlbums.forEach((album, index) => {
      window.gsap.to(album, {
        rotation: "+=360",
        duration: index === 0 ? 9.5 : 7.4,
        repeat: -1,
        ease: "none",
        transformOrigin: "50% 50%",
        willChange: "transform",
      });
    });

    const noteStages = [
      ...document.querySelectorAll("#heroAlbumStage.has-song"),
      ...document.querySelectorAll('.song-preview[data-state="ready"] .album-motion'),
      ...document.querySelectorAll(".day-song-card.live-song .album-motion"),
    ];
    noteStages.forEach((stage) => {
      const notes = [...stage.querySelectorAll(".hero-music-notes i, .album-notes i")];
      const large = stage.id === "heroAlbumStage";
      notes.forEach((note, index) => {
        const direction = index % 2 ? 1 : -1;
        const distance = large ? 74 : 34;
        const timeline = window.gsap.timeline({ repeat: -1, repeatDelay: large ? 0.35 : 0.5, delay: index * 0.72 });
        timeline
          .set(note, { x: 0, y: 8, scale: 0.55, rotation: -12, autoAlpha: 0 })
          .to(note, { x: direction * distance * 0.28, y: -distance * 0.28, scale: 1, autoAlpha: 1, duration: 0.45, ease: "power2.out" })
          .to(note, { x: direction * distance * 0.72, y: -distance * 0.72, rotation: direction * 18, duration: 1.12, ease: "sine.inOut" })
          .to(note, { x: direction * distance, y: -distance, scale: 0.72, autoAlpha: 0, duration: 0.68, ease: "power2.in" });
      });
    });

    document.querySelectorAll(".marquee-line").forEach((line) => {
      const track = line.querySelector("[data-marquee], span");
      if (!track) return;
      window.gsap.set(track, { x: 0 });
      const distance = Math.ceil(track.scrollWidth - line.clientWidth);
      if (distance <= 3) return;
      const timeline = window.gsap.timeline({ repeat: -1, repeatDelay: 0.15 });
      timeline
        .to(track, { x: 0, duration: 1.25 })
        .to(track, { x: -distance, duration: Math.max(2.5, distance / 27), ease: "none" })
        .to(track, { x: -distance, duration: 0.55 })
        .set(track, { x: 0 });
    });
  }, document.body);
}

function animatePress(target) {
  if (!motionEnabled() || !target) return;
  window.gsap.fromTo(target, { scale: 0.88 }, {
    scale: 1,
    duration: 0.52,
    ease: "elastic.out(1, 0.42)",
    overwrite: true,
    clearProps: "transform",
  });
}

function animateMonthHeader(direction = 0) {
  if (!motionEnabled()) return;
  const monthTitle = document.querySelector("#calendarMonth");
  const metrics = document.querySelectorAll(".month-metrics > span");
  window.gsap.fromTo(monthTitle, {
    x: direction * 22,
    autoAlpha: 0,
  }, {
    x: 0,
    autoAlpha: 1,
    duration: 0.38,
    ease: "power3.out",
    overwrite: true,
  });
  window.gsap.fromTo(metrics, { y: -9, autoAlpha: 0 }, {
    y: 0,
    autoAlpha: 1,
    duration: 0.42,
    stagger: 0.055,
    ease: "back.out(1.7)",
    overwrite: true,
  });
}

function stopTodayLiveMotion() {
  if (!todayLiveContext) return;
  todayLiveContext.revert();
  todayLiveContext = null;
}

function startTodayLiveMotion() {
  stopTodayLiveMotion();
  if (!motionEnabled()) return;
  const liveDay = calendarGrid.querySelector(".calendar-day.today-live");
  if (!liveDay) return;
  const vinyl = liveDay.querySelector(".groove-sticker");
  const notes = [...liveDay.querySelectorAll(".today-notes i")];
  if (!vinyl) return;

  todayLiveContext = window.gsap.context(() => {
    window.gsap.set(vinyl, { willChange: "transform", transformOrigin: "50% 50%" });
    window.gsap.to(vinyl, {
      rotation: "+=360",
      duration: 4.2,
      repeat: -1,
      ease: "none",
    });
    notes.forEach((note, index) => {
      const drift = index % 2 ? 11 : -9;
      const noteTimeline = window.gsap.timeline({ repeat: -1, repeatDelay: 0.2, delay: index * 0.68 });
      noteTimeline
        .set(note, { x: 0, y: 5, scale: 0.58, rotation: -10, autoAlpha: 0 })
        .to(note, { x: drift * 0.35, y: -8, scale: 1, rotation: 4, autoAlpha: 1, duration: 0.42, ease: "power2.out" })
        .to(note, { x: drift, y: -27, rotation: index % 2 ? 17 : -15, duration: 1.18, ease: "sine.inOut" })
        .to(note, { x: drift * 1.45, y: -43, scale: 0.72, autoAlpha: 0, duration: 0.68, ease: "power2.in" });
    });
  }, liveDay);
}

function animateCalendarStickers({ strong = false } = {}) {
  if (!motionEnabled()) return;
  const stickers = [...calendarGrid.querySelectorAll(".groove-sticker")];
  const sessionCounts = [...calendarGrid.querySelectorAll(".session-count")];
  const musicMarkers = [...calendarGrid.querySelectorAll(".day-music-marker")];
  if (!stickers.length) return;
  const dropDistance = strong ? 210 : 145;
  const duration = strong ? 1.18 : 0.94;
  const stagger = { each: strong ? 0.075 : 0.06, from: "random" };

  window.gsap.killTweensOf([...stickers, ...sessionCounts, ...musicMarkers]);
  window.gsap.set(stickers, { willChange: "transform, opacity", transformOrigin: "50% 50%" });
  window.gsap.set([...sessionCounts, ...musicMarkers], { willChange: "transform, opacity", transformOrigin: "50% 50%" });
  calendarDropTimeline = window.gsap.timeline({
    defaults: { overwrite: "auto" },
    onComplete: () => {
      window.gsap.set(stickers, { clearProps: "willChange" });
      window.gsap.set([...sessionCounts, ...musicMarkers], { clearProps: "willChange" });
      calendarDropTimeline = null;
      startTodayLiveMotion();
    },
  });
  calendarDropTimeline.fromTo(stickers, {
    y: (index) => -dropDistance - (index % 3) * 22,
    scale: strong ? 0.46 : 0.68,
    autoAlpha: 0,
  }, {
    y: 0,
    scale: 1,
    autoAlpha: 1,
    duration,
    ease: "bounce.out",
    stagger,
  }, 0);
  calendarDropTimeline.fromTo(sessionCounts, {
    y: (index) => -dropDistance - (index % 2) * 18,
    scale: 0.55,
    autoAlpha: 0,
  }, {
    y: 0,
    scale: 1,
    autoAlpha: 1,
    duration,
    ease: "bounce.out",
    stagger,
  }, 0.04);
  calendarDropTimeline.fromTo(musicMarkers, {
    y: (index) => -dropDistance - (index % 2) * 18,
    scale: 0.55,
    autoAlpha: 0,
  }, {
    y: 0,
    scale: 1,
    autoAlpha: 1,
    duration,
    ease: "bounce.out",
    stagger,
  }, 0.04);
  calendarDropTimeline.fromTo(stickers, {
    rotation: (index) => -250 - (index % 4) * 38,
  }, {
    rotation: (index) => 353 + (index % 3) * 4,
    duration: duration * 0.94,
    ease: "power3.out",
    stagger,
  }, 0);
  calendarDropTimeline.to(stickers, {
    scale: 1.1,
    duration: 0.13,
    ease: "power1.out",
    stagger: { each: 0.035, from: "random" },
  }, `-=${Math.min(0.42, duration * 0.35)}`);
  calendarDropTimeline.to(stickers, {
    scale: 1,
    duration: 0.52,
    ease: "elastic.out(1, 0.32)",
    stagger: { each: 0.035, from: "random" },
  }, "-=0.08");
}

function animateRenderedCards() {
  if (!motionEnabled()) return;
  const cards = historyList.querySelectorAll(".history-card");
  window.gsap.fromTo(cards, {
    x: 24,
    y: 18,
    rotation: 1.5,
    autoAlpha: 0,
  }, {
    x: 0,
    y: 0,
    rotation: 0,
    autoAlpha: 1,
    duration: 0.52,
    stagger: 0.055,
    ease: "back.out(1.45)",
    overwrite: true,
    clearProps: "transform",
  });
}

function refreshMotionLayout() {
  if (!window.ScrollTrigger) return;
  window.requestAnimationFrame(() => window.ScrollTrigger.refresh());
}

function openCustomSkillDialog() {
  customSkillMessage.textContent = "";
  customSkillInput.value = "";
  renderCustomSkillList();
  customSkillDialog.showModal();
  if (motionEnabled()) {
    window.gsap.fromTo(customSkillDialog, { y: 52, scale: 0.86, autoAlpha: 0 }, {
      y: 0,
      scale: 1,
      autoAlpha: 1,
      duration: 0.62,
      ease: "elastic.out(1, 0.55)",
      clearProps: "transform,opacity,visibility",
    });
  }
  window.setTimeout(() => customSkillInput.focus(), 70);
}

function initMotionSystem() {
  if (!window.gsap) return;
  if (window.ScrollTrigger) window.gsap.registerPlugin(window.ScrollTrigger);
  document.documentElement.classList.add("motion-ready");

  const media = window.gsap.matchMedia();
  media.add("(prefers-reduced-motion: no-preference)", () => {
    const intro = window.gsap.timeline({ defaults: { ease: "power3.out" } });
    intro
      .from(".app-header", { y: -34, autoAlpha: 0, duration: 0.5 })
      .from(".eyebrow", { x: -24, autoAlpha: 0, duration: 0.38 }, "-=0.2")
      .from("#hero-title", { x: -46, autoAlpha: 0, duration: 0.62 }, "-=0.24")
      .from(".streak-chip", { scale: 0.5, rotation: -8, autoAlpha: 0, duration: 0.56, ease: "back.out(1.8)" }, "-=0.38")
      .from(".hero-album-stage", { x: 90, scale: 0.35, autoAlpha: 0, duration: 0.9, ease: "elastic.out(1, 0.55)" }, "-=0.58")
      .from(".quick-stats article", { y: 28, autoAlpha: 0, duration: 0.46, stagger: 0.075 }, "-=0.55")
      .from(".bottom-nav a", { y: 34, autoAlpha: 0, duration: 0.46, stagger: 0.07 }, "-=0.35");

    if (window.ScrollTrigger) {
      window.gsap.to(".hero-album-stage", {
        y: 34,
        rotation: 9,
        ease: "none",
        scrollTrigger: {
          trigger: ".hero-dashboard",
          start: "top top",
          end: "bottom top",
          scrub: 0.65,
        },
      });
      window.ScrollTrigger.batch(".record-section fieldset, .record-section .note-field, .history-section, .data-dock > *", {
        once: true,
        start: "top 88%",
        batchMax: 4,
        onEnter: (batch) => window.gsap.fromTo(batch, { y: 34, autoAlpha: 0 }, {
          y: 0,
          autoAlpha: 1,
          duration: 0.62,
          stagger: 0.08,
          ease: "power3.out",
          clearProps: "transform,opacity,visibility",
        }),
      });
    }
  });
}

skillPicker.addEventListener("click", (event) => {
  const addButton = event.target.closest("button[data-action='add-custom']");
  if (addButton) {
    animatePress(addButton);
    openCustomSkillDialog();
    return;
  }
  const button = event.target.closest("button[data-skill]");
  if (!button) return;
  const skill = button.dataset.skill;
  if (selectedSkills.has(skill)) selectedSkills.delete(skill);
  else selectedSkills.add(skill);
  renderSkillPicker();
  animatePress([...skillPicker.querySelectorAll("button[data-skill]")].find((item) => item.dataset.skill === skill));
});

energyPicker.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-energy]");
  if (!button) return;
  selectedEnergy = Number(button.dataset.energy);
  renderEnergyPicker();
  animatePress(energyPicker.querySelector(`[data-energy="${selectedEnergy}"]`));
});

calendarGrid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-date]");
  if (!button) return;
  animatePress(button);
  selectedCalendarDate = button.dataset.date;
  dateInput.value = selectedCalendarDate;
  renderCalendar();
  renderCalendarDetail();
});

calendarDetail.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "new") startNewRecord(button.dataset.date);
  if (button.dataset.action === "edit") beginEdit(button.dataset.id);
});

filterRow.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  animatePress(button);
  activeFilter = button.dataset.filter;
  renderFilters();
  renderHistory();
  animateRenderedCards();
});

historyList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (button.dataset.action === "edit") beginEdit(button.dataset.id);
  if (button.dataset.action === "delete") removeRecord(button.dataset.id);
});

document.querySelector("#prevMonth").addEventListener("click", (event) => {
  animatePress(event.currentTarget);
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  selectedCalendarDate = localDate(calendarCursor);
  renderCalendar({ animateStickers: true, direction: -1 });
  renderCalendarDetail();
});

document.querySelector("#nextMonth").addEventListener("click", (event) => {
  animatePress(event.currentTarget);
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  selectedCalendarDate = localDate(calendarCursor);
  renderCalendar({ animateStickers: true, direction: 1 });
  renderCalendarDetail();
});

document.querySelector("#todayMonth").addEventListener("click", (event) => {
  animatePress(event.currentTarget);
  calendarCursor = monthStart(new Date());
  selectedCalendarDate = localDate();
  dateInput.value = selectedCalendarDate;
  renderCalendar({ animateStickers: true });
  renderCalendarDetail();
});

customSkillForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = cleanSkillName(customSkillInput.value);
  const duplicate = selectableSkills().some((skill) => skill.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (!name) {
    customSkillMessage.textContent = "请输入元素名称";
    return;
  }
  if (duplicate) {
    customSkillMessage.textContent = "这个元素已经存在";
    return;
  }
  if (customSkills.length >= CUSTOM_SKILL_LIMIT) {
    customSkillMessage.textContent = `最多 ${CUSTOM_SKILL_LIMIT} 个`;
    return;
  }

  customSkills.push(name);
  selectedSkills.add(name);
  saveCustomSkills();
  renderSkillPicker();
  renderCustomSkillList();
  customSkillDialog.close();
  refreshMotionLayout();
  showToast(`${CUSTOM_SKILL_ICON} ADDED`);
  window.requestAnimationFrame(() => animatePress([...skillPicker.querySelectorAll("button[data-skill]")].find((item) => item.dataset.skill === name)));
});

customSkillList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-remove-custom]");
  if (!button) return;
  const name = button.dataset.removeCustom;
  if (!window.confirm(`移除“${name}”吗？历史练习仍会保留。`)) return;
  customSkills = customSkills.filter((item) => item !== name);
  selectedSkills.delete(name);
  if (activeFilter === name) activeFilter = ALL_FILTER;
  saveCustomSkills();
  renderCustomSkillList();
  renderSkillPicker();
  renderFilters();
  renderHistory();
  refreshMotionLayout();
  showToast("× REMOVED");
});

document.querySelector("#closeCustomSkill").addEventListener("click", () => customSkillDialog.close());

songUrlInput.addEventListener("input", scheduleSongLookup);
songTitleInput.addEventListener("input", () => renderSongPreview("auto", "✎ 可手动修正"));
songArtistInput.addEventListener("input", () => renderSongPreview("auto", "✎ 可手动修正"));
songBpmInput.addEventListener("input", () => renderSongPreview("auto", songLookupStatus.textContent));
dateInput.addEventListener("change", () => loadSongIntoForm(dateInput.value));
cancelEditButton.addEventListener("click", () => resetFormState());

document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || image.dataset.fallbackApplied === "true") return;
  if (image.matches("[data-album-cover], #songCover, #heroAlbumCover")) {
    image.dataset.fallbackApplied = "true";
    image.src = DEFAULT_ALBUM_COVER;
  }
}, true);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const minutes = Number(durationInput.value);
  const bpm = songBpmInput.value ? Number(songBpmInput.value) : null;
  let rawSongUrl = songUrlInput.value.trim();
  let songUrl = normalizeNeteaseUrl(rawSongUrl);

  if (!selectedSkills.size) {
    formMessage.textContent = "至少选一个动作";
    return;
  }
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) {
    formMessage.textContent = "时长需为 5–480 分钟";
    return;
  }
  if (bpm !== null && (!Number.isInteger(bpm) || bpm < 40 || bpm > 240)) {
    formMessage.textContent = "BPM 需为 40–240";
    return;
  }
  if (rawSongUrl && !songUrl) {
    formMessage.textContent = "请粘贴网易云分享链接";
    songUrlInput.focus();
    return;
  }
  window.clearTimeout(songLookupTimer);
  if (songUrl && songPreview.dataset.state === "loading") {
    await recognizeSongLink();
    rawSongUrl = songUrlInput.value.trim();
    songUrl = normalizeNeteaseUrl(rawSongUrl);
  }

  const dailySong = buildDailySongFromForm(dateInput.value);

  const previous = editingId ? records.find((record) => record.id === editingId) : null;
  const record = {
    id: previous?.id || createId(),
    date: dateInput.value,
    minutes,
    skills: [...selectedSkills],
    energy: selectedEnergy,
    songTitle: dailySong?.title || "",
    songArtist: dailySong?.artist || "",
    songCoverUrl: dailySong?.coverUrl || "",
    songUrl: dailySong?.url || songUrl,
    songBpm: dailySong?.bpm || bpm,
    note: noteInput.value.trim().slice(0, 300),
    createdAt: previous?.createdAt || new Date().toISOString(),
    updatedAt: previous ? new Date().toISOString() : undefined,
  };

  records = previous ? records.map((item) => item.id === previous.id ? record : item) : [record, ...records];
  records.sort(sortRecords);
  if (dailySong) dailySongs[record.date] = dailySong;
  else delete dailySongs[record.date];
  saveDailySongs();
  syncLegacySongFields(record.date);
  selectedCalendarDate = record.date;
  calendarCursor = monthStart(dateFromIso(record.date));
  justStampedDate = record.date;
  const wasEditing = Boolean(previous);
  resetFormState({ keepDate: true });
  dateInput.value = record.date;
  formMessage.textContent = "";
  renderAll({ animateCalendar: true, strong: true });
  animateRenderedCards();
  showToast(wasEditing ? "✓ UPDATED" : "✓ LOCKED");
  window.setTimeout(() => { justStampedDate = null; }, 900);
});

document.querySelector("#exportButton").addEventListener("click", () => {
  const content = JSON.stringify({ app: "LOCK IN", version: 4, exportedAt: new Date().toISOString(), customSkills, dailySongs, records }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `lock-in-backup-${localDate()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("⇩ EXPORTED");
});

document.querySelector("#importInput").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    const incoming = Array.isArray(imported) ? imported : imported.records;
    if (!Array.isArray(incoming) || !incoming.every(isRecord)) throw new Error("invalid");
    const importedCustom = Array.isArray(imported.customSkills) ? imported.customSkills : [];
    const discoveredCustom = incoming.flatMap((record) => record.skills).filter((name) => !SKILLS.some((skill) => skill.name === name));
    const candidates = [...customSkills, ...importedCustom, ...discoveredCustom]
      .filter((name) => typeof name === "string")
      .map(cleanSkillName)
      .filter(Boolean);
    const uniqueCustom = [];
    candidates.forEach((name) => {
      if (!SKILLS.some((skill) => skill.name.toLocaleLowerCase() === name.toLocaleLowerCase()) && !uniqueCustom.some((skill) => skill.toLocaleLowerCase() === name.toLocaleLowerCase())) uniqueCustom.push(name);
    });
    customSkills = uniqueCustom.slice(0, CUSTOM_SKILL_LIMIT);
    saveCustomSkills();
    if (imported.dailySongs && typeof imported.dailySongs === "object" && !Array.isArray(imported.dailySongs)) {
      Object.entries(imported.dailySongs).forEach(([date, song]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const normalizedSong = normalizeDailySong(song, date);
        if (!normalizedSong) return;
        if (!dailySongs[date] || normalizedSong.updatedAt > dailySongs[date].updatedAt) dailySongs[date] = normalizedSong;
      });
    }
    const existingIds = new Set(records.map((record) => record.id));
    const additions = incoming.filter((record) => !existingIds.has(record.id)).map(normalizeRecord);
    records = [...records, ...additions].sort(sortRecords);
    additions.forEach((record) => {
      if (dailySongs[record.date] || (!record.songTitle && !record.songUrl)) return;
      const migratedSong = normalizeDailySong({ title: record.songTitle, artist: record.songArtist, coverUrl: record.songCoverUrl, url: record.songUrl, bpm: record.songBpm }, record.date);
      if (migratedSong) dailySongs[record.date] = migratedSong;
    });
    records = records.map((record) => {
      const song = dailySongFor(record.date);
      return song ? { ...record, songTitle: song.title, songArtist: song.artist, songCoverUrl: song.coverUrl, songUrl: song.url, songBpm: song.bpm } : record;
    });
    saveDailySongs();
    saveRecords();
    renderSkillPicker();
    renderAll({ animateCalendar: true });
    animateRenderedCards();
    showToast(additions.length ? `⇧ ${additions.length}` : "✓ SYNCED");
  } catch {
    showToast("! INVALID FILE");
  } finally {
    event.target.value = "";
  }
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    installDialog.showModal();
    if (motionEnabled()) {
      window.gsap.fromTo(installDialog, { y: 40, scale: 0.9, autoAlpha: 0 }, {
        y: 0,
        scale: 1,
        autoAlpha: 1,
        duration: 0.5,
        ease: "back.out(1.7)",
        clearProps: "transform,opacity,visibility",
      });
    }
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

document.querySelector("#closeInstallHelp").addEventListener("click", () => installDialog.close());

document.querySelector(".bottom-nav").addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (link) animatePress(link);
});

document.querySelector(".data-dock").addEventListener("click", (event) => {
  const control = event.target.closest("button, label");
  if (control) animatePress(control);
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  installButton.innerHTML = '<span aria-hidden="true">✓</span>';
  installButton.disabled = true;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => undefined));
}

renderSkillPicker();
renderEnergyPicker();
loadSongIntoForm(dateInput.value);
renderAll({ animateCalendar: true });
initMotionSystem();
