"use client";

type ReportDialogProps = {
  open: boolean;
  title: string;
  description: string;
  reason: string;
  error?: string;
  placeholder?: string;
  submitting?: boolean;
  confirmLabel?: string;
  onChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ReportDialog({
  open,
  title,
  description,
  reason,
  error = "",
  placeholder = "请描述举报原因",
  submitting = false,
  confirmLabel = "确认举报",
  onChange,
  onCancel,
  onConfirm,
}: ReportDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#111827]/70 px-4">
      <section className="w-full max-w-md rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-ink)]">{title}</h2>
            <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="grid size-8 place-items-center rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] text-sm text-[var(--color-muted)] disabled:opacity-60"
            aria-label="关闭举报弹窗"
          >
            x
          </button>
        </div>

        <label className="mt-4 block">
          <span className="mb-2 block text-sm font-semibold text-[var(--color-ink)]">举报原因</span>
          <textarea
            value={reason}
            onChange={(event) => onChange(event.target.value)}
            rows={5}
            maxLength={1000}
            className="w-full resize-none rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-3 py-2 text-sm leading-6 text-[var(--color-ink)] outline-none focus:border-[var(--color-accent-strong)]"
            placeholder={placeholder}
          />
        </label>

        <div className="mt-2 text-sm">
          <span className={error ? "text-red-600" : "text-[var(--color-muted)]"}>
            {error || `${reason.trim().length}/1000`}
          </span>
        </div>

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="h-10 rounded-md border border-[var(--color-line)] bg-[var(--color-surface-solid)] px-4 text-sm font-semibold text-[var(--color-muted)] disabled:opacity-60"
          >
            取消
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-[#171717] disabled:opacity-60"
          >
            {submitting ? "提交中..." : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
