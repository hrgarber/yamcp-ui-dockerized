import React, { useState } from 'react';
import { WorkspaceConfig } from '../services/workspace-manager';

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: Partial<WorkspaceConfig>;
}

export interface WorkspaceConfigTemplatesProps {
  onSelectTemplate: (config: Partial<WorkspaceConfig>) => void;
  className?: string;
}

const templates: ConfigTemplate[] = [
  {
    id: 'github-filesystem',
    name: 'GitHub + Filesystem',
    description: 'Access GitHub repositories and local files',
    icon: '🔗',
    config: {
      name: 'GitHub Development Workspace',
      servers: [
        {
          name: 'GitHub',
          type: 'github',
          config: {
            url: 'https://api.github.com',
            token: '${GITHUB_TOKEN}',
            prefix: 'github'
          }
        },
        {
          name: 'Local Files',
          type: 'filesystem',
          config: {
            rootPath: '${HOME}/projects',
            allowedPaths: ['${HOME}/projects'],
            prefix: 'files'
          }
        }
      ]
    }
  },
  {
    id: 'database-api',
    name: 'Database + API Servers',
    description: 'Connect to databases and API endpoints',
    icon: '🗄️',
    config: {
      name: 'Data Services Workspace',
      servers: [
        {
          name: 'PostgreSQL',
          type: 'database',
          config: {
            url: 'postgresql://localhost:5432/mydb',
            connectionString: '${DATABASE_URL}',
            prefix: 'db'
          }
        },
        {
          name: 'REST API',
          type: 'custom',
          config: {
            url: 'https://api.example.com',
            token: '${API_TOKEN}',
            headers: {
              'Content-Type': 'application/json'
            },
            prefix: 'api'
          }
        }
      ]
    }
  },
  {
    id: 'dev-environment',
    name: 'Full Development Environment',
    description: 'Complete development setup with multiple services',
    icon: '💻',
    config: {
      name: 'Development Workspace',
      servers: [
        {
          name: 'GitHub',
          type: 'github',
          config: {
            url: 'https://api.github.com',
            token: '${GITHUB_TOKEN}',
            prefix: 'github'
          }
        },
        {
          name: 'GitLab',
          type: 'gitlab',
          config: {
            url: 'https://gitlab.com',
            token: '${GITLAB_TOKEN}',
            prefix: 'gitlab'
          }
        },
        {
          name: 'Local Files',
          type: 'filesystem',
          config: {
            rootPath: '${HOME}/dev',
            allowedPaths: ['${HOME}/dev', '/tmp'],
            prefix: 'local'
          }
        },
        {
          name: 'PostgreSQL',
          type: 'database',
          config: {
            url: 'postgresql://localhost:5432/devdb',
            connectionString: '${DATABASE_URL}',
            prefix: 'db'
          }
        }
      ],
      resources: {
        memory: '1024m',
        cpu: 1.0
      }
    }
  },
  {
    id: 'minimal',
    name: 'Minimal Setup',
    description: 'Basic single-service configuration',
    icon: '📦',
    config: {
      name: 'Simple Workspace',
      servers: [
        {
          name: 'Local Files',
          type: 'filesystem',
          config: {
            rootPath: '${PWD}',
            allowedPaths: ['${PWD}'],
            prefix: 'files'
          }
        }
      ],
      resources: {
        memory: '256m',
        cpu: 0.5
      }
    }
  }
];

export const WorkspaceConfigTemplates: React.FC<WorkspaceConfigTemplatesProps> = ({
  onSelectTemplate,
  className = ''
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [customizing, setCustomizing] = useState(false);
  const [customConfig, setCustomConfig] = useState<string>('');

  const handleSelectTemplate = (template: ConfigTemplate) => {
    setSelectedTemplate(template.id);
    setCustomConfig(JSON.stringify(template.config, null, 2));
  };

  const handleApplyTemplate = () => {
    if (customizing) {
      try {
        const parsed = JSON.parse(customConfig);
        onSelectTemplate(parsed);
        setCustomizing(false);
        setSelectedTemplate(null);
      } catch (error) {
        alert('Invalid JSON configuration');
      }
    } else if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        onSelectTemplate(template.config);
        setSelectedTemplate(null);
      }
    }
  };

  const handleCustomize = () => {
    setCustomizing(true);
  };

  const handleCancelCustomize = () => {
    setCustomizing(false);
    if (selectedTemplate) {
      const template = templates.find(t => t.id === selectedTemplate);
      if (template) {
        setCustomConfig(JSON.stringify(template.config, null, 2));
      }
    }
  };

  return (
    <div className={`workspace-config-templates ${className}`}>
      <h3 className="templates-title">Configuration Templates</h3>
      <p className="templates-description">
        Select a template to quickly set up your workspace configuration
      </p>

      <div className="templates-grid">
        {templates.map((template) => (
          <div
            key={template.id}
            className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
            onClick={() => handleSelectTemplate(template)}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleSelectTemplate(template);
              }
            }}
          >
            <div className="template-icon">{template.icon}</div>
            <h4 className="template-name">{template.name}</h4>
            <p className="template-description">{template.description}</p>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <div className="template-preview">
          <h4 className="preview-title">Template Configuration</h4>
          
          {customizing ? (
            <div className="config-editor">
              <textarea
                value={customConfig}
                onChange={(e) => setCustomConfig(e.target.value)}
                className="config-textarea"
                rows={15}
                spellCheck={false}
              />
              <div className="editor-hint">
                Edit the JSON configuration above. Environment variables like ${'{GITHUB_TOKEN}'} will be replaced at runtime.
              </div>
            </div>
          ) : (
            <pre className="config-preview">{customConfig}</pre>
          )}

          <div className="template-actions">
            {customizing ? (
              <>
                <button
                  onClick={handleApplyTemplate}
                  className="apply-button"
                >
                  Apply Custom Configuration
                </button>
                <button
                  onClick={handleCancelCustomize}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleApplyTemplate}
                  className="apply-button"
                >
                  Use This Template
                </button>
                <button
                  onClick={handleCustomize}
                  className="customize-button"
                >
                  Customize
                </button>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// CSS-in-JS styles for the component
const styles = `
  .workspace-config-templates {
    padding: 20px;
    background-color: #f8f9fa;
    border-radius: 8px;
  }

  .templates-title {
    margin: 0 0 8px 0;
    font-size: 20px;
    font-weight: 600;
    color: #333;
  }

  .templates-description {
    margin: 0 0 20px 0;
    color: #666;
    font-size: 14px;
  }

  .templates-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 20px;
  }

  .template-card {
    padding: 16px;
    background-color: #fff;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
  }

  .template-card:hover {
    border-color: #0066cc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .template-card.selected {
    border-color: #0066cc;
    background-color: #f0f8ff;
  }

  .template-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }

  .template-name {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .template-description {
    margin: 0;
    font-size: 13px;
    color: #666;
  }

  .template-preview {
    background-color: #fff;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
  }

  .preview-title {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .config-preview {
    background-color: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 12px;
    overflow-x: auto;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;
    margin: 0 0 16px 0;
  }

  .config-editor {
    margin-bottom: 16px;
  }

  .config-textarea {
    width: 100%;
    background-color: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    padding: 12px;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.5;
    resize: vertical;
  }

  .config-textarea:focus {
    outline: none;
    border-color: #0066cc;
  }

  .editor-hint {
    margin-top: 8px;
    font-size: 12px;
    color: #666;
    font-style: italic;
  }

  .template-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .apply-button, .customize-button, .cancel-button {
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid;
  }

  .apply-button {
    background-color: #0066cc;
    color: white;
    border-color: #0066cc;
  }

  .apply-button:hover {
    background-color: #0052a3;
  }

  .customize-button {
    background-color: #fff;
    color: #0066cc;
    border-color: #0066cc;
  }

  .customize-button:hover {
    background-color: #f0f8ff;
  }

  .cancel-button {
    background-color: #fff;
    color: #666;
    border-color: #ccc;
  }

  .cancel-button:hover {
    background-color: #f5f5f5;
  }
`;

// Export styles for use in the application
export const workspaceConfigTemplatesStyles = styles;