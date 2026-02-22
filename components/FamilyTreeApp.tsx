'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeTypes,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import dagre from 'dagre';
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';

import { PersonNode, JunctionNode, AddRelationType } from './PersonNode';
import { Sidebar } from './Sidebar';
import { PersonEditDialog } from './PersonEditDialog';
import {
  PersonData,
  RelationshipEdge,
  DisplaySettings,
  FamilyTreeData,
  sampleData,
  defaultSettings,
  getDisplayName,
  childSortOrder,
  relationshipLabels,
} from '@/types/familyTree';
import { Button } from './ui/button';

const nodeTypes: NodeTypes = {
  person: PersonNode,
  junction: JunctionNode,
};

/** 同居グループの背景色 */
const LIVING_GROUP_BG_COLORS: Record<number, string> = {
  1: 'rgba(34,197,94,0.08)',
  2: 'rgba(249,115,22,0.08)',
  3: 'rgba(168,85,247,0.08)',
  4: 'rgba(20,184,166,0.08)',
  5: 'rgba(244,63,94,0.08)',
  6: 'rgba(6,182,212,0.08)',
  7: 'rgba(245,158,11,0.08)',
  8: 'rgba(99,102,241,0.08)',
  9: 'rgba(132,204,22,0.08)',
  10: 'rgba(217,70,239,0.08)',
};

const LIVING_GROUP_BORDER_COLORS: Record<number, string> = {
  1: 'rgba(34,197,94,0.4)',
  2: 'rgba(249,115,22,0.4)',
  3: 'rgba(168,85,247,0.4)',
  4: 'rgba(20,184,166,0.4)',
  5: 'rgba(244,63,94,0.4)',
  6: 'rgba(6,182,212,0.4)',
  7: 'rgba(245,158,11,0.4)',
  8: 'rgba(99,102,241,0.4)',
  9: 'rgba(132,204,22,0.4)',
  10: 'rgba(217,70,239,0.4)',
};

const NODE_WIDTH = 140;
const NODE_HEIGHT = 80;

/**
 * parentIds / spouseId からエッジを自動生成する
 */
const generateEdgesFromPersons = (persons: PersonData[]): RelationshipEdge[] => {
  const edges: RelationshipEdge[] = [];
  const spouseEdgeSet = new Set<string>();

  for (const person of persons) {
    if (person.parentIds) {
      for (const parentId of person.parentIds) {
        edges.push({
          id: `e${parentId}-${person.id}`,
          source: parentId,
          target: person.id,
          type: 'parent-child',
        });
      }
    }

    if (person.spouseId) {
      const key = [person.id, person.spouseId].sort().join('-');
      if (!spouseEdgeSet.has(key)) {
        spouseEdgeSet.add(key);
        edges.push({
          id: `spouse-${key}`,
          source: person.id,
          target: person.spouseId,
          type: 'spouse',
        });
      }
    }
  }

  return edges;
};

/**
 * 兄弟を続柄順でソートする
 */
const sortSiblings = (persons: PersonData[]): PersonData[] => {
  const personMap = new Map<string, PersonData>();
  for (const p of persons) personMap.set(p.id, p);

  const parentGroupMap = new Map<string, PersonData[]>();
  const noParent: PersonData[] = [];

  for (const p of persons) {
    if (p.parentIds && p.parentIds.length > 0) {
      const key = [...p.parentIds].sort().join(',');
      if (!parentGroupMap.has(key)) parentGroupMap.set(key, []);
      parentGroupMap.get(key)!.push(p);
    } else {
      noParent.push(p);
    }
  }

  for (const [, siblings] of parentGroupMap) {
    siblings.sort((a, b) => {
      const aOrder = childSortOrder[a.relationship] ?? 99;
      const bOrder = childSortOrder[b.relationship] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.id.localeCompare(b.id);
    });
  }

  const orderMap = new Map<string, number>();
  let idx = 0;
  for (const p of noParent) {
    orderMap.set(p.id, idx++);
  }
  for (const [, siblings] of parentGroupMap) {
    for (const p of siblings) {
      orderMap.set(p.id, idx++);
    }
  }

  return [...persons].sort((a, b) => {
    return (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0);
  });
};

/**
 * dagre.jsを使った自動レイアウト
 */
const calculateLayout = (persons: PersonData[]): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  if (persons.length === 0) return positions;

  const sorted = sortSiblings(persons);
  const personMap = new Map<string, PersonData>();
  for (const p of sorted) personMap.set(p.id, p);

  // --- BFS世代算出（dagreのランク付け補助） ---
  const generationOf = new Map<string, number>();
  const root = sorted.find(p => p.isRepresentative) ?? sorted.find(p => p.relationship === 'self') ?? sorted[0];
  generationOf.set(root.id, 0);

  const queue: string[] = [root.id];
  const visited = new Set<string>([root.id]);

  const childrenOf = new Map<string, string[]>();
  for (const p of sorted) {
    if (p.parentIds) {
      for (const pid of p.parentIds) {
        if (!childrenOf.has(pid)) childrenOf.set(pid, []);
        childrenOf.get(pid)!.push(p.id);
      }
    }
  }

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentGen = generationOf.get(currentId)!;
    const current = personMap.get(currentId);
    if (!current) continue;

    if (current.parentIds) {
      for (const pid of current.parentIds) {
        if (!visited.has(pid) && personMap.has(pid)) {
          generationOf.set(pid, currentGen - 1);
          visited.add(pid);
          queue.push(pid);
        }
      }
    }

    const children = childrenOf.get(currentId) ?? [];
    for (const cid of children) {
      if (!visited.has(cid) && personMap.has(cid)) {
        generationOf.set(cid, currentGen + 1);
        visited.add(cid);
        queue.push(cid);
      }
    }

    if (current.spouseId && !visited.has(current.spouseId) && personMap.has(current.spouseId)) {
      generationOf.set(current.spouseId, currentGen);
      visited.add(current.spouseId);
      queue.push(current.spouseId);
    }
  }

  for (const p of sorted) {
    if (!generationOf.has(p.id)) generationOf.set(p.id, 0);
  }

  // --- dagre グラフ構築 ---
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: 'TB',
    nodesep: 60,
    ranksep: 180,
    marginx: 50,
    marginy: 50,
  });
  g.setDefaultEdgeLabel(() => ({}));

  // 配偶者ペアを特定
  const spousePairs = new Map<string, string>();
  for (const p of sorted) {
    if (p.spouseId && personMap.has(p.spouseId)) {
      const key = [p.id, p.spouseId].sort().join('-');
      if (!spousePairs.has(p.id)) {
        spousePairs.set(p.id, p.spouseId);
      }
    }
  }

  // 処理済み配偶者ペアを追跡
  const processedSpouse = new Set<string>();

  // ノード追加（配偶者ペアは仮想コンパウンドノードとして追加）
  for (const p of sorted) {
    g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // 親子エッジのみ追加（配偶者はランク外で横並びにする）
  for (const p of sorted) {
    if (p.parentIds) {
      for (const pid of p.parentIds) {
        if (personMap.has(pid)) {
          g.setEdge(pid, p.id);
        }
      }
    }
  }

  dagre.layout(g);

  // dagreの結果を取得
  for (const p of sorted) {
    const nodeWithPosition = g.node(p.id);
    if (nodeWithPosition) {
      positions.set(p.id, {
        x: nodeWithPosition.x - NODE_WIDTH / 2,
        y: nodeWithPosition.y - NODE_HEIGHT / 2,
      });
    }
  }

  // 配偶者を横並びに補正
  const adjustedSpouse = new Set<string>();
  for (const p of sorted) {
    if (p.spouseId && personMap.has(p.spouseId) && !adjustedSpouse.has(p.id) && !adjustedSpouse.has(p.spouseId)) {
      const pos1 = positions.get(p.id);
      const pos2 = positions.get(p.spouseId);
      if (pos1 && pos2) {
        // 同じY座標にし、横に並べる
        const avgY = Math.min(pos1.y, pos2.y);
        const centerX = (pos1.x + pos2.x) / 2;
        const SPOUSE_GAP = 160;
        positions.set(p.id, { x: centerX - SPOUSE_GAP / 2, y: avgY });
        positions.set(p.spouseId, { x: centerX + SPOUSE_GAP / 2, y: avgY });
        adjustedSpouse.add(p.id);
        adjustedSpouse.add(p.spouseId);
      }
    }
  }

  // 子を両親の中央下に再配置
  const parentPairChildren = new Map<string, string[]>();
  for (const p of sorted) {
    if (p.parentIds && p.parentIds.length > 0) {
      const key = [...p.parentIds].sort().join(',');
      if (!parentPairChildren.has(key)) parentPairChildren.set(key, []);
      parentPairChildren.get(key)!.push(p.id);
    }
  }

  for (const [parentKey, childIds] of parentPairChildren) {
    const parentIdsList = parentKey.split(',');
    const parentXs = parentIdsList.map(id => positions.get(id)?.x ?? 0);
    const parentCenter = parentXs.reduce((a, b) => a + b, 0) / parentXs.length + NODE_WIDTH / 2;

    const CHILD_GAP = 180;
    const totalWidth = (childIds.length - 1) * CHILD_GAP;
    const startX = parentCenter - totalWidth / 2 - NODE_WIDTH / 2;

    for (let i = 0; i < childIds.length; i++) {
      const cid = childIds[i];
      const existingPos = positions.get(cid);
      if (existingPos) {
        positions.set(cid, { x: startX + i * CHILD_GAP, y: existingPos.y });
      }
    }
  }

  // 重なり解消（同世代内）
  const genGroups = new Map<number, string[]>();
  for (const p of sorted) {
    const gen = generationOf.get(p.id) ?? 0;
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(p.id);
  }

  for (const [, ids] of genGroups) {
    const sortedByX = ids.sort((a, b) => (positions.get(a)?.x ?? 0) - (positions.get(b)?.x ?? 0));
    for (let i = 1; i < sortedByX.length; i++) {
      const prev = positions.get(sortedByX[i - 1]);
      const curr = positions.get(sortedByX[i]);
      if (prev && curr) {
        const minX = prev.x + NODE_WIDTH + 40;
        if (curr.x < minX) {
          positions.set(sortedByX[i], { x: minX, y: curr.y });
        }
      }
    }
  }

  return positions;
};

/**
 * RelationshipEdge[] + positions → ReactFlow Edge[] + ジャンクションノード
 * 関係線の種類分け実装
 */
const buildFlowElements = (
  relEdges: RelationshipEdge[],
  positions: Map<string, { x: number; y: number }>,
): { edges: Edge[]; junctionNodes: Node[] } => {
  const edges: Edge[] = [];
  const junctionNodes: Node[] = [];

  // 子ごとの親リスト
  const childParents = new Map<string, string[]>();
  for (const e of relEdges) {
    if (e.type === 'parent-child') {
      if (!childParents.has(e.target)) childParents.set(e.target, []);
      childParents.get(e.target)!.push(e.source);
    }
  }

  // 2親の子を把握
  const twoParentChildren = new Set<string>();
  const spouseJunctions = new Map<string, string>();

  for (const [childId, parentIds] of childParents) {
    if (parentIds.length === 2) {
      twoParentChildren.add(childId);

      const pairKey = [...parentIds].sort().join('-');
      if (!spouseJunctions.has(pairKey)) {
        const pos1 = positions.get(parentIds[0]);
        const pos2 = positions.get(parentIds[1]);
        if (pos1 && pos2) {
          const jId = `junction-${pairKey}`;
          const jx = (pos1.x + pos2.x) / 2;
          const jy = Math.max(pos1.y, pos2.y) + 45;

          junctionNodes.push({
            id: jId,
            type: 'junction',
            position: { x: jx, y: jy },
            data: { label: '' },
            selectable: false,
            draggable: false,
          });

          spouseJunctions.set(pairKey, jId);
        }
      }

      const jId = spouseJunctions.get(pairKey);
      if (jId) {
        // 親子線: 実線、少し太め、ダークグレー
        edges.push({
          id: `e-${jId}-${childId}`,
          source: jId,
          target: childId,
          type: 'smoothstep',
          style: { stroke: '#475569', strokeWidth: 2 },
          zIndex: 1,
        });
      }
    }
  }

  // エッジ生成
  for (const edge of relEdges) {
    if (edge.type === 'spouse') {
      // 配偶者線: 二重線風（太い白線 + 細い色線）
      // 背景の太い線
      edges.push({
        id: `${edge.id}-bg`,
        source: edge.source,
        target: edge.target,
        type: 'straight',
        sourceHandle: 'right-source',
        targetHandle: 'left-target',
        style: { stroke: '#2563EB', strokeWidth: 5 },
        zIndex: 0,
      });
      // 中央の白抜き線
      edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'straight',
        sourceHandle: 'right-source',
        targetHandle: 'left-target',
        style: { stroke: '#F8FAFC', strokeWidth: 2 },
        label: edge.label,
        zIndex: 1,
      });
      continue;
    }

    // parent-child: 2親の子はスキップ（junction経由）
    if (twoParentChildren.has(edge.target)) continue;

    // 親子線: 実線
    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      style: { stroke: '#475569', strokeWidth: 2 },
      label: edge.label,
      zIndex: 1,
    });
  }

  return { edges, junctionNodes };
};

/**
 * メンバー一覧テーブル
 */
const MemberTable: React.FC<{
  persons: PersonData[];
  allPersons: PersonData[];
  onEdit: (person: PersonData) => void;
  onReorder: (persons: PersonData[]) => void;
}> = ({ persons, allPersons, onEdit, onReorder }) => {
  const getParentNames = (parentIds?: string[]) => {
    if (!parentIds || parentIds.length === 0) return { father: '-', mother: '-' };
    const father = parentIds.map(id => allPersons.find(p => p.id === id)).find(p => p?.gender === 'male');
    const mother = parentIds.map(id => allPersons.find(p => p.id === id)).find(p => p?.gender === 'female');
    return {
      father: father ? father.name : '-',
      mother: mother ? mother.name : '-',
    };
  };

  const moveUp = (index: number) => {
    if (index <= 0) return;
    const newPersons = [...persons];
    [newPersons[index - 1], newPersons[index]] = [newPersons[index], newPersons[index - 1]];
    onReorder(newPersons);
  };

  const moveDown = (index: number) => {
    if (index >= persons.length - 1) return;
    const newPersons = [...persons];
    [newPersons[index], newPersons[index + 1]] = [newPersons[index + 1], newPersons[index]];
    onReorder(newPersons);
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr style={{ backgroundColor: '#F1F5F9' }} className="border-b">
            <th className="px-2 py-2 text-left font-semibold" style={{ color: '#475569' }}>名前</th>
            <th className="px-2 py-2 text-left font-semibold" style={{ color: '#475569' }}>続柄</th>
            <th className="px-2 py-2 text-left font-semibold" style={{ color: '#475569' }}>性別</th>
            <th className="px-2 py-2 text-left font-semibold" style={{ color: '#475569' }}>父</th>
            <th className="px-2 py-2 text-left font-semibold" style={{ color: '#475569' }}>母</th>
            <th className="px-2 py-2 text-left font-semibold" style={{ color: '#475569' }}>既往歴</th>
            <th className="px-2 py-2 text-left font-semibold hidden lg:table-cell" style={{ color: '#475569' }}>同居</th>
            <th className="px-2 py-2 text-left font-semibold hidden lg:table-cell" style={{ color: '#475569' }}>住所</th>
            <th className="px-2 py-2 text-center font-semibold" style={{ color: '#475569' }}>並替</th>
            <th className="px-2 py-2 text-center font-semibold" style={{ color: '#475569' }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {persons.map((person, index) => {
            const parents = getParentNames(person.parentIds);
            return (
              <tr key={person.id} className="border-b hover:bg-blue-50/30">
                <td className="px-2 py-1.5 font-medium" style={{ color: '#1E293B' }}>{getDisplayName(person)}</td>
                <td className="px-2 py-1.5" style={{ color: '#64748B' }}>{relationshipLabels[person.relationship] ?? '-'}</td>
                <td className="px-2 py-1.5" style={{ color: '#64748B' }}>
                  {person.gender === 'male' ? '男' : person.gender === 'female' ? '女' : '他'}
                </td>
                <td className="px-2 py-1.5" style={{ color: '#64748B' }}>{parents.father}</td>
                <td className="px-2 py-1.5" style={{ color: '#64748B' }}>{parents.mother}</td>
                <td className="px-2 py-1.5" style={{ color: '#DC2626' }}>
                  {person.medicalHistory || '-'}
                </td>
                <td className="px-2 py-1.5 hidden lg:table-cell" style={{ color: '#64748B' }}>
                  {person.livingTogether && person.livingGroup ? person.livingGroup : '-'}
                </td>
                <td className="px-2 py-1.5 hidden lg:table-cell max-w-[120px] truncate" style={{ color: '#64748B' }}>
                  {person.address || '-'}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <div className="flex gap-0.5 justify-center">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="hover:text-blue-600 disabled:opacity-30"
                      style={{ color: '#94A3B8' }}
                      title="上へ"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === persons.length - 1}
                      className="hover:text-blue-600 disabled:opacity-30"
                      style={{ color: '#94A3B8' }}
                      title="下へ"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => onEdit(person)}
                    className="hover:text-blue-700"
                    style={{ color: '#2563EB' }}
                    title="編集"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/**
 * 同居グループの囲み枠を計算する
 */
const buildLivingGroupNodes = (
  persons: PersonData[],
  positions: Map<string, { x: number; y: number }>,
): Node[] => {
  const groups = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>();

  for (const p of persons) {
    if (!p.livingTogether || !p.livingGroup) continue;
    const pos = positions.get(p.id);
    if (!pos) continue;

    const existing = groups.get(p.livingGroup);
    if (existing) {
      existing.minX = Math.min(existing.minX, pos.x);
      existing.minY = Math.min(existing.minY, pos.y);
      existing.maxX = Math.max(existing.maxX, pos.x + NODE_WIDTH);
      existing.maxY = Math.max(existing.maxY, pos.y + NODE_HEIGHT);
    } else {
      groups.set(p.livingGroup, {
        minX: pos.x,
        minY: pos.y,
        maxX: pos.x + NODE_WIDTH,
        maxY: pos.y + NODE_HEIGHT,
      });
    }
  }

  const PADDING = 30;
  const nodes: Node[] = [];

  for (const [groupNum, bounds] of groups) {
    nodes.push({
      id: `living-group-${groupNum}`,
      type: 'group',
      position: {
        x: bounds.minX - PADDING,
        y: bounds.minY - PADDING,
      },
      data: { label: '' },
      style: {
        width: bounds.maxX - bounds.minX + PADDING * 2,
        height: bounds.maxY - bounds.minY + PADDING * 2,
        backgroundColor: LIVING_GROUP_BG_COLORS[groupNum] ?? 'rgba(34,197,94,0.08)',
        border: `2px dashed ${LIVING_GROUP_BORDER_COLORS[groupNum] ?? 'rgba(34,197,94,0.4)'}`,
        borderRadius: '8px',
        zIndex: -1,
        pointerEvents: 'none' as const,
      },
      selectable: false,
      draggable: false,
    });
  }

  return nodes;
};

/**
 * 代表者からの親等をBFSで計算する
 */
const calculateKinshipDegrees = (
  persons: PersonData[],
): Map<string, { degree: number; viaSpouse: boolean }> => {
  const result = new Map<string, { degree: number; viaSpouse: boolean }>();
  if (persons.length === 0) return result;

  const representative = persons.find(p => p.isRepresentative);
  if (!representative) return result;

  const personMap = new Map<string, PersonData>();
  for (const p of persons) personMap.set(p.id, p);

  const adjacency = new Map<string, { targetId: string; weight: number; isSpouseEdge: boolean }[]>();

  const addEdge = (from: string, to: string, weight: number, isSpouseEdge: boolean) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from)!.push({ targetId: to, weight, isSpouseEdge });
  };

  for (const p of persons) {
    if (p.parentIds) {
      for (const pid of p.parentIds) {
        if (personMap.has(pid)) {
          addEdge(p.id, pid, 1, false);
          addEdge(pid, p.id, 1, false);
        }
      }
    }
    if (p.spouseId && personMap.has(p.spouseId)) {
      addEdge(p.id, p.spouseId, 0, true);
      addEdge(p.spouseId, p.id, 0, true);
    }
  }

  const visited = new Map<string, { degree: number; viaSpouse: boolean }>();
  const deque: { id: string; degree: number; viaSpouse: boolean }[] = [];
  deque.push({ id: representative.id, degree: 0, viaSpouse: false });

  while (deque.length > 0) {
    const current = deque.shift()!;
    if (visited.has(current.id)) continue;
    visited.set(current.id, { degree: current.degree, viaSpouse: current.viaSpouse });

    const neighbors = adjacency.get(current.id) ?? [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor.targetId)) continue;
      const newDegree = current.degree + neighbor.weight;
      const viaSpouse = current.viaSpouse || neighbor.isSpouseEdge;
      if (neighbor.weight === 0) {
        deque.unshift({ id: neighbor.targetId, degree: newDegree, viaSpouse });
      } else {
        deque.push({ id: neighbor.targetId, degree: newDegree, viaSpouse });
      }
    }
  }

  return visited;
};

export const FamilyTreeApp: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [settings, setSettings] = useState<DisplaySettings>(defaultSettings);
  const [selectedPerson, setSelectedPerson] = useState<PersonData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showFamilyTree, setShowFamilyTree] = useState(true);

  const flowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Undo/Redo
  const [personHistory, setPersonHistory] = useState<PersonData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const personsRef = useRef<PersonData[]>([]);

  /** +ボタンから関係者を追加するハンドラ */
  const handleAddRelation = useCallback((personId: string, relationType: AddRelationType) => {
    const currentPerson = personsRef.current.find(p => p.id === personId);
    if (!currentPerson) return;

    const newId = `p${Date.now()}`;
    let newPerson: PersonData;

    switch (relationType) {
      case 'father':
        newPerson = {
          id: newId,
          name: '',
          gender: 'male',
          lifeStatus: 'alive',
          relationship: 'father',
          isRepresentative: false,
        };
        // 既存の人物にparentIdとして追加
        const withFather = personsRef.current.map(p => {
          if (p.id === personId) {
            const parentIds = p.parentIds ? [...p.parentIds.filter(pid => {
              const parent = personsRef.current.find(pp => pp.id === pid);
              return parent?.gender !== 'male';
            }), newId] : [newId];
            return { ...p, parentIds };
          }
          return p;
        });
        updatePersonsInternal([...withFather, newPerson]);
        setSelectedPerson(newPerson);
        setIsDialogOpen(true);
        return;

      case 'mother':
        newPerson = {
          id: newId,
          name: '',
          gender: 'female',
          lifeStatus: 'alive',
          relationship: 'mother',
          isRepresentative: false,
        };
        const withMother = personsRef.current.map(p => {
          if (p.id === personId) {
            const parentIds = p.parentIds ? [...p.parentIds.filter(pid => {
              const parent = personsRef.current.find(pp => pp.id === pid);
              return parent?.gender !== 'female';
            }), newId] : [newId];
            return { ...p, parentIds };
          }
          return p;
        });
        updatePersonsInternal([...withMother, newPerson]);
        setSelectedPerson(newPerson);
        setIsDialogOpen(true);
        return;

      case 'spouse':
        newPerson = {
          id: newId,
          name: '',
          gender: currentPerson.gender === 'male' ? 'female' : 'male',
          lifeStatus: 'alive',
          relationship: 'spouse',
          spouseId: personId,
          isRepresentative: false,
        };
        const withSpouse = personsRef.current.map(p => {
          if (p.id === personId) return { ...p, spouseId: newId };
          return p;
        });
        updatePersonsInternal([...withSpouse, newPerson]);
        setSelectedPerson(newPerson);
        setIsDialogOpen(true);
        return;

      case 'child':
        newPerson = {
          id: newId,
          name: '',
          gender: 'male',
          lifeStatus: 'alive',
          relationship: 'other',
          isRepresentative: false,
          parentIds: currentPerson.spouseId
            ? [personId, currentPerson.spouseId]
            : [personId],
        };
        updatePersonsInternal([...personsRef.current, newPerson]);
        setSelectedPerson(newPerson);
        setIsDialogOpen(true);
        return;
    }
  }, []);

  /** PersonData[]からノード&エッジを再構築 */
  const rebuildFlow = useCallback((persons: PersonData[], displaySettings: DisplaySettings) => {
    personsRef.current = persons;
    const positions = calculateLayout(persons);
    const relEdges = generateEdgesFromPersons(persons);
    const { edges: flowEdges, junctionNodes } = buildFlowElements(relEdges, positions);
    const livingGroupNodes = buildLivingGroupNodes(persons, positions);
    const kinshipDegrees = calculateKinshipDegrees(persons);

    const personNodes: Node[] = persons.map((person) => {
      const kinship = kinshipDegrees.get(person.id);
      return {
        id: person.id,
        type: 'person',
        position: positions.get(person.id) || { x: 0, y: 0 },
        data: {
          ...person,
          label: person.name,
          settings: displaySettings,
          kinshipDegree: kinship?.degree,
          kinshipViaSpouse: kinship?.viaSpouse,
          onAddRelation: handleAddRelation,
        },
      };
    });

    setNodes([...livingGroupNodes, ...personNodes, ...junctionNodes]);
    setEdges(flowEdges);
  }, [setNodes, setEdges, handleAddRelation]);

  /** 履歴にスナップショットを追加 */
  const pushHistory = useCallback((persons: PersonData[]) => {
    setPersonHistory(prev => {
      const newHist = prev.slice(0, historyIndex + 1);
      newHist.push(JSON.parse(JSON.stringify(persons)));
      if (newHist.length > 50) newHist.shift();
      return newHist;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  /** PersonData[]を更新し、フローとヒストリーを同期 */
  const updatePersons = useCallback((persons: PersonData[], skipHistory = false) => {
    if (!skipHistory) {
      pushHistory(persons);
    }
    rebuildFlow(persons, settings);
  }, [rebuildFlow, settings, pushHistory]);

  /** handleAddRelationから呼ばれる内部更新（settingsのclosure問題回避） */
  const updatePersonsRef = useRef(updatePersons);
  updatePersonsRef.current = updatePersons;

  const updatePersonsInternal = useCallback((persons: PersonData[]) => {
    updatePersonsRef.current(persons);
  }, []);

  // 初回ロード
  useEffect(() => {
    const autoSaved = localStorage.getItem('familyTreeAutoSave');
    if (autoSaved) {
      try {
        const data: FamilyTreeData = JSON.parse(autoSaved);
        if (confirm('自動保存されたデータが見つかりました。復元しますか？')) {
          setSettings(data.settings);
          personsRef.current = data.nodes;
          rebuildFlow(data.nodes, data.settings);
          pushHistory(data.nodes);
          return;
        }
      } catch (e) {
        console.error('自動保存データの読み込みに失敗しました', e);
      }
    }
    setSettings(sampleData.settings);
    personsRef.current = sampleData.nodes;
    rebuildFlow(sampleData.nodes, sampleData.settings);
    pushHistory(sampleData.nodes);
  }, []);

  // 自動保存
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      const data: FamilyTreeData = {
        version: '1.0.0',
        settings,
        nodes: personsRef.current,
        edges: generateEdgesFromPersons(personsRef.current),
      };
      localStorage.setItem('familyTreeAutoSave', JSON.stringify(data));
    }, 5000);
    return () => clearInterval(autoSaveInterval);
  }, [settings]);

  // 設定変更時にノードを更新
  useEffect(() => {
    if (personsRef.current.length > 0) {
      rebuildFlow(personsRef.current, settings);
    }
  }, [settings, rebuildFlow]);

  // キーボードショートカット
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      const prev = personHistory[newIndex];
      if (prev) {
        setHistoryIndex(newIndex);
        personsRef.current = prev;
        rebuildFlow(prev, settings);
      }
    }
  }, [historyIndex, personHistory, rebuildFlow, settings]);

  const handleRedo = useCallback(() => {
    if (historyIndex < personHistory.length - 1) {
      const newIndex = historyIndex + 1;
      const next = personHistory[newIndex];
      if (next) {
        setHistoryIndex(newIndex);
        personsRef.current = next;
        rebuildFlow(next, settings);
      }
    }
  }, [historyIndex, personHistory, rebuildFlow, settings]);

  const getCurrentData = (): FamilyTreeData => {
    return {
      version: '1.0.0',
      settings,
      nodes: personsRef.current,
      edges: generateEdgesFromPersons(personsRef.current),
    };
  };

  const loadData = (data: FamilyTreeData) => {
    setSettings(data.settings);
    personsRef.current = data.nodes;
    rebuildFlow(data.nodes, data.settings);
    pushHistory(data.nodes);
  };

  const handleAddPerson = useCallback(() => {
    const newPerson: PersonData = {
      id: `p${Date.now()}`,
      name: '',
      gender: 'male',
      lifeStatus: 'alive',
      relationship: 'other',
      isRepresentative: false,
      parentIds: [],
    };

    const allPersons = [...personsRef.current, newPerson];
    updatePersons(allPersons);

    setSelectedPerson(newPerson);
    setIsDialogOpen(true);
  }, [updatePersons]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    if (node.type !== 'person') return;
    const { settings: _, label: __, onAddRelation: ___, ...personData } = node.data;
    setSelectedPerson(personData as PersonData);
    setIsDialogOpen(true);
  }, []);

  const handleSavePerson = useCallback(
    (updatedPerson: PersonData) => {
      let allPersons = personsRef.current.map((p) =>
        p.id === updatedPerson.id ? updatedPerson : p
      );

      if (updatedPerson.isRepresentative) {
        allPersons = allPersons.map(p =>
          p.id !== updatedPerson.id ? { ...p, isRepresentative: false } : p
        );
      }

      if (updatedPerson.spouseId) {
        allPersons = allPersons.map(p =>
          p.id === updatedPerson.spouseId
            ? { ...p, spouseId: updatedPerson.id }
            : p
        );
      }

      const oldPerson = personsRef.current.find(p => p.id === updatedPerson.id);
      if (oldPerson?.spouseId && oldPerson.spouseId !== updatedPerson.spouseId) {
        allPersons = allPersons.map(p =>
          p.id === oldPerson.spouseId && p.spouseId === updatedPerson.id
            ? { ...p, spouseId: undefined }
            : p
        );
      }

      if (!updatedPerson.spouseId && oldPerson?.spouseId) {
        allPersons = allPersons.map(p =>
          p.id === oldPerson.spouseId && p.spouseId === updatedPerson.id
            ? { ...p, spouseId: undefined }
            : p
        );
      }

      updatePersons(allPersons);
    },
    [updatePersons]
  );

  const handleDeletePerson = useCallback(
    (personId: string) => {
      const allPersons = personsRef.current
        .filter(p => p.id !== personId)
        .map(p => ({
          ...p,
          parentIds: p.parentIds?.filter(id => id !== personId),
          spouseId: p.spouseId === personId ? undefined : p.spouseId,
        }));
      updatePersons(allPersons);
    },
    [updatePersons]
  );

  const handleEditFromTable = useCallback((person: PersonData) => {
    setSelectedPerson(person);
    setIsDialogOpen(true);
  }, []);

  const handleReorder = useCallback((newPersons: PersonData[]) => {
    updatePersons(newPersons);
  }, [updatePersons]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setNodes((nds) => nds.map((node) => ({ ...node, hidden: false })));
      return;
    }

    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        hidden: node.type === 'person'
          ? !node.data.name.toLowerCase().includes(query.toLowerCase())
          : true,
      }))
    );

    const matchingNode = nodes.find(n =>
      n.type === 'person' && n.data.name.toLowerCase().includes(query.toLowerCase())
    );
    if (matchingNode && reactFlowInstance) {
      reactFlowInstance.setCenter(
        matchingNode.position.x,
        matchingNode.position.y,
        { zoom: 1.5, duration: 800 }
      );
    }
  }, [setNodes, nodes, reactFlowInstance]);

  const handleExportJSON = useCallback(() => {
    const data = getCurrentData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `family-tree-${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [settings]);

  const handleImportJSON = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data: FamilyTreeData = JSON.parse(e.target?.result as string);
            loadData(data);
          } catch {
            alert('ファイルの読み込みに失敗しました');
          }
        };
        reader.readAsText(file);
      }
      event.target.value = '';
    },
    []
  );

  const handleExportImage = useCallback(() => {
    if (flowRef.current) {
      toPng(flowRef.current, { backgroundColor: '#F8FAFC', cacheBust: true })
        .then((dataUrl) => {
          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `family-tree-${new Date().getTime()}.png`;
          link.click();
        })
        .catch((error) => {
          console.error('画像の生成に失敗しました:', error);
        });
    }
  }, []);

  const handleReset = useCallback(() => {
    if (confirm('全てのデータを消去しますか？\n\nこの操作は取り消せません。')) {
      localStorage.removeItem('familyTreeAutoSave');
      personsRef.current = [];
      rebuildFlow([], settings);
      setPersonHistory([]);
      setHistoryIndex(-1);
      pushHistory([]);
    }
  }, [rebuildFlow, settings, pushHistory]);

  const allPersons = personsRef.current;

  return (
    <div className="h-screen w-full flex" style={{ backgroundColor: '#F8FAFC' }}>
      <Sidebar
        settings={settings}
        onSettingsChange={setSettings}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onExportImage={handleExportImage}
        onReset={handleReset}
        onAddPerson={handleAddPerson}
        onSearch={handleSearch}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={historyIndex > 0}
        canRedo={historyIndex < personHistory.length - 1}
      />

      <main className="flex-1 h-full flex flex-col overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        <div style={{ borderBottom: '1px solid #E2E8F0' }}>
          <button
            onClick={() => setShowFamilyTree(!showFamilyTree)}
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-blue-50/50 text-sm font-medium transition-colors"
            style={{ backgroundColor: '#F8FAFC', color: '#475569' }}
          >
            <span>家系図</span>
            {showFamilyTree ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showFamilyTree && (
          <div className="relative" style={{ backgroundColor: '#F8FAFC', height: '50%', minHeight: 200 }}>
            <div ref={flowRef} className="w-full h-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onInit={setReactFlowInstance}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                fitView
              >
                <Controls />
                <Background color="#E2E8F0" gap={20} />
              </ReactFlow>
            </div>

            <div
              className="absolute bottom-2 right-2 text-xs px-3 py-1 rounded-full shadow-sm"
              style={{ backgroundColor: '#fff', color: '#94A3B8', border: '1px solid #E2E8F0' }}
            >
              自動保存中...
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-4" style={{ backgroundColor: '#fff' }}>
          <h3 className="text-sm font-semibold mb-2" style={{ color: '#475569' }}>メンバー一覧</h3>
          <MemberTable
            persons={allPersons}
            allPersons={allPersons}
            onEdit={handleEditFromTable}
            onReorder={handleReorder}
          />
        </div>
      </main>

      <PersonEditDialog
        person={selectedPerson}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSavePerson}
        onDelete={handleDeletePerson}
        allPersons={allPersons}
      />
    </div>
  );
};
