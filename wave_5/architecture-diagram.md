# Wave 5 Architecture Diagrams

## Complete System Architecture

```mermaid
graph TB
    subgraph "Frontend (Existing)"
        UI[React UI<br/>Shadcn/UI Components]
        Build[Vite Dev Server<br/>Port 5173]
    end
    
    subgraph "Original Backend (Broken)"
        ServerMJS[server.mjs<br/>Port 8765]
        YAMCP[YAMCP Module<br/>❌ Not Working]
        ServerMJS -.->|"Imports"| YAMCP
    end
    
    subgraph "New Backend (Wave 5)"
        FastAPI[FastAPI<br/>Port 8000]
        
        subgraph "Workspace Management"
            WS1[FastMCP Workspace 'dev']
            WS2[FastMCP Workspace 'prod']
            WSN[FastMCP Workspace N]
        end
        
        subgraph "MCP Servers"
            GitHub[GitHub MCP Server]
            FS[Filesystem MCP Server]
            DB[Database MCP Server]
        end
    end
    
    UI -->|"API Calls"| Build
    Build -->|"Proxy /api/*"| FastAPI
    
    FastAPI -->|"mount()"| WS1
    FastAPI -->|"mount()"| WS2
    FastAPI -->|"mount()"| WSN
    
    WS1 -->|"Aggregates"| GitHub
    WS1 -->|"Aggregates"| FS
    WS2 -->|"Aggregates"| DB
    
    Client[MCP Client<br/>Claude, etc.] -->|"SSE/HTTP"| FastAPI
    FastAPI -->|"/workspace/dev/*"| WS1
    FastAPI -->|"/workspace/prod/*"| WS2
    
    style YAMCP fill:#ff6666
    style UI fill:#90EE90
    style FastAPI fill:#87CEEB
    style WS1 fill:#FFE4B5
    style WS2 fill:#FFE4B5
```

## Data Flow for Workspace Creation

```mermaid
sequenceDiagram
    participant User
    participant UI as React UI
    participant API as FastAPI Backend
    participant FMC as FastMCP
    participant MCP as MCP Servers
    
    User->>UI: Configure workspace<br/>(name, servers)
    UI->>UI: Build config JSON
    
    Note over UI: {<br/>  "name": "dev",<br/>  "servers": {<br/>    "github": {...},<br/>    "filesystem": {...}<br/>  }<br/>}
    
    User->>UI: Click "Publish"
    UI->>API: POST /api/workspaces<br/>with config
    
    API->>FMC: Create FastMCP instance
    API->>FMC: Mount MCP servers
    
    loop For each server
        FMC->>MCP: Initialize server
        MCP-->>FMC: Server ready
    end
    
    API->>API: Mount at /workspace/dev/
    API-->>UI: {<br/>  "status": "running",<br/>  "path": "/workspace/dev/"<br/>}
    
    UI->>UI: Show success
    UI->>User: Display workspace URL
```

## Component Interaction Diagram

```mermaid
graph LR
    subgraph "UI Components"
        Dashboard[Dashboard.tsx]
        Workspaces[Workspaces.tsx]
        AddDialog[AddWorkspaceDialog.tsx]
        ConfigDialog[WorkspaceConfigDialog.tsx]
    end
    
    subgraph "API Endpoints"
        Stats[GET /api/stats]
        WSList[GET /api/workspaces]
        WSCreate[POST /api/workspaces]
        WSDelete[DELETE /api/workspaces/:id]
    end
    
    subgraph "FastMCP Backend"
        Models[Pydantic Models]
        Docker[Docker Manager]
        Routes[API Routes]
    end
    
    Dashboard -->|"Polls"| Stats
    Workspaces -->|"Fetches"| WSList
    AddDialog -->|"Submits"| WSCreate
    ConfigDialog -->|"Updates"| WSCreate
    
    Stats -->|"Returns"| Routes
    WSList -->|"Returns"| Routes
    WSCreate -->|"Uses"| Models
    WSCreate -->|"Calls"| Docker
    
    Routes -->|"Manages"| Docker
```

## Simplified Mental Model

```mermaid
graph TD
    A[User Configures in UI] -->|"JSON Config"| B[FastAPI Backend]
    B -->|"Creates"| C[FastMCP Instance]
    C -->|"Mounts"| D[MCP Servers]
    D -->|"Exposed at"| E[/workspace/name/]
    
    F[MCP Client] -->|"Connects to"| E
    
    style A fill:#90EE90
    style B fill:#87CEEB
    style C fill:#FFE4B5
    style E fill:#DDA0DD
```

## Port Mapping

```mermaid
graph TB
    subgraph "Development Setup"
        UI[UI Dev Server<br/>:5173]
        API[FastAPI<br/>:8000]
        UI -->|"Proxied /api/*"| API
    end
    
    subgraph "Production Setup"
        NGINX[Nginx<br/>:3000]
        APIP[FastAPI<br/>:8000]
        UIP[UI Static Files]
        
        NGINX -->|"/"| UIP
        NGINX -->|"/api/*"| APIP
        NGINX -->|"/workspace/*"| APIP
    end
    
    subgraph "Workspace Routing"
        Route1[/workspace/dev/]
        Route2[/workspace/prod/]
        Route3[/workspace/test/]
    end
    
    API --> Route1
    API --> Route2
    API --> Route3
    APIP --> Route1
    APIP --> Route2
    APIP --> Route3
```

## Key Points

1. **UI Independence**: The React UI has no direct YAMCP dependencies - it only makes HTTP API calls
2. **Clean Separation**: UI builds config → Backend manages containers → FastMCP handles MCP complexity
3. **Path-based Routing**: Each workspace gets its own URL path, no port management needed
4. **Native Aggregation**: FastMCP's mount() method handles multi-server aggregation
5. **Simple State**: Everything runs in-memory, no database required for MVP