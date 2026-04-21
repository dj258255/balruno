/**
 * 엔진 export v2 스모크 테스트.
 */

import { describe, it, expect } from 'vitest';
import type { Sheet } from '@/types';
import {
  generateUnityScriptableObject,
  generateUnityEditorImporter,
  generateUnityJson,
  generateUnrealDataTable,
  generateUnrealEnums,
  generateGodotResource,
  generateGodotTres,
  generateBevyRust,
  generateTypeScript,
  exportForGameEngine,
  EXPORT_FORMATS,
} from './gameEngineExport';

function makeSheet(): Sheet {
  return {
    id: 's1',
    name: 'Characters',
    createdAt: 0,
    updatedAt: 0,
    columns: [
      { id: 'c1', name: 'Id', type: 'general', width: 80 },
      { id: 'c2', name: 'Class', type: 'select', width: 100, selectOptions: [
        { id: 'w', label: 'Warrior', color: '#f00' },
        { id: 'm', label: 'Mage', color: '#00f' },
      ] },
      { id: 'c3', name: 'HP', type: 'general', width: 80 },
      { id: 'c4', name: 'IsHero', type: 'checkbox', width: 80 },
    ],
    rows: [
      { id: 'r1', cells: { c1: 'u001', c2: 'w', c3: 1000, c4: 'true' } },
      { id: 'r2', cells: { c1: 'u002', c2: 'm', c3: 700, c4: 'false' } },
    ],
  };
}

describe('Engine Export v2', () => {
  const sheet = makeSheet();

  it('Unity ScriptableObject 생성', () => {
    const code = generateUnityScriptableObject(sheet);
    expect(code).toContain('ScriptableObject');
    expect(code).toContain('[CreateAssetMenu');
    expect(code).toContain('List<');
  });

  it('Unity Editor Importer 생성', () => {
    const code = generateUnityEditorImporter(sheet);
    expect(code).toContain('#if UNITY_EDITOR');
    expect(code).toContain('MenuItem');
    expect(code).toContain('OpenFilePanel');
  });

  it('Unity JSON valid', () => {
    const json = generateUnityJson(sheet);
    const parsed = JSON.parse(json);
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].id).toBe('u001');
  });

  it('Unreal DataTable header', () => {
    const code = generateUnrealDataTable(sheet);
    expect(code).toContain('USTRUCT');
    expect(code).toContain('FTableRowBase');
  });

  it('Unreal Enums (select columns)', () => {
    const code = generateUnrealEnums(sheet);
    expect(code).toContain('UENUM');
    expect(code).toContain('Warrior');
    expect(code).toContain('Mage');
  });

  it('Godot GDScript Resource', () => {
    const code = generateGodotResource(sheet);
    expect(code).toContain('extends Resource');
    expect(code).toContain('class Item');
  });

  it('Godot .tres 파일 — 실제 데이터 베이킹', () => {
    const tres = generateGodotTres(sheet);
    expect(tres).toContain('[gd_resource');
    expect(tres).toContain('[sub_resource');
    // 두 행이 sub_resource 로 변환
    expect(tres.match(/\[sub_resource/g)?.length).toBe(2);
  });

  it('Bevy Rust struct + serde', () => {
    const code = generateBevyRust(sheet);
    expect(code).toContain('#[derive(Component');
    expect(code).toContain('use serde::');
    expect(code).toContain('from_json');
    expect(code).toContain('get_by_id');
  });

  it('TypeScript interface', () => {
    const code = generateTypeScript(sheet);
    expect(code).toContain('export interface');
    expect(code).toContain('load');
    expect(code).toContain(': number'); // HP
    expect(code).toContain("'w' | 'm'"); // select literal union
  });

  it('exportForGameEngine 모든 포맷 작동', () => {
    for (const f of EXPORT_FORMATS) {
      const out = exportForGameEngine(sheet, f.id);
      expect(out.length).toBeGreaterThan(0);
      expect(out[0].filename).toBeTruthy();
      expect(out[0].content).toBeTruthy();
    }
  });
});
