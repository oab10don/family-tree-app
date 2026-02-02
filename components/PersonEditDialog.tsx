import React, { useState, useEffect } from 'react';
import { X, Crown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { PersonData } from '@/types/familyTree';

interface PersonEditDialogProps {
  person: PersonData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (person: PersonData) => void;
  allPersons: PersonData[];
}

export const PersonEditDialog: React.FC<PersonEditDialogProps> = ({
  person,
  isOpen,
  onClose,
  onSave,
  allPersons,
}) => {
  const [formData, setFormData] = useState<PersonData>({
    id: '',
    name: '',
    gender: 'male',
    lifeStatus: 'alive',
    relationship: 'other',
    birthDate: '',
    deathDate: '',
    notes: '',
    photo: '',
    isRepresentative: false,
    parentIds: [],
    spouseId: undefined,
  });

  useEffect(() => {
    if (person) {
      setFormData({
        ...person,
        isRepresentative: person.isRepresentative || false,
        parentIds: person.parentIds || [],
        spouseId: person.spouseId,
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

  const otherPersons = allPersons.filter(p => p.id !== formData.id);

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
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as PersonData['gender'] })}
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
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value as PersonData['relationship'] })}
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
              onChange={(e) => setFormData({ ...formData, lifeStatus: e.target.value as PersonData['lifeStatus'] })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="alive">生存</option>
              <option value="deceased">死去</option>
              <option value="unknown">不明</option>
            </select>
          </div>

          <div className="flex items-center space-x-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <Checkbox
              id="isRepresentative"
              checked={formData.isRepresentative || false}
              onCheckedChange={(checked) => setFormData({ ...formData, isRepresentative: checked as boolean })}
            />
            <div className="flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-600" />
              <Label htmlFor="isRepresentative" className="cursor-pointer font-medium">
                代表者として表示
              </Label>
            </div>
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
            <Label htmlFor="spouseId">配偶者</Label>
            <select
              id="spouseId"
              value={formData.spouseId || ''}
              onChange={(e) => setFormData({ ...formData, spouseId: e.target.value || undefined })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">なし</option>
              {otherPersons.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <Label>親</Label>
            <div className="space-y-2 mt-2 max-h-32 overflow-y-auto">
              {otherPersons.map((p) => (
                <div key={p.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`parent-${p.id}`}
                    checked={(formData.parentIds || []).includes(p.id)}
                    onCheckedChange={(checked) => {
                      const parentIds = formData.parentIds || [];
                      const newParentIds = checked
                        ? [...parentIds, p.id]
                        : parentIds.filter(id => id !== p.id);
                      setFormData({ ...formData, parentIds: newParentIds });
                    }}
                  />
                  <Label htmlFor={`parent-${p.id}`} className="cursor-pointer">
                    {p.name}
                  </Label>
                </div>
              ))}
            </div>
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
