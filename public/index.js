// 載入設備數據
async function loadDevices() {
    const contentDiv = document.getElementById('content');
    contentDiv.innerHTML = '<div class="loading">載入中...</div>';

    try {
        const response = await fetch('/api/devices');
        if (!response.ok) {
            throw new Error('無法載入設備數據');
        }

        const data = await response.json();
        
        if (!data.devices || Object.keys(data.devices).length === 0) {
            contentDiv.innerHTML = '<div class="no-devices">目前沒有設備數據</div>';
            return;
        }

        displayDevices(data.devices);
    } catch (error) {
        console.error('Error:', error);
        contentDiv.innerHTML = `<div class="error">錯誤: ${error.message}</div>`;
    }
}

// 顯示設備數據
function displayDevices(devices) {
    const contentDiv = document.getElementById('content');
    const devicesGrid = document.createElement('div');
    devicesGrid.className = 'devices-grid';

    Object.keys(devices).forEach(deviceId => {
        const device = devices[deviceId];
        const card = createDeviceCard(deviceId, device);
        devicesGrid.appendChild(card);
    });

    contentDiv.innerHTML = '';
    contentDiv.appendChild(devicesGrid);
}

// 創建設備卡片
function createDeviceCard(deviceId, device) {
    const card = document.createElement('div');
    card.className = 'device-card';

    const lastData = device.lastData || {};
    const stats = device.stats || {};
    const now = Date.now();
    const isOnline = lastData.post_at && (now - new Date(lastData.post_at) - 8 * 60 * 60 * 1000) < 60000; // 1分鐘內為在線

    // 使用 stats 中的 factoryName，如果沒有則使用設備ID
    const displayName = stats.factoryName || deviceId;

    card.innerHTML = `
        <div class="device-header">
            <div class="device-id">📱 ${displayName}</div>
            <div class="device-status ${isOnline ? 'status-online' : 'status-offline'}">
                ${isOnline ? '🟢 在線' : '🔴 離線'}
            </div>
        </div>

        <div class="current-data">
            <h3 style="margin-bottom: 15px; color: #333;">📊 即時數據</h3>
            <div class="data-row">
                <span class="data-label">溫度:</span>
                <span class="data-value temp-value">${lastData.temperature ? lastData.temperature + '°C' : '無數據'}</span>
            </div>
            <div class="data-row">
                <span class="data-label">光照:</span>
                <span class="data-value light-value">${lastData.light ? lastData.light + ' lux' : '無數據'}</span>
            </div>
            <div class="data-row">
                <span class="data-label">最後更新:</span>
                <span class="data-value">${lastData.post_at ? formatTime(lastData.post_at) : '無數據'}</span>
            </div>
        </div>

        <div class="stats-section">
            <div class="stats-title">📈 最近10分鐘統計</div>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-label">平均溫度</div>
                    <div class="stat-value temp-value">${stats.avgTemp ? stats.avgTemp.toFixed(1) + '°C' : '無數據'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">最高溫度</div>
                    <div class="stat-value temp-value">${stats.maxTemp ? stats.maxTemp + '°C' : '無數據'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">最低溫度</div>
                    <div class="stat-value temp-value">${stats.minTemp ? stats.minTemp + '°C' : '無數據'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">平均光照</div>
                    <div class="stat-value light-value">${stats.avgLight ? stats.avgLight.toFixed(0) + ' lux' : '無數據'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">最高光照</div>
                    <div class="stat-value light-value">${stats.maxLight ? stats.maxLight + ' lux' : '無數據'}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">最低光照</div>
                    <div class="stat-value light-value">${stats.minLight ? stats.minLight + ' lux' : '無數據'}</div>
                </div>
            </div>
        </div>
        <!-- 新增：操作按鈕區域 -->
        <div class="action-footer" style="margin-top: 20px; text-align: center;">
            <button 
                onclick="window.open('./chart.html?device_id=${encodeURIComponent(deviceId)}&title=單日監控折線圖(${encodeURIComponent(displayName)})', '_blank')" 
                style="
                    background-color: #007AFF; 
                    color: white; 
                    border: none; 
                    padding: 10px 20px; 
                    border-radius: 8px; 
                    cursor: pointer; 
                    font-size: 14px;
                    width: 100%;
                    transition: background-color 0.3s;
                "
                onmouseover="this.style.backgroundColor='#0051a8'"
                onmouseout="this.style.backgroundColor='#007AFF'"
            >
                查看今日數據 ↗
            </button>
        </div>
    `;

    return card;
}

// 格式化時間
function formatTime(timestamp) {
    let date = new Date(new Date(timestamp).getTime() + 8 * 60 * 60 * 1000); // 調整為台北時間
    return date.toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 頁面載入時自動載入數據
document.addEventListener('DOMContentLoaded', loadDevices);

// 每30秒自動重新整理
setInterval(loadDevices, 30000);