from typing import Dict, Any, List
from .base import InferenceProvider

class MockInferenceProvider(InferenceProvider):
    """
    InferenceProvider implementation.
    Zero synthetic or mock detection generation. Only real model inference or API-ingested data is accepted.
    """

    async def infer(self, input_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        # Strictly return empty list: zero synthetic or mock data is injected.
        return []
