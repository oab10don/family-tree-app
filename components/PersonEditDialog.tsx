import React, { useState, useEffect } from 'react';
import { X, Crown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { PersonData, Relationship, relationshipLabels, getDisplayName } from '@/types/familyTree';
import { toWareki } from '@/lib/wareki';

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
    birthDate: '',
    deathDate: '',
    medicalHistory: '',
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
        birthDate: person.birthDate || '',
        deathDate: person.deathDate || '',
        medicalHistory: person.medicalHistory || '',
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

  const relationshipOptions: Relationship[] = [
    'self', 'father', 'mother', 'spouse',
    'eldest_son', 'second_son', 'third_son',
    'eldest_daughter', 'second_daughter', 'third_daughter',
    'grandchild', 'other',
  ];

  const selectStyle = { borderColor: '#E2E8F0', color: '#1E293B' };

  const birthWareki = toWareki(formData.birthDate || '');
  const deathWareki = toWareki(formData.deathDate || '');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
      <div
        className="rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl"
        style={{ backgroundColor: '#fff', border: '1px solid #E2E8F0' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold" style={{ color: '#1E293B' }}>人物情報を編集</h2>
          <button onClick={onClose} style={{ color: '#94A3B8' }} className="hover:opacity-70">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name" style={{ color: '#475569' }}>名前 *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={selectStyle}
            />
          </div>

          <div>
            <Label htmlFor="gender" style={{ color: '#475569' }}>性別</Label>
            <select
              id="gender"
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as PersonData['gender'] })}
              className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              style={selectStyle}
            >
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </div>

          <div>
            <Label htmlFor="relationship" style={{ color: '#475569' }}>続柄 *</Label>
            <select
              id="relationship"
              value={formData.relationship}
              onChange={(e) => setFormData({ ...formData, relationship: e.target.value as Relationship })}
              className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              style={selectStyle}
              required
            >
              {relationshipOptions.map((rel) => (
                <option key={rel} value={rel}>{relationshipLabels[rel]}</option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="lifeStatus" style={{ color: '#475569' }}>生存状態</Label>
            <select
              id="lifeStatus"
              value={formData.lifeStatus}
              onChange={(e) => setFormData({ ...formData, lifeStatus: e.target.value as PersonData['lifeStatus'] })}
              className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              style={selectStyle}
            >
              <option value="alive">生存</option>
              <option value="deceased">死去</option>
              <option value="unknown">不明</option>
            </select>
          </div>

          {/* 生年月日・没年月日（和暦プレビュー付き） */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="birthDate" style={{ color: '#475569' }}>生年月日</Label>
              <Input
                id="birthDate"
                type="date"
                value={formData.birthDate || ''}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                style={selectStyle}
              />
              {birthWareki && (
                <p className="text-[11px] mt-1" style={{ color: '#2563EB' }}>{birthWareki}</p>
              )}
            </div>
            <div>
              <Label htmlFor="deathDate" style={{ color: '#475569' }}>没年月日</Label>
              <Input
                id="deathDate"
                type="date"
                value={formData.deathDate || ''}
                onChange={(e) => setFormData({ ...formData, deathDate: e.target.value })}
                style={selectStyle}
              />
              {deathWareki && (
                <p className="text-[11px] mt-1" style={{ color: '#2563EB' }}>{deathWareki}</p>
              )}
            </div>
          </div>

          {/* 代表者 */}
          <div className="p-3 rounded-md space-y-1" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRepresentative"
                checked={formData.isRepresentative || false}
                onCheckedChange={(checked) => setFormData({ ...formData, isRepresentative: checked as boolean })}
              />
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4" style={{ color: '#D97706' }} />
                <Label htmlFor="isRepresentative" className="cursor-pointer font-medium" style={{ color: '#92400E' }}>
                  代表者として設定
                </Label>
              </div>
            </div>
            {!formData.isRepresentative && (() => {
              const currentRep = allPersons.find(p => p.isRepresentative && p.id !== formData.id);
              return currentRep ? (
                <p className="text-xs ml-6" style={{ color: '#94A3B8' }}>現在の代表者: {currentRep.name}</p>
              ) : (
                <p className="text-xs ml-6" style={{ color: '#D97706' }}>代表者が未設定です。親等計算には代表者の設定が必要です。</p>
              );
            })()}
            {formData.isRepresentative && (() => {
              const currentRep = allPersons.find(p => p.isRepresentative && p.id !== formData.id);
              return currentRep ? (
                <p className="text-xs ml-6" style={{ color: '#D97706' }}>{currentRep.name}から代表者が切り替わります</p>
              ) : null;
            })()}
          </div>

          <div>
            <Label htmlFor="spouseId" style={{ color: '#475569' }}>配偶者</Label>
            <select
              id="spouseId"
              value={formData.spouseId || ''}
              onChange={(e) => setFormData({ ...formData, spouseId: e.target.value || undefined })}
              className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
              style={selectStyle}
            >
              <option value="">なし</option>
              {otherPersons.map((p) => (
                <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
              ))}
            </select>
          </div>

          <div>
            <Label style={{ color: '#475569' }}>親</Label>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div>
                <Label htmlFor="fatherId" className="text-xs" style={{ color: '#94A3B8' }}>父（男性）</Label>
                <select
                  id="fatherId"
                  value={fatherId}
                  onChange={(e) => setFatherId(e.target.value)}
                  className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  style={selectStyle}
                >
                  <option value="">未選択</option>
                  {malePersons.map((p) => (
                    <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="motherId" className="text-xs" style={{ color: '#94A3B8' }}>母（女性）</Label>
                <select
                  id="motherId"
                  value={motherId}
                  onChange={(e) => setMotherId(e.target.value)}
                  className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  style={selectStyle}
                >
                  <option value="">未選択</option>
                  {femalePersons.map((p) => (
                    <option key={p.id} value={p.id}>{getDisplayName(p)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 医療情報 */}
          <div className="p-3 rounded-md space-y-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <h4 className="text-sm font-semibold" style={{ color: '#991B1B' }}>医療情報</h4>
            <div>
              <Label htmlFor="medicalHistory" className="text-xs" style={{ color: '#DC2626' }}>既往歴</Label>
              <Input
                id="medicalHistory"
                value={formData.medicalHistory || ''}
                onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                placeholder="例: 高血圧、糖尿病、がん"
                style={{ ...selectStyle, borderColor: '#FECACA' }}
              />
            </div>
          </div>

          {/* 同居/別居 */}
          <div className="p-3 rounded-md space-y-2" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
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
              <Label htmlFor="livingTogether" className="cursor-pointer font-medium" style={{ color: '#166534' }}>同居</Label>
            </div>
            {formData.livingTogether && (
              <div>
                <Label htmlFor="livingGroup" className="text-xs" style={{ color: '#94A3B8' }}>グループ番号</Label>
                <select
                  id="livingGroup"
                  value={formData.livingGroup || 1}
                  onChange={(e) => setFormData({ ...formData, livingGroup: Number(e.target.value) })}
                  className="flex h-10 w-full rounded-md border px-3 py-2 text-sm"
                  style={selectStyle}
                >
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="address" style={{ color: '#475569' }}>住所</Label>
            <Input
              id="address"
              value={formData.address || ''}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="東京都..."
              style={selectStyle}
            />
          </div>

          <div>
            <Label htmlFor="phone" style={{ color: '#475569' }}>電話番号</Label>
            <Input
              id="phone"
              value={formData.phone || ''}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="090-1234-5678"
              style={selectStyle}
            />
          </div>

          <div>
            <Label htmlFor="notes" style={{ color: '#475569' }}>メモ</Label>
            <textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm"
              style={selectStyle}
              placeholder="備考・メモ"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1 text-white" style={{ backgroundColor: '#2563EB' }}>保存</Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1" style={{ borderColor: '#E2E8F0', color: '#475569' }}>キャンセル</Button>
          </div>

          {onDelete && formData.id && (
            <Button type="button" variant="ghost" onClick={handleDelete} className="w-full text-red-500 hover:text-red-700 hover:bg-red-50">
              この人物を削除
            </Button>
          )}
        </form>
      </div>
    </div>
  );
};
