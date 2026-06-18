'use client';

import React from 'react';
import { RelationType } from '@/types/genogram';
import { Pos, SYMBOL } from '@/lib/layout';

interface Props {
  from: Pos;
  to: Pos;
  type: RelationType;
}

const COLORS: Record<RelationType, string> = {
  close: '#0D9488',
  veryClose: '#0D9488',
  distant: '#94A3B8',
  conflict: '#F59E0B',
  cutoff: '#64748B',
  hostile: '#DC2626',
};

/** 記号の縁で止めるため、両端を半径分だけ内側へ縮める */
const shrink = (from: Pos, to: Pos, pad: number) => {
  const dx = to.x - from.x, dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  return {
    x1: from.x + ux * pad, y1: from.y + uy * pad,
    x2: to.x - ux * pad, y2: to.y - uy * pad,
    ux, uy, px: -uy, py: ux, len: len - pad * 2,
  };
};

const zigzag = (x1: number, y1: number, x2: number, y2: number, amp: number, wave: number) => {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const n = Math.max(3, Math.round(len / wave));
  let d = `M ${x1} ${y1}`;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const bx = x1 + dx * t, by = y1 + dy * t;
    const s = (i % 2 === 0 ? 1 : -1) * amp;
    d += ` L ${bx + px * s} ${by + py * s}`;
  }
  return d + ` L ${x2} ${y2}`;
};

export const RelationLine: React.FC<Props> = ({ from, to, type }) => {
  const g = shrink(from, to, SYMBOL / 2 + 6);
  const color = COLORS[type];
  const { x1, y1, x2, y2, px, py } = g;

  const parallel = (o: number) => ({
    x1: x1 + px * o, y1: y1 + py * o, x2: x2 + px * o, y2: y2 + py * o,
  });

  switch (type) {
    case 'close': {
      const a = parallel(-2), b = parallel(2);
      return (
        <g>
          <line {...a} stroke={color} strokeWidth={1.6} />
          <line {...b} stroke={color} strokeWidth={1.6} />
        </g>
      );
    }
    case 'veryClose': {
      const a = parallel(-3.5), b = parallel(0), c = parallel(3.5);
      return (
        <g>
          <line {...a} stroke={color} strokeWidth={1.6} />
          <line {...b} stroke={color} strokeWidth={1.6} />
          <line {...c} stroke={color} strokeWidth={1.6} />
        </g>
      );
    }
    case 'distant':
      return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.6} strokeDasharray="6 5" />;
    case 'cutoff': {
      // 直線＋中央付近に2本の切断マーク
      const tickAt = (t: number) => {
        const cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t;
        return { x1: cx - px * 7, y1: cy - py * 7, x2: cx + px * 7, y2: cy + py * 7 };
      };
      return (
        <g>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={1.6} />
          <line {...tickAt(0.43)} stroke={color} strokeWidth={1.8} />
          <line {...tickAt(0.57)} stroke={color} strokeWidth={1.8} />
        </g>
      );
    }
    case 'conflict':
      return <path d={zigzag(x1, y1, x2, y2, 5, 14)} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" />;
    case 'hostile': {
      // 赤ジグザグ＋ to 側に矢印（虐待・敵対の方向）
      const ux = (x2 - x1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
      const uy = (y2 - y1) / (Math.hypot(x2 - x1, y2 - y1) || 1);
      const ax = x2, ay = y2;
      const back = 9, wing = 5;
      return (
        <g>
          <path d={zigzag(x1, y1, x2, y2, 6, 13)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          <polygon
            points={`${ax},${ay} ${ax - ux * back - (-uy) * wing},${ay - uy * back - ux * wing} ${ax - ux * back + (-uy) * wing},${ay - uy * back + ux * wing}`}
            fill={color}
          />
        </g>
      );
    }
    default:
      return null;
  }
};
