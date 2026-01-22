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
  birthDate?: string;
  deathDate?: string;
  photo?: string;
  subtitle?: string;
  affiliation?: string;
  notes?: string;
  groupIds: string[];
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
  showShadow: boolean;
  showBorder: boolean;
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
  showShadow: false,
  showBorder: false,
};

// サンプルデータ（整列された位置）
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
      birthDate: '1935',
      deathDate: '2015',
      groupIds: ['g2'],
    },
    {
      id: '3',
      name: '父',
      gender: 'male',
      lifeStatus: 'alive',
      birthDate: '1960',
      subtitle: '二代目',
      groupIds: ['g1'],
    },
    {
      id: '4',
      name: '母',
      gender: 'female',
      lifeStatus: 'alive',
      birthDate: '1962',
      groupIds: ['g1'],
    },
    {
      id: '5',
      name: '本人',
      gender: 'male',
      lifeStatus: 'alive',
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
