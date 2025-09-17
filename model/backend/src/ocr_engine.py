
import time
import numpy as np
import cv2
from PIL import Image
import io
import logging
from typing import Dict, Any, Union

class OCREngine:
    def __init__(self, config=None):
        """Initialize OCR engine with model loading"""
        self.config = config or {}
        self.model = None
        self.model_type = self.config.get('model_type', 'easyocr')  # easyocr, paddleocr, tesseract
        self._load_model()
    
    def _load_model(self):
        """Load the selected OCR model"""
        if self.model_type == 'easyocr':
            import easyocr
            self.model = easyocr.Reader(
                ['en'], 
                gpu=False,  # CPU for MacBook compatibility
                quantize=False  # Fix for Apple Silicon
            )
        elif self.model_type == 'paddleocr':
            from paddleocr import PaddleOCR
            self.model = PaddleOCR(
                use_angle_cls=True,
                lang='en',
                use_gpu=False,
                show_log=False
            )
        elif self.model_type == 'tesseract':
            import pytesseract
            self.model = pytesseract  # Tesseract doesn't need initialization
        
        logging.info(f"OCR Engine initialized with {self.model_type}")
    
    def preprocess_image(self, image: Union[Image.Image, np.ndarray]) -> np.ndarray:
        """
        Preprocess image for better OCR results
        This is where you implement image enhancement techniques
        """
        # Convert PIL to numpy if needed
        if isinstance(image, Image.Image):
            image_np = np.array(image)
        else:
            image_np = image
        
        # Convert to grayscale
        if len(image_np.shape) == 3:
            gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = image_np
        
        # Noise reduction
        denoised = cv2.fastNlMeansDenoising(gray)
        
        # Contrast enhancement
        enhanced = cv2.equalizeHist(denoised)
        
        # Optional: Adaptive thresholding for handwriting
        adaptive_thresh = cv2.adaptiveThreshold(
            enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        return adaptive_thresh
    
    def process_image(self, image_file) -> Dict[str, Any]:
        """
        Main processing function that the API will call
        """
        start_time = time.time()
        
        try:
            # Load image
            image = Image.open(image_file.stream)
            
            # Preprocess
            processed_image = self.preprocess_image(image)
            
            # Extract text based on model type
            if self.model_type == 'easyocr':
                result = self._process_with_easyocr(processed_image)
            elif self.model_type == 'paddleocr':
                result = self._process_with_paddleocr(processed_image)
            elif self.model_type == 'tesseract':
                result = self._process_with_tesseract(processed_image)
            
            processing_time = (time.time() - start_time) * 1000  # Convert to ms
            
            result['processing_time_ms'] = round(processing_time, 2)
            result['model_used'] = self.model_type
            
            return result
            
        except Exception as e:
            logging.error(f"OCR processing failed: {str(e)}")
            raise Exception(f"OCR processing failed: {str(e)}")
    
    def _process_with_easyocr(self, image: np.ndarray) -> Dict[str, Any]:
        """Process image using EasyOCR"""
        results = self.model.readtext(image)
        
        extracted_text = ""
        confidence_scores = []
        word_details = []
        
        for (bbox, text, confidence) in results:
            if confidence > 0.3:  # Filter very low confidence
                extracted_text += text + " "
                confidence_scores.append(confidence)
                word_details.append({
                    'text': text,
                    'confidence': confidence,
                    'bbox': bbox
                })
        
        return {
            'extracted_text': extracted_text.strip(),
            'confidence_score': np.mean(confidence_scores) if confidence_scores else 0,
            'word_count': len(extracted_text.strip().split()),
            'character_count': len(extracted_text.strip()),
            'word_details': word_details
        }
    
    def _process_with_paddleocr(self, image: np.ndarray) -> Dict[str, Any]:
        """Process image using PaddleOCR"""
        result = self.model.ocr(image, cls=True)
        
        extracted_text = ""
        confidence_scores = []
        word_details = []
        
        if result and result[0]:
            for line in result[0]:
                text = line[1][0]
                confidence = line[1][1]
                bbox = line[0]
                
                extracted_text += text + " "
                confidence_scores.append(confidence)
                word_details.append({
                    'text': text,
                    'confidence': confidence,
                    'bbox': bbox
                })
        
        return {
            'extracted_text': extracted_text.strip(),
            'confidence_score': np.mean(confidence_scores) if confidence_scores else 0,
            'word_count': len(extracted_text.strip().split()),
            'character_count': len(extracted_text.strip()),
            'word_details': word_details
        }
    
    def _process_with_tesseract(self, image: np.ndarray) -> Dict[str, Any]:
        """Process image using Tesseract"""
        import pytesseract
        from PIL import Image
        
        # Convert numpy array back to PIL for tesseract
        pil_image = Image.fromarray(image)
        
        # Get text with confidence data
        data = pytesseract.image_to_data(pil_image, output_type=pytesseract.Output.DICT)
        
        extracted_text = ""
        confidence_scores = []
        word_details = []
        
        for i, text in enumerate(data['text']):
            if text.strip():
                confidence = int(data['conf'][i]) / 100.0  # Convert to 0-1 range
                if confidence > 0.3:
                    extracted_text += text + " "
                    confidence_scores.append(confidence)
                    
                    # Construct bounding box
                    x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    bbox = [[x, y], [x+w, y], [x+w, y+h], [x, y+h]]
                    
                    word_details.append({
                        'text': text,
                        'confidence': confidence,
                        'bbox': bbox
                    })
        
        return {
            'extracted_text': extracted_text.strip(),
            'confidence_score': np.mean(confidence_scores) if confidence_scores else 0,
            'word_count': len(extracted_text.strip().split()),
            'character_count': len(extracted_text.strip()),
            'word_details': word_details
        }
