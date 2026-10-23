import React from 'react';
import Editor from '@monaco-editor/react';

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
}

export function configureTenutoMonaco(monaco: any): void {
  if (!monaco || !monaco.languages) return;

  try {
    const existing = monaco.languages.getLanguages?.() || [];
    if (!existing.some((l: any) => l.id === 'tenuto')) {
      monaco.languages.register({ id: 'tenuto' });
    }

    monaco.languages.setMonarchTokensProvider('tenuto', {
      keywords: ['tenuto', 'meta', 'def', 'measure', 'macro', 'var', 'group', 'import', 'repeat'],
      attributes: ['style', 'patch', 'src', 'env', 'map', 'tempo', 'time', 'title', 'key', 'sidechain'],
      tokenizer: {
        root: [
          // Comments (%% or //)
          [/%%.*$/, 'comment'],
          [/\/\/.*$/, 'comment'],

          // Compound structural sigils
          [/<\[|\]>|@\{/, 'delimiter.bracket'],

          // Strings
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"([^"\\]|\\.)*"/, 'string'],

          // Track or voice assignment labels e.g. "pno:", "drums:", "v1:"
          [/[a-zA-Z_][a-zA-Z0-9_]*(?=\s*:)/, 'variable.track'],

          // Macro invocations e.g. "$motif"
          [/\$[a-zA-Z_][a-zA-Z0-9_]*/, 'variable.macro'],

          // Chained dot modifiers e.g. ".stacc", ".fx", ".pull", ".vol"
          [/\.[a-zA-Z_][a-zA-Z0-9_]*/, 'support.function'],

          // Durations & ratios e.g. ":4", ":8.", ":16", ":3/8", ":grace"
          [/:(?:grace|[0-9]+(?:\/[0-9]+|\.+)?(?:\*[0-9]+)?)/, 'constant.numeric'],

          // Scientific pitch literals e.g. "c4", "f#5", "eb3", "a"
          [/\b[a-gA-G][#b]*[0-9]+\b/, 'type.pitch'],
          [/\b[a-gA-G][#b]+\b/, 'type.pitch'],

          // Single-letter pitches, rests, spacers, and drum triggers
          [/\b(?:r|s)\b/, 'keyword.operator'],
          [/\b(?:k|bd|sd|hh|oh|cp|lt|mt|ht|cr|rd|a|b|c|d|e|f|g)\b/, 'type.pitch'],

          // Time values & numbers e.g. "15ms", "120", "0.5"
          [/\b[0-9]+(?:\.[0-9]+)?(?:ms|s|ticks|%)?\b/, 'number'],

          // Identifiers & Keywords
          [
            /[a-zA-Z_][a-zA-Z0-9_]*/,
            {
              cases: {
                '@keywords': 'keyword',
                '@attributes': 'attribute.name',
                '@default': 'identifier',
              },
            },
          ],

          // Brackets and pipes
          [/[{}()\[\]|~*]/, 'delimiter'],
        ],
      },
    });

    monaco.editor.defineTheme('tenuto-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'C084FC', fontStyle: 'bold' },
        { token: 'attribute.name', foreground: '93C5FD' },
        { token: 'variable.track', foreground: 'FBBF24', fontStyle: 'bold' },
        { token: 'variable.macro', foreground: 'F59E0B', fontStyle: 'bold' },
        { token: 'type.pitch', foreground: '38BDF8', fontStyle: 'bold' },
        { token: 'constant.numeric', foreground: '34D399', fontStyle: 'bold' },
        { token: 'support.function', foreground: 'F472B6' },
        { token: 'keyword.operator', foreground: '94A3B8' },
        { token: 'string', foreground: 'A3E635' },
        { token: 'number', foreground: 'FB923C' },
        { token: 'delimiter.bracket', foreground: '818CF8', fontStyle: 'bold' },
        { token: 'delimiter', foreground: '64748B' },
      ],
      colors: {
        'editor.background': '#0B0F19',
        'editor.foreground': '#E2E8F0',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#94A3B8',
        'editor.selectionBackground': '#1E3A8A80',
        'editor.lineHighlightBackground': '#1E293B50',
      },
    });
  } catch {
    // Ignore in mocked test environments
  }
}

export default function CodeEditor({ code, onChange }: CodeEditorProps) {
  return (
    <Editor
      height="100%"
      defaultLanguage="tenuto"
      theme="tenuto-dark"
      value={code}
      beforeMount={configureTenutoMonaco}
      onChange={(val) => {
        if (val !== undefined) {
          onChange(val);
        }
      }}
      options={{
        minimap: { enabled: false },
        wordWrap: 'on',
        lineNumbers: 'on',
        scrollBeyondLastLine: false,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: 'all',
        smoothScrolling: true,
      }}
    />
  );
}
