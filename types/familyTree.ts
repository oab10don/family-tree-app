// 続柄の型
export type Relationship =
  | 'self' // 本人
  | 'father' // 父
  | 'mother' // 母
  | 'spouse' // 配偶者
  | 'eldest_son' // 長男
  | 'second_son' // 次男
  | 'third_son' // 三男
  | 'eldest_daughter' // 長女
  | 'second_daughter' // 次女
  | 'third_daughter' // 三女
  | 'grandchild' // 孫
  | 'other'; // その他

/** 続柄の表示ラベル */
export const relationshipLabels: Record<Relationship, string> = {
  self: '本人',
  father: '父',
  mother: '母',
  spouse: '配偶者',
  eldest_son: '長男',
  second_son: '次男',
  third_son: '三男',
  eldest_daughter: '長女',
  second_daughter: '次女',
  third_daughter: '三女',
  grandchild: '孫',
  other: 'その他',
};

/** 子の続柄のソート順（左から右へ） */
export const childSortOrder: Record<string, number> = {
  eldest_son: 1,
  eldest_daughter: 2,
  second_son: 3,
  second_daughter: 4,
  third_son: 5,
  third_daughter: 6,
  grandchild: 10,
  other: 99,
};

// 生存状態の型
export type LifeStatus = 'alive' | 'deceased' | 'unknown';

// 人物のデータ型
export interface PersonData {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  lifeStatus: LifeStatus;
  relationship: Relationship;
  birthDate?: string;
  deathDate?: string;
  photo?: string; // 互換性のため残置（UIでは非使用）
  notes?: string;
  isRepresentative?: boolean;
  parentIds?: string[];
  spouseId?: string;
  // 同居/別居
  livingTogether?: boolean;
  livingGroup?: number; // 1〜10
  // 住所・電話
  address?: string;
  phone?: string;
}

/**
 * 性別記号を付与した表示名を返す（データは汚さない）
 */
export const getDisplayName = (person: PersonData): string => {
  const symbol = person.gender === 'male' ? '◻ ' : person.gender === 'female' ? '◯ ' : '';
  return `${symbol}${person.name}`;
};

// ノードのデータ型
export interface PersonNodeData extends PersonData {
  label: string;
}

// エッジ（関係線）のデータ型
export interface RelationshipEdge {
  id: string;
  source: string;
  target: string;
  type: 'parent-child' | 'spouse';
  style?: {
    stroke?: string;
    strokeWidth?: number;
    strokeDasharray?: string;
  };
  label?: string;
}

// 表示設定の型
export interface DisplaySettings {
  showName: boolean;
  showNotes: boolean;
  colorByGender: boolean;
  showPhoto?: boolean; // 互換性のため残置（UIでは非使用）
}

// 全体のデータ構造
export interface FamilyTreeData {
  nodes: PersonData[];
  edges: RelationshipEdge[];
  settings: DisplaySettings;
  version: string;
}

// デフォルト設定
export const defaultSettings: DisplaySettings = {
  showName: true,
  showNotes: false,
  colorByGender: true,
};

// 初期データ（本人・配偶者・子）
export const sampleData: FamilyTreeData = {
  version: '1.0.0',
  settings: defaultSettings,
  nodes: [
    {
      id: '1',
      name: '山田太郎',
      gender: 'male',
      lifeStatus: 'alive',
      relationship: 'self',
      isRepresentative: true,
      spouseId: '2',
      livingTogether: true,
      livingGroup: 1,
    },
    {
      id: '2',
      name: '山田花子',
      gender: 'female',
      lifeStatus: 'alive',
      relationship: 'spouse',
      spouseId: '1',
      livingTogether: true,
      livingGroup: 1,
    },
    {
      id: '3',
      name: '山田一郎',
      gender: 'male',
      lifeStatus: 'alive',
      relationship: 'eldest_son',
      parentIds: ['1', '2'],
      livingTogether: true,
      livingGroup: 1,
    },
  ],
  edges: [
    {
      id: 'e1-3',
      source: '1',
      target: '3',
      type: 'parent-child',
    },
    {
      id: 'e2-3',
      source: '2',
      target: '3',
      type: 'parent-child',
    },
    {
      id: 'spouse-1-2',
      source: '1',
      target: '2',
      type: 'spouse',
    },
  ],
};
