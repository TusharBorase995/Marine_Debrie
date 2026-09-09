from abc import ABC, abstractmethod
from typing import Dict, Any, List

class InferenceProvider(ABC):
    """
    Abstract interface for AI Computer Vision Model Inference Providers.
    
    Processing pipeline components depend ONLY on this abstract InferenceProvider interface.
    When the ML team completes model training (YOLO26n-seg + U-Net shadow verifier),
    they will implement `RealInferenceProvider(InferenceProvider)` without changing FastAPI,
    REST APIs, WebSocket schemas, or frontend UI code.
    """

    @abstractmethod
    async def infer(self, input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Executes model inference on input sonar data/imagery.
        
        :param input_data: Dictionary containing survey metadata, file path, and ping streams.
        :return: List of candidate detection objects matching the application detection schema.
        """
        pass
