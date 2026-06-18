// ============================================================
// ジェノグラム（家系図）データモデル
//
// 旧モデル（spouseId 単一 + parentIds）を廃し、
// 「夫婦/パートナー関係＝Union（生殖単位）」を一級市民にする。
// これにより 再婚・離婚・複数婚・異母/異父きょうだい を正しく表現できる。
// ============================================================

export type Sex = 'male' | 'female' | 'unknown';
export type LifeStatus = 'alive' | 'deceased' | 'unknown';

/** 夫婦/パートナー関係の状態 */
export type UnionStatus = 'married' | 'partner' | 'divorced' | 'separated';

/** 人物 */
export interface Person {
  id: string;
  name: string;
  sex: Sex;
  lifeStatus: LifeStatus;
  /** 本人（プロバンド）。ジェノグラムでは矢印で示す。1人のみ */
  isProband?: boolean;
  /** 続柄ラベル（本人視点の表示用・自由入力可。レイアウトには使わない） */
  relationship?: string;
  birthDate?: string; // YYYY-MM-DD
  deathDate?: string; // YYYY-MM-DD
  /** 既往歴 */
  medicalHistory?: string;
  /** 同居グループ番号（1..n / 未設定=同居なし） */
  livingGroup?: number;
  notes?: string;
  address?: string;
  phone?: string;
}

/**
 * Union（夫婦/パートナー関係 ＝ 子をぶら下げる生殖単位）
 * - a, b は配偶者。b 省略でひとり親も表現できる。
 * - childIds は出生順（左→右）
 */
export interface Union {
  id: string;
  a: string;
  b?: string;
  status: UnionStatus;
  childIds: string[];
}

/**
 * 感情関係線（ジェノグラム標準）。人物間の関係の質を表す。
 * 親子/夫婦の構造線とは別レイヤーで描画する。
 */
export type RelationType =
  | 'close'      // 親密
  | 'veryClose'  // 密着（過度に親密）
  | 'distant'    // 疎遠
  | 'conflict'   // 葛藤・不和
  | 'cutoff'     // 断絶・絶縁
  | 'hostile';   // 敵対・虐待

export interface Relation {
  id: string;
  from: string;
  to: string;
  type: RelationType;
}

export const relationTypeLabels: Record<RelationType, string> = {
  close: '親密',
  veryClose: '密着',
  distant: '疎遠',
  conflict: '葛藤',
  cutoff: '断絶',
  hostile: '敵対・虐待',
};

/** 表示設定 */
export interface DisplaySettings {
  showName: boolean;
  showDates: boolean;
  showWareki: boolean;
  showRelationship: boolean;
  showMedicalHistory: boolean;
  showLivingGroup: boolean;
  showRelationLines: boolean;
}

export const defaultSettings: DisplaySettings = {
  showName: true,
  showDates: true,
  showWareki: true,
  showRelationship: false,
  showMedicalHistory: true,
  showLivingGroup: true,
  showRelationLines: true,
};

/** 全体のデータ構造 */
export interface GenogramData {
  version: string;
  persons: Person[];
  unions: Union[];
  relations: Relation[];
  settings: DisplaySettings;
}

export const DATA_VERSION = '2.0.0';

/** 続柄の入力候補 */
export const relationshipSuggestions = [
  '本人', '夫', '妻', '父', '母', '祖父', '祖母',
  '長男', '次男', '三男', '長女', '次女', '三女',
  '兄', '弟', '姉', '妹', '息子', '娘', '孫', '養子', 'その他',
];

/** 性別記号付きの表示名 */
export const sexMark = (sex: Sex): string =>
  sex === 'male' ? '♂' : sex === 'female' ? '♀' : '';

let _seq = 0;
/** 衝突しないID生成（時刻＋連番。SSRでも安全なよう連番を併用） */
export const newId = (prefix = 'p'): string => {
  _seq += 1;
  const t = typeof performance !== 'undefined' ? Math.floor(performance.now() * 1000) : _seq;
  return `${prefix}_${t.toString(36)}_${_seq.toString(36)}`;
};

// --- サンプルデータ（3世代・再婚なしの素直な例） ---
export const sampleData: GenogramData = {
  version: DATA_VERSION,
  settings: defaultSettings,
  persons: [
    { id: 'gf', name: '山田 茂', sex: 'male', lifeStatus: 'deceased', relationship: '父方祖父', birthDate: '1928-02-10', deathDate: '2010-06-01', medicalHistory: '脳梗塞' },
    { id: 'gm', name: '山田 トメ', sex: 'female', lifeStatus: 'deceased', relationship: '父方祖母', birthDate: '1931-09-22', deathDate: '2015-03-14' },
    { id: 'self', name: '山田 太郎', sex: 'male', lifeStatus: 'alive', relationship: '本人', isProband: true, birthDate: '1950-03-15', medicalHistory: '高血圧', livingGroup: 1 },
    { id: 'wife', name: '山田 花子', sex: 'female', lifeStatus: 'alive', relationship: '妻', birthDate: '1953-07-22', medicalHistory: '糖尿病', livingGroup: 1 },
    { id: 'sis', name: '佐藤 良子', sex: 'female', lifeStatus: 'alive', relationship: '妹', birthDate: '1955-11-30' },
    { id: 'son', name: '山田 一郎', sex: 'male', lifeStatus: 'alive', relationship: '長男', birthDate: '1980-11-03', livingGroup: 1 },
    { id: 'sonwife', name: '山田 さやか', sex: 'female', lifeStatus: 'alive', relationship: '長男の妻', birthDate: '1982-04-18', livingGroup: 1 },
    { id: 'dau', name: '鈴木 美咲', sex: 'female', lifeStatus: 'alive', relationship: '長女', birthDate: '1983-05-12' },
    { id: 'gc1', name: '山田 蓮', sex: 'male', lifeStatus: 'alive', relationship: '孫', birthDate: '2010-08-08', livingGroup: 1 },
  ],
  unions: [
    { id: 'u_g', a: 'gf', b: 'gm', status: 'married', childIds: ['self', 'sis'] },
    { id: 'u_self', a: 'self', b: 'wife', status: 'married', childIds: ['son', 'dau'] },
    { id: 'u_son', a: 'son', b: 'sonwife', status: 'married', childIds: ['gc1'] },
  ],
  relations: [
    { id: 'r1', from: 'wife', to: 'son', type: 'veryClose' }, // 花子と一郎は密着
    { id: 'r2', from: 'self', to: 'sis', type: 'conflict' },  // 太郎と妹は葛藤
  ],
};
