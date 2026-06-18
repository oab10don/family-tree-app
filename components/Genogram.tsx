'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Plus, Undo2, Redo2, Maximize, Search, Download, Upload, Heart,
  Trash2, Settings, FileJson, UserPlus, X, Share2, Image, FileText, ClipboardCopy,
} from 'lucide-react';
import {
  Person, Union, Relation, RelationType, relationTypeLabels,
  DisplaySettings, GenogramData, defaultSettings,
  sampleData, DATA_VERSION, newId, sexMark,
} from '@/types/genogram';
import { computeLayout, NODE_W, NODE_H, SYMBOL, MARGIN } from '@/lib/layout';
import {
  buildConnectors, addParent, addSpouse, addChild, addSibling,
  deletePerson, setProband, sanitize,
} from '@/lib/genogramOps';
import { PersonSymbol, AddRelationType } from './PersonSymbol';
import { RelationLine } from './RelationLine';
import { EditDialog } from './EditDialog';
import { ConfirmDialog } from './ConfirmDialog';
import { saveLocal, loadLocal, clearLocal, normalize, exportJson } from '@/lib/storage';
import { downloadFhir, parseFhirBundle } from '@/lib/fhir';
import { buildFamilyHistoryText, copyText, downloadText } from '@/lib/textSummary';
import { exportPng, exportPdf } from '@/lib/exportImage';
import { Input } from './ui/input';

const GROUP_COLORS: Record<number, string> = {
  1: '#22C55E', 2: '#F97316', 3: '#A855F7', 4: '#14B8A6',
  5: '#EF4444', 6: '#06B6D4', 7: '#F59E0B', 8: '#6366F1',
};

interface HistoryState { persons: Person[]; unions: Union[]; relations: Relation[]; }

export const Genogram: React.FC = () => {
  const [persons, setPersons] = useState<Person[]>([]);
  const [unions, setUnions] = useState<Union[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [settings, setSettings] = useState<DisplaySettings>(defaultSettings);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 1 });
  const [search, setSearch] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; message: string; confirmText?: string; onYes: () => void }>({ open: false, title: '', message: '', onYes: () => {} });

  const [history, setHistory] = useState<HistoryState[]>([]);
  const [hIndex, setHIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const fhirInputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const relationsRef = useRef<Relation[]>(relations);
  relationsRef.current = relations;

  // ---- レイアウト計算 ----
  const layout = useMemo(() => computeLayout(persons, unions), [persons, unions]);
  const connectors = useMemo(() => buildConnectors(unions, layout.positions), [unions, layout]);

  const livingGroups = useMemo(() => {
    const map = new Map<number, { minX: number; minY: number; maxX: number; maxY: number }>();
    for (const p of persons) {
      if (!p.livingGroup) continue;
      const pos = layout.positions.get(p.id);
      if (!pos) continue;
      const b = map.get(p.livingGroup);
      const x1 = pos.x - NODE_W / 2, y1 = pos.y - SYMBOL / 2, x2 = pos.x + NODE_W / 2, y2 = pos.y + NODE_H;
      if (b) { b.minX = Math.min(b.minX, x1); b.minY = Math.min(b.minY, y1); b.maxX = Math.max(b.maxX, x2); b.maxY = Math.max(b.maxY, y2); }
      else map.set(p.livingGroup, { minX: x1, minY: y1, maxX: x2, maxY: y2 });
    }
    return [...map.entries()];
  }, [persons, layout]);

  // ---- 初期化 ----
  // 注意: ref ガードは StrictMode の二重マウントで「ガードだけ残り init がスキップ」
  // される事故を起こすため使わない。マウント毎に冪等に適用する。
  useEffect(() => {
    const saved = loadLocal();
    applyData(saved && saved.persons.length > 0 ? saved : sampleData, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyData = (data: GenogramData, pushHist = true) => {
    const s = sanitize(data.persons, data.unions);
    const ids = new Set(s.persons.map((p) => p.id));
    const rels = (data.relations ?? []).filter((r) => ids.has(r.from) && ids.has(r.to));
    setPersons(s.persons);
    setUnions(s.unions);
    setRelations(rels);
    setSettings({ ...defaultSettings, ...data.settings });
    if (pushHist) pushHistory(s.persons, s.unions, rels);
    else { setHistory([{ persons: s.persons, unions: s.unions, relations: rels }]); setHIndex(0); }
    requestAnimationFrame(() => fitView(s.persons, s.unions));
  };

  // ---- 履歴 ----
  const pushHistory = useCallback((p: Person[], u: Union[], r: Relation[]) => {
    setHistory((prev) => {
      const cut = prev.slice(0, hIndex + 1);
      cut.push({ persons: p, unions: u, relations: r });
      if (cut.length > 60) cut.shift();
      return cut;
    });
    setHIndex((i) => Math.min(i + 1, 59));
  }, [hIndex]);

  const commit = useCallback((p: Person[], u: Union[], r: Relation[] = relationsRef.current) => {
    const s = sanitize(p, u);
    const ids = new Set(s.persons.map((x) => x.id));
    const rels = r.filter((rel) => ids.has(rel.from) && ids.has(rel.to));
    setPersons(s.persons);
    setUnions(s.unions);
    setRelations(rels);
    pushHistory(s.persons, s.unions, rels);
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (hIndex <= 0) return;
    const i = hIndex - 1; const st = history[i];
    setHIndex(i); setPersons(st.persons); setUnions(st.unions); setRelations(st.relations);
  }, [hIndex, history]);

  const redo = useCallback(() => {
    if (hIndex >= history.length - 1) return;
    const i = hIndex + 1; const st = history[i];
    setHIndex(i); setPersons(st.persons); setUnions(st.unions); setRelations(st.relations);
  }, [hIndex, history]);

  // ---- 自動保存（init で history が入るまでは保存しない＝空で上書きしない） ----
  useEffect(() => {
    if (history.length === 0) return;
    const data: GenogramData = { version: DATA_VERSION, persons, unions, relations, settings };
    const t = setTimeout(() => saveLocal(data), 600);
    return () => clearTimeout(t);
  }, [persons, unions, relations, settings, history.length]);

  // ---- パン/ズーム ----
  const fitView = useCallback((ps: Person[] = persons, us: Union[] = unions) => {
    const cont = containerRef.current;
    if (!cont) return;
    const lay = computeLayout(ps, us);
    const cw = cont.clientWidth, ch = cont.clientHeight;
    if (lay.width === 0) { setView({ tx: cw / 2, ty: ch / 2, scale: 1 }); return; }
    const scale = Math.min(cw / lay.width, ch / lay.height, 1.4) * 0.92;
    const tx = (cw - lay.width * scale) / 2;
    const ty = (ch - lay.height * scale) / 2;
    setView({ tx, ty, scale });
  }, [persons, unions]);

  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = cont.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      setView((v) => {
        const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const ns = Math.min(Math.max(v.scale * factor, 0.2), 3);
        const wx = (mx - v.tx) / v.scale, wy = (my - v.ty) / v.scale;
        return { scale: ns, tx: mx - wx * ns, ty: my - wy * ns };
      });
    };
    cont.addEventListener('wheel', onWheel, { passive: false });
    return () => cont.removeEventListener('wheel', onWheel);
  }, []);

  const onBgPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onBgPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
    setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
  };
  const onBgPointerUp = (e: React.PointerEvent) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (d && !d.moved) setSelectedId(null); // 背景クリックで選択解除
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const focusPerson = useCallback((id: string) => {
    const pos = layout.positions.get(id);
    const cont = containerRef.current;
    if (!pos || !cont) return;
    setView((v) => ({ ...v, tx: cont.clientWidth / 2 - pos.x * v.scale, ty: cont.clientHeight / 2 - pos.y * v.scale }));
    setSelectedId(id);
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 1800);
  }, [layout]);

  // ---- 関係操作 ----
  const handleAddRelation = useCallback((id: string, type: AddRelationType) => {
    let res;
    if (type === 'father') res = addParent(persons, unions, id, 'male');
    else if (type === 'mother') res = addParent(persons, unions, id, 'female');
    else if (type === 'spouse') {
      const p = persons.find((x) => x.id === id);
      res = addSpouse(persons, unions, id, p?.sex === 'male' ? 'female' : 'male');
    }
    else if (type === 'child') res = addChild(persons, unions, id);
    else res = addSibling(persons, unions, id);

    commit(res.persons, res.unions);
    if (res.newPersonId) { setSelectedId(res.newPersonId); setEditingId(res.newPersonId); }
  }, [persons, unions, commit]);

  const handleSavePerson = useCallback((up: Person) => {
    let next = persons.map((p) => (p.id === up.id ? up : p));
    if (up.isProband) next = setProband(next, up.id);
    commit(next, unions);
    setEditingId(null);
  }, [persons, unions, commit]);

  const handleDeletePerson = useCallback((id: string) => {
    const p = persons.find((x) => x.id === id);
    setConfirm({
      open: true,
      title: '人物を削除',
      message: `「${p?.name || '(名前未設定)'}」を削除します。関連する親子・夫婦の線も整理されます。`,
      onYes: () => {
        const res = deletePerson(persons, unions, id);
        commit(res.persons, res.unions);
        setEditingId(null);
        setSelectedId(null);
        setConfirm((c) => ({ ...c, open: false }));
      },
    });
  }, [persons, unions, commit]);

  const handleAddFirstPerson = useCallback(() => {
    const np: Person = { id: newId(), name: '', sex: 'male', lifeStatus: 'alive', isProband: true, relationship: '本人' };
    commit([np], [], []);
    setSelectedId(np.id); setEditingId(np.id);
  }, [commit]);

  // ---- 感情関係線 ----
  const handleAddRelationLine = useCallback((from: string, to: string, type: RelationType) => {
    if (from === to) return;
    const next = [
      ...relations.filter((r) => !((r.from === from && r.to === to) || (r.from === to && r.to === from))),
      { id: newId('r'), from, to, type },
    ];
    commit(persons, unions, next);
  }, [persons, unions, relations, commit]);

  const handleRemoveRelationLine = useCallback((id: string) => {
    commit(persons, unions, relations.filter((r) => r.id !== id));
  }, [persons, unions, relations, commit]);

  // ---- 入出力 ----
  const handleExportFhir = useCallback(() => {
    const proband = persons.find((p) => p.isProband);
    if (!proband) { alert('FHIR出力には本人（プロバンド）の設定が必要です。人物を編集して「本人」を設定してください。'); return; }
    downloadFhir(persons, proband);
  }, [persons]);

  const handleFhirFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const result = parseFhirBundle(JSON.parse(ev.target?.result as string));
          if (result.errors.length) alert(`FHIR読み込み警告:\n${result.errors.join('\n')}`);
          if (result.persons.length) {
            commit(result.persons, [], []);
            requestAnimationFrame(() => fitView(result.persons, []));
            alert(`${result.persons.length}件を読み込みました。\n※ FHIRには親子・夫婦の関係が含まれないため、関係は手動で設定してください。`);
          } else alert('読み込めるデータがありませんでした。');
        } catch { alert('FHIRファイルの読み込みに失敗しました'); }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  }, [commit, fitView]);

  const handleJsonFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try { applyData(normalize(JSON.parse(ev.target?.result as string))); }
        catch { alert('JSONファイルの読み込みに失敗しました'); }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = useCallback(() => {
    setConfirm({
      open: true, title: '全データを消去', message: 'すべてのデータを消去します。元に戻せません。',
      confirmText: '消去',
      onYes: () => {
        clearLocal();
        setPersons([]); setUnions([]); setRelations([]);
        setHistory([{ persons: [], unions: [], relations: [] }]); setHIndex(0);
        setConfirm((c) => ({ ...c, open: false }));
      },
    });
  }, []);

  const handleLoadSample = useCallback(() => applyData(sampleData), []);

  // ---- 電子カルテ向け出力 ----
  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const handleExportPng = useCallback(() => {
    setShowExport(false);
    if (!worldRef.current) return;
    exportPng(worldRef.current, layout.width, layout.height).catch(() => alert('画像の生成に失敗しました'));
  }, [layout]);

  const handleExportPdf = useCallback(() => {
    setShowExport(false);
    if (!worldRef.current) return;
    exportPdf(worldRef.current, layout.width, layout.height).catch(() => alert('PDFの生成に失敗しました'));
  }, [layout]);

  const handleCopyText = useCallback(async () => {
    setShowExport(false);
    const ok = await copyText(buildFamilyHistoryText(persons));
    flash(ok ? '家族歴をコピーしました' : 'コピーに失敗しました');
  }, [persons, flash]);

  const handleDownloadText = useCallback(() => {
    setShowExport(false);
    downloadText(buildFamilyHistoryText(persons));
  }, [persons]);

  // ---- キーボード ----
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const inField = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;
      if (e.key === 'Escape') { if (editingId) setEditingId(null); else setSelectedId(null); return; }
      if (inField || editingId) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) { e.preventDefault(); handleDeletePerson(selectedId); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [editingId, selectedId, undo, redo, handleDeletePerson]);

  // ---- 派生 ----
  const editingPerson = editingId ? persons.find((p) => p.id === editingId) ?? null : null;
  const searchResults = search.trim() ? persons.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) : [];
  const isEmpty = persons.length === 0;
  const canUndo = hIndex > 0;
  const canRedo = hIndex < history.length - 1;

  const lineColor = '#475569';

  return (
    <div className="h-screen w-full flex flex-col" style={{ background: '#F8FAFC' }}>
      <input ref={jsonInputRef} type="file" accept=".json" onChange={handleJsonFile} className="hidden" />
      <input ref={fhirInputRef} type="file" accept=".json" onChange={handleFhirFile} className="hidden" />

      {/* ヘッダー */}
      <header className="h-12 flex items-center px-3 gap-2 shrink-0 bg-white border-b" style={{ borderColor: '#E2E8F0' }}>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="font-bold text-sm" style={{ color: '#1E293B' }}>縁図</span>
          <span className="text-[10px] font-medium tracking-wide" style={{ color: '#94A3B8' }}>Enzu</span>
        </div>

        <div className="relative hidden sm:block w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#94A3B8' }} />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="名前で検索" className="pl-8 h-8 text-xs" />
          {search.trim() && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-md shadow-lg border z-50 max-h-60 overflow-y-auto" style={{ borderColor: '#E2E8F0' }}>
              {searchResults.map((p) => (
                <button key={p.id} className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 border-b last:border-0" style={{ borderColor: '#F1F5F9' }}
                  onClick={() => { focusPerson(p.id); setSearch(''); }}>
                  {sexMark(p.sex)} {p.name || '（未入力）'} <span className="text-[10px]" style={{ color: '#94A3B8' }}>{p.relationship}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        <ToolBtn onClick={undo} disabled={!canUndo} title="元に戻す (Ctrl+Z)"><Undo2 className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={redo} disabled={!canRedo} title="やり直し (Ctrl+Y)"><Redo2 className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => fitView()} title="全体を表示"><Maximize className="w-4 h-4" /></ToolBtn>
        <div className="w-px h-5 mx-1" style={{ background: '#E2E8F0' }} />
        <ToolBtn onClick={() => setShowSettings((s) => !s)} title="表示設定"><Settings className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => setShowExport((s) => !s)} title="電子カルテ向け出力"><Share2 className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => fhirInputRef.current?.click()} title="FHIR読み込み"><Heart className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={handleExportFhir} title="FHIR出力"><Upload className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => jsonInputRef.current?.click()} title="JSON読み込み"><FileJson className="w-4 h-4" /></ToolBtn>
        <ToolBtn onClick={() => exportJson({ version: DATA_VERSION, persons, unions, relations, settings })} title="JSON保存"><Download className="w-4 h-4" /></ToolBtn>
        <button onClick={handleAddFirstPerson} title="人物を追加" className="ml-1 w-8 h-8 flex items-center justify-center rounded-md text-white" style={{ background: '#2563EB' }}>
          <UserPlus className="w-4 h-4" />
        </button>
      </header>

      {/* 設定パネル */}
      {showSettings && (
        <div className="absolute right-3 top-14 z-40 bg-white rounded-lg shadow-xl border p-3 w-56 text-xs space-y-2" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex justify-between items-center mb-1">
            <span className="font-bold" style={{ color: '#1E293B' }}>表示設定</span>
            <button onClick={() => setShowSettings(false)}><X className="w-4 h-4" style={{ color: '#94A3B8' }} /></button>
          </div>
          {([
            ['showName', '氏名'], ['showRelationship', '続柄'], ['showDates', '生没年'],
            ['showWareki', '和暦'], ['showMedicalHistory', '既往歴'], ['showLivingGroup', '同居グループ枠'],
            ['showRelationLines', '感情関係線'],
          ] as [keyof DisplaySettings, string][]).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={settings[k]} onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.checked }))} className="w-4 h-4" />
              <span style={{ color: '#475569' }}>{label}</span>
            </label>
          ))}
          <div className="border-t pt-2 mt-2 space-y-1" style={{ borderColor: '#E2E8F0' }}>
            <button onClick={handleLoadSample} className="w-full text-left px-2 py-1 rounded hover:bg-slate-50" style={{ color: '#475569' }}>サンプルを読み込む</button>
            <button onClick={handleReset} className="w-full text-left px-2 py-1 rounded hover:bg-red-50 flex items-center gap-1" style={{ color: '#DC2626' }}>
              <Trash2 className="w-3.5 h-3.5" />全データを消去
            </button>
          </div>
        </div>
      )}

      {/* 出力メニュー（電子カルテ向け） */}
      {showExport && (
        <div className="absolute right-3 top-14 z-40 bg-white rounded-lg shadow-xl border p-2 w-60 text-xs" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex justify-between items-center mb-1 px-1">
            <span className="font-bold" style={{ color: '#1E293B' }}>電子カルテ向け出力</span>
            <button onClick={() => setShowExport(false)}><X className="w-4 h-4" style={{ color: '#94A3B8' }} /></button>
          </div>
          <p className="px-1 pb-1 text-[10px]" style={{ color: '#94A3B8' }}>カルテのシェーマ欄・記事に貼り付けられます</p>
          <ExportItem icon={<Image className="w-4 h-4" />} label="画像 (PNG) で保存" onClick={handleExportPng} />
          <ExportItem icon={<FileText className="w-4 h-4" />} label="PDF で保存（A4）" onClick={handleExportPdf} />
          <ExportItem icon={<ClipboardCopy className="w-4 h-4" />} label="家族歴テキストをコピー" onClick={handleCopyText} />
          <ExportItem icon={<Download className="w-4 h-4" />} label="家族歴テキスト (.txt)" onClick={handleDownloadText} />
          <div className="border-t mt-1 pt-1" style={{ borderColor: '#E2E8F0' }}>
            <ExportItem icon={<Heart className="w-4 h-4" />} label="FHIR (.json) で出力" onClick={() => { setShowExport(false); handleExportFhir(); }} />
          </div>
        </div>
      )}

      {/* キャンバス */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden touch-none"
        style={{ cursor: dragRef.current ? 'grabbing' : 'grab', backgroundImage: 'radial-gradient(#E2E8F0 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        onPointerDown={onBgPointerDown}
        onPointerMove={onBgPointerMove}
        onPointerUp={onBgPointerUp}
      >
        {isEmpty ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center pointer-events-none">
            <p className="text-sm" style={{ color: '#94A3B8' }}>まだ人物がいません</p>
            <button onClick={handleAddFirstPerson} className="pointer-events-auto flex items-center gap-1 h-9 px-4 rounded-md text-white text-sm font-bold" style={{ background: '#2563EB' }}>
              <Plus className="w-4 h-4" />最初の人物を追加
            </button>
          </div>
        ) : (
          <div
            ref={worldRef}
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: layout.width, height: layout.height, transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})` }}
          >
            {/* エッジ & 同居グループ */}
            <svg width={layout.width} height={layout.height} className="absolute top-0 left-0 pointer-events-none" style={{ overflow: 'visible' }}>
              {/* 同居グループ枠 */}
              {settings.showLivingGroup && livingGroups.map(([gn, b]) => {
                const pad = 18;
                const color = GROUP_COLORS[gn] ?? '#22C55E';
                return (
                  <g key={`lg-${gn}`}>
                    <rect x={b.minX - pad} y={b.minY - pad} width={b.maxX - b.minX + pad * 2} height={b.maxY - b.minY + pad * 2}
                      rx={10} fill={color} fillOpacity={0.05} stroke={color} strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="6 4" />
                    <text x={b.minX - pad + 6} y={b.minY - pad + 14} fontSize={11} fill={color} fontWeight={700}>同居{gn}</text>
                  </g>
                );
              })}
              {/* 親子線 */}
              {connectors.childLinks.map((s, i) => (
                <line key={`c-${i}`} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={lineColor} strokeWidth={1.8} strokeLinecap="round" />
              ))}
              {/* 結婚線 */}
              {connectors.marriages.map((m, i) => {
                const dashed = m.status === 'partner';
                const midX = (m.x1 + m.x2) / 2;
                return (
                  <g key={`m-${i}`}>
                    <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={lineColor} strokeWidth={2} strokeDasharray={dashed ? '5 4' : undefined} />
                    {(m.status === 'divorced' || m.status === 'separated') && (
                      <line x1={midX - 6} y1={m.y1 - 8} x2={midX + 2} y2={m.y1 + 8} stroke={lineColor} strokeWidth={2} />
                    )}
                    {m.status === 'divorced' && (
                      <line x1={midX - 2} y1={m.y1 - 8} x2={midX + 6} y2={m.y1 + 8} stroke={lineColor} strokeWidth={2} />
                    )}
                  </g>
                );
              })}
              {/* 感情関係線 */}
              {settings.showRelationLines && relations.map((r) => {
                const a = layout.positions.get(r.from);
                const b = layout.positions.get(r.to);
                if (!a || !b) return null;
                return <RelationLine key={r.id} from={a} to={b} type={r.type} />;
              })}
            </svg>

            {/* 人物 */}
            {persons.map((p) => {
              const pos = layout.positions.get(p.id);
              if (!pos) return null;
              return (
                <PersonSymbol
                  key={p.id}
                  person={p}
                  x={pos.x}
                  y={pos.y}
                  settings={settings}
                  selected={selectedId === p.id}
                  highlighted={highlightId === p.id}
                  onSelect={setSelectedId}
                  onEdit={setEditingId}
                  onAddRelation={handleAddRelation}
                />
              );
            })}
          </div>
        )}

        {/* 凡例 */}
        <div className="absolute bottom-3 left-3 bg-white/90 rounded-md border px-3 py-2 text-[10px] leading-relaxed pointer-events-none" style={{ borderColor: '#E2E8F0', color: '#64748B' }}>
          <div className="flex items-center gap-3">
            <span>□ 男性</span><span>○ 女性</span><span>◇ 不明</span><span>✕ 故人</span>
            <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm border-2" style={{ borderColor: '#DC2626' }} /><span style={{ color: '#DC2626' }}>本人</span></span>
          </div>
          {settings.showRelationLines && (
            <div className="flex items-center gap-3 mt-1 pt-1 border-t" style={{ borderColor: '#F1F5F9' }}>
              <span style={{ color: '#0D9488' }}>＝親密 / ≡密着</span>
              <span style={{ color: '#94A3B8' }}>┄疎遠</span>
              <span style={{ color: '#F59E0B' }}>〜葛藤</span>
              <span style={{ color: '#64748B' }}>‖断絶</span>
              <span style={{ color: '#DC2626' }}>〜▶敵対/虐待</span>
            </div>
          )}
        </div>
      </div>

      {editingPerson && (
        <EditDialog
          person={editingPerson}
          allPersons={persons}
          relations={relations}
          onSave={handleSavePerson}
          onDelete={handleDeletePerson}
          onAddRelationLine={handleAddRelationLine}
          onRemoveRelationLine={handleRemoveRelationLine}
          onClose={() => setEditingId(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-md text-white text-xs shadow-lg" style={{ background: '#1E293B' }}>
          {toast}
        </div>
      )}

      <ConfirmDialog
        isOpen={confirm.open}
        title={confirm.title}
        message={confirm.message}
        confirmLabel="実行"
        variant="danger"
        confirmText={confirm.confirmText}
        onConfirm={confirm.onYes}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
      />
    </div>
  );
};

const ExportItem: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 text-left" style={{ color: '#475569' }}>
    <span style={{ color: '#64748B' }}>{icon}</span>{label}
  </button>
);

const ToolBtn: React.FC<{ onClick: () => void; disabled?: boolean; title: string; children: React.ReactNode }> = ({ onClick, disabled, title, children }) => (
  <button onClick={onClick} disabled={disabled} title={title}
    className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
    style={{ color: '#475569' }}>
    {children}
  </button>
);
