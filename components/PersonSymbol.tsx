'use client';

import React from 'react';
import { Person, DisplaySettings } from '@/types/genogram';
import { SYMBOL, NODE_W } from '@/lib/layout';
import { formatDateShort, toWarekiShort } from '@/lib/wareki';

export type AddRelationType = 'father' | 'mother' | 'spouse' | 'child' | 'sibling';

interface Props {
  person: Person;
  x: number;
  y: number;
  settings: DisplaySettings;
  selected: boolean;
  highlighted: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onAddRelation: (id: string, type: AddRelationType) => void;
}

const SEX_FILL: Record<string, string> = {
  male: '#EFF6FF',
  female: '#FDF2F8',
  unknown: '#F8FAFC',
};

/** 年（西暦）だけ取り出す */
const yearOf = (d?: string): string => {
  if (!d) return '';
  const y = new Date(d).getFullYear();
  return isNaN(y) ? '' : String(y);
};

export const PersonSymbol: React.FC<Props> = ({
  person, x, y, settings, selected, highlighted, onSelect, onEdit, onAddRelation,
}) => {
  const deceased = person.lifeStatus === 'deceased';
  const stroke = '#1E293B';
  const fill = deceased ? '#E2E8F0' : SEX_FILL[person.sex] ?? '#F8FAFC';
  const pad = 8; // svg内の余白（選択リング・矢印用）
  const svgSize = SYMBOL + pad * 2;
  const c = svgSize / 2; // 中心
  const h = SYMBOL / 2;

  // 記号の形
  let shape: React.ReactNode;
  if (person.sex === 'male') {
    shape = <rect x={c - h} y={c - h} width={SYMBOL} height={SYMBOL} fill={fill} stroke={stroke} strokeWidth={2.5} />;
  } else if (person.sex === 'female') {
    shape = <circle cx={c} cy={c} r={h} fill={fill} stroke={stroke} strokeWidth={2.5} />;
  } else {
    shape = <polygon points={`${c},${c - h} ${c + h},${c} ${c},${c + h} ${c - h},${c}`} fill={fill} stroke={stroke} strokeWidth={2.5} />;
  }

  const birth = settings.showDates ? yearOf(person.birthDate) : '';
  const death = settings.showDates ? yearOf(person.deathDate) : '';
  const dateLine =
    birth || death ? `${birth || '?'}${deceased || death ? `–${death || ''}` : ''}` : '';
  const wareki = settings.showWareki && person.birthDate ? toWarekiShort(person.birthDate) : null;

  const btn =
    'pointer-events-auto flex items-center justify-center text-white text-[10px] font-bold rounded px-1.5 py-0.5 shadow whitespace-nowrap';

  return (
    <div
      className="absolute select-none"
      style={{ left: x - NODE_W / 2, top: y - SYMBOL / 2 - pad, width: NODE_W }}
      // ノード上の pointerdown は背景のパン/選択解除に伝播させない
      // （setPointerCapture によるクリック握り潰しを防ぐ）
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* 本人バッジ */}
      {person.isProband && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20" style={{ top: -pad - 14 }}>
          <span className="text-[10px] font-bold text-white rounded px-1.5 py-px shadow" style={{ background: '#DC2626' }}>本人</span>
        </div>
      )}
      {/* 操作ボタン（選択時のみ） */}
      {selected && (
        <>
          <div className="absolute left-1/2 -translate-x-1/2 -top-7 flex gap-1 z-30">
            <button className={btn} style={{ background: '#3B82F6' }} onClick={(e) => { e.stopPropagation(); onAddRelation(person.id, 'father'); }} title="父を追加">＋父</button>
            <button className={btn} style={{ background: '#EC4899' }} onClick={(e) => { e.stopPropagation(); onAddRelation(person.id, 'mother'); }} title="母を追加">＋母</button>
          </div>
          <button className={`${btn} absolute top-2 -right-10 z-30`} style={{ background: '#8B5CF6' }} onClick={(e) => { e.stopPropagation(); onAddRelation(person.id, 'spouse'); }} title="配偶者を追加">＋配</button>
          <button className={`${btn} absolute top-2 -left-12 z-30`} style={{ background: '#14B8A6' }} onClick={(e) => { e.stopPropagation(); onAddRelation(person.id, 'sibling'); }} title="きょうだいを追加">＋兄弟</button>
          <div className="absolute left-1/2 -translate-x-1/2 z-30 flex gap-1" style={{ top: SYMBOL + pad + 36 }}>
            <button className={btn} style={{ background: '#475569' }} onClick={(e) => { e.stopPropagation(); onEdit(person.id); }} title="編集">編集</button>
            <button className={btn} style={{ background: '#22C55E' }} onClick={(e) => { e.stopPropagation(); onAddRelation(person.id, 'child'); }} title="子を追加">＋子</button>
          </div>
        </>
      )}

      {/* 記号 */}
      <div className="flex justify-center">
        <svg
          width={svgSize}
          height={svgSize}
          className="cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onSelect(person.id); }}
          onDoubleClick={(e) => { e.stopPropagation(); onEdit(person.id); }}
          style={{ overflow: 'visible' }}
        >
          {/* 選択/ハイライトのリング */}
          {(selected || highlighted) && (
            <rect
              x={c - h - 6} y={c - h - 6} width={SYMBOL + 12} height={SYMBOL + 12}
              rx={6} fill="none"
              stroke={selected ? '#2563EB' : '#F59E0B'} strokeWidth={2.5}
              strokeDasharray={highlighted && !selected ? '4 3' : undefined}
            />
          )}
          {shape}
          {/* 故人: ✕ */}
          {deceased && (
            <>
              <line x1={c - h} y1={c - h} x2={c + h} y2={c + h} stroke={stroke} strokeWidth={2} />
              <line x1={c + h} y1={c - h} x2={c - h} y2={c + h} stroke={stroke} strokeWidth={2} />
            </>
          )}
          {/* 本人: 赤枠で大きく強調 */}
          {person.isProband && (
            <rect
              x={c - h - 7} y={c - h - 7} width={SYMBOL + 14} height={SYMBOL + 14}
              rx={8} fill="none" stroke="#DC2626" strokeWidth={3}
            />
          )}
        </svg>
      </div>

      {/* ラベル */}
      <div className="text-center leading-tight mt-0.5" style={{ width: NODE_W }}>
        {settings.showName && (
          <div className="text-xs font-bold truncate" style={{ color: deceased ? '#64748B' : '#0F172A' }}>
            {person.name || '（未入力）'}
          </div>
        )}
        {settings.showRelationship && person.relationship && (
          <div className="text-[10px]" style={{ color: '#64748B' }}>{person.relationship}</div>
        )}
        {dateLine && (
          <div className="text-[10px]" style={{ color: '#94A3B8' }}>
            {dateLine}{wareki && <span>（{wareki.replace('年', '')}）</span>}
          </div>
        )}
        {settings.showMedicalHistory && person.medicalHistory && (
          <div className="text-[10px] truncate" style={{ color: '#DC2626' }} title={person.medicalHistory}>
            {person.medicalHistory}
          </div>
        )}
      </div>
    </div>
  );
};
