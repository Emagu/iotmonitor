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
      "INSERT INTO devices (device_id, temperature, light, post_at) VALUES (?, ?, ?, datetime(?, 'unixepoch'))"
    ).bind(deviceId, temperature, light, timestamp).run();

    return new Response("Data uploaded", { status: 200 })
  } catch (error) {
    console.error(error)
    return new Response("Internal error", { status: 500 })
  }
}