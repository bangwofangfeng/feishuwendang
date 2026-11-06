import { typeLabel } from '../utils.js';

export default function TypeBadge({ type, compact = false }) {
  return (
    <span className={`type-badge type-${type}${compact ? ' compact' : ''}`}>
      <span className="type-mark" aria-hidden="true" />
      {typeLabel(type)}
    </span>
  );
}
