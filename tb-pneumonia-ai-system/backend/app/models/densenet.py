import torch
import torch.nn as nn
from torchvision import models

def load_densenet121(model_path: str):
    # Load DenseNet121 model
    model = models.densenet121(weights=None)
    
    # Modify the last layer for our classification (Normal, TB, Pneumonia)
    num_ftrs = model.classifier.in_features
    model.classifier = nn.Sequential(
        nn.Linear(num_ftrs, 3), # Assuming 3 classes
        nn.Softmax(dim=1)
    )
    
    # Load weights
    if model_path:
        try:
            model.load_state_dict(torch.load(model_path, map_location=torch.device('cpu')))
        except Exception as e:
            print(f"Error loading weights: {e}")
            
    model.eval()
    return model
