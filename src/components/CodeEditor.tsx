import React, { useRef, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';

export interface ActiveKaraokeToken {
  trackId: string;
  rawToken: string;
  coreToken: string;
  lyric?: string;
  measureNumber: number;
  line: number;
  col: number;
  endCol: number;
  sourceStartOffset?: number;
  sourceEndOffset?: number;
  progressPct: number;
}

export interface ActiveMeasureScrollTarget {
  measureNumber: number;
  startLine: number;
  endLine: number;
  centerLine: number;
}

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  events?: any[];
  playheadBeat?: number;
  isPlaying?: boolean;
}

/**
 * Extracts strictly the playable pitch/chord + duration prefix from a raw Tenuto token,
 * stripping all trailing `.modifier(...)` chains and `~` ties.
 */
export function extractCoreNoteAndDurationToken(rawToken: string): string {
  const trimmed = (rawToken || '').trim().replace(/~/g, '');
  if (!trimmed) return '';

  if (trimmed.startsWith('[')) {
    const closeBracketIdx = trimmed.indexOf(']');
    if (closeBracketIdx !== -1) {
      const chordPart = trimmed.slice(0, closeBracketIdx + 1);
      const afterChord = trimmed.slice(closeBracketIdx + 1);
      const durMatch = afterChord.match(
        /^(:(?:grace|\d+(?:\/\d+)?(?:\.(?!\w))?(?:\*\d+)?))/
      );
      return durMatch ? `${chordPart}${durMatch[1]}` : chordPart;
    }
  }

  const singleMatch = trimmed.match(
    /^([a-zA-Z0-9_#b+-]+(?::(?:grace|\d+(?:\/\d+)?(?:\.(?!\w))?(?:\*\d+)?))?)/
  );
  if (singleMatch && singleMatch[1]) {
    return singleMatch[1];
  }

  return trimmed;
}

export function computeActiveKaraokeTokens(
  events: any[] = [],
  playheadBeat: number = 0,
  isPlaying: boolean = false
): ActiveKaraokeToken[] {
  if (!isPlaying || !events || events.length === 0) {
    return [];
  }

  const currentWholeTime = playheadBeat / 4;
  const seenSpans = new Set<string>();
  const active: ActiveKaraokeToken[] = [];

  for (const ev of events) {
    if (!ev || !ev.rawToken || ev.pitch?.isRest || ev.pitch?.isSpacer) continue;
    if (/^r(?::|$|\.)/i.test(ev.rawToken.trim())) continue;

    const startWhole = ev.startTime
      ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator)
      : 0;
    const durWhole = ev.duration
      ? ev.duration.numerator / Math.max(1, ev.duration.denominator)
      : 0.25;

    if (currentWholeTime >= startWhole && currentWholeTime < startWhole + durWhole - 1e-5) {
      const line = ev.line ?? 0;
      const col = ev.col ?? 0;
      if (line <= 0 || col <= 0) continue;

      const coreToken = extractCoreNoteAndDurationToken(ev.rawToken);
      if (!coreToken) continue;

      const spanKey = `${line}:${col}:${coreToken}`;
      if (seenSpans.has(spanKey)) continue;
      seenSpans.add(spanKey);

      const rawProg =
        durWhole > 1e-6 ? ((currentWholeTime - startWhole) / durWhole) * 100 : 100;
      const progressPct = Math.max(0, Math.min(100, Math.round(rawProg)));

      active.push({
        trackId: ev.trackId || 'pno',
        rawToken: ev.rawToken,
        coreToken,
        lyric: ev.physics?.lyric,
        measureNumber: ev.measureNumber || Math.floor(startWhole) + 1,
        line,
        col,
        endCol: col + coreToken.length,
        sourceStartOffset: ev.sourceStartOffset,
        sourceEndOffset: ev.sourceEndOffset,
        progressPct,
      });
    }
  }

  return active;
}

/**
 * Scans editor code text to detect the exact 1-based [startLine, endLine] boundaries of `measure N { ... }`.
 */
export function findMeasureLineRange(
  code: string,
  measureNumber: number
): { startLine: number; endLine: number } | null {
  if (measureNumber <= 0) return null;
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  const startRegex = new RegExp(`^\\s*measure\\s+${measureNumber}\\b`, 'i');
  const anyMeasureRegex = /^\s*measure\s+\d+/i;

  let startLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (startRegex.test(lines[i])) {
      startLine = i + 1;
      break;
    }
  }

  if (startLine === -1) return null;

  let endLine = lines.length;
  for (let j = startLine; j < lines.length; j++) {
    const trim = lines[j].trim();
    if (trim === '}') {
      endLine = j + 1;
      break;
    }
    if (anyMeasureRegex.test(lines[j]) || (trim.startsWith('def') && j > startLine + 1)) {
      endLine = j;
      break;
    }
  }

  return { startLine, endLine };
}

/**
 * Computes the exact vertical center line and [startLine, endLine] span of the active measure
 * so the Monaco editor always keeps the currently playing measure centered in the viewport.
 */
export function computeActiveMeasureScrollTarget(
  code: string,
  activeTokens: ActiveKaraokeToken[]
): ActiveMeasureScrollTarget | null {
  if (!activeTokens || activeTokens.length === 0) return null;

  const measureNumber = activeTokens[0].measureNumber;
  const mRange = findMeasureLineRange(code, measureNumber);
  if (mRange) {
    const centerLine = Math.max(
      1,
      Math.round((mRange.startLine + mRange.endLine) / 2)
    );
    return {
      measureNumber,
      startLine: mRange.startLine,
      endLine: mRange.endLine,
      centerLine,
    };
  }

  const minLine = Math.min(...activeTokens.map((t) => t.line));
  const maxLine = Math.max(...activeTokens.map((t) => t.line));
  const centerLine = Math.max(1, Math.round((minLine + maxLine) / 2));

  return {
    measureNumber,
    startLine: minLine,
    endLine: maxLine,
    centerLine,
  };
}

export function configureTenutoMonaco(monaco: any): void {
  if (!monaco || !monaco.languages) return;

  try {
    const existing = monaco.languages.getLanguages?.() || [];
    if (!existing.some((l: any) => l.id === 'tenuto')) {
      monaco.languages.register({ id: 'tenuto' });
    }

    monaco.languages.setMonarchTokensProvider('tenuto', {
      keywords: [
        'tenuto',
        'meta',
        'def',
        'def_return',
        'return',
        'group',
        'scene',
        'clip',
        'locator',
        'groove',
        'rack',
        'measure',
        'macro',
        'var',
        'import',
        'repeat',
      ],
      attributes: [
        'style',
        'patch',
        'src',
        'env',
        'map',
        'tempo',
        'time',
        'title',
        'key',
        'scale',
        'tuning',
        'quantize_launch',
        'crossfader',
        'sidechain',
        'sends',
        'crossfade',
        'delay',
        'groove',
        'macros',
        'tracks',
        'track',
        'scene',
        'bars',
        'loop',
        'warp',
        'transpose',
        'gain',
        'follow',
        'follow_action',
        'detune',
        'unison',
        'cutoff',
        'resonance',
        'sub',
        'air',
        'duck',
        'width',
        'slop',
        'noise',
      ],
      tokenizer: {
        root: [
          [/%%.*$/, 'comment'],
          [/\/\/.*$/, 'comment'],
          [/<\[|\]>|@\{/, 'delimiter.bracket'],
          [/"([^"\\]|\\.)*$/, 'string.invalid'],
          [/"([^"\\]|\\.)*"/, 'string'],
          [/[a-zA-Z_][a-zA-Z0-9_]*(?=\s*:)/, 'variable.track'],
          [/\$[a-zA-Z_][a-zA-Z0-9_]*/, 'variable.macro'],
          [/\.[a-zA-Z_][a-zA-Z0-9_]*/, 'support.function'],
          [/:(?:grace|[0-9]+(?:\/[0-9]+|\.+)?(?:\*[0-9]+)?)/, 'constant.numeric'],
          [/\b[a-gA-G][#b]*[0-9]+\b/, 'type.pitch'],
          [/\b[a-gA-G][#b]+\b/, 'type.pitch'],
          [/\b(?:r|s)\b/, 'keyword.operator'],
          [/\b(?:k|bd|sd|hh|oh|cp|lt|mt|ht|cr|rd|a|b|c|d|e|f|g)\b/, 'type.pitch'],
          [/\b[0-9]+(?:\.[0-9]+)?(?:ms|s|ticks|%)?\b/, 'number'],
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
        'editor.lineHighlightBackground': '#1E293B30',
      },
    });
  } catch {
    // Graceful fallback for mocked environments
  }
}

export default function CodeEditor({
  code,
  onChange,
  events = [],
  playheadBeat = 0,
  isPlaying = false,
}: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationIdsRef = useRef<string[]>([]);
  const lastRevealedLineRef = useRef<number>(0);
  const lastRevealedMeasureRef = useRef<number>(0);

  const activeTokens = useMemo(
    () => computeActiveKaraokeTokens(events, playheadBeat, isPlaying),
    [events, playheadBeat, isPlaying]
  );

  // Synchronize Surgical Core-Note Token Decorations & Always-Centered Measure Scrolling
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !monaco.Range) return;

    try {
      if (activeTokens.length === 0) {
        if (decorationIdsRef.current.length > 0) {
          decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, []);
        }
        lastRevealedLineRef.current = 0;
        lastRevealedMeasureRef.current = 0;
        return;
      }

      const model = editor.getModel?.();
      const codeLines = code.replace(/\r\n?/g, '\n').split('\n');
      const newDecorations: any[] = [];
      const scrollTarget = computeActiveMeasureScrollTarget(code, activeTokens);

      for (const tok of activeTokens) {
        const lineNum = tok.line;
        if (lineNum < 1 || lineNum > codeLines.length) continue;

        const rawLineText: string =
          model && typeof model.getLineContent === 'function'
            ? model.getLineContent(lineNum)
            : codeLines[lineNum - 1] || '';

        const trimmedLine = rawLineText.trim();
        if (
          !trimmedLine ||
          trimmedLine.startsWith('%%') ||
          trimmedLine.startsWith('//') ||
          /^(?:measure|tenuto|meta|def|return|group|locator|groove)\b/i.test(trimmedLine)
        ) {
          continue;
        }

        const pctCommentIdx = rawLineText.indexOf('%%');
        const slashCommentIdx = rawLineText.indexOf('//');
        const commentCutIdx =
          pctCommentIdx !== -1 && slashCommentIdx !== -1
            ? Math.min(pctCommentIdx, slashCommentIdx)
            : pctCommentIdx !== -1
              ? pctCommentIdx
              : slashCommentIdx;

        let startCol0 = Math.max(0, tok.col - 1);
        if (rawLineText.slice(startCol0, startCol0 + tok.coreToken.length) !== tok.coreToken) {
          const exactIdx = rawLineText.indexOf(tok.coreToken, Math.max(0, startCol0 - 4));
          if (exactIdx !== -1) {
            startCol0 = exactIdx;
          } else {
            continue;
          }
        }

        if (commentCutIdx !== -1 && startCol0 >= commentCutIdx) {
          continue;
        }

        const startCol1 = startCol0 + 1;
        const endCol1 = startCol1 + tok.coreToken.length;

        newDecorations.push({
          range: new monaco.Range(lineNum, startCol1, lineNum, endCol1),
          options: {
            inlineClassName: 'tenuto-karaoke-token-active',
          },
        });
      }

      decorationIdsRef.current = editor.deltaDecorations(
        decorationIdsRef.current,
        newDecorations
      );

      // Always keep the current measure centered in the Monaco editor viewport
      if (
        scrollTarget &&
        (scrollTarget.measureNumber !== lastRevealedMeasureRef.current ||
          scrollTarget.centerLine !== lastRevealedLineRef.current)
      ) {
        lastRevealedMeasureRef.current = scrollTarget.measureNumber;
        lastRevealedLineRef.current = scrollTarget.centerLine;

        if (typeof editor.revealLinesInCenter === 'function') {
          editor.revealLinesInCenter(scrollTarget.startLine, scrollTarget.endLine, 0);
        }
        if (typeof editor.revealLineInCenter === 'function') {
          editor.revealLineInCenter(scrollTarget.centerLine, 0);
        } else {
          editor.revealLineInCenterIfOutsideViewport?.(scrollTarget.centerLine, 0);
        }
      }
    } catch {
      // Graceful fallback for mocked environments
    }
  }, [activeTokens, code]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden relative tenuto-editor-playback">
      {/* Top compact Horizontal Karaoke progress ticker ribbon */}
      {activeTokens.length > 0 && (
        <div
          data-testid="karaoke-code-ribbon"
          className="bg-slate-900/95 border-b border-emerald-500/40 px-3 py-1.5 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0 z-10 select-none"
        >
          <span className="px-2 py-0.5 rounded bg-emerald-500/25 border border-emerald-500/50 text-emerald-300 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.25)]">
            ♫ Now Playing M{activeTokens[0].measureNumber}
          </span>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {activeTokens.slice(0, 8).map((tok, idx) => (
              <div
                key={`${tok.trackId}-${tok.line}-${tok.col}-${idx}`}
                data-testid={`karaoke-pill-${tok.trackId}`}
                className="relative overflow-hidden rounded bg-slate-950 border border-emerald-500/50 px-2.5 py-0.5 text-[11px] font-mono flex items-center gap-1.5 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.15)]"
              >
                <div
                  data-testid={`karaoke-fill-${tok.trackId}`}
                  style={{ width: `${tok.progressPct}%` }}
                  className="absolute inset-y-0 left-0 bg-emerald-500/25 pointer-events-none transition-all duration-75"
                />
                <span className="relative z-10 text-amber-400 font-bold">
                  {tok.trackId}:
                </span>
                {tok.lyric && (
                  <span className="relative z-10 text-emerald-300 font-bold">
                    &ldquo;{tok.lyric}&rdquo;
                  </span>
                )}
                <span className="relative z-10 text-white font-semibold">
                  {tok.rawToken}
                </span>
                <span className="relative z-10 text-[9px] text-slate-400">
                  L{tok.line}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        <Editor
          height="100%"
          defaultLanguage="tenuto"
          theme="tenuto-dark"
          value={code}
          beforeMount={configureTenutoMonaco}
          onMount={(editor, monaco) => {
            editorRef.current = editor;
            monacoRef.current = monaco;
          }}
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
            renderLineHighlight: 'none',
            smoothScrolling: true,
          }}
        />
      </div>
    </div>
  );
}
