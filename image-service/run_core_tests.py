"""Minimal pytest-compatible runner so core service tests can run where pytest isn't installed. Prefer `pytest -q`."""
import inspect, sys, traceback, types

class _Raises:
    def __init__(self, exc): self.exc = exc; self.value = None
    def __enter__(self): return self
    def __exit__(self, t, v, tb):
        if t is None: raise AssertionError(f"DID NOT RAISE {self.exc}")
        if issubclass(t, self.exc): self.value = v; return True
        return False

def _param(names, values):
    def deco(fn): fn._params = (names, values); return fn
    return deco

pytest = types.ModuleType("pytest")
pytest.raises = lambda e: _Raises(e)
pytest.importorskip = lambda n: (_ for _ in ()).throw(ImportError(n))
class _Mark: parametrize = staticmethod(_param)
pytest.mark = _Mark()
sys.modules["pytest"] = pytest
sys.path.insert(0, ".")

import importlib
mod = importlib.import_module("tests.test_services")
ok = fail = 0
for name, fn in inspect.getmembers(mod, inspect.isfunction):
    if not name.startswith("test_"): continue
    cases = [()]
    if hasattr(fn, "_params"): cases = [(v,) for v in fn._params[1]]
    for args in cases:
        try: fn(*args); ok += 1
        except Exception: fail += 1; print("FAIL", name, args); traceback.print_exc()
print(f"{ok} passed, {fail} failed"); sys.exit(1 if fail else 0)
