import React from 'react';

interface StatusChipProps {
  status: string;
  onRemove: (status: string) => void;
}

// Map long status names to short codes
const getShortStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'Operating': 'OP',
    'Planned': 'PL',
    'Retired': 'RT',
    'Under Construction': 'UC',
    'Cancelled': 'CN',
    'Suspended': 'SP',
    'Standby': 'SB',
    'Out of Service': 'OOS',
    'Mothballed': 'MB',
    'Decommissioned': 'DC',
    'N/A': 'N/A'
  };

  return statusMap[status] || status.substring(0, 4).toUpperCase(); // Fallback to first 4 chars uppercase
};

const StatusChip: React.FC<StatusChipProps> = ({ status, onRemove }) => {
  const shortStatus = getShortStatus(status);

  return (
    <div className="status-chip">
      <span className="chip-text" title={status}>{shortStatus}</span>
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