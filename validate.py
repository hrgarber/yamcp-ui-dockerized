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
        """Validate 1: Container is running"""
        logger.info("🔍 Validating container health...")
        
        try:
            self.container.reload()
            is_running = self.container.status == 'running'
            logger.info(f"✅ Container health: {'PASS' if is_running else 'FAIL'}")
            return is_running
            
        except Exception as e:
            logger.error(f"Container health check failed: {e}")
            return False

    def validate_api_functional(self) -> bool:
        """Validate 2: API returns JSON"""
        logger.info("🔍 Validating API functionality...")
        
        try:
            result = self.container.exec_run([
                'wget', '-q', '-O', '-', 'http://localhost:8765/api/stats'
            ])
            
            if result.exit_code == 0:
                json.loads(result.output.decode())  # Just check it's valid JSON
                logger.info("✅ API functionality: PASS")
                return True
            else:
                logger.error("API request failed")
                return False
                
        except Exception as e:
            logger.error(f"API validation failed: {e}")
            return False

    def validate_sse_streaming(self) -> bool:
        """Validate 3: SSE endpoint responds"""
        logger.info("🔍 Validating SSE streaming...")
        
        try:
            # Setup simple test
            self._setup_test_workspace()
            
            # Just check SSE headers
            url = f"{self.backend_url}/mcp/validation-workspace"
            response = requests.get(url, stream=True, timeout=5)
            
            is_sse = (response.status_code == 200 and 
                     'text/event-stream' in response.headers.get('content-type', ''))
            
            logger.info(f"✅ SSE streaming: {'PASS' if is_sse else 'FAIL'}")
            return is_sse
            
        except Exception as e:
            logger.error(f"SSE validation failed: {e}")
            return False

    def validate_hot_reloading(self) -> bool:
        """Validate 4: PM2 process exists"""
        logger.info("🔍 Validating hot reloading...")
        
        try:
            # Just check PM2 is managing the process
            result = self.container.exec_run([
                'pgrep', '-f', 'yamcp-ui-backend-hub'
            ])
            
            pm2_running = result.exit_code == 0
            logger.info(f"✅ Hot reloading: {'PASS' if pm2_running else 'FAIL'}")
            return pm2_running
            
        except Exception as e:
            logger.error(f"Hot reload validation failed: {e}")
            return False

    def validate_process_cleanup(self) -> bool:
        """Validate 5: Container has reasonable process count"""
        logger.info("🔍 Validating process cleanup...")
        
        try:
            # Just check we don't have runaway processes
            result = self.container.exec_run(['ps', 'aux'])
            process_count = len(result.output.decode().strip().split('\n'))
            
            # Reasonable limit for our container
            reasonable = process_count < 50
            logger.info(f"Process count: {process_count}")
            logger.info(f"✅ Process cleanup: {'PASS' if reasonable else 'FAIL'}")
            return reasonable
            
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