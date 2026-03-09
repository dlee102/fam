"""Quant score configuration."""

from pathlib import Path

# Data root: 02.TRADING2/04. data/
_DOCUMENTS = Path(__file__).resolve().parents[3]  # quant -> fam -> 02. MX -> Documents
_FAM_ROOT = Path(__file__).resolve().parents[2]  # quant -> fam
DATA_ROOT = _DOCUMENTS / "02.TRADING2" / "04. data"

# foreign_flow: fam/foreign-high 우선 사용
FOREIGN_HIGH_ROOT = _FAM_ROOT / "foreign-high"

# Dataset names
FOREIGN_FLOW = "foreign_flow-koscom"
TRADES = "trades-koscom"
BOOKS = "books-koscom"
