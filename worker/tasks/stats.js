// 定時任務處理函數 - 統計近10分資料任務
export async function statsTask(env) {
    try {
        const { results: settings } = await env.DB.prepare("SELECT * FROM settings").all();
        const { results: devicesData } = await env.DB.prepare("SELECT * FROM devices WHERE created_at >= datetime('now', '-10 minutes')").all();

        if (!devicesData || devicesData.length === 0) {
            console.log("Stats: No data in the last 10 minutes.");
            return;
        }

        const statsResult = await updateStats(env, settings, devicesData);
        console.log(`Stats: ${statsResult}`);
    } catch (error) {
        console.error("Stats error:", error);
    }
}

async function updateStats(env, settings, devicesData) {
    const statements = [];

    settings.forEach((device) => {
        const dId = device.device_Id || device.device_id; // 預防大小寫不一
        const data = devicesData.filter(d => d.device_id === dId);
        
        if (data.length === 0) return;

        const stats = calculateStats(data);
        
        const stmt = env.DB.prepare(`
            INSERT INTO deviceStats (
                device_id, avgTemp, maxTemp, minTemp, 
                avgLight, maxLight, minLight, dataCount, modifyDate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(device_id) DO UPDATE SET
                avgTemp = excluded.avgTemp,
                maxTemp = excluded.maxTemp,
                minTemp = excluded.minTemp,
                avgLight = excluded.avgLight,
                maxLight = excluded.maxLight,
                minLight = excluded.minLight,
                dataCount = excluded.dataCount,
                modifyDate = CURRENT_TIMESTAMP
        `).bind(
            dId, stats.avgTemp, stats.maxTemp, stats.minTemp, 
            stats.avgLight, stats.maxLight, stats.minLight, stats.dataCount
        );
        
        statements.push(stmt);
    });

    if (statements.length > 0) {
        await env.DB.batch(statements); // 大幅提升效能
        return `Updated ${statements.length} devices`;
    }
    return "No devices updated";
}

// 計算統計數據
function calculateStats(data) {
    if (!data) {
        return {
            avgTemp: null,
            maxTemp: null,
            minTemp: null,
            avgLight: null,
            maxLight: null,
            minLight: null,
            dataCount: 0
        };
    }

    const temperatures = [];
    const lights = [];
    
    // 收集所有數據
    data.forEach(record => {
        if (record.temperature !== undefined && record.temperature !== null) {
            temperatures.push(record.temperature);
        }
        if (record.light !== undefined && record.light !== null) {
            lights.push(record.light);
        }
    });

    // 計算統計數據
    const stats = {
        avgTemp: temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : null,
        maxTemp: temperatures.length > 0 ? Math.max(...temperatures) : null,
        minTemp: temperatures.length > 0 ? Math.min(...temperatures) : null,
        avgLight: lights.length > 0 ? lights.reduce((a, b) => a + b, 0) / lights.length : null,
        maxLight: lights.length > 0 ? Math.max(...lights) : null,
        minLight: lights.length > 0 ? Math.min(...lights) : null,
        dataCount: data.length
    };

    return stats;
} 