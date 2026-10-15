"""Deterministic randomness — a bit-exact port of frontend/src/lib/rng.ts.

The demo provider must agree with the in-browser simulator so that switching the UI from
"demo" to "api" mode does not change any number on screen.
"""

from __future__ import annotations

import math

_M32 = 0xFFFFFFFF


def _i32(x: int) -> int:
    x &= _M32
    return x - (1 << 32) if x & 0x80000000 else x


def _imul(a: int, b: int) -> int:
    return _i32((a & _M32) * (b & _M32))


def _js_to_int(x: float | int) -> int:
    """JavaScript ToInt32 for finite numbers (truncate, wrap mod 2^32)."""
    return _i32(int(x))


def hash_string(s: str) -> int:
    h = 2166136261
    for ch in s:
        h = (h ^ ord(ch)) & _M32
        h = (h * 16777619) & _M32
    return h


def hash2(a: float | int, b: float | int) -> float:
    h = _imul(_js_to_int(a) ^ _i32(0x9E3779B9), 0x85EBCA6B) ^ _imul(_js_to_int(int(b) + 0x632BE5AB), 0xC2B2AE35)
    h = _i32(h)
    h ^= (h & _M32) >> 16
    h = _imul(h, 0x7FEB352D)
    h ^= (h & _M32) >> 15
    h = _imul(h, 0x846CA68B)
    h ^= (h & _M32) >> 16
    return (h & _M32) / 4294967296


def mulberry32(seed: int):
    state = [seed & _M32]

    def rnd() -> float:
        a = _i32(state[0] + 0x6D2B79F5)
        state[0] = a & _M32
        t = _imul(a ^ ((a & _M32) >> 15), 1 | a)
        t = _i32(t + _imul(t ^ ((t & _M32) >> 7), 61 | t)) ^ t
        return (((t ^ ((t & _M32) >> 14)) & _M32)) / 4294967296

    return rnd


def value_noise(seed: float, x: float) -> float:
    i = math.floor(x)
    f = x - i
    u = f * f * (3 - 2 * f)
    a = hash2(seed, i)
    b = hash2(seed, i + 1)
    return (a + (b - a) * u) * 2 - 1


def fbm(seed: float, x: float, octaves: int = 3) -> float:
    amp = 1.0
    freq = 1.0
    total = 0.0
    norm = 0.0
    for o in range(octaves):
        total += amp * value_noise(seed + o * 1013, x * freq)
        norm += amp
        amp *= 0.5
        freq *= 2.03
    return total / norm


def gaussian(seed: int, i: int) -> float:
    u1 = max(1e-9, hash2(seed, i * 2))
    u2 = hash2(seed, i * 2 + 1)
    return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
