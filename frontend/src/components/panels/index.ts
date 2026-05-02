// 다른 panel 들은 dynamic import 로 직접 path 사용 (page.tsx 의 dynamic())
// 이 index 는 정적 import 가 필요한 panel 만 re-export
export { default as TemplateSelector } from './TemplateSelector';
