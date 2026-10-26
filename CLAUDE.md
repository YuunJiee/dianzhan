# 點站（dianzhan）— 台灣車站一日遊與集站 App

規格書：https://claude.ai/artifact/NcJrdwLmZ4q3R5YvKQKKtF

## 目標
選一個出發站，算出全台各台鐵車站當天來回可停留多久；並讓使用者在車站打卡、點亮自己的集站地圖。
第一版只做：台鐵、一日來回地圖、前景定位打卡。不做：高鐵/公車、帳號、排行榜、AI、背景定位、打卡照片、補登、路線完成度頁。

## 專案結構
- pipeline/   Python：抓 TDX、整理成 stations 與 connections JSON（不含演算法）
- app/        Expo + React Native + TypeScript（Android 為主）；CSA 放在 app/src/csa/
- docs/       GitHub Pages 輸出的 JSON（由 pipeline 產生，勿手動修改）
- .github/workflows/daily.yml  每日排程執行 pipeline

## 規則
- TDX 金鑰只放 .env 與 GitHub Secrets，絕不提交到版本控制。
- 可停留時間 = 最晚回程出發時間 − 最早抵達時間（CSA 前向掃描 + 反向掃描）。
- 換車預留最短轉乘時間 5 分鐘，同一車次不需預留。
- 最晚回程車次旁邊另標出前一班，作為「建議搭前一班」。
- CSA 在 App 內即時計算，不預先算好；演算法改動必須通過 app/src/csa 的真實時刻表案例測試。
- App 端打卡存 expo-sqlite，設定存 AsyncStorage；打卡紀錄需可匯出/匯入 JSON。
- App 須顯示資料來源（TDX）與「非台鐵官方服務」聲明。
- 每次修改保持小步：一個功能一個 commit，完成後確認 Expo Go 可正常執行。

## 目前迭代
I0：資料與演算法（見規格書「開發迭代」）
