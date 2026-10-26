// 與 pipeline/build.py 輸出的 JSON 格式對應

export type Station = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

export type Trip = {
  no: string; // 車次
  type: string; // 車種，例如「區間」「自強」
  reserved: boolean; // 對號車（需訂位）
};

// [tripIndex, fromStationId, toStationId, depMinutes, arrMinutes]
// 時間為當天 00:00 起算的分鐘數，跨午夜會超過 1440
export type Connection = [number, string, string, number, number];

export type Timetable = {
  trips: Trip[];
  connections: Connection[]; // 依出發時間排序
};

export type Leg = {
  trainNo: string;
  trainType: string;
  reserved: boolean;
  from: string;
  to: string;
  dep: number;
  arr: number;
};

export type Journey = {
  dep: number; // 第一段的出發時間
  arr: number; // 最後一段的抵達時間
  legs: Leg[];
};

export type Reach = {
  stationId: string;
  arrivalTime: number; // 最早抵達時間
  returnTime: number; // 最晚回程出發時間
  stayMinutes: number; // returnTime − arrivalTime
  // 完整路線第一次讀取時才計算（地圖上色與排序用不到，省下大部分計算時間）
  readonly outbound: Journey; // 去程：在最早抵達的前提下最晚出門
  readonly inbound: Journey; // 回程：在最晚出發的前提下最早到家
};

export type Options = {
  origin: string;
  startTime: number; // 最早出發（分鐘）
  endTime: number; // 最晚到家（分鐘）
  minTransfer?: number; // 最短轉乘時間，預設 5 分鐘
  unreservedOnly?: boolean; // 只搭區間車
};
