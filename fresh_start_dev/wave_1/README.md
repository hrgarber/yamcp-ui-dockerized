# Wave 1: Multi-Container Architecture Development

**Status**: Ideation Phase  
**Created**: 2025-01-16

## Overview

This wave explores a fundamental architectural shift: separating the management plane from workspace runtime using a multi-container approach with dynamic "publishing" of workspaces.

## Key Innovation: Publish Button

Instead of running all workspaces in one container, each workspace can be "published" as its own container:
- **Manager Container**: Handles UI, configuration, orchestration
- **Workspace Containers**: Individual runtime per workspace

## Documents in This Wave

### 1. [Multi-Container Architecture](./multi_container_architecture.md)
Core ideation around separating management from runtime. Explores benefits of isolation, scaling, and dynamic publishing.

### 2. [Workspace Runtime Analysis](./workspace_runtime_analysis.md)
Deep comparison of three approaches for workspace containers:
- SuperGateway orchestration
- FastMCP native aggregation  
- YAMCP direct usage

### 3. [Dynamic Publishing Design](./dynamic_publishing_design.md)
Complete workflow for the "publish" button:
- Container creation and lifecycle
- Port management
- Health monitoring
- UI integration

## Key Decisions

### Architecture Choice: Multi-Container
- **Rationale**: Better isolation, scaling, and debugging
- **Trade-off**: More complex orchestration

### Runtime Recommendation: FastMCP First
- **Rationale**: Native aggregation, single process, clean API
- **Fallback**: SuperGateway if FastMCP has issues

### Publishing Model: On-Demand
- **Rationale**: Resource efficiency, easy rollback
- **Implementation**: Docker API integration

## Next Steps

1. **Proof of Concept**: Build minimal FastMCP aggregator
2. **Manager API**: Implement publish/unpublish endpoints
3. **UI Enhancement**: Add publish button to workspace cards
4. **Testing**: Multi-workspace scenarios

## Questions Resolved

✅ Should we use multiple containers? **Yes** - isolation wins  
✅ How to aggregate in workspace container? **FastMCP mount()**  
✅ How to handle ports? **Dynamic allocation 8700-8799**  
✅ When to create containers? **On-demand via publish button**

## Open Questions

- Health check frequency and failure handling?
- Persistent volumes for workspace state?
- Resource limits per workspace?
- Authentication between manager and workspaces?

## Success Criteria

1. Manager can create/destroy workspace containers
2. Each workspace accessible via unique port
3. Tool discovery shows all servers in workspace
4. Containers restart on failure
5. UI shows real-time workspace status