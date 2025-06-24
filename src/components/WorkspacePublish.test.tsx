import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspacePublish, WorkspacePublishProps } from './WorkspacePublish';
import { workspaceManager, WorkspaceConfig } from '../services/workspace-manager';

// Mock the workspace manager
jest.mock('../services/workspace-manager', () => ({
  workspaceManager: {
    validateConfig: jest.fn(),
    publish: jest.fn(),
  },
}));

describe('WorkspacePublish', () => {
  const mockConfig: WorkspaceConfig = {
    id: 'test-workspace',
    name: 'Test Workspace',
    servers: [
      {
        name: 'server1',
        type: 'filesystem',
        config: { path: '/tmp' },
      },
    ],
  };

  const defaultProps: WorkspacePublishProps = {
    config: mockConfig,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render publish button', () => {
    render(<WorkspacePublish {...defaultProps} />);
    
    const button = screen.getByRole('button', { name: 'Publish workspace' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Publish Workspace');
  });

  it('should show loading state when publishing', async () => {
    (workspaceManager.validateConfig as jest.Mock).mockResolvedValueOnce({ valid: true });
    (workspaceManager.publish as jest.Mock).mockImplementation(() => 
      new Promise(resolve => setTimeout(resolve, 100))
    );

    render(<WorkspacePublish {...defaultProps} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(button).toHaveTextContent('Publishing...');
    expect(button).toBeDisabled();
    expect(screen.getByText('⟳')).toBeInTheDocument();
  });

  it('should successfully publish workspace', async () => {
    const mockResult = {
      id: 'test-workspace',
      port: 8080,
      message: 'Workspace published successfully',
    };

    const onPublishSuccess = jest.fn();
    (workspaceManager.validateConfig as jest.Mock).mockResolvedValueOnce({ valid: true });
    (workspaceManager.publish as jest.Mock).mockResolvedValueOnce(mockResult);

    render(<WorkspacePublish {...defaultProps} onPublishSuccess={onPublishSuccess} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(onPublishSuccess).toHaveBeenCalledWith(mockResult);
    });

    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Publish Workspace');
  });

  it('should handle validation errors', async () => {
    const validationErrors = ['ID is required', 'Name is required'];
    const onPublishError = jest.fn();

    (workspaceManager.validateConfig as jest.Mock).mockResolvedValueOnce({
      valid: false,
      errors: validationErrors,
    });

    render(<WorkspacePublish {...defaultProps} onPublishError={onPublishError} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('Invalid configuration: ID is required, Name is required');
    });

    expect(onPublishError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Invalid configuration: ID is required, Name is required',
      })
    );
  });

  it('should handle publish errors', async () => {
    const onPublishError = jest.fn();
    (workspaceManager.validateConfig as jest.Mock).mockResolvedValueOnce({ valid: true });
    (workspaceManager.publish as jest.Mock).mockRejectedValueOnce(
      new Error('Failed to connect to manager service')
    );

    render(<WorkspacePublish {...defaultProps} onPublishError={onPublishError} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('Failed to connect to manager service');
    });

    expect(onPublishError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Failed to connect to manager service',
      })
    );
  });

  it('should be disabled when disabled prop is true', () => {
    render(<WorkspacePublish {...defaultProps} disabled={true} />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should apply custom className', () => {
    render(<WorkspacePublish {...defaultProps} className="custom-class" />);
    
    const container = screen.getByRole('button').parentElement;
    expect(container).toHaveClass('workspace-publish', 'custom-class');
  });

  it('should clear error message on retry', async () => {
    (workspaceManager.validateConfig as jest.Mock)
      .mockResolvedValueOnce({ valid: false, errors: ['Error'] })
      .mockResolvedValueOnce({ valid: true });
    (workspaceManager.publish as jest.Mock).mockResolvedValueOnce({
      id: 'test-workspace',
      port: 8080,
      message: 'Success',
    });

    render(<WorkspacePublish {...defaultProps} />);
    
    // First click - should show error
    const button = screen.getByRole('button');
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    // Second click - should clear error
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});