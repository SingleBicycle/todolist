"""
Accuracy measurement and feedback system
"""
import difflib
import numpy as np
from typing import Dict, Any, List
import re

class AccuracyScorer:
    def __init__(self):
        self.feedback_data = []  # Store for model improvement
    
    def calculate_metrics(self, predicted: str, ground_truth: str) -> Dict[str, Any]:
        """Calculate comprehensive accuracy metrics"""
        if not ground_truth:
            return {'error': 'Ground truth required for accuracy calculation'}
        
        # Normalize text for comparison
        pred_normalized = self._normalize_text(predicted)
        gt_normalized = self._normalize_text(ground_truth)
        
        # Calculate different metrics
        cer = self._calculate_cer(pred_normalized, gt_normalized)
        wer = self._calculate_wer(pred_normalized, gt_normalized)
        similarity = self._calculate_similarity(pred_normalized, gt_normalized)
        bleu_score = self._calculate_bleu(pred_normalized, gt_normalized)
        
        return {
            'accuracy_metrics': {
                'character_error_rate': round(cer, 4),
                'word_error_rate': round(wer, 4),
                'similarity_score': round(similarity, 4),
                'accuracy_percentage': round(similarity * 100, 2),
                'bleu_score': round(bleu_score, 4),
                'detailed_analysis': self._detailed_analysis(pred_normalized, gt_normalized)
            }
        }
    
    def _normalize_text(self, text: str) -> str:
        """Normalize text for fair comparison"""
        # Convert to lowercase
        text = text.lower()
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove common punctuation variations
        text = re.sub(r'[^\w\s]', '', text)
        return text.strip()
    
    def _calculate_cer(self, predicted: str, ground_truth: str) -> float:
        """Calculate Character Error Rate"""
        if len(ground_truth) == 0:
            return 0 if len(predicted) == 0 else 1
        
        edit_distance = self._levenshtein_distance(predicted, ground_truth)
        return edit_distance / len(ground_truth)
    
    def _calculate_wer(self, predicted: str, ground_truth: str) -> float:
        """Calculate Word Error Rate"""
        pred_words = predicted.split()
        gt_words = ground_truth.split()
        
        if len(gt_words) == 0:
            return 0 if len(pred_words) == 0 else 1
        
        edit_distance = self._levenshtein_distance(pred_words, gt_words)
        return edit_distance / len(gt_words)
    
    def _calculate_similarity(self, predicted: str, ground_truth: str) -> float:
        """Calculate similarity using difflib"""
        return difflib.SequenceMatcher(None, predicted, ground_truth).ratio()
    
    def _calculate_bleu(self, predicted: str, ground_truth: str) -> float:
        """Simple BLEU score calculation"""
        pred_words = predicted.split()
        gt_words = ground_truth.split()
        
        if len(pred_words) == 0 or len(gt_words) == 0:
            return 0.0
        
        # Simple 1-gram BLEU
        pred_set = set(pred_words)
        gt_set = set(gt_words)
        
        if len(pred_set) == 0:
            return 0.0
        
        precision = len(pred_set.intersection(gt_set)) / len(pred_set)
        recall = len(pred_set.intersection(gt_set)) / len(gt_set)
        
        if precision + recall == 0:
            return 0.0
        
        return 2 * (precision * recall) / (precision + recall)
    
    def _detailed_analysis(self, predicted: str, ground_truth: str) -> Dict[str, Any]:
        """Provide detailed analysis of errors"""
        pred_words = predicted.split()
        gt_words = ground_truth.split()
        
        # Find insertions, deletions, substitutions
        matcher = difflib.SequenceMatcher(None, gt_words, pred_words)
        operations = []
        
        for op, i1, i2, j1, j2 in matcher.get_opcodes():
            if op == 'delete':
                operations.append({
                    'type': 'deletion',
                    'expected': gt_words[i1:i2],
                    'position': i1
                })
            elif op == 'insert':
                operations.append({
                    'type': 'insertion',
                    'inserted': pred_words[j1:j2],
                    'position': i1
                })
            elif op == 'replace':
                operations.append({
                    'type': 'substitution',
                    'expected': gt_words[i1:i2],
                    'actual': pred_words[j1:j2],
                    'position': i1
                })
        
        return {
            'total_errors': len(operations),
            'error_breakdown': operations,
            'correctly_recognized_words': len([op for op in matcher.get_opcodes() if op[0] == 'equal'])
        }
    
    def _levenshtein_distance(self, s1, s2) -> int:
        """Calculate Levenshtein distance between two sequences"""
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)
        
        if len(s2) == 0:
            return len(s1)
        
        previous_row = list(range(len(s2) + 1))
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row
        
        return previous_row[-1]
    
    def store_feedback(self, feedback_data: Dict[str, Any]):
        """Store user feedback for model improvement"""
        self.feedback_data.append(feedback_data)
        # TODO: Implement persistent storage (database, file, etc.)
