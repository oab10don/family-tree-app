import { PersonData, relationshipLabels } from '@/types/familyTree';

/** FHIR FamilyMemberHistory リソース */
interface FhirFamilyMemberHistory {
  resourceType: 'FamilyMemberHistory';
  id: string;
  status: 'completed' | 'partial';
  patient: {
    reference: string;
    display: string;
  };
  date: string;
  name: string;
  relationship: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
    text: string;
  };
  sex?: {
    coding: Array<{
      system: string;
      code: string;
      display: string;
    }>;
  };
  bornDate?: string;
  deceasedBoolean?: boolean;
  deceasedDate?: string;
  condition?: Array<{
    code: {
      text: string;
    };
  }>;
  note?: Array<{
    text: string;
  }>;
}

/** HL7 v3-RoleCode マッピング */
const RELATIONSHIP_CODES: Record<string, { code: string; display: string }> = {
  '本人': { code: 'ONESELF', display: 'self' },
  '配偶者': { code: 'SPS', display: 'spouse' },
  '父': { code: 'FTH', display: 'father' },
  '母': { code: 'MTH', display: 'mother' },
  '長男': { code: 'SON', display: 'son' },
  '長女': { code: 'DAU', display: 'daughter' },
  '次男': { code: 'SON', display: 'son' },
  '次女': { code: 'DAU', display: 'daughter' },
  '三男': { code: 'SON', display: 'son' },
  '三女': { code: 'DAU', display: 'daughter' },
  '孫': { code: 'GRNDCHILD', display: 'grandchild' },
  'その他': { code: 'FAMMEMB', display: 'family member' },
};

/**
 * PersonData配列をFHIR R4 FamilyMemberHistory Bundleに変換する
 * @param persons 全人物データ
 * @param patientPerson 代表者（本人）
 */
export function exportToFhir(
  persons: PersonData[],
  patientPerson: PersonData
): object {
  const now = new Date().toISOString();

  const entries = persons
    .filter((p) => p.id !== patientPerson.id)
    .map((person) => {
      const relLabel = relationshipLabels[person.relationship] ?? 'その他';
      const relCode = RELATIONSHIP_CODES[relLabel] || {
        code: 'FAMMEMB',
        display: 'family member',
      };

      const resource: FhirFamilyMemberHistory = {
        resourceType: 'FamilyMemberHistory',
        id: `fmh-${person.id}`,
        status: 'completed',
        patient: {
          reference: `Patient/${patientPerson.id}`,
          display: patientPerson.name,
        },
        date: now,
        name: person.name,
        relationship: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode',
              code: relCode.code,
              display: relCode.display,
            },
          ],
          text: relLabel,
        },
      };

      // 性別
      if (person.gender) {
        resource.sex = {
          coding: [
            {
              system: 'http://hl7.org/fhir/administrative-gender',
              code: person.gender,
              display:
                person.gender === 'male'
                  ? 'Male'
                  : person.gender === 'female'
                    ? 'Female'
                    : 'Other',
            },
          ],
        };
      }

      // 生年月日
      if (person.birthDate) {
        resource.bornDate = person.birthDate;
      }

      // 死亡情報
      if (person.deathDate) {
        resource.deceasedDate = person.deathDate;
        resource.deceasedBoolean = true;
      } else if (person.lifeStatus === 'deceased') {
        resource.deceasedBoolean = true;
      }

      // 既往歴 → condition（スラッシュ or 読点で分割）
      if (person.medicalHistory) {
        const conditions = person.medicalHistory
          .split(/[/、]/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (conditions.length > 0) {
          resource.condition = conditions.map((c) => ({
            code: { text: c },
          }));
        }
      }

      // 備考
      if (person.notes) {
        resource.note = [{ text: person.notes }];
      }

      return {
        fullUrl: `urn:uuid:${person.id}`,
        resource,
      };
    });

  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: now,
    entry: entries,
  };
}

/** FHIR BundleをJSONとしてダウンロード */
export function downloadFhir(
  persons: PersonData[],
  patientPerson: PersonData,
  filename?: string
): void {
  const bundle = exportToFhir(persons, patientPerson);
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/fhir+json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    filename ||
    `家族歴_FHIR_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
