"""
Model configuration and management
"""
import os
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class ModelConfig:
    """Configuration for OCR models"""
    model_type: str = 'easyocr' 
    language: str = 'en'
    use_gpu: bool = False
    confidence_threshold: float = 0.3
    preprocessing_enabled: bool = True
    
    # Model-specific settings
    easyocr_settings: Dict[str, Any] = None
    paddleocr_settings: Dict[str, Any] = None
    tesseract_settings: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.easyocr_settings is None:
            self.easyocr_settings = {
                'gpu': self.use_gpu,
                'quantize': False,  # For Apple Silicon compatibility
                'width_ths': 0.7,
                'height_ths': 0.7
            }
        
        if self.paddleocr_settings is None:
            self.paddleocr_settings = {
                'use_angle_cls': True,
                'lang': self.language,
                'use_gpu': self.use_gpu,
                'show_log': False
            }
        
        if self.tesseract_settings is None:
            self.tesseract_settings = {
                'config': '--psm 6'  # Assume uniform block of text
            }

class ModelManager:
    """Manage multiple OCR models and switching between them"""
    
    def __init__(self):
        self.available_models = ['easyocr', 'paddleocr', 'tesseract']
        self.current_config = ModelConfig()
        self.models = {}
    
    def set_model(self, model_type: str, config: ModelConfig = None):
        """Switch to a different OCR model"""
        if model_type not in self.available_models:
            raise ValueError(f"Model {model_type} not supported. Available: {self.available_models}")
        
        if config:
            self.current_config = config
        else:
            self.current_config.model_type = model_type
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get information about current model"""
        return {
            'current_model': self.current_config.model_type,
            'available_models': self.available_models,
            'configuration': self.current_config.__dict__
        }
    
    def benchmark_models(self, test_images: list) -> Dict[str, Any]:
        """Benchmark different models on test images"""
        # TODO: Implement model comparison
        pass
