'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  NodeTypes,
  EdgeTypes,
  EdgeProps,
  ReactFlowInstance,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';
import dagre from 'dagre';
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Settings,
  Save,
  Undo2,
  Redo2,
  Search,
  FileJson,
  Upload,
  Download,
  Trash2,
  Menu,
  X,
  Maximize,
  FileText,
} from 'lucide-react';

import { PersonNode, JunctionNode, AddRelationType } from './PersonNode';
import { PersonEditDialog } from './PersonEditDialog';
import { ConfirmDialog } from './ConfirmDialog';
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
import { formatDateShort, toWarekiShort } from '@/lib/wareki';
import { exportToPdf } from '@/lib/pdfExport';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

const nodeTypes: NodeTypes = {
  person: PersonNode,
  junction: JunctionNode,
};

/** 家系図専用カスタム親子エッジ（垂直+水平のみ、斜線なし） */
const FamilyEdge: React.FC<EdgeProps> = ({ id, sourceX, sourceY, targetX, targetY, style }) => {
  // 常にL字型: 垂直に下降 → 水平移動 → 垂直に下降（斜線は絶対に描画しない）
  const midY = sourceY + (targetY - sourceY) * 0.5;
  const pathD = `M ${sourceX} ${sourceY} L ${sourceX} ${midY} L ${targetX} ${midY} L ${targetX} ${targetY}`;
  return (
    <path
      id={id}
      d={pathD}
      fill="none"
      stroke={(style?.stroke as string) || '#475569'}
      strokeWidth={(style?.strokeWidth as number) || 2}
      strokeLinejoin="round"
      className="react-flow__edge-path"
      style={{ pointerEvents: 'stroke' }}
    />
  );
};

/** 配偶者カスタムエッジ（水平の二重線） */
const SpouseEdge: React.FC<EdgeProps> = ({ id, sourceX, sourceY, targetX, targetY }) => {
  const midY = (sourceY + targetY) / 2;
  const gap = 2;
  return (
    <>
      <path
        id={id}
        d={`M ${sourceX} ${midY} L ${targetX} ${midY}`}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        className="react-flow__edge-path"
        style={{ pointerEvents: 'stroke' }}
      />
      <path d={`M ${sourceX} ${midY - gap} L ${targetX} ${midY - gap}`} fill="none" stroke="#2563EB" strokeWidth={2} />
      <path d={`M ${sourceX} ${midY + gap} L ${targetX} ${midY + gap}`} fill="none" stroke="#2563EB" strokeWidth={2} />
    </>
  );
};

const edgeTypes: EdgeTypes = { familyEdge: FamilyEdge, spouseEdge: SpouseEdge };

/** 同居グループの背景色（薄め: 枠線で十分に識別できるため） */
const LIVING_GROUP_BG_COLORS: Record<number, string> = {
  1: 'rgba(34,197,94,0.03)', 2: 'rgba(249,115,22,0.03)', 3: 'rgba(168,85,247,0.03)',
  4: 'rgba(20,184,166,0.03)', 5: 'rgba(244,63,94,0.03)', 6: 'rgba(6,182,212,0.03)',
  7: 'rgba(245,158,11,0.03)', 8: 'rgba(99,102,241,0.03)', 9: 'rgba(132,204,22,0.03)',
  10: 'rgba(217,70,239,0.03)',
};
const LIVING_GROUP_BORDER_COLORS: Record<number, string> = {
  1: 'rgba(34,197,94,0.4)', 2: 'rgba(249,115,22,0.4)', 3: 'rgba(168,85,247,0.4)',
  4: 'rgba(20,184,166,0.4)', 5: 'rgba(244,63,94,0.4)', 6: 'rgba(6,182,212,0.4)',
  7: 'rgba(245,158,11,0.4)', 8: 'rgba(99,102,241,0.4)', 9: 'rgba(132,204,22,0.4)',
  10: 'rgba(217,70,239,0.4)',
};

const NODE_WIDTH = 160;
const NODE_HEIGHT = 100;

// --- ユーティリティ関数群 ---

const generateEdgesFromPersons = (persons: PersonData[]): RelationshipEdge[] => {
  const edges: RelationshipEdge[] = [];
  const spouseEdgeSet = new Set<string>();
  for (const person of persons) {
    if (person.parentIds) {
      for (const parentId of person.parentIds) {
        edges.push({ id: `e${parentId}-${person.id}`, source: parentId, target: person.id, type: 'parent-child' });
      }
    }
    if (person.spouseId) {
      const key = [person.id, person.spouseId].sort().join('-');
      if (!spouseEdgeSet.has(key)) {
        spouseEdgeSet.add(key);
        edges.push({ id: `spouse-${key}`, source: person.id, target: person.spouseId, type: 'spouse' });
      }
    }
  }
  return edges;
};

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
    } else { noParent.push(p); }
  }
  for (const [, siblings] of parentGroupMap) {
    siblings.sort((a, b) => {
      const aO = childSortOrder[a.relationship] ?? 99;
      const bO = childSortOrder[b.relationship] ?? 99;
      return aO !== bO ? aO - bO : a.id.localeCompare(b.id);
    });
  }
  const orderMap = new Map<string, number>();
  let idx = 0;
  for (const p of noParent) orderMap.set(p.id, idx++);
  for (const [, siblings] of parentGroupMap) for (const p of siblings) orderMap.set(p.id, idx++);
  return [...persons].sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));
};

const calculateLayout = (persons: PersonData[]): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  if (persons.length === 0) return positions;
  const sorted = sortSiblings(persons);
  const personMap = new Map<string, PersonData>();
  for (const p of sorted) personMap.set(p.id, p);

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
        if (!visited.has(pid) && personMap.has(pid)) { generationOf.set(pid, currentGen - 1); visited.add(pid); queue.push(pid); }
      }
    }
    for (const cid of (childrenOf.get(currentId) ?? [])) {
      if (!visited.has(cid) && personMap.has(cid)) { generationOf.set(cid, currentGen + 1); visited.add(cid); queue.push(cid); }
    }
    if (current.spouseId && !visited.has(current.spouseId) && personMap.has(current.spouseId)) {
      generationOf.set(current.spouseId, currentGen); visited.add(current.spouseId); queue.push(current.spouseId);
    }
  }
  for (const p of sorted) { if (!generationOf.has(p.id)) generationOf.set(p.id, 0); }

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 180, marginx: 50, marginy: 50 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const p of sorted) g.setNode(p.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  for (const p of sorted) {
    if (p.parentIds) {
      for (const pid of p.parentIds) { if (personMap.has(pid)) g.setEdge(pid, p.id); }
    }
  }
  dagre.layout(g);
  for (const p of sorted) {
    const n = g.node(p.id);
    if (n) positions.set(p.id, { x: n.x - NODE_WIDTH / 2, y: n.y - NODE_HEIGHT / 2 });
  }

  // --- 世代ごとにY位置を正規化 ---
  // dagre は配偶者関係を知らないため、配偶者を誤ったランクに配置する。
  // BFS で計算した generationOf を使い、同世代のノードを同じ Y に揃える。
  const genYMap = new Map<number, number>();
  for (const p of sorted) {
    const gen = generationOf.get(p.id) ?? 0;
    const pos = positions.get(p.id);
    if (pos) {
      if (!genYMap.has(gen)) {
        genYMap.set(gen, pos.y);
      } else {
        genYMap.set(gen, Math.min(genYMap.get(gen)!, pos.y));
      }
    }
  }
  // 世代間の最小間隔を確保（NODE_HEIGHT + 80px）
  const sortedGens = [...genYMap.entries()].sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sortedGens.length; i++) {
    const prevY = sortedGens[i - 1][1];
    const minY = prevY + NODE_HEIGHT + 80;
    if (sortedGens[i][1] < minY) {
      sortedGens[i][1] = minY;
      genYMap.set(sortedGens[i][0], minY);
    }
  }
  for (const p of sorted) {
    const gen = generationOf.get(p.id) ?? 0;
    const pos = positions.get(p.id);
    const genY = genYMap.get(gen);
    if (pos && genY !== undefined) {
      positions.set(p.id, { x: pos.x, y: genY });
    }
  }

  // --- 配偶者のX位置を中央揃え（男性=左、女性=右） ---
  const adjustedSpouse = new Set<string>();
  for (const p of sorted) {
    if (p.spouseId && personMap.has(p.spouseId) && !adjustedSpouse.has(p.id) && !adjustedSpouse.has(p.spouseId)) {
      const spouse = personMap.get(p.spouseId)!;
      const pos1 = positions.get(p.id); const pos2 = positions.get(p.spouseId);
      if (pos1 && pos2) {
        const centerX = (pos1.x + pos2.x) / 2;
        const y = pos1.y; // 同世代なので同じY
        // 男性=左、女性=右のルールで配置
        const maleId = p.gender === 'male' ? p.id : p.spouseId;
        const femaleId = p.gender === 'male' ? p.spouseId : p.id;
        positions.set(maleId, { x: centerX - 90, y });
        positions.set(femaleId, { x: centerX + 90, y });
        adjustedSpouse.add(p.id); adjustedSpouse.add(p.spouseId);
      }
    }
  }

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
    const CHILD_GAP = 190;
    const totalWidth = (childIds.length - 1) * CHILD_GAP;
    const startX = parentCenter - totalWidth / 2 - NODE_WIDTH / 2;
    for (let i = 0; i < childIds.length; i++) {
      const pos = positions.get(childIds[i]);
      if (pos) positions.set(childIds[i], { x: startX + i * CHILD_GAP, y: pos.y });
    }
  }

  const genGroups = new Map<number, string[]>();
  for (const p of sorted) {
    const gen = generationOf.get(p.id) ?? 0;
    if (!genGroups.has(gen)) genGroups.set(gen, []);
    genGroups.get(gen)!.push(p.id);
  }
  for (const [, ids] of genGroups) {
    ids.sort((a, b) => (positions.get(a)?.x ?? 0) - (positions.get(b)?.x ?? 0));
    for (let i = 1; i < ids.length; i++) {
      const prev = positions.get(ids[i - 1]); const curr = positions.get(ids[i]);
      if (prev && curr) {
        const minX = prev.x + NODE_WIDTH + 40;
        if (curr.x < minX) positions.set(ids[i], { x: minX, y: curr.y });
      }
    }
  }
  return positions;
};

const buildFlowElements = (relEdges: RelationshipEdge[], positions: Map<string, { x: number; y: number }>): { edges: Edge[]; junctionNodes: Node[] } => {
  const edges: Edge[] = [];
  const junctionNodes: Node[] = [];
  const childParents = new Map<string, string[]>();
  for (const e of relEdges) { if (e.type === 'parent-child') { if (!childParents.has(e.target)) childParents.set(e.target, []); childParents.get(e.target)!.push(e.source); } }
  const twoParentChildren = new Set<string>();
  const spouseJunctions = new Map<string, string>();
  for (const [childId, parentIds] of childParents) {
    if (parentIds.length === 2) {
      twoParentChildren.add(childId);
      const pairKey = [...parentIds].sort().join('-');
      if (!spouseJunctions.has(pairKey)) {
        const pos1 = positions.get(parentIds[0]); const pos2 = positions.get(parentIds[1]);
        if (pos1 && pos2) {
          const jId = `junction-${pairKey}`;
          junctionNodes.push({ id: jId, type: 'junction', position: { x: (pos1.x + pos2.x) / 2, y: Math.max(pos1.y, pos2.y) + 50 }, data: { label: '' }, selectable: false, draggable: false });
          spouseJunctions.set(pairKey, jId);
        }
      }
      const jId = spouseJunctions.get(pairKey);
      if (jId) edges.push({ id: `e-${jId}-${childId}`, source: jId, target: childId, type: 'familyEdge', style: { stroke: '#475569', strokeWidth: 2 }, zIndex: 1 });
    }
  }
  for (const edge of relEdges) {
    if (edge.type === 'spouse') {
      // ノードの実際の位置関係に基づいてハンドルを動的に決定（修正A-3+E）
      const posA = positions.get(edge.source);
      const posB = positions.get(edge.target);
      let sourceHandle: string;
      let targetHandle: string;
      if (posA && posB && posA.x < posB.x) {
        sourceHandle = 'right-source';
        targetHandle = 'left-target';
      } else {
        sourceHandle = 'left-source';
        targetHandle = 'right-target';
      }
      edges.push({ id: edge.id, source: edge.source, target: edge.target, type: 'spouseEdge', sourceHandle, targetHandle, zIndex: 1 });
      continue;
    }
    if (twoParentChildren.has(edge.target)) continue;
    edges.push({ id: edge.id, source: edge.source, target: edge.target, type: 'familyEdge', style: { stroke: '#475569', strokeWidth: 2 }, zIndex: 1 });
  }
  return { edges, junctionNodes };
};

const buildLivingGroupNodes = (persons: PersonData[], positions: Map<string, { x: number; y: number }>): Node[] => {
  const groups = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>();
  for (const p of persons) {
    if (!p.livingTogether || !p.livingGroup) continue;
    const pos = positions.get(p.id);
    if (!pos) continue;
    const existing = groups.get(p.livingGroup);
    if (existing) { existing.minX = Math.min(existing.minX, pos.x); existing.minY = Math.min(existing.minY, pos.y); existing.maxX = Math.max(existing.maxX, pos.x + NODE_WIDTH); existing.maxY = Math.max(existing.maxY, pos.y + NODE_HEIGHT); }
    else { groups.set(p.livingGroup, { minX: pos.x, minY: pos.y, maxX: pos.x + NODE_WIDTH, maxY: pos.y + NODE_HEIGHT }); }
  }
  const PADDING = 30;
  const nodes: Node[] = [];
  for (const [gn, b] of groups) {
    nodes.push({ id: `living-group-${gn}`, type: 'group', position: { x: b.minX - PADDING, y: b.minY - PADDING }, data: { label: '' }, style: { width: b.maxX - b.minX + PADDING * 2, height: b.maxY - b.minY + PADDING * 2, backgroundColor: LIVING_GROUP_BG_COLORS[gn] ?? 'rgba(34,197,94,0.08)', border: `2px dashed ${LIVING_GROUP_BORDER_COLORS[gn] ?? 'rgba(34,197,94,0.4)'}`, borderRadius: '8px', zIndex: -1, pointerEvents: 'none' as const }, selectable: false, draggable: false });
  }
  return nodes;
};

const calculateKinshipDegrees = (persons: PersonData[]): Map<string, { degree: number; viaSpouse: boolean }> => {
  const result = new Map<string, { degree: number; viaSpouse: boolean }>();
  if (persons.length === 0) return result;
  const representative = persons.find(p => p.isRepresentative);
  if (!representative) return result;
  const personMap = new Map<string, PersonData>();
  for (const p of persons) personMap.set(p.id, p);
  const adjacency = new Map<string, { targetId: string; weight: number; isSpouseEdge: boolean }[]>();
  const addEdge = (f: string, t: string, w: number, s: boolean) => { if (!adjacency.has(f)) adjacency.set(f, []); adjacency.get(f)!.push({ targetId: t, weight: w, isSpouseEdge: s }); };
  for (const p of persons) {
    if (p.parentIds) { for (const pid of p.parentIds) { if (personMap.has(pid)) { addEdge(p.id, pid, 1, false); addEdge(pid, p.id, 1, false); } } }
    if (p.spouseId && personMap.has(p.spouseId)) { addEdge(p.id, p.spouseId, 0, true); addEdge(p.spouseId, p.id, 0, true); }
  }
  const visited = new Map<string, { degree: number; viaSpouse: boolean }>();
  const deque: { id: string; degree: number; viaSpouse: boolean }[] = [{ id: representative.id, degree: 0, viaSpouse: false }];
  while (deque.length > 0) {
    const current = deque.shift()!;
    if (visited.has(current.id)) continue;
    visited.set(current.id, { degree: current.degree, viaSpouse: current.viaSpouse });
    for (const n of (adjacency.get(current.id) ?? [])) {
      if (visited.has(n.targetId)) continue;
      const nd = current.degree + n.weight; const vs = current.viaSpouse || n.isSpouseEdge;
      if (n.weight === 0) deque.unshift({ id: n.targetId, degree: nd, viaSpouse: vs });
      else deque.push({ id: n.targetId, degree: nd, viaSpouse: vs });
    }
  }
  return visited;
};

// --- ポップオーバーコンポーネント ---

const Popover: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; className?: string }> = ({ isOpen, onClose, children, className }) => {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className={`absolute z-40 bg-white rounded-lg shadow-xl border p-3 ${className}`} style={{ borderColor: '#E2E8F0' }}>
        {children}
      </div>
    </>
  );
};

// --- メインコンポーネント（ReactFlowProvider内部） ---

const FamilyTreeAppInner: React.FC = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [settings, setSettings] = useState<DisplaySettings>(defaultSettings);
  const [selectedPerson, setSelectedPerson] = useState<PersonData | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [showMemberList, setShowMemberList] = useState(false);
  const [showSettingsPopover, setShowSettingsPopover] = useState(false);
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);

  // 削除確認ダイアログ state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'default';
    confirmText?: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const flowRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [personHistory, setPersonHistory] = useState<PersonData[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const personsRef = useRef<PersonData[]>([]);

  const { fitView, setCenter, getZoom } = useReactFlow();

  // --- 検索フォーカス ---
  const searchResults = searchQuery.trim()
    ? personsRef.current.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const focusNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    setCenter(
      node.position.x + (NODE_WIDTH / 2),
      node.position.y + (NODE_HEIGHT / 2),
      { zoom: Math.max(getZoom(), 1), duration: 500 }
    );
    setHighlightedNodeId(nodeId);
    setTimeout(() => setHighlightedNodeId(null), 2000);
    setSearchQuery('');
    setSearchDropdownOpen(false);
  }, [nodes, setCenter, getZoom]);

  /** ノード選択時の「編集」ボタンから呼ばれるコールバック（修正D: スマホ対応） */
  const handleEditPerson = useCallback((personId: string) => {
    const person = personsRef.current.find(p => p.id === personId);
    if (person) {
      setSelectedPerson(person);
      setIsDialogOpen(true);
    }
  }, []);

  const handleAddRelation = useCallback((personId: string, relationType: AddRelationType) => {
    const currentPerson = personsRef.current.find(p => p.id === personId);
    if (!currentPerson) return;
    const newId = `p${Date.now()}`;
    let newPerson: PersonData;
    switch (relationType) {
      case 'father':
        newPerson = { id: newId, name: '', gender: 'male', lifeStatus: 'alive', relationship: 'father', isRepresentative: false };
        const wf = personsRef.current.map(p => {
          if (p.id === personId) { const pids = p.parentIds ? [...p.parentIds.filter(pid => { const pr = personsRef.current.find(pp => pp.id === pid); return pr?.gender !== 'male'; }), newId] : [newId]; return { ...p, parentIds: pids }; }
          return p;
        });
        updatePersonsInternal([...wf, newPerson]); setSelectedPerson(newPerson); setIsDialogOpen(true); return;
      case 'mother':
        newPerson = { id: newId, name: '', gender: 'female', lifeStatus: 'alive', relationship: 'mother', isRepresentative: false };
        const wm = personsRef.current.map(p => {
          if (p.id === personId) { const pids = p.parentIds ? [...p.parentIds.filter(pid => { const pr = personsRef.current.find(pp => pp.id === pid); return pr?.gender !== 'female'; }), newId] : [newId]; return { ...p, parentIds: pids }; }
          return p;
        });
        updatePersonsInternal([...wm, newPerson]); setSelectedPerson(newPerson); setIsDialogOpen(true); return;
      case 'spouse':
        newPerson = { id: newId, name: '', gender: currentPerson.gender === 'male' ? 'female' : 'male', lifeStatus: 'alive', relationship: 'spouse', spouseId: personId, isRepresentative: false };
        const ws = personsRef.current.map(p => p.id === personId ? { ...p, spouseId: newId } : p);
        updatePersonsInternal([...ws, newPerson]); setSelectedPerson(newPerson); setIsDialogOpen(true); return;
      case 'child':
        newPerson = { id: newId, name: '', gender: 'male', lifeStatus: 'alive', relationship: 'other', isRepresentative: false, parentIds: currentPerson.spouseId ? [personId, currentPerson.spouseId] : [personId] };
        updatePersonsInternal([...personsRef.current, newPerson]); setSelectedPerson(newPerson); setIsDialogOpen(true); return;
    }
  }, []);

  const rebuildFlow = useCallback((persons: PersonData[], ds: DisplaySettings, currentHighlight?: string | null) => {
    personsRef.current = persons;
    const positions = calculateLayout(persons);
    const relEdges = generateEdgesFromPersons(persons);
    const { edges: flowEdges, junctionNodes } = buildFlowElements(relEdges, positions);
    const livingGroupNodes = buildLivingGroupNodes(persons, positions);
    const kinshipDegrees = calculateKinshipDegrees(persons);
    const personNodes: Node[] = persons.map((person) => {
      const kinship = kinshipDegrees.get(person.id);
      const isHighlighted = currentHighlight === person.id;
      return {
        id: person.id,
        type: 'person',
        position: positions.get(person.id) || { x: 0, y: 0 },
        data: { ...person, label: person.name, settings: ds, kinshipDegree: kinship?.degree, kinshipViaSpouse: kinship?.viaSpouse, onAddRelation: handleAddRelation, onEdit: handleEditPerson },
        selected: isHighlighted,
      };
    });
    setNodes([...livingGroupNodes, ...personNodes, ...junctionNodes]);
    setEdges(flowEdges);
  }, [setNodes, setEdges, handleAddRelation, handleEditPerson]);

  const pushHistory = useCallback((persons: PersonData[]) => {
    setPersonHistory(prev => { const h = prev.slice(0, historyIndex + 1); h.push(JSON.parse(JSON.stringify(persons))); if (h.length > 50) h.shift(); return h; });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const updatePersons = useCallback((persons: PersonData[], skipHistory = false) => {
    if (!skipHistory) pushHistory(persons);
    rebuildFlow(persons, settings);
  }, [rebuildFlow, settings, pushHistory]);

  const updatePersonsRef = useRef(updatePersons);
  updatePersonsRef.current = updatePersons;
  const updatePersonsInternal = useCallback((persons: PersonData[]) => { updatePersonsRef.current(persons); }, []);

  useEffect(() => {
    const autoSaved = localStorage.getItem('familyTreeAutoSave');
    if (autoSaved) {
      try {
        const data: FamilyTreeData = JSON.parse(autoSaved);
        if (confirm('自動保存されたデータが見つかりました。復元しますか？')) {
          const mergedSettings = { ...defaultSettings, ...data.settings };
          setSettings(mergedSettings);
          personsRef.current = data.nodes;
          rebuildFlow(data.nodes, mergedSettings);
          pushHistory(data.nodes);
          return;
        }
      } catch (e) { console.error('自動保存データの読み込みに失敗しました', e); }
    }
    setSettings(sampleData.settings);
    personsRef.current = sampleData.nodes;
    rebuildFlow(sampleData.nodes, sampleData.settings);
    pushHistory(sampleData.nodes);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      localStorage.setItem('familyTreeAutoSave', JSON.stringify({ version: '1.0.0', settings, nodes: personsRef.current, edges: generateEdgesFromPersons(personsRef.current) }));
    }, 5000);
    return () => clearInterval(id);
  }, [settings]);

  useEffect(() => { if (personsRef.current.length > 0) rebuildFlow(personsRef.current, settings, highlightedNodeId); }, [settings, rebuildFlow, highlightedNodeId]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) { const ni = historyIndex - 1; const prev = personHistory[ni]; if (prev) { setHistoryIndex(ni); personsRef.current = prev; rebuildFlow(prev, settings); } }
  }, [historyIndex, personHistory, rebuildFlow, settings]);

  const handleRedo = useCallback(() => {
    if (historyIndex < personHistory.length - 1) { const ni = historyIndex + 1; const next = personHistory[ni]; if (next) { setHistoryIndex(ni); personsRef.current = next; rebuildFlow(next, settings); } }
  }, [historyIndex, personHistory, rebuildFlow, settings]);

  // --- キーボードショートカット ---
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // ダイアログが開いている時 or input にフォーカス中は Escape 以外無視
      const isInputFocused = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

      if (e.key === 'Escape') {
        if (isDialogOpen) { setIsDialogOpen(false); return; }
        if (confirmDialog.isOpen) { setConfirmDialog(prev => ({ ...prev, isOpen: false })); return; }
        if (searchDropdownOpen) { setSearchDropdownOpen(false); setSearchQuery(''); return; }
        // 選択解除
        setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        return;
      }

      if (isInputFocused) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); handleExportJSONRef.current();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault(); searchInputRef.current?.focus();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedWithConfirm();
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const handleAddPerson = useCallback(() => {
    const np: PersonData = { id: `p${Date.now()}`, name: '', gender: 'male', lifeStatus: 'alive', relationship: 'other', isRepresentative: false, parentIds: [] };
    updatePersons([...personsRef.current, np]);
    setSelectedPerson(np); setIsDialogOpen(true);
  }, [updatePersons]);

  // 空状態 → 最初の人物追加（続柄デフォルト=本人）
  const handleAddFirstPerson = useCallback(() => {
    const np: PersonData = { id: `p${Date.now()}`, name: '', gender: 'male', lifeStatus: 'alive', relationship: 'self', isRepresentative: true, parentIds: [] };
    updatePersons([...personsRef.current, np]);
    setSelectedPerson(np); setIsDialogOpen(true);
  }, [updatePersons]);

  /** シングルクリック → 選択のみ（ボタン表示）。ダブルクリック → 編集ダイアログ */
  const onNodeClick = useCallback((_e: React.MouseEvent, _node: Node) => {
    // React Flow がデフォルトで selected を切り替えるので、追加処理は不要
  }, []);

  const onNodeDoubleClick = useCallback((_e: React.MouseEvent, node: Node) => {
    if (node.type !== 'person') return;
    const { settings: _, label: __, onAddRelation: ___, onEdit: ____, ...personData } = node.data;
    setSelectedPerson(personData as PersonData); setIsDialogOpen(true);
  }, []);

  const handleSavePerson = useCallback((up: PersonData) => {
    let all = personsRef.current.map(p => p.id === up.id ? up : p);
    if (up.isRepresentative) all = all.map(p => p.id !== up.id ? { ...p, isRepresentative: false } : p);
    if (up.spouseId) all = all.map(p => p.id === up.spouseId ? { ...p, spouseId: up.id } : p);
    const old = personsRef.current.find(p => p.id === up.id);
    if (old?.spouseId && old.spouseId !== up.spouseId) all = all.map(p => p.id === old.spouseId && p.spouseId === up.id ? { ...p, spouseId: undefined } : p);
    if (!up.spouseId && old?.spouseId) all = all.map(p => p.id === old.spouseId && p.spouseId === up.id ? { ...p, spouseId: undefined } : p);
    updatePersons(all);
  }, [updatePersons]);

  const handleDeletePerson = useCallback((id: string) => {
    const person = personsRef.current.find(p => p.id === id);
    if (!person) return;
    setConfirmDialog({
      isOpen: true,
      title: '人物を削除',
      message: `「${person.name || '(名前未設定)'}」を削除しますか？\n関連する親子・配偶者の関係線も削除されます。`,
      confirmLabel: '削除する',
      variant: 'danger',
      onConfirm: () => {
        updatePersons(personsRef.current.filter(p => p.id !== id).map(p => ({ ...p, parentIds: p.parentIds?.filter(pid => pid !== id), spouseId: p.spouseId === id ? undefined : p.spouseId })));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsDialogOpen(false);
      },
    });
  }, [updatePersons]);

  // 選択中ノード削除（ショートカット用）
  const deleteSelectedWithConfirm = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected && n.type === 'person');
    if (selectedNodes.length === 0) return;
    const names = selectedNodes.map(n => n.data.name || '(名前未設定)').join(', ');
    setConfirmDialog({
      isOpen: true,
      title: '選択した人物を削除',
      message: `「${names}」を削除しますか？\n関連する親子・配偶者の関係線も削除されます。`,
      confirmLabel: '削除する',
      variant: 'danger',
      onConfirm: () => {
        const idsToDelete = new Set(selectedNodes.map(n => n.id));
        updatePersons(personsRef.current.filter(p => !idsToDelete.has(p.id)).map(p => ({
          ...p,
          parentIds: p.parentIds?.filter(pid => !idsToDelete.has(pid)),
          spouseId: p.spouseId && idsToDelete.has(p.spouseId) ? undefined : p.spouseId,
        })));
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [nodes, updatePersons]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchDropdownOpen(query.trim().length > 0);
  }, []);

  const handleExportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify({ version: '1.0.0', settings, nodes: personsRef.current, edges: generateEdgesFromPersons(personsRef.current) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `family-tree-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url); setShowSavePopover(false);
  }, [settings]);
  const handleExportJSONRef = useRef(handleExportJSON);
  handleExportJSONRef.current = handleExportJSON;

  const handleImportJSON = useCallback(() => { fileInputRef.current?.click(); setShowSavePopover(false); }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => { try { const data: FamilyTreeData = JSON.parse(e.target?.result as string); const ms = { ...defaultSettings, ...data.settings }; setSettings(ms); personsRef.current = data.nodes; rebuildFlow(data.nodes, ms); pushHistory(data.nodes); } catch { alert('ファイルの読み込みに失敗しました'); } };
      reader.readAsText(file);
    }
    event.target.value = '';
  }, [rebuildFlow, pushHistory]);

  const handleExportImage = useCallback(() => {
    if (flowRef.current) {
      toPng(flowRef.current, { backgroundColor: '#F8FAFC', cacheBust: true })
        .then(url => { const a = document.createElement('a'); a.href = url; a.download = `family-tree-${Date.now()}.png`; a.click(); })
        .catch(err => console.error('画像の生成に失敗しました:', err));
    }
    setShowSavePopover(false);
  }, []);

  // --- PDF出力 ---
  const handleExportPdf = useCallback((paperSize: 'A4' | 'A3') => {
    if (!flowRef.current) return;
    setShowSavePopover(false);
    exportToPdf({
      element: flowRef.current,
      paperSize,
      orientation: 'landscape',
      title: '',
      showDate: true,
    }).catch(err => {
      console.error('PDF出力に失敗しました:', err);
      alert('PDF出力に失敗しました。');
    });
  }, []);

  // --- 全消去（確認ダイアログ版） ---
  const handleReset = useCallback(() => {
    setShowSavePopover(false);
    setConfirmDialog({
      isOpen: true,
      title: '全データを消去',
      message: 'すべてのデータを消去します。この操作は元に戻せません。',
      confirmLabel: '消去する',
      variant: 'danger',
      confirmText: '消去',
      onConfirm: () => {
        localStorage.removeItem('familyTreeAutoSave');
        personsRef.current = [];
        rebuildFlow([], settings);
        setPersonHistory([]);
        setHistoryIndex(-1);
        pushHistory([]);
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      },
    });
  }, [rebuildFlow, settings, pushHistory]);

  // --- Zoom to Fit ---
  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const allPersons = personsRef.current;
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < personHistory.length - 1;
  const isEmpty = allPersons.length === 0;

  return (
    <div className="h-screen w-full flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />

      {/* ヘッダーバー */}
      <header className="h-12 flex items-center px-4 gap-3 shrink-0" style={{ backgroundColor: '#fff', borderBottom: '1px solid #E2E8F0' }}>
        {/* モバイルメニュー */}
        <button className="md:hidden" onClick={() => setShowMobileMenu(!showMobileMenu)} style={{ color: '#475569' }}>
          <Menu className="w-5 h-5" />
        </button>

        {/* アプリ名 */}
        <div className="shrink-0">
          <span className="font-bold text-sm" style={{ color: '#1E293B' }}>家系図ツール</span>
        </div>

        {/* 検索（ドロップダウン付き） */}
        <div className="flex-1 max-w-xs relative hidden md:block">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#94A3B8' }} />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => { if (searchQuery.trim()) setSearchDropdownOpen(true); }}
            onBlur={() => { setTimeout(() => setSearchDropdownOpen(false), 200); }}
            placeholder="名前で検索... (Ctrl+F)"
            className="pl-8 h-8 text-xs"
            style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}
          />
          {/* 検索ドロップダウン */}
          {searchDropdownOpen && searchResults.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 max-h-60 overflow-y-auto"
              style={{ borderColor: '#E2E8F0' }}
            >
              {searchResults.map(person => (
                <button
                  key={person.id}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 flex items-center justify-between border-b last:border-b-0"
                  style={{ borderColor: '#F1F5F9' }}
                  onMouseDown={(e) => { e.preventDefault(); focusNode(person.id); }}
                >
                  <span className="font-medium" style={{ color: '#1E293B' }}>{getDisplayName(person)}</span>
                  <span className="text-[10px]" style={{ color: '#94A3B8' }}>{relationshipLabels[person.relationship]}</span>
                </button>
              ))}
            </div>
          )}
          {searchDropdownOpen && searchQuery.trim() && searchResults.length === 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 px-3 py-2"
              style={{ borderColor: '#E2E8F0' }}
            >
              <span className="text-xs" style={{ color: '#94A3B8' }}>該当なし</span>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* 右側アクション */}
        <div className="flex items-center gap-1">
          <button onClick={handleUndo} disabled={!canUndo} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30" title="元に戻す (Ctrl+Z)" style={{ color: '#475569' }}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={handleRedo} disabled={!canRedo} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30" title="やり直す (Ctrl+Y)" style={{ color: '#475569' }}>
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-5 mx-1" style={{ backgroundColor: '#E2E8F0' }} />

          <div
            className="absolute bottom-2 right-2 text-xs px-3 py-1 rounded-full shadow-sm hidden"
            style={{ backgroundColor: '#fff', color: '#94A3B8', border: '1px solid #E2E8F0' }}
          >
            自動保存中...
          </div>
        </div>
      </header>

      {/* モバイルメニュー展開 */}
      {showMobileMenu && (
        <div className="md:hidden p-3 flex flex-col gap-2" style={{ backgroundColor: '#fff', borderBottom: '1px solid #E2E8F0' }}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#94A3B8' }} />
            <Input value={searchQuery} onChange={(e) => handleSearch(e.target.value)} placeholder="名前で検索..." className="pl-8 h-8 text-xs" style={{ borderColor: '#E2E8F0' }} />
          </div>
          <button onClick={() => { setShowMobileMenu(false); handleAddPerson(); }} className="text-left text-sm px-2 py-1.5 rounded hover:bg-blue-50" style={{ color: '#2563EB' }}>
            <Plus className="w-4 h-4 inline mr-2" />人物を追加
          </button>
        </div>
      )}

      {/* メインエリア */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左ツールバー */}
        <div className="w-12 hidden md:flex flex-col items-center py-2 gap-1 shrink-0" style={{ backgroundColor: '#fff', borderRight: '1px solid #E2E8F0' }}>
          <button onClick={handleAddPerson} className="p-2 rounded-md hover:bg-blue-50 transition-colors" title="人物を追加" style={{ color: '#2563EB' }}>
            <Plus className="w-5 h-5" />
          </button>

          <button onClick={handleFitView} className="p-2 rounded-md hover:bg-gray-100 transition-colors" title="全体表示" style={{ color: '#475569' }}>
            <Maximize className="w-5 h-5" />
          </button>

          {/* 表示設定ポップオーバー */}
          <div className="relative">
            <button onClick={() => setShowSettingsPopover(!showSettingsPopover)} className="p-2 rounded-md hover:bg-gray-100 transition-colors" title="表示設定" style={{ color: '#475569' }}>
              <Settings className="w-5 h-5" />
            </button>
            <Popover isOpen={showSettingsPopover} onClose={() => setShowSettingsPopover(false)} className="left-full ml-2 top-0 w-56">
              <h4 className="font-semibold text-xs mb-3" style={{ color: '#475569' }}>表示設定</h4>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs" style={{ color: '#64748B' }}>性別で色分け</Label>
                  <Switch checked={settings.colorByGender} onCheckedChange={(c) => setSettings({ ...settings, colorByGender: c })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs" style={{ color: '#64748B' }}>名前</Label>
                  <Checkbox checked={settings.showName} onCheckedChange={(c) => setSettings({ ...settings, showName: c as boolean })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs" style={{ color: '#64748B' }}>生年月日</Label>
                  <Checkbox checked={settings.showBirthDate} onCheckedChange={(c) => setSettings({ ...settings, showBirthDate: c as boolean })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs" style={{ color: '#64748B' }}>続柄</Label>
                  <Checkbox checked={settings.showRelationship} onCheckedChange={(c) => setSettings({ ...settings, showRelationship: c as boolean })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs" style={{ color: '#64748B' }}>既往歴</Label>
                  <Checkbox checked={settings.showMedicalHistory} onCheckedChange={(c) => setSettings({ ...settings, showMedicalHistory: c as boolean })} />
                </div>
              </div>
            </Popover>
          </div>

          {/* 保存ポップオーバー */}
          <div className="relative">
            <button onClick={() => setShowSavePopover(!showSavePopover)} className="p-2 rounded-md hover:bg-gray-100 transition-colors" title="保存・出力" style={{ color: '#475569' }}>
              <Save className="w-5 h-5" />
            </button>
            <Popover isOpen={showSavePopover} onClose={() => setShowSavePopover(false)} className="left-full ml-2 top-0 w-52">
              <div className="space-y-1">
                <button onClick={handleExportJSON} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2" style={{ color: '#475569' }}>
                  <FileJson className="w-3.5 h-3.5" />JSONエクスポート
                </button>
                <button onClick={handleImportJSON} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2" style={{ color: '#475569' }}>
                  <Upload className="w-3.5 h-3.5" />JSONインポート
                </button>
                <button onClick={handleExportImage} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2" style={{ color: '#475569' }}>
                  <Download className="w-3.5 h-3.5" />画像ダウンロード (PNG)
                </button>
                <div className="my-1" style={{ borderTop: '1px solid #E2E8F0' }} />
                <button onClick={() => handleExportPdf('A4')} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2" style={{ color: '#475569' }}>
                  <FileText className="w-3.5 h-3.5" />PDF出力 (A4 横)
                </button>
                <button onClick={() => handleExportPdf('A3')} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-gray-50 flex items-center gap-2" style={{ color: '#475569' }}>
                  <FileText className="w-3.5 h-3.5" />PDF出力 (A3 横)
                </button>
                <div className="my-1" style={{ borderTop: '1px solid #E2E8F0' }} />
                <button onClick={handleReset} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-red-50 flex items-center gap-2" style={{ color: '#DC2626' }}>
                  <Trash2 className="w-3.5 h-3.5" />全て消去
                </button>
              </div>
            </Popover>
          </div>
        </div>

        {/* キャンバス */}
        <div className="flex-1 relative" style={{ backgroundColor: '#F8FAFC' }}>
          {/* 空状態ガイド */}
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <div
                className="text-center p-8 rounded-xl shadow-lg pointer-events-auto"
                style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0', maxWidth: 360 }}
              >
                <div className="text-4xl mb-4" style={{ color: '#CBD5E1' }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: '#1E293B' }}>家系図を作成しましょう</h3>
                <p className="text-sm mb-6" style={{ color: '#64748B' }}>
                  左の「+ 人物を追加」ボタン、<br />
                  または下のボタンから<br />
                  最初の人物を追加してください
                </p>
                <button
                  onClick={handleAddFirstPerson}
                  className="px-6 py-2.5 rounded-lg text-white text-sm font-medium transition-colors hover:opacity-90"
                  style={{ backgroundColor: '#2563EB' }}
                >
                  <Plus className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  最初の人物を追加する
                </button>
              </div>
            </div>
          )}

          <div ref={flowRef} className="w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onInit={setReactFlowInstance}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodesDraggable={false}
              fitView
              style={{ backgroundColor: '#F8FAFC' }}
            >
              <Controls />
              <Background color="#E2E8F0" gap={20} />
              <MiniMap
                nodeColor={(node) => {
                  if (node.type !== 'person') return 'transparent';
                  if (node.data?.lifeStatus === 'deceased') return '#9CA3AF';
                  return node.data?.gender === 'male' ? '#3B82F6' : node.data?.gender === 'female' ? '#EC4899' : '#9CA3AF';
                }}
                maskColor="rgba(248, 250, 252, 0.7)"
                style={{
                  bottom: 10,
                  right: 10,
                  width: 150,
                  height: 100,
                  border: '1px solid #E2E8F0',
                  borderRadius: 4,
                }}
              />
            </ReactFlow>
          </div>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: '#fff', color: '#CBD5E1', border: '1px solid #E2E8F0' }}>
            自動保存中
          </div>
        </div>
      </div>

      {/* 下部メンバー一覧（折りたたみ） */}
      <div className="shrink-0" style={{ backgroundColor: '#fff', borderTop: '1px solid #E2E8F0' }}>
        <button
          onClick={() => setShowMemberList(!showMemberList)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium hover:bg-blue-50/30 transition-colors"
          style={{ color: '#475569' }}
        >
          <span>メンバー一覧（{allPersons.length}人）</span>
          {showMemberList ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        {showMemberList && (
          <div className="overflow-auto" style={{ maxHeight: 280 }}>
            <table className="min-w-full text-xs border-collapse">
              <thead>
                <tr style={{ backgroundColor: '#F1F5F9' }} className="border-b">
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: '#475569' }}>名前</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: '#475569' }}>性別</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: '#475569' }}>生年月日</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: '#475569' }}>続柄</th>
                  <th className="px-3 py-2 text-left font-semibold" style={{ color: '#475569' }}>既往歴</th>
                  <th className="px-3 py-2 text-center font-semibold" style={{ color: '#475569' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {allPersons.map((person) => (
                  <tr key={person.id} className="border-b hover:bg-blue-50/30">
                    <td className="px-3 py-1.5 font-medium" style={{ color: '#1E293B' }}>{getDisplayName(person)}</td>
                    <td className="px-3 py-1.5" style={{ color: '#64748B' }}>{person.gender === 'male' ? '男' : person.gender === 'female' ? '女' : '他'}</td>
                    <td className="px-3 py-1.5" style={{ color: '#64748B' }}>
                      {person.birthDate ? (
                        <>
                          {formatDateShort(person.birthDate)}
                          {toWarekiShort(person.birthDate) && <span className="ml-1" style={{ color: '#94A3B8' }}>({toWarekiShort(person.birthDate)})</span>}
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-1.5" style={{ color: '#64748B' }}>{relationshipLabels[person.relationship] ?? '-'}</td>
                    <td className="px-3 py-1.5" style={{ color: '#DC2626' }}>{person.medicalHistory || '-'}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button onClick={() => { setSelectedPerson(person); setIsDialogOpen(true); }} className="hover:text-blue-700" style={{ color: '#2563EB' }} title="編集">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PersonEditDialog
        person={selectedPerson}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSavePerson}
        onDelete={handleDeletePerson}
        allPersons={allPersons}
      />

      {/* 削除確認ダイアログ */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

// --- ReactFlowProvider でラップ ---
export const FamilyTreeApp: React.FC = () => {
  return (
    <ReactFlowProvider>
      <FamilyTreeAppInner />
    </ReactFlowProvider>
  );
};
