import React from 'react';
import { ASSISTANT_LANGS, type AssistantLang } from './assistantI18n';

export const LanguageSelector: React.FC<{ value: AssistantLang; onChange: (l: AssistantLang) => void }> = ({
  value,
  onChange,
}) => (
  <label className="inline-flex items-center gap-1.5 text-xs">
    <span className="material-symbols-outlined text-[16px] text-on-surface-variant" aria-hidden="true">translate</span>
    <span className="sr-only">Response language</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AssistantLang)}
      aria-label="Response language"
      className="h-9 px-2 rounded-lg bg-surface-container-lowest text-on-surface text-xs font-semibold border border-outline-variant/40 outline-none focus:border-primary cursor-pointer"
    >
      {ASSISTANT_LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  </label>
);
