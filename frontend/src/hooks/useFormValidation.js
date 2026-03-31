import { useState, useCallback, useMemo } from 'react';

/**
 * Reusable form validation hook.
 * @param {Object} schema - Validation schema: { fieldName: { required, minLength, maxLength, pattern, message, validate } }
 * @returns {{ errors, validate, validateField, clearError, clearAll, isValid }}
 *
 * Usage:
 *   const { errors, validate, validateField, clearError, isValid } = useFormValidation({
 *     username: { required: true, minLength: 3, message: 'اسم المستخدم مطلوب (3 أحرف على الأقل)' },
 *     email:    { required: true, pattern: /^[^\s@]+@[^\s@]+$/, message: 'بريد إلكتروني غير صالح' },
 *     price:    { required: true, validate: v => v > 0 || 'السعر يجب أن يكون أكبر من صفر' },
 *   });
 */
export default function useFormValidation(schema) {
  const [errors, setErrors] = useState({});

  const validateField = useCallback((field, value) => {
    const rule = schema[field];
    if (!rule) return '';

    const val = typeof value === 'string' ? value.trim() : value;

    if (rule.required && (val === '' || val === null || val === undefined)) {
      return rule.message || `${field} مطلوب`;
    }
    if (rule.minLength && typeof val === 'string' && val.length < rule.minLength) {
      return rule.message || `يجب أن يكون ${rule.minLength} أحرف على الأقل`;
    }
    if (rule.maxLength && typeof val === 'string' && val.length > rule.maxLength) {
      return rule.message || `يجب ألا يتجاوز ${rule.maxLength} حرف`;
    }
    if (rule.min !== undefined && Number(val) < rule.min) {
      return rule.message || `يجب أن يكون ${rule.min} على الأقل`;
    }
    if (rule.max !== undefined && Number(val) > rule.max) {
      return rule.message || `يجب ألا يتجاوز ${rule.max}`;
    }
    if (rule.pattern && !rule.pattern.test(String(val))) {
      return rule.message || 'قيمة غير صالحة';
    }
    if (rule.validate) {
      const result = rule.validate(val);
      if (typeof result === 'string') return result;
      if (result === false) return rule.message || 'قيمة غير صالحة';
    }
    return '';
  }, [schema]);

  const validate = useCallback((data) => {
    const newErrors = {};
    let valid = true;
    for (const field of Object.keys(schema)) {
      const err = validateField(field, data[field]);
      if (err) { newErrors[field] = err; valid = false; }
    }
    setErrors(newErrors);
    return valid;
  }, [schema, validateField]);

  const onBlur = useCallback((field, value) => {
    const err = validateField(field, value);
    setErrors(prev => {
      if (err) return { ...prev, [field]: err };
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, [validateField]);

  const clearError = useCallback((field) => {
    setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);

  return { errors, validate, validateField: onBlur, clearError, clearAll, isValid };
}
