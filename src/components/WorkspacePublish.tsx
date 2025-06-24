import React, { useState, useEffect } from 'react';
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
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);

  // Validate config whenever it changes
  useEffect(() => {
    const validateConfiguration = async () => {
      setIsValidating(true);
      try {
        const validation = await workspaceManager.validateConfig(config);
        setValidationErrors(validation.errors || []);
      } catch (err) {
        setValidationErrors(['Failed to validate configuration']);
      } finally {
        setIsValidating(false);
      }
    };

    validateConfiguration();
  }, [config]);

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

  const hasValidationErrors = validationErrors.length > 0;
  const isDisabled = disabled || isPublishing || isValidating || hasValidationErrors;

  return (
    <div className={`workspace-publish ${className}`}>
      {hasValidationErrors && (
        <div className="validation-errors" role="alert">
          <h4 className="validation-title">Configuration Errors:</h4>
          <ul className="validation-list">
            {validationErrors.map((error, index) => (
              <li key={index} className="validation-error">
                {error}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <button
        onClick={handlePublish}
        disabled={isDisabled}
        className={`publish-button ${isPublishing ? 'publishing' : ''} ${hasValidationErrors ? 'invalid' : ''}`}
        aria-label="Publish workspace"
        title={hasValidationErrors ? 'Fix configuration errors before publishing' : 'Publish workspace'}
      >
        {isValidating ? (
          <>
            <span className="spinner" aria-hidden="true">⟳</span>
            Validating...
          </>
        ) : isPublishing ? (
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

  .publish-button.invalid {
    background-color: #6c757d;
    cursor: not-allowed;
  }

  .validation-errors {
    margin-bottom: 12px;
    padding: 12px;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
  }

  .validation-title {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: 600;
    color: #c00;
  }

  .validation-list {
    margin: 0;
    padding-left: 20px;
    list-style-type: disc;
  }

  .validation-error {
    color: #c00;
    font-size: 13px;
    margin-bottom: 4px;
  }

  .validation-error:last-child {
    margin-bottom: 0;
  }
`;

// Export styles for use in the application
export const workspacePublishStyles = styles;