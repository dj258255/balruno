// 모달 컴포넌트들은 dynamic import 로 path 직접 사용. useOnboardingStatus hook 만
// 정적 import 필요 (page.tsx 의 hydrate 흐름).
export { useOnboardingStatus } from './OnboardingGuide';
