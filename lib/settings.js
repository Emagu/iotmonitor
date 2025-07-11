import { google } from "googleapis";
import { getGoogleAuth } from "./googleAuth.js";

// 緩存設置數據，避免重複請求
let settingsCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分鐘緩存

export async function getSetting(deviceId) {
  // 檢查緩存是否有效
  const now = Date.now();
  if (settingsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    const setting = settingsCache.find(s => s.Id === deviceId);
    if (setting) {
      return setting;
    }
  }

  // 緩存過期或未找到設備，重新獲取數據
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SETTING_SHEET_ID,
    range: 'Setting!A1:H',
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) throw new Error("找不到設定資料");

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // 解析所有設置並緩存
  settingsCache = dataRows.map(row => {
    const setting = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    return {
      Id: setting.Id,
      FactoryName: setting.FactoryName || "",
      overHeat: parseFloat(setting.overHeat || 0),
      lowHeat: parseFloat(setting.lowHeat || 0),
      overLux: parseFloat(setting.overLux || 0),
      DataSheetFileId: setting.DataSheetFileId || "",
      DiscordWebhookToken: setting.DiscordWebhookToken || "",
      LineToken: (setting.LineToken || "").split(",").filter(Boolean),
    };
  });

  cacheTimestamp = now;

  // 返回指定設備的設置
  const targetSetting = settingsCache.find(s => s.Id === deviceId);
  return targetSetting || null;
}

// 清除緩存的方法（可在需要時調用）
export function clearSettingsCache() {
  settingsCache = null;
  cacheTimestamp = 0;
}
