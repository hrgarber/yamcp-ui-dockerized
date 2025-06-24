import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { WorkspaceConfigTemplates } from './WorkspaceConfigTemplates';
import { WorkspaceConfig } from '../services/workspace-manager';

describe('WorkspaceConfigTemplates', () => {
  const mockOnSelectTemplate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all template cards', () => {
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    expect(screen.getByText('GitHub + Filesystem')).toBeInTheDocument();
    expect(screen.getByText('Database + API Servers')).toBeInTheDocument();
    expect(screen.getByText('Full Development Environment')).toBeInTheDocument();
    expect(screen.getByText('Minimal Setup')).toBeInTheDocument();
  });

  it('shows template preview when clicking on a template', () => {
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    const githubTemplate = screen.getByText('GitHub + Filesystem').closest('.template-card');
    fireEvent.click(githubTemplate!);
    
    expect(screen.getByText('Template Configuration')).toBeInTheDocument();
    expect(screen.getByText('Use This Template')).toBeInTheDocument();
    expect(screen.getByText('Customize')).toBeInTheDocument();
  });

  it('calls onSelectTemplate when applying a template', () => {
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    const githubTemplate = screen.getByText('GitHub + Filesystem').closest('.template-card');
    fireEvent.click(githubTemplate!);
    
    const applyButton = screen.getByText('Use This Template');
    fireEvent.click(applyButton);
    
    expect(mockOnSelectTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'GitHub Development Workspace',
        servers: expect.arrayContaining([
          expect.objectContaining({
            name: 'GitHub',
            type: 'github'
          })
        ])
      })
    );
  });

  it('allows customizing template configuration', () => {
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    const githubTemplate = screen.getByText('GitHub + Filesystem').closest('.template-card');
    fireEvent.click(githubTemplate!);
    
    const customizeButton = screen.getByText('Customize');
    fireEvent.click(customizeButton);
    
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
    expect(screen.getByText('Apply Custom Configuration')).toBeInTheDocument();
  });

  it('validates JSON when applying custom configuration', () => {
    window.alert = jest.fn();
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    const githubTemplate = screen.getByText('GitHub + Filesystem').closest('.template-card');
    fireEvent.click(githubTemplate!);
    
    const customizeButton = screen.getByText('Customize');
    fireEvent.click(customizeButton);
    
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'invalid json' } });
    
    const applyButton = screen.getByText('Apply Custom Configuration');
    fireEvent.click(applyButton);
    
    expect(window.alert).toHaveBeenCalledWith('Invalid JSON configuration');
    expect(mockOnSelectTemplate).not.toHaveBeenCalled();
  });

  it('applies valid custom configuration', () => {
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    const githubTemplate = screen.getByText('GitHub + Filesystem').closest('.template-card');
    fireEvent.click(githubTemplate!);
    
    const customizeButton = screen.getByText('Customize');
    fireEvent.click(customizeButton);
    
    const customConfig = {
      name: 'Custom Workspace',
      servers: [{
        name: 'Custom Server',
        type: 'custom',
        config: {}
      }]
    };
    
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: JSON.stringify(customConfig, null, 2) } });
    
    const applyButton = screen.getByText('Apply Custom Configuration');
    fireEvent.click(applyButton);
    
    expect(mockOnSelectTemplate).toHaveBeenCalledWith(customConfig);
  });

  it('cancels customization and returns to preview', () => {
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    const githubTemplate = screen.getByText('GitHub + Filesystem').closest('.template-card');
    fireEvent.click(githubTemplate!);
    
    const customizeButton = screen.getByText('Customize');
    fireEvent.click(customizeButton);
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('Use This Template')).toBeInTheDocument();
  });

  it('handles keyboard navigation for template selection', () => {
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    const githubTemplate = screen.getByText('GitHub + Filesystem').closest('.template-card');
    githubTemplate!.focus();
    
    fireEvent.keyPress(githubTemplate!, { key: 'Enter' });
    expect(screen.getByText('Template Configuration')).toBeInTheDocument();
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    githubTemplate!.focus();
    fireEvent.keyPress(githubTemplate!, { key: ' ' });
    expect(screen.getByText('Template Configuration')).toBeInTheDocument();
  });

  it('highlights selected template', () => {
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    const githubTemplate = screen.getByText('GitHub + Filesystem').closest('.template-card');
    expect(githubTemplate).not.toHaveClass('selected');
    
    fireEvent.click(githubTemplate!);
    expect(githubTemplate).toHaveClass('selected');
  });

  it('clears selection after applying template', () => {
    render(<WorkspaceConfigTemplates onSelectTemplate={mockOnSelectTemplate} />);
    
    const githubTemplate = screen.getByText('GitHub + Filesystem').closest('.template-card');
    fireEvent.click(githubTemplate!);
    expect(githubTemplate).toHaveClass('selected');
    
    const applyButton = screen.getByText('Use This Template');
    fireEvent.click(applyButton);
    
    expect(githubTemplate).not.toHaveClass('selected');
    expect(screen.queryByText('Template Configuration')).not.toBeInTheDocument();
  });
});