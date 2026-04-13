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


def compute_break_mask(days: int, periods: int, break_after_period: int, custom_breaks: list = None) -> int:
    """
    Compute break_mask given days, periods, and custom breaks array.
    If custom_breaks is provided, it uses those exact cells.
    Otherwise, it uses break_after_period for every day.
    """
    mask = 0
    if isinstance(custom_breaks, list) and len(custom_breaks) > 0:
        for b in custom_breaks:
            if isinstance(b, dict):
                d = b.get("day")
                p = b.get("period")
                if isinstance(d, int) and isinstance(p, int) and 0 <= d < days and 0 <= p < periods:
                    bit = slot_to_bit(d, p, periods)
                    mask |= (1 << bit)
    else:
        for d in range(days):
            if 0 <= break_after_period < periods:
                bit = slot_to_bit(d, break_after_period, periods)
                mask |= (1 << bit)
    return mask


def compute_working_mask(days: int, periods: int, break_mask: int) -> int:
    """All valid slots minus breaks."""
    total_slots = days * periods
    all_slots = (1 << total_slots) - 1
    return all_slots & ~break_mask
