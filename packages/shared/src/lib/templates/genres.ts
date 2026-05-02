import type { GameGenre, TemplateCategory } from './types';

// Genre definitions with i18n keys
export const gameGenres: GameGenre[] = [
  { id: 'rpg', nameKey: 'templates.genres.rpg', descKey: 'templates.genres.rpgDesc', name: 'RPG', description: 'MMORPG, ARPG, JRPG, turn-based, etc.' },
  { id: 'action', nameKey: 'templates.genres.action', descKey: 'templates.genres.actionDesc', name: 'Action', description: 'Action, Fighting, Hack & Slash' },
  { id: 'fps', nameKey: 'templates.genres.fps', descKey: 'templates.genres.fpsDesc', name: 'FPS/TPS', description: 'Shooting games' },
  { id: 'strategy', nameKey: 'templates.genres.strategy', descKey: 'templates.genres.strategyDesc', name: 'Strategy', description: 'RTS, Turn-based Strategy, Tower Defense' },
  { id: 'idle', nameKey: 'templates.genres.idle', descKey: 'templates.genres.idleDesc', name: 'Idle', description: 'Idle, Clicker, Incremental' },
  { id: 'roguelike', nameKey: 'templates.genres.roguelike', descKey: 'templates.genres.roguelikeDesc', name: 'Roguelike', description: 'Roguelike, Roguelite' },
  { id: 'moba', nameKey: 'templates.genres.moba', descKey: 'templates.genres.mobaDesc', name: 'MOBA/AOS', description: 'Multiplayer Battle' },
  { id: 'card', nameKey: 'templates.genres.card', descKey: 'templates.genres.cardDesc', name: 'Card/Deckbuilding', description: 'CCG, Deckbuilder' },
  { id: 'puzzle', nameKey: 'templates.genres.puzzle', descKey: 'templates.genres.puzzleDesc', name: 'Puzzle', description: 'Puzzle, Match-3' },
  { id: 'simulation', nameKey: 'templates.genres.simulation', descKey: 'templates.genres.simulationDesc', name: 'Simulation', description: 'Management, Training, Tycoon' },
];

// Category definitions with i18n keys
export const templateCategories: TemplateCategory[] = [
  { id: 'config', nameKey: 'templates.categories.config', name: 'Config', icon: '' },
  { id: 'character', nameKey: 'templates.categories.character', name: 'Character', icon: '' },
  { id: 'equipment', nameKey: 'templates.categories.equipment', name: 'Equipment', icon: '' },
  { id: 'skill', nameKey: 'templates.categories.skill', name: 'Skill', icon: '' },
  { id: 'enemy', nameKey: 'templates.categories.enemy', name: 'Enemy/Monster', icon: '' },
  { id: 'unit', nameKey: 'templates.categories.unit', name: 'Unit', icon: '' },
  { id: 'item', nameKey: 'templates.categories.item', name: 'Item', icon: '' },
  { id: 'card', nameKey: 'templates.categories.card', name: 'Card', icon: '' },
  { id: 'stage', nameKey: 'templates.categories.stage', name: 'Stage', icon: '' },
  { id: 'progression', nameKey: 'templates.categories.progression', name: 'Progression', icon: '' },
  { id: 'economy', nameKey: 'templates.categories.economy', name: 'Economy', icon: '' },
  { id: 'gacha', nameKey: 'templates.categories.gacha', name: 'Gacha', icon: '' },
  { id: 'reward', nameKey: 'templates.categories.reward', name: 'Reward', icon: '' },
  { id: 'analysis', nameKey: 'templates.categories.analysis', name: 'Analysis', icon: '' },
];
