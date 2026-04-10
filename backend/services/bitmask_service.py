# -*- coding: utf-8 -*-
"""
bitmask_service.py — Bitmask utilities for schedule grid
"""


def slot_to_bit(day: int, period: int, periods_per_day: int) -> int:
    """Convert day+period to bit index."""
    return day * periods_per_day + period


def bit_to_slot(bit: int, periods_per_day: int) -> tuple:
    """Convert bit index to (day, period)."""
    return bit // periods_per_day, bit % periods_per_day


def compute_break_mask(days: int, periods: int, break_after_period: int) -> int:
    """
    Compute break_mask given days, periods, and which period is the break.
    break_after_period is 0-indexed: e.g. 3 means P3 (4th period) is a break.
    """
    mask = 0
    for d in range(days):
        bit = slot_to_bit(d, break_after_period, periods)
        mask |= (1 << bit)
    return mask


def compute_working_mask(days: int, periods: int, break_mask: int) -> int:
    """All valid slots minus breaks."""
    total_slots = days * periods
    all_slots = (1 << total_slots) - 1
    return all_slots & ~break_mask
