#!/usr/bin/env python3
"""
Docker Infrastructure Validation Script
Validates the 5 critical functions of the MCP Hub
"""

import logging
import time
import json
import signal
import sys
from typing import Tuple

import docker
import requests
import sseclient

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('validation.log')
    ]
)
logger = logging.getLogger(__name__)

class MCPHubValidator:
    def __init__(self):
        self.docker_client = docker.from_env()
        self.container_name = 'yamcp-ui-dev'
        self.frontend_url = 'http://localhost:5173'
        self.backend_url = 'http://localhost:8765'
        self.container = None
        
        # Results tracking
        self.results = {
            'container_health': False,
            'api_functional': False,
            'sse_streaming': False,
            'hot_reloading': False,
            'process_cleanup': False
        }

    def find_container(self) -> bool:
        """Find and connect to the yamcp-ui container"""
        try:
            containers = self.docker_client.containers.list(
                filters={'name': self.container_name}
            )
            
            if not containers:
                logger.error(f"Container {self.container_name} not found")
                return False
                
            self.container = containers[0]
            logger.info(f"Found container: {self.container.name}")
            return True
            
        except Exception as e:
            logger.error(f"Error finding container: {e}")
            return False

    def validate_container_health(self) -> bool:
        """Validate 1: Container is running with correct ports"""
        logger.info("🔍 Validating container health...")
        
        try:
            # Check container status
            self.container.reload()
            if self.container.status != 'running':
                logger.error(f"Container status is {self.container.status}, expected 'running'")
                return False
                
            # Check port mappings
            ports = self.container.ports
            required_ports = ['5173/tcp', '8765/tcp']
            
            for port in required_ports:
                if port not in ports or not ports[port]:
                    logger.error(f"Port {port} not properly mapped")
                    return False
                    
            logger.info("✅ Container health: PASS")
            return True
            
        except Exception as e:
            logger.error(f"Container health check failed: {e}")
            return False

    def validate_api_functional(self) -> bool:
        """Validate 2: API returns valid JSON responses"""
        logger.info("🔍 Validating API functionality...")
        
        try:
            # Test from inside container to avoid CORS
            result = self.container.exec_run([
                'wget', '-q', '-O', '-', 'http://localhost:8765/api/stats'
            ])
            
            if result.exit_code != 0:
                logger.error(f"API request failed with exit code {result.exit_code}")
                return False
                
            # Parse JSON response
            stats = json.loads(result.output.decode())
            required_fields = ['totalServers', 'activeServers', 'totalWorkspaces', 'activeWorkspaces']
            
            for field in required_fields:
                if field not in stats:
                    logger.error(f"Missing required field in API response: {field}")
                    return False
                    
            logger.info("✅ API functionality: PASS")
            return True
            
        except json.JSONDecodeError as e:
            logger.error(f"API returned invalid JSON: {e}")
            return False
        except Exception as e:
            logger.error(f"API validation failed: {e}")
            return False

    def validate_sse_streaming(self) -> bool:
        """Validate 3: SSE endpoint streams process output"""
        logger.info("🔍 Validating SSE streaming...")
        
        try:
            # First, create a test server and workspace
            self._setup_test_workspace()
            
            # Connect to SSE endpoint
            url = f"{self.backend_url}/mcp/validation-workspace"
            logger.info(f"Connecting to SSE endpoint: {url}")
            
            response = requests.get(url, stream=True, timeout=10)
            if response.status_code != 200:
                logger.error(f"SSE endpoint returned status {response.status_code}")
                return False
                
            # Check SSE headers
            content_type = response.headers.get('content-type', '')
            if 'text/event-stream' not in content_type:
                logger.error(f"Wrong content type: {content_type}")
                return False
                
            # Read SSE events
            client = sseclient.SSEClient(response)
            events_received = 0
            test_output_found = False
            
            for event in client.events():
                events_received += 1
                logger.debug(f"SSE Event: {event.event} - {event.data}")
                
                if 'VALIDATION_TEST' in event.data:
                    test_output_found = True
                    
                # Stop after reasonable number of events or finding our test output
                if events_received >= 10 or test_output_found:
                    break
                    
            if not test_output_found:
                logger.error("Test output not found in SSE stream")
                return False
                
            logger.info("✅ SSE streaming: PASS")
            return True
            
        except requests.exceptions.Timeout:
            logger.error("SSE endpoint timeout")
            return False
        except Exception as e:
            logger.error(f"SSE validation failed: {e}")
            return False

    def validate_hot_reloading(self) -> bool:
        """Validate 4: PM2 restarts on config file changes"""
        logger.info("🔍 Validating hot reloading...")
        
        try:
            # Get current process start time
            result = self.container.exec_run([
                'sh', '-c', 'ps -o lstart= -p $(pgrep -f yamcp-ui-backend-hub)'
            ])
            
            if result.exit_code != 0:
                logger.error("Could not find backend process")
                return False
                
            before_restart = result.output.decode().strip()
            logger.info(f"Process start time before: {before_restart}")
            
            # Trigger config change
            self.container.exec_run([
                'sh', '-c', 'echo "hot_reload_test" >> /root/.local/share/yamcp-nodejs/providers.json'
            ])
            
            # Wait for PM2 to detect change and restart
            logger.info("Waiting for PM2 to detect change and restart...")
            time.sleep(5)
            
            # Get new process start time
            result = self.container.exec_run([
                'sh', '-c', 'ps -o lstart= -p $(pgrep -f yamcp-ui-backend-hub)'
            ])
            
            if result.exit_code != 0:
                logger.error("Backend process not found after restart")
                return False
                
            after_restart = result.output.decode().strip()
            logger.info(f"Process start time after: {after_restart}")
            
            if before_restart == after_restart:
                logger.error("Process did not restart - start times are identical")
                return False
                
            logger.info("✅ Hot reloading: PASS")
            return True
            
        except Exception as e:
            logger.error(f"Hot reload validation failed: {e}")
            return False

    def validate_process_cleanup(self) -> bool:
        """Validate 5: MCP processes terminate cleanly when connections close"""
        logger.info("🔍 Validating process cleanup...")
        
        try:
            # Count initial processes
            result = self.container.exec_run(['sh', '-c', 'pgrep echo | wc -l'])
            initial_count = int(result.output.decode().strip())
            logger.info(f"Initial echo process count: {initial_count}")
            
            # Start SSE connection that will timeout and close
            url = f"{self.backend_url}/mcp/validation-workspace"
            
            # Use a short timeout to force connection close
            try:
                response = requests.get(url, stream=True, timeout=2)
                # Read some data to start the process
                for line in response.iter_lines():
                    if line:
                        break
            except requests.exceptions.Timeout:
                pass  # Expected timeout
            
            # Wait for cleanup
            time.sleep(3)
            
            # Count final processes
            result = self.container.exec_run(['sh', '-c', 'pgrep echo | wc -l'])
            final_count = int(result.output.decode().strip())
            logger.info(f"Final echo process count: {final_count}")
            
            # Should not have significantly more processes (allowing for timing)
            if final_count > initial_count + 1:
                logger.error(f"Process cleanup failed: {initial_count} -> {final_count}")
                return False
                
            logger.info("✅ Process cleanup: PASS")
            return True
            
        except Exception as e:
            logger.error(f"Process cleanup validation failed: {e}")
            return False

    def _setup_test_workspace(self):
        """Helper: Setup test server and workspace for validation"""
        server_config = {
            'name': 'validation-server',
            'type': 'stdio',
            'command': 'echo',
            'args': ['VALIDATION_TEST']
        }
        
        workspace_config = {
            'name': 'validation-workspace',
            'servers': ['validation-server']
        }
        
        # Add server
        self.container.exec_run([
            'wget', '-q', '-O', '-',
            '--post-data', json.dumps(server_config),
            '--header', 'Content-Type: application/json',
            'http://localhost:8765/api/servers'
        ])
        
        # Add workspace
        self.container.exec_run([
            'wget', '-q', '-O', '-',
            '--post-data', json.dumps(workspace_config),
            '--header', 'Content-Type: application/json',
            'http://localhost:8765/api/workspaces'
        ])

    def run_validation(self) -> bool:
        """Run all validation checks"""
        logger.info("🧪 Starting MCP Hub Infrastructure Validation")
        logger.info("=" * 50)
        
        # Find container first
        if not self.find_container():
            return False
            
        # Run validation checks
        validations = [
            ('container_health', self.validate_container_health),
            ('api_functional', self.validate_api_functional),
            ('sse_streaming', self.validate_sse_streaming),
            ('hot_reloading', self.validate_hot_reloading),
            ('process_cleanup', self.validate_process_cleanup)
        ]
        
        for name, validator in validations:
            try:
                self.results[name] = validator()
            except Exception as e:
                logger.error(f"Validation {name} crashed: {e}")
                self.results[name] = False
                
        # Report results
        self._report_results()
        
        # Return overall success
        return all(self.results.values())

    def _report_results(self):
        """Report validation results"""
        logger.info("\n" + "=" * 50)
        logger.info("VALIDATION RESULTS")
        logger.info("=" * 50)
        
        passed = 0
        failed = 0
        
        for check, result in self.results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            logger.info(f"{check.replace('_', ' ').title()}: {status}")
            
            if result:
                passed += 1
            else:
                failed += 1
                
        logger.info("-" * 50)
        logger.info(f"Total: {passed} passed, {failed} failed")
        
        if failed == 0:
            logger.info("🎉 ALL VALIDATIONS PASSED!")
        else:
            logger.error("⚠️ SOME VALIDATIONS FAILED!")

def main():
    """Main validation entry point"""
    validator = MCPHubValidator()
    
    try:
        success = validator.run_validation()
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        logger.info("Validation interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Validation crashed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()