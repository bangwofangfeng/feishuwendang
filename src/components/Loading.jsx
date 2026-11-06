import { Loader2 } from 'lucide-react';

export default function Loading({ label = '正在读取' }) {
  return (
    <div className="loading-block">
      <Loader2 size={18} className="spin" />
      <span>{label}</span>
    </div>
  );
}
