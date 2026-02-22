const ERA_LIST = [
  { name: '令和', start: new Date(2019, 4, 1) },
  { name: '平成', start: new Date(1989, 0, 8) },
  { name: '昭和', start: new Date(1926, 11, 25) },
  { name: '大正', start: new Date(1912, 6, 30) },
  { name: '明治', start: new Date(1868, 0, 25) },
];

/**
 * 西暦の日付文字列を和暦に変換する
 * @param dateStr "YYYY-MM-DD" 形式の日付文字列
 * @returns 和暦文字列 例: "昭和25年3月15日"、無効な場合は null
 */
export function toWareki(dateStr: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  for (const era of ERA_LIST) {
    if (date >= era.start) {
      const year = date.getFullYear() - era.start.getFullYear() + 1;
      const yearStr = year === 1 ? '元' : String(year);
      return `${era.name}${yearStr}年${date.getMonth() + 1}月${date.getDate()}日`;
    }
  }
  return null;
}

/**
 * 西暦の日付文字列を短い和暦に変換する（ノード表示用）
 * @param dateStr "YYYY-MM-DD" 形式の日付文字列
 * @returns 短い和暦文字列 例: "昭和25年"、無効な場合は null
 */
export function toWarekiShort(dateStr: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  for (const era of ERA_LIST) {
    if (date >= era.start) {
      const year = date.getFullYear() - era.start.getFullYear() + 1;
      const yearStr = year === 1 ? '元' : String(year);
      return `${era.name}${yearStr}年`;
    }
  }
  return null;
}

/**
 * 日付文字列を短いフォーマットに変換する
 * @param dateStr "YYYY-MM-DD" 形式
 * @returns "YYYY.M.D" 形式
 */
export function formatDateShort(dateStr: string): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
}
