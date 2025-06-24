import React, { useState, useEffect, useRef } from 'react';
import { workspaceManager, WorkspaceStatus as WorkspaceStatusType } from '../services/workspace-manager';

export interface WorkspaceStatusProps {
  workspaceId: string;
  refreshInterval?: number; // in milliseconds, default 5000 (5 seconds)
  onStatusChange?: (status: WorkspaceStatusType) => void;
  onDelete?: () => void;
  showDeleteButton?: boolean;
  className?: string;
}

export const WorkspaceStatus: React.FC<WorkspaceStatusProps> = ({
  workspaceId,
  refreshInterval = 5000,
  onStatusChange,
  onDelete,
  showDeleteButton = true,
  className = '',
}) => {
  const [status, setStatus] = useState<WorkspaceStatusType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [configChanged, setConfigChanged] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const previousConfigRef = useRef<WorkspaceConfig | null>(null);

  const fetchStatus = async () => {
    try {
      const latestStatus = await workspaceManager.getStatus(workspaceId);
      
      if (mountedRef.current) {
        // Check if config has changed
        if (previousConfigRef.current && latestStatus.state === 'running') {
          const configDiff = JSON.stringify(previousConfigRef.current) !== JSON.stringify(latestStatus.config);
          setConfigChanged(configDiff);
        }
        previousConfigRef.current = latestStatus.config;

        setStatus(latestStatus);
        setError(null);
        setLoading(false);

        if (onStatusChange) {
          onStatusChange(latestStatus);
        }
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch status');
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Initial fetch
    fetchStatus();

    // Set up polling
    intervalRef.current = setInterval(fetchStatus, refreshInterval);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [workspaceId, refreshInterval]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await workspaceManager.delete(workspaceId);
      
      if (onDelete) {
        onDelete();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workspace');
      setIsDeleting(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setConfigChanged(false);
    await fetchStatus();
    setIsRefreshing(false);
  };

  const getStatusBadgeClass = (state: WorkspaceStatusType['state']) => {
    switch (state) {
      case 'running':
        return 'status-badge-running';
      case 'starting':
        return 'status-badge-starting';
      case 'error':
        return 'status-badge-error';
      case 'stopped':
      default:
        return 'status-badge-stopped';
    }
  };

  const getStatusIcon = (state: WorkspaceStatusType['state']) => {
    switch (state) {
      case 'running':
        return '✓';
      case 'starting':
        return '⟳';
      case 'error':
        return '✗';
      case 'stopped':
      default:
        return '•';
    }
  };

  if (loading) {
    return (
      <div className={`workspace-status loading ${className}`}>
        <div className="status-loading">
          <span className="spinner">⟳</span> Loading status...
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className={`workspace-status error ${className}`}>
        <div className="status-error" role="alert">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  return (
    <div className={`workspace-status ${className}`}>
      <div className="status-header">
        <h3 className="workspace-name">{status.config.name}</h3>
        <div className={`status-badge ${getStatusBadgeClass(status.state)}`}>
          <span className="status-icon" aria-hidden="true">
            {getStatusIcon(status.state)}
          </span>
          <span className="status-text">{status.state}</span>
        </div>
      </div>

      {configChanged && (
        <div className="config-warning">
          <span className="warning-icon">⚠️</span>
          <span className="warning-text">Configuration outdated</span>
          <button 
            onClick={handleRefresh} 
            className="refresh-button"
            disabled={isRefreshing}
            aria-label="Refresh workspace with new configuration"
          >
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      )}

      <div className="status-details">
        <div className="detail-row">
          <span className="detail-label">ID:</span>
          <span className="detail-value">{status.id}</span>
        </div>

        {status.port && (
          <div className="detail-row">
            <span className="detail-label">Port:</span>
            <span className="detail-value port-value">
              {status.port}
              {status.state === 'running' && (
                <button
                  onClick={() => copyToClipboard(String(status.port))}
                  className="copy-button"
                  aria-label="Copy port number"
                  title="Copy port"
                >
                  {copySuccess ? '✓' : '📋'}
                </button>
              )}
            </span>
          </div>
        )}

        {status.state === 'running' && status.port && (
          <div className="detail-row">
            <span className="detail-label">Connection URL:</span>
            <span className="detail-value url-container">
              <a 
                href={`http://localhost:${status.port}/sse`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="connection-url"
              >
                {`http://localhost:${status.port}/sse`}
              </a>
              <button
                onClick={() => copyToClipboard(`http://localhost:${status.port}/sse`)}
                className="copy-button"
                aria-label="Copy connection URL"
                title="Copy URL"
              >
                {copySuccess ? '✓' : '📋'}
              </button>
            </span>
          </div>
        )}

        {status.url && (
          <div className="detail-row">
            <span className="detail-label">URL:</span>
            <a href={status.url} target="_blank" rel="noopener noreferrer" className="detail-value url">
              {status.url}
            </a>
          </div>
        )}

        <div className="detail-row">
          <span className="detail-label">Last Checked:</span>
          <span className="detail-value">
            {new Date(status.lastChecked).toLocaleTimeString()}
          </span>
        </div>

        {status.error && (
          <div className="detail-row error-row">
            <span className="detail-label">Error:</span>
            <span className="detail-value error-message">{status.error}</span>
          </div>
        )}
      </div>

      {showDeleteButton && (
        <div className="status-actions">
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="delete-button"
              disabled={isDeleting}
            >
              Delete Workspace
            </button>
          ) : (
            <div className="delete-confirm">
              <span className="confirm-message">Are you sure?</span>
              <button
                onClick={handleDelete}
                className="confirm-button"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="cancel-button"
                disabled={isDeleting}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="status-error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

// CSS-in-JS styles for the component
const styles = `
  .workspace-status {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 16px;
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .workspace-status.loading {
    text-align: center;
    color: #666;
  }

  .status-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
  }

  .spinner {
    display: inline-block;
    animation: spin 1s linear infinite;
    font-size: 16px;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .status-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .workspace-name {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .status-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 14px;
    font-weight: 500;
  }

  .status-badge-running {
    background-color: #d4f4dd;
    color: #1a7f37;
  }

  .status-badge-starting {
    background-color: #fff3cd;
    color: #856404;
  }

  .status-badge-error {
    background-color: #fee;
    color: #c00;
  }

  .status-badge-stopped {
    background-color: #f0f0f0;
    color: #666;
  }

  .status-icon {
    font-size: 12px;
  }

  .status-details {
    border-top: 1px solid #eee;
    padding-top: 12px;
    margin-bottom: 16px;
  }

  .detail-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 14px;
  }

  .detail-label {
    font-weight: 500;
    color: #666;
    min-width: 100px;
  }

  .detail-value {
    color: #333;
  }

  .detail-value.url {
    color: #0066cc;
    text-decoration: none;
  }

  .detail-value.url:hover {
    text-decoration: underline;
  }

  .port-value, .url-container {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .connection-url {
    color: #0066cc;
    text-decoration: none;
    font-family: monospace;
    background-color: #f5f5f5;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .connection-url:hover {
    text-decoration: underline;
  }

  .copy-button {
    padding: 2px 6px;
    font-size: 12px;
    border: 1px solid #ddd;
    border-radius: 3px;
    background-color: #fff;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .copy-button:hover {
    background-color: #f0f0f0;
  }

  .config-warning {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background-color: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 4px;
    margin-bottom: 12px;
    font-size: 14px;
  }

  .warning-icon {
    font-size: 16px;
  }

  .warning-text {
    flex: 1;
    color: #856404;
  }

  .refresh-button {
    padding: 4px 12px;
    font-size: 13px;
    border: 1px solid #ffc107;
    border-radius: 3px;
    background-color: #ffc107;
    color: #212529;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .refresh-button:hover:not(:disabled) {
    background-color: #e0a800;
    border-color: #e0a800;
  }

  .refresh-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-row {
    color: #c00;
  }

  .error-message {
    color: #c00;
  }

  .status-actions {
    border-top: 1px solid #eee;
    padding-top: 12px;
  }

  .delete-button {
    padding: 6px 12px;
    font-size: 14px;
    border: 1px solid #c00;
    border-radius: 4px;
    background-color: #fff;
    color: #c00;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .delete-button:hover:not(:disabled) {
    background-color: #c00;
    color: #fff;
  }

  .delete-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .delete-confirm {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .confirm-message {
    font-size: 14px;
    color: #666;
  }

  .confirm-button {
    padding: 6px 12px;
    font-size: 14px;
    border: 1px solid #c00;
    border-radius: 4px;
    background-color: #c00;
    color: #fff;
    cursor: pointer;
  }

  .cancel-button {
    padding: 6px 12px;
    font-size: 14px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: #fff;
    color: #333;
    cursor: pointer;
  }

  .status-error-message {
    margin-top: 12px;
    padding: 8px 12px;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c00;
    font-size: 14px;
  }

  .status-error {
    text-align: center;
    padding: 20px;
    color: #c00;
  }
`;

// Export styles for use in the application
export const workspaceStatusStyles = styles;