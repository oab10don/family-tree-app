// ============================================================
// グラフ操作（不変） & 関係線（コネクタ）の生成
// ============================================================

import { Person, Union, Sex, UnionStatus, newId } from '@/types/genogram';
import { Pos, SYMBOL } from './layout';

// ---------- 関係線の生成 ----------

export interface MarriageLine {
  x1: number; y1: number; x2: number; y2: number;
  status: UnionStatus;
}
export interface Segment { x1: number; y1: number; x2: number; y2: number; }

export interface Connectors {
  marriages: MarriageLine[];
  childLinks: Segment[];
}

const BUS_OFFSET = 30; // 子の上に渡す横バーの高さ

export const buildConnectors = (
  unions: Union[],
  positions: Map<string, Pos>
): Connectors => {
  const marriages: MarriageLine[] = [];
  const childLinks: Segment[] = [];

  for (const u of unions) {
    const pa = positions.get(u.a);
    const pb = u.b ? positions.get(u.b) : undefined;

    // 結婚線
    if (pa && pb) {
      const leftX = Math.min(pa.x, pb.x) + SYMBOL / 2;
      const rightX = Math.max(pa.x, pb.x) - SYMBOL / 2;
      const y = (pa.y + pb.y) / 2;
      marriages.push({ x1: leftX, y1: y, x2: rightX, y2: y, status: u.status });
    }

    // 親子線
    if (u.childIds.length > 0) {
      const childPos = u.childIds
        .map((cid) => positions.get(cid))
        .filter((p): p is Pos => !!p);
      if (childPos.length === 0) continue;

      // 親の接続点
      const parentMidX = pb && pa ? (pa.x + pb.x) / 2 : pa ? pa.x : childPos[0].x;
      const parentY = pa ? pa.y : childPos[0].y;
      // 親から下端へ（夫婦は結婚線の中点、ひとり親は記号下端）から
      const dropStartY = pb && pa ? parentY : parentY + SYMBOL / 2;

      const childTopY = Math.min(...childPos.map((p) => p.y)) - SYMBOL / 2;
      const busY = childTopY - BUS_OFFSET;

      // 親 → バー
      childLinks.push({ x1: parentMidX, y1: dropStartY, x2: parentMidX, y2: busY });
      // 横バー（最左子〜最右子）
      const minX = Math.min(parentMidX, ...childPos.map((p) => p.x));
      const maxX = Math.max(parentMidX, ...childPos.map((p) => p.x));
      childLinks.push({ x1: minX, y1: busY, x2: maxX, y2: busY });
      // バー → 各子
      for (const cp of childPos) {
        childLinks.push({ x1: cp.x, y1: busY, x2: cp.x, y2: cp.y - SYMBOL / 2 });
      }
    }
  }

  return { marriages, childLinks };
};

// ---------- グラフ操作 ----------

export interface OpResult {
  persons: Person[];
  unions: Union[];
  newPersonId?: string;
}

const makePerson = (sex: Sex, relationship?: string): Person => ({
  id: newId(),
  name: '',
  sex,
  lifeStatus: 'alive',
  relationship,
});

/** 親を追加（既存の親ユニットに空きがあれば充填、無ければ新規ユニット作成） */
export const addParent = (
  persons: Person[],
  unions: Union[],
  childId: string,
  sex: Sex
): OpResult => {
  const rel = sex === 'male' ? '父' : sex === 'female' ? '母' : '親';
  const np = makePerson(sex, rel);
  const parentUnion = unions.find((u) => u.childIds.includes(childId));

  if (parentUnion) {
    // 空きスロットに充填
    if (!parentUnion.b) {
      const nu = unions.map((u) =>
        u.id === parentUnion.id ? { ...u, b: np.id } : u
      );
      return { persons: [...persons, np], unions: nu, newPersonId: np.id };
    }
    // 既に両親そろっている → 何もしない
    return { persons, unions };
  }
  // 新規ユニット
  const union: Union = { id: newId('u'), a: np.id, status: 'married', childIds: [childId] };
  return { persons: [...persons, np], unions: [...unions, union], newPersonId: np.id };
};

/** 配偶者を追加（既存のひとり親ユニットがあれば相手を充填し、子を夫婦の子にする） */
export const addSpouse = (
  persons: Person[],
  unions: Union[],
  personId: string,
  sex: Sex
): OpResult => {
  const np = makePerson(sex, sex === 'male' ? '夫' : sex === 'female' ? '妻' : '配偶者');
  // 自分が唯一の親（相手なし）のユニットがあれば、そこへ配偶者を入れる
  const solo = unions.find((u) => u.a === personId && !u.b);
  if (solo) {
    const nu = unions.map((u) => (u.id === solo.id ? { ...u, b: np.id } : u));
    return { persons: [...persons, np], unions: nu, newPersonId: np.id };
  }
  const union: Union = {
    id: newId('u'),
    a: personId,
    b: np.id,
    status: 'married',
    childIds: [],
  };
  return { persons: [...persons, np], unions: [...unions, union], newPersonId: np.id };
};

/** 子を追加（配偶者のいるユニットを優先。無ければひとり親ユニット） */
export const addChild = (
  persons: Person[],
  unions: Union[],
  personId: string
): OpResult => {
  const np = makePerson('male', '子');
  const myUnions = unions.filter((u) => u.a === personId || u.b === personId);
  const target = myUnions.find((u) => u.b) ?? myUnions[0];

  if (target) {
    const nu = unions.map((u) =>
      u.id === target.id ? { ...u, childIds: [...u.childIds, np.id] } : u
    );
    return { persons: [...persons, np], unions: nu, newPersonId: np.id };
  }
  const union: Union = { id: newId('u'), a: personId, status: 'married', childIds: [np.id] };
  return { persons: [...persons, np], unions: [...unions, union], newPersonId: np.id };
};

/** きょうだいを追加（対象と同じ親ユニットへ） */
export const addSibling = (
  persons: Person[],
  unions: Union[],
  personId: string
): OpResult => {
  const parentUnion = unions.find((u) => u.childIds.includes(personId));
  if (!parentUnion) {
    // 親がいない → 親ユニットを作ってそこへ
    const np = makePerson('male', 'きょうだい');
    const union: Union = {
      id: newId('u'),
      a: newId(),
      status: 'married',
      childIds: [personId, np.id],
    };
    // a の実体人物も必要 → ダミー親も作る
    const parent = makePerson('male', '親');
    union.a = parent.id;
    return { persons: [...persons, parent, np], unions: [...unions, union], newPersonId: np.id };
  }
  const np = makePerson('male', 'きょうだい');
  const nu = unions.map((u) =>
    u.id === parentUnion.id ? { ...u, childIds: [...u.childIds, np.id] } : u
  );
  return { persons: [...persons, np], unions: nu, newPersonId: np.id };
};

/** 人物を削除し、関連するUnionを健全に保つ */
export const deletePerson = (
  persons: Person[],
  unions: Union[],
  id: string
): { persons: Person[]; unions: Union[] } => {
  const newPersons = persons.filter((p) => p.id !== id);
  const newUnions: Union[] = [];
  for (const u of unions) {
    const partners = [u.a, u.b].filter((x): x is string => !!x && x !== id);
    const childIds = u.childIds.filter((c) => c !== id);
    if (partners.length === 0 && childIds.length === 0) continue; // 空ユニットは破棄
    if (partners.length === 0) continue; // 親が全員消えたユニットは破棄（子は孤立）
    newUnions.push({ ...u, a: partners[0], b: partners[1], childIds });
  }
  return { persons: newPersons, unions: newUnions };
};

/** proband（本人）を一意に設定 */
export const setProband = (persons: Person[], id: string): Person[] =>
  persons.map((p) => ({ ...p, isProband: p.id === id }));

/** データ整合性チェック（孤児Union参照などを除去） */
export const sanitize = (persons: Person[], unions: Union[]): { persons: Person[]; unions: Union[] } => {
  const ids = new Set(persons.map((p) => p.id));
  const cleanUnions = unions
    .map((u) => ({
      ...u,
      a: ids.has(u.a) ? u.a : '',
      b: u.b && ids.has(u.b) ? u.b : undefined,
      childIds: u.childIds.filter((c) => ids.has(c)),
    }))
    .map((u) => {
      // a が消えていたら b を昇格
      if (!u.a && u.b) return { ...u, a: u.b, b: undefined };
      return u;
    })
    .filter((u) => u.a && (u.b || u.childIds.length > 0));
  return { persons, unions: cleanUnions };
};
