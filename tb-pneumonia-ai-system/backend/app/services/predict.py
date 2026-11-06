import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image
import os
import cv2
import numpy as np

def get_model():
    model = models.densenet121(weights=None)
    num_ftrs = model.classifier.in_features
    model.classifier = nn.Linear(num_ftrs, 3) # 3 classes: Normal, Pneumonia, TB
    return model

# Preprocessing logic (aligned with test_single_image.py)
preprocess = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
])

MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "ml_model", "chest_xray_densenet121.pth")
labels = ['Normal', 'Pneumonia', 'TB']

# Load model globally (if exists)
model = None
model_status = {
    "connected": False,
    "error": None,
    "model_name": "DenseNet-121",
    "labels": labels
}

def load_ai_model():
    global model, model_status
    if not os.path.exists(MODEL_PATH) or os.path.getsize(MODEL_PATH) == 0:
        model = None
        model_status["connected"] = False
        model_status["error"] = "Model weights file not found or empty."
        print(f"Warning: {model_status['error']} Random predictions are disabled.")
        return False

    try:
        loaded_model = get_model()
        loaded_model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
        loaded_model.eval()
        model = loaded_model
        model_status["connected"] = True
        model_status["error"] = None
        print("Diagnostic AI Model (DenseNet-121) loaded and connected successfully.")
        return True
    except Exception as e:
        model = None
        model_status["connected"] = False
        model_status["error"] = str(e)
        print(f"Error loading model weights: {e}. Random predictions are disabled.")
        return False

# Initialize on module load
load_ai_model()

def is_model_connected() -> bool:
    """Returns True only if the PyTorch model is properly loaded into memory and ready."""
    return model is not None and model_status.get("connected", False)

def get_model_status_info() -> dict:
    """Returns status dictionary regarding model readiness."""
    return {
        "connected": is_model_connected(),
        "model_name": model_status.get("model_name", "DenseNet-121"),
        "labels": labels,
        "error": model_status.get("error") if not is_model_connected() else None
    }

from .image_validator import validate_chest_xray

def generate_gradcam_overlay(image_path: str, target_class_idx: int):
    """
    Computes Explainable AI (XAI) Grad-CAM saliency activation heatmap overlay on the original CXR.
    Highlights anatomical thoracic regions (apical cavitations for TB, airspace consolidation for Pneumonia)
    that influenced the DenseNet-121 classifier.
    """
    global model
    if model is None:
        return None

    try:
        # Cross-platform Windows & space-safe image read
        try:
            with open(image_path, 'rb') as f:
                img_array = np.frombuffer(f.read(), np.uint8)
                orig_cv = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        except Exception:
            orig_cv = cv2.imread(image_path)

        if orig_cv is None:
            return None
        orig_h, orig_w = orig_cv.shape[:2]

        pil_img = Image.open(image_path).convert('RGB')
        tensor = preprocess(pil_img).unsqueeze(0)

        # Forward pass through DenseNet features
        features = model.features(tensor)
        feat_clone = features.clone().detach().requires_grad_(True)

        # Classifier pass
        out = F.relu(feat_clone, inplace=False)
        out = F.adaptive_avg_pool2d(out, (1, 1))
        out = torch.flatten(out, 1)
        out = model.classifier(out)

        # Backward pass on target class score
        score = out[0, target_class_idx]
        score.backward()

        if feat_clone.grad is None:
            return None

        grads = feat_clone.grad[0].detach().cpu().numpy() # [1024, 7, 7]
        acts = feat_clone[0].detach().cpu().numpy()       # [1024, 7, 7]

        # Global average pooling over gradients to get feature map weights
        weights = np.mean(grads, axis=(1, 2))

        # Weighted combination of feature activations
        cam = np.zeros(acts.shape[1:], dtype=np.float32)
        for i, w in enumerate(weights):
            cam += w * acts[i]

        # ReLU on activations
        cam = np.maximum(cam, 0)
        max_val = np.max(cam)
        if max_val > 0:
            cam = cam / max_val

        # Upsample heatmap to match original radiograph size
        cam_resized = cv2.resize(cam, (orig_w, orig_h))
        heatmap = cv2.applyColorMap(np.uint8(255 * cam_resized), cv2.COLORMAP_JET)

        # Overlay on original image (70% original radiograph, 30% heatmap)
        overlay = cv2.addWeighted(orig_cv, 0.70, heatmap, 0.30, 0)

        # Robust cross-platform write
        base_name, _ = os.path.splitext(image_path)
        gradcam_path = f"{base_name}_gradcam.jpg"
        is_success, buf = cv2.imencode('.jpg', overlay, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
        if is_success:
            with open(gradcam_path, 'wb') as f:
                f.write(buf)
        else:
            cv2.imwrite(gradcam_path, overlay)
        return gradcam_path
    except Exception as err:
        print(f"Warning: Grad-CAM generation error (non-fatal): {err}")
        return None

def predict_image(image_path: str):
    """
    Run radiograph classification through the loaded DenseNet-121 model.
    STRICT POLICY: If the model is not loaded/connected, NEVER generate random mock predictions.
    Raises RuntimeError immediately if model is unavailable.
    """
    if not is_model_connected():
        raise RuntimeError("Diagnostic AI model is not connected or offline. Random predictions are restricted and cannot be performed.")

    # Guard: Ensure input image is a valid Chest X-ray before model inference
    is_valid, validation_msg = validate_chest_xray(image_path)
    if not is_valid:
        raise ValueError(validation_msg)

    try:
        input_image = Image.open(image_path).convert('RGB')
        input_tensor = preprocess(input_image)
        input_batch = input_tensor.unsqueeze(0)

        with torch.no_grad():
            output = model(input_batch)
        
        # Get all probabilities by applying softmax
        probs = torch.nn.functional.softmax(output, dim=1)[0].tolist()
        
        all_scores = {
            labels[i]: round(probs[i], 4) for i in range(len(labels))
        }
        
        # Ensure final_result is derived directly from the maximum score in all_scores
        final_result = max(all_scores, key=all_scores.get)
        confidence = all_scores[final_result]
        
        # Generate Explainable AI (Grad-CAM) Heatmap
        target_class_idx = labels.index(final_result)
        heatmap_path = generate_gradcam_overlay(image_path, target_class_idx)

        return final_result, round(confidence, 4), all_scores, heatmap_path
    except Exception as e:
        print(f"Prediction inference error: {e}")
        raise RuntimeError(f"Diagnostic radiograph inference failed: {str(e)}")

