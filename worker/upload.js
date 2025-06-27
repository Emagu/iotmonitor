import * as utils from '../lib/Utils.js'

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
    // 準備數據
    const recordTime = new Date(timestamp)
    const queueData = {
      deviceId,
      temperature,
      light,
      timestamp: recordTime.getTime(),
      timeFormatted: utils.GetTimeFormat(recordTime),
      dateFormatted: utils.GetDateFormat(recordTime),
      createdAt: Date.now()
    }

    // Firebase REST API URL
    const dbUrl = "https://iot-monitor-50d03-default-rtdb.asia-southeast1.firebasedatabase.app"
    const updates = {
      [`/devices/${deviceId}/lastData`]: {
        temperature,
        light,
        timestamp
      },
      [`/dataQueue/${deviceId}/${Date.now()}`]: queueData
    }

    // 批量寫入（REST API 沒有 update 多路徑，需多次請求或用自定義 Cloud Function）
    // 這裡用 Promise.all 兩次 PATCH
    await Promise.all([
      fetch(`${dbUrl}/devices/${deviceId}/lastData.json?auth=${env.FIREBASE_DB_SECRET}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ temperature, light, timestamp })
      }),
      fetch(`${dbUrl}/dataQueue/${deviceId}/${Date.now()}.json?auth=${env.FIREBASE_DB_SECRET}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(queueData)
      })
    ])

    return new Response("Data uploaded", { status: 200 })
  } catch (error) {
    console.error(error)
    return new Response("Internal error", { status: 500 })
  }
}