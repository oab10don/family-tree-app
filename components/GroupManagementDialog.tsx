import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Group } from '@/types/familyTree';

interface GroupManagementDialogProps {
  groups: Group[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (groups: Group[]) => void;
}

export const GroupManagementDialog: React.FC<GroupManagementDialogProps> = ({
  groups,
  isOpen,
  onClose,
  onSave,
}) => {
  const [editingGroups, setEditingGroups] = useState<Group[]>(groups);

  if (!isOpen) return null;

  const addGroup = () => {
    const newGroup: Group = {
      id: `g${Date.now()}`,
      name: '新しいグループ',
      color: '#3b82f6',
      notes: '',
    };
    setEditingGroups([...editingGroups, newGroup]);
  };

  const deleteGroup = (id: string) => {
    if (confirm('このグループを削除しますか？')) {
      setEditingGroups(editingGroups.filter(g => g.id !== id));
    }
  };

  const updateGroup = (id: string, updates: Partial<Group>) => {
    setEditingGroups(editingGroups.map(g =>
      g.id === id ? { ...g, ...updates } : g
    ));
  };

  const handleSave = () => {
    onSave(editingGroups);
    onClose();
  };

  const presetColors = [
    { color: '#3b82f6', name: '青' },
    { color: '#ef4444', name: '赤' },
    { color: '#10b981', name: '緑' },
    { color: '#f59e0b', name: '橙' },
    { color: '#8b5cf6', name: '紫' },
    { color: '#ec4899', name: 'ピンク' },
    { color: '#6b7280', name: '灰' },
    { color: '#14b8a6', name: '青緑' },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">グループ管理</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          {editingGroups.map((group) => (
            <div
              key={group.id}
              className="border rounded-lg p-4 space-y-3 bg-gray-50"
            >
              <div className="flex items-start gap-3">
                {/* カラーピッカー */}
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">色</Label>
                  <Input
                    type="color"
                    value={group.color}
                    onChange={(e) => updateGroup(group.id, { color: e.target.value })}
                    className="w-16 h-10 cursor-pointer"
                  />
                </div>

                {/* グループ名 */}
                <div className="flex-1">
                  <Label>グループ名</Label>
                  <Input
                    value={group.name}
                    onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                    placeholder="グループ名を入力"
                    className="mt-1"
                  />
                </div>

                {/* 削除ボタン */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteGroup(group.id)}
                  className="mt-6"
                  title="削除"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>

              {/* プリセットカラー */}
              <div>
                <Label className="text-xs text-gray-600">プリセットカラー</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {presetColors.map((preset) => (
                    <button
                      key={preset.color}
                      className={`w-8 h-8 rounded border-2 hover:scale-110 transition-transform ${
                        group.color === preset.color ? 'border-gray-900 ring-2 ring-gray-300' : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: preset.color }}
                      onClick={() => updateGroup(group.id, { color: preset.color })}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              {/* メモ */}
              <div>
                <Label className="text-xs text-gray-600">メモ（任意）</Label>
                <Input
                  value={group.notes || ''}
                  onChange={(e) => updateGroup(group.id, { notes: e.target.value })}
                  placeholder="グループの説明..."
                  className="mt-1"
                />
              </div>
            </div>
          ))}

          {editingGroups.length === 0 && (
            <div className="text-center text-gray-500 py-8">
              グループが登録されていません。<br />
              「グループを追加」ボタンから作成してください。
            </div>
          )}
        </div>

        <Button
          onClick={addGroup}
          variant="outline"
          className="w-full mb-6"
        >
          <Plus className="w-4 h-4 mr-2" />
          グループを追加
        </Button>

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleSave} className="flex-1">
            保存
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  );
};
