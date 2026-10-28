import React, { useState } from 'react';
import { Copy, Check, FileCode, Terminal, AlertCircle, Info, ChevronRight, Hash } from 'lucide-react';

export default function StructuredAiResponse({ content, citations = [] }) {
  if (!content) return null;

  // Split content by code blocks: ```lang ... ```
  const parts = [];
  const codeBlockRegex = /```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        value: content.substring(lastIndex, match.index)
      });
    }
    parts.push({
      type: 'code',
      language: match[1] || 'text',
      code: match[2].trimEnd()
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      value: content.substring(lastIndex)
    });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {parts.map((part, pIdx) => {
        if (part.type === 'code') {
          return <CodeSnippetBlock key={pIdx} language={part.language} code={part.code} />;
        }
        return <FormattedTextBlock key={pIdx} text={part.value} />;
      })}

      {/* Citations footer if present */}
      {citations && citations.length > 0 && (
        <div style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Verified References:
          </span>
          {citations.map((cite, cIdx) => (
            <div
              key={cIdx}
              style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono, monospace)',
                color: 'var(--accent-red)',
                background: 'rgba(255, 48, 48, 0.08)',
                border: '1px solid rgba(255, 48, 48, 0.25)',
                padding: '2px 8px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Hash size={11} />
              {cite.filePath}{cite.startLine ? `:L${cite.startLine}${cite.endLine ? `-L${cite.endLine}` : ''}` : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CodeSnippetBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = code.split('\n');

  return (
    <div style={{
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid var(--border-subtle)',
      background: '#0B0B0E',
      margin: '6px 0'
    }}>
      {/* Code Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: '#121216',
        borderBottom: '1px solid var(--border-subtle)',
        fontSize: '0.75rem',
        color: 'var(--text-dim)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', gap: '5px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF5F56' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFBD2E' }} />
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#27C93F' }} />
          </div>
          <span style={{ fontFamily: 'monospace', textTransform: 'lowercase', marginLeft: '6px', color: 'var(--text-muted)' }}>
            {language || 'code'}
          </span>
        </div>

        <button
          onClick={handleCopy}
          style={{
            background: 'transparent',
            border: 'none',
            color: copied ? '#34D399' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '0.72rem',
            padding: '2px 6px',
            borderRadius: '4px'
          }}
          title="Copy code"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      {/* Code Body with Line Numbers */}
      <div style={{
        padding: '12px 14px',
        overflowX: 'auto',
        fontSize: '0.82rem',
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1.6,
        color: '#E4E4E7'
      }}>
        <pre style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '14px' }}>
          <span style={{ userSelect: 'none', color: '#4B5563', textAlign: 'right', paddingRight: '8px', borderRight: '1px solid #1F1F24' }}>
            {lines.map((_, i) => (
              <span key={i} style={{ display: 'block' }}>{i + 1}</span>
            ))}
          </span>
          <code style={{ overflowX: 'auto' }}>
            {lines.map((line, i) => (
              <span key={i} style={{ display: 'block', whiteSpace: 'pre' }}>
                {highlightSyntax(line, language)}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}

function FormattedTextBlock({ text }) {
  if (!text) return null;

  // Split into paragraphs / lines
  const rawLines = text.split('\n');
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} style={{ paddingLeft: '20px', margin: '6px 0', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {currentList.map((item, idx) => (
            <li key={idx} style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.55 }}>
              {formatInlineFormatting(item)}
            </li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  rawLines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <div key={idx} style={{
          fontSize: '0.96rem',
          fontWeight: 700,
          color: '#FFFFFF',
          margin: '12px 0 6px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ width: '3px', height: '14px', background: 'var(--accent-red)', borderRadius: '2px' }} />
          {formatInlineFormatting(trimmed.substring(4))}
        </div>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <div key={idx} style={{
          fontSize: '1.08rem',
          fontWeight: 700,
          color: '#FFFFFF',
          margin: '16px 0 8px',
          paddingBottom: '4px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ width: '4px', height: '16px', background: 'var(--accent-red)', borderRadius: '2px' }} />
          {formatInlineFormatting(trimmed.substring(3))}
        </div>
      );
    } else if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h2 key={idx} style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FFFFFF', margin: '18px 0 10px' }}>
          {formatInlineFormatting(trimmed.substring(2))}
        </h2>
      );
    }
    // Bullet item: "- " or "* "
    else if (/^[-*]\s+/.test(trimmed)) {
      currentList.push(trimmed.replace(/^[-*]\s+/, ''));
    }
    // Numbered item: "1. "
    else if (/^\d+\.\s+/.test(trimmed)) {
      currentList.push(trimmed.replace(/^\d+\.\s+/, ''));
    }
    // Callout / Blockquote
    else if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <div key={idx} style={{
          borderLeft: '3px solid var(--accent-red)',
          background: 'rgba(255, 48, 48, 0.05)',
          padding: '8px 12px',
          borderRadius: '0 6px 6px 0',
          margin: '8px 0',
          fontSize: '0.85rem',
          color: 'var(--text-main)',
          fontStyle: 'italic'
        }}>
          {formatInlineFormatting(trimmed.substring(2))}
        </div>
      );
    }
    // Empty line
    else if (!trimmed) {
      flushList();
    }
    // Regular paragraph
    else {
      flushList();
      elements.push(
        <p key={idx} style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.6, margin: '4px 0' }}>
          {formatInlineFormatting(line)}
        </p>
      );
    }
  });

  flushList();

  return <>{elements}</>;
}

/**
 * Parses inline bold **text**, italic *text*, and inline `code`
 */
function formatInlineFormatting(str) {
  if (!str) return '';

  const tokens = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(str.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={match.index} style={{ color: '#FFFFFF', fontWeight: 600 }}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code key={match.index} style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.82em',
          background: 'rgba(255, 255, 255, 0.07)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '1px 5px',
          borderRadius: '4px',
          color: '#FF6666'
        }}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={match.index} style={{ color: 'var(--text-muted)' }}>
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < str.length) {
    tokens.push(str.substring(lastIndex));
  }

  return tokens.length === 0 ? str : tokens;
}

/**
 * Basic syntax coloring for keywords and comments in code snippets
 */
function highlightSyntax(line, language) {
  if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
    return <span style={{ color: '#71717A', fontStyle: 'italic' }}>{line}</span>;
  }
  if (line.startsWith('+')) {
    return <span style={{ color: '#34D399' }}>{line}</span>;
  }
  if (line.startsWith('-')) {
    return <span style={{ color: '#FF4D4D' }}>{line}</span>;
  }
  return line;
}
