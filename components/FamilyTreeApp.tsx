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
} from '@/types/familyTree';

const nodeTypes: NodeTypes = {
  person: PersonNode,
};

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

/**
 * parentIds / spouseId からエッジを自動生成する
 */
const generateEdgesFromPersons = (persons: PersonData[]): RelationshipEdge[] => {
  const edges: RelationshipEdge[] = [];
  const spouseEdgeSet = new Set<string>();

  for (const person of persons) {
    // 親子エッジ
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

    // 配偶者エッジ（重複防止）
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
 * グラフ走査ベースのレイアウト計算
 * parentIds/spouseIdの関係性を辿り世代を自動算出する
 */
const calculateLayout = (persons: PersonData[]): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  if (persons.length === 0) return positions;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const SPOUSE_GAP = isMobile ? 100 : 140;
  const SIBLING_GAP = isMobile ? 130 : 180;
  const GENERATION_GAP = isMobile ? 160 : 200;

  const personMap = new Map<string, PersonData>();
  for (const p of persons) personMap.set(p.id, p);

  // --- 世代をグラフ走査で算出 ---
  const generationOf = new Map<string, number>();

  // 基準人物を決定: isRepresentative or relationship==='self' or 最初の人物
  const root = persons.find(p => p.isRepresentative) ?? persons.find(p => p.relationship === 'self') ?? persons[0];
  generationOf.set(root.id, 0);

  // BFSで親→子・配偶者を辿る
  const queue: string[] = [root.id];
  const visited = new Set<string>([root.id]);

  // 子IDマップ: parentId → childId[]
  const childrenOf = new Map<string, string[]>();
  for (const p of persons) {
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

    // 親を上の世代に
    if (current.parentIds) {
      for (const pid of current.parentIds) {
        if (!visited.has(pid) && personMap.has(pid)) {
          generationOf.set(pid, currentGen - 1);
          visited.add(pid);
          queue.push(pid);
        }
      }
    }

    // 子を下の世代に
    const children = childrenOf.get(currentId) ?? [];
    for (const cid of children) {
      if (!visited.has(cid) && personMap.has(cid)) {
        generationOf.set(cid, currentGen + 1);
        visited.add(cid);
        queue.push(cid);
      }
    }

    // 配偶者を同世代に
    if (current.spouseId && !visited.has(current.spouseId) && personMap.has(current.spouseId)) {
      generationOf.set(current.spouseId, currentGen);
      visited.add(current.spouseId);
      queue.push(current.spouseId);
    }
  }

  // BFSで到達できなかった人物にフォールバック世代を割り当て
  for (const p of persons) {
    if (!generationOf.has(p.id)) {
      generationOf.set(p.id, 0);
    }
  }

  // --- 世代ごとにグループ化 ---
  const generations = new Map<number, PersonData[]>();
  for (const p of persons) {
    const gen = generationOf.get(p.id)!;
    if (!generations.has(gen)) generations.set(gen, []);
    generations.get(gen)!.push(p);
  }

  // 世代番号を正規化 (最小世代を0にする)
  const minGen = Math.min(...generations.keys());

  // 配偶者ペアを特定
  const spousePairs = new Map<string, string>();
  for (const person of persons) {
    if (person.spouseId) {
      spousePairs.set(person.id, person.spouseId);
    }
  }

  // --- 各世代を配置 ---
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
 */
const toFlowEdges = (relEdges: RelationshipEdge[]): Edge[] => {
  return relEdges.map((edge) => {
    if (edge.type === 'spouse') {
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'straight',
        sourceHandle: 'right-source',
        targetHandle: 'left-target',
        style: {
          stroke: '#e11d48',
          strokeWidth: 4,
        },
        label: edge.label,
      };
    }
    // parent-child: bottom → top を明示
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      sourceHandle: undefined, // default bottom
      targetHandle: undefined, // default top
      style: {
        stroke: '#6b7280',
        strokeWidth: 2,
      },
      pathOptions: { offset: 15 },
      label: edge.label,
    };
  });
};

export const FamilyTreeApp: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [settings, setSettings] = useState<DisplaySettings>(defaultSettings);
  const [selectedPerson, setSelectedPerson] = useState<PersonData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const flowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Undo/Redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  useEffect(() => {
    const autoSaved = localStorage.getItem('familyTreeAutoSave');
    if (autoSaved) {
      try {
        const data: FamilyTreeData = JSON.parse(autoSaved);
        if (confirm('自動保存されたデータが見つかりました。復元しますか？')) {
          loadData(data);
          return;
        }
      } catch (e) {
        console.error('自動保存データの読み込みに失敗しました', e);
      }
    }
    loadData(sampleData);
  }, []);

  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      const data = getCurrentData();
      localStorage.setItem('familyTreeAutoSave', JSON.stringify(data));
    }, 5000);
    return () => clearInterval(autoSaveInterval);
  }, [nodes, edges, settings]);

  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }
    if (nodes.length === 0) return;

    const newHistoryState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newHistoryState);

    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }
    setHistory(newHistory);
  }, [nodes, edges]);

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
  }, [historyIndex, history]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  /** ノードからPersonData[]を抽出 */
  const extractPersons = (nds: Node[]): PersonData[] => {
    return nds.map((node) => {
      const { settings: _, label: __, ...personData } = node.data;
      return personData as PersonData;
    });
  };

  const getCurrentData = (): FamilyTreeData => {
    const persons = extractPersons(nodes);
    return {
      version: '1.0.0',
      settings,
      nodes: persons,
      edges: generateEdgesFromPersons(persons),
    };
  };

  /** データからノードとエッジを構築してセット */
  const buildAndSetNodesEdges = (persons: PersonData[], displaySettings: DisplaySettings) => {
    const positions = calculateLayout(persons);
    const relEdges = generateEdgesFromPersons(persons);

    const newNodes: Node[] = persons.map((person) => ({
      id: person.id,
      type: 'person',
      position: positions.get(person.id) || { x: 0, y: 0 },
      data: {
        ...person,
        label: person.name,
        settings: displaySettings,
      },
    }));

    const newEdges = toFlowEdges(relEdges);

    setNodes(newNodes);
    setEdges(newEdges);
  };

  const loadData = (data: FamilyTreeData) => {
    setSettings(data.settings);
    buildAndSetNodesEdges(data.nodes, data.settings);
  };

  // 設定変更時にノードを更新
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { ...node.data, settings },
      }))
    );
  }, [settings, setNodes]);

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

    // 全体再計算
    const allPersons = [...extractPersons(nodes), newPerson];
    buildAndSetNodesEdges(allPersons, settings);

    setSelectedPerson(newPerson);
    setIsDialogOpen(true);
  }, [nodes, settings]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    const { settings: _, label: __, ...personData } = node.data;
    setSelectedPerson(personData as PersonData);
    setIsDialogOpen(true);
  }, []);

  const handleSavePerson = useCallback(
    (updatedPerson: PersonData) => {
      const allPersons = extractPersons(nodes).map((p) =>
        p.id === updatedPerson.id ? updatedPerson : p
      );
      buildAndSetNodesEdges(allPersons, settings);
    },
    [nodes, settings]
  );

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setNodes((nds) => nds.map((node) => ({ ...node, hidden: false })));
      return;
    }

    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        hidden: !node.data.name.toLowerCase().includes(query.toLowerCase()),
      }))
    );

    const matchingNode = nodes.find(n =>
      n.data.name.toLowerCase().includes(query.toLowerCase())
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
  }, [nodes, edges, settings]);

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
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, []);

  /** 全PersonData一覧（ダイアログに渡す用） */
  const allPersons = extractPersons(nodes);

  return (
    <div className="h-screen w-full font-sans bg-gray-50 flex">
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
        canRedo={historyIndex < history.length - 1}
      />

      <main className="flex-1 h-full relative" style={{ backgroundColor: '#fcf9f2' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

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

        <div className="absolute bottom-4 right-4 text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow">
          自動保存中...
        </div>
      </main>

      <PersonEditDialog
        person={selectedPerson}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSavePerson}
        allPersons={allPersons}
      />
    </div>
  );
};
