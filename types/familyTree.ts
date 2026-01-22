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

// グループの型
export interface Group {
  id: string;
  name: string;
  color: string;
  notes?: string;
}

// 人物のデータ型
export interface PersonData {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  lifeStatus: LifeStatus;
  relationship: Relationship; // 続柄
  birthDate?: string;
  deathDate?: string;
  photo?: string;
  subtitle?: string;
  affiliation?: string;
  notes?: string;
  groupIds: string[]; // 所属グループのID配列
  isRepresentative?: boolean; // 代表者フラグ
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
  type: 'parent-child';
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
  showSubtitle: boolean;
  showBirthDeath: boolean;
  showAffiliation: boolean;
  showNotes: boolean;
  colorByGender: boolean;
}

// 全体のデータ構造
export interface FamilyTreeData {
  nodes: PersonData[];
  edges: RelationshipEdge[];
  groups: Group[];
  settings: DisplaySettings;
  version: string;
}

// デフォルト設定
export const defaultSettings: DisplaySettings = {
  showPhoto: false,
  showName: true,
  showSubtitle: true,
  showBirthDeath: true,
  showAffiliation: false,
  showNotes: false,
  colorByGender: true,
};

// サンプルデータ
export const sampleData: FamilyTreeData = {
  version: '1.0.0',
  settings: defaultSettings,
  groups: [
    {
      id: 'g1',
      name: '同居家族',
      color: '#3b82f6',
      notes: '現在同居している家族'
    },
    {
      id: 'g2',
      name: '故人',
      color: '#6b7280',
      notes: ''
    }
  ],
  nodes: [
    {
      id: '1',
      name: '祖父',
      gender: 'male',
      lifeStatus: 'deceased',
      relationship: 'grandfather_paternal',
      birthDate: '1930',
      deathDate: '2010',
      subtitle: '初代',
      groupIds: ['g2'],
      isRepresentative: true,
    },
    {
      id: '2',
      name: '祖母',
      gender: 'female',
      lifeStatus: 'deceased',
      relationship: 'grandmother_paternal',
      birthDate: '1935',
      deathDate: '2015',
      groupIds: ['g2'],
    },
    {
      id: '3',
      name: '父',
      gender: 'male',
      lifeStatus: 'alive',
      relationship: 'father',
      birthDate: '1960',
      subtitle: '二代目',
      groupIds: ['g1'],
    },
    {
      id: '4',
      name: '母',
      gender: 'female',
      lifeStatus: 'alive',
      relationship: 'mother',
      birthDate: '1962',
      groupIds: ['g1'],
    },
    {
      id: '5',
      name: '本人',
      gender: 'male',
      lifeStatus: 'alive',
      relationship: 'self',
      birthDate: '1990',
      groupIds: ['g1'],
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
  ],
};
