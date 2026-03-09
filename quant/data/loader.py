"""Load parquet data by date."""

from pathlib import Path

import pandas as pd

from quant.config import DATA_ROOT, FOREIGN_FLOW, FOREIGN_HIGH_ROOT, TRADES, BOOKS


def _data_path(year: int, dataset: str) -> Path:
    prefix = f"{year}-{dataset}"
    return DATA_ROOT / prefix


def load_foreign_flow(date: str) -> pd.DataFrame:
    """Load foreign_flow.parquet for given date (YYYYMMDD). fam/foreign-high 우선."""
    path = FOREIGN_HIGH_ROOT / f"date={date}" / "foreign_flow.parquet"
    if not path.exists():
        y = int(date[:4])
        path = _data_path(y, FOREIGN_FLOW) / f"date={date}" / "foreign_flow.parquet"
    if not path.exists():
        raise FileNotFoundError(f"foreign_flow not found: {path}")
    return pd.read_parquet(path)


def load_trades(date: str) -> pd.DataFrame:
    """Load trades.parquet for given date (YYYYMMDD)."""
    y = int(date[:4])
    path = _data_path(y, TRADES) / f"date={date}" / "trades.parquet"
    if not path.exists():
        raise FileNotFoundError(f"trades not found: {path}")
    return pd.read_parquet(path)


def load_books(date: str) -> pd.DataFrame:
    """Load books.parquet for given date (YYYYMMDD)."""
    y = int(date[:4])
    path = _data_path(y, BOOKS) / f"date={date}" / "books.parquet"
    if not path.exists():
        raise FileNotFoundError(f"books not found: {path}")
    return pd.read_parquet(path)
