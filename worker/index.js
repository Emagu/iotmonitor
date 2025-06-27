import { handleUpload } from './upload'

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/api/upload') return handleUpload(request, env, ctx)
    // if (url.pathname === '/api/syncToSheets') return handleSyncToSheets(request, env, ctx)
    // if (url.pathname === '/api/checkAlerts') return handleCheckAlerts(request, env, ctx)
    // if (url.pathname === '/api/devices') return handleDevices(request, env, ctx)
    // 靜態檔案交給 [site] bucket 處理
    return env.ASSETS.fetch(request)
  }
}