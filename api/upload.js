const admin = require("firebase-admin");
const { google } = require("googleapis");
const moment = require("moment");

// 初始化 Firebase
const firebaseServiceAccount = require("../firebase.json");
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(firebaseServiceAccount),
    databaseURL: "https://iot-monitor-50d03.firebaseio.com"
  });
}
const db = admin.database();

// 初始化 Google Sheets
const sheetServiceAccount = require("../sheet.json");
const jwt = new google.auth.JWT(
  sheetServiceAccount.client_email,
  null,
  sheetServiceAccount.private_key,
  ["https://www.googleapis.com/auth/spreadsheets"]
);
const sheets = google.sheets({ version: "v4", auth: jwt });

const SHEET_ID = "1PzPSUint7ELtH9LZE07nr1w5WjYvTwzdYUhhrNCA3mw"; // 目標 Google Sheets ID

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method not allowed");
  }

  const { deviceId, temperature, light, timestamp } = req.body;

  if (!deviceId || !timestamp) {
    return res.status(400).send("Missing required fields");
  }

  try {
    // 寫入 Firebase
    await db.ref(`/devices/${deviceId}/lastData`).set({
      temperature,
      light,
      timestamp
    });

    // 寫入 Google Sheets
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${deviceId}!A:D`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          moment().toISOString(), timestamp, temperature, light
        ]]
      }
    });

    res.status(200).send("Data uploaded");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal error");
  }
};
