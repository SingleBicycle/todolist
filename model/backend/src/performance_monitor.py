"""
Monitor model performance and collect metrics
"""
import time
import json
from datetime import datetime
from typing import Dict, Any, List
from dataclasses import dataclass, asdict

@dataclass
class PerformanceMetrics:
    timestamp: str
    processing_time_ms: float
    model_used: str
    confidence_score: float
    text_length: int
    word_count: int
    image_size: tuple
    accuracy_score: float = None
    error_occurred: bool = False
    error_message: str = None

class PerformanceMonitor:
    def __init__(self):
        self.metrics_history: List[PerformanceMetrics] = []
        self.session_start = datetime.now()
    
    def log_processing(self, metrics: Dict[str, Any]):
        """Log processing metrics"""
        perf_metric = PerformanceMetrics(
            timestamp=datetime.now().isoformat(),
            processing_time_ms=metrics.get('processing_time_ms', 0),
            model_used=metrics.get('model_used', 'unknown'),
            confidence_score=metrics.get('confidence_score', 0),
            text_length=metrics.get('character_count', 0),
            word_count=metrics.get('word_count', 0),
            image_size=metrics.get('image_size', (0, 0)),
            accuracy_score=metrics.get('accuracy_score'),
            error_occurred=metrics.get('error_occurred', False),
            error_message=metrics.get('error_message')
        )
        
        self.metrics_history.append(perf_metric)
    
    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance summary statistics"""
        if not self.metrics_history:
            return {'status': 'No data available'}
        
        processing_times = [m.processing_time_ms for m in self.metrics_history if not m.error_occurred]
        confidence_scores = [m.confidence_score for m in self.metrics_history if not m.error_occurred]
        accuracy_scores = [m.accuracy_score for m in self.metrics_history if m.accuracy_score is not None]
        
        return {
            'total_requests': len(self.metrics_history),
            'successful_requests': len(processing_times),
            'error_rate': len([m for m in self.metrics_history if m.error_occurred]) / len(self.metrics_history),
            'avg_processing_time_ms': sum(processing_times) / len(processing_times) if processing_times else 0,
            'avg_confidence': sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0,
            'avg_accuracy': sum(accuracy_scores) / len(accuracy_scores) if accuracy_scores else None,
            'session_duration_minutes': (datetime.now() - self.session_start).total_seconds() / 60
        }
    
    def export_metrics(self, filename: str = None):
        """Export metrics to JSON file"""
        if filename is None:
            filename = f"ocr_metrics_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        data = {
            'session_info': {
                'start_time': self.session_start.isoformat(),
                'export_time': datetime.now().isoformat(),
                'total_requests': len(self.metrics_history)
            },
            'summary': self.get_performance_summary(),
            'detailed_metrics': [asdict(m) for m in self.metrics_history]
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        return filename
