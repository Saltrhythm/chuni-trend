let globalSongs = []; 
let currentTabStr = "15.0";
let currentUserName = "";
const activeCharts = {}; // チャートインスタンス保持用

// 定数ごとの基準コストマップ（表示更新用）
const baseCostMap = { "15.0": 16, "15.1": 18, "15.2": 20, "15.3": 22, "15.4": 24 };

// ページを開いた瞬間に実行
window.onload = function() {
  loadAnalyticsData();
};

// 1. 全体集計ランキングのデータをGASから取得して初期化
function loadAnalyticsData() {
  const container = document.getElementById("drawer-container");
  if (!container.innerHTML || container.innerHTML.includes("ユーザー名入力後")) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#8e8e93; font-size:12px; background:#f2f2f7; border-radius:8px;">ランキングデータを読み込み中...</div>';
  }

  const url = `${GAS_URL}?action=getData&playerName=`;
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

  const url = `${GAS_URL}?action=getData&playerName=${encodeURIComponent(currentUserName)}`;
  
  fetch(url)
    .then(response => response.json())
    .then((res) => {
      document.getElementById("loading").style.display = "none";
      if (res.status === "success") {
        globalSongs = res.songs;
        document.getElementById("display-user-name").innerText = currentUserName;
        document.getElementById("main-screen").style.display = "block";
        updateBaseCostDisplay(); 
        renderSongs(); 
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
    btn.classList.toggle("active", btn.innerText === tabStr);
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

// 5. 楽曲カード一覧を画面に出力（検索・未回答フィルタ反映）
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
        statusHtml = '<div class="calc-result status-ok">✓ OK (適正)</div>';
      } else {
        cardClass = "song-card card-editing";
        statusHtml = `<div class="calc-result status-ng">✕ 範囲外 (${song.total})</div>`;
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
          <select class="cost-select in-tairyoku" onchange="updateCost(${globalIndex})">${getOptions(song.tairyoku)}</select>
        </div>
        <div class="param-row">
          <label>鍵盤<span class="param-desc">(指押しの技術が必要なもの)</span></label>
          <select class="cost-select in-kenban" onchange="updateCost(${globalIndex})">${getOptions(song.kenban)}</select>
        </div>
        <div class="param-row">
          <label>チュウニ力<span class="param-desc">(タプスラ、フリック、交差、縦連判定への耐性が必要なもの)</span></label>
          <select class="cost-select in-chuni" onchange="updateCost(${globalIndex})">${getOptions(song.chuni)}</select>
        </div>
        <div class="param-row">
          <label>癖<span class="param-desc">(長い縦連や片手トリル、ソフラン、極度のリズム難など、類似譜面が非常に少ないもの)</span></label>
          <select class="cost-select in-kuse" onchange="updateCost(${globalIndex})">${getOptions(song.kuse)}</select>
        </div>
        
        <div class="status-container">
          <div>現在の合計: <span class="total-badge current-total">${song.total}</span></div>
          <div class="status-box">${statusHtml}</div>
        </div>
      </div>
    `;
    wrapper.insertAdjacentHTML('beforeend', html);
  });

  checkTabValidity();
}

// セレクトボックスの0〜26までの選択肢作成
function getOptions(selectedVal) {
  let options = "";
  for (let c = 0; c <= 26; c++) {
    options += `<option value="${c}" ${c === selectedVal ? 'selected' : ''}>${c}</option>`;
  }
  return options;
}

// 6. ユーザーがコストを変更した時のリアルタイム計算とカード色変化
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
    statusBox.innerHTML = '<div class="calc-result status-ok">✓ OK (適正)</div>';
  } else {
    card.className = "song-card card-editing";
    if (total < minV) {
      statusBox.innerHTML = `<div class="calc-result status-ng">✕ あと ${minV - total} 不足</div>`;
    } else {
      statusBox.innerHTML = `<div class="calc-result status-ng">✕ ${total - maxV} オーバー</div>`;
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

// 8. 範囲外エラーが1つでもある場合、保存ボタンを押せないように制御
function checkTabValidity() {
  const tabSongs = globalSongs.filter(s => {
    const songConstStr = s.constStr || (s.constant ? s.constant.toFixed(1) : "");
    return songConstStr === currentTabStr;
  });
  let canSave = true;
  
  for (let i = 0; i < tabSongs.length; i++) {
    const s = tabSongs[i];
    const minV = s.baseCost - 2;
    const maxV = s.baseCost + 2;
    if (s.total !== 0 && (s.total < minV || s.total > maxV)) {
      canSave = false;
      break;
    }
  }
  
  const btn = document.getElementById("save-btn");
  if (canSave) {
    btn.disabled = false;
    btn.innerText = `定数 ${currentTabStr} の回答を保存する`;
    btn.style.background = "#34c759"; 
  } else {
    btn.disabled = true;
    btn.innerText = "範囲外のエラー曲を修正してください";
    btn.style.background = "#aeaeb2"; 
  }
}

// 9. API経由で現在の定数枠をスプレッドシートに保存
function saveCurrentTab() {
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.innerText = "保存処理中...";
  
  const currentTabSongs = globalSongs.filter(s => {
    const songConstStr = s.constStr || (s.constant ? s.constant.toFixed(1) : "");
    return songConstStr === currentTabStr;
  });
  
  if (currentTabSongs.length === 0) {
    alert("有効な楽曲データがありません。");
    btn.disabled = false;
    checkTabValidity();
    return;
  }

  const url = `${GAS_URL}?action=save&playerName=${encodeURIComponent(currentUserName)}&answers=${encodeURIComponent(JSON.stringify(currentTabSongs))}`;

  fetch(url)
    .then(response => response.json())
    .then((res) => {
      if (res.status === "success") {
        alert(`定数 ${currentTabStr} のデータを保存しました！`);
        renderSongs(); 
      } else {
        alert("保存エラー: " + res.message);
        btn.disabled = false;
      }
    })
    .catch((err) => {
      alert("通信エラーが発生しました: " + err);
      btn.disabled = false;
    });
}

// 10. 📊 傾向分析ランキングのアコーディオン生成
function initAnalytics(songs) {
  const container = document.getElementById("drawer-container");
  container.innerHTML = ""; 

  const constants = ["15.0", "15.1", "15.2", "15.3", "15.4"];
  const metrics = [
    { key: "total",    label: "逆詐称/詐称度", color: "rgba(255, 99, 132, 0.7)" },
    { key: "tairyoku",  label: "体力要求度",   color: "rgba(54, 162, 235, 0.7)" },
    { key: "kenban",    label: "鍵盤力要求度", color: "rgba(255, 206, 86, 0.7)" },
    { key: "chuni",     label: "チュウニ力要求度",   color: "rgba(75, 192, 192, 0.7)" },
    { key: "kuse",      label: "癖度",         color: "rgba(153, 102, 255, 0.7)" }
  ];

  if (!songs || songs.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:#ff3b30; font-size:12px; background:#f2f2f7; border-radius:8px;">有効なデータが見つかりませんでした</div>';
    return;
  }

  constants.forEach(targetConst => {
    const filtered = songs.filter(s => {
      const songConstStr = s.constStr || (s.constant ? s.constant.toFixed(1) : "");
      return songConstStr === targetConst;
    });
    
    if (filtered.length === 0) return;

    const wrapper = document.createElement("div");
    wrapper.className = "drawer-wrapper";

    const header = document.createElement("button");
    header.className = "drawer-header";
    header.innerHTML = `<span>定数枠 ${targetConst} (${filtered.length}曲)</span> <span>🔽</span>`;
    
    const content = document.createElement("div");
    content.className = "drawer-content";
    content.id = `drawer-content-${targetConst.replace('.', '_')}`;

    header.onclick = () => {
      const isVisible = content.style.display === "block";
      content.style.display = isVisible ? "none" : "block";
      header.querySelector("span:last-child").innerText = isVisible ? "🔽" : "🔼";
      
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
    container.appendChild(wrapper);
  });
}

// 11. 各項目を切り替えた時のグラフ描画ロジック（逆詐称/詐称度を基準コストからの差分に変更）
function switchMetric(targetConst, metricKey, color, labelText, songs) {
  const chartId = targetConst;
  const canvasId = `canvas-${targetConst.replace('.', '_')}`;
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");

  const filtered = songs.filter(s => {
    const songConstStr = s.constStr || (s.constant ? s.constant.toFixed(1) : "");
    return songConstStr === targetConst;
  });
  
  const baseCost = baseCostMap[targetConst] || 16;

  // 💡 データのソートとマッピング
  let sorted = [...filtered];
  
  if (metricKey === "total") {
    // 逆詐称/詐称度の場合は「合計 - 基準コスト（差分）」が大きい順にソート
    sorted.sort((a, b) => {
      const diffA = (a.total || 0) - (a.baseCost || baseCost);
      const diffB = (b.total || 0) - (b.baseCost || baseCost);
      return diffB - diffA;
    });
  } else {
    // その他の項目は従来通り要求度が高い順にソートし、上位20件に絞る
    sorted.sort((a, b) => (b[metricKey] || 0) - (a[metricKey] || 0));
    sorted = sorted.slice(0, 20);
  }

  const containerEl = document.getElementById(`canvas-container-${targetConst.replace('.', '_')}`);
  if (containerEl) {
    containerEl.style.height = `${sorted.length * 28 + 50}px`;
  }

  // スマホでの表示潰れを防ぐためグラフ内は10文字に制限
  const labels = sorted.map(s => {
    const shortTitle = s.title.length > 10 ? s.title.substring(0, 10) + "..." : s.title;
    return `${shortTitle} (${s.diff})`;
  });

  // 💡 グラフに渡す数値を計算
  const dataValues = sorted.map(s => {
    if (metricKey === "total") {
      // 逆詐称/詐称度のときは「回答の合計 - その曲の基準コスト」で -2 ～ +2 のデータを生成
      return (s.total || 0) - (s.baseCost || baseCost);
    }
    return s[metricKey] || 0;
  });

  if (activeCharts[chartId]) {
    activeCharts[chartId].destroy();
  }

  // 💡 横軸（X軸）の範囲設定
  let xMin = 0;
  let xMax = baseCost + 2; 

  if (metricKey === "total") {
    xMin = -2; // 基準より低い（逆詐称）
    xMax = 2;  // 基準より高い（詐称）
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
            title: function(context) {
              const index = context[0].dataIndex;
              return `${sorted[index].title} (${sorted[index].diff})`;
            },
            label: function(context) {
              // 💡 ツールチップの表示テキストも調整
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
            stepSize: 1, // 横軸は整数目盛り（-2, -1, 0, 1, 2）
            callback: function(value) {
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