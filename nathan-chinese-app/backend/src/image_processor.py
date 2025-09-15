"""
Advanced image preprocessing for better OCR results
"""
import cv2
import numpy as np
from PIL import Image, ImageEnhance
from typing import Union, Tuple

class ImageProcessor:
    """Advanced image preprocessing for handwriting OCR"""
    
    def __init__(self):
        self.processing_pipeline = [
            self.resize_if_needed,
            self.convert_to_grayscale,
            self.denoise,
            self.enhance_contrast,
            self.binarize,
            self.deskew,
            self.remove_noise_after_binarization
        ]
    
    def process(self, image: Union[Image.Image, np.ndarray], 
                custom_pipeline: list = None) -> np.ndarray:
        """Apply full preprocessing pipeline"""
        
        if isinstance(image, Image.Image):
            image = np.array(image)
        
        pipeline = custom_pipeline or self.processing_pipeline
        
        for step in pipeline:
            image = step(image)
        
        return image
    
    def resize_if_needed(self, image: np.ndarray, max_width: int = 2000) -> np.ndarray:
        """Resize image if too large"""
        height, width = image.shape[:2]
        
        if width > max_width:
            scale = max_width / width
            new_width = max_width
            new_height = int(height * scale)
            image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
        
        return image
    
    def convert_to_grayscale(self, image: np.ndarray) -> np.ndarray:
        """Convert image to grayscale"""
        if len(image.shape) == 3:
            return cv2.cvtColor(image, cv2.COLOR_RGB2GRAY)
        return image
    
    def denoise(self, image: np.ndarray) -> np.ndarray:
        """Remove noise from image"""
        return cv2.fastNlMeansDenoising(image, h=10, templateWindowSize=7, searchWindowSize=21)
    
    def enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """Enhance image contrast"""
        # CLAHE (Contrast Limited Adaptive Histogram Equalization)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        return clahe.apply(image)
    
    def binarize(self, image: np.ndarray) -> np.ndarray:
        """Convert to binary image (black text on white background)"""
        # Adaptive thresholding works better for handwriting
        binary = cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        return binary
    
    def deskew(self, image: np.ndarray) -> np.ndarray:
        """Correct skewed text"""
        # Find lines using HoughLines
        edges = cv2.Canny(image, 50, 150, apertureSize=3)
        lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
        
        if lines is not None:
            # Calculate most common angle
            angles = []
            for line in lines:
                rho, theta = line[0]
                angle = theta * 180 / np.pi
                angles.append(angle)
            
            if angles:
                # Use median angle to avoid outliers
                median_angle = np.median(angles)
                
                # Only correct if angle is significant
                if abs(median_angle - 90) > 1:  # More than 1 degree skew
                    rotation_angle = median_angle - 90
                    
                    # Rotate image
                    height, width = image.shape
                    center = (width // 2, height // 2)
                    rotation_matrix = cv2.getRotationMatrix2D(center, rotation_angle, 1.0)
                    image = cv2.warpAffine(image, rotation_matrix, (width, height), 
                                         flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        return image
    
    def remove_noise_after_binarization(self, image: np.ndarray) -> np.ndarray:
        """Remove small noise artifacts after binarization"""
        # Morphological operations to clean up
        kernel = np.ones((1, 1), np.uint8)
        image = cv2.morphologyEx(image, cv2.MORPH_CLOSE, kernel)
        image = cv2.morphologyEx(image, cv2.MORPH_OPEN, kernel)
        
        return image
    
    def get_text_regions(self, image: np.ndarray) -> list:
        """Detect text regions in the image"""
        # Find contours that might contain text
        contours, _ = cv2.findContours(image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        text_regions = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            
            # Filter based on size (likely text regions)
            if w > 10 and h > 10 and w < image.shape[1] * 0.9:
                text_regions.append((x, y, w, h))
        
        return text_regions
