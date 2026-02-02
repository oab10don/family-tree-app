import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PersonNodeData, getDisplayName } from '@/types/familyTree';
import { Crown, Home } from 'lucide-react';

interface PersonNodeProps extends NodeProps {
  data: PersonNodeData & {
    settings: {
      showName: boolean;
      showBirthDeath: boolean;
      showNotes: boolean;
      colorByGender: boolean;
    };
  };
}

/** 同居グループ番号ごとの枠線カラー */
const LIVING_GROUP_COLORS: Record<number, string> = {
  1: 'ring-green-400',
  2: 'ring-orange-400',
  3: 'ring-purple-400',
  4: 'ring-teal-400',
  5: 'ring-rose-400',
  6: 'ring-cyan-400',
  7: 'ring-amber-400',
  8: 'ring-indigo-400',
  9: 'ring-lime-400',
  10: 'ring-fuchsia-400',
};

export const PersonNode: React.FC<PersonNodeProps> = ({ data, selected }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const settings = data.settings;

  const getBgColor = () => {
    if (!settings.colorByGender) return 'bg-white';

    if (data.lifeStatus === 'deceased') {
      switch (data.gender) {
        case 'male':
          return 'bg-blue-100 opacity-70';
        case 'female':
          return 'bg-pink-100 opacity-70';
        default:
          return 'bg-gray-100 opacity-70';
      }
    }

    switch (data.gender) {
      case 'male':
        return 'bg-blue-50';
      case 'female':
        return 'bg-pink-50';
      default:
        return 'bg-gray-50';
    }
  };

  const getBorderColor = () => {
    if (!settings.colorByGender) return 'border-gray-300';

    switch (data.gender) {
      case 'male':
        return 'border-blue-300';
      case 'female':
        return 'border-pink-300';
      default:
        return 'border-gray-300';
    }
  };

  const getLifeStatusStyle = () => {
    if (data.lifeStatus === 'deceased') {
      return 'relative before:absolute before:inset-0 before:border-2 before:border-gray-400 before:pointer-events-none before:bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.1)_10px,rgba(0,0,0,0.1)_12px)]';
    }
    return '';
  };

  const livingGroupRing = data.livingTogether && data.livingGroup
    ? `ring-2 ${LIVING_GROUP_COLORS[data.livingGroup] ?? 'ring-green-400'}`
    : '';

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />

      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className={`
            min-w-[100px] sm:min-w-[120px] max-w-[180px] sm:max-w-[200px] p-2.5 sm:p-3 rounded-lg border-2
            ${getBgColor()}
            ${getBorderColor()}
            ${selected ? 'ring-2 ring-primary' : livingGroupRing}
            ${getLifeStatusStyle()}
            transition-all cursor-pointer
          `}
        >
          <div className="flex flex-col items-center gap-1 sm:gap-2">
            {data.lifeStatus === 'deceased' && (
              <div className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs font-bold z-10">
                †
              </div>
            )}

            {data.isRepresentative && (
              <div className="absolute -top-2 -left-2 bg-yellow-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center z-10">
                <Crown className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
            )}

            {/* 同居バッジ */}
            {data.livingTogether && data.livingGroup && (
              <div className="absolute -bottom-2 -right-2 bg-green-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-[10px] font-bold z-10">
                <Home className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span className="text-[8px] ml-px">{data.livingGroup}</span>
              </div>
            )}

            {settings.showName && (
              <div className="text-center text-xs sm:text-sm font-bold">
                {getDisplayName(data)}
              </div>
            )}

            {settings.showBirthDeath && (data.birthDate || data.deathDate) && (
              <div className="text-[10px] sm:text-xs text-gray-500 text-center">
                {data.birthDate && `${data.birthDate}`}
                {data.deathDate && ` - ${data.deathDate}`}
              </div>
            )}

            {settings.showNotes && data.notes && (
              <div className="text-[10px] sm:text-xs text-gray-500 text-center mt-1 border-t pt-1">
                {data.notes}
              </div>
            )}
          </div>
        </div>

        {showTooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none">
            <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg min-w-[200px] max-w-[300px]">
              <div className="font-bold mb-2 flex items-center gap-2">
                {data.isRepresentative && <Crown className="w-4 h-4 text-yellow-400" />}
                {getDisplayName(data)}
              </div>
              <div className="space-y-1 text-gray-300">
                <div>性別: {data.gender === 'male' ? '男性' : data.gender === 'female' ? '女性' : 'その他'}</div>
                <div>状態: {data.lifeStatus === 'alive' ? '生存' : data.lifeStatus === 'deceased' ? '死去' : '不明'}</div>
                {data.birthDate && <div>生年: {data.birthDate}</div>}
                {data.deathDate && <div>没年: {data.deathDate}</div>}
                {data.livingTogether && data.livingGroup && (
                  <div>同居グループ: {data.livingGroup}</div>
                )}
                {data.address && <div>住所: {data.address}</div>}
                {data.phone && <div>電話: {data.phone}</div>}
                {data.notes && (
                  <div className="border-t border-gray-700 pt-1 mt-1">
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
 * PersonNodeと同じ min-w を持つことでハンドル中心が子ノードと揃う。
 */
export const JunctionNode: React.FC<NodeProps> = () => {
  return (
    <div
      className="min-w-[100px] sm:min-w-[120px]"
      style={{ height: 2, opacity: 0, pointerEvents: 'none' }}
    >
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
};
