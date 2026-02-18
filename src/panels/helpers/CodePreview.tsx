import React, { forwardRef } from 'react';
import '../../styles/code-preview.css';

export interface CodePreviewProps {
  code: string;
  language?: string;
  className?: string;
}

export const CodePreview = forwardRef<HTMLDivElement, CodePreviewProps>(function CodePreview(
  { code, language = 'TSX', className = '' },
  ref,
) {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const highlighted = escape(code)
    .replace(/(\/\/.*$)/gm, '<span class="code-comment">$1</span>')
    .replace(/(".*?"|'.*?'|`.*?`)/g, '<span class="code-string">$1</span>')
    .replace(/\b(const|let|var|export|import|from|return|function|interface|type|class|extends|implements|as|new)\b/g, '<span class="code-keyword">$1</span>')
    .replace(/([A-Za-z_\$][\w\$]*)\s*(?=\()/g, '<span class="code-function">$1</span>');

  return (
    <div ref={ref} className={`code-preview-container ${className}`}>
      <div className="code-preview-header">
        <div className="code-preview-lang">{language}</div>
      </div>
      <pre className="code-preview-body" dangerouslySetInnerHTML={{ __html: highlighted }} />
    </div>
  );
});

export default CodePreview;
