import { google } from "googleapis";
import { readFileSync } from "fs";
import path from "path";
import { getGoogleAuth } from "./googleAuth.js";

export async function getSetting(deviceId) {
  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });
  
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SETTING_SHEET_ID,
    range: 'Setting!A2:D',
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) throw new Error("找不到設定資料");

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const targetRow = dataRows.find(row => row[0] === deviceId);
  if (!targetRow) return null;

  const setting = Object.fromEntries(headers.map((h, i) => [h, targetRow[i]]));

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
}
