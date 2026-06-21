"use client";

import { KeyboardEvent, useState } from "react";

type TagEditorProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
};

export function TagEditor({ tags, onChange, disabled }: TagEditorProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const name = draft.trim();
    if (!name || name.length > 30) {
      setDraft("");
      return;
    }
    const exists = tags.some((tag) => tag.toLowerCase() === name.toLowerCase());
    if (!exists && tags.length < 9) {
      onChange([...tags, name]);
    }
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTag();
    }
    if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-md border border-stone-300 bg-white px-3 py-2 focus-within:border-moss focus-within:ring-2 focus-within:ring-moss/15">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tags.filter((item) => item !== tag))}
            className="rounded-md bg-stone-100 px-2 py-1 text-xs font-medium text-stone-700 hover:bg-stone-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {tag}
          </button>
        ))}
        <input
          value={draft}
          disabled={disabled || tags.length >= 9}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={addTag}
          onKeyDown={handleKeyDown}
          maxLength={30}
          className="min-w-32 flex-1 bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
      </div>
      <p className="mt-1 text-xs text-stone-500">{tags.length}/9</p>
    </div>
  );
}
