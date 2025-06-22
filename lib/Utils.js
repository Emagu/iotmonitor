// lib/utils.js
/**
 * 驗證是否為合法的 deviceId，可根據實際命名規則調整
 */
export function isValidDeviceId(id) {
    return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * 安全轉換字串為 float（若無效則回傳 null）
 */
export function safeParseFloat(val) {
    const num = parseFloat(val);
    return isNaN(num) ? null : num;
}

/**
 * 檢查欄位是否存在且有效
 */
export function validatePayload(body, keys) {
    const missing = keys.filter(k => !body[k]);
    return {
        ok: missing.length === 0,
        missing
    };
}

/**
 * 取得 yyyy/MM/dd 格式字串
 */
export function GetDateFormat(dateTime) {
    return new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        dateStyle: 'short'
    }).format(dateTime);
}

/**
 * 取得 yyyy/MM/dd HH:mm:ss 格式字串
 */
export function GetTimeFormat(dateTime) {
    return new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        dateStyle: 'short',
        timeStyle: 'short',
    }).format(dateTime);
}

/**
 * 將 Google Sheets 的一列轉為設定物件
 */
export function parseSettingRow(headers, row) {
    const obj = Object.fromEntries(headers.map((h, i) => [h, row[i]]));
    return {
        Id: obj.Id,
        FactoryName: obj.FactoryName || "",
        overHeat: safeParseFloat(obj.overHeat),
        lowHeat: safeParseFloat(obj.lowHeat),
        overLux: safeParseFloat(obj.overLux),
        DataSheetFileId: obj.DataSheetFileId || "",
        DiscordWebhookToken: obj.DiscordWebhookToken || "",
        LineToken: (obj.LineToken || "").split(",").filter(Boolean),
    };
}

/**
 * 檢查 Google Sheets 中是否存在指定分頁，若無則建立
 * @param {object} sheets - Google Sheets API 客戶端
 * @param {string} spreadsheetId - 該 Sheets 的 ID
 * @param {string} sheetName - 要檢查/建立的工作表名稱
 */
export async function ensureSheetExists(sheets, spreadsheetId, sheetName) {
    const meta = await sheets.spreadsheets.get({
        spreadsheetId
    });
    const sheet = meta.data.sheets.find(s => s.properties.title === sheetName);
    if (!sheet) {
        console.log(`Created new sheet tab: ${sheetName}`);
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [{
                    addSheet: {
                        properties: {
                            title: sheetName,
                        },
                    },
                }, ],
            },
        });

        // 新增標題列
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1:D1`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [
                    ["溫度", "光度", "時間", "時間戳"]
                ],
            },
        });
    }
}