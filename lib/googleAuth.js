// lib/googleAuth.js
import { google } from "googleapis";

let cachedAuth = null;

/**
 * 初始化並回傳 Google JWT 驗證客戶端
 */
export function getGoogleAuth() {
  if (cachedAuth) return cachedAuth;

  if (!process.env.SHEET_CREDENTIAL) {
    throw new Error("缺少 SHEET_CREDENTIAL 環境變數");
  }
	
  const serviceAccount = JSON.parse(process.env.SHEET_CREDENTIAL);
  const jwt = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key.replace(/\\n/g, "\n"), // 修正 Vercel 會將 \n 編碼為字串
    ["https://www.googleapis.com/auth/spreadsheets"]
  );

  cachedAuth = jwt;
  return jwt;
}
