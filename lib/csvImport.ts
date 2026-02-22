import { PersonData, Relationship } from '@/types/familyTree';

/** CSVパース結果 */
export interface CsvImportResult {
  persons: PersonData[];
  errors: string[];
}

/**
 * CSV文字列をパースしてPersonData配列に変換する
 * 日本語・英語ヘッダー対応、和暦日付自動変換
 */
export function parseCsv(csvText: string): CsvImportResult {
  const errors: string[] = [];

  // BOM除去
  const text = csvText.replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim());

  if (lines.length < 2) {
    return { persons: [], errors: ['データが空です'] };
  }

  // ヘッダー解析
  const header = parseCsvLine(lines[0]);
  const colIndex = buildColumnIndex(header);

  const persons: PersonData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length === 0) continue;

    try {
      const id = getCol(cols, colIndex.id) || String(i);
      const name = getCol(cols, colIndex.name) || '';

      if (!name) {
        errors.push(`行${i + 1}: 氏名が空です`);
        continue;
      }

      // 性別の正規化
      const genderRaw = getCol(cols, colIndex.gender).trim();
      let gender: 'male' | 'female' | 'other' = 'other';
      if (['男', '男性', 'male', 'M', 'm'].includes(genderRaw)) gender = 'male';
      if (['女', '女性', 'female', 'F', 'f'].includes(genderRaw)) gender = 'female';

      // 日付の正規化（和暦対応）
      const birthDate = normalizeDate(getCol(cols, colIndex.birthDate)) || undefined;
      const deathDate = normalizeDate(getCol(cols, colIndex.deathDate)) || undefined;

      // 生存状態の推定
      const lifeStatus = deathDate ? 'deceased' as const : 'alive' as const;

      // 続柄の正規化
      const relRaw = getCol(cols, colIndex.relationship).trim();
      const relationship = normalizeRelationship(relRaw);

      // 既往歴のパース（スラッシュ区切り → 単一文字列に結合）
      const medHistRaw = getCol(cols, colIndex.medicalHistory);
      const medicalHistory = medHistRaw
        ? medHistRaw
            .split('/')
            .map((s) => s.trim())
            .filter(Boolean)
            .join('、')
        : undefined;

      // 親ID
      const fatherId = getCol(cols, colIndex.fatherId) || undefined;
      const motherId = getCol(cols, colIndex.motherId) || undefined;
      const parentIds = [fatherId, motherId].filter(Boolean) as string[];

      // 配偶者ID
      const spouseId = getCol(cols, colIndex.spouseId) || undefined;

      // 同居
      const cohabitantRaw = getCol(cols, colIndex.cohabitant).toLowerCase();
      const livingTogether = cohabitantRaw === 'true';

      // 備考
      const notes = getCol(cols, colIndex.note) || undefined;
      const isRepresentative = notes?.includes('代表者') || false;

      persons.push({
        id,
        name,
        gender,
        lifeStatus,
        relationship,
        birthDate,
        deathDate,
        medicalHistory: medicalHistory || undefined,
        isRepresentative,
        parentIds: parentIds.length > 0 ? parentIds : undefined,
        spouseId,
        livingTogether,
        livingGroup: livingTogether ? 1 : undefined,
        address: getCol(cols, colIndex.address) || undefined,
        phone: getCol(cols, colIndex.phone) || undefined,
        notes: notes?.replace('代表者', '').trim() || undefined,
      });
    } catch {
      errors.push(`行${i + 1}: パースエラー`);
    }
  }

  return { persons, errors };
}

/** 安全にカラム値を取得 */
function getCol(cols: string[], index: number): string {
  if (index < 0 || index >= cols.length) return '';
  return cols[index] || '';
}

/**
 * 和暦 → 西暦変換を含む日付正規化
 * @returns YYYY-MM-DD 形式、パース不可の場合 null
 */
function normalizeDate(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  const s = raw.trim();

  // YYYY-MM-DD 形式
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) return s;

  // YYYY/MM/DD 形式
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) return s.replace(/\//g, '-');

  const warekiMap: Record<string, number> = {
    '明治': 1868, M: 1868,
    '大正': 1912, T: 1912,
    '昭和': 1926, S: 1926,
    '平成': 1989, H: 1989,
    '令和': 2019, R: 2019,
  };

  // 昭和25年3月15日
  const m1 = s.match(/^(明治|大正|昭和|平成|令和)(\d+)年(\d+)月(\d+)日$/);
  if (m1) {
    const baseYear = warekiMap[m1[1]];
    const year = baseYear + parseInt(m1[2]) - 1;
    return `${year}-${m1[3].padStart(2, '0')}-${m1[4].padStart(2, '0')}`;
  }

  // S25.3.15
  const m2 = s.match(/^([MTSHR])(\d+)\.(\d+)\.(\d+)$/);
  if (m2) {
    const baseYear = warekiMap[m2[1]];
    const year = baseYear + parseInt(m2[2]) - 1;
    return `${year}-${m2[3].padStart(2, '0')}-${m2[4].padStart(2, '0')}`;
  }

  return null;
}

/** 続柄文字列を Relationship 型に正規化 */
function normalizeRelationship(raw: string): Relationship {
  const map: Record<string, Relationship> = {
    '本人': 'self',
    '父': 'father',
    '母': 'mother',
    '配偶者': 'spouse',
    '長男': 'eldest_son',
    '次男': 'second_son',
    '三男': 'third_son',
    '長女': 'eldest_daughter',
    '次女': 'second_daughter',
    '三女': 'third_daughter',
    '孫': 'grandchild',
    'その他': 'other',
    // 仕様に記載されている追加の続柄もマッピング
    '兄': 'other',
    '姉': 'other',
    '弟': 'other',
    '妹': 'other',
    '祖父': 'other',
    '祖母': 'other',
  };
  return map[raw] || 'other';
}

/** CSVの1行をパース（ダブルクォート対応） */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

/** ヘッダーからカラムインデックスを構築（日本語・英語どちらも対応） */
function buildColumnIndex(header: string[]) {
  const find = (names: string[]) => {
    const idx = header.findIndex((h) => names.includes(h.trim()));
    return idx >= 0 ? idx : -1;
  };

  return {
    id: Math.max(0, find(['ID', 'id', 'Id'])),
    name: Math.max(0, find(['氏名', '名前', 'name', 'Name'])),
    gender: Math.max(0, find(['性別', 'gender', 'Gender', 'sex'])),
    birthDate: find(['生年月日', '誕生日', 'birthDate', 'birth_date', 'DOB']),
    deathDate: find(['没年月日', '死亡日', 'deathDate', 'death_date']),
    relationship: find(['続柄', '関係', 'relationship']),
    fatherId: find(['父ID', '父', 'fatherId', 'father_id']),
    motherId: find(['母ID', '母', 'motherId', 'mother_id']),
    spouseId: find(['配偶者ID', '配偶者', 'spouseId', 'spouse_id']),
    medicalHistory: find([
      '既往歴',
      '病歴',
      'medicalHistory',
      'medical_history',
      'conditions',
    ]),
    note: find(['備考', 'メモ', 'note', 'notes']),
    cohabitant: find(['同居', 'cohabitant', 'isCohabitant']),
    address: find(['住所', 'address']),
    phone: find(['電話番号', '電話', 'phone']),
  };
}
