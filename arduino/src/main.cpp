#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h> 
#include <OneWire.h> 
#include <DallasTemperature.h> 
#include <Wire.h>
#include <BH1750.h>

#include <ArduinoJson.h>
#include <time.h>

#define DQ_Pin 12  

BH1750 lightMeter;
OneWire oneWire(DQ_Pin);
DallasTemperature sensors(&oneWire);
unsigned long lastTime = 0;
unsigned long timerDelay = 30000;
unsigned long lastAlertTime = 0;
unsigned long AlertTimerDelay = 30000;

const char* ssid = "Dlink";
const char* password = "chen0975477079";

const int Id = 1;

const String postUri = "http://iot-monitor.n3np6ji39417.workers.dev/api/upload";
const String Pd = "pMFYKB9Kn4W9quNJ";

void WifiConnect(); 
void setup() {
  delay(1000);
  Serial.begin(115200);
  system_update_cpu_freq(160); // 提升 CPU 頻率增加 HTTPS 處理效率

  Serial.println("=====start=====");
  delay(1000);
  WifiConnect();

  Serial.println("=====wifi connect=====");
  delay(1000);

  configTime(8 * 3600, 0, "pool.ntp.org", "time.nist.gov");

  Serial.print("Waiting for NTP time sync: ");
  while (time(nullptr) < 8 * 3600 * 2) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");

  Wire.begin();
  sensors.begin();
  lightMeter.begin();
  Serial.println(F("BH1750 Test begin"));
}

void WifiConnect()
{
  WiFi.mode(WIFI_OFF);
  delay(1000);

  WiFi.mode(WIFI_STA); 
  WiFi.begin(ssid, password);

  while(WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
}

void loop() {
  if(lastTime == 0 || (millis() - lastTime) > timerDelay) {
    lastTime = millis();
    sensors.requestTemperatures();
    
    if(WiFi.status()!= WL_CONNECTED){
        WifiConnect();
      }
      WiFiClient httpClient;
      httpClient.setTimeout(10000); // 設定 10 秒逾時
      HTTPClient http;
      if (http.begin(httpClient, postUri)) {
        http.addHeader("Content-Type", "application/json");
        // 3. 獲取目前 Unix 時間戳
        time_t now = time(nullptr);
        // 4. 構建 JSON (根據你的 CURL 格式)
        JsonDocument doc;
        doc["deviceId"] = Id;
        doc["temperature"] = sensors.getTempCByIndex(0);
        doc["light"] = lightMeter.readLightLevel();
        doc["timestamp"] = (uint32_t)now; 
        doc["token"] = Pd;

        String requestBody;
        serializeJson(doc, requestBody);

        // 5. 發送 POST
        Serial.println("Sending data to Cloudflare...");
        int httpResponseCode = http.POST(requestBody);

        if (httpResponseCode > 0) {
          Serial.printf("HTTP Code: %d, Response: %s\n", httpResponseCode, http.getString().c_str());
        } else {
          Serial.printf("Error: %s\n", http.errorToString(httpResponseCode).c_str());
        }

        http.end(); // 務必釋放記憶體
      }

  }
  delay(1000);
}