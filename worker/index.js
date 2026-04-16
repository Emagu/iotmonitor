import { handleUpload } from './upload'
import { handlerDevices } from './devices'
import { checkAlertTask } from './tasks/checkAlerts'
import { statsTask } from './tasks/stats'
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    if (url.pathname === '/api/upload') return handleUpload(request, env, ctx);
    if (url.pathname === '/api/devices') return handlerDevices(request, env, ctx);
    // 靜態檔案交給 [site] bucket 處理
    return env.ASSETS.fetch(request)
  },
  async scheduled(event, env, ctx) {
    if (event.cron === "* * * * *") {
      await checkAlertTask(env);
    } 
    if (event.cron === "*/10 * * * *") {
      await statsTask(env);
    } 
  }
}