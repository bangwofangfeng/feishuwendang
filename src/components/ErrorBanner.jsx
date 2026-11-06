import { AlertTriangle, RotateCw } from 'lucide-react';
import { errorMessage } from '../utils.js';

export default function ErrorBanner({ error, onRetry, title = '操作没有完成' }) {
  if (!error) return null;
  return (
    <div className="error-banner" role="alert">
      <AlertTriangle size={17} />
      <div className="error-body">
        <strong>{title}</strong>
        <p>{errorMessage(error)}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          <RotateCw size={13} />
          重试
        </button>
      )}
    </div>
  );
}
