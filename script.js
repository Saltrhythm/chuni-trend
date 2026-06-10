const GAS_URL = "https://script.google.com/macros/s/AKfycbyxIZf5g2BpRbAIziFQf0VwT6hIlxZ9Y6rkGMA4SR9jD_xjcYEVTfnzpqvLFVqzCLuv6Q/exec";

let globalSongs = [];
let currentTabStr = "15.7"; // 初期表示を15.7（最高難易度）に設定
let currentUserName = "";
const activeCharts = {}; // チャートインスタンス保持用

// 14.8〜15.7 までの基準コストマップ
const baseCostMap = {
  "14.8": 12, "14.9": 14,
  "15.0": 16, "15.1": 18, "15.2": 20, "15.3": 22, "15.4": 24,
  "15.5": 30, "15.6": 36, "15.7": 42
};

// ページを開いた瞬間に実行
window.onload = function () {
  reverseAndAdjustTabButtons(); // タブの並び替えとサイズ・デザインの調整を同時に実行
  loadAnalyticsData();
};

// アンケートの定数タブボタンの降順ソート、およびサイズ（文字サイズと縦幅）を調整する処理
function reverseAndAdjustTabButtons() {
  const buttons = Array.from(document.querySelectorAll(".tab-btn"));
  if (buttons.length === 0) return;
  const parent = buttons[0].parentNode;

  // 15.7 から 14.8 の降順に並び替え
  buttons.sort((a, b) => {
    const tabA = parseFloat(a.getAttribute('data-tab')) || 0;
    const tabB = parseFloat(b.getAttribute('data-tab')) || 0;
    return tabB - tabA;
  });

  buttons.forEach(btn => {
    // タブの文字サイズを大きくし、上下の余白（パディング）を広げて縦幅を伸ばす
    btn.style.fontSize = "16px";
    btn.style.padding = "10px 12px";
    btn.style.fontWeight = "bold";

    parent.appendChild(btn);
  });
}

// 1. 全体集計ランキングのデータをGASから取得して初期化
function loadAnalyticsData() {
  const container = document.getElementById("drawer-container");
  if (!container.innerHTML || container.innerHTML.includes("ユーザー名入力後")) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#8e8e93; font-size:12px; background:#f2f2f7; border-radius:8px;">ランキングデータを読み込み中...</div>';
  }

  // 💡 URLの末尾に毎回変わるタイムスタンプ（現在時刻のミリ秒）を付加してキャッシュを回避
  const url = `${GAS_URL}?action=getData&playerName=&_=${Date.now()}`;
  fetch(url)
    .then(response => response.json())
    .then((res) => {
      if (res.status === "success") {
        initAnalytics(res.songs);
      } else {
        container.innerHTML = '<div style="text-align:center; padding:20px; color:#ff3b30; font-size:12px;">集計データの取得に失敗しました。</div>';
      }
    })
    .catch((err) => {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#ff3b30; font-size:12px;">通信エラーによりランキングを表示できません。</div>';
    });
}

// 2. ユーザー名を入力してアンケート画面に進む処理
function startSurvey() {
  const nameInput = document.getElementById("user-name-input").value.trim();
  if (!nameInput) { alert("ユーザー名を入力してください。"); return; }

  currentUserName = nameInput;
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("analytics-section").style.display = "none";
  document.getElementById("loading").style.display = "block";

  // 💡 URLの末尾に毎回変わるタイムスタンプ（現在時刻のミリ秒）を付加してキャッシュを回避
  const url = `${GAS_URL}?action=getData&playerName=${encodeURIComponent(currentUserName)}&_=${Date.now()}`;

  fetch(url)
    .then(response => response.json())
    .then((res) => {
      document.getElementById("loading").style.display = "none";
      if (res.status === "success") {
        globalSongs = res.songs;
        document.getElementById("display-user-name").innerText = currentUserName;
        document.getElementById("main-screen").style.display = "block";

        // タブ選択の状態、基準コストの表示、楽曲の描画を初期値（15.7）で同期
        switchTab(currentTabStr);
      } else {
        alert("エラーが発生しました: " + res.message);
        document.getElementById("login-screen").style.display = "block";
        document.getElementById("analytics-section").style.display = "block";
      }
    })
    .catch((err) => {
      document.getElementById("loading").style.display = "none";
      alert("通信エラー: " + err);
      document.getElementById("login-screen").style.display = "block";
      document.getElementById("analytics-section").style.display = "block";
    });
}

// 3. 定数タブの切り替え
function switchTab(tabStr) {
  currentTabStr = tabStr;
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute('data-tab') === tabStr);
  });

  document.getElementById("search-input").value = "";
  document.getElementById("unanswered-only").checked = false;

  updateBaseCostDisplay();
  renderSongs();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 4. 現在の基準コストの表示テキストを更新
function updateBaseCostDisplay() {
  const base = baseCostMap[currentTabStr] || 16;
  document.getElementById("label-current-tab").innerText = currentTabStr;
  document.getElementById("label-base-cost").innerText = base;
  document.getElementById("label-cost-range").innerText = `${base - 2}〜${base + 2}`;
}

// 5. 楽曲カード一覧を画面に出力
function renderSongs() {
  const wrapper = document.getElementById("songs-wrapper");
  wrapper.innerHTML = "";

  const keyword = document.getElementById("search-input").value.toLowerCase().trim();
  const isUnansweredOnly = document.getElementById("unanswered-only").checked;

  const filtered = globalSongs.filter(song => {
    const songConstStr = song.constStr || (song.constant ? song.constant.toFixed(1) : "");
    if (songConstStr !== currentTabStr) return false;
    if (keyword && song.title.toLowerCase().indexOf(keyword) === -1) return false;
    if (isUnansweredOnly && song.total > 0) return false;
    return true;
  });

  if (filtered.length === 0) {
    wrapper.innerHTML = '<div class="empty-message">該当する譜面が見つかりません。</div>';
    checkTabValidity();
    return;
  }

  filtered.forEach((song) => {
    const globalIndex = globalSongs.findIndex(g => g.title === song.title && g.diff === song.diff);
    const minV = song.baseCost - 2;
    const maxV = song.baseCost + 2;

    let cardClass = "song-card";
    let statusHtml = '<div class="calc-result status-zero">未回答</div>';

    if (song.total > 0) {
      if (song.total >= minV && song.total <= maxV) {
        cardClass = "song-card card-ok";
        statusHtml = '<div class="calc-result status-ok">[OK] 適正</div>';
      } else {
        cardClass = "song-card card-editing";
        statusHtml = `<div class="calc-result status-ng">[NG] 範囲外 (${song.total})</div>`;
      }
    }

    let html = `
      <div class="${cardClass}" id="card-${globalIndex}" data-min="${minV}" data-max="${maxV}">
        <h3>
          <span class="song-title-text">${song.title}</span>
          <span class="diff-badge diff-${song.diff}">${song.diff}</span>
        </h3>
        <div class="song-meta">定数: <strong>${song.constant.toFixed(1)}</strong> | 基準コスト: <strong>${song.baseCost}</strong> (${minV}〜${maxV})</div>
        
        <div class="param-row">
          <label>体力<span class="param-desc">(腕の瞬発力、持久力が必要なもの)</span></label>
          <select class="cost-select in-tairyoku" onchange="updateCost(${globalIndex})">${getOptions(song.tairyoku, maxV)}</select>
        </div>
        <div class="param-row">
          <label>鍵盤<span class="param-desc">(指押しの技術が必要なもの)</span></label>
          <select class="cost-select in-kenban" onchange="updateCost(${globalIndex})">${getOptions(song.kenban, maxV)}</select>
        </div>
        <div class="param-row">
          <label>チュウニ力<span class="param-desc">(タプスラ、フリック、交差、縦連判定への耐性が必要なもの)</span></label>
          <select class="cost-select in-chuni" onchange="updateCost(${globalIndex})">${getOptions(song.chuni, maxV)}</select>
        </div>
        <div class="param-row">
          <label>癖<span class="param-desc">(長い縦連や片手トリル、ソフラン、極度のリズム難など、類似譜面が非常に少ないもの)</span></label>
          <select class="cost-select in-kuse" onchange="updateCost(${globalIndex})">${getOptions(song.kuse, maxV)}</select>
        </div>
        
        <div class="status-container">
          <div>現在の合計: <span class="total-badge current-total">${song.total}</span></div>
          <div class="status-box">${statusHtml}</div>
        </div>
      </div>
    `;
    wrapper.insertAdjacentHTML('beforeend', html);
  });

  filtered.forEach(song => {
    const globalIndex = globalSongs.findIndex(g => g.title === song.title && g.diff === song.diff);
    if (globalIndex !== -1) {
      updateCost(globalIndex);
    }
  });

  checkTabValidity();
}

function getOptions(selectedVal, maxVal) {
  let options = "";
  for (let c = 0; c <= maxVal; c++) {
    options += `<option value="${c}" ${c === selectedVal ? 'selected' : ''}>${c}</option>`;
  }
  return options;
}

// 6. ユーザーがコストを変更した時のリアルタイム計算
function updateCost(globalIndex) {
  const card = document.getElementById(`card-${globalIndex}`);
  if (!card) return;
  const minV = parseInt(card.getAttribute('data-min'));
  const maxV = parseInt(card.getAttribute('data-max'));

  const tairyoku = parseInt(card.querySelector('.in-tairyoku').value) || 0;
  const kenban = parseInt(card.querySelector('.in-kenban').value) || 0;
  const chuni = parseInt(card.querySelector('.in-chuni').value) || 0;
  const kuse = parseInt(card.querySelector('.in-kuse').value) || 0;

  const total = tairyoku + kenban + chuni + kuse;

  globalSongs[globalIndex].tairyoku = tairyoku;
  globalSongs[globalIndex].kenban = kenban;
  globalSongs[globalIndex].chuni = chuni;
  globalSongs[globalIndex].kuse = kuse;
  globalSongs[globalIndex].total = total;

  card.querySelector('.current-total').innerText = total;
  const statusBox = card.querySelector('.status-box');

  if (total === 0) {
    card.className = "song-card";
    statusBox.innerHTML = '<div class="calc-result status-zero">未回答</div>';
  } else if (total >= minV && total <= maxV) {
    card.className = "song-card card-ok";
    statusBox.innerHTML = '<div class="calc-result status-ok">[OK] 適正</div>';
  } else {
    card.className = "song-card card-editing";
    if (total < minV) {
      statusBox.innerHTML = `<div class="calc-result status-ng">[NG] あと ${minV - total} 不足</div>`;
    } else {
      statusBox.innerHTML = `<div class="calc-result status-ng">[NG] ${total - maxV} オーバー</div>`;
    }
  }

  checkTabValidity();
}

// 7. ページ内一括リセット処理
function resetCurrentTabAnswers() {
  if (!confirm(`現在開いている「定数 ${currentTabStr}」のすべての入力内容をリセットします。よろしいですか？\n※保存を確定するには、リセット後に画面下の「保存」ボタンを押してください。`)) {
    return;
  }
  globalSongs.forEach(song => {
    const songConstStr = song.constStr || (song.constant ? song.constant.toFixed(1) : "");
    if (songConstStr === currentTabStr) {
      song.tairyoku = 0; song.kenban = 0; song.chuni = 0; song.kuse = 0; song.total = 0;
    }
  });
  renderSongs();
}

// 8. エラー曲があっても、1つでも適正(OK)な回答があれば保存ボタンを押せるように制御
function checkTabValidity() {
  const tabSongs = globalSongs.filter(s => {
    const songConstStr = s.constStr || (s.constant ? s.constant.toFixed(1) : "");
    return songConstStr === currentTabStr;
  });

  let hasValidAnswer = false;
  let hasErrorAnswer = false;

  tabSongs.forEach(s => {
    const minV = s.baseCost - 2;
    const maxV = s.baseCost + 2;
    if (s.total > 0) {
      if (s.total >= minV && s.total <= maxV) {
        hasValidAnswer = true;
      } else {
        hasErrorAnswer = true;
      }
    }
  });

  const btn = document.getElementById("save-btn");
  if (hasValidAnswer) {
    btn.disabled = false;
    if (hasErrorAnswer) {
      btn.innerText = "適正な回答のみを選抜して保存する";
      btn.style.background = "#0076f6";
    } else {
      btn.innerText = `定数 ${currentTabStr} の回答を保存する`;
      btn.style.background = "#34c759";
    }
  } else {
    btn.disabled = true;
    btn.innerText = "保存できる適正な回答がありません";
    btn.style.background = "#aeaeb2";
  }
}

// 9. 適正な回答（OK）のみを選抜してスプレッドシートに送信
function saveCurrentTab() {
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.innerText = "保存処理中...";

  const currentTabSongs = globalSongs.filter(s => {
    const songConstStr = s.constStr || (s.constant ? s.constant.toFixed(1) : "");
    return songConstStr === currentTabStr;
  });

  const validAnswers = currentTabSongs.filter(s => {
    const minV = s.baseCost - 2;
    const maxV = s.baseCost + 2;
    return s.total >= minV && s.total <= maxV;
  });

  if (validAnswers.length === 0) {
    alert("保存できる適正な回答（OKの曲）がありません。");
    btn.disabled = false;
    checkTabValidity();
    return;
  }

  const totalInputed = currentTabSongs.filter(s => s.total > 0).length;
  if (validAnswers.length < totalInputed) {
    const errorCount = totalInputed - validAnswers.length;
    if (!confirm(`範囲外（エラー）の曲が ${errorCount} 件あります。\nこれらを除外した、適正な回答 ${validAnswers.length} 件のみを保存しますか？`)) {
      btn.disabled = false;
      checkTabValidity();
      return;
    }
  }

  const payload = {
    action: "save",
    playerName: currentUserName,
    answers: validAnswers
  };

  fetch(GAS_URL, {
    method: "POST",
    contentType: "application/json",
    body: JSON.stringify(payload)
  })
    .then(response => response.json())
    .then((res) => {
      if (res.status === "success") {
        alert(`適正な回答（${validAnswers.length}曲）のデータを保存しました！`);
        renderSongs();
      } else {
        alert("保存エラー: " + res.message);
        btn.disabled = false;
        checkTabValidity();
      }
    })
    .catch((err) => {
      alert("通信エラーが発生しました: " + err);
      btn.disabled = false;
      checkTabValidity();
    });
}

// 文字列を実際のピクセル幅（描画スペース）ベースで綺麗に切り詰めるヘルパー関数
function truncateByWidth(text, maxWidth, font) {
  const canvas = truncateByWidth.canvas || (truncateByWidth.canvas = document.createElement("canvas"));
  const context = canvas.getContext("2d");
  context.font = font || "9px sans-serif";

  if (context.measureText(text).width <= maxWidth) {
    return text;
  }

  let truncated = text;
  while (truncated.length > 0 && context.measureText(truncated + "...").width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}

// 10. 概要分析ランキングの生成（親ドロワー階層構造 ＋ 横幅ピクセル制限化）
function initAnalytics(songs) {
  const container = document.getElementById("drawer-container");
  container.innerHTML = "";

  const metrics = [
    { key: "total", label: "逆詐称/詐称度", color: "rgba(255, 99, 132, 0.7)" },
    { key: "tairyoku", label: "体力要求度", color: "rgba(54, 162, 235, 0.7)" },
    { key: "kenban", label: "鍵盤力要求度", color: "rgba(255, 206, 86, 0.7)" },
    { key: "chuni", label: "チュウニ力要求度", color: "rgba(75, 192, 192, 0.7)" },
    { key: "kuse", label: "癖度", color: "rgba(153, 102, 255, 0.7)" }
  ];

  if (!songs || songs.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#ff3b30; font-size:12px; background:#f2f2f7; border-radius:8px;">有効なデータが見つかりませんでした</div>';
    return;
  }

  // 一番上の独立した「総合ランキング」
  const totalWrapper = document.createElement("div");
  totalWrapper.className = "drawer-wrapper";

  const totalHeader = document.createElement("button");
  totalHeader.className = "drawer-header";
  totalHeader.style.background = "#e5e5ea";
  totalHeader.innerHTML = `<span>【総合】全定数ランキング (各項目上位50曲)</span> <span>▼</span>`;

  const totalContent = document.createElement("div");
  totalContent.className = "drawer-content";
  totalContent.id = "drawer-content-all";

  totalHeader.onclick = () => {
    const isVisible = totalContent.style.display === "block";
    totalContent.style.display = isVisible ? "none" : "block";
    totalHeader.querySelector("span:last-child").innerText = isVisible ? "▼" : "▲";

    if (!isVisible && !activeCharts["all"]) {
      switchMetric("all", 'tairyoku', metrics[1].color, metrics[1].label, songs);
    }
  };

  const totalTabContainer = document.createElement("div");
  totalTabContainer.className = "tab-button-container";

  metrics.forEach((metric) => {
    if (metric.key === "total") return;
    const btn = document.createElement("button");
    btn.className = `tab-btn-metric tab-btn-all`;
    if (metric.key === "tairyoku") btn.classList.add("active");
    btn.innerText = metric.label;

    btn.onclick = () => {
      document.querySelectorAll(`.tab-btn-all`).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      switchMetric("all", metric.key, metric.color, metric.label, songs);
    };
    totalTabContainer.appendChild(btn);
  });

  totalContent.appendChild(totalTabContainer);

  const totalCanvasContainer = document.createElement("div");
  totalCanvasContainer.id = "canvas-container-all";
  totalCanvasContainer.style.position = "relative";
  totalCanvasContainer.style.height = `${50 * 28 + 50}px`;

  const totalCanvas = document.createElement("canvas");
  totalCanvas.id = "canvas-all";
  totalCanvasContainer.appendChild(totalCanvas);
  totalContent.appendChild(totalCanvasContainer);

  totalWrapper.appendChild(totalHeader);
  totalWrapper.appendChild(totalContent);
  container.appendChild(totalWrapper);


  // 親ドロワーによる難易度帯の階層化定義
  const parentGroups = [
    { label: "15+ (15.5〜15.7)", constants: ["15.7", "15.6", "15.5"] },
    { label: "15 (15.0〜15.4)", constants: ["15.4", "15.3", "15.2", "15.1", "15.0"] },
    { label: "14+ (14.8〜14.9)", constants: ["14.9", "14.8"] }
  ];

  parentGroups.forEach(group => {
    // 親ドロワーのラッパー
    const pWrapper = document.createElement("div");
    pWrapper.className = "drawer-wrapper";
    pWrapper.style.marginBottom = "14px";
    pWrapper.style.border = "1px solid #c6c6cc";
    pWrapper.style.borderRadius = "10px";
    pWrapper.style.overflow = "hidden";
    pWrapper.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";

    // 親ドロワーのヘッダー
    const pHeader = document.createElement("button");
    pHeader.className = "drawer-header";
    pHeader.style.background = "#d1d1d6";
    pHeader.style.color = "#000";
    pHeader.style.fontWeight = "bold";
    pHeader.style.fontSize = "15px";
    pHeader.style.padding = "14px 16px";
    pHeader.innerHTML = `<span>${group.label}</span> <span>▼</span>`;

    // 親ドロワーのコンテンツ
    const pContent = document.createElement("div");
    pContent.style.display = "none";
    pContent.style.background = "#f2f2f7";
    pContent.style.padding = "8px";

    pHeader.onclick = () => {
      const isVisible = pContent.style.display === "block";
      pContent.style.display = isVisible ? "none" : "block";
      pHeader.querySelector("span:last-child").innerText = isVisible ? "▼" : "▲";
    };

    // 子アコーディオン群の生成（各定数ごと）
    group.constants.forEach(targetConst => {
      const filtered = songs.filter(s => {
        const songConstStr = s.constStr || (s.constant ? s.constant.toFixed(1) : "");
        return songConstStr === targetConst;
      });

      if (filtered.length === 0) return;

      const wrapper = document.createElement("div");
      wrapper.className = "drawer-wrapper";
      wrapper.style.margin = "6px 0";
      wrapper.style.boxShadow = "none";
      wrapper.style.border = "1px solid #e5e5ea";

      const header = document.createElement("button");
      header.className = "drawer-header";
      header.style.background = "#fff";
      header.style.fontSize = "13px";
      header.style.padding = "10px 12px";
      header.innerHTML = `<span>${targetConst} (${filtered.length}曲)</span> <span>▼</span>`;

      const content = document.createElement("div");
      content.className = "drawer-content";
      content.id = `drawer-content-${targetConst.replace('.', '_')}`;
      content.style.background = "#fff";

      header.onclick = () => {
        const isVisible = content.style.display === "block";
        content.style.display = isVisible ? "none" : "block";
        header.querySelector("span:last-child").innerText = isVisible ? "▼" : "▲";

        if (!isVisible && !activeCharts[targetConst]) {
          switchMetric(targetConst, 'total', metrics[0].color, metrics[0].label, songs);
        }
      };

      const tabContainer = document.createElement("div");
      tabContainer.className = "tab-button-container";

      metrics.forEach((metric, index) => {
        const btn = document.createElement("button");
        btn.className = `tab-btn-metric tab-btn-${targetConst.replace('.', '_')}`;
        if (index === 0) btn.classList.add("active");
        btn.innerText = metric.label;

        btn.onclick = () => {
          document.querySelectorAll(`.tab-btn-${targetConst.replace('.', '_')}`).forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          switchMetric(targetConst, metric.key, metric.color, metric.label, songs);
        };
        tabContainer.appendChild(btn);
      });

      content.appendChild(tabContainer);

      const canvasContainer = document.createElement("div");
      canvasContainer.id = `canvas-container-${targetConst.replace('.', '_')}`;
      canvasContainer.style.position = "relative";
      canvasContainer.style.height = `${filtered.length * 28 + 50}px`;

      const canvas = document.createElement("canvas");
      canvas.id = `canvas-${targetConst.replace('.', '_')}`;
      canvasContainer.appendChild(canvas);
      content.appendChild(canvasContainer);

      wrapper.appendChild(header);
      wrapper.appendChild(content);

      pContent.appendChild(wrapper);
    });

    pWrapper.appendChild(pHeader);
    pWrapper.appendChild(pContent);
    container.appendChild(pWrapper);
  });
}

// 11. 各項目を切り替えた時のグラフ描画ロジック
function switchMetric(targetConst, metricKey, color, labelText, songs) {
  const isAll = targetConst === "all";
  const chartId = targetConst;
  const canvasId = isAll ? "canvas-all" : `canvas-${targetConst.replace('.', '_')}`;
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");

  let filtered = [];
  if (isAll) {
    filtered = [...songs];
  } else {
    filtered = songs.filter(s => {
      const songConstStr = s.constStr || (s.constant ? s.constant.toFixed(1) : "");
      return songConstStr === targetConst;
    });
  }

  const baseCost = isAll ? 16 : (baseCostMap[targetConst] || 16);
  let sorted = [...filtered];

  if (metricKey === "total") {
    sorted.sort((a, b) => {
      const diffA = (a.total || 0) - (a.baseCost || baseCost);
      const diffB = (b.total || 0) - (b.baseCost || baseCost);
      return diffB - diffA;
    });
  } else {
    sorted.sort((a, b) => (b[metricKey] || 0) - (a[metricKey] || 0));
    sorted = sorted.slice(0, isAll ? 50 : 20);
  }

  const containerId = isAll ? "canvas-container-all" : `canvas-container-${targetConst.replace('.', '_')}`;
  const containerEl = document.getElementById(containerId);
  if (containerEl) {
    containerEl.style.height = `${sorted.length * 28 + 50}px`;
  }

  const labels = sorted.map(s => {
    const constLabel = s.constant ? s.constant.toFixed(1) : (s.constStr || "");
    const titleString = isAll ? `[${constLabel}] ${s.title}` : s.title;

    // Y軸フォント「9px sans-serif」において最大「125ピクセル」の幅に曲名を制限
    const shortTitle = truncateByWidth(titleString, 125, "9px sans-serif");
    return `${shortTitle} (${s.diff})`;
  });

  const dataValues = sorted.map(s => {
    if (metricKey === "total") {
      return (s.total || 0) - (s.baseCost || baseCost);
    }
    return s[metricKey] || 0;
  });

  if (activeCharts[chartId]) {
    activeCharts[chartId].destroy();
  }

  let xMin = 0;
  let xMax = undefined;

  if (metricKey === "total") {
    xMin = -2;
    xMax = 2;
  }

  activeCharts[chartId] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        data: dataValues,
        backgroundColor: color,
        borderColor: color.replace("0.7", "1.0"),
        borderWidth: 1
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: function (context) {
              const index = context[0].dataIndex;
              const constLabel = sorted[index].constant ? sorted[index].constant.toFixed(1) : (sorted[index].constStr || "");
              return `[定数 ${constLabel}] ${sorted[index].title} (${sorted[index].diff})`;
            },
            label: function (context) {
              const val = context.raw;
              if (metricKey === "total") {
                const sign = val > 0 ? "+" : "";
                return ` ${labelText}: ${sign}${val.toFixed(2)} (基準: ${sorted[context.dataIndex].baseCost || baseCost})`;
              }
              return ` ${labelText}: ${val.toFixed(2)}`;
            }
          }
        }
      },
      scales: {
        x: {
          min: xMin,
          max: xMax,
          ticks: {
            stepSize: (metricKey === "total") ? 1 : undefined,
            callback: function (value) {
              if (Math.floor(value) === value) return value;
            }
          }
        },
        y: {
          ticks: { autoSkip: false, font: { size: 9 } }
        }
      }
    }
  });
}

// 12. 回答画面から戻る処理
function backToMainScreen() {
  document.getElementById("login-screen").style.display = "block";
  document.getElementById("analytics-section").style.display = "block";
  document.getElementById("main-screen").style.display = "none";
  document.getElementById("user-name-input").value = currentUserName;
  loadAnalyticsData();
}