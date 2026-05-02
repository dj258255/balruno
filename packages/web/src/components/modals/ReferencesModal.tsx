'use client';

import { X, BookOpen, ExternalLink, Lightbulb, Calculator, TrendingUp, Coins, Sparkles, Gamepad2, AlertTriangle, CheckCircle, Swords, RotateCcw } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useTranslations } from 'next-intl';

interface ReferencesModalProps {
  onClose: () => void;
}

interface GuidelineItem {
  label: string;
  value: string;
  status: 'good' | 'warning' | 'info';
}

interface ReferenceItem {
  title: string;
  description: string;
  url: string | null;
  guidelines?: GuidelineItem[];
}

interface ReferenceCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: ReferenceItem[];
}

export default function ReferencesModal({ onClose }: ReferencesModalProps) {
  const t = useTranslations('references');
  const tCommon = useTranslations('common');

  // ESC 키로 모달 닫기
  useEscapeKey(onClose);

  const referenceCategories: ReferenceCategory[] = [
    {
      id: 'theory',
      name: t('categories.theory'),
      icon: Lightbulb,
      color: 'bg-purple-100 text-purple-700',
      items: [
        {
          title: t('theory.flowTitle'),
          description: t('theory.flowDesc'),
          url: 'https://en.wikipedia.org/wiki/Flow_(psychology)',
          guidelines: [
            { label: t('theory.flowDifficultyRate'), value: t('theory.flowDifficultyValue'), status: 'good' },
            { label: t('theory.flowFailCount'), value: t('theory.flowFailValue'), status: 'good' },
            { label: t('theory.flowWarning'), value: t('theory.flowWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('theory.schreiberTitle'),
          description: t('theory.schreiberDesc'),
          url: 'https://gamebalanceconcepts.wordpress.com/',
        },
        {
          title: t('theory.mdaTitle'),
          description: t('theory.mdaDesc'),
          url: 'https://users.cs.northwestern.edu/~hunicke/MDA.pdf',
        },
        {
          title: t('theory.perfectImbalanceTitle'),
          description: t('theory.perfectImbalanceDesc'),
          url: 'https://www.youtube.com/watch?v=e31OSVZF77w',
          guidelines: [
            { label: t('theory.perfectImbalanceCore'), value: t('theory.perfectImbalanceCoreValue'), status: 'good' },
            { label: t('theory.perfectImbalanceMeta'), value: t('theory.perfectImbalanceMetaValue'), status: 'info' },
          ],
        },
      ],
    },
    {
      id: 'damage',
      name: t('categories.damage'),
      icon: Calculator,
      color: 'bg-red-100 text-red-700',
      items: [
        {
          title: t('damage.formulaTitle'),
          description: t('damage.formulaDesc'),
          url: 'https://rpg.fandom.com/wiki/Damage_Formula',
          guidelines: [
            { label: t('damage.formulaRecommend'), value: t('damage.formulaRecommendValue'), status: 'good' },
            { label: t('damage.formulaMinDamage'), value: t('damage.formulaMinDamageValue'), status: 'info' },
            { label: t('damage.formulaWarning'), value: t('damage.formulaWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('damage.ttkTitle'),
          description: t('damage.ttkDesc'),
          url: 'https://tgbp.fandom.com/wiki/Time_to_kill',
          guidelines: [
            { label: t('damage.ttkFpsTactical'), value: t('damage.ttkFpsTacticalValue'), status: 'info' },
            { label: t('damage.ttkFpsArena'), value: t('damage.ttkFpsArenaValue'), status: 'info' },
            { label: t('damage.ttkMoba'), value: t('damage.ttkMobaValue'), status: 'info' },
            { label: t('damage.ttkRpgMob'), value: t('damage.ttkRpgMobValue'), status: 'info' },
            { label: t('damage.ttkRpgBoss'), value: t('damage.ttkRpgBossValue'), status: 'info' },
          ],
        },
        {
          title: t('damage.ehpTitle'),
          description: t('damage.ehpDesc'),
          url: 'http://www.strategyzero.com/blog/2011/league-of-legends-what-is-effective-health/',
          guidelines: [
            { label: t('damage.ehpTank'), value: t('damage.ehpTankValue'), status: 'good' },
            { label: t('damage.ehpDefEfficiency'), value: t('damage.ehpDefEfficiencyValue'), status: 'info' },
            { label: t('damage.ehpWarning'), value: t('damage.ehpWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('damage.armorPenTitle'),
          description: t('damage.armorPenDesc'),
          url: 'https://leagueoflegends.fandom.com/wiki/Armor_penetration',
          guidelines: [
            { label: t('damage.armorPenOrder'), value: t('damage.armorPenOrderValue'), status: 'info' },
            { label: t('damage.armorPenFlat'), value: t('damage.armorPenFlatValue'), status: 'good' },
            { label: t('damage.armorPenPercent'), value: t('damage.armorPenPercentValue'), status: 'good' },
            { label: t('damage.armorPenWarning'), value: t('damage.armorPenWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('damage.defTypeTitle'),
          description: t('damage.defTypeDesc'),
          url: 'https://tung.github.io/posts/simplest-non-problematic-damage-formula/',
          guidelines: [
            { label: t('damage.defTypeDivide'), value: t('damage.defTypeDivideValue'), status: 'good' },
            { label: t('damage.defTypeSubtract'), value: t('damage.defTypeSubtractValue'), status: 'info' },
            { label: t('damage.defTypeMultiply'), value: t('damage.defTypeMultiplyValue'), status: 'info' },
            { label: t('damage.defTypeLog'), value: t('damage.defTypeLogValue'), status: 'info' },
          ],
        },
      ],
    },
    {
      id: 'growth',
      name: t('categories.growth'),
      icon: TrendingUp,
      color: 'bg-green-100 text-green-700',
      items: [
        {
          title: t('growth.linearTitle'),
          description: t('growth.linearDesc'),
          url: 'https://www.davideaversa.it/blog/gamedesign-math-rpg-level-based-progression/',
          guidelines: [
            { label: t('growth.linearRate'), value: t('growth.linearRateValue'), status: 'good' },
            { label: t('growth.linearUse'), value: t('growth.linearUseValue'), status: 'info' },
            { label: t('growth.linearMaxLevel'), value: t('growth.linearMaxLevelValue'), status: 'info' },
          ],
        },
        {
          title: t('growth.expTitle'),
          description: t('growth.expDesc'),
          url: 'https://www.oreilly.com/library/view/introduction-to-game/9780137440702/ch14.xhtml',
          guidelines: [
            { label: t('growth.expRate'), value: t('growth.expRateValue'), status: 'good' },
            { label: t('growth.expUse'), value: t('growth.expUseValue'), status: 'info' },
            { label: t('growth.expWarning'), value: t('growth.expWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('growth.logTitle'),
          description: t('growth.logDesc'),
          url: 'https://pavcreations.com/level-systems-and-character-growth-in-rpg-games/',
          guidelines: [
            { label: t('growth.logUse'), value: t('growth.logUseValue'), status: 'info' },
            { label: t('growth.logLevel100'), value: t('growth.logLevel100Value'), status: 'good' },
          ],
        },
        {
          title: t('growth.sCurveTitle'),
          description: t('growth.sCurveDesc'),
          url: 'https://deliberategamedesign.com/the-shape-of-curves/',
          guidelines: [
            { label: t('growth.sCurveInflection'), value: t('growth.sCurveInflectionValue'), status: 'good' },
            { label: t('growth.sCurveMaxRate'), value: t('growth.sCurveMaxRateValue'), status: 'info' },
            { label: t('growth.sCurveUse'), value: t('growth.sCurveUseValue'), status: 'info' },
          ],
        },
      ],
    },
    {
      id: 'economy',
      name: t('categories.economy'),
      icon: Coins,
      color: 'bg-yellow-100 text-yellow-700',
      items: [
        {
          title: t('economy.faucetSinkTitle'),
          description: t('economy.faucetSinkDesc'),
          url: 'https://machinations.io/articles/what-is-game-economy-inflation-how-to-foresee-it-and-how-to-overcome-it-in-your-game-design',
          guidelines: [
            { label: t('economy.faucetSinkRatio'), value: t('economy.faucetSinkRatioValue'), status: 'good' },
            { label: t('economy.faucetSinkInflation'), value: t('economy.faucetSinkInflationValue'), status: 'info' },
            { label: t('economy.faucetSinkWarning'), value: t('economy.faucetSinkWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('economy.currencyTitle'),
          description: t('economy.currencyDesc'),
          url: 'https://departmentofplay.net/the-principles-of-building-a-game-economy/',
          guidelines: [
            { label: t('economy.currencySoft'), value: t('economy.currencySoftValue'), status: 'info' },
            { label: t('economy.currencyHard'), value: t('economy.currencyHardValue'), status: 'info' },
            { label: t('economy.currencyExchange'), value: t('economy.currencyExchangeValue'), status: 'good' },
          ],
        },
        {
          title: t('economy.timeMoneyTitle'),
          description: t('economy.timeMoneyDesc'),
          url: 'https://crustlab.com/blog/understanding-game-economy-design/',
          guidelines: [
            { label: t('economy.timeMoneyEfficiency'), value: t('economy.timeMoneyEfficiencyValue'), status: 'good' },
            { label: t('economy.timeMoneyF2P'), value: t('economy.timeMoneyF2PValue'), status: 'info' },
            { label: t('economy.timeMoneyWarning'), value: t('economy.timeMoneyWarningValue'), status: 'warning' },
          ],
        },
      ],
    },
    {
      id: 'gacha',
      name: t('categories.gacha'),
      icon: Sparkles,
      color: 'bg-pink-100 text-pink-700',
      items: [
        {
          title: t('gacha.pityTitle'),
          description: t('gacha.pityDesc'),
          url: 'https://game8.co/games/Genshin-Impact/archives/305937',
          guidelines: [
            { label: t('gacha.pityCount'), value: t('gacha.pityCountValue'), status: 'good' },
            { label: t('gacha.pityCost'), value: t('gacha.pityCostValue'), status: 'info' },
            { label: t('gacha.pityWarning1'), value: t('gacha.pityWarning1Value'), status: 'warning' },
            { label: t('gacha.pityWarning2'), value: t('gacha.pityWarning2Value'), status: 'warning' },
          ],
        },
        {
          title: t('gacha.softHardTitle'),
          description: t('gacha.softHardDesc'),
          url: 'https://www.oreateai.com/blog/understanding-soft-pity-in-genshin-impact-your-guide-to-the-gacha-system/20b8fa7f7cec0cc84b4272976eca18a6',
          guidelines: [
            { label: t('gacha.softHardStart'), value: t('gacha.softHardStartValue'), status: 'good' },
            { label: t('gacha.softHardIncrease'), value: t('gacha.softHardIncreaseValue'), status: 'info' },
            { label: t('gacha.softHardExample'), value: t('gacha.softHardExampleValue'), status: 'info' },
          ],
        },
        {
          title: t('gacha.rateTitle'),
          description: t('gacha.rateDesc'),
          url: 'https://gamerant.com/gacha-games-best-pity-system/',
          guidelines: [
            { label: t('gacha.rateSSR'), value: t('gacha.rateSSRValue'), status: 'good' },
            { label: t('gacha.rateSR'), value: t('gacha.rateSRValue'), status: 'info' },
            { label: t('gacha.rateR'), value: t('gacha.rateRValue'), status: 'info' },
            { label: t('gacha.rateWarning'), value: t('gacha.rateWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('gacha.expectedTitle'),
          description: t('gacha.expectedDesc'),
          url: 'https://www.fandomspot.com/what-is-gacha-pity/',
          guidelines: [
            { label: t('gacha.expected50'), value: t('gacha.expected50Value'), status: 'info' },
            { label: t('gacha.expected90'), value: t('gacha.expected90Value'), status: 'info' },
            { label: t('gacha.expected1Percent'), value: t('gacha.expected1PercentValue'), status: 'info' },
          ],
        },
      ],
    },
    {
      id: 'stage',
      name: t('categories.stage'),
      icon: Gamepad2,
      color: 'bg-blue-100 text-blue-700',
      items: [
        {
          title: t('stage.scalingTitle'),
          description: t('stage.scalingDesc'),
          url: 'https://www.designthegame.com/learning/tutorial/example-level-curve-formulas-game-progression',
          guidelines: [
            { label: t('stage.scalingRate'), value: t('stage.scalingRateValue'), status: 'good' },
            { label: t('stage.scaling10Wave'), value: t('stage.scaling10WaveValue'), status: 'info' },
            { label: t('stage.scalingBoss'), value: t('stage.scalingBossValue'), status: 'info' },
            { label: t('stage.scalingWarning'), value: t('stage.scalingWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('stage.rewardTitle'),
          description: t('stage.rewardDesc'),
          url: 'https://lostgarden.com/2021/12/12/value-chains/',
          guidelines: [
            { label: t('stage.rewardRate'), value: t('stage.rewardRateValue'), status: 'good' },
            { label: t('stage.rewardTime'), value: t('stage.rewardTimeValue'), status: 'info' },
            { label: t('stage.rewardWarning'), value: t('stage.rewardWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('stage.restTitle'),
          description: t('stage.restDesc'),
          url: 'https://book.leveldesignbook.com/process/combat/balance',
          guidelines: [
            { label: t('stage.restCycle'), value: t('stage.restCycleValue'), status: 'good' },
            { label: t('stage.restDifficulty'), value: t('stage.restDifficultyValue'), status: 'info' },
            { label: t('stage.restBonus'), value: t('stage.restBonusValue'), status: 'info' },
          ],
        },
      ],
    },
    {
      id: 'combatPower',
      name: t('categories.combatPower'),
      icon: Swords,
      color: 'bg-orange-100 text-orange-700',
      items: [
        {
          title: t('combatPower.effectivePowerTitle'),
          description: t('combatPower.effectivePowerDesc'),
          url: 'https://app2top.com/game_design/combat-system-design-how-a-game-designer-can-calculate-the-basics-264500.html',
          guidelines: [
            { label: t('combatPower.effectivePowerFormula'), value: t('combatPower.effectivePowerFormulaValue'), status: 'good' },
            { label: t('combatPower.effectiveDps'), value: t('combatPower.effectiveDpsValue'), status: 'info' },
            { label: t('combatPower.effectiveHp'), value: t('combatPower.effectiveHpValue'), status: 'info' },
          ],
        },
        {
          title: t('combatPower.ttkCompareTitle'),
          description: t('combatPower.ttkCompareDesc'),
          url: 'https://www.hiveworkshop.com/threads/best-way-to-calculate-fighting-power.307286/',
          guidelines: [
            { label: t('combatPower.ttkFormula'), value: t('combatPower.ttkFormulaValue'), status: 'good' },
            { label: t('combatPower.ttkWinner'), value: t('combatPower.ttkWinnerValue'), status: 'info' },
          ],
        },
        {
          title: t('combatPower.lanchesterTitle'),
          description: t('combatPower.lanchesterDesc'),
          url: 'https://www.gamedeveloper.com/design/the-designer-s-notebook-kicking-butt-by-the-numbers-lanchester-s-laws',
          guidelines: [
            { label: t('combatPower.lanchesterLinear'), value: t('combatPower.lanchesterLinearValue'), status: 'info' },
            { label: t('combatPower.lanchesterSquare'), value: t('combatPower.lanchesterSquareValue'), status: 'good' },
            { label: t('combatPower.lanchesterWarning'), value: t('combatPower.lanchesterWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('combatPower.edpsTitle'),
          description: t('combatPower.edpsDesc'),
          url: 'https://gamebalancing.wordpress.com/2015/03/14/fire-rate-dps-and-ttk/',
          guidelines: [
            { label: t('combatPower.edpsFormula'), value: t('combatPower.edpsFormulaValue'), status: 'good' },
            { label: t('combatPower.edpsCrit'), value: t('combatPower.edpsCritValue'), status: 'info' },
            { label: t('combatPower.edpsHit'), value: t('combatPower.edpsHitValue'), status: 'info' },
          ],
        },
      ],
    },
    {
      id: 'comeback',
      name: t('categories.comeback'),
      icon: RotateCcw,
      color: 'bg-cyan-100 text-cyan-700',
      items: [
        {
          title: t('comeback.mechanicTitle'),
          description: t('comeback.mechanicDesc'),
          url: 'https://machinations.io/glossary/comeback-mechanic',
          guidelines: [
            { label: t('comeback.mechanicCore'), value: t('comeback.mechanicCoreValue'), status: 'good' },
            { label: t('comeback.mechanicBalance'), value: t('comeback.mechanicBalanceValue'), status: 'info' },
          ],
        },
        {
          title: t('comeback.reversalTitle'),
          description: t('comeback.reversalDesc'),
          url: 'https://blogofarcanesecrets.wordpress.com/2018/02/12/the-underdog-story-designing-comeback-mechanics/',
          guidelines: [
            { label: t('comeback.reversalCondition'), value: t('comeback.reversalConditionValue'), status: 'good' },
            { label: t('comeback.reversalFactor'), value: t('comeback.reversalFactorValue'), status: 'info' },
          ],
        },
        {
          title: t('comeback.snowballTitle'),
          description: t('comeback.snowballDesc'),
          url: 'https://www.leagueoflegends.com/en-us/news/dev/quick-gameplay-thoughts-2-25-comeback-mechanics/',
          guidelines: [
            { label: t('comeback.snowballBalance'), value: t('comeback.snowballBalanceValue'), status: 'good' },
            { label: t('comeback.snowballWarning'), value: t('comeback.snowballWarningValue'), status: 'warning' },
          ],
        },
        {
          title: t('comeback.varianceTitle'),
          description: t('comeback.varianceDesc'),
          url: 'https://www.theonlycolors.com/2013/5/22/4353884/game-theory-expectation-variance-and-underdog-strategies',
          guidelines: [
            { label: t('comeback.varianceCrit'), value: t('comeback.varianceCritValue'), status: 'info' },
            { label: t('comeback.varianceEvasion'), value: t('comeback.varianceEvasionValue'), status: 'info' },
            { label: t('comeback.varianceWarning'), value: t('comeback.varianceWarningValue'), status: 'warning' },
          ],
        },
      ],
    },
  ];

  const getStatusIcon = (status: 'good' | 'warning' | 'info') => {
    switch (status) {
      case 'good':
        return <CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} />;
      case 'warning':
        return <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} />;
      case 'info':
        return <div className="w-3.5 h-3.5 rounded-full" style={{ background: 'var(--primary-blue)' }} />;
    }
  };

  const getStatusStyle = (status: 'good' | 'warning' | 'info') => {
    switch (status) {
      case 'good':
        return { background: 'var(--success-light)', borderColor: 'var(--success)' };
      case 'warning':
        return { background: 'var(--warning-light)', borderColor: 'var(--warning)' };
      case 'info':
        return { background: 'var(--primary-blue-light)', borderColor: 'var(--primary-blue)' };
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[1100] p-4" style={{ background: 'rgba(0, 0, 0, 0.5)' }}>
      <div className="rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl" style={{ background: 'var(--bg-primary)' }}>
        {/* 헤더 - 슬랙 스타일 */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent-light)' }}>
              <BookOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{t('title')}</h2>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t('subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 p-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" style={{ color: 'var(--success)' }} /> {t('legendRecommended')}</span>
                <span className="flex items-center gap-1"><div className="w-3.5 h-3.5 rounded-full" style={{ background: 'var(--primary-blue)' }} /> {t('legendReference')}</span>
                <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--warning)' }} /> {t('legendWarning')}</span>
              </div>
            </div>
            <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
              {t('legendDescription')}
            </p>
          </div>

          <div className="space-y-6">
            {referenceCategories.map((category) => {
              const Icon = category.icon;
              // 카테고리별 색상 매핑
              const categoryColorMap: Record<string, { bg: string; text: string }> = {
                'bg-purple-100 text-purple-700': { bg: 'var(--primary-purple-light)', text: 'var(--primary-purple)' },
                'bg-red-100 text-red-700': { bg: 'var(--error-light)', text: 'var(--error)' },
                'bg-green-100 text-green-700': { bg: 'var(--success-light)', text: 'var(--success)' },
                'bg-yellow-100 text-yellow-700': { bg: 'var(--warning-light)', text: 'var(--warning)' },
                'bg-pink-100 text-pink-700': { bg: 'var(--primary-purple-light)', text: 'var(--primary-purple)' },
                'bg-blue-100 text-blue-700': { bg: 'var(--primary-blue-light)', text: 'var(--primary-blue)' },
                'bg-orange-100 text-orange-700': { bg: '#fff7ed', text: '#c2410c' },
                'bg-cyan-100 text-cyan-700': { bg: '#ecfeff', text: '#0e7490' },
              };
              const categoryStyle = categoryColorMap[category.color] || { bg: 'var(--bg-tertiary)', text: 'var(--text-primary)' };
              return (
                <div key={category.id} className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ background: categoryStyle.bg, color: categoryStyle.text }}>
                    <Icon className="w-5 h-5" />
                    <h3 className="font-semibold">{category.name}</h3>
                  </div>
                  <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                    {category.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 transition-colors"
                        style={{ borderColor: 'var(--border-primary)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h4 className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</h4>
                            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{item.description}</p>

                            {/* 권장 수치 가이드 */}
                            {item.guidelines && item.guidelines.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {item.guidelines.map((guide, gIdx) => (
                                  <div
                                    key={gIdx}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs"
                                    style={getStatusStyle(guide.status)}
                                  >
                                    {getStatusIcon(guide.status)}
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{guide.label}:</span>
                                    <span style={{ color: 'var(--text-secondary)' }}>{guide.value}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          {item.url && (
                            <a
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-sm hover:underline whitespace-nowrap"
                              style={{ color: 'var(--primary-blue)' }}
                            >
                              <ExternalLink className="w-4 h-4" />
                              {t('viewSource')}
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 추가 정보 */}
          <div className="mt-6 p-4 rounded-lg border" style={{ background: 'var(--primary-purple-light)', borderColor: 'var(--primary-purple)' }}>
            <h4 className="font-medium mb-2" style={{ color: 'var(--primary-purple)' }}>{t('features.title')}</h4>
            <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>• <strong>{t('features.templates')}</strong>: {t('features.templatesDesc')}</li>
              <li>• <strong>{t('features.formulas')}</strong>: {t('features.formulasDesc')}</li>
              <li>• <strong>{t('features.calculator')}</strong>: {t('features.calculatorDesc')}</li>
              <li>• <strong>{t('features.visualization')}</strong>: {t('features.visualizationDesc')}</li>
              <li>• <strong>{t('features.segmentedCurve')}</strong>: {t('features.segmentedCurveDesc')}</li>
            </ul>
          </div>

          {/* 전투 시뮬레이션 기능 */}
          <div className="mt-4 p-4 rounded-lg border" style={{ background: 'var(--error-light)', borderColor: 'var(--error)' }}>
            <h4 className="font-medium mb-2" style={{ color: 'var(--error)' }}>{t('simulation.title')}</h4>
            <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>• <strong>{t('simulation.monteCarlo')}</strong>: {t('simulation.monteCarloDesc')}</li>
              <li>• <strong>{t('simulation.damageFormulas')}</strong>: {t('simulation.damageFormulasDesc')}</li>
              <li>• <strong>{t('simulation.defFormulas')}</strong>: {t('simulation.defFormulasDesc')}</li>
              <li>• <strong>{t('simulation.armorPen')}</strong>: {t('simulation.armorPenDesc')}</li>
              <li>• <strong>{t('simulation.teamBattle')}</strong>: {t('simulation.teamBattleDesc')}</li>
              <li>• <strong>{t('simulation.hotSkill')}</strong>: {t('simulation.hotSkillDesc')}</li>
              <li>• <strong>{t('simulation.invincibleTradeoff')}</strong>: {t('simulation.invincibleTradeoffDesc')}</li>
            </ul>
          </div>

          {/* 밸런스 분석 기능 */}
          <div className="mt-4 p-4 rounded-lg border" style={{ background: 'var(--success-light)', borderColor: 'var(--success)' }}>
            <h4 className="font-medium mb-2" style={{ color: 'var(--success)' }}>{t('analysis.title')}</h4>
            <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>• <strong>{t('analysis.perfectImbalance')}</strong>: {t('analysis.perfectImbalanceDesc')}</li>
              <li>• <strong>{t('analysis.powerCurve')}</strong>: {t('analysis.powerCurveDesc')}</li>
              <li>• <strong>{t('analysis.correlation')}</strong>: {t('analysis.correlationDesc')}</li>
              <li>• <strong>{t('analysis.deadzone')}</strong>: {t('analysis.deadzoneDesc')}</li>
              <li>• <strong>{t('analysis.diminishing')}</strong>: {t('analysis.diminishingDesc')}</li>
            </ul>
          </div>

          {/* 목표 역산 기능 */}
          <div className="mt-4 p-4 rounded-lg border" style={{ background: 'var(--primary-blue-light)', borderColor: 'var(--primary-blue)' }}>
            <h4 className="font-medium mb-2" style={{ color: 'var(--primary-blue)' }}>{t('goalSolver.title')}</h4>
            <ul className="text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>• <strong>{t('goalSolver.ttkDamage')}</strong>: {t('goalSolver.ttkDamageDesc')}</li>
              <li>• <strong>{t('goalSolver.survivalHP')}</strong>: {t('goalSolver.survivalHPDesc')}</li>
              <li>• <strong>{t('goalSolver.reductionDef')}</strong>: {t('goalSolver.reductionDefDesc')}</li>
              <li>• <strong>{t('goalSolver.dpsCrit')}</strong>: {t('goalSolver.dpsCritDesc')}</li>
              <li>• <strong>{t('goalSolver.growthRate')}</strong>: {t('goalSolver.growthRateDesc')}</li>
            </ul>
          </div>

          {/* 참고 출처 섹션 */}
          <div className="mt-6 p-4 rounded-lg border" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
            <h4 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>{t('sources.title')}</h4>
            <div className="space-y-4 text-sm">
              {/* 수식 도우미 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--primary-blue)' }}>{t('sources.formulaHelper')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• {t('sources.damageFormula')}: <a href="https://rpg.fandom.com/wiki/Damage_Formula" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>RPG Fandom Wiki</a></li>
                  <li>• {t('sources.ttkDps')}: <a href="https://gamebalancing.wordpress.com/2015/03/14/fire-rate-dps-and-ttk/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Game Balance Dissected</a></li>
                  <li>• {t('sources.ehp')}: <a href="https://pathofbuilding.net/dps-and-ehp-guide-and-damage-calculations/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Path of Building Guide</a></li>
                </ul>
              </div>

              {/* 밸런스 검증기 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--primary-green)' }}>{t('sources.balanceValidator')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• {t('sources.dpsTtkBalance')}: <a href="https://gamebalanceconcepts.wordpress.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Ian Schreiber - Game Balance Concepts</a></li>
                  <li>• {t('sources.roleStats')}: <a href="https://book.leveldesignbook.com/process/combat/balance" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Level Design Book</a></li>
                </ul>
              </div>

              {/* 난이도 곡선 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--primary-purple)' }}>{t('sources.difficultyCurve')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• {t('sources.flowTheory')}: <a href="https://en.wikipedia.org/wiki/Flow_(psychology)" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Wikipedia</a></li>
                  <li>• {t('sources.growthFormulas')}: <a href="https://www.davideaversa.it/blog/gamedesign-math-rpg-level-based-progression/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Davide Aversa Blog</a></li>
                  <li>• {t('sources.sCurveDesign')}: <a href="https://deliberategamedesign.com/the-shape-of-curves/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Deliberate Game Design</a></li>
                </ul>
              </div>

              {/* 전투 시뮬레이션 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--primary-red)' }}>{t('sources.combatSimulation')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• {t('sources.armorPenetration')}: <a href="https://leagueoflegends.fandom.com/wiki/Armor_penetration" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>LoL Wiki</a></li>
                  <li>• {t('sources.defFormula')}: <a href="https://tung.github.io/posts/simplest-non-problematic-damage-formula/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Tung Blog</a></li>
                  <li>• {t('sources.monteCarloSim')}: {t('sources.monteCarloNote')}</li>
                </ul>
              </div>

              {/* 밸런스 분석 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--accent)' }}>{t('sources.balanceAnalysis')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• Perfect Imbalance: <a href="https://www.youtube.com/watch?v=e31OSVZF77w" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Extra Credits</a></li>
                  <li>• {t('sources.correlationAnalysis')}: {t('sources.correlationNote')}</li>
                  <li>• {t('sources.deadzoneDetection')}: <a href="https://gamebalanceconcepts.wordpress.com/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Game Balance Concepts</a></li>
                </ul>
              </div>

              {/* 불균형 감지 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--primary-yellow)' }}>{t('sources.imbalanceDetection')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• {t('sources.outlierDetection')}: <a href="https://www.geeksforgeeks.org/machine-learning/z-score-for-outlier-detection-python/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>GeeksforGeeks - Z-Score Method</a></li>
                  <li>• {t('sources.varianceAnalysis')}: <a href="https://www.machinelearningplus.com/machine-learning/how-to-detect-outliers-with-z-score/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Machine Learning Plus</a></li>
                  <li>• {t('sources.powerCreep')}: <a href="https://gamebalanceconcepts.wordpress.com/2010/08/11/level-4-the-tao-of-game-balance/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Game Balance Concepts - Tao of Balance</a></li>
                </ul>
              </div>

              {/* 난이도 곡선 추가 출처 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--primary-purple)' }}>{t('sources.difficultyCurveAdvanced')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• {t('sources.difficultySaw')}: <a href="https://www.gamedeveloper.com/design/difficulty-curves" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Game Developer - Difficulty Curves</a></li>
                  <li>• {t('sources.difficultyMastering')}: <a href="https://www.numberanalytics.com/blog/mastering-game-difficulty-curves" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Number Analytics</a></li>
                  <li>• {t('sources.idleGameDesign')}: <a href="https://machinations.io/articles/idle-games-and-how-to-design-them" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Machinations.io</a></li>
                  <li>• {t('sources.idleRetention')}: <a href="https://www.gameanalytics.com/blog/how-to-make-an-idle-game-adjust" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>GameAnalytics</a></li>
                  <li>• {t('sources.playerRetention')}: <a href="https://gamedesignskills.com/game-design/player-retention/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Game Design Skills</a></li>
                </ul>
              </div>

              {/* 전투 시뮬레이션 추가 출처 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--error)' }}>{t('sources.combatSimulationAdvanced')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• {t('sources.simultaneousAction')}: <a href="https://en.wikipedia.org/wiki/Simultaneous_action_selection" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Wikipedia - Simultaneous Action Selection</a></li>
                  <li>• {t('sources.monteCarloMethod')}: <a href="https://en.wikipedia.org/wiki/Monte_Carlo_method" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Wikipedia - Monte Carlo Method</a></li>
                  <li>• {t('sources.wilsonScore')}: <a href="https://en.wikipedia.org/wiki/Binomial_proportion_confidence_interval#Wilson_score_interval" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Wikipedia - Wilson Score Interval</a></li>
                </ul>
              </div>

              {/* 게임 경제 설계 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--warning)' }}>{t('sources.economyDesign')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• {t('sources.faucetSink')}: <a href="https://machinations.io/articles/what-is-game-economy-inflation-how-to-foresee-it-and-how-to-overcome-it-in-your-game-design" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Machinations.io - Game Inflation</a></li>
                  <li>• {t('sources.goldSink')}: <a href="https://en.wikipedia.org/wiki/Gold_sink" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Wikipedia - Gold Sink</a></li>
                  <li>• {t('sources.economyPrinciples')}: <a href="https://departmentofplay.net/the-principles-of-building-a-game-economy/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Department of Play</a></li>
                  <li>• {t('sources.valueChains')}: <a href="https://lostgarden.com/2021/12/12/value-chains/" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Lost Garden - Value Chains</a></li>
                </ul>
              </div>

              {/* 곡선 피팅 및 수식화 */}
              <div>
                <div className="font-medium mb-1" style={{ color: 'var(--success)' }}>{t('sources.curveFitting')}</div>
                <ul className="space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                  <li>• {t('sources.regressionMethods')}: <a href="https://en.wikipedia.org/wiki/Regression_analysis" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Wikipedia - Regression Analysis</a></li>
                  <li>• {t('sources.leastSquares')}: <a href="https://en.wikipedia.org/wiki/Least_squares" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Wikipedia - Least Squares</a></li>
                  <li>• {t('sources.rSquared')}: <a href="https://en.wikipedia.org/wiki/Coefficient_of_determination" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-70" style={{ color: 'var(--accent)' }}>Wikipedia - R-squared</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t rounded-b-xl" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {t('footerNote')}
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg transition-colors"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--border-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            >
              {tCommon('close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
