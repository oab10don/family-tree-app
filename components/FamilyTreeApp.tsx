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

import { PersonNode } from './PersonNode';
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
 * 兄弟は誕生日昇順でソートされる
 */
const calculateLayout = (persons: PersonData[]): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  if (persons.length === 0) return positions;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const SPOUSE_GAP = isMobile ? 100 : 140;
  const SIBLING_GAP = isMobile ? 130 : 180;
  const GENERATION_GAP = isMobile ? 160 : 200;

  // 兄弟ソート適用
  const sorted = sortSiblings(persons);

  const personMap = new Map<string, PersonData>();
  for (const p of sorted) personMap.set(p.id, p);

  // BFS世代算出
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
    if (!generationOf.has(p.id)) {
      generationOf.set(p.id, 0);
    }
  }

  // 世代グループ化（ソート済みの順序を保持）
  const generations = new Map<number, PersonData[]>();
  for (const p of sorted) {
    const gen = generationOf.get(p.id)!;
    if (!generations.has(gen)) generations.set(gen, []);
    generations.get(gen)!.push(p);
  }

  const minGen = Math.min(...generations.keys());

  const spousePairs = new Map<string, string>();
  for (const person of sorted) {
    if (person.spouseId) {
      spousePairs.set(person.id, person.spouseId);
    }
  }

  for (const [gen, genPersons] of generations) {
    const y = (gen - minGen) * GENERATION_GAP;

    const placed = new Set<string>();
    const units: { ids: string[]; width: number }[] = [];

    for (const person of genPersons) {
      if (placed.has(person.id)) continue;

      const spouseId = spousePairs.get(person.id);
      if (spouseId && genPersons.some(p => p.id === spouseId) && !placed.has(spouseId)) {
        units.push({ ids: [person.id, spouseId], width: SPOUSE_GAP });
        placed.add(person.id);
        placed.add(spouseId);
      } else {
        units.push({ ids: [person.id], width: 0 });
        placed.add(person.id);
      }
    }

    const totalWidth = units.reduce((sum, u, i) => {
      return sum + u.width + (i > 0 ? SIBLING_GAP : 0);
    }, 0);
    let currentX = -totalWidth / 2;

    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      if (i > 0) currentX += SIBLING_GAP;

      if (unit.ids.length === 2) {
        positions.set(unit.ids[0], { x: currentX, y });
        positions.set(unit.ids[1], { x: currentX + SPOUSE_GAP, y });
        currentX += SPOUSE_GAP;
      } else {
        positions.set(unit.ids[0], { x: currentX, y });
      }
    }
  }

  return positions;
};

/**
 * RelationshipEdge[] → ReactFlow Edge[] に変換
 * 親2人→子の場合、両親ペアの中点から子へ接続するよう中間ノードを追加
 */
const toFlowElements = (
  relEdges: RelationshipEdge[],
  positions: Map<string, { x: number; y: number }>
): { edges: Edge[]; midpointNodes: Node[] } => {
  const edges: Edge[] = [];
  const midpointNodes: Node[] = [];

  // 子ごとに親をグループ化
  const childParentMap = new Map<string, string[]>();
  const spouseEdges: RelationshipEdge[] = [];

  for (const edge of relEdges) {
    if (edge.type === 'spouse') {
      spouseEdges.push(edge);
    } else {
      if (!childParentMap.has(edge.target)) childParentMap.set(edge.target, []);
      childParentMap.get(edge.target)!.push(edge.source);
    }
  }

  // 配偶者エッジ
  for (const edge of spouseEdges) {
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
  }

  // 親子エッジ: 親が2人の場合は中点ノードを作成
  const processedChildren = new Set<string>();
  for (const [childId, parentIds] of childParentMap) {
    if (processedChildren.has(childId)) continue;
    processedChildren.add(childId);

    if (parentIds.length === 2) {
      const pos1 = positions.get(parentIds[0]);
      const pos2 = positions.get(parentIds[1]);
      const childPos = positions.get(childId);

      if (pos1 && pos2 && childPos) {
        const midX = (pos1.x + pos2.x) / 2 + 60; // ノード幅の半分を考慮
        const midY = pos1.y + 50; // 親ノードの下部付近
        const midNodeId = `mid-${parentIds.sort().join('-')}-${childId}`;

        midpointNodes.push({
          id: midNodeId,
          type: 'default',
          position: { x: midX, y: midY },
          data: {},
          style: { width: 1, height: 1, opacity: 0, pointerEvents: 'none' },
          selectable: false,
          draggable: false,
        });

        // 各親 → 中点
        for (const pid of parentIds) {
          edges.push({
            id: `e-${pid}-${midNodeId}`,
            source: pid,
            target: midNodeId,
            type: 'straight',
            style: { stroke: '#6b7280', strokeWidth: 2 },
          });
        }

        // 中点 → 子
        edges.push({
          id: `e-${midNodeId}-${childId}`,
          source: midNodeId,
          target: childId,
          type: 'smoothstep',
          style: { stroke: '#6b7280', strokeWidth: 2 },
        });
      }
    } else {
      // 親が1人
      for (const pid of parentIds) {
        edges.push({
          id: `e${pid}-${childId}`,
          source: pid,
          target: childId,
          type: 'smoothstep',
          style: { stroke: '#6b7280', strokeWidth: 2 },
        });
      }
    }
  }

  return { edges, midpointNodes };
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
    const { edges: flowEdges, midpointNodes } = toFlowElements(relEdges, positions);

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

    setNodes([...personNodes, ...midpointNodes]);
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
