import React, { useState, useEffect } from 'react';
import { X, Crown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { PersonData, Relationship, relationshipLabels, getDisplayName } from '@/types/familyTree';

interface PersonEditDialogProps {
  person: PersonData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (person: PersonData) => void;
  onDelete?: (personId: string) => void;
  allPersons: PersonData[];
}

export const PersonEditDialog: React.FC<PersonEditDialogProps> = ({
  person,
  isOpen,
  onClose,
  onSave,
  onDelete,
  allPersons,
}) => {
  const [formData, setFormData] = useState<PersonData>({
    id: '',
    name: '',
    gender: 'male',
    lifeStatus: 'alive',
    relationship: 'other',
    isRepresentative: false,
    parentIds: [],
    spouseId: undefined,
    livingTogether: false,
    livingGroup: undefined,
    address: '',
    phone: '',
  });

  useEffect(() => {
    if (person) {
      setFormData({
        ...person,
        isRepresentative: person.isRepresentative || false,
        parentIds: person.parentIds || [],
        spouseId: person.spouseId,
        livingTogether: person.livingTogether || false,
        livingGroup: person.livingGroup,
        address: person.address || '',
        phone: person.phone || '',
      });
    }
  }, [person]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && formData.id && confirm(`「${formData.name}」を削除しますか？`)) {
      onDelete(formData.id);
      onClose();
    }
  };

  const otherPersons = allPersons.filter(p => p.id !== formData.id);

  // 親IDから父（男性）・母（女性）を分離
  const currentParentIds = formData.parentIds || [];
  const fatherId = currentParentIds.find(id => {
    const p = allPersons.find(person => person.id === id);
    return p?.gender === 'male';
  }) || '';
  const motherId = currentParentIds.find(id => {
    const p = allPersons.find(person => person.id === id);
    return p?.gender === 'female';
  }) || '';

  const malePersons = otherPersons.filter(p => p.gender === 'male');
  const femalePersons = otherPersons.filter(p => p.gender === 'female');

  const setFatherId = (id: string) => {
    const newParentIds = [
      ...(id ? [id] : []),
      ...(motherId ? [motherId] : []),
    ];
    setFormData({ ...formData, parentIds: newParentIds });
  };

  const setMotherId = (id: string) => {
    const newParentIds = [
      ...(fatherId ? [fatherId] : []),
      ...(id ? [id] : []),
    ];
    setFormData({ ...formData, parentIds: newParentIds });
  };

  // 続柄の選択肢
  const relationshipOptions: Relationship[] = [
    'self', 'father', 'mother', 'spouse',
    'eldest_son', 'second_son', 'third_son',
    'eldest_daughter', 'second_daughter', 'third_daughter',
    'grandchild', 'other',
  ];

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
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value as Relationship })}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              {relationshipOptions.map((rel) => (
                <option key={rel} value={rel}>{relationshipLabels[rel]}</option>
              ))}
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

          <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 space-y-1">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRepresentative"
                checked={formData.isRepresentative || false}
                onCheckedChange={(checked) => setFormData({ ...formData, isRepresentative: checked as boolean })}
              />
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-yellow-600" />
                <Label htmlFor="isRepresentative" className="cursor-pointer font-medium">
                  代表者として設定
                </Label>
              </div>
            </div>
            {!formData.isRepresentative && (() => {
              const currentRep = allPersons.find(p => p.isRepresentative && p.id !== formData.id);
              return currentRep ? (
                <p className="text-xs text-gray-500 ml-6">
                  現在の代表者: {currentRep.name}
                </p>
              ) : (
                <p className="text-xs text-amber-600 ml-6">
                  代表者が未設定です。親等計算には代表者の設定が必要です。
                </p>
              );
            })()}
            {formData.isRepresentative && (() => {
              const currentRep = allPersons.find(p => p.isRepresentative && p.id !== formData.id);
              return currentRep ? (
                <p className="text-xs text-amber-600 ml-6">
                  {currentRep.name}から代表者が切り替わります
                </p>
              ) : null;
            })()}
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
                <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
              ))}
            </select>
          </div>

          {/* 親選択: 男性/女性ドロップダウン */}
          <div>
            <Label>親</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label htmlFor="fatherId" className="text-xs text-gray-500">父（男性）</Label>
                <select
                  id="fatherId"
                  value={fatherId}
                  onChange={(e) => setFatherId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">未選択</option>
                  {malePersons.map((p) => (
                    <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="motherId" className="text-xs text-gray-500">母（女性）</Label>
                <select
                  id="motherId"
                  value={motherId}
                  onChange={(e) => setMotherId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">未選択</option>
                  {femalePersons.map((p) => (
                    <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 同居/別居 */}
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="livingTogether"
                checked={formData.livingTogether || false}
                onCheckedChange={(checked) => setFormData({
                  ...formData,
                  livingTogether: checked as boolean,
                  livingGroup: checked ? (formData.livingGroup || 1) : undefined,
                })}
              />
              <Label htmlFor="livingTogether" className="cursor-pointer font-medium">
                同居
              </Label>
            </div>
            {formData.livingTogether && (
              <div>
                <Label htmlFor="livingGroup" className="text-xs text-gray-500">グループ番号</Label>
                <select
                  id="livingGroup"
                  value={formData.livingGroup || 1}
                  onChange={(e) => setFormData({ ...formData, livingGroup: Number(e.target.value) })}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 住所・電話 */}
          <div>
            <Label htmlFor="address">住所</Label>
            <Input
              id="address"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="東京都..."
            />
          </div>

          <div>
            <Label htmlFor="phone">電話番号</Label>
            <Input
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="090-1234-5678"
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

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              保存
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              キャンセル
            </Button>
          </div>

          {onDelete && formData.id && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              className="w-full text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              この人物を削除
            </Button>
          )}
        </form>
      </div>
    </div>
  );
};
