#!/usr/bin/env python3
# Converted from pytest to unittest for compatibility

import unittest
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from lib.ghostGrowth import calculateGhostGrowthIndex
from lib.types import GhostGrowthMetrics


def make_metrics(overrides=None):
    base = {
        'revenueGrowth': 8.5,
        'marginDecay': -3.2,
        'fleetGrowthRate': 12.5,
        'shipmentDensity': 8.7,
        'fuelCostGrowth': 4.8,
        'failedDeliveryGrowth': 7.2,
    }
    if overrides:
        base.update(overrides)
    return GhostGrowthMetrics(**base)


class TestGhostGrowthIndex(unittest.TestCase):

    def test_safe_level(self):
        metrics = make_metrics({
            'revenueGrowth': 3,
            'marginDecay': -1,
            'fleetGrowthRate': 2,
            'fuelCostGrowth': 1,
            'failedDeliveryGrowth': 1,
        })
        result = calculateGhostGrowthIndex(metrics, 90)
        self.assertLessEqual(result.index, 25)
        self.assertEqual(result.level, 'Safe')

    def test_critical_level(self):
        metrics = make_metrics({
            'revenueGrowth': 20,
            'marginDecay': -15,
            'fleetGrowthRate': 25,
            'shipmentDensity': 3,
            'fuelCostGrowth': 10,
            'failedDeliveryGrowth': 15,
        })
        result = calculateGhostGrowthIndex(metrics, 40)
        self.assertGreater(result.index, 50)
        self.assertIn(result.level, ('Critical', 'Collapse'))

    def test_index_range(self):
        for _ in range(10):
            m = make_metrics({
                'revenueGrowth': 10,
                'marginDecay': -8,
                'fleetGrowthRate': 15,
                'shipmentDensity': 10,
                'fuelCostGrowth': 5,
                'failedDeliveryGrowth': 8,
            })
            result = calculateGhostGrowthIndex(m, 70)
            self.assertGreaterEqual(result.index, 0)
            self.assertLessEqual(result.index, 100)

    def test_history_generated(self):
        metrics = make_metrics()
        result = calculateGhostGrowthIndex(metrics, 75)
        self.assertEqual(len(result.history), 6)
        self.assertEqual(result.history[-1]['index'], result.index)

    def test_recommendations_exist(self):
        metrics = make_metrics()
        result = calculateGhostGrowthIndex(metrics, 50)
        self.assertGreater(len(result.recommendations), 0)

    def test_explanation_generated(self):
        metrics = make_metrics()
        result = calculateGhostGrowthIndex(metrics, 70)
        self.assertGreater(len(result.explanation), 0)


if __name__ == '__main__':
    unittest.main()
