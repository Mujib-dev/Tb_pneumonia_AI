import os
import cv2
import numpy as np

# Preload biometric cascade classifiers once at module level for maximum performance
_CASCADE_DIR = cv2.data.haarcascades
_FACE_CAS = cv2.CascadeClassifier(os.path.join(_CASCADE_DIR, 'haarcascade_frontalface_default.xml'))
_ALT_CAS = cv2.CascadeClassifier(os.path.join(_CASCADE_DIR, 'haarcascade_frontalface_alt2.xml'))
_EYE_CAS = cv2.CascadeClassifier(os.path.join(_CASCADE_DIR, 'haarcascade_eye.xml'))

def validate_chest_xray(image_input):

    """
    Validates whether an uploaded image is a valid Chest X-ray (radiograph).
    Strictly filters out:
      1. Human faces, selfies, and personal portraits.
      2. Multi-color non-medical photographs (landscapes, clothing, objects).
      3. Overexposed, underexposed, or solid blank images.
      4. Low-resolution or severely blurry images.
      5. Images with human skin tones.

    Returns:
        (is_valid: bool, error_message: str)
    """
    if isinstance(image_input, str):
        if not os.path.exists(image_input):
            return False, "Image file not found on disk."
        img = cv2.imread(image_input)
    elif isinstance(image_input, np.ndarray):
        img = image_input
    else:
        return False, "Unsupported image input format."

    if img is None or img.size == 0:
        return False, "Failed to decode image file. Please upload a valid JPG, JPEG, or PNG."

    # 1. Dimension and Aspect Ratio Checks
    h, w = img.shape[:2]
    if h < 150 or w < 150:
        return False, f"Image resolution ({w}x{h}) is too low. Chest X-rays must be at least 150x150 pixels."

    aspect = w / float(h)
    if aspect < 0.45 or aspect > 2.2:
        return False, f"Unusual image aspect ratio ({aspect:.2f}). Chest radiographs are typically portrait or square."

    # Convert to grayscale for contrast and feature checks
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if len(img.shape) == 3 else img

    # 2. Blurriness Check (Laplacian variance)
    blur_variance = cv2.Laplacian(gray, cv2.CV_64F).var()
    if blur_variance < 35.0:
        return False, "Image is too blurry or out of focus. Please upload a clear diagnostic radiograph."

    # 3. Dynamic Range & Radiographic Contrast Checks
    mean_gray = float(np.mean(gray))
    std_gray = float(np.std(gray))
    if std_gray < 18.0:
        return False, "Image lacks radiographic contrast. Solid color, blank, or flat images are not accepted."
    if mean_gray > 228.0:
        return False, "Image is overexposed or a plain document. Please upload an authentic Chest X-ray."
    if mean_gray < 12.0:
        return False, "Image is underexposed or completely dark."

    # 4. Color & Chrominance Checks (X-rays are monochromatic radiographs)
    if len(img.shape) == 3:
        b, g, r = cv2.split(img)
        diff_rg = r.astype(float) - g.astype(float)
        diff_gb = g.astype(float) - b.astype(float)
        diff_rb = r.astype(float) - b.astype(float)
        mean_color_diff = float((np.mean(np.abs(diff_rg)) + np.mean(np.abs(diff_gb)) + np.mean(np.abs(diff_rb))) / 3.0)

        # Scanned film lightbox radiographs have a uniform tint.
        # Regular photos have varied colors across different objects (skin, clothes, background).
        spatial_std_rg = float(np.std(diff_rg))
        spatial_std_rb = float(np.std(diff_rb))

        hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1]
        mean_sat = float(np.mean(sat))
        high_sat_ratio = float(np.count_nonzero(sat > 40) / float(sat.size))

        # Human Skin Detection (YCrCb + HSV filter)
        ycrcb = cv2.cvtColor(img, cv2.COLOR_BGR2YCrCb)
        cr = ycrcb[:, :, 1]
        cb = ycrcb[:, :, 2]
        skin_mask = (cr >= 135) & (cr <= 175) & (cb >= 80) & (cb <= 125) & (sat > 18)
        skin_ratio = float(np.count_nonzero(skin_mask) / float(skin_mask.size))

        if skin_ratio > 0.03:
            return False, "Human skin tones detected. The CAD system only accepts Chest X-ray radiographs (CXR), not personal photos, faces, or selfies."

        if spatial_std_rg > 6.0 or spatial_std_rb > 8.0:
            return False, "Multi-color photograph detected. Chest X-rays must be monochromatic medical radiographs."

        if mean_color_diff > 18.0 and high_sat_ratio > 0.06:
            return False, "Colored image detected. Chest X-rays are monochromatic radiographs."

        if mean_sat > 35.0:
            return False, "Vibrant color image detected. Only grayscale or monochromatic chest radiographs are accepted."
    else:
        mean_color_diff = 0.0
        skin_ratio = 0.0
        sat = np.zeros_like(gray)

    # 5. Face & Biometric Cascade Detection (Preventing human face/portrait photos)
    try:
        faces1 = _FACE_CAS.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))
        faces2 = _ALT_CAS.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(50, 50))
        all_faces = list(faces1) + list(faces2)

        if len(all_faces) > 0:
            for (fx, fy, fw, fh) in all_faces:
                roi_gray = gray[fy:fy+fh, fx:fx+fw]
                eyes = _EYE_CAS.detectMultiScale(roi_gray, scaleFactor=1.1, minNeighbors=3, minSize=(12, 12))
                roi_sat = sat[fy:fy+fh, fx:fx+fw] if len(img.shape) == 3 else np.zeros((fh, fw))
                
                # If eyes are found inside the detected face region, or face region has color/skin or is prominent
                if len(eyes) >= 1 or np.mean(roi_sat) > 10 or skin_ratio > 0.01 or fw > w * 0.28:
                    return False, "Human face detected. The AI CAD screening system only accepts Chest X-ray radiographs (CXR), not personal portraits or selfies."
    except Exception as e:
        print(f"Warning: Biometric cascade verification error: {e}")

    # 6. Radiographic Structural Edge Verification
    # Chest radiographs exhibit structural bone edges (ribs, spine, clavicles) across the thoracic field.
    edges = cv2.Canny(gray, 30, 100)
    edge_density = float(np.count_nonzero(edges) / float(edges.size))
    if edge_density < 0.008:
        return False, "Image does not display anatomical chest radiography structures. Please ensure you upload a genuine chest X-ray."

    return True, "Valid Chest X-ray"
