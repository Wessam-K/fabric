/**
 * TypeScript type definitions for WK-Factory backend
 * @typedef {import('better-sqlite3').Database} Database
 */

// ──────────────────────────────────────────────
// Database Row Types
// ──────────────────────────────────────────────

/** @typedef {{ id: number, model_code: string, serial_number?: string, model_name?: string, category?: string, gender: 'male'|'female'|'kids'|'unisex', model_image?: string, notes?: string, status: 'active'|'inactive'|'discontinued', created_at: string, updated_at: string }} Model */

/** @typedef {{ id: number, code: string, name: string, fabric_type: 'main'|'lining'|'both', price_per_m: number, supplier_id?: number, supplier?: string, color?: string, image_path?: string, status: 'active'|'inactive', notes?: string, created_at: string }} Fabric */

/** @typedef {{ id: number, code: string, acc_type: 'button'|'zipper'|'thread'|'label'|'padding'|'interfacing'|'elastic'|'packaging'|'other', name: string, unit_price: number, unit: 'piece'|'meter'|'kg'|'roll', supplier_id?: number, supplier?: string, status: 'active'|'inactive', notes?: string, created_at: string }} Accessory */

/** @typedef {{ id: number, wo_number: string, model_id?: number, template_id?: number, status: 'draft'|'pending'|'in_progress'|'completed'|'cancelled', priority: 'low'|'normal'|'high'|'urgent', assigned_to?: string, start_date?: string, due_date?: string, completed_date?: string, masnaiya: number, masrouf: number, margin_pct: number, consumer_price?: number, wholesale_price?: number, notes?: string, created_at: string, updated_at: string }} WorkOrder */

/** @typedef {{ id: number, invoice_number: string, customer_name: string, customer_phone?: string, customer_email?: string, wo_id?: number, status: 'draft'|'sent'|'paid'|'overdue'|'cancelled', tax_pct: number, discount: number, subtotal: number, total: number, notes?: string, due_date?: string, created_at: string, updated_at: string }} Invoice */

/** @typedef {{ id: number, code: string, name: string, supplier_type: 'fabric'|'accessory'|'both'|'other', phone?: string, email?: string, address?: string, contact_name?: string, payment_terms?: string, rating: number, status: 'active'|'inactive', notes?: string, created_at: string }} Supplier */

/** @typedef {{ id: number, username: string, full_name: string, email?: string, password_hash: string, role: 'superadmin'|'manager'|'accountant'|'production'|'hr'|'viewer', department?: string, employee_id?: number, status: 'active'|'inactive'|'suspended', last_login?: string, created_at: string, must_change_password: number, failed_login_attempts: number, locked_until?: string, password_changed_at?: string }} User */

/** @typedef {{ id: number, emp_code: string, full_name: string, national_id?: string, department?: string, job_title?: string, employment_type: 'full_time'|'part_time'|'daily'|'piece_work', salary_type: 'monthly'|'daily'|'hourly'|'piece_work', base_salary: number, status: 'active'|'inactive'|'terminated', hire_date?: string, created_at: string }} Employee */

// ──────────────────────────────────────────────
// API Types
// ──────────────────────────────────────────────

/** @typedef {{ status: 'ok'|'error', app: string, database: string }} HealthResponse */

/** @typedef {{ error: string }} ErrorResponse */

/** @typedef {{ success: boolean, data?: any, message?: string, pagination?: { page: number, limit: number, total: number } }} ApiResponse */

/** @typedef {{ module: string, action: string }} Permission */

/** @typedef {{ type: string, label: string, status: string, maxUsers: number, daysLeft: number, expiresAt: string, activatedAt: string, features: string[] }} LicenseStatus */

// ──────────────────────────────────────────────
// Express Augmentation
// ──────────────────────────────────────────────

/**
 * @typedef {import('express').Request & {
 *   user?: { id: number, username: string, role: string },
 *   requestId?: string
 * }} AuthenticatedRequest
 */

module.exports = {};
