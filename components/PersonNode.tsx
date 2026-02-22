import React, { useState, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PersonNodeData, getDisplayName, relationshipLabels, DisplaySettings } from '@/types/familyTree';
import { Crown, Home, Plus } from 'lucide-react';
import { formatDateShort, toWarekiShort } from '@/lib/wareki';

/** +ボタンで追加する関係の種類 */
export type AddRelationType = 'father' | 'mother' | 'child' | 'spouse';

interface PersonNodeProps extends NodeProps {
  data: PersonNodeData & {
    settings: DisplaySettings;
    kinshipDegree?: number;
    kinshipViaSpouse?: boolean;
    onAddRelation?: (personId: string, relationType: AddRelationType) => void;
  };
}

/** 性別ごとの左ボーダー色 */
const GENDER_BORDER_COLORS = {
  male: '#3B82F6',
  female: '#EC4899',
  other: '#9CA3AF',
} as const;

/** 性別ごとの背景色 */
const GENDER_BG_COLORS = {
  male: { alive: '#EFF6FF', deceased: '#F1F5F9' },
  female: { alive: '#FDF2F8', deceased: '#F1F5F9' },
  other: { alive: '#F9FAFB', deceased: '#F1F5F9' },
} as const;

export const PersonNode: React.FC<PersonNodeProps> = ({ data, selected }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const settings = data.settings;
  const isDeceased = data.lifeStatus === 'deceased';

  const borderColor = isDeceased
    ? '#9CA3AF'
    : (GENDER_BORDER_COLORS[data.gender] || GENDER_BORDER_COLORS.other);
  const bgColor = isDeceased
    ? '#F1F5F9'
    : (GENDER_BG_COLORS[data.gender]?.alive || '#F9FAFB');

  const textColor = isDeceased ? '#94A3B8' : '#1E293B';
  const subTextColor = isDeceased ? '#CBD5E1' : '#64748B';

  const relLabel = relationshipLabels[data.relationship] ?? '';

  const handleAddRelation = useCallback((e: React.MouseEvent, type: AddRelationType) => {
    e.stopPropagation();
    data.onAddRelation?.(data.id, type);
    setShowActions(false);
  }, [data]);

  const hasSpouse = !!data.spouseId;

  // 日付表示
  const birthDisplay = data.birthDate ? formatDateShort(data.birthDate) : null;
  const birthWareki = data.birthDate ? toWarekiShort(data.birthDate) : null;
  const deathDisplay = data.deathDate ? formatDateShort(data.deathDate) : null;

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />

      <div
        className="relative group"
        onMouseEnter={() => { setShowTooltip(true); setShowActions(true); }}
        onMouseLeave={() => { setShowTooltip(false); setShowActions(false); }}
      >
        {/* +ボタン群 */}
        {showActions && (
          <>
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex gap-1 z-20">
              {(!data.parentIds || data.parentIds.length < 2) && (
                <>
                  <button
                    onClick={(e) => handleAddRelation(e, 'father')}
                    className="flex items-center gap-0.5 bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-medium px-1.5 py-0.5 rounded shadow-md transition-all"
                    title="父を追加"
                  >
                    <Plus className="w-2.5 h-2.5" />父
                  </button>
                  <button
                    onClick={(e) => handleAddRelation(e, 'mother')}
                    className="flex items-center gap-0.5 bg-pink-500 hover:bg-pink-600 text-white text-[9px] font-medium px-1.5 py-0.5 rounded shadow-md transition-all"
                    title="母を追加"
                  >
                    <Plus className="w-2.5 h-2.5" />母
                  </button>
                </>
              )}
            </div>

            {!hasSpouse && (
              <button
                onClick={(e) => handleAddRelation(e, 'spouse')}
                className="absolute -right-16 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-purple-500 hover:bg-purple-600 text-white text-[9px] font-medium px-1.5 py-0.5 rounded shadow-md z-20 transition-all"
                title="配偶者を追加"
              >
                <Plus className="w-2.5 h-2.5" />配偶者
              </button>
            )}

            <button
              onClick={(e) => handleAddRelation(e, 'child')}
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-green-500 hover:bg-green-600 text-white text-[9px] font-medium px-1.5 py-0.5 rounded shadow-md z-20 transition-all"
              title="子を追加"
            >
              <Plus className="w-2.5 h-2.5" />子
            </button>
          </>
        )}

        {/* ノード本体 */}
        <div
          className="relative overflow-hidden transition-all cursor-pointer"
          style={{
            minWidth: 150,
            maxWidth: 220,
            backgroundColor: bgColor,
            borderRadius: 6,
            border: `1px solid ${selected ? '#2563EB' : '#E2E8F0'}`,
            borderLeft: `4px solid ${borderColor}`,
            boxShadow: selected
              ? '0 0 0 2px rgba(37, 99, 235, 0.3)'
              : '0 1px 3px rgba(0,0,0,0.08)',
            opacity: isDeceased ? 0.75 : 1,
          }}
        >
          {isDeceased && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(0,0,0,0.04) 8px, rgba(0,0,0,0.04) 10px)',
              }}
            />
          )}

          <div className="relative px-3 py-2">
            {/* バッジ群 */}
            {data.isRepresentative && (
              <div
                className="absolute -top-1.5 -left-0.5 flex items-center justify-center"
                style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#EAB308', color: '#fff' }}
              >
                <Crown className="w-3 h-3" />
              </div>
            )}

            {isDeceased && (
              <div
                className="absolute -top-1.5 -right-1.5 flex items-center justify-center text-xs font-bold"
                style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#64748B', color: '#fff' }}
              >
                <span style={{ fontSize: 11 }}>†</span>
              </div>
            )}

            {data.livingTogether && data.livingGroup && (
              <div
                className="absolute -bottom-1.5 -right-1.5 flex items-center justify-center"
                style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#059669', color: '#fff', fontSize: 9 }}
              >
                <Home className="w-2.5 h-2.5" />
                <span className="ml-px" style={{ fontSize: 8 }}>{data.livingGroup}</span>
              </div>
            )}

            {data.kinshipDegree !== undefined && !data.isRepresentative && (
              <div
                className="absolute -bottom-1.5 -left-0.5 flex items-center justify-center font-bold"
                style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: '#4F46E5', color: '#fff', fontSize: 10 }}
              >
                {data.kinshipDegree === 0 && data.kinshipViaSpouse ? '配' : data.kinshipDegree}
              </div>
            )}

            {/* 1行目: 性別アイコン + 名前 */}
            {settings.showName && (
              <div className="text-sm font-bold" style={{ color: textColor }}>
                {getDisplayName(data)}
                {isDeceased && <span className="text-[10px] font-normal ml-1" style={{ color: '#94A3B8' }}>（故）</span>}
              </div>
            )}

            {/* 2行目: 生年月日 + 和暦 */}
            {settings.showBirthDate && birthDisplay && (
              <div className="text-[10px]" style={{ color: subTextColor }}>
                {birthDisplay}
                {birthWareki && <span style={{ color: '#94A3B8' }}>（{birthWareki}）</span>}
              </div>
            )}

            {/* 3行目: 没年月日（故人のみ） */}
            {settings.showBirthDate && deathDisplay && (
              <div className="text-[10px]" style={{ color: '#94A3B8' }}>
                〜 {deathDisplay}
              </div>
            )}

            {/* 4行目: 続柄 */}
            {settings.showRelationship && relLabel && (
              <div className="text-xs mt-0.5" style={{ color: subTextColor }}>
                {relLabel}
              </div>
            )}

            {/* 5行目: 既往歴 */}
            {settings.showMedicalHistory && data.medicalHistory && (
              <div
                className="text-[10px] mt-1 pt-1"
                style={{ color: '#DC2626', borderTop: '1px solid #E2E8F0' }}
              >
                {data.medicalHistory.length > 20
                  ? data.medicalHistory.substring(0, 20) + '...'
                  : data.medicalHistory}
              </div>
            )}
          </div>
        </div>

        {/* ツールチップ */}
        {showTooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none">
            <div
              className="text-xs rounded-lg p-3 shadow-lg min-w-[220px] max-w-[320px]"
              style={{ backgroundColor: '#1E293B', color: '#fff' }}
            >
              <div className="font-bold mb-2 flex items-center gap-2">
                {data.isRepresentative && <Crown className="w-4 h-4 text-yellow-400" />}
                {getDisplayName(data)}
                {isDeceased && <span className="text-gray-400">（故）</span>}
              </div>
              <div className="space-y-1" style={{ color: '#CBD5E1' }}>
                <div>性別: {data.gender === 'male' ? '男性' : data.gender === 'female' ? '女性' : 'その他'}</div>
                <div>続柄: {relLabel}</div>
                <div>状態: {data.lifeStatus === 'alive' ? '生存' : data.lifeStatus === 'deceased' ? '死去' : '不明'}</div>
                {data.birthDate && (
                  <div>生年月日: {formatDateShort(data.birthDate)}{birthWareki && `（${birthWareki}）`}</div>
                )}
                {data.deathDate && (
                  <div>没年月日: {formatDateShort(data.deathDate)}</div>
                )}
                {data.kinshipDegree !== undefined && !data.isRepresentative && (
                  <div>親等: {data.kinshipDegree === 0 && data.kinshipViaSpouse ? '配偶者' : `${data.kinshipDegree}親等`}</div>
                )}
                {data.medicalHistory && (
                  <div style={{ color: '#FCA5A5' }}>既往歴: {data.medicalHistory}</div>
                )}
                {data.livingTogether && data.livingGroup && (
                  <div>同居グループ: {data.livingGroup}</div>
                )}
                {data.address && <div>住所: {data.address}</div>}
                {data.phone && <div>電話: {data.phone}</div>}
                {data.notes && (
                  <div className="pt-1 mt-1" style={{ borderTop: '1px solid #475569' }}>
                    メモ: {data.notes.length > 50 ? data.notes.substring(0, 50) + '...' : data.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />
    </>
  );
};

/**
 * 配偶者線の中点に配置する透明ジャンクションノード。
 */
export const JunctionNode: React.FC<NodeProps> = () => {
  return (
    <div style={{ width: 150, height: 2, opacity: 0, pointerEvents: 'none' }}>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};
