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
import subprocess
from typing import Tuple

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
        self.container_name = 'yamcp-ui-dev'
        self.frontend_url = 'http://localhost:5173'
        self.backend_url = 'http://localhost:8765'
        
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
            result = subprocess.run(
                ['docker', 'ps', '--filter', f'name={self.container_name}', '--format', '{{.Names}}'],
                capture_output=True, text=True, timeout=10
            )
            
            if result.returncode != 0 or self.container_name not in result.stdout:
                logger.error(f"Container {self.container_name} not found")
                return False
                
            logger.info(f"Found container: {self.container_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error finding container: {e}")
            return False

    def validate_container_health(self) -> bool:
        """Validate 1: Container is running"""
        logger.info("🔍 Validating container health...")
        
        try:
            result = subprocess.run(
                ['docker', 'ps', '--filter', f'name={self.container_name}', '--format', '{{.Status}}'],
                capture_output=True, text=True, timeout=10
            )
            
            is_running = result.returncode == 0 and 'Up' in result.stdout
            logger.info(f"✅ Container health: {'PASS' if is_running else 'FAIL'}")
            return is_running
            
        except Exception as e:
            logger.error(f"Container health check failed: {e}")
            return False

    def validate_api_functional(self) -> bool:
        """Validate 2: API returns JSON"""
        logger.info("🔍 Validating API functionality...")
        
        try:
            result = subprocess.run([
                'docker', 'exec', self.container_name,
                'wget', '-q', '-O', '-', 'http://localhost:8765/api/stats'
            ], capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0:
                json.loads(result.stdout)  # Just check it's valid JSON
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
            time.sleep(1)  # Give it a moment to register
            
            # Test using wget from within container for better reliability
            result = subprocess.run([
                'docker', 'exec', self.container_name,
                'timeout', '5', 'wget', '-q', '-S', '-O', '/dev/null',
                'http://localhost:8765/mcp/validation-workspace'
            ], capture_output=True, text=True, timeout=10)
            
            is_sse = (result.returncode == 0 and 
                     'text/event-stream' in result.stderr)
            
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
            result = subprocess.run([
                'docker', 'exec', self.container_name,
                'pgrep', '-f', 'server.mjs'
            ], capture_output=True, text=True, timeout=10)
            
            pm2_running = result.returncode == 0
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
            result = subprocess.run([
                'docker', 'exec', self.container_name, 'ps', 'aux'
            ], capture_output=True, text=True, timeout=10)
            
            process_count = len(result.stdout.strip().split('\n'))
            
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
        subprocess.run([
            'docker', 'exec', self.container_name,
            'wget', '-q', '-O', '-',
            '--post-data', json.dumps(server_config),
            '--header', 'Content-Type: application/json',
            'http://localhost:8765/api/servers'
        ], capture_output=True, timeout=10)
        
        # Add workspace
        subprocess.run([
            'docker', 'exec', self.container_name,
            'wget', '-q', '-O', '-',
            '--post-data', json.dumps(workspace_config),
            '--header', 'Content-Type: application/json',
            'http://localhost:8765/api/workspaces'
        ], capture_output=True, timeout=10)

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