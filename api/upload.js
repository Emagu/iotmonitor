import admin from "firebase-admin";
import {
    google
} from "googleapis";
import {
    getGoogleAuth
} from "../lib/googleAuth.js";
import {
    getSetting
} from "../lib/settings.js";
import * as utils from "../lib/Utils.js";



// 改為 export default
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).send("Method not allowed");
    }

    const {
        deviceId,
        temperature,
        light,
        timestamp,
        token
    } = req.body;
	
    if (token !== process.env.API_REQUEST_PWD) {
        return res.status(401).send("no auth");
    }

    if (!deviceId || !timestamp) {
        return res.status(400).send("Missing required fields");
    }

    try {
        const setting = await getSetting(deviceId);
        // 初始化 Firebase
        const firebaseServiceAccount = JSON.parse(process.env.FIREBASE_CREDENTIAL);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseServiceAccount),
                databaseURL: "https://iot-monitor-50d03-default-rtdb.asia-southeast1.firebasedatabase.app"
            });
        }
        const db = admin.database();
        await db.ref(`/devices/${deviceId}/lastData`).set({
            temperature,
            light,
            timestamp
        });
        const recordTime = new Date(timestamp);
        const sheetName = utils.GetDateFormat(recordTime);

        const auth = getGoogleAuth();
        const sheets = google.sheets({
            version: "v4",
            auth
        });
        
        await utils.ensureSheetExists(sheets, setting.DataSheetFileId, sheetName);
        await sheets.spreadsheets.values.append({
            spreadsheetId: setting.DataSheetFileId,
            range: `${sheetName}!A:D`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
                values: [
                    [temperature, light, utils.GetTimeFormat(recordTime), recordTime.getTime()]
                ]
            }
        });

        res.status(200).send("Data uploaded");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal error");
    }
}