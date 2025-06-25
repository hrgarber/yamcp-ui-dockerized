import React from 'react';

export type StatusDotStatus = 'running' | 'starting' | 'unhealthy' | 'stopped';

interface StatusDotProps {
  status: StatusDotStatus;
}

export const StatusDot: React.FC<StatusDotProps> = ({ status }) => {
  const colorMap: Record<StatusDotStatus, string> = {
    running: 'bg-green-500',
    starting: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
    stopped: 'bg-gray-500'
  };

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colorMap[status]}`}
      aria-label={`Status: ${status}`}
    />
  );
};