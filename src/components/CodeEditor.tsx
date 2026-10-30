import React, { useRef, useEffect, useMemo } from 'react';
import Editor from '@monaco-editor/react';

export interface ActiveKaraokeToken {
  trackId: string;
  rawToken: string;
  lyric?: string;
  measureNumber: number;
  line: number;
  col: number;
  endCol: number;
  sourceStartOffset?: number;
  sourceEndOffset?: number;
  progressPct: number;
}

interface CodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  events?: any[];
  playheadBeat?: number;
  isPlaying?: boolean;
}

export function computeActiveKaraokeTokens(
  events: any[] = [],
  playheadBeat: number = 0,
  isPlaying: boolean = false
): ActiveKaraokeToken[] {
  if ((!isPlaying && playheadBeat <= 0) || !events || events.length === 0) {
    return [];
  }

  const currentWholeTime = playheadBeat / 4;
  const seenSpans = new Set<string>();
  const active: ActiveKaraokeToken[] = [];

  for (const ev of events) {
    if (!ev || !ev.rawToken || ev.pitch?.isRest || ev.pitch?.isSpacer) continue;

    const startWhole = ev.startTime
      ? ev.startTime.numerator / Math.max(1, ev.startTime.denominator)
      : 0;
    const durWhole = ev.duration
      ? ev.duration.numerator / Math.max(1, ev.duration.denominator)
      : 0.25;

    if (currentWholeTime >= startWhole && currentWholeTime <= startWhole + durWhole) {
      const line = ev.line ?? 1;
      const col = ev.col ?? 1;
      const spanKey = `${ev.trackId || 'pno'}:${line}:${col}:${ev.rawToken}`;
      if (seenSpans.has(spanKey)) continue;
      seenSpans.add(spanKey);

      const rawProg =
        durWhole > 1e-6 ? ((currentWholeTime - startWhole) / durWhole) * 100 : 100;
      const progressPct = Math.max(0, Math.min(100, Math.round(rawProg)));

      active.push({
        trackId: ev.trackId || 'pno',
        rawToken: ev.rawToken,
        lyric: ev.physics?.lyric,
        measureNumber: ev.measureNumber || Math.floor(startWhole) + 1,
        line,
        col,
        endCol: col + ev.rawToken.length,
        sourceStartOffset: ev.sourceStartOffset,
        sourceEndOffset: ev.sourceEndOffset,
        progressPct,
      });
    }
  }

  return active;
}

/**
 * Scan editor code text to detect exactly where "measure N" starts and ends (until next measure or end of wrapper).
 */
export function findMeasureLineRange(
  code: string,
  measureNumber: number
): { startLine: number; endLine: number } | null {
  if (measureNumber <= 0) return null;
  const lines = code.split('\n');
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

  const activeTokens = useMemo(
    () => computeActiveKaraokeTokens(events, playheadBeat, isPlaying),
    [events, playheadBeat, isPlaying]
  );

  // Synchronize Theater-Spotlight Delta Decorations, Measure Fades, and smooth Scroll Position centering
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
        return;
      }

      const model = editor.getModel?.();
      const numLines = model ? model.getLineCount() : code.split('\n').length;
      const newDecorations: any[] = [];

      // Determine active measure boundary
      const measureNum = activeTokens[0].measureNumber;
      const mRange = findMeasureLineRange(code, measureNum);

      if (mRange) {
        // 1. Wrap the active measure in the high-contrast back-glow outlining box
        newDecorations.push({
          range: new monaco.Range(mRange.startLine, 1, mRange.endLine, 1),
          options: {
            isWholeLine: true,
            className: 'tenuto-karaoke-measure-active',
          },
        });

        // 2. Heavy 28% Opacity dim on all previous unplayed measures
        if (mRange.startLine > 1) {
          newDecorations.push({
            range: new monaco.Range(1, 1, mRange.startLine - 1, 1),
            options: {
              isWholeLine: true,
              className: 'tenuto-karaoke-subdued',
            },
          });
        }

        // 3. Heavy 28% Opacity dim on all subsequent measures
        if (mRange.endLine < numLines) {
          newDecorations.push({
            range: new monaco.Range(mRange.endLine + 1, 1, numLines, 1),
            options: {
              isWholeLine: true,
              className: 'tenuto-karaoke-subdued',
            },
          });
        }
      }

      // 4. Spotlight the specific active track lines within that measure with pulsing green gradient
      const activeLines = new Set<number>();
      for (const tok of activeTokens) {
        let ln = tok.line;
        if (model && typeof model.getPositionAt === 'function' && typeof tok.sourceStartOffset === 'number') {
          ln = model.getPositionAt(tok.sourceStartOffset).lineNumber;
        }
        activeLines.add(ln);
      }

      for (const al of activeLines) {
        newDecorations.push({
          range: new monaco.Range(al, 1, al, 1),
          options: {
            isWholeLine: true,
            className: 'tenuto-karaoke-line-active',
          },
        });
      }

      // 5. Highlight sounding tokens in white-gold with smooth progress underlining
      for (const tok of activeTokens) {
        let startLine = tok.line;
        let startCol = tok.col;
        let endLine = tok.line;
        let endCol = tok.endCol;

        if (
          model &&
          typeof model.getPositionAt === 'function' &&
          typeof tok.sourceStartOffset === 'number' &&
          typeof tok.sourceEndOffset === 'number'
        ) {
          const pStart = model.getPositionAt(tok.sourceStartOffset);
          const pEnd = model.getPositionAt(tok.sourceEndOffset);
          startLine = pStart.lineNumber;
          startCol = pStart.column;
          endLine = pEnd.lineNumber;
          endCol = pEnd.column;
        }

        newDecorations.push({
          range: new monaco.Range(startLine, startCol, endLine, endCol),
          options: {
            inlineClassName: 'tenuto-karaoke-token-active',
          },
        });
      }

      decorationIdsRef.current = editor.deltaDecorations(
        decorationIdsRef.current,
        newDecorations
      );

      // Smooth Centering: keeps the active playing rows comfortably in focus (centered around 1/3 top)
      const centerLine = mRange ? mRange.startLine : activeTokens[0].line;
      if (centerLine > 0 && Math.abs(centerLine - lastRevealedLineRef.current) >= 2) {
        lastRevealedLineRef.current = centerLine;
        const targetViewLine = Math.max(1, centerLine - 2);
        editor.revealLineInCenterIfOutsideViewport?.(targetViewLine, 0);
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
            renderLineHighlight: 'all',
            smoothScrolling: true,
          }}
        />
      </div>
    </div>
  );
}
