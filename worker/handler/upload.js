export async function handleUpload(request, env, ctx) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 })
  }

  const body = await request.json()
  const { deviceId, temperature, light, timestamp, token } = body

  if (token !== env.API_REQUEST_PWD) {
    return new Response("no auth", { status: 401 })
  }
  if (!deviceId || !timestamp) {
    return new Response("Missing required fields", { status: 400 })
  }

  try {
    // 寫入 D1 資料庫
    await env.DB.prepare(
      `INSERT INTO device_status (device_id, lastTemp, lastLight) VALUES (?, ?, ?) \
      on conflict(device_id) do update set \
      lastTemp=excluded.lastTemp, \
      avgTemp=(device_status.avgTemp * 9 + excluded.lastTemp) / 10, \
      maxTemp=MAX(device_status.maxTemp, excluded.lastTemp), \
      minTemp=MIN(device_status.minTemp, excluded.lastTemp), \
      lastLight=excluded.lastLight, \
      avgLight=(device_status.avgLight * 9 + excluded.lastLight) / 10, \
      maxLight=MAX(device_status.maxLight, excluded.lastLight), \
      minLight=MIN(device_status.minLight, excluded.lastLight), \
      modifyDate=excluded.modifyDate`
    ).bind(deviceId, temperature, light).run();

    const now = new Date();
    const minutes = now.getUTCMinutes(); // 取得目前的「分」
    const seconds = now.getUTCSeconds(); // 取得目前的「秒」
    // 判定是否為 10 的倍數，且在該分鐘的前 30 秒內 (避免 30秒一次的上傳觸發兩次)
    const isTenMinuteMark = minutes % 10 === 0 && seconds < 30;
    if (isTenMinuteMark) {
      //寫入device_history資料庫
      await env.DB.prepare(
        `INSERT INTO device_history (device_id, temperature, light, post_at) VALUES (SELECT device_id, avgTemp, avgLight, datetime('now') FROM device_status WHERE device_id = ?)`
      ).bind(deviceId).run();
    }
    return new Response("Data uploaded", { status: 200 })
  } catch (error) {
    console.log("Error occurred while uploading data:", error);
    return new Response("Internal error", { status: 500 })
  }
}