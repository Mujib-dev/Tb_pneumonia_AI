from pydantic import BaseModel
from typing import Optional

class PredictionRequest(BaseModel):
    image_url: Optional[str] = None
    # Add other fields if needed for the prediction request

class UserAuth(BaseModel):
    username: str
    password: str
