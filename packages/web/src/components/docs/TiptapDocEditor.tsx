/**
 * TiptapDocEditor — Milestone 1: Notion-class 블록 에디터.
 *
 * 기능:
 *   - tiptap StarterKit (heading, list, code, bold, italic, etc.)
 *   - Placeholder
 *   - 자동저장 (500ms debounce)
 *   - Y.Doc 기반 실시간 협업 (후속 마일스톤)
 *
 * Slash commands 와 @mention 은 M1-3 / M1-4 에서 확장.
 * Custom blocks (LiveCell, Chart, Sim, Task, Rationale) 는 M2 에서 추가.
 */

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useTranslations } from 'next-intl';
import SlashCommand, { type SlashCommandItem } from './extensions/SlashCommand';
import { createMentionExtension } from './extensions/MentionSuggestion';
import LiveCellBlock from './extensions/LiveCellBlock';
import ChartBlock from './extensions/ChartBlock';
import TaskCardBlock from './extensions/TaskCardBlock';
import SimulationBlock from './extensions/SimulationBlock';
import RationaleBlock from './extensions/RationaleBlock';
import { useProjectStore } from '@/stores/projectStore';
import 'tippy.js/dist/tippy.css';
import {
  Heading1, Heading2, Heading3, List, ListOrdered, Quote, Code, Minus,
  Swords, BarChart3, Zap, Lightbulb, FileSpreadsheet,
} from 'lucide-react';

interface Props {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  projectId?: string;
}

export default function TiptapDocEditor({ content, onChange, placeholder, projectId }: Props) {
  const t = useTranslations('docs');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  // projectId 기반으로 현재 프로젝트 가져오기 (Mention 후보 생성에 필요)
  const projects = useProjectStore((s) => s.projects);
  const projectRef = useRef(projects.find((p) => p.id === projectId));
  useEffect(() => {
    projectRef.current = projects.find((p) => p.id === projectId);
  }, [projects, projectId]);

  // 멘션 클릭 시 네비게이션 — task/cell 은 RecordEditor 슬라이드까지 자동 open
  const setCurrentSheet = useProjectStore((s) => s.setCurrentSheet);
  const setCurrentDoc = useProjectStore((s) => s.setCurrentDoc);
  const navigateMention = (id: string) => {
    const [kind, a, b] = id.split(':');
    if (kind === 'sheet' && a) {
      setCurrentDoc(null);
      setCurrentSheet(a);
    } else if ((kind === 'task' || kind === 'cell') && a) {
      // task|cell:<sheetId>:<rowId> — 시트 전환 + RecordEditor 자동 open (Linear 식)
      setCurrentDoc(null);
      setCurrentSheet(a);
      if (b && projectId) {
        // 전역 레코드 상세 패널 open — task-link 클릭과 동일한 UX
        const pid = projectId;
        import('@/stores/recordDetailStore').then(({ useRecordDetail }) => {
          useRecordDetail.getState().openRecord({ projectId: pid, sheetId: a, rowId: b });
        });
        window.dispatchEvent(new CustomEvent('balruno:focus-row', { detail: { sheetId: a, rowId: b } }));
      }
    } else if (kind === 'doc' && a) {
      setCurrentSheet(null);
      setCurrentDoc(a);
    }
  };

  const slashItems: SlashCommandItem[] = [
    { title: t('slashH1Title'), description: t('slashH1Desc'), icon: Heading1, keywords: ['h1', '제목', 'heading'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
    { title: t('slashH2Title'), description: t('slashH2Desc'), icon: Heading2, keywords: ['h2', '섹션', 'section'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
    { title: t('slashH3Title'), description: t('slashH3Desc'), icon: Heading3, keywords: ['h3'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
    { title: t('slashBulletTitle'), description: t('slashBulletDesc'), icon: List, keywords: ['bullet', 'list', '목록'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
    { title: t('slashOrderedTitle'), description: t('slashOrderedDesc'), icon: ListOrdered, keywords: ['ol', '번호', 'numbered'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: t('slashQuoteTitle'), description: t('slashQuoteDesc'), icon: Quote, keywords: ['quote', '인용'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
    { title: t('slashCodeTitle'), description: t('slashCodeDesc'), icon: Code, keywords: ['code', '코드'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
    { title: t('slashHrTitle'), description: t('slashHrDesc'), icon: Minus, keywords: ['hr', 'divider', '구분'],
      command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
    { title: t('slashLiveCellTitle'), description: t('slashLiveCellDesc'), icon: FileSpreadsheet, keywords: ['cell', '셀'],
      command: ({ editor, range }) => {
        const p = projectRef.current;
        const firstSheet = p?.sheets?.[0];
        const firstCol = firstSheet?.columns?.[0];
        const firstRow = firstSheet?.rows?.[0];
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'liveCell',
          attrs: {
            projectId: p?.id ?? '',
            sheetId: firstSheet?.id ?? '',
            columnId: firstCol?.id ?? '',
            rowId: firstRow?.id ?? '',
            label: firstSheet && firstCol ? `${firstSheet.name}/${firstCol.name}` : '',
          },
        }).run();
      } },
    { title: t('slashChartTitle'), description: t('slashChartDesc'), icon: BarChart3, keywords: ['chart', '차트'],
      command: ({ editor, range }) => {
        const p = projectRef.current;
        const firstSheet = p?.sheets?.[0];
        const numericCols = firstSheet?.columns.filter((c) => c.type === 'general' || c.type === 'formula') ?? [];
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'chartBlock',
          attrs: {
            projectId: p?.id ?? '',
            sheetId: firstSheet?.id ?? '',
            xColumnName: numericCols[0]?.name ?? '',
            yColumnName: numericCols[1]?.name ?? numericCols[0]?.name ?? '',
            chartType: 'line',
          },
        }).run();
      } },
    { title: t('slashTaskTitle'), description: t('slashTaskDesc'), icon: Zap, keywords: ['task', '태스크'],
      command: ({ editor, range }) => {
        const p = projectRef.current;
        const firstPmRow = p?.sheets.flatMap((s) => s.rows)[0];
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'taskCard',
          attrs: { projectId: p?.id ?? '', rowId: firstPmRow?.id ?? '' },
        }).run();
      } },
    { title: t('slashSimTitle'), description: t('slashSimDesc'), icon: Swords, keywords: ['sim', 'dps', '시뮬'],
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'simulationBlock',
          attrs: { damage: 100, attackSpeed: 1, critRate: 0.2, critDamage: 2, iterations: 1000 },
        }).run();
      } },
    { title: t('slashRationaleTitle'), description: t('slashRationaleDesc'), icon: Lightbulb, keywords: ['rationale', '근거', 'why'],
      command: ({ editor, range }) => {
        const p = projectRef.current;
        const firstSheet = p?.sheets?.[0];
        const firstCol = firstSheet?.columns?.[0];
        const firstRow = firstSheet?.rows?.[0];
        editor.chain().focus().deleteRange(range).insertContent({
          type: 'rationaleBlock',
          attrs: {
            projectId: p?.id ?? '',
            sheetId: firstSheet?.id ?? '',
            columnId: firstCol?.id ?? '',
            rowId: firstRow?.id ?? '',
          },
        }).run();
      } },
  ];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? t('editorPlaceholder'),
      }),
      SlashCommand.configure({ items: slashItems }),
      createMentionExtension(
        () => projectRef.current,
        () => ({
          noTitle: t('noTitlePlaceholder'),
          docHint: t('mentionDocHint'),
          sheetHint: (cols: number, rows: number) => t('mentionSheetHint', { cols, rows }),
        }),
      ),
      LiveCellBlock,
      ChartBlock,
      TaskCardBlock,
      SimulationBlock,
      RationaleBlock,
    ],
    content,
    immediatelyRender: false, // Next.js SSR
    editorProps: {
      attributes: {
        class: 'tiptap-doc-editor prose prose-base dark:prose-invert max-w-none focus:outline-none min-h-[60vh] px-8 py-6',
      },
      handleClickOn: (_view, _pos, node) => {
        if (node.type.name === 'mention') {
          const id = node.attrs.id as string | undefined;
          if (id) {
            navigateMention(id);
            return true; // 에디터의 기본 동작 막기 (커서 이동 방지)
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // debounced onChange
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onChange(editor.getHTML());
      }, 500);
    },
  });

  // 외부 content 변경 시 (다른 문서 선택 등) editor 업데이트
  useEffect(() => {
    if (!editor) return;
    if (!initialized.current) {
      initialized.current = true;
      return;
    }
    const current = editor.getHTML();
    if (current !== content) {
      editor.commands.setContent(content, { emitUpdate: false });
    }
  }, [content, editor]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
