// 続柄の型
export type Relationship =
  | 'self' // 本人
  | 'father' // 父
  | 'mother' // 母
  | 'grandfather_paternal' // 祖父（父方）
  | 'grandmother_paternal' // 祖母（父方）
  | 'grandfather_maternal' // 祖父（母方）
  | 'grandmother_maternal' // 祖母（母方）
  | 'spouse' // 配偶者
  | 'child' // 子
  | 'sibling' // 兄弟姉妹
  | 'other'; // その他

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
  photo?: string;
  notes?: string;
  isRepresentative?: boolean;
  parentIds?: string[];
  spouseId?: string;
}

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
  showPhoto: boolean;
  showName: boolean;
  showBirthDeath: boolean;
  showNotes: boolean;
  colorByGender: boolean;
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
  showPhoto: false,
  showName: true,
  showBirthDeath: true,
  showNotes: false,
  colorByGender: true,
};

// サンプルデータ
export const sampleData: FamilyTreeData = {
  version: '1.0.0',
  settings: defaultSettings,
  nodes: [
    {
      id: '1',
      name: '祖父',
      gender: 'male',
      lifeStatus: 'deceased',
      relationship: 'grandfather_paternal',
      birthDate: '1930',
      deathDate: '2010',
      isRepresentative: true,
      spouseId: '2',
    },
    {
      id: '2',
      name: '祖母',
      gender: 'female',
      lifeStatus: 'deceased',
      relationship: 'grandmother_paternal',
      birthDate: '1935',
      deathDate: '2015',
      spouseId: '1',
    },
    {
      id: '3',
      name: '父',
      gender: 'male',
      lifeStatus: 'alive',
      relationship: 'father',
      birthDate: '1960',
      parentIds: ['1', '2'],
      spouseId: '4',
    },
    {
      id: '4',
      name: '母',
      gender: 'female',
      lifeStatus: 'alive',
      relationship: 'mother',
      birthDate: '1962',
      spouseId: '3',
    },
    {
      id: '5',
      name: '本人',
      gender: 'male',
      lifeStatus: 'alive',
      relationship: 'self',
      birthDate: '1990',
      parentIds: ['3', '4'],
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
      id: 'e3-5',
      source: '3',
      target: '5',
      type: 'parent-child',
    },
    {
      id: 'e4-5',
      source: '4',
      target: '5',
      type: 'parent-child',
    },
    {
      id: 'spouse-1-2',
      source: '1',
      target: '2',
      type: 'spouse',
    },
    {
      id: 'spouse-3-4',
      source: '3',
      target: '4',
      type: 'spouse',
    },
  ],
};
