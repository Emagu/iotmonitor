import admin from "firebase-admin";

// 獲取所有設備數據和統計信息
export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).send("Method not allowed");
    }

    try {
        // 初始化 Firebase
        const firebaseServiceAccount = JSON.parse(process.env.FIREBASE_CREDENTIAL);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseServiceAccount),
                databaseURL: "https://iot-monitor-50d03-default-rtdb.asia-southeast1.firebasedatabase.app"
            });
        }
        const db = admin.database();

        // 獲取所有設備數據（包含緩存的統計數據）
        const devicesSnapshot = await db.ref('/devices').once('value');
        const devicesData = devicesSnapshot.val();

        if (!devicesData) {
            return res.status(200).json({ devices: {} });
        }

        // 格式化返回數據
        const formattedDevices = {};
        for (const deviceId in devicesData) {
            const device = devicesData[deviceId];
            formattedDevices[deviceId] = {
                lastData: device.lastData || {},
                stats: device.stats || {
                    avgTemp: null,
                    maxTemp: null,
                    minTemp: null,
                    avgLight: null,
                    maxLight: null,
                    minLight: null,
                    dataCount: 0
                }
            };
        }

        res.status(200).json({ devices: formattedDevices });
    } catch (error) {
        console.error("Error fetching devices:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
