/**
 * 장르별 완성 템플릿 — 실제 업계 표준 시트 구조를 참고한 프리셋.
 * FPS / MOBA / Strategy / Idle / Roguelike 5개 장르.
 *
 * 각 프로젝트는 3-5개 시트로 구성되어 해당 장르의 밸런싱 핵심 개념을 커버한다.
 */

import { newId } from '@/lib/uuid';
import type { Project } from '@/types';

type TranslateFunction = (key: string) => string;
const id = () => newId();

// ============================================
// 1. FPS — 무기/적/매치 밸런싱
// ============================================
const createFPSProject = (_t: TranslateFunction): Project => {
  const now = Date.now();
  return {
    id: id(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: id(),
        name: 'Weapons',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Weapon', type: 'general', width: 140 },
          { id: 'c2', name: 'Class', type: 'select', width: 100, selectOptions: [
            { id: 'ar', label: 'AR', color: '#ef4444' },
            { id: 'smg', label: 'SMG', color: '#f59e0b' },
            { id: 'sr', label: 'Sniper', color: '#8b5cf6' },
            { id: 'sg', label: 'Shotgun', color: '#06b6d4' },
            { id: 'lmg', label: 'LMG', color: '#84cc16' },
          ]},
          { id: 'c3', name: 'BodyDmg', type: 'general', width: 90 },
          { id: 'c4', name: 'HeadMul', type: 'general', width: 80 },
          { id: 'c5', name: 'RPM', type: 'general', width: 80 },
          { id: 'c6', name: 'MagSize', type: 'general', width: 80 },
          { id: 'c7', name: 'Recoil', type: 'rating', width: 100 },
          { id: 'c8', name: 'DPS', type: 'formula', width: 100, formula: '=c3*(c5/60)' },
          { id: 'c9', name: 'TTK100HP', type: 'formula', width: 110, formula: '=TTK(100,c3,c5/60)' },
          { id: 'c10', name: 'HS_DPS', type: 'formula', width: 110, formula: '=c3*c4*(c5/60)' },
        ],
        rows: [
          { id: id(), cells: { c1: 'M4A1', c2: 'ar', c3: 22, c4: 1.5, c5: 750, c6: 30, c7: 3 } },
          { id: id(), cells: { c1: 'AK-47', c2: 'ar', c3: 28, c4: 1.8, c5: 600, c6: 30, c7: 4 } },
          { id: id(), cells: { c1: 'MP7', c2: 'smg', c3: 18, c4: 1.4, c5: 900, c6: 40, c7: 2 } },
          { id: id(), cells: { c1: 'AWP', c2: 'sr', c3: 115, c4: 2.0, c5: 40, c6: 10, c7: 5 } },
          { id: id(), cells: { c1: 'M870', c2: 'sg', c3: 70, c4: 1.2, c5: 60, c6: 7, c7: 4 } },
          { id: id(), cells: { c1: 'M249', c2: 'lmg', c3: 30, c4: 1.3, c5: 700, c6: 100, c7: 5 } },
        ],
      },
      {
        id: id(),
        name: 'Enemies',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Type', type: 'general', width: 120 },
          { id: 'c2', name: 'HP', type: 'general', width: 80 },
          { id: 'c3', name: 'Armor', type: 'general', width: 80 },
          { id: 'c4', name: 'Speed', type: 'general', width: 80 },
          { id: 'c5', name: 'Damage', type: 'general', width: 80 },
          { id: 'c6', name: 'EHP', type: 'formula', width: 100, formula: '=EHP(c2,c3)' },
          { id: 'c7', name: 'Tier', type: 'select', width: 100, selectOptions: [
            { id: 't1', label: 'T1 Grunt', color: '#94a3b8' },
            { id: 't2', label: 'T2 Elite', color: '#f59e0b' },
            { id: 't3', label: 'T3 Boss', color: '#ef4444' },
          ]},
        ],
        rows: [
          { id: id(), cells: { c1: 'Rusher', c2: 80, c3: 0, c4: 6, c5: 15, c7: 't1' } },
          { id: id(), cells: { c1: 'Tank', c2: 250, c3: 50, c4: 3, c5: 25, c7: 't2' } },
          { id: id(), cells: { c1: 'Sniper AI', c2: 120, c3: 20, c4: 4, c5: 60, c7: 't2' } },
          { id: id(), cells: { c1: 'Berserker', c2: 500, c3: 30, c4: 5, c5: 40, c7: 't3' } },
        ],
      },
      {
        id: id(),
        name: 'Attachments',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Attachment', type: 'general', width: 160 },
          { id: 'c2', name: 'Slot', type: 'select', width: 110, selectOptions: [
            { id: 'scope', label: 'Scope', color: '#8b5cf6' },
            { id: 'barrel', label: 'Barrel', color: '#f59e0b' },
            { id: 'mag', label: 'Magazine', color: '#10b981' },
            { id: 'grip', label: 'Grip', color: '#06b6d4' },
          ]},
          { id: 'c3', name: 'DmgMult', type: 'general', width: 100 },
          { id: 'c4', name: 'RecoilRed', type: 'general', width: 110 },
          { id: 'c5', name: 'MagMult', type: 'general', width: 100 },
        ],
        rows: [
          { id: id(), cells: { c1: 'Red Dot', c2: 'scope', c3: 1.0, c4: 0, c5: 1 } },
          { id: id(), cells: { c1: '4x Scope', c2: 'scope', c3: 1.1, c4: -0.1, c5: 1 } },
          { id: id(), cells: { c1: 'Suppressor', c2: 'barrel', c3: 0.95, c4: 0.15, c5: 1 } },
          { id: id(), cells: { c1: 'Ext. Mag', c2: 'mag', c3: 1.0, c4: -0.05, c5: 1.5 } },
        ],
      },
    ],
  };
};

// ============================================
// 2. MOBA — 챔피언/아이템/팀파이트
// ============================================
const createMOBAProject = (_t: TranslateFunction): Project => {
  const now = Date.now();
  return {
    id: id(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: id(),
        name: 'Champions',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Champion', type: 'general', width: 140 },
          { id: 'c2', name: 'Role', type: 'select', width: 110, selectOptions: [
            { id: 'top', label: 'Top', color: '#ef4444' },
            { id: 'jg', label: 'Jungle', color: '#10b981' },
            { id: 'mid', label: 'Mid', color: '#f59e0b' },
            { id: 'adc', label: 'ADC', color: '#8b5cf6' },
            { id: 'sup', label: 'Support', color: '#06b6d4' },
          ]},
          { id: 'c3', name: 'HP', type: 'general', width: 80 },
          { id: 'c4', name: 'HP/lvl', type: 'general', width: 80 },
          { id: 'c5', name: 'AD', type: 'general', width: 70 },
          { id: 'c6', name: 'AD/lvl', type: 'general', width: 80 },
          { id: 'c7', name: 'AS', type: 'general', width: 70 },
          { id: 'c8', name: 'Armor', type: 'general', width: 80 },
          { id: 'c9', name: 'HP@18', type: 'formula', width: 100, formula: '=SCALE(c3,17,c4,"linear")' },
          { id: 'c10', name: 'AD@18', type: 'formula', width: 100, formula: '=SCALE(c5,17,c6,"linear")' },
          { id: 'c11', name: 'EHP@18', type: 'formula', width: 110, formula: '=EHP(SCALE(c3,17,c4,"linear"),c8)' },
        ],
        rows: [
          { id: id(), cells: { c1: 'Warrior', c2: 'top', c3: 600, c4: 95, c5: 65, c6: 3.5, c7: 0.65, c8: 34 } },
          { id: id(), cells: { c1: 'Assassin', c2: 'jg', c3: 570, c4: 85, c5: 62, c6: 3.2, c7: 0.68, c8: 30 } },
          { id: id(), cells: { c1: 'Mage', c2: 'mid', c3: 540, c4: 80, c5: 55, c6: 3.0, c7: 0.65, c8: 22 } },
          { id: id(), cells: { c1: 'Marksman', c2: 'adc', c3: 530, c4: 85, c5: 58, c6: 3.0, c7: 0.66, c8: 22 } },
          { id: id(), cells: { c1: 'Enchanter', c2: 'sup', c3: 480, c4: 80, c5: 50, c6: 2.8, c7: 0.6, c8: 20 } },
        ],
      },
      {
        id: id(),
        name: 'Items',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Item', type: 'general', width: 160 },
          { id: 'c2', name: 'Tier', type: 'select', width: 100, selectOptions: [
            { id: 'starter', label: 'Starter', color: '#94a3b8' },
            { id: 'core', label: 'Core', color: '#3b82f6' },
            { id: 'legendary', label: 'Legendary', color: '#8b5cf6' },
            { id: 'mythic', label: 'Mythic', color: '#f59e0b' },
          ]},
          { id: 'c3', name: 'Cost', type: 'currency', width: 90 },
          { id: 'c4', name: 'AD', type: 'general', width: 70 },
          { id: 'c5', name: 'AP', type: 'general', width: 70 },
          { id: 'c6', name: 'Armor', type: 'general', width: 80 },
          { id: 'c7', name: 'HP', type: 'general', width: 70 },
          { id: 'c8', name: 'GoldEff', type: 'formula', width: 110, formula: '=(c4*35+c5*20+c6*20+c7*2.67)/c3' },
        ],
        rows: [
          { id: id(), cells: { c1: "Doran's Blade", c2: 'starter', c3: 450, c4: 8, c5: 0, c6: 0, c7: 80 } },
          { id: id(), cells: { c1: 'B.F. Sword', c2: 'core', c3: 1300, c4: 40, c5: 0, c6: 0, c7: 0 } },
          { id: id(), cells: { c1: 'Infinity Edge', c2: 'legendary', c3: 3400, c4: 70, c5: 0, c6: 0, c7: 0 } },
          { id: id(), cells: { c1: 'Eclipse', c2: 'mythic', c3: 3200, c4: 60, c5: 0, c6: 20, c7: 0 } },
        ],
      },
    ],
  };
};

// ============================================
// 3. Strategy — 유닛/자원/테크트리
// ============================================
const createStrategyProject = (_t: TranslateFunction): Project => {
  const now = Date.now();
  return {
    id: id(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: id(),
        name: 'Units',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Unit', type: 'general', width: 140 },
          { id: 'c2', name: 'Faction', type: 'select', width: 100, selectOptions: [
            { id: 'human', label: 'Human', color: '#3b82f6' },
            { id: 'orc', label: 'Orc', color: '#ef4444' },
            { id: 'elf', label: 'Elf', color: '#10b981' },
          ]},
          { id: 'c3', name: 'Food', type: 'general', width: 70 },
          { id: 'c4', name: 'Gold', type: 'currency', width: 80 },
          { id: 'c5', name: 'Wood', type: 'general', width: 70 },
          { id: 'c6', name: 'BuildTime', type: 'general', width: 100 },
          { id: 'c7', name: 'HP', type: 'general', width: 70 },
          { id: 'c8', name: 'Attack', type: 'general', width: 80 },
          { id: 'c9', name: 'Armor', type: 'general', width: 80 },
          { id: 'c10', name: 'ResourceEff', type: 'formula', width: 120, formula: '=(c7+c8*10)/(c4+c5)' },
        ],
        rows: [
          { id: id(), cells: { c1: 'Footman', c2: 'human', c3: 2, c4: 135, c5: 0, c6: 20, c7: 420, c8: 12, c9: 2 } },
          { id: id(), cells: { c1: 'Knight', c2: 'human', c3: 4, c4: 245, c5: 60, c6: 45, c7: 835, c8: 25, c9: 5 } },
          { id: id(), cells: { c1: 'Grunt', c2: 'orc', c3: 3, c4: 200, c5: 0, c6: 25, c7: 700, c8: 18, c9: 1 } },
          { id: id(), cells: { c1: 'Raider', c2: 'orc', c3: 3, c4: 180, c5: 40, c6: 30, c7: 570, c8: 16, c9: 2 } },
          { id: id(), cells: { c1: 'Archer', c2: 'elf', c3: 2, c4: 130, c5: 10, c6: 18, c7: 245, c8: 16, c9: 0 } },
        ],
      },
      {
        id: id(),
        name: 'Tech Tree',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Research', type: 'general', width: 180 },
          { id: 'c2', name: 'Age', type: 'select', width: 110, selectOptions: [
            { id: 'age1', label: 'Age I', color: '#94a3b8' },
            { id: 'age2', label: 'Age II', color: '#3b82f6' },
            { id: 'age3', label: 'Age III', color: '#8b5cf6' },
            { id: 'age4', label: 'Age IV', color: '#f59e0b' },
          ]},
          { id: 'c3', name: 'Gold', type: 'currency', width: 90 },
          { id: 'c4', name: 'Wood', type: 'general', width: 80 },
          { id: 'c5', name: 'Time', type: 'general', width: 80 },
          { id: 'c6', name: 'Effect', type: 'general', width: 200 },
        ],
        rows: [
          { id: id(), cells: { c1: 'Iron Forging', c2: 'age2', c3: 150, c4: 0, c5: 60, c6: '+2 melee attack' } },
          { id: id(), cells: { c1: 'Masonry', c2: 'age2', c3: 100, c4: 50, c5: 45, c6: '+20% building HP' } },
          { id: id(), cells: { c1: 'Cavalry Tactics', c2: 'age3', c3: 300, c4: 100, c5: 90, c6: '+15% cavalry speed' } },
        ],
      },
      {
        id: id(),
        name: 'Economy',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Resource', type: 'general', width: 120 },
          { id: 'c2', name: 'BaseRate', type: 'general', width: 100 },
          { id: 'c3', name: 'MaxWorkers', type: 'general', width: 110 },
          { id: 'c4', name: 'DepletionRate', type: 'general', width: 120 },
          { id: 'c5', name: 'TotalYield', type: 'formula', width: 110, formula: '=c2*c3*(1/c4)' },
        ],
        rows: [
          { id: id(), cells: { c1: 'Gold Mine', c2: 8, c3: 5, c4: 0.02 } },
          { id: id(), cells: { c1: 'Forest', c2: 10, c3: 10, c4: 0.01 } },
          { id: id(), cells: { c1: 'Farm', c2: 6, c3: 4, c4: 0 } },
        ],
      },
    ],
  };
};

// ============================================
// 4. Idle — 프레스티지/수익곡선
// ============================================
const createIdleProject = (_t: TranslateFunction): Project => {
  const now = Date.now();
  return {
    id: id(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: id(),
        name: 'Generators',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Generator', type: 'general', width: 160 },
          { id: 'c2', name: 'BaseIncome', type: 'currency', width: 110 },
          { id: 'c3', name: 'BaseCost', type: 'currency', width: 100 },
          { id: 'c4', name: 'CostGrowth', type: 'general', width: 110 },
          { id: 'c5', name: 'MilestoneLv', type: 'general', width: 120 },
          { id: 'c6', name: 'Cost@Lv10', type: 'formula', width: 120, formula: '=COST(c3,10,c4,"exponential")' },
          { id: 'c7', name: 'Cost@Lv100', type: 'formula', width: 130, formula: '=COST(c3,100,c4,"exponential")' },
          { id: 'c8', name: 'Income@Lv100', type: 'formula', width: 140, formula: '=c2*100*POWER(2,FLOOR(100/c5))' },
        ],
        rows: [
          { id: id(), cells: { c1: 'Lemonade Stand', c2: 1, c3: 4, c4: 1.07, c5: 25 } },
          { id: id(), cells: { c1: 'Newspaper Route', c2: 60, c3: 60, c4: 1.15, c5: 25 } },
          { id: id(), cells: { c1: 'Car Wash', c2: 540, c3: 720, c4: 1.14, c5: 25 } },
          { id: id(), cells: { c1: 'Pizza Delivery', c2: 4320, c3: 8640, c4: 1.13, c5: 25 } },
          { id: id(), cells: { c1: 'Donut Shop', c2: 51840, c3: 103680, c4: 1.12, c5: 25 } },
        ],
      },
      {
        id: id(),
        name: 'Prestige',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'PrestigeLv', type: 'general', width: 110 },
          { id: 'c2', name: 'BaseXP', type: 'general', width: 100 },
          { id: 'c3', name: 'XPRequired', type: 'formula', width: 120, formula: '=SCALE(c2,c1,1.5,"exponential")' },
          { id: 'c4', name: 'Multiplier', type: 'formula', width: 110, formula: '=1+c1*0.25' },
          { id: 'c5', name: 'UnlockFeature', type: 'general', width: 200 },
        ],
        rows: [
          { id: id(), cells: { c1: 1, c2: 1000, c5: 'Offline income' } },
          { id: id(), cells: { c1: 2, c2: 1000, c5: 'Auto-click' } },
          { id: id(), cells: { c1: 5, c2: 1000, c5: '2x gold' } },
          { id: id(), cells: { c1: 10, c2: 1000, c5: 'Prestige coins' } },
          { id: id(), cells: { c1: 25, c2: 1000, c5: 'Golden clicks' } },
        ],
      },
      {
        id: id(),
        name: 'LiveOps',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Day', type: 'general', width: 80 },
          { id: 'c2', name: 'DAU', type: 'general', width: 90 },
          { id: 'c3', name: 'Revenue', type: 'currency', width: 110 },
          { id: 'c4', name: 'ARPDAU', type: 'formula', width: 100, formula: '=ARPDAU(c3,c2)' },
          { id: 'c5', name: 'RetentionP', type: 'formula', width: 120, formula: '=COHORT_RETENTION(0.45,c1,0.6)' },
        ],
        rows: [
          { id: id(), cells: { c1: 1, c2: 10000, c3: 800 } },
          { id: id(), cells: { c1: 7, c2: 3200, c3: 420 } },
          { id: id(), cells: { c1: 30, c2: 950, c3: 210 } },
        ],
      },
    ],
  };
};

// ============================================
// 5. Roguelike — 룬/아이템/층 밸런싱
// ============================================
const createRoguelikeProject = (_t: TranslateFunction): Project => {
  const now = Date.now();
  return {
    id: id(),
    name: '',
    description: '',
    createdAt: now,
    updatedAt: now,
    sheets: [
      {
        id: id(),
        name: 'Relics',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Relic', type: 'general', width: 160 },
          { id: 'c2', name: 'Rarity', type: 'select', width: 110, selectOptions: [
            { id: 'common', label: 'Common', color: '#94a3b8' },
            { id: 'uncommon', label: 'Uncommon', color: '#3b82f6' },
            { id: 'rare', label: 'Rare', color: '#8b5cf6' },
            { id: 'boss', label: 'Boss', color: '#f59e0b' },
          ]},
          { id: 'c3', name: 'DropWeight', type: 'general', width: 110 },
          { id: 'c4', name: 'DmgMod', type: 'general', width: 90 },
          { id: 'c5', name: 'DefMod', type: 'general', width: 90 },
          { id: 'c6', name: 'SpecialEffect', type: 'general', width: 220 },
          { id: 'c7', name: 'PowerScore', type: 'formula', width: 110, formula: '=c4*10+c5*8' },
        ],
        rows: [
          { id: id(), cells: { c1: 'Burning Blood', c2: 'boss', c3: 5, c4: 0, c5: 6, c6: 'Heal 6 HP after boss' } },
          { id: id(), cells: { c1: 'Akabeko', c2: 'common', c3: 30, c4: 8, c5: 0, c6: '+8 damage first attack' } },
          { id: id(), cells: { c1: 'Frozen Egg 2', c2: 'rare', c3: 10, c4: 2, c5: 1, c6: 'Power upgrades cost 0 energy' } },
          { id: id(), cells: { c1: 'Black Blood', c2: 'boss', c3: 4, c4: 0, c5: 12, c6: 'Heal 12 HP after boss (replaces Burning Blood)' } },
        ],
      },
      {
        id: id(),
        name: 'Floors',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'Floor', type: 'general', width: 80 },
          { id: 'c2', name: 'EncType', type: 'select', width: 120, selectOptions: [
            { id: 'combat', label: 'Combat', color: '#ef4444' },
            { id: 'elite', label: 'Elite', color: '#8b5cf6' },
            { id: 'event', label: 'Event', color: '#06b6d4' },
            { id: 'shop', label: 'Shop', color: '#10b981' },
            { id: 'boss', label: 'Boss', color: '#f59e0b' },
          ]},
          { id: 'c3', name: 'EnemyHP', type: 'general', width: 100 },
          { id: 'c4', name: 'EnemyDmg', type: 'general', width: 110 },
          { id: 'c5', name: 'GoldReward', type: 'currency', width: 110 },
          { id: 'c6', name: 'ScaledHP', type: 'formula', width: 110, formula: '=WAVE_POWER(c3,c1,1.1)' },
          { id: 'c7', name: 'ExpectedDmg', type: 'formula', width: 130, formula: '=c4*(1+c1*0.05)' },
        ],
        rows: [
          { id: id(), cells: { c1: 1, c2: 'combat', c3: 48, c4: 8, c5: 15 } },
          { id: id(), cells: { c1: 6, c2: 'elite', c3: 100, c4: 18, c5: 35 } },
          { id: id(), cells: { c1: 12, c2: 'boss', c3: 250, c4: 30, c5: 100 } },
          { id: id(), cells: { c1: 18, c2: 'shop', c3: 0, c4: 0, c5: 0 } },
          { id: id(), cells: { c1: 25, c2: 'boss', c3: 500, c4: 45, c5: 200 } },
        ],
      },
      {
        id: id(),
        name: 'Runs',
        createdAt: now,
        updatedAt: now,
        columns: [
          { id: 'c1', name: 'RunID', type: 'general', width: 90 },
          { id: 'c2', name: 'Class', type: 'select', width: 110, selectOptions: [
            { id: 'ironclad', label: 'Ironclad', color: '#ef4444' },
            { id: 'silent', label: 'Silent', color: '#10b981' },
            { id: 'defect', label: 'Defect', color: '#3b82f6' },
            { id: 'watcher', label: 'Watcher', color: '#8b5cf6' },
          ]},
          { id: 'c3', name: 'AscLevel', type: 'general', width: 110 },
          { id: 'c4', name: 'FloorsCleared', type: 'general', width: 130 },
          { id: 'c5', name: 'Victory', type: 'checkbox', width: 100 },
          { id: 'c6', name: 'PlaytimeMin', type: 'general', width: 120 },
        ],
        rows: [
          { id: id(), cells: { c1: 'R-001', c2: 'ironclad', c3: 0, c4: 51, c5: 'true', c6: 85 } },
          { id: id(), cells: { c1: 'R-002', c2: 'silent', c3: 5, c4: 42, c5: 'false', c6: 65 } },
          { id: id(), cells: { c1: 'R-003', c2: 'defect', c3: 10, c4: 38, c5: 'false', c6: 60 } },
        ],
      },
    ],
  };
};

// ============================================
// Export — 장르 샘플 목록
// ============================================
export const GENRE_SAMPLES = [
  {
    id: 'fps-arena',
    nameKey: 'samples.fpsArena.name',
    descriptionKey: 'samples.fpsArena.description',
    icon: 'Crosshair',
    category: 'combat' as const,
    createProject: createFPSProject,
  },
  {
    id: 'moba-draft',
    nameKey: 'samples.moba.name',
    descriptionKey: 'samples.moba.description',
    icon: 'Zap',
    category: 'combat' as const,
    createProject: createMOBAProject,
  },
  {
    id: 'strategy-4x',
    nameKey: 'samples.strategy.name',
    descriptionKey: 'samples.strategy.description',
    icon: 'Castle',
    category: 'economy' as const,
    createProject: createStrategyProject,
  },
  {
    id: 'idle-clicker',
    nameKey: 'samples.idle.name',
    descriptionKey: 'samples.idle.description',
    icon: 'Coins',
    category: 'economy' as const,
    createProject: createIdleProject,
  },
  {
    id: 'roguelike-deckbuilder',
    nameKey: 'samples.roguelike.name',
    descriptionKey: 'samples.roguelike.description',
    icon: 'Dices',
    category: 'progression' as const,
    createProject: createRoguelikeProject,
  },
];
