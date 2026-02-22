import React, { useCallback } from 'react';
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
  }, [data]);

  const hasSpouse = !!data.spouseId;

  // 日付表示
  const birthDisplay = data.birthDate ? formatDateShort(data.birthDate) : null;
  const birthWareki = data.birthDate ? toWarekiShort(data.birthDate) : null;
  const deathDisplay = data.deathDate ? formatDateShort(data.deathDate) : null;

  // インジケータ表示判定
  const hasLiving = data.livingTogether && data.livingGroup;
  const hasKinship = data.kinshipDegree !== undefined && !data.isRepresentative;

  return (
    <>
      {/* 上：親からの接続用 */}
      <Handle type="target" position={Position.Top} className="opacity-0" />
      {/* 左：配偶者接続用 */}
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />

      <div className="relative">
        {/* +ボタン群：選択時のみ表示（ホバー不要） */}
        {selected && (
          <>
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 flex gap-1 z-50">
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
                className="absolute -right-16 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-purple-500 hover:bg-purple-600 text-white text-[9px] font-medium px-1.5 py-0.5 rounded shadow-md z-50 transition-all"
                title="配偶者を追加"
              >
                <Plus className="w-2.5 h-2.5" />配偶者
              </button>
            )}

            <button
              onClick={(e) => handleAddRelation(e, 'child')}
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-green-500 hover:bg-green-600 text-white text-[9px] font-medium px-1.5 py-0.5 rounded shadow-md z-50 transition-all"
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
            {/* 1行目: 代表者クラウン + 名前 + 故人表示 */}
            {settings.showName && (
              <div className="text-sm font-bold flex items-center gap-1" style={{ color: textColor }}>
                {data.isRepresentative && (
                  <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: '#D97706' }} />
                )}
                <span className="truncate">{getDisplayName(data)}</span>
                {isDeceased && (
                  <span className="text-[10px] font-normal shrink-0" style={{ color: '#94A3B8' }}>(故)</span>
                )}
              </div>
            )}

            {/* 2行目: 生年月日 + 和暦 */}
            {settings.showBirthDate && birthDisplay && (
              <div className="text-[10px]" style={{ color: subTextColor }}>
                {birthDisplay}
                {birthWareki && <span style={{ color: '#94A3B8' }}>({birthWareki})</span>}
              </div>
            )}

            {/* 3行目: 没年月日（故人のみ） */}
            {settings.showBirthDate && deathDisplay && (
              <div className="text-[10px]" style={{ color: '#94A3B8' }}>
                ~ {deathDisplay}
              </div>
            )}

            {/* 4行目: 続柄 + 同居・親等インジケータ */}
            {(settings.showRelationship || hasLiving || hasKinship) && (
              <div className="flex items-center justify-between mt-0.5">
                {settings.showRelationship && relLabel ? (
                  <span className="text-xs" style={{ color: subTextColor }}>{relLabel}</span>
                ) : <span />}
                <div className="flex items-center gap-1">
                  {hasLiving && (
                    <span className="flex items-center gap-px" style={{ color: '#059669', fontSize: 9 }}>
                      <Home className="w-2.5 h-2.5" />
                      <span>{data.livingGroup}</span>
                    </span>
                  )}
                  {hasKinship && (
                    <span
                      className="text-[9px] font-bold px-1 rounded"
                      style={{ backgroundColor: '#EEF2FF', color: '#4F46E5' }}
                    >
                      {data.kinshipDegree === 0 && data.kinshipViaSpouse ? '配' : `${data.kinshipDegree}親等`}
                    </span>
                  )}
                </div>
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
      </div>

      {/* 下：子への接続用 */}
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
      {/* 右：配偶者接続用 */}
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
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
