'use client';

import React, { useState, useCallback, useRef, useEffect, type CSSProperties } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';

import { PersonNode } from './PersonNode';
import { Sidebar } from './Sidebar';
import { PersonEditDialog } from './PersonEditDialog';
import { GroupManagementDialog } from './GroupManagementDialog';
import {
  PersonData,
  DisplaySettings,
  FamilyTreeData,
  Group,
  sampleData,
  defaultSettings,
} from '@/types/familyTree';

const nodeTypes: NodeTypes = {
  person: PersonNode,
};

// 履歴管理用の型
interface HistoryState {
  nodes: Node[];
  edges: Edge[];
  groups: Group[];
}

export const FamilyTreeApp: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [settings, setSettings] = useState<DisplaySettings>(defaultSettings);
  const [selectedPerson, setSelectedPerson] = useState<PersonData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  
  const flowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Undo/Redo用の履歴管理
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoAction = useRef(false);

  // 初期データの読み込み
  useEffect(() => {
    // 自動保存されたデータがあれば読み込む
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

  // 自動保存（5秒ごと）
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      const data = getCurrentData();
      localStorage.setItem('familyTreeAutoSave', JSON.stringify(data));
    }, 5000);

    return () => clearInterval(autoSaveInterval);
  }, [nodes, edges, groups, settings]);

  // 履歴保存（変更があったとき）
  useEffect(() => {
    if (isUndoRedoAction.current) {
      isUndoRedoAction.current = false;
      return;
    }

    if (nodes.length === 0) return;

    const newHistoryState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      groups: JSON.parse(JSON.stringify(groups)),
    };

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newHistoryState);
    
    if (newHistory.length > 50) {
      newHistory.shift();
    } else {
      setHistoryIndex(historyIndex + 1);
    }
    
    setHistory(newHistory);
  }, [nodes, edges, groups]);

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
  }, [historyIndex, history]);

  // Undo処理
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      isUndoRedoAction.current = true;
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setGroups(prevState.groups);
      setHistoryIndex(historyIndex - 1);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  // Redo処理
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoAction.current = true;
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setGroups(nextState.groups);
      setHistoryIndex(historyIndex + 1);
    }
  }, [historyIndex, history, setNodes, setEdges]);

  // 現在のデータを取得
  const getCurrentData = (): FamilyTreeData => {
    return {
      version: '1.0.0',
      settings,
      groups,
      nodes: nodes.map((node) => {
        const { settings: _, label: __, groupColors: ___, ...personData } = node.data;
        return personData as PersonData;
      }),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: 'parent-child',
　　　　style: toRelationshipEdgeStyle(edge.style),
        label: edge.label as string | undefined,
      })),
    };
  };

  // 続柄に基づく自動配置を計算
  const calculatePositionByRelationship = (person: PersonData, allPersons: PersonData[]): { x: number; y: number } => {
    const spacing = 280; // 横方向の間隔
    const verticalSpacing = 220; // 縦方向の間隔

    // 続柄ごとの世代レベルと基準位置
    const relationshipLevels: Record<string, { generation: number; order: number }> = {
      'grandfather_paternal': { generation: 0, order: 0 },
      'grandmother_paternal': { generation: 0, order: 1 },
      'grandfather_maternal': { generation: 0, order: 2 },
      'grandmother_maternal': { generation: 0, order: 3 },
      'father': { generation: 1, order: 0 },
      'mother': { generation: 1, order: 1 },
      'self': { generation: 2, order: 0 },
      'spouse': { generation: 2, order: 1 },
      'sibling': { generation: 2, order: 2 },
      'child': { generation: 3, order: 0 },
      'other': { generation: 4, order: 0 },
    };

    const level = relationshipLevels[person.relationship] || { generation: 4, order: 0 };

    // 同じ世代の人数を数える
    const sameGeneration = allPersons.filter(p => {
      const pLevel = relationshipLevels[p.relationship] || { generation: 4, order: 0 };
      return pLevel.generation === level.generation;
    });

    // 同じ世代内での順番
    const indexInGeneration = sameGeneration.findIndex(p => p.id === person.id);
    
    // 世代ごとの人数で中央揃え
    const totalInGeneration = sameGeneration.length;
    const totalWidth = (totalInGeneration - 1) * spacing;
    const startX = -totalWidth / 2;
    
    // X座標を計算（続柄の順序も考慮）
    const x = startX + (indexInGeneration * spacing);
    
    // Y座標を計算
    const y = level.generation * verticalSpacing;

    return { x, y };
  };

  // データを読み込む
  const loadData = (data: FamilyTreeData) => {
    setSettings(data.settings);
    setGroups(data.groups || []);
    
    const newNodes: Node[] = data.nodes.map((person, index) => {
      const groupColors = (person.groupIds || [])
        .map(gid => data.groups?.find(g => g.id === gid)?.color)
        .filter(Boolean) as string[];

      const position = calculatePositionByRelationship(person, data.nodes);

      return {
        id: person.id,
        type: 'person',
        position,
        data: {
          ...person,
          label: person.name,
          settings: data.settings,
          groupColors,
        },
      };
    });

    const newEdges: Edge[] = (data.edges || []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      style: edge.style || {},
      label: edge.label,
    }));

    setNodes(newNodes);
    setEdges(newEdges);
  };

  // 設定変更時にノードを更新
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          settings,
        },
      }))
    );
  }, [settings, setNodes]);

  // グループ変更時にノードの色情報を更新
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const groupColors = (node.data.groupIds || [])
          .map((gid: string) => groups.find(g => g.id === gid)?.color)
          .filter(Boolean) as string[];
        
        return {
          ...node,
          data: {
            ...node.data,
            groupColors,
          },
        };
      })
    );
  }, [groups, setNodes]);

  // 新規人物追加
  const handleAddPerson = useCallback(() => {
    const newPerson: PersonData = {
      id: `p${Date.now()}`,
      name: '新しい人物',
      gender: 'male',
      lifeStatus: 'alive',
      relationship: 'other',
      groupIds: [],
      isRepresentative: false,
    };

    const newNode: Node = {
      id: newPerson.id,
      type: 'person',
      position: { 
        x: Math.random() * 400 - 200, 
        y: Math.random() * 300 + 100 
      },
      data: {
        ...newPerson,
        label: newPerson.name,
        settings,
        groupColors: [],
      },
    };

    setNodes((nds) => [...nds, newNode]);
    
    // 追加後すぐに編集ダイアログを開く
    setSelectedPerson(newPerson);
    setIsDialogOpen(true);
  }, [setNodes, settings]);

  // ノードのクリックで編集ダイアログを開く
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedPerson(node.data as PersonData);
    setIsDialogOpen(true);
  }, []);

  // 人物情報を保存
  const handleSavePerson = useCallback(
    (updatedPerson: PersonData) => {
      setNodes((nds) => {
        // 全ての人物データを取得
        const allPersons = nds.map(n => {
          if (n.id === updatedPerson.id) {
            return updatedPerson;
          }
          return n.data as PersonData;
        });

        // 更新された人物の新しい位置を計算
        const newPosition = calculatePositionByRelationship(updatedPerson, allPersons);

        return nds.map((node) =>
          node.id === updatedPerson.id
            ? {
                ...node,
                position: newPosition, // 続柄に基づいて位置を更新
                data: {
                  ...updatedPerson,
                  label: updatedPerson.name,
                  settings,
                  groupColors: (updatedPerson.groupIds || [])
                    .map(gid => groups.find(g => g.id === gid)?.color)
                    .filter(Boolean) as string[],
                },
              }
            : node
        );
      });
    },
    [setNodes, settings, groups]
  );

  // エッジを接続
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `e${params.source}-${params.target}`,
        type: 'smoothstep',
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  // 検索処理
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim() === '') {
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          hidden: false,
        }))
      );
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

  // JSON形式でエクスポート
  const handleExportJSON = useCallback(() => {
    const data = getCurrentData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `family-tree-${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [nodes, edges, settings, groups]);

  // JSON形式でインポート
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
          } catch (error) {
            alert('ファイルの読み込みに失敗しました');
          }
        };
        reader.readAsText(file);
      }
      event.target.value = '';
    },
    []
  );

  // 画像としてエクスポート
  const handleExportImage = useCallback(() => {
    if (flowRef.current) {
      toPng(flowRef.current, {
        backgroundColor: '#fcf9f2',
        cacheBust: true,
      })
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

  // リセット
  const handleReset = useCallback(() => {
    if (confirm('家系図をリセットしてもよろしいですか？\n\n自動保存データも削除されます。')) {
      localStorage.removeItem('familyTreeAutoSave');
      loadData(sampleData);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, []);

  // グループ管理ダイアログを開く
  const handleOpenGroupManagement = useCallback(() => {
    setIsGroupDialogOpen(true);
  }, []);

  // グループを保存
  const handleSaveGroups = useCallback((newGroups: Group[]) => {
    setGroups(newGroups);
  }, []);

  return (
    <div className="h-screen w-full font-sans bg-gray-50 flex">
      <Sidebar
        settings={settings}
        onSettingsChange={setSettings}
        onExportJSON={handleExportJSON}
        onImportJSON={handleImportJSON}
        onExportImage={handleExportImage}
        onReset={handleReset}
        onOpenGroupManagement={handleOpenGroupManagement}
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
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            fitView
          >
            <Controls />
            <Background color="#ccc" gap={20} />
            
            {/* グループの背景表示 */}
            <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: -1 }}>
              {groups.map((group) => {
                const groupNodes = nodes.filter(n => 
                  (n.data.groupIds || []).includes(group.id) && !n.hidden
                );
                
                if (groupNodes.length === 0) return null;

                const padding = 30;
                const minX = Math.min(...groupNodes.map(n => n.position.x)) - padding;
                const minY = Math.min(...groupNodes.map(n => n.position.y)) - padding;
                const maxX = Math.max(...groupNodes.map(n => n.position.x + 200)) + padding;
                const maxY = Math.max(...groupNodes.map(n => n.position.y + 150)) + padding;

                return (
                  <g key={group.id}>
                    <rect
                      x={minX}
                      y={minY}
                      width={maxX - minX}
                      height={maxY - minY}
                      fill={group.color}
                      opacity="0.1"
                      rx="10"
                    />
                    <rect
                      x={minX}
                      y={minY}
                      width={maxX - minX}
                      height={maxY - minY}
                      fill="none"
                      stroke={group.color}
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      opacity="0.5"
                      rx="10"
                    />
                    <text
                      x={minX + 10}
                      y={minY + 20}
                      fill={group.color}
                      fontSize="14"
                      fontWeight="bold"
                    >
                      {group.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </ReactFlow>
        </div>

        {/* 自動保存インジケーター */}
        <div className="absolute bottom-4 right-4 text-xs text-gray-500 bg-white px-3 py-1 rounded-full shadow">
          自動保存中...
        </div>
      </main>

      <PersonEditDialog
        person={selectedPerson}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSavePerson}
        groups={groups}
      />

      <GroupManagementDialog
        groups={groups}
        isOpen={isGroupDialogOpen}
        onClose={() => setIsGroupDialogOpen(false)}
        onSave={handleSaveGroups}
      />
    </div>
  );
};
const toRelationshipEdgeStyle = (style?: CSSProperties) => {
  if (!style) return undefined;

  const stroke = typeof style.stroke === "string" ? style.stroke : undefined;

  const sw = style.strokeWidth;
  const strokeWidth =
    typeof sw === "number"
      ? sw
      : typeof sw === "string"
        ? Number(sw)
        : undefined;

  const strokeDasharray =
    typeof style.strokeDasharray === "string" ? style.strokeDasharray : undefined;

  return {
    stroke,
    strokeWidth: Number.isFinite(strokeWidth as number) ? (strokeWidth as number) : undefined,
    strokeDasharray,
  };
};

