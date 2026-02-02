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
import { ChevronDown, ChevronUp, Pencil } from 'lucide-react';

import { PersonNode, JunctionNode } from './PersonNode';
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
} from '@/types/familyTree';
import { Button } from './ui/button';

const nodeTypes: NodeTypes = {
  person: PersonNode,
  junction: JunctionNode,
};

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
 * 兄弟を誕生日昇順でソートする
 */
const sortSiblings = (persons: PersonData[]): PersonData[] => {
  const personMap = new Map<string, PersonData>();
  for (const p of persons) personMap.set(p.id, p);

  // 親ペアキー → 子リスト
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

  // 各兄弟グループを誕生日でソート
  for (const [, siblings] of parentGroupMap) {
    siblings.sort((a, b) => {
      const aDate = a.birthDate ? parseInt(a.birthDate, 10) : Infinity;
      const bDate = b.birthDate ? parseInt(b.birthDate, 10) : Infinity;
      if (aDate !== bDate) return aDate - bDate;
      return a.id.localeCompare(b.id);
    });
  }

  // ソート済みの順序マップを構築
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
 * グラフ走査ベースのレイアウト計算
 * - BFSで世代を算出
 * - 子を親ペアの中央下に配置
 * - 兄弟は誕生日昇順
 */
const calculateLayout = (persons: PersonData[]): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  if (persons.length === 0) return positions;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const SPOUSE_GAP = isMobile ? 100 : 140;
  const SIBLING_GAP = isMobile ? 130 : 180;
  const GENERATION_GAP = isMobile ? 160 : 200;
  const NODE_WIDTH = isMobile ? 100 : 120; // ノード概算幅

  const sorted = sortSiblings(persons);

  const personMap = new Map<string, PersonData>();
  for (const p of sorted) personMap.set(p.id, p);

  // --- BFS世代算出 ---
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

  // --- 世代グループ化 ---
  const generations = new Map<number, PersonData[]>();
  for (const p of sorted) {
    const gen = generationOf.get(p.id)!;
    if (!generations.has(gen)) generations.set(gen, []);
    generations.get(gen)!.push(p);
  }
  const minGen = Math.min(...generations.keys());
  const maxGen = Math.max(...generations.keys());

  // 配偶者ペア
  const spousePairs = new Map<string, string>();
  for (const person of sorted) {
    if (person.spouseId) spousePairs.set(person.id, person.spouseId);
  }

  // --- Pass 1: 最上世代から順にユニットを構築し仮配置 ---
  // ユニット = 配偶者ペア or 単独
  type Unit = { ids: string[]; width: number; centerX: number };
  const genUnits = new Map<number, Unit[]>();

  const sortedGens = Array.from(generations.keys()).sort((a, b) => a - b);

  for (const gen of sortedGens) {
    const genPersons = generations.get(gen)!;
    const placed = new Set<string>();
    const units: Unit[] = [];

    for (const person of genPersons) {
      if (placed.has(person.id)) continue;
      const spouseId = spousePairs.get(person.id);
      if (spouseId && genPersons.some(p => p.id === spouseId) && !placed.has(spouseId)) {
        units.push({ ids: [person.id, spouseId], width: SPOUSE_GAP + NODE_WIDTH, centerX: 0 });
        placed.add(person.id);
        placed.add(spouseId);
      } else {
        units.push({ ids: [person.id], width: NODE_WIDTH, centerX: 0 });
        placed.add(person.id);
      }
    }
    genUnits.set(gen, units);
  }

  // --- Pass 2: ボトムアップで子の位置を親中央に揃える ---
  // まず最上世代を仮配置
  const placeUnits = (units: Unit[]) => {
    let currentX = 0;
    for (let i = 0; i < units.length; i++) {
      if (i > 0) currentX += SIBLING_GAP;
      units[i].centerX = currentX + units[i].width / 2;
      currentX += units[i].width;
    }
    // 中央揃え
    const totalWidth = currentX;
    const offset = totalWidth / 2;
    for (const u of units) u.centerX -= offset;
  };

  // 最上世代を仮配置
  const topUnits = genUnits.get(sortedGens[0]);
  if (topUnits) placeUnits(topUnits);

  // 上→下に、親の中央を基準に子を配置
  for (let gi = 1; gi < sortedGens.length; gi++) {
    const gen = sortedGens[gi];
    const units = genUnits.get(gen)!;
    const parentGen = sortedGens[gi - 1];
    const parentUnits = genUnits.get(parentGen);

    // 各ユニットの理想位置（親の中央）を計算
    for (const unit of units) {
      const parentPositions: number[] = [];
      for (const id of unit.ids) {
        const person = personMap.get(id);
        if (person?.parentIds) {
          for (const pid of person.parentIds) {
            // 親がいるユニットの中心を探す
            if (parentUnits) {
              const pu = parentUnits.find(u => u.ids.includes(pid));
              if (pu) parentPositions.push(pu.centerX);
            }
          }
        }
      }
      if (parentPositions.length > 0) {
        const avgX = parentPositions.reduce((a, b) => a + b, 0) / parentPositions.length;
        unit.centerX = avgX;
      }
    }

    // 重なり解消: 左から順にSIBLING_GAP以上の間隔を保証
    units.sort((a, b) => a.centerX - b.centerX);
    for (let i = 1; i < units.length; i++) {
      const minX = units[i - 1].centerX + units[i - 1].width / 2 + SIBLING_GAP + units[i].width / 2;
      if (units[i].centerX < minX) {
        units[i].centerX = minX;
      }
    }
  }

  // --- Pass 3: ユニットからノード位置を確定 ---
  for (const [gen, units] of genUnits) {
    const y = (gen - minGen) * GENERATION_GAP;
    for (const unit of units) {
      if (unit.ids.length === 2) {
        positions.set(unit.ids[0], { x: unit.centerX - SPOUSE_GAP / 2, y });
        positions.set(unit.ids[1], { x: unit.centerX + SPOUSE_GAP / 2, y });
      } else {
        positions.set(unit.ids[0], { x: unit.centerX, y });
      }
    }
  }

  return positions;
};

/**
 * RelationshipEdge[] + positions → ReactFlow Edge[] + 中間ノード
 *
 * 両親が2人いる子の場合:
 *   配偶者線の中点に透明ノードを置き、そこから子へ1本の垂直線を引く。
 *   個別の親→子エッジは生成しない。
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

  // 2親の子を把握（個別エッジをスキップするため）
  const twoParentChildren = new Set<string>();
  // 配偶者ペアキー → junctionノードID（同じ夫婦から複数の子がいる場合共有）
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
          // 両親の中点x（= 親ペアユニットのcenterX）、同じy座標
          const jx = (pos1.x + pos2.x) / 2;
          const jy = pos1.y;

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

      // junction → 子 のエッジ
      const jId = spouseJunctions.get(pairKey);
      if (jId) {
        edges.push({
          id: `e-${jId}-${childId}`,
          source: jId,
          target: childId,
          type: 'smoothstep',
          style: { stroke: '#6b7280', strokeWidth: 2 },
        });
      }
    }
  }

  // 通常のエッジ生成
  for (const edge of relEdges) {
    if (edge.type === 'spouse') {
      edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'straight',
        sourceHandle: 'right-source',
        targetHandle: 'left-target',
        style: { stroke: '#e11d48', strokeWidth: 4 },
        label: edge.label,
      });
      continue;
    }

    // parent-child: 2親の子はスキップ（junction経由で接続済み）
    if (twoParentChildren.has(edge.target)) continue;

    // 1親のみの場合
    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      style: { stroke: '#6b7280', strokeWidth: 2 },
      label: edge.label,
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
}> = ({ persons, allPersons, onEdit }) => {
  const findName = (id?: string) => {
    if (!id) return '-';
    const p = allPersons.find(person => person.id === id);
    return p ? getDisplayName(p) : '-';
  };

  const getParentNames = (parentIds?: string[]) => {
    if (!parentIds || parentIds.length === 0) return { father: '-', mother: '-' };
    const father = parentIds.map(id => allPersons.find(p => p.id === id)).find(p => p?.gender === 'male');
    const mother = parentIds.map(id => allPersons.find(p => p.id === id)).find(p => p?.gender === 'female');
    return {
      father: father ? father.name : '-',
      mother: mother ? mother.name : '-',
    };
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100 border-b">
            <th className="px-2 py-2 text-left font-semibold">名前</th>
            <th className="px-2 py-2 text-left font-semibold">性別</th>
            <th className="px-2 py-2 text-left font-semibold">生年</th>
            <th className="px-2 py-2 text-left font-semibold">父</th>
            <th className="px-2 py-2 text-left font-semibold">母</th>
            <th className="px-2 py-2 text-left font-semibold">同居</th>
            <th className="px-2 py-2 text-left font-semibold hidden lg:table-cell">住所</th>
            <th className="px-2 py-2 text-left font-semibold hidden lg:table-cell">電話</th>
            <th className="px-2 py-2 text-center font-semibold">操作</th>
          </tr>
        </thead>
        <tbody>
          {persons.map((person) => {
            const parents = getParentNames(person.parentIds);
            return (
              <tr key={person.id} className="border-b hover:bg-gray-50">
                <td className="px-2 py-1.5 font-medium">{getDisplayName(person)}</td>
                <td className="px-2 py-1.5">
                  {person.gender === 'male' ? '男' : person.gender === 'female' ? '女' : '他'}
                </td>
                <td className="px-2 py-1.5">{person.birthDate || '-'}</td>
                <td className="px-2 py-1.5">{parents.father}</td>
                <td className="px-2 py-1.5">{parents.mother}</td>
                <td className="px-2 py-1.5">
                  {person.livingTogether && person.livingGroup ? person.livingGroup : '-'}
                </td>
                <td className="px-2 py-1.5 hidden lg:table-cell max-w-[120px] truncate">
                  {person.address || '-'}
                </td>
                <td className="px-2 py-1.5 hidden lg:table-cell">
                  {person.phone || '-'}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => onEdit(person)}
                    className="text-blue-600 hover:text-blue-800"
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

  // Undo/Redo: PersonData[]ベースのスナップショット
  const [personHistory, setPersonHistory] = useState<PersonData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const skipHistoryRef = useRef(false);

  // PersonData[]をソースとして管理
  const personsRef = useRef<PersonData[]>([]);

  /** PersonData[]からノード＆エッジを再構築 */
  const rebuildFlow = useCallback((persons: PersonData[], displaySettings: DisplaySettings) => {
    personsRef.current = persons;
    const positions = calculateLayout(persons);
    const relEdges = generateEdgesFromPersons(persons);
    const { edges: flowEdges, junctionNodes } = buildFlowElements(relEdges, positions);

    const personNodes: Node[] = persons.map((person) => ({
      id: person.id,
      type: 'person',
      position: positions.get(person.id) || { x: 0, y: 0 },
      data: {
        ...person,
        label: person.name,
        settings: displaySettings,
      },
    }));

    setNodes([...personNodes, ...junctionNodes]);
    setEdges(flowEdges);
  }, [setNodes, setEdges]);

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

  const extractPersons = (nds: Node[]): PersonData[] => {
    return nds
      .filter(n => n.type === 'person')
      .map((node) => {
        const { settings: _, label: __, ...personData } = node.data;
        return personData as PersonData;
      });
  };

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
      name: '新しい人物',
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
    const { settings: _, label: __, ...personData } = node.data;
    setSelectedPerson(personData as PersonData);
    setIsDialogOpen(true);
  }, []);

  const handleSavePerson = useCallback(
    (updatedPerson: PersonData) => {
      const allPersons = personsRef.current.map((p) =>
        p.id === updatedPerson.id ? updatedPerson : p
      );
      updatePersons(allPersons);
    },
    [updatePersons]
  );

  const handleDeletePerson = useCallback(
    (personId: string) => {
      // 参照を削除
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
      toPng(flowRef.current, { backgroundColor: '#fcf9f2', cacheBust: true })
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
    if (confirm('家系図をリセットしてもよろしいですか？\n\n自動保存データも削除されます。')) {
      localStorage.removeItem('familyTreeAutoSave');
      loadData(sampleData);
      setPersonHistory([]);
      setHistoryIndex(-1);
    }
  }, []);

  const allPersons = personsRef.current;

  return (
    <div className="h-screen w-full font-sans bg-gray-50 flex">
      {/* 左: サイドバー（フォーム/設定） */}
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

      {/* 右: メイン領域（家系図 + 一覧テーブル） */}
      <main className="flex-1 h-full flex flex-col overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* 家系図（折りたたみ可） */}
        <div className="border-b border-gray-200">
          <button
            onClick={() => setShowFamilyTree(!showFamilyTree)}
            className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700"
          >
            <span>家系図</span>
            {showFamilyTree ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {showFamilyTree && (
          <div className="relative" style={{ backgroundColor: '#fcf9f2', height: '50%', minHeight: 200 }}>
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
                <Background color="#ccc" gap={20} />
              </ReactFlow>
            </div>

            <div className="absolute bottom-2 right-2 text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow">
              自動保存中...
            </div>
          </div>
        )}

        {/* メンバー一覧テーブル */}
        <div className="flex-1 overflow-auto p-4 bg-white">
          <h3 className="text-sm font-semibold mb-2 text-gray-700">メンバー一覧</h3>
          <MemberTable
            persons={allPersons}
            allPersons={allPersons}
            onEdit={handleEditFromTable}
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
