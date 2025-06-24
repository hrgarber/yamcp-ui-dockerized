import React, { useState } from 'react';
import { workspaceManager, WorkspaceConfig, PublishResult } from '../services/workspace-manager';

export interface WorkspacePublishProps {
  config: WorkspaceConfig;
  onPublishSuccess?: (result: PublishResult) => void;
  onPublishError?: (error: Error) => void;
  className?: string;
  disabled?: boolean;
}

export const WorkspacePublish: React.FC<WorkspacePublishProps> = ({
  config,
  onPublishSuccess,
  onPublishError,
  className = '',
  disabled = false,
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setIsPublishing(true);
    setError(null);

    try {
      // First validate the configuration
      const validation = await workspaceManager.validateConfig(config);
      
      if (!validation.valid) {
        throw new Error(`Invalid configuration: ${validation.errors?.join(', ')}`);
      }

      // Publish the workspace
      const result = await workspaceManager.publish(config);
      
      if (onPublishSuccess) {
        onPublishSuccess(result);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to publish workspace');
      setError(error.message);
      
      if (onPublishError) {
        onPublishError(error);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className={`workspace-publish ${className}`}>
      <button
        onClick={handlePublish}
        disabled={disabled || isPublishing}
        className={`publish-button ${isPublishing ? 'publishing' : ''}`}
        aria-label="Publish workspace"
      >
        {isPublishing ? (
          <>
            <span className="spinner" aria-hidden="true">⟳</span>
            Publishing...
          </>
        ) : (
          'Publish Workspace'
        )}
      </button>
      
      {error && (
        <div className="error-message" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

// CSS-in-JS styles for the component
const styles = `
  .workspace-publish {
    display: inline-block;
  }

  .publish-button {
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: #0066cc;
    color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .publish-button:hover:not(:disabled) {
    background-color: #0052a3;
  }

  .publish-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .publish-button.publishing {
    background-color: #666;
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

  .error-message {
    margin-top: 8px;
    padding: 8px 12px;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c00;
    font-size: 14px;
  }
`;

// Export styles for use in the application
export const workspacePublishStyles = styles;