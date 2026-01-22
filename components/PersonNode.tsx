import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { PersonNodeData } from '@/types/familyTree';
import { User, Crown } from 'lucide-react';

interface PersonNodeProps extends NodeProps {
  data: PersonNodeData & {
    settings: {
      showPhoto: boolean;
      showName: boolean;
      showSubtitle: boolean;
      showBirthDeath: boolean;
      showAffiliation: boolean;
      showNotes: boolean;
      colorByGender: boolean;
    };
    groupColors?: string[];
  };
}

export const PersonNode: React.FC<PersonNodeProps> = ({ data, selected }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const settings = data.settings;
  
  // 性別による色分け
  const getBgColor = () => {
    if (!settings.colorByGender) return 'bg-white';
    
    // 死去している場合は灰色がかった色に
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

  // 生存状態の装飾
  const getLifeStatusStyle = () => {
    if (data.lifeStatus === 'deceased') {
      return 'relative before:absolute before:inset-0 before:border-2 before:border-gray-400 before:pointer-events-none before:bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.1)_10px,rgba(0,0,0,0.1)_12px)]';
    }
    return '';
  };

  return (
    <>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div
          className={`
            min-w-[120px] max-w-[200px] p-3 rounded-lg border-2
            ${getBgColor()}
            ${getBorderColor()}
            ${selected ? 'ring-2 ring-primary' : ''}
            ${getLifeStatusStyle()}
            transition-all cursor-pointer
          `}
        >
          <div className="flex flex-col items-center gap-2">
            {/* 死去マーク */}
            {data.lifeStatus === 'deceased' && (
              <div className="absolute -top-2 -right-2 bg-gray-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold z-10">
                †
              </div>
            )}

            {/* 代表者マーク（王冠） */}
            {data.isRepresentative && (
              <div className="absolute -top-2 -left-2 bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center z-10">
                <Crown className="w-4 h-4" />
              </div>
            )}

            {/* 写真 */}
            {settings.showPhoto && (
              <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                {data.photo ? (
                  <img src={data.photo} alt={data.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-8 h-8 text-gray-400" />
                )}
              </div>
            )}

            {/* 名前 */}
            {settings.showName && (
              <div className="text-center text-sm font-bold">
                {data.name}
              </div>
            )}

            {/* サブタイトル */}
            {settings.showSubtitle && data.subtitle && (
              <div className="text-xs text-gray-600 text-center">
                {data.subtitle}
              </div>
            )}

            {/* 生没年 */}
            {settings.showBirthDeath && (data.birthDate || data.deathDate) && (
              <div className="text-xs text-gray-500 text-center">
                {data.birthDate && `${data.birthDate}`}
                {data.deathDate && ` - ${data.deathDate}`}
              </div>
            )}

            {/* 所属 */}
            {settings.showAffiliation && data.affiliation && (
              <div className="text-xs text-gray-600 text-center">
                {data.affiliation}
              </div>
            )}

            {/* メモ */}
            {settings.showNotes && data.notes && (
              <div className="text-xs text-gray-500 text-center mt-1 border-t pt-1">
                {data.notes}
              </div>
            )}

            {/* グループインジケーター */}
            {data.groupColors && data.groupColors.length > 0 && (
              <div className="flex gap-1 mt-1">
                {data.groupColors.map((color, index) => (
                  <div
                    key={index}
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ホバーツールチップ */}
        {showTooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 pointer-events-none">
            <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg min-w-[200px] max-w-[300px]">
              <div className="font-bold mb-2 flex items-center gap-2">
                {data.isRepresentative && <Crown className="w-4 h-4 text-yellow-400" />}
                {data.name}
              </div>
              <div className="space-y-1 text-gray-300">
                <div>性別: {data.gender === 'male' ? '男性' : data.gender === 'female' ? '女性' : 'その他'}</div>
                <div>状態: {data.lifeStatus === 'alive' ? '生存' : data.lifeStatus === 'deceased' ? '死去' : '不明'}</div>
                {data.birthDate && <div>生年: {data.birthDate}</div>}
                {data.deathDate && <div>没年: {data.deathDate}</div>}
                {data.subtitle && <div>肩書: {data.subtitle}</div>}
                {data.affiliation && <div>所属: {data.affiliation}</div>}
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
    </>
  );
};
