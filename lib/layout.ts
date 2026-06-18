// ============================================================
// 決定的レイアウトエンジン
//
// 設計方針（「必ず家系図として成立する」ための核）:
//  1. 世代(generation)は本人(proband)起点のBFSで全員に一意に決める → Y を厳密に揃える
//  2. X は「家族ユニット」の再帰で決める。各ユニットは
//        width = max(夫婦行の幅, 子サブツリー合計幅)
//     を確保するため、兄弟サブツリー同士は決して重ならない（自動で間隔が空く）。
//  3. 夫婦は子の重心の真上に中央寄せ。子がいなければ自前の幅だけ確保。
//  4. 仕上げに世代ごとの最小間隔を保証する安全パス（再婚・姻族など稀な交差を吸収）。
//
// dagre は使わない。後処理の継ぎ足しもしない。
// ============================================================

import { Person, Union } from '@/types/genogram';

export const SYMBOL = 46; // 記号（□○◇）の一辺/直径
export const NODE_W = 104; // 1人分の横スロット（ラベル込み）
export const NODE_H = 92; // 記号＋ラベルの縦の占有
export const COUPLE_GAP = 46; // 配偶者間の間隔（結婚線の長さ）
export const SIBLING_GAP = 34; // きょうだいサブツリー間の最小間隔
export const ROW_H = 168; // 世代の縦ピッチ（記号中心→記号中心）
export const MARGIN = 80; // 全体の外余白

export interface Pos {
  x: number; // 記号の中心X
  y: number; // 記号の中心Y
}

export interface LayoutResult {
  positions: Map<string, Pos>;
  generation: Map<string, number>;
  width: number;
  height: number;
  minGen: number;
  maxGen: number;
}

// ---- 索引づくり ----

interface Index {
  personMap: Map<string, Person>;
  unionMap: Map<string, Union>;
  /** 人物 → その人が親(a/b)であるUnion群 */
  unionsAsParent: Map<string, Union[]>;
  /** 子 → その子を含むUnion（親ユニット）。複数ある場合は最初の1つ */
  parentUnionOf: Map<string, Union>;
}

const buildIndex = (persons: Person[], unions: Union[]): Index => {
  const personMap = new Map<string, Person>();
  for (const p of persons) personMap.set(p.id, p);
  const unionMap = new Map<string, Union>();
  const unionsAsParent = new Map<string, Union[]>();
  const parentUnionOf = new Map<string, Union>();
  for (const u of unions) {
    unionMap.set(u.id, u);
    for (const pid of [u.a, u.b]) {
      if (!pid) continue;
      if (!unionsAsParent.has(pid)) unionsAsParent.set(pid, []);
      unionsAsParent.get(pid)!.push(u);
    }
    for (const cid of u.childIds) {
      if (!parentUnionOf.has(cid)) parentUnionOf.set(cid, u);
    }
  }
  return { personMap, unionMap, unionsAsParent, parentUnionOf };
};

const partnersOf = (idx: Index, personId: string): string[] => {
  const res: string[] = [];
  for (const u of idx.unionsAsParent.get(personId) ?? []) {
    const other = u.a === personId ? u.b : u.a;
    if (other) res.push(other);
  }
  return res;
};

const parentsOf = (idx: Index, personId: string): string[] => {
  const u = idx.parentUnionOf.get(personId);
  if (!u) return [];
  return [u.a, u.b].filter((x): x is string => !!x);
};

const childrenOf = (idx: Index, personId: string): string[] => {
  const res: string[] = [];
  for (const u of idx.unionsAsParent.get(personId) ?? []) res.push(...u.childIds);
  return res;
};

// ---- 1) 世代計算（BFS） ----

const computeGenerations = (persons: Person[], idx: Index): Map<string, number> => {
  const gen = new Map<string, number>();
  if (persons.length === 0) return gen;
  const proband =
    persons.find((p) => p.isProband) ?? persons.find((p) => p.relationship === '本人') ?? persons[0];

  const queue: string[] = [proband.id];
  gen.set(proband.id, 0);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const g = gen.get(cur)!;
    for (const pid of parentsOf(idx, cur)) {
      if (!gen.has(pid) && idx.personMap.has(pid)) { gen.set(pid, g - 1); queue.push(pid); }
    }
    for (const cid of childrenOf(idx, cur)) {
      if (!gen.has(cid) && idx.personMap.has(cid)) { gen.set(cid, g + 1); queue.push(cid); }
    }
    for (const sid of partnersOf(idx, cur)) {
      if (!gen.has(sid) && idx.personMap.has(sid)) { gen.set(sid, g); queue.push(sid); }
    }
  }
  // 未接続(孤立)の人物は最後にgen0扱い
  for (const p of persons) if (!gen.has(p.id)) gen.set(p.id, 0);
  return gen;
};

/** 親子エッジのみを使った proband からの到達可能集合（＝血縁。姻族判定に使う） */
const bloodlineSet = (persons: Person[], idx: Index): Set<string> => {
  const blood = new Set<string>();
  const proband =
    persons.find((p) => p.isProband) ?? persons.find((p) => p.relationship === '本人') ?? persons[0];
  if (!proband) return blood;
  const stack = [proband.id];
  blood.add(proband.id);
  while (stack.length) {
    const cur = stack.pop()!;
    for (const nid of [...parentsOf(idx, cur), ...childrenOf(idx, cur)]) {
      if (!blood.has(nid) && idx.personMap.has(nid)) { blood.add(nid); stack.push(nid); }
    }
  }
  return blood;
};

// ---- 2) 家族ユニットの再帰構築 ----

interface Unit {
  anchorId: string; // 血縁の中心人物（このユニットの代表）
  members: string[]; // 夫婦行の表示順（左→右）
  childUnits: Unit[];
  ownWidth: number;
  childrenWidth: number;
  width: number;
}

const orderCouple = (idx: Index, anchorId: string, spouseIds: string[]): string[] => {
  // 配偶者1人: 男=左, 女=右 で並べる
  if (spouseIds.length === 1) {
    const s = spouseIds[0];
    const aSex = idx.personMap.get(anchorId)?.sex;
    const sSex = idx.personMap.get(s)?.sex;
    if (aSex === 'female' && sSex === 'male') return [s, anchorId];
    if (aSex === 'male' && sSex === 'female') return [anchorId, s];
    // どちらも不明等: anchor を左
    return [anchorId, s];
  }
  // 複数婚: [spouse1, anchor, spouse2, ...]（anchorを中央寄りに）
  if (spouseIds.length >= 2) {
    const [first, ...rest] = spouseIds;
    return [first, anchorId, ...rest];
  }
  return [anchorId];
};

const buildUnit = (idx: Index, anchorId: string, visited: Set<string>): Unit => {
  visited.add(anchorId);
  const myUnions = idx.unionsAsParent.get(anchorId) ?? [];
  const spouseIds: string[] = [];
  const childUnits: Unit[] = [];

  for (const u of myUnions) {
    const spouse = u.a === anchorId ? u.b : u.a;
    if (spouse && !visited.has(spouse)) {
      visited.add(spouse);
      spouseIds.push(spouse);
    } else if (spouse && !spouseIds.includes(spouse)) {
      // 既に置かれた配偶者（姻族交差など）は members には入れない
    }
    for (const cid of u.childIds) {
      if (!visited.has(cid) && idx.personMap.has(cid)) {
        childUnits.push(buildUnit(idx, cid, visited));
      }
    }
  }

  const members = orderCouple(idx, anchorId, spouseIds);
  return finalizeUnit({ anchorId, members, childUnits, ownWidth: 0, childrenWidth: 0, width: 0 });
};

const finalizeUnit = (u: Unit): Unit => {
  u.ownWidth = u.members.length * NODE_W + Math.max(0, u.members.length - 1) * COUPLE_GAP;
  u.childrenWidth =
    u.childUnits.reduce((s, c) => s + c.width, 0) +
    Math.max(0, u.childUnits.length - 1) * SIBLING_GAP;
  u.width = Math.max(u.ownWidth, u.childrenWidth, NODE_W);
  return u;
};

// ---- 3) 座標割り当て（再帰・post-order） ----

const assignUnit = (
  u: Unit,
  left: number,
  idx: Index,
  gen: Map<string, number>,
  positions: Map<string, Pos>
) => {
  const unitCenter = left + u.width / 2;

  // 子サブツリーを並べる
  const childrenLeft = unitCenter - u.childrenWidth / 2;
  let cx = childrenLeft;
  const childAnchorXs: number[] = [];
  for (const c of u.childUnits) {
    assignUnit(c, cx, idx, gen, positions);
    const ax = positions.get(c.anchorId)?.x ?? cx + c.width / 2;
    childAnchorXs.push(ax);
    cx += c.width + SIBLING_GAP;
  }

  // 夫婦行の中心 = 子アンカーの重心（子が無ければユニット中心）
  const coupleCenter =
    childAnchorXs.length > 0
      ? (childAnchorXs[0] + childAnchorXs[childAnchorXs.length - 1]) / 2
      : unitCenter;

  // members を coupleCenter を中心に左→右へ配置
  let mx = coupleCenter - u.ownWidth / 2 + NODE_W / 2;
  for (const m of u.members) {
    const g = gen.get(m) ?? 0;
    positions.set(m, { x: mx, y: g * ROW_H });
    mx += NODE_W + COUPLE_GAP;
  }
};

// ---- 4) 仕上げ: 世代ごとの最小間隔保証（安全パス） ----

const resolveOverlaps = (
  persons: Person[],
  gen: Map<string, number>,
  positions: Map<string, Pos>
) => {
  const byGen = new Map<number, string[]>();
  for (const p of persons) {
    const g = gen.get(p.id) ?? 0;
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g)!.push(p.id);
  }
  for (const ids of byGen.values()) {
    ids.sort((a, b) => (positions.get(a)?.x ?? 0) - (positions.get(b)?.x ?? 0));
    const minGap = NODE_W; // 中心間の最小距離
    for (let i = 1; i < ids.length; i++) {
      const prev = positions.get(ids[i - 1])!;
      const curr = positions.get(ids[i])!;
      if (curr.x - prev.x < minGap) {
        positions.set(ids[i], { x: prev.x + minGap, y: curr.y });
      }
    }
  }
};

// ---- メイン ----

export const computeLayout = (persons: Person[], unions: Union[]): LayoutResult => {
  const positions = new Map<string, Pos>();
  if (persons.length === 0) {
    return { positions, generation: new Map(), width: 0, height: 0, minGen: 0, maxGen: 0 };
  }
  const idx = buildIndex(persons, unions);
  const generation = computeGenerations(persons, idx);
  const blood = bloodlineSet(persons, idx);

  // ルート選定: 親ユニットを持たない人物のうち、血縁を優先。
  const noParent = persons.filter((p) => !idx.parentUnionOf.has(p.id));
  const rootCandidates = [
    ...noParent.filter((p) => blood.has(p.id)),
    ...noParent.filter((p) => !blood.has(p.id)),
  ].sort((a, b) => (generation.get(a.id) ?? 0) - (generation.get(b.id) ?? 0));

  const visited = new Set<string>();
  const roots: Unit[] = [];
  for (const p of rootCandidates) {
    if (visited.has(p.id)) continue;
    roots.push(buildUnit(idx, p.id, visited));
  }
  // どのルートからも到達しなかった残り（循環・孤立）も個別ルート化
  for (const p of persons) {
    if (!visited.has(p.id)) roots.push(buildUnit(idx, p.id, visited));
  }

  // ルート群を左→右に並べる
  let left = 0;
  for (const r of roots) {
    assignUnit(r, left, idx, generation, positions);
    left += r.width + SIBLING_GAP * 2;
  }

  // 念のため全員に座標を（未配置があれば末尾に並べる）
  for (const p of persons) {
    if (!positions.has(p.id)) {
      const g = generation.get(p.id) ?? 0;
      positions.set(p.id, { x: left + NODE_W / 2, y: g * ROW_H });
      left += NODE_W + SIBLING_GAP;
    }
  }

  resolveOverlaps(persons, generation, positions);

  // 原点を MARGIN にそろえる（最小x,yを0基準へ）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  }
  const dx = MARGIN - (minX - NODE_W / 2);
  const dy = MARGIN - (minY - SYMBOL / 2);
  for (const [id, pos] of positions) positions.set(id, { x: pos.x + dx, y: pos.y + dy });

  const gens = [...generation.values()];
  return {
    positions,
    generation,
    width: maxX - minX + NODE_W + MARGIN * 2,
    height: maxY - minY + NODE_H + MARGIN * 2,
    minGen: Math.min(...gens),
    maxGen: Math.max(...gens),
  };
};
