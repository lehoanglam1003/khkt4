import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { VisualEvidenceItem } from '../types/safeai';

interface AnnotatedEvidenceOverlayProps {
  imageUrl: string;
  evidence: VisualEvidenceItem[];
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
}

const SEVERITY_COLORS: Record<VisualEvidenceItem['severity'], { stroke: string; badge: string }> = {
  high: { stroke: '#DC2626', badge: 'bg-red-600 text-white' },
  medium: { stroke: '#EA580C', badge: 'bg-orange-500 text-white' },
  low: { stroke: '#059669', badge: 'bg-emerald-600 text-white' },
};

export function AnnotatedEvidenceOverlay({
  imageUrl,
  evidence,
  selectedIndex,
  onSelectIndex,
}: AnnotatedEvidenceOverlayProps) {
  const [showOverlay, setShowOverlay] = useState(true);

  const annotatedItems = evidence
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => Boolean(item.bbox));

  if (annotatedItems.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">
          Khoanh vùng dấu hiệu trực tiếp trên ảnh ({annotatedItems.length} điểm)
        </p>
        <button
          type="button"
          onClick={() => setShowOverlay((v) => !v)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100"
        >
          {showOverlay ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span>{showOverlay ? 'Ẩn khung khoanh vùng' : 'Hiện khung khoanh vùng'}</span>
        </button>
      </div>

      <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-slate-300 bg-white">
        <img
          src={imageUrl}
          alt="Ảnh đã được SafeAI khoanh vùng các điểm nghi vấn"
          className="block max-h-96 w-auto max-w-full object-contain"
        />

        {showOverlay &&
          annotatedItems.map(({ item, index }) => {
            const box = item.bbox!;
            const colors = SEVERITY_COLORS[item.severity];
            const isSelected = selectedIndex === index;
            const leftPct = (box.x / 1000) * 100;
            const topPct = (box.y / 1000) * 100;
            const widthPct = (box.w / 1000) * 100;
            const heightPct = (box.h / 1000) * 100;

            return (
              <button
                key={index}
                type="button"
                onClick={() => onSelectIndex(isSelected ? null : index)}
                aria-label={`Điểm nghi vấn ${index + 1}: ${item.category}`}
                style={{
                  left: `${leftPct}%`,
                  top: `${topPct}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  borderColor: colors.stroke,
                }}
                className={`absolute rounded border-2 transition-all ${
                  isSelected ? 'bg-red-500/15 ring-2 ring-white' : 'bg-transparent hover:bg-amber-400/10'
                }`}
              >
                <span
                  className={`absolute -top-3 -left-1 inline-flex h-6 min-w-[24px] items-center justify-center rounded px-1.5 text-xs font-bold tabular-nums shadow-xs ${colors.badge}`}
                >
                  {index + 1}
                </span>
              </button>
            );
          })}
      </div>

      <p className="mt-2 text-xs text-slate-600">
        Bấm vào số thứ tự trên ảnh hoặc thẻ bằng chứng bên dưới để đối chiếu vị trí chính xác.
      </p>
    </div>
  );
}
