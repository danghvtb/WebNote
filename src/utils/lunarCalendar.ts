// ============================================================
// MyNotes — Vietnamese Lunar Calendar Utility (Âm Lịch Việt Nam)
// Accurate conversion between Solar & Lunar dates (Ho Ngoc Duc Algorithm, UTC+7)
// ============================================================

export interface LunarDate {
  day: number;
  month: number;
  year: number;
  isLeap: boolean;
  jd: number;
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

/**
 * Calculate Julian Day Number for a given Solar Date (UTC)
 */
export function julianDayFromDate(dd: number, mm: number, yyyy: number): number {
  const a = Math.floor((14 - mm) / 12);
  const y = yyyy + 4800 - a;
  const m = mm + 12 * a - 3;
  return (
    dd +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

/**
 * Astronomical calculation of New Moon Day (Sóc) for UTC+7 (Vietnam)
 */
function getNewMoonDay(k: number, timeZone: number = 7): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);

  const M = (359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3) * dr;
  const Mpr = (306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3) * dr;
  const F = (21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3) * dr;

  const dJ =
    (0.1734 - 0.000393 * T) * Math.sin(M) +
    0.0021 * Math.sin(2 * M) -
    0.4068 * Math.sin(Mpr) +
    0.0161 * Math.sin(2 * Mpr) -
    0.0004 * Math.sin(3 * Mpr) +
    0.0104 * Math.sin(2 * F) -
    0.0051 * Math.sin(M + Mpr) -
    0.0074 * Math.sin(M - Mpr) +
    0.0004 * Math.sin(2 * F + M) -
    0.0004 * Math.sin(2 * F - M) -
    0.0006 * Math.sin(2 * F + Mpr) +
    0.001 * Math.sin(2 * F - Mpr) +
    0.0005 * Math.sin(M + 2 * Mpr);

  return Math.floor(Jd1 + dJ + 0.5 + timeZone / 24);
}

/**
 * Astronomical calculation of Sun Longitude for UTC+7 (Vietnam)
 */
function getSunLongitude(dayNumber: number, timeZone: number = 7): number {
  const T = (dayNumber - 2451545.0 + 0.5 - timeZone / 24) / 36525;
  const T2 = T * T;
  const T3 = T2 * T;
  const dr = Math.PI / 180;
  const M = (357.5291 + 35999.0503 * T - 0.0001559 * T2 - 0.00000048 * T3) * dr;
  const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
  const DL =
    (1.9146 - 0.004817 * T - 0.000014 * T2) * Math.sin(M) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * M) +
    0.00029 * Math.sin(3 * M);
  let L = (L0 + DL) % 360;
  if (L < 0) L += 360;
  return Math.floor(L / 30);
}

function getLunarMonth11(yyyy: number, timeZone: number = 7): number {
  const off = julianDayFromDate(31, 12, yyyy) - 2415021;
  const k = Math.floor(off / 29.53058868);
  let nm = getNewMoonDay(k, timeZone);
  const sunLong = getSunLongitude(nm, timeZone);
  if (sunLong >= 9) {
    nm = getNewMoonDay(k - 1, timeZone);
  }
  return nm;
}

function getLeapMonthOffset(a11: number, timeZone: number = 7): number {
  const k = Math.floor((a11 - 2415021) / 29.53058868 + 0.5);
  let lastSunLong = getSunLongitude(a11, timeZone);
  let i = 1;
  while (i <= 14) {
    const monthStart = getNewMoonDay(k + i, timeZone);
    const sunLong = getSunLongitude(monthStart, timeZone);
    if (sunLong === lastSunLong) {
      return i;
    }
    lastSunLong = sunLong;
    i++;
  }
  return 0;
}

/**
 * Convert Solar Date (dd, mm, yyyy) to Vietnamese Lunar Date
 */
export function convertSolarToLunar(
  dd: number,
  mm: number,
  yyyy: number,
  timeZone: number = 7
): LunarDate {
  const dayNumber = julianDayFromDate(dd, mm, yyyy);
  const k = Math.floor((dayNumber - 2415021) / 29.53058868);

  let monthStart = getNewMoonDay(k + 1, timeZone);
  if (monthStart > dayNumber) {
    monthStart = getNewMoonDay(k, timeZone);
  }

  let a11 = getLunarMonth11(yyyy, timeZone);
  let b11 = a11;
  let lunarYear = yyyy;

  if (a11 >= monthStart) {
    lunarYear = yyyy - 1;
    a11 = getLunarMonth11(yyyy - 1, timeZone);
  } else {
    b11 = getLunarMonth11(yyyy + 1, timeZone);
  }

  const lunarDay = dayNumber - monthStart + 1;
  const diff = Math.floor((monthStart - a11) / 29);
  let isLeap = false;
  let lunarMonth = diff + 11;

  if (b11 - a11 > 365) {
    const leapMonthDiff = getLeapMonthOffset(a11, timeZone);
    if (diff >= leapMonthDiff) {
      lunarMonth = diff + 10;
      if (diff === leapMonthDiff) {
        isLeap = true;
      }
    }
  }

  if (lunarMonth > 12) {
    lunarMonth -= 12;
  }

  return {
    day: lunarDay,
    month: lunarMonth,
    year: lunarYear,
    isLeap,
    jd: dayNumber,
  };
}

/**
 * Parse YYYY-MM-DD solar date string and return LunarDate
 */
export function getLunarDateFromStr(dateStr: string): LunarDate {
  const [yyyy, mm, dd] = dateStr.split('-').map(Number);
  return convertSolarToLunar(dd, mm, yyyy);
}

/**
 * Get Can Chi for Year
 */
export function getCanChiYear(year: number): string {
  const can = CAN[(year + 6) % 10];
  const chi = CHI[(year + 8) % 12];
  return `${can} ${chi}`;
}

/**
 * Get Can Chi for Day
 */
export function getCanChiDay(jd: number): string {
  const can = CAN[(jd + 9) % 10];
  const chi = CHI[(jd + 1) % 12];
  return `${can} ${chi}`;
}

/**
 * Get Can Chi for Month
 */
export function getCanChiMonth(month: number, year: number): string {
  const can = CAN[(year * 12 + month + 3) % 10];
  const chi = CHI[(month + 1) % 12];
  return `${can} ${chi}`;
}

/**
 * Get Special Lunar Holiday / Event Name if any
 */
export function getLunarHoliday(day: number, month: number): string | null {
  if (day === 1 && month === 1) return 'Tết Nguyên Đán 🧧';
  if (day === 2 && month === 1) return 'Mùng 2 Tết';
  if (day === 3 && month === 1) return 'Mùng 3 Tết';
  if (day === 15 && month === 1) return 'Tết Nguyên Tiêu 🏮';
  if (day === 3 && month === 3) return 'Tết Hàn Thực 🍡';
  if (day === 10 && month === 3) return 'Giỗ Tổ Hùng Vương 🇻🇳';
  if (day === 15 && month === 4) return 'Lễ Phật Đản 🪷';
  if (day === 5 && month === 5) return 'Tết Đoan Ngọ 🥭';
  if (day === 15 && month === 7) return 'Lễ Vu Lan 🪷';
  if (day === 15 && month === 8) return 'Tết Trung Thu 🥮';
  if (day === 9 && month === 9) return 'Tết Trùng Cửu 🍵';
  if (day === 10 && month === 10) return 'Tết Trùng Thập 🌾';
  if (day === 23 && month === 12) return 'Ông Táo Chầu Trời 🎏';
  return null;
}

/**
 * Format concise Lunar Date string, e.g. "26/7" or "Mùng 1/8" or "Rằm/7"
 */
export function formatLunarDateShort(dateStr: string): {
  shortText: string;
  dayText: string;
  isSpecial: boolean;
  holiday: string | null;
  lunar: LunarDate;
} {
  const lunar = getLunarDateFromStr(dateStr);
  const holiday = getLunarHoliday(lunar.day, lunar.month);

  const isSpecial = lunar.day === 1 || lunar.day === 15 || !!holiday;
  const dayText = `${lunar.day}/${lunar.month}`;
  const shortText = `${dayText}${lunar.isLeap ? ' Nhuận' : ''} ÂL`;

  return { shortText, dayText, isSpecial, holiday, lunar };
}

/**
 * Format full descriptive Lunar Date string
 * e.g. "26 Tháng 7 (Âm lịch) • Ngày Giáp Tý, Năm Ất Tỵ"
 */
export function formatLunarDateFull(dateStr: string): string {
  const lunar = getLunarDateFromStr(dateStr);
  const canChiDay = getCanChiDay(lunar.jd);
  const canChiYear = getCanChiYear(lunar.year);
  const holiday = getLunarHoliday(lunar.day, lunar.month);

  const holidaySuffix = holiday ? ` • ${holiday}` : '';
  const leapSuffix = lunar.isLeap ? ' (Nhuận)' : '';

  return `${lunar.day}/${lunar.month}${leapSuffix} Âm • Ngày ${canChiDay}, Năm ${canChiYear}${holidaySuffix}`;
}
