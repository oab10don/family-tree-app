'use client';

import React, { useEffect, useState } from 'react';
import { X, Trash2, Plus } from 'lucide-react';
import {
  Person, Sex, LifeStatus, Relation, RelationType,
  relationshipSuggestions, relationTypeLabels, sexMark,
} from '@/types/genogram';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface Props {
  person: Person;
  allPersons: Person[];
  relations: Relation[];
  onSave: (p: Person) => void;
  onDelete: (id: string) => void;
  onAddRelationLine: (from: string, to: string, type: RelationType) => void;
  onRemoveRelationLine: (id: string) => void;
  onClose: () => void;
}

const Seg: React.FC<{
  value: string;
  options: { v: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ value, options, onChange }) => (
  <div className="flex rounded-md overflow-hidden border" style={{ borderColor: '#E2E8F0' }}>
    {options.map((o) => (
      <button
        key={o.v}
        type="button"
        onClick={() => onChange(o.v)}
        className="flex-1 px-2 py-1.5 text-xs font-medium transition-colors"
        style={{
          background: value === o.v ? '#2563EB' : '#fff',
          color: value === o.v ? '#fff' : '#475569',
        }}
      >
        {o.label}
      </button>
    ))}
  </div>
);

export const EditDialog: React.FC<Props> = ({
  person, allPersons, relations, onSave, onDelete,
  onAddRelationLine, onRemoveRelationLine, onClose,
}) => {
  const [form, setForm] = useState<Person>(person);
  const [relTarget, setRelTarget] = useState('');
  const [relType, setRelType] = useState<RelationType>('close');
  useEffect(() => { setForm(person); setRelTarget(''); }, [person]);

  const set = <K extends keyof Person>(k: K, v: Person[K]) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = () => onSave(form);

  const others = allPersons.filter((p) => p.id !== person.id);
  const myRelations = relations.filter((r) => r.from === person.id || r.to === person.id);
  const nameOf = (id: string) => allPersons.find((p) => p.id === id)?.name || '（未入力）';

  const addRel = () => {
    if (!relTarget) return;
    onAddRelationLine(person.id, relTarget, relType);
    setRelTarget('');
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        style={{ border: '1px solid #E2E8F0' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-5 py-3 border-b sticky top-0 bg-white" style={{ borderColor: '#E2E8F0' }}>
          <h3 className="text-sm font-bold" style={{ color: '#1E293B' }}>人物の編集</h3>
          <button onClick={onClose} style={{ color: '#94A3B8' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3">
          <div>
            <Label className="text-xs">氏名</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="山田 太郎" className="h-9 text-sm mt-1" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">性別</Label>
              <div className="mt-1">
                <Seg
                  value={form.sex}
                  onChange={(v) => set('sex', v as Sex)}
                  options={[{ v: 'male', label: '男 □' }, { v: 'female', label: '女 ○' }, { v: 'unknown', label: '不明 ◇' }]}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">生死</Label>
              <div className="mt-1">
                <Seg
                  value={form.lifeStatus}
                  onChange={(v) => set('lifeStatus', v as LifeStatus)}
                  options={[{ v: 'alive', label: '生存' }, { v: 'deceased', label: '死亡' }, { v: 'unknown', label: '不明' }]}
                />
              </div>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.isProband} onChange={(e) => set('isProband', e.target.checked)} className="w-4 h-4" />
            <span className="text-xs" style={{ color: '#475569' }}>本人（プロバンド）として設定 — 矢印で表示・FHIR出力の基準</span>
          </label>

          <div>
            <Label className="text-xs">続柄（本人視点・任意）</Label>
            <Input list="rel-suggestions" value={form.relationship ?? ''} onChange={(e) => set('relationship', e.target.value)} placeholder="長男 / 妻 / 父 など" className="h-9 text-sm mt-1" />
            <datalist id="rel-suggestions">
              {relationshipSuggestions.map((r) => <option key={r} value={r} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">生年月日</Label>
              <Input type="date" value={form.birthDate ?? ''} onChange={(e) => set('birthDate', e.target.value || undefined)} className="h-9 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs">没年月日</Label>
              <Input type="date" value={form.deathDate ?? ''} onChange={(e) => set('deathDate', e.target.value || undefined)} className="h-9 text-sm mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">既往歴</Label>
            <textarea
              value={form.medicalHistory ?? ''}
              onChange={(e) => set('medicalHistory', e.target.value || undefined)}
              placeholder="高血圧、糖尿病 など（読点や / で区切るとFHIR出力で分割されます）"
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm mt-1"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">同居グループ</Label>
              <select
                value={form.livingGroup ?? 0}
                onChange={(e) => set('livingGroup', Number(e.target.value) || undefined)}
                className="w-full h-9 rounded-md border px-2 text-sm mt-1 bg-white"
                style={{ borderColor: '#E2E8F0' }}
              >
                <option value={0}>なし</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>グループ {n}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-xs">電話</Label>
              <Input value={form.phone ?? ''} onChange={(e) => set('phone', e.target.value || undefined)} className="h-9 text-sm mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-xs">住所</Label>
            <Input value={form.address ?? ''} onChange={(e) => set('address', e.target.value || undefined)} className="h-9 text-sm mt-1" />
          </div>

          <div>
            <Label className="text-xs">備考</Label>
            <textarea
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value || undefined)}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm mt-1"
              style={{ borderColor: '#E2E8F0' }}
            />
          </div>

          {/* 感情関係線 */}
          <div className="border-t pt-3" style={{ borderColor: '#E2E8F0' }}>
            <Label className="text-xs">感情関係線（他の人物との関係の質）</Label>
            <div className="space-y-1 mt-1">
              {myRelations.map((r) => {
                const otherId = r.from === person.id ? r.to : r.from;
                return (
                  <div key={r.id} className="flex items-center justify-between text-xs rounded px-2 py-1" style={{ background: '#F8FAFC' }}>
                    <span style={{ color: '#475569' }}>
                      {nameOf(otherId)} … <span className="font-bold">{relationTypeLabels[r.type]}</span>
                    </span>
                    <button onClick={() => onRemoveRelationLine(r.id)} className="text-red-500 hover:text-red-700" title="削除">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {myRelations.length === 0 && (
                <p className="text-[11px]" style={{ color: '#94A3B8' }}>まだ関係線はありません</p>
              )}
            </div>
            {others.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <select value={relTarget} onChange={(e) => setRelTarget(e.target.value)} className="flex-1 h-8 rounded-md border px-2 text-xs bg-white" style={{ borderColor: '#E2E8F0' }}>
                  <option value="">相手を選択…</option>
                  {others.map((p) => <option key={p.id} value={p.id}>{sexMark(p.sex)} {p.name || '（未入力）'}</option>)}
                </select>
                <select value={relType} onChange={(e) => setRelType(e.target.value as RelationType)} className="h-8 rounded-md border px-2 text-xs bg-white" style={{ borderColor: '#E2E8F0' }}>
                  {(Object.keys(relationTypeLabels) as RelationType[]).map((t) => <option key={t} value={t}>{relationTypeLabels[t]}</option>)}
                </select>
                <button onClick={addRel} disabled={!relTarget} className="h-8 px-2 rounded-md text-white text-xs flex items-center disabled:opacity-40" style={{ background: '#2563EB' }} title="関係線を追加">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 px-5 py-3 border-t sticky bottom-0 bg-white" style={{ borderColor: '#E2E8F0' }}>
          <Button variant="ghost" className="text-red-600 hover:bg-red-50 gap-1 px-2" onClick={() => onDelete(form.id)}>
            <Trash2 className="w-4 h-4" />削除
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose} className="h-9">キャンセル</Button>
          <Button onClick={handleSave} className="h-9 text-white" style={{ background: '#2563EB' }}>保存</Button>
        </div>
      </div>
    </div>
  );
};
