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
      maxTemp=CASE \
        WHEN window_start is null OR datetime('now') >= datetime(window_start, '+10 minutes') THEN excluded.lastTemp \
        ELSE MAX(device_status.maxTemp, excluded.lastTemp) \
      END, \
      minTemp=CASE \
        WHEN window_start is null OR datetime('now') >= datetime(window_start, '+10 minutes') THEN excluded.lastTemp \
        ELSE MIN(device_status.minTemp, excluded.lastTemp) \
      END, \
      lastLight=excluded.lastLight, \
      avgLight=(device_status.avgLight * 9 + excluded.lastLight) / 10, \
      maxLight=CASE \
        WHEN window_start is null OR datetime('now') >= datetime(window_start, '+10 minutes') THEN excluded.lastLight \
        ELSE MAX(device_status.maxLight, excluded.lastLight) \
      END, \
      minLight=CASE \
        WHEN window_start is null OR datetime('now') >= datetime(window_start, '+10 minutes') THEN excluded.lastLight \
        ELSE MIN(device_status.minLight, excluded.lastLight) \
      END, \
      maxTempFullDay=CASE \
        WHEN maxTempFullDay is null THEN excluded.lastTemp \
        ELSE MAX(device_status.maxTempFullDay, excluded.lastTemp)
      END, \
      minTempFullDay=CASE \
        WHEN minTempFullDay is null THEN excluded.lastTemp \
        ELSE MIN(device_status.minTempFullDay, excluded.lastTemp)
      END, \
      maxlightFullDay=CASE \
        WHEN maxlightFullDay is null THEN excluded.lastLight \
        ELSE MAX(device_status.maxlightFullDay, excluded.lastLight)
      END, \
      maxTempTime=CASE \
        WHEN maxTempFullDay is null or device_status.maxTempFullDay < excluded.lastTemp THEN datetime('now') \
        ELSE device_status.maxTempTime \
      END, \
      minTempTime=CASE \
        WHEN minTempFullDay is null or device_status.minTempFullDay > excluded.lastTemp THEN datetime('now') \
        ELSE device_status.minTempTime \
      END, \
      maxlightTime=CASE \
        WHEN maxlightFullDay is null or device_status.maxlightFullDay < excluded.lastLight THEN datetime('now') \
        ELSE device_status.maxlightTime \
      END, \
      window_start=CASE \
        WHEN window_start is null OR datetime('now') >= datetime(window_start, '+10 minutes') THEN datetime('now') \
        ELSE window_start \
      END, \
      modifyDate=excluded.modifyDate`
    ).bind(deviceId, temperature, light).run();
    return new Response("Data uploaded", { status: 200 })
  } catch (error) {
    console.log("Error occurred while uploading data:", error);
    return new Response("Internal error", { status: 500 })
  }
}