from typing import Any

def parse_bool(val: Any, default: bool = False) -> bool:
    """
    Parse a boolean value robustly from JSON, form-data, or Python types.
    - If val is None: returns default (False).
    - If val is bool: returns val directly.
    - If val is int/float: returns val != 0.
    - If val is str:
        'false', '0', 'no', 'f', 'off', 'null', 'none' -> False
        'true', '1', 'yes', 't', 'on' -> True
    - Otherwise returns bool(val).
    """
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val != 0
    if isinstance(val, str):
        cleaned = val.strip().lower()
        if cleaned in ("false", "0", "no", "f", "off", "null", "none"):
            return False
        if cleaned in ("true", "1", "yes", "t", "on"):
            return True
        return False
    return bool(val)
