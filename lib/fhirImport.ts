import { PersonData, Relationship } from '@/types/familyTree';

/** FHIRインポート結果 */
export interface FhirImportResult {
  persons: PersonData[];
  errors: string[];
}

/** FHIR RoleCode → 日本語続柄への逆引きマッピング */
const REVERSE_ROLE_CODES: Record<string, string> = {
  SPS: '配偶者',
  FTH: '父',
  MTH: '母',
  SON: '長男',
  DAU: '長女',
  BRO: 'その他',
  SIS: 'その他',
  GRFTH: 'その他',
  GRMTH: 'その他',
  GRNDCHILD: '孫',
  FAMMEMB: 'その他',
  ONESELF: '本人',
};

/** 日本語続柄 → Relationship 型 */
const REL_MAP: Record<string, Relationship> = {
  '本人': 'self',
  '父': 'father',
  '母': 'mother',
  '配偶者': 'spouse',
  '長男': 'eldest_son',
  '次男': 'second_son',
  '三男': 'third_son',
  '長女': 'eldest_daughter',
  '次女': 'second_daughter',
  '三女': 'third_daughter',
  '孫': 'grandchild',
  'その他': 'other',
};

/**
 * FHIR R4 Bundle（FamilyMemberHistory）をパースしてPersonData配列に変換する
 */
export function parseFhirBundle(json: unknown): FhirImportResult {
  const errors: string[] = [];
  const persons: PersonData[] = [];

  if (
    !json ||
    typeof json !== 'object' ||
    (json as Record<string, unknown>).resourceType !== 'Bundle'
  ) {
    return { persons: [], errors: ['有効なFHIR Bundleではありません'] };
  }

  const bundle = json as Record<string, unknown>;
  const entries = (bundle.entry as Array<Record<string, unknown>>) || [];

  for (const entry of entries) {
    const resource = entry.resource as Record<string, unknown> | undefined;
    if (
      !resource ||
      resource.resourceType !== 'FamilyMemberHistory'
    )
      continue;

    try {
      // 性別
      const sexCoding = (
        resource.sex as Record<string, unknown> | undefined
      )?.coding as Array<Record<string, string>> | undefined;
      const genderCode = sexCoding?.[0]?.code;
      let gender: 'male' | 'female' | 'other' = 'other';
      if (genderCode === 'male') gender = 'male';
      if (genderCode === 'female') gender = 'female';

      // 既往歴
      const conditions = (
        resource.condition as Array<Record<string, unknown>> | undefined
      ) || [];
      const medicalHistory = conditions
        .map((c) => (c.code as Record<string, string> | undefined)?.text)
        .filter(Boolean)
        .join('、');

      // 続柄
      const relationship = resource.relationship as
        | Record<string, unknown>
        | undefined;
      const relCoding = (
        relationship?.coding as Array<Record<string, string>> | undefined
      );
      const relCode = relCoding?.[0]?.code || '';
      const relText = (relationship?.text as string) || '';
      const relJa = REVERSE_ROLE_CODES[relCode] || relText || 'その他';
      const rel: Relationship = REL_MAP[relJa] || 'other';

      // 死亡情報
      const deceasedDate = (resource.deceasedDate as string) || undefined;
      const deceasedBoolean = resource.deceasedBoolean as boolean | undefined;
      const lifeStatus =
        deceasedDate || deceasedBoolean ? ('deceased' as const) : ('alive' as const);

      // 備考
      const notes = (
        resource.note as Array<Record<string, string>> | undefined
      );
      const noteText = notes?.[0]?.text || undefined;

      const id =
        (resource.id as string) ||
        `fmh-${Math.random().toString(36).slice(2)}`;

      persons.push({
        id,
        name: (resource.name as string) || '（名前未入力）',
        gender,
        lifeStatus,
        relationship: rel,
        birthDate: (resource.bornDate as string) || undefined,
        deathDate: deceasedDate,
        medicalHistory: medicalHistory || undefined,
        notes: noteText,
        isRepresentative: false,
      });
    } catch {
      errors.push(
        `FHIRリソースのパースに失敗: ${(resource.id as string) || '不明'}`
      );
    }
  }

  return { persons, errors };
}
