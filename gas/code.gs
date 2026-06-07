/**
 * Webアンケートページにアクセスした際に画面（Index.html）を表示する
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('チュウニズム譜面傾向アンケート')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * MasterDataから15.0〜15.4の楽曲を抽出し、ユーザーの過去回答と結合してフロント（画面）に返す
 */
function getMasterAndUserData(playerName) {
  if (!playerName) return { status: "error", message: "ユーザー名が空です" };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName("MasterData");
  if (!masterSheet) return { status: "error", message: "MasterDataシートが見つかりません" };
  
  const masterData = masterSheet.getDataRange().getValues();
  const songs = [];
  const baseCostMap = { "15.0": 16, "15.1": 18, "15.2": 20, "15.3": 22, "15.4": 24 };

  for (let i = 1; i < masterData.length; i++) {
    const title = String(masterData[i][0] || "").trim();
    const diff = String(masterData[i][1] || "").trim();
    const constant = parseFloat(masterData[i][2]);
    
    if (!isNaN(constant) && constant >= 15.0 && constant <= 15.4) {
      const constStr = constant.toFixed(1);
      songs.push({
        title: title,
        diff: diff,
        constant: constant,
        constStr: constStr,
        baseCost: baseCostMap[constStr] || 16,
        tairyoku: 0, kenban: 0, chuni: 0, kuse: 0, total: 0
      });
    }
  }

  const answerSheet = ss.getSheetByName("アンケート回答");
  if (answerSheet && answerSheet.getLastRow() > 1) {
    const ansData = answerSheet.getDataRange().getValues();
    const userAnsMap = {};
    for (let j = 1; j < ansData.length; j++) {
      if (String(ansData[j][0]).trim() === playerName.trim()) {
        const key = String(ansData[j][1]).trim() + "_" + String(ansData[j][2]).trim();
        userAnsMap[key] = {
          tairyoku: parseInt(ansData[j][4]) || 0,
          kenban: parseInt(ansData[j][5]) || 0,
          chuni: parseInt(ansData[j][6]) || 0,
          kuse: parseInt(ansData[j][7]) || 0,
          total: parseInt(ansData[j][8]) || 0
        };
      }
    }

    songs.forEach(song => {
      const key = song.title + "_" + song.diff;
      if (userAnsMap[key]) {
        song.tairyoku = userAnsMap[key].tairyoku;
        song.kenban = userAnsMap[key].kenban;
        song.chuni = userAnsMap[key].chuni;
        song.kuse = userAnsMap[key].kuse;
        song.total = userAnsMap[key].total;
      }
    });
  }

  return { status: "success", songs: songs };
}

/**
 * 【超軽量・高速】特定のタブの回答データを保存・上書きする（集計は行わない）
 */
function saveTabAnswers(playerName, answers) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return { status: "error", message: "システムが混雑しています。時間を置いて再度お試しください。" };
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("アンケート回答") || ss.insertSheet("アンケート回答");
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["ユーザー名", "楽曲名", "難易度", "定数", "体力", "鍵盤", "チュウニズム力", "癖", "合計", "最終更新日時"]);
    }

    let sheetData = sheet.getDataRange().getValues();
    const timestamp = new Date();

    const rowMap = {};
    for (let i = 1; i < sheetData.length; i++) {
      const key = String(sheetData[i][0]).trim() + "_" + String(sheetData[i][1]).trim() + "_" + String(sheetData[i][2]).trim();
      rowMap[key] = i + 1;
    }

    // データの高速保存処理
    answers.forEach(ans => {
      const key = playerName.trim() + "_" + ans.title.trim() + "_" + ans.diff.trim();
      const rowData = [playerName, ans.title, ans.diff, ans.constant, ans.tairyoku, ans.kenban, ans.chuni, ans.kuse, ans.total, timestamp];

      if (rowMap[key]) {
        sheet.getRange(rowMap[key], 1, 1, rowData.length).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
        rowMap[key] = sheet.getLastRow();
      }
    });

    SpreadsheetApp.flush();
    return { status: "success" };
    
  } catch (e) {
    return { status: "error", message: e.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 【管理者用・手動実行】
 * 「アンケート回答」から最新データを読み込み、集計して「MasterData」を一括更新する関数
 */
function executeAggregation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const answerSheet = ss.getSheetByName("アンケート回答");
  const masterSheet = ss.getSheetByName("MasterData");
  
  if (!answerSheet || !masterSheet) {
    Logger.log("シートが見つかりません。確認してください。");
    return;
  }
  
  const sheetData = answerSheet.getDataRange().getValues();
  if (sheetData.length <= 1) {
    Logger.log("アンケート回答データがまだありません。");
    return;
  }

  Logger.log("集計処理を開始します...");

  // 全ユーザーの回答を「曲名_難易度」ごとに集計するマップ
  const aggMap = {};
  for (let k = 1; k < sheetData.length; k++) {
    const title = String(sheetData[k][1]).trim();
    const diff = String(sheetData[k][2]).trim();
    const matchKey = title + "_" + diff;

    if (!aggMap[matchKey]) {
      aggMap[matchKey] = { tairyoku: 0, kenban: 0, chuni: 0, kuse: 0, total: 0, count: 0 };
    }
    
    aggMap[matchKey].tairyoku += parseFloat(sheetData[k][4]) || 0;
    aggMap[matchKey].kenban += parseFloat(sheetData[k][5]) || 0;
    aggMap[matchKey].chuni += parseFloat(sheetData[k][6]) || 0;
    aggMap[matchKey].kuse += parseFloat(sheetData[k][7]) || 0;
    aggMap[matchKey].total += parseFloat(sheetData[k][8]) || 0;
    aggMap[matchKey].count += 1;
  }

  const masterData = masterSheet.getDataRange().getValues();
  const updateRows = [];

  // 各楽曲の平均値を算出
  for (let m = 1; m < masterData.length; m++) {
    const mTitle = String(masterData[m][0]).trim();
    const mDiff = String(masterData[m][1]).trim();
    const mKey = mTitle + "_" + mDiff;

    let avgTairyoku = 0, avgKenban = 0, avgChuni = 0, avgKuse = 0, avgTotal = 0;

    if (aggMap[mKey] && aggMap[mKey].count > 0) {
      const cnt = aggMap[mKey].count;
      avgTairyoku = Math.round((aggMap[mKey].tairyoku / cnt) * 100) / 100;
      avgKenban = Math.round((aggMap[mKey].kenban / cnt) * 100) / 100;
      avgChuni = Math.round((aggMap[mKey].chuni / cnt) * 100) / 100;
      avgKuse = Math.round((aggMap[mKey].kuse / cnt) * 100) / 100;
      avgTotal = Math.round((aggMap[mKey].total / cnt) * 100) / 100;
    }

    updateRows.push([avgTairyoku, avgKenban, avgChuni, avgKuse, avgTotal]);
  }

  // MasterDataのE列（5列目）〜I列へまとめて一括書き込み（超高速）
  if (updateRows.length > 0) {
    masterSheet.getRange(2, 5, updateRows.length, 5).setValues(updateRows);
  }

  SpreadsheetApp.flush();
  Logger.log("手動集計が正常に完了しました！");
}

/**
 * 【便利機能】スプレッドシートを開いた際、上部メニューに「手動集計ボタン」を設置する
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu(' アンケート管理')
    .addItem('最新の回答を集計する', 'executeAggregation')
    .addToUi();
}
