#!/usr/bin/env python3
"""
VEGA Logistics OS — Full Test Suite Runner
Runs all Python tests for the project
"""

import unittest
import sys
import os
import subprocess
import re

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import all test modules
from test_calculations_unittest import TestCalculateFinancials
from test_feasibilityEngine_unittest import TestFeasibilityEngine
from test_ghostGrowth_unittest import TestGhostGrowthIndex


def run_python_tests():
    """Run all Python unit tests."""
    print("=" * 60)
    print("RUNNING PYTHON UNIT TESTS")
    print("=" * 60)

    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    # Add all test classes
    suite.addTests(loader.loadTestsFromTestCase(TestCalculateFinancials))
    suite.addTests(loader.loadTestsFromTestCase(TestFeasibilityEngine))
    suite.addTests(loader.loadTestsFromTestCase(TestGhostGrowthIndex))

    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print(f"\nPython Tests Summary:")
    print(f"  Total: {result.testsRun} tests")
    print(f"  Passed: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"  Failed: {len(result.failures)}")
    print(f"  Errors: {len(result.errors)}")

    return result.wasSuccessful()


def run_typescript_typecheck():
    """Run TypeScript type checking."""
    print("\n" + "=" * 60)
    print("RUNNING TYPESCRIPT TYPE CHECKING")
    print("=" * 60)

    # Change to project root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

    try:
        result = subprocess.run(
            ['npm', 'run', 'typecheck'],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            print("✅ TypeScript type checking PASSED")
            return True
        else:
            print("❌ TypeScript type checking FAILED")
            print("STDERR:", result.stderr)
            return False
    except subprocess.TimeoutExpired:
        print("❌ TypeScript type checking TIMED OUT")
        return False
    except Exception as e:
        print(f"❌ TypeScript type checking ERROR: {e}")
        return False


def run_eslint():
    """Run ESLint for code quality."""
    print("\n" + "=" * 60)
    print("RUNNING ESLINT")
    print("=" * 60)

    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

    try:
        result = subprocess.run(
            ['npm', 'run', 'lint'],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=60
        )

        # Parse ESLint's final summary instead of counting words in source
        # diagnostics (warnings often contain the word "error" in rule docs).
        output = result.stdout + result.stderr
        summary = re.findall(r'(\d+) errors?, (\d+) warnings?', output)
        error_count, warning_count = (map(int, summary[-1]) if summary else (0, 0))

        if result.returncode == 0 and error_count == 0:
            print("✅ ESLint PASSED with no errors")
            if warning_count > 0:
                print(f"⚠️  {warning_count} warnings found")
            return True
        else:
            print("❌ ESLint FAILED")
            print(f"   Errors: {error_count}, Warnings: {warning_count}")
            return False
    except subprocess.TimeoutExpired:
        print("❌ ESLint TIMED OUT")
        return False
    except Exception as e:
        print(f"❌ ESLint ERROR: {e}")
        return False


def main():
    """Run all tests and generate report."""
    print("VEGA Logistics OS — Full Test Suite")
    print("=" * 60)

    results = {}

    # Run Python tests
    results['python'] = run_python_tests()

    # Run TypeScript type checking
    results['typecheck'] = run_typescript_typecheck()

    # Run ESLint
    results['eslint'] = run_eslint()

    # Generate final report
    print("\n" + "=" * 60)
    print("FINAL TEST REPORT")
    print("=" * 60)

    all_passed = all(results.values())

    for test_name, passed in results.items():
        status = "✅ PASSED" if passed else "❌ FAILED"
        print(f"{test_name:15} {status}")

    print("=" * 60)
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
        return 0
    else:
        print("❌ SOME TESTS FAILED")
        return 1


if __name__ == '__main__':
    sys.exit(main())
