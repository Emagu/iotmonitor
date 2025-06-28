export default async function handler(req, res) {
    // 只允許 POST 請求
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    // 檢查 API Token
    const apiToken = req.headers['x-api-token'] || req.body.token;
    if (apiToken !== process.env.API_REQUEST_PWD) {
        return res.status(401).json({ error: "Invalid API token" });
    }

    try {
        const {
            deviceId,
            timestamp,
            msg
        } = req.body;

        // 驗證必要欄位
        if (!deviceId || !timestamp) {
            return res.status(400).json({ 
                error: "Missing required fields: deviceId and timestamp are required" 
            });
        }

        // 準備記錄資料
        const logData = {
            deviceId,
            msg,
            timestamp: new Date(timestamp).getTime(),
            createdAt: Date.now(),
            ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
        };

        // 範例：簡單的 console.log（在 Vercel 中會顯示在函數日誌）
        console.log('Upload Log:', JSON.stringify(logData, null, 2));

        // 回傳成功訊息
        res.status(200).json({
            success: true
        });

    } catch (error) {
        console.error('Log API Error:', error);
        res.status(500).json({ 
            error: "Internal server error",
            message: error.message 
        });
    }
} 