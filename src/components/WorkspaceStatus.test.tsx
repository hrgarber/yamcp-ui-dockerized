import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { WorkspaceStatus, WorkspaceStatusProps } from './WorkspaceStatus';
import { workspaceManager, WorkspaceStatus as WorkspaceStatusType } from '../services/workspace-manager';

// Mock the workspace manager
jest.mock('../services/workspace-manager', () => ({
  workspaceManager: {
    getStatus: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock timers
jest.useFakeTimers();

describe('WorkspaceStatus', () => {
  const mockStatus: WorkspaceStatusType = {
    id: 'test-workspace',
    state: 'running',
    port: 8080,
    url: 'http://localhost:8080',
    lastChecked: new Date().toISOString(),
    config: {
      id: 'test-workspace',
      name: 'Test Workspace',
      servers: [],
    },
  };

  const defaultProps: WorkspaceStatusProps = {
    workspaceId: 'test-workspace',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
  });

  it('should show loading state initially', async () => {
    (workspaceManager.getStatus as jest.Mock).mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );

    render(<WorkspaceStatus {...defaultProps} />);
    
    expect(screen.getByText('Loading status...')).toBeInTheDocument();
    expect(screen.getByText('⟳')).toBeInTheDocument();
  });

  it('should display workspace status when loaded', async () => {
    (workspaceManager.getStatus as jest.Mock).mockResolvedValue(mockStatus);

    render(<WorkspaceStatus {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
      expect(screen.getByText('running')).toBeInTheDocument();
      expect(screen.getByText('8080')).toBeInTheDocument();
      expect(screen.getByText('http://localhost:8080')).toBeInTheDocument();
    });
  });

  it('should display different status badges correctly', async () => {
    const statuses: Array<WorkspaceStatusType['state']> = ['running', 'starting', 'error', 'stopped'];
    
    for (const state of statuses) {
      (workspaceManager.getStatus as jest.Mock).mockResolvedValue({
        ...mockStatus,
        state,
      });

      const { rerender } = render(<WorkspaceStatus {...defaultProps} key={state} />);

      await waitFor(() => {
        expect(screen.getByText(state)).toBeInTheDocument();
      });

      rerender(<WorkspaceStatus {...defaultProps} workspaceId={`${state}-workspace`} />);
    }
  });

  it('should handle error states', async () => {
    (workspaceManager.getStatus as jest.Mock).mockRejectedValue(
      new Error('Failed to connect to server')
    );

    render(<WorkspaceStatus {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error: Failed to connect to server');
    });
  });

  it('should refresh status at specified interval', async () => {
    let callCount = 0;
    (workspaceManager.getStatus as jest.Mock).mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ...mockStatus,
        lastChecked: new Date(Date.now() + callCount * 1000).toISOString(),
      });
    });

    render(<WorkspaceStatus {...defaultProps} refreshInterval={1000} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    });

    expect(callCount).toBe(1);

    // Fast-forward time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(callCount).toBe(2);
    });

    // Fast-forward again
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(callCount).toBe(3);
    });
  });

  it('should call onStatusChange when status updates', async () => {
    const onStatusChange = jest.fn();
    (workspaceManager.getStatus as jest.Mock).mockResolvedValue(mockStatus);

    render(<WorkspaceStatus {...defaultProps} onStatusChange={onStatusChange} />);

    await waitFor(() => {
      expect(onStatusChange).toHaveBeenCalledWith(mockStatus);
    });
  });

  it('should show delete confirmation dialog', async () => {
    (workspaceManager.getStatus as jest.Mock).mockResolvedValue(mockStatus);

    render(<WorkspaceStatus {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    });

    const deleteButton = screen.getByText('Delete Workspace');
    fireEvent.click(deleteButton);

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByText('Yes, Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should delete workspace when confirmed', async () => {
    const onDelete = jest.fn();
    (workspaceManager.getStatus as jest.Mock).mockResolvedValue(mockStatus);
    (workspaceManager.delete as jest.Mock).mockResolvedValue(undefined);

    render(<WorkspaceStatus {...defaultProps} onDelete={onDelete} />);

    await waitFor(() => {
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    });

    // Click delete
    fireEvent.click(screen.getByText('Delete Workspace'));
    
    // Confirm deletion
    fireEvent.click(screen.getByText('Yes, Delete'));

    await waitFor(() => {
      expect(workspaceManager.delete).toHaveBeenCalledWith('test-workspace');
      expect(onDelete).toHaveBeenCalled();
    });
  });

  it('should cancel delete when cancel is clicked', async () => {
    (workspaceManager.getStatus as jest.Mock).mockResolvedValue(mockStatus);

    render(<WorkspaceStatus {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    });

    // Click delete
    fireEvent.click(screen.getByText('Delete Workspace'));
    
    // Click cancel
    fireEvent.click(screen.getByText('Cancel'));

    expect(screen.queryByText('Are you sure?')).not.toBeInTheDocument();
    expect(screen.getByText('Delete Workspace')).toBeInTheDocument();
  });

  it('should handle delete errors', async () => {
    (workspaceManager.getStatus as jest.Mock).mockResolvedValue(mockStatus);
    (workspaceManager.delete as jest.Mock).mockRejectedValue(
      new Error('Cannot delete running workspace')
    );

    render(<WorkspaceStatus {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    });

    // Click delete and confirm
    fireEvent.click(screen.getByText('Delete Workspace'));
    fireEvent.click(screen.getByText('Yes, Delete'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Cannot delete running workspace');
    });
  });

  it('should hide delete button when showDeleteButton is false', async () => {
    (workspaceManager.getStatus as jest.Mock).mockResolvedValue(mockStatus);

    render(<WorkspaceStatus {...defaultProps} showDeleteButton={false} />);

    await waitFor(() => {
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    });

    expect(screen.queryByText('Delete Workspace')).not.toBeInTheDocument();
  });

  it('should display error message from status', async () => {
    (workspaceManager.getStatus as jest.Mock).mockResolvedValue({
      ...mockStatus,
      state: 'error' as const,
      error: 'Failed to start server: port already in use',
    });

    render(<WorkspaceStatus {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to start server: port already in use')).toBeInTheDocument();
    });
  });

  it('should clean up interval on unmount', async () => {
    (workspaceManager.getStatus as jest.Mock).mockResolvedValue(mockStatus);

    const { unmount } = render(<WorkspaceStatus {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Test Workspace')).toBeInTheDocument();
    });

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});