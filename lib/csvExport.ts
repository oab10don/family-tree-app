import { PersonData, relationshipLabels } from '@/types/familyTree';

/**
 * PersonData配列をCSV文字列に変換する
 * BOM付きUTF-8でExcel互換
 */
export function exportToCsv(persons: PersonData[]): string {
  const BOM = '\uFEFF';

  const header = 'ID,氏名,性別,生年月日,没年月日,続柄,父ID,母ID,配偶者ID,既往歴,備考,同居,住所,電話番号';

  const rows = persons.map((person) => {
    const gender =
      person.gender === 'male' ? '男' : person.gender === 'female' ? '女' : 'その他';

    // 既往歴: アプリ内では単一文字列。カンマが使えないためスラッシュ区切りでエクスポート
    const medicalHistory = (person.medicalHistory || '').replace(/,/g, '/');

    // 続柄ラベル
    const relLabel = relationshipLabels[person.relationship] ?? '';

    // 父ID/母ID を parentIds から抽出
    const fatherId =
      person.parentIds?.find((pid) => {
        const parent = persons.find((p) => p.id === pid);
        return parent?.gender === 'male';
      }) || '';
    const motherId =
      person.parentIds?.find((pid) => {
        const parent = persons.find((p) => p.id === pid);
        return parent?.gender === 'female';
      }) || '';

    // 備考: 代表者の場合は「代表者」を追記
    const notes = [
      person.notes || '',
      person.isRepresentative ? '代表者' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return [
      escape(person.id),
      escape(person.name),
      gender,
      person.birthDate || '',
      person.deathDate || '',
      escape(relLabel),
      fatherId,
      motherId,
      person.spouseId || '',
      escape(medicalHistory),
      escape(notes),
      person.livingTogether ? 'true' : 'false',
      escape(person.address || ''),
      escape(person.phone || ''),
    ].join(',');
  });

  return BOM + header + '\n' + rows.join('\n');
}

/** CSVフィールドのエスケープ */
function escape(val: string): string {
  if (!val) return '';
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/** CSVをBlobとしてダウンロード */
export function downloadCsv(persons: PersonData[], filename?: string): void {
  const csv = exportToCsv(persons);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename || `家系図_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
