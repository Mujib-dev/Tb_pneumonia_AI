"""DICOM (.dcm) radiograph support for the PulmoAI CAD pipeline.

A DICOM study stores raw, modality-specific pixel values (often 12/16-bit, and
scaled by Rescale Slope/Intercept) rather than the 8-bit display raster that
PNG/JPEG carry. The DenseNet-121 classifier was trained on 8-bit radiographs
that went through ``preprocess`` (Resize 224x224 -> ToTensor -> ImageNet
Normalize), so a DICOM upload has to be rendered the way a radiologist's
lightbox would display it, then handed to that *same* transform.

This module only converts bytes to pixels. The trained weights are untouched.
"""
import os

import numpy as np
from PIL import Image

try:
    import pydicom
except ImportError:  # pragma: no cover - declared in requirements.txt
    pydicom = None

# Extensions treated as DICOM at the upload boundary.
DICOM_EXTENSIONS = ("dcm", "dicom", "di", "dic", "ima")

# 'DICM' sits at byte offset 128 of the DICOM Part 10 file preamble.
_PREAMBLE_OFFSET = 128
_PREAMBLE_MAGIC = b"DICM"


class DicomError(ValueError):
    """Raised when a DICOM upload cannot be decoded into a usable image."""


def is_dicom_extension(extension: str) -> bool:
    """True when a bare extension (no dot) marks the file as DICOM."""
    if not extension:
        return False
    return str(extension).lower().lstrip(".") in DICOM_EXTENSIONS


def looks_like_dicom_bytes(payload: bytes) -> bool:
    """True when the buffer carries the DICOM Part 10 'DICM' magic.

    Many exporters write extensionless or oddly-suffixed studies, so the upload
    route sniffs the content before rejecting a genuine DICOM study.
    """
    if not payload or len(payload) < _PREAMBLE_OFFSET + len(_PREAMBLE_MAGIC):
        return False
    return payload[_PREAMBLE_OFFSET : _PREAMBLE_OFFSET + len(_PREAMBLE_MAGIC)] == _PREAMBLE_MAGIC


def has_dicom_preamble(path: str) -> bool:
    """True when the file on disk carries the DICOM Part 10 'DICM' magic."""
    try:
        with open(path, "rb") as handle:
            return looks_like_dicom_bytes(handle.read(_PREAMBLE_OFFSET + len(_PREAMBLE_MAGIC)))
    except OSError:
        return False


def _read_dataset(path: str):
    if pydicom is None:
        raise DicomError(
            "pydicom is not installed on the server, so DICOM files cannot be read."
        )
    try:
        # force=True tolerates studies missing the Part 10 preamble, which is
        # common with raw/scrubbed exports from PACS.
        return pydicom.dcmread(path, force=True)
    except DicomError:
        raise
    except Exception as exc:
        raise DicomError(f"File could not be parsed as a DICOM study: {exc}") from exc


def _apply_voi_lut(dataset, array: np.ndarray) -> np.ndarray:
    """Apply Window Center/Width (or a VOI LUT) to get display-range values.

    Without this a DICOM CXR comes out as a near-black frame, because the stored
    values span the detector's dynamic range rather than the display range.
    """
    # pydicom 3 moved this helper to `pydicom.pixels`; 2.x only has the old path.
    for module_path, symbol in (
        ("pydicom.pixels", "apply_voi_lut"),
        ("pydicom.pixel_data_handlers.util", "apply_voi_lut"),
        ("pydicom.pixel_data_handlers", "apply_voi_lut"),
    ):
        try:
            module = __import__(module_path, fromlist=[symbol])
            return getattr(module, symbol)(array, dataset)
        except Exception:
            continue

    # Older releases expose it as a Dataset method.
    dataset_level = getattr(dataset, "apply_voi_lut", None)
    if callable(dataset_level):
        try:
            return dataset_level(array)
        except Exception:
            pass

    return array


def _to_display_gray(array: np.ndarray) -> np.ndarray:
    """Map stored pixel values to an 8-bit [0, 255] grayscale frame."""
    frame = array.astype(np.float64)

    # VOI output that already lands inside 8-bit range only needs clipping;
    # rescaling it again would crush the contrast the windowing produced.
    if 0.0 <= frame.min() and frame.max() <= 255.0:
        return np.clip(frame, 0, 255).astype(np.uint8)

    low, high = float(frame.min()), float(frame.max())
    if high - low < 1e-9:
        return np.zeros(frame.shape, dtype=np.uint8)

    scaled = (frame - low) / (high - low) * 255.0
    return np.clip(scaled, 0, 255).astype(np.uint8)


def _select_frame(array: np.ndarray) -> np.ndarray:
    """Reduce the pixel array to a single 2D frame or a colour 3D image."""
    if array.ndim == 2:
        return array

    if array.ndim == 3:
        # Samples-per-pixel (colour studies) keep channels on the last axis.
        if array.shape[-1] in (3, 4):
            return array
        # Everything else is a multi-frame series: classify the first frame.
        return array[0]

    raise DicomError(f"Unsupported DICOM pixel array with {array.ndim} dimensions.")


def dicom_to_pil(path: str) -> Image.Image:
    """Decode a DICOM study into a PIL image for inference.

    Returns a 3-channel RGB image so the result is byte-for-byte equivalent to
    what ``Image.open("scan.png").convert("RGB")`` produces for a PNG upload,
    which is what ``predict.preprocess`` already expects.
    """
    dataset = _read_dataset(path)

    try:
        array = dataset.pixel_array
    except Exception as exc:
        raise DicomError(
            "DICOM pixel data could not be decoded (it may be compressed or encrypted)."
        ) from exc

    array = _select_frame(array)
    array = _apply_voi_lut(dataset, array)

    photometric = str(getattr(dataset, "PhotometricInterpretation", "MONOCHROME2") or "MONOCHROME2")

    if array.ndim == 3 and photometric.upper() not in ("RGB", "RGB24", "YBR_FULL", "YBR_FULL_422"):
        # A 3D array that is not tagged as colour is really multi-frame data
        # that survived selection, so treat it as one frame.
        array = _select_frame(array)
        array = _apply_voi_lut(dataset, array)

    if array.ndim == 2:
        gray = _to_display_gray(array)
        if photometric.upper().startswith("MONOCHROME1"):
            # MONOCHROME1 stores white as 0, so invert to match MONOCHROME2.
            gray = 255 - gray
        return Image.fromarray(gray, mode="L").convert("RGB")

    if photometric.upper().startswith("MONOCHROME1"):
        array = 255 - _to_display_gray(array)
        return Image.fromarray(array, mode="L").convert("RGB")

    if photometric.upper() in ("YBR_FULL", "YBR_FULL_422"):
        return Image.fromarray(array.astype(np.uint8), mode="RGB").convert("RGB")

    if array.shape[-1] == 4:
        array = array[..., :3]
    if array.dtype != np.uint8:
        array = _to_display_gray(array)
    return Image.fromarray(array, mode="RGB")


def dicom_to_png(dicom_path: str, png_path: str) -> str:
    """Render a DICOM study to ``png_path`` and return that path.

    Writing a real PNG (instead of decoding in memory) is deliberate: the CXR
    validator, the DenseNet inference call and the Grad-CAM overlay all operate
    on a file path, so a DICOM upload reuses that exact pipeline untouched.
    """
    image = dicom_to_pil(dicom_path)

    parent = os.path.dirname(os.path.abspath(png_path))
    if parent:
        os.makedirs(parent, exist_ok=True)

    image.save(png_path, format="PNG")
    return png_path
