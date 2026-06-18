// ============================================================
// FHIR R4 FamilyMemberHistory 入出力（新モデル対応）
//
// 注意: FHIR FamilyMemberHistory は「本人から見た続柄」しか持たず、
// 人物同士の血縁グラフ（誰と誰が夫婦/親子か）は表現できない。
// → エクスポートは属性中心。インポート時は親子/夫婦関係が失われる旨を呼び出し側で警告する。
// ============================================================

import { Person, Sex, LifeStatus, newId } from '@/types/genogram';

const RELATIONSHIP_CODES: Record<string, { code: string; display: string }> = {
  本人: { code: 'ONESELF', display: 'self' },
  夫: { code: 'HUSB', display: 'husband' },
  妻: { code: 'WIFE', display: 'wife' },
  配偶者: { code: 'SPS', display: 'spouse' },
  父: { code: 'FTH', display: 'father' },
  母: { code: 'MTH', display: 'mother' },
  祖父: { code: 'GRFTH', display: 'grandfather' },
  祖母: { code: 'GRMTH', display: 'grandmother' },
  長男: { code: 'SON', display: 'son' },
  次男: { code: 'SON', display: 'son' },
  三男: { code: 'SON', display: 'son' },
  長女: { code: 'DAU', display: 'daughter' },
  次女: { code: 'DAU', display: 'daughter' },
  三女: { code: 'DAU', display: 'daughter' },
  息子: { code: 'SON', display: 'son' },
  娘: { code: 'DAU', display: 'daughter' },
  兄: { code: 'BRO', display: 'brother' },
  弟: { code: 'BRO', display: 'brother' },
  姉: { code: 'SIS', display: 'sister' },
  妹: { code: 'SIS', display: 'sister' },
  孫: { code: 'GRNDCHILD', display: 'grandchild' },
};

const REVERSE_CODES: Record<string, string> = {
  ONESELF: '本人', HUSB: '夫', WIFE: '妻', SPS: '配偶者',
  FTH: '父', MTH: '母', GRFTH: '祖父', GRMTH: '祖母',
  SON: '息子', DAU: '娘', BRO: '兄弟', SIS: '姉妹', GRNDCHILD: '孫',
};

export const exportToFhir = (persons: Person[], proband: Person): object => {
  // SSR非依存の安定タイムスタンプ
  const now = new Date().toISOString();
  const entries = persons
    .filter((p) => p.id !== proband.id)
    .map((person) => {
      const relLabel = person.relationship || 'その他';
      const relCode = RELATIONSHIP_CODES[relLabel] ?? { code: 'FAMMEMB', display: 'family member' };
      const resource: Record<string, unknown> = {
        resourceType: 'FamilyMemberHistory',
        id: `fmh-${person.id}`,
        status: 'completed',
        patient: { reference: `Patient/${proband.id}`, display: proband.name },
        date: now,
        name: person.name,
        relationship: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: relCode.code, display: relCode.display }],
          text: relLabel,
        },
      };
      if (person.sex !== 'unknown') {
        resource.sex = {
          coding: [{
            system: 'http://hl7.org/fhir/administrative-gender',
            code: person.sex,
            display: person.sex === 'male' ? 'Male' : 'Female',
          }],
        };
      }
      if (person.birthDate) resource.bornDate = person.birthDate;
      if (person.deathDate) { resource.deceasedDate = person.deathDate; resource.deceasedBoolean = true; }
      else if (person.lifeStatus === 'deceased') resource.deceasedBoolean = true;
      if (person.medicalHistory) {
        const conditions = person.medicalHistory.split(/[/、,]/).map((s) => s.trim()).filter(Boolean);
        if (conditions.length) resource.condition = conditions.map((c) => ({ code: { text: c } }));
      }
      if (person.notes) resource.note = [{ text: person.notes }];
      return { fullUrl: `urn:uuid:${person.id}`, resource };
    });

  return { resourceType: 'Bundle', type: 'collection', timestamp: now, entry: entries };
};

export const downloadFhir = (persons: Person[], proband: Person): void => {
  const bundle = exportToFhir(persons, proband);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `家族歴_FHIR_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export interface FhirImportResult {
  persons: Person[];
  errors: string[];
}

export const parseFhirBundle = (json: unknown): FhirImportResult => {
  const errors: string[] = [];
  const persons: Person[] = [];
  if (!json || typeof json !== 'object' || (json as Record<string, unknown>).resourceType !== 'Bundle') {
    return { persons: [], errors: ['有効なFHIR Bundleではありません'] };
  }
  const entries = ((json as Record<string, unknown>).entry as Array<Record<string, unknown>>) ?? [];
  for (const entry of entries) {
    const r = entry.resource as Record<string, unknown> | undefined;
    if (!r || r.resourceType !== 'FamilyMemberHistory') continue;
    try {
      const sexCode = ((r.sex as Record<string, unknown> | undefined)?.coding as Array<Record<string, string>>)?.[0]?.code;
      const sex: Sex = sexCode === 'male' ? 'male' : sexCode === 'female' ? 'female' : 'unknown';
      const conditions = (r.condition as Array<Record<string, unknown>> | undefined) ?? [];
      const medicalHistory = conditions
        .map((c) => (c.code as Record<string, string> | undefined)?.text)
        .filter(Boolean)
        .join('、');
      const rel = r.relationship as Record<string, unknown> | undefined;
      const relCode = (rel?.coding as Array<Record<string, string>> | undefined)?.[0]?.code ?? '';
      const relText = (rel?.text as string) || REVERSE_CODES[relCode] || 'その他';
      const deceasedDate = (r.deceasedDate as string) || undefined;
      const deceasedBoolean = r.deceasedBoolean as boolean | undefined;
      const lifeStatus: LifeStatus = deceasedDate || deceasedBoolean ? 'deceased' : 'alive';
      const note = (r.note as Array<Record<string, string>> | undefined)?.[0]?.text;
      persons.push({
        id: (r.id as string) || newId('fmh'),
        name: (r.name as string) || '（名前未入力）',
        sex,
        lifeStatus,
        relationship: relText,
        birthDate: (r.bornDate as string) || undefined,
        deathDate: deceasedDate,
        medicalHistory: medicalHistory || undefined,
        notes: note,
      });
    } catch {
      errors.push(`FHIRリソースのパースに失敗: ${(r.id as string) || '不明'}`);
    }
  }
  return { persons, errors };
};
