import React, { useState, useEffect } from 'react';
import { X, Crown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { PersonData, Group } from '@/types/familyTree';

interface PersonEditDialogProps {
  person: PersonData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (person: PersonData) => void;
  groups: Group[];
}

export const PersonEditDialog: React.FC<PersonEditDialogProps> = ({
  person,
  isOpen,
  onClose,
  onSave,
  groups,
}) => {
  const [formData, setFormData] = useState<PersonData>({
    id: '',
    name: '',
    gender: 'male',
    lifeStatus: 'alive',
    relationship: 'other',
    birthDate: '',
    deathDate: '',
    subtitle: '',
    affiliation: '',
    notes: '',
    photo: '',
    groupIds: [],
    isRepresentative: false,
  });

  useEffect(() => {
    if (person) {
      setFormData({
        ...person,
        groupIds: person.groupIds || [],
        isRepresentative: person.isRepresentative || false,
      });
    }
  }, [person]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, photo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleGroup = (groupId: string) => {
    const newGroupIds = formData.groupIds.includes(groupId)
      ? formData.groupIds.filter(id => id !== groupId)
      : [...formData.groupIds, groupId];
    setFormData({ ...formData, groupIds: newGroupIds });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">人物情報を編集</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">名前 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="gender">性別</Label>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div>
            <Label htmlFor="relationship">続柄 *</Label>
            <select
              id="relationship"
              value={formData.relationship}
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value as any })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="self">本人</option>
              <option value="father">父</option>
              <option value="mother">母</option>
              <option value="grandfather_paternal">祖父（父方）</option>
              <option value="grandmother_paternal">祖母（父方）</option>
              <option value="grandfather_maternal">祖父（母方）</option>
              <option value="grandmother_maternal">祖母（母方）</option>
              <option value="spouse">配偶者</option>
              <option value="child">子</option>
              <option value="sibling">兄弟姉妹</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div>
            <Label htmlFor="lifeStatus">生存状態</Label>
            <select
              id="lifeStatus"
              value={formData.lifeStatus}
              onChange={(e) => setFormData({ ...formData, lifeStatus: e.target.value as any })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="alive">生存</option>
              <option value="deceased">死去</option>
              <option value="unknown">不明</option>
            </select>
          </div>

          {/* 代表者チェックボックス */}
          <div className="flex items-center space-x-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <Checkbox
              id="isRepresentative"
              checked={formData.isRepresentative || false}
              onCheckedChange={(checked) => setFormData({ ...formData, isRepresentative: checked })}
            />
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-600" />
              <Label htmlFor="isRepresentative" className="cursor-pointer font-medium">
                代表者として表示
              </Label>
            </div>
          </div>

          <div>
            <Label htmlFor="subtitle">サブタイトル</Label>
            <Input
              id="subtitle"
              value={formData.subtitle || ''}
              onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
              placeholder="例: 初代、二代目"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="birthDate">生年</Label>
              <Input
                id="birthDate"
                value={formData.birthDate || ''}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                placeholder="1990"
              />
            </div>
            <div>
              <Label htmlFor="deathDate">没年</Label>
              <Input
                id="deathDate"
                value={formData.deathDate || ''}
                onChange={(e) => setFormData({ ...formData, deathDate: e.target.value })}
                placeholder="2020"
                disabled={formData.lifeStatus !== 'deceased'}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="affiliation">所属</Label>
            <Input
              id="affiliation"
              value={formData.affiliation || ''}
              onChange={(e) => setFormData({ ...formData, affiliation: e.target.value })}
              placeholder="会社名など"
            />
          </div>

          <div>
            <Label htmlFor="notes">メモ</Label>
            <textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="備考・メモ"
            />
          </div>

          {/* グループ選択 */}
          {groups.length > 0 && (
            <div>
              <Label>グループ</Label>
              <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
                {groups.map((group) => (
                  <div key={group.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`group-${group.id}`}
                      checked={formData.groupIds.includes(group.id)}
                      onCheckedChange={() => toggleGroup(group.id)}
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: group.color }}
                      />
                      <Label htmlFor={`group-${group.id}`} className="cursor-pointer">
                        {group.name}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="photo">写真</Label>
            <Input
              id="photo"
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
            />
            {formData.photo && (
              <div className="mt-2">
                <img
                  src={formData.photo}
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              保存
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
