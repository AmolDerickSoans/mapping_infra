import React from 'react';

interface StatusChipProps {
  status: string;
  onRemove: (status: string) => void;
}

const StatusChip: React.FC<StatusChipProps> = ({ status, onRemove }) => {
  return (
    <div className="status-chip">
      <span className="chip-text">{status}</span>
      <button
        className="chip-remove"
        onClick={() => onRemove(status)}
        aria-label={`Remove ${status} filter`}
      >
        ×
      </button>
    </div>
  );
};

export default StatusChip;