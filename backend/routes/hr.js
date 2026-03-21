const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const db = require('../database');
const { requireRole, logAudit } = require('../middleware/auth');

const upload = multer({ dest: path.join(__dirname, '..', 'uploads', 'attendance'), limits: { fileSize: 10 * 1024 * 1024 } });

// ═══════════════════════════════════════════════
// EMPLOYEES
// ═══════════════════════════════════════════════

// GET /api/hr/employees
router.get('/employees', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const { search, department, employment_type, status = 'active' } = req.query;
    const conditions = [];
    const params = [];
    if (status && status !== 'all') { conditions.push('e.status = ?'); params.push(status); }
    if (department) { conditions.push('e.department = ?'); params.push(department); }
    if (employment_type) { conditions.push('e.employment_type = ?'); params.push(employment_type); }
    if (search) { conditions.push('(e.full_name LIKE ? OR e.emp_code LIKE ? OR e.national_id LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const employees = db.prepare(`SELECT * FROM employees e ${where} ORDER BY e.emp_code`).all(...params);
    
    // KPI counts
    const total = db.prepare("SELECT COUNT(*) as c FROM employees WHERE status='active'").get().c;
    const fullTime = db.prepare("SELECT COUNT(*) as c FROM employees WHERE status='active' AND employment_type='full_time'").get().c;
    const daily = db.prepare("SELECT COUNT(*) as c FROM employees WHERE status='active' AND employment_type='daily'").get().c;
    const pieceWork = db.prepare("SELECT COUNT(*) as c FROM employees WHERE status='active' AND employment_type='piece_work'").get().c;

    res.json({ employees, kpi: { total, full_time: fullTime, daily, piece_work: pieceWork } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/hr/employees/next-code
router.get('/employees/next-code', requireRole('superadmin', 'hr'), (req, res) => {
  try {
    const last = db.prepare("SELECT emp_code FROM employees ORDER BY id DESC LIMIT 1").get();
    let next = 'EMP-001';
    if (last) {
      const num = parseInt(last.emp_code.replace('EMP-', '')) + 1;
      next = `EMP-${String(num).padStart(3, '0')}`;
    }
    res.json({ next_code: next });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/hr/employees
router.post('/employees', requireRole('superadmin', 'hr'), (req, res) => {
  try {
    const d = req.body;
    if (!d.emp_code || !d.full_name) return res.status(400).json({ error: 'كود الموظف والاسم مطلوبان' });

    const existing = db.prepare('SELECT id FROM employees WHERE emp_code = ?').get(d.emp_code);
    if (existing) return res.status(400).json({ error: 'كود الموظف مستخدم بالفعل' });

    const result = db.prepare(`
      INSERT INTO employees (emp_code, full_name, national_id, department, job_title, employment_type,
        salary_type, base_salary, standard_hours_per_day, standard_days_per_month,
        housing_allowance, transport_allowance, food_allowance, other_allowances,
        social_insurance, tax_deduction, other_deductions_fixed, overtime_rate_multiplier,
        hire_date, phone, address, bank_account, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      d.emp_code, d.full_name, d.national_id || null, d.department || null, d.job_title || null,
      d.employment_type || 'full_time', d.salary_type || 'monthly', d.base_salary || 0,
      d.standard_hours_per_day || 8, d.standard_days_per_month || 26,
      d.housing_allowance || 0, d.transport_allowance || 0, d.food_allowance || 0, d.other_allowances || 0,
      d.social_insurance || 0, d.tax_deduction || 0, d.other_deductions_fixed || 0,
      d.overtime_rate_multiplier || 1.5,
      d.hire_date || null, d.phone || null, d.address || null, d.bank_account || null, d.notes || null
    );

    logAudit(req, 'CREATE', 'employee', result.lastInsertRowid, d.full_name, null, d);
    res.json({ id: result.lastInsertRowid, message: 'تم إنشاء الموظف بنجاح' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/hr/employees/:id
router.get('/employees/:id', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });

    // Recent attendance
    const attendance = db.prepare(`
      SELECT * FROM attendance WHERE employee_id = ? ORDER BY work_date DESC LIMIT 30
    `).all(emp.id);

    // Payroll history
    const payroll = db.prepare(`
      SELECT pr.*, pp.period_month, pp.period_name FROM payroll_records pr
      JOIN payroll_periods pp ON pp.id = pr.period_id
      WHERE pr.employee_id = ? ORDER BY pp.period_month DESC LIMIT 12
    `).all(emp.id);

    // Adjustments
    const adjustments = db.prepare(`
      SELECT * FROM hr_adjustments WHERE employee_id = ? ORDER BY created_at DESC LIMIT 20
    `).all(emp.id);

    res.json({ ...emp, attendance, payroll, adjustments });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/hr/employees/:id
router.put('/employees/:id', requireRole('superadmin', 'hr'), (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM employees WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'الموظف غير موجود' });

    const d = req.body;
    db.prepare(`
      UPDATE employees SET full_name=?, national_id=?, department=?, job_title=?, employment_type=?,
        salary_type=?, base_salary=?, standard_hours_per_day=?, standard_days_per_month=?,
        housing_allowance=?, transport_allowance=?, food_allowance=?, other_allowances=?,
        social_insurance=?, tax_deduction=?, other_deductions_fixed=?, overtime_rate_multiplier=?,
        hire_date=?, termination_date=?, status=?, phone=?, address=?, bank_account=?, notes=?
      WHERE id=?
    `).run(
      d.full_name || old.full_name, d.national_id ?? old.national_id, d.department ?? old.department,
      d.job_title ?? old.job_title, d.employment_type || old.employment_type,
      d.salary_type || old.salary_type, d.base_salary ?? old.base_salary,
      d.standard_hours_per_day ?? old.standard_hours_per_day, d.standard_days_per_month ?? old.standard_days_per_month,
      d.housing_allowance ?? old.housing_allowance, d.transport_allowance ?? old.transport_allowance,
      d.food_allowance ?? old.food_allowance, d.other_allowances ?? old.other_allowances,
      d.social_insurance ?? old.social_insurance, d.tax_deduction ?? old.tax_deduction,
      d.other_deductions_fixed ?? old.other_deductions_fixed, d.overtime_rate_multiplier ?? old.overtime_rate_multiplier,
      d.hire_date ?? old.hire_date, d.termination_date ?? old.termination_date,
      d.status || old.status, d.phone ?? old.phone, d.address ?? old.address,
      d.bank_account ?? old.bank_account, d.notes ?? old.notes,
      old.id
    );

    logAudit(req, 'UPDATE', 'employee', old.id, d.full_name || old.full_name, old, d);
    res.json({ message: 'تم تحديث بيانات الموظف' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/hr/employees/:id — soft delete
router.delete('/employees/:id', requireRole('superadmin', 'hr'), (req, res) => {
  try {
    const emp = db.prepare('SELECT id, full_name FROM employees WHERE id = ?').get(req.params.id);
    if (!emp) return res.status(404).json({ error: 'الموظف غير موجود' });
    db.prepare("UPDATE employees SET status='terminated', termination_date=datetime('now') WHERE id=?").run(emp.id);
    logAudit(req, 'DELETE', 'employee', emp.id, emp.full_name);
    res.json({ message: 'تم إنهاء خدمة الموظف' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// ATTENDANCE
// ═══════════════════════════════════════════════

const ARABIC_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function getDayName(dateStr) {
  const d = new Date(dateStr);
  return ARABIC_DAYS[d.getDay()];
}

// POST /api/hr/attendance/import — Excel import
router.post('/attendance/import', requireRole('superadmin', 'hr'), upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'يرجى رفع ملف Excel' });
    const { period_month } = req.body;
    if (!period_month) return res.status(400).json({ error: 'الشهر مطلوب (YYYY-MM)' });

    const workbook = XLSX.readFile(req.file.path, { type: 'file', codepage: 65001 });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (!data || data.length < 2) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'الملف فارغ أو غير صالح' });
    }

    // Create import record
    const importRecord = db.prepare(
      'INSERT INTO attendance_imports (import_month, filename, imported_by, status) VALUES (?,?,?,?)'
    ).run(period_month, req.file.originalname, req.user.id, 'pending');
    const batchId = importRecord.lastInsertRowid;

    // Get all employees for matching
    const employees = db.prepare("SELECT id, emp_code, full_name FROM employees WHERE status='active'").all();
    const empByCode = new Map(employees.map(e => [e.emp_code.toLowerCase(), e]));
    const empByName = new Map(employees.map(e => [e.full_name.trim(), e]));

    const headers = data[0].map(h => String(h).trim());
    let imported = 0;
    const errors = [];

    // Detect format: Format A (rows=employees, columns=dates) vs Format B (one row per day per employee)
    const isFormatB = headers.some(h => /تاريخ|date/i.test(String(h))) && headers.some(h => /ساعات|hours/i.test(String(h)));

    const upsertAttendance = db.prepare(`
      INSERT INTO attendance (employee_id, work_date, day_of_week, actual_hours, attendance_status, import_batch_id)
      VALUES (?,?,?,?,?,?)
      ON CONFLICT(employee_id, work_date) DO UPDATE SET
        actual_hours=excluded.actual_hours, attendance_status=excluded.attendance_status, import_batch_id=excluded.import_batch_id
    `);

    const insertMany = db.transaction((records) => {
      for (const r of records) {
        upsertAttendance.run(r.employee_id, r.work_date, r.day_of_week, r.actual_hours, r.status, batchId);
        imported++;
      }
    });

    const records = [];

    if (isFormatB) {
      // Format B: columns = employee code/name, date, hours
      const codeIdx = headers.findIndex(h => /كود|code|emp/i.test(h));
      const nameIdx = headers.findIndex(h => /اسم|name|الموظف/i.test(h));
      const dateIdx = headers.findIndex(h => /تاريخ|date/i.test(h));
      const hoursIdx = headers.findIndex(h => /ساعات|hours|العمل/i.test(h));

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const code = codeIdx >= 0 ? String(row[codeIdx]).trim().toLowerCase() : '';
        const name = nameIdx >= 0 ? String(row[nameIdx]).trim() : '';
        const emp = empByCode.get(code) || empByName.get(name);

        if (!emp) { errors.push({ row: i + 1, value: code || name, reason: 'لم يتم التعرف على الموظف' }); continue; }

        let dateVal = dateIdx >= 0 ? row[dateIdx] : null;
        if (!dateVal) continue;
        // Handle Excel serial dates
        if (typeof dateVal === 'number') {
          const d = XLSX.SSF.parse_date_code(dateVal);
          dateVal = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        } else {
          dateVal = String(dateVal).trim();
        }

        const hours = parseFloat(row[hoursIdx]) || 0;
        records.push({
          employee_id: emp.id,
          work_date: dateVal,
          day_of_week: getDayName(dateVal),
          actual_hours: hours,
          status: hours > 0 ? (hours >= 4 ? 'present' : 'half_day') : 'absent'
        });
      }
    } else {
      // Format A: first column = employee, remaining columns = dates
      const empColIdx = 0;
      // Date columns start from index 1
      const dateCols = [];
      for (let c = 1; c < headers.length; c++) {
        let h = headers[c];
        if (!h) continue;
        // Could be "1/3", "2/3" or "2026-03-01" or Excel serial
        let dateStr;
        if (typeof h === 'number') {
          const d = XLSX.SSF.parse_date_code(h);
          dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        } else {
          const hStr = String(h).trim();
          const parts = hStr.split('/');
          if (parts.length === 2) {
            const day = parts[0].padStart(2, '0');
            const mon = parts[1].padStart(2, '0');
            dateStr = `${period_month}-${day}`;
          } else {
            dateStr = hStr;
          }
        }
        dateCols.push({ colIdx: c, date: dateStr });
      }

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const empVal = String(row[empColIdx]).trim();
        const emp = empByCode.get(empVal.toLowerCase()) || empByName.get(empVal);

        if (!emp) { errors.push({ row: i + 1, value: empVal, reason: 'لم يتم التعرف على الموظف' }); continue; }

        for (const dc of dateCols) {
          const hours = parseFloat(row[dc.colIdx]) || 0;
          records.push({
            employee_id: emp.id,
            work_date: dc.date,
            day_of_week: getDayName(dc.date),
            actual_hours: hours,
            status: hours > 0 ? (hours >= 4 ? 'present' : 'half_day') : 'absent'
          });
        }
      }
    }

    insertMany(records);

    // Update import record
    db.prepare('UPDATE attendance_imports SET records_count=?, status=? WHERE id=?')
      .run(imported, 'processed', batchId);

    // Clean up temp file
    try { fs.unlinkSync(req.file.path); } catch {}

    logAudit(req, 'CREATE', 'attendance_import', batchId, `${period_month} (${imported} records)`);
    res.json({ imported, errors, batch_id: batchId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/hr/attendance — list with filters
router.get('/attendance', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const { employee_id, month } = req.query;
    const conditions = [];
    const params = [];
    if (employee_id) { conditions.push('a.employee_id = ?'); params.push(employee_id); }
    if (month) { conditions.push("a.work_date LIKE ?"); params.push(month + '%'); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const records = db.prepare(`
      SELECT a.*, e.full_name, e.emp_code FROM attendance a
      JOIN employees e ON e.id = a.employee_id
      ${where} ORDER BY a.work_date DESC, e.emp_code
    `).all(...params);

    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/hr/attendance/summary/:month — monthly summary per employee
router.get('/attendance/summary/:month', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const month = req.params.month;
    const summary = db.prepare(`
      SELECT e.id as employee_id, e.emp_code, e.full_name, e.department,
        COUNT(CASE WHEN a.attendance_status IN ('present','late','half_day') THEN 1 END) as days_worked,
        COALESCE(SUM(a.actual_hours), 0) as total_hours,
        COALESCE(SUM(a.overtime_hours), 0) as overtime_hours,
        COUNT(CASE WHEN a.attendance_status = 'absent' THEN 1 END) as absent_days,
        COALESCE(SUM(a.late_minutes), 0) as total_late_minutes
      FROM employees e
      LEFT JOIN attendance a ON a.employee_id = e.id AND a.work_date LIKE ?
      WHERE e.status = 'active'
      GROUP BY e.id ORDER BY e.emp_code
    `).all(month + '%');

    res.json(summary);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/hr/attendance/:id — update single record
router.put('/attendance/:id', requireRole('superadmin', 'hr'), (req, res) => {
  try {
    const old = db.prepare('SELECT * FROM attendance WHERE id = ?').get(req.params.id);
    if (!old) return res.status(404).json({ error: 'السجل غير موجود' });

    const { actual_hours, attendance_status, late_minutes, notes } = req.body;
    db.prepare('UPDATE attendance SET actual_hours=?, attendance_status=?, late_minutes=?, notes=? WHERE id=?')
      .run(actual_hours ?? old.actual_hours, attendance_status || old.attendance_status,
        late_minutes ?? old.late_minutes, notes ?? old.notes, old.id);

    res.json({ message: 'تم تحديث السجل' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/hr/attendance/bulk — manual bulk entry
router.post('/attendance/bulk', requireRole('superadmin', 'hr'), (req, res) => {
  try {
    const { records } = req.body;
    if (!records || !records.length) return res.status(400).json({ error: 'لا توجد سجلات' });

    const upsert = db.prepare(`
      INSERT INTO attendance (employee_id, work_date, day_of_week, actual_hours, attendance_status, late_minutes, notes)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(employee_id, work_date) DO UPDATE SET
        actual_hours=excluded.actual_hours, attendance_status=excluded.attendance_status,
        late_minutes=excluded.late_minutes, notes=excluded.notes
    `);

    const insertAll = db.transaction(() => {
      for (const r of records) {
        upsert.run(r.employee_id, r.work_date, getDayName(r.work_date),
          r.actual_hours || 0, r.attendance_status || 'present', r.late_minutes || 0, r.notes || null);
      }
    });
    insertAll();

    logAudit(req, 'CREATE', 'attendance', null, `bulk (${records.length} records)`);
    res.json({ message: `تم إدخال ${records.length} سجل حضور` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// PAYROLL
// ═══════════════════════════════════════════════

// GET /api/hr/payroll — list periods
router.get('/payroll', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const periods = db.prepare('SELECT * FROM payroll_periods ORDER BY period_month DESC').all();
    res.json(periods);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/hr/payroll/periods — create period
router.post('/payroll/periods', requireRole('superadmin', 'hr'), (req, res) => {
  try {
    const { period_month } = req.body;
    if (!period_month) return res.status(400).json({ error: 'الشهر مطلوب' });

    const existing = db.prepare('SELECT id FROM payroll_periods WHERE period_month = ?').get(period_month);
    if (existing) return res.status(400).json({ error: 'كشف الرواتب لهذا الشهر موجود بالفعل' });

    // Arabic month names
    const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const [y, m] = period_month.split('-');
    const periodName = `${monthNames[parseInt(m) - 1]} ${y}`;

    const result = db.prepare('INSERT INTO payroll_periods (period_month, period_name) VALUES (?,?)')
      .run(period_month, periodName);

    logAudit(req, 'CREATE', 'payroll_period', result.lastInsertRowid, periodName);
    res.json({ id: result.lastInsertRowid, message: 'تم إنشاء كشف الرواتب' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/hr/payroll/:periodId/calculate — calculate payroll
router.post('/payroll/:periodId/calculate', requireRole('superadmin', 'hr'), (req, res) => {
  try {
    const period = db.prepare('SELECT * FROM payroll_periods WHERE id = ?').get(req.params.periodId);
    if (!period) return res.status(404).json({ error: 'كشف الرواتب غير موجود' });
    if (period.status === 'paid' || period.status === 'locked') {
      return res.status(400).json({ error: 'لا يمكن إعادة احتساب كشف مدفوع أو مقفل' });
    }

    const employees = db.prepare("SELECT * FROM employees WHERE status='active'").all();
    const month = period.period_month;

    const deleteOld = db.prepare('DELETE FROM payroll_records WHERE period_id = ?');
    const insertRecord = db.prepare(`
      INSERT INTO payroll_records (period_id, employee_id, days_worked, hours_worked, overtime_hours, absent_days,
        base_pay, overtime_pay, housing_allowance, transport_allowance, food_allowance, other_allowances,
        bonuses, gross_pay, absence_deduction, late_deduction, social_insurance, tax_deduction,
        loans_deduction, other_deductions, total_deductions, net_pay, notes)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);

    let totalGross = 0, totalNet = 0, totalDeductions = 0;

    const calculate = db.transaction(() => {
      deleteOld.run(period.id);

      for (const emp of employees) {
        // Get attendance summary
        const att = db.prepare(`
          SELECT
            COUNT(CASE WHEN attendance_status IN ('present','late','half_day') THEN 1 END) as days_worked,
            COALESCE(SUM(actual_hours), 0) as total_hours,
            COALESCE(SUM(overtime_hours), 0) as overtime_hours,
            COUNT(CASE WHEN attendance_status = 'absent' THEN 1 END) as absent_days,
            COALESCE(SUM(late_minutes), 0) as total_late_minutes
          FROM attendance WHERE employee_id = ? AND work_date LIKE ?
        `).get(emp.id, month + '%');

        const summary = att || { days_worked: 0, total_hours: 0, overtime_hours: 0, absent_days: 0, total_late_minutes: 0 };

        // Get adjustments for this period
        const adjustments = db.prepare(`
          SELECT * FROM hr_adjustments WHERE employee_id = ? AND (period_id = ? OR period_id IS NULL) AND applied = 0
        `).all(emp.id, period.id);

        const pay = calculateEmployeePay(emp, summary, adjustments);

        insertRecord.run(
          period.id, emp.id, pay.days_worked, pay.hours_worked, pay.overtime_hours, pay.absent_days,
          pay.base_pay, pay.overtime_pay, pay.housing_allowance, pay.transport_allowance,
          pay.food_allowance, pay.other_allowances, pay.bonuses, pay.gross_pay,
          pay.absence_deduction, pay.late_deduction, pay.social_insurance, pay.tax_deduction,
          pay.loans_deduction, pay.other_deductions, pay.total_deductions, pay.net_pay,
          summary.days_worked === 0 ? 'لا يوجد حضور مسجل' : null
        );

        // Mark adjustments as applied
        for (const adj of adjustments) {
          db.prepare('UPDATE hr_adjustments SET applied = 1, period_id = ? WHERE id = ?').run(period.id, adj.id);
        }

        totalGross += pay.gross_pay;
        totalNet += pay.net_pay;
        totalDeductions += pay.total_deductions;
      }

      db.prepare(`
        UPDATE payroll_periods SET status='calculated', total_gross=?, total_net=?, total_deductions=?, calculated_at=datetime('now')
        WHERE id=?
      `).run(Math.round(totalGross * 100) / 100, Math.round(totalNet * 100) / 100, Math.round(totalDeductions * 100) / 100, period.id);
    });

    calculate();

    logAudit(req, 'UPDATE', 'payroll_period', period.id, `Calculate ${period.period_name}`);
    res.json({ message: 'تم احتساب الرواتب بنجاح', total_gross: totalGross, total_net: totalNet, employees_count: employees.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

function calculateEmployeePay(employee, attendanceSummary, adjustments) {
  let base_pay = 0, daily_rate = 0, hourly_rate = 0;

  if (employee.salary_type === 'monthly') {
    daily_rate = employee.base_salary / employee.standard_days_per_month;
    hourly_rate = daily_rate / employee.standard_hours_per_day;
    base_pay = daily_rate * attendanceSummary.days_worked;
    if (attendanceSummary.absent_days === 0) base_pay = employee.base_salary;
  } else if (employee.salary_type === 'daily') {
    daily_rate = employee.base_salary;
    hourly_rate = daily_rate / employee.standard_hours_per_day;
    base_pay = employee.base_salary * attendanceSummary.days_worked;
  } else if (employee.salary_type === 'hourly') {
    hourly_rate = employee.base_salary;
    daily_rate = hourly_rate * employee.standard_hours_per_day;
    base_pay = employee.base_salary * attendanceSummary.total_hours;
  } else if (employee.salary_type === 'piece_work') {
    base_pay = 0; // added as adjustment
  }

  const overtime_pay = attendanceSummary.overtime_hours * hourly_rate * employee.overtime_rate_multiplier;

  const housing = employee.housing_allowance;
  const transport = employee.transport_allowance;
  const food = employee.food_allowance;
  const other_allow = employee.other_allowances;

  const gross_pay = base_pay + overtime_pay + housing + transport + food + other_allow;

  const absence_deduction = employee.salary_type === 'monthly' ? daily_rate * attendanceSummary.absent_days : 0;
  const late_deduction = ((attendanceSummary.total_late_minutes || 0) / 60) * hourly_rate;
  const social = employee.social_insurance;
  const tax = employee.tax_deduction;

  const bonuses = adjustments.filter(a => a.adj_type === 'bonus').reduce((s, a) => s + a.amount, 0);
  const extra_deductions = adjustments.filter(a => a.adj_type === 'deduction').reduce((s, a) => s + a.amount, 0);
  const loan_repayments = adjustments.filter(a => a.adj_type === 'loan_repayment').reduce((s, a) => s + a.amount, 0);

  const total_deductions = absence_deduction + late_deduction + social + tax + extra_deductions + loan_repayments + employee.other_deductions_fixed;
  const net_pay = (gross_pay + bonuses) - total_deductions;

  return {
    base_pay: Math.round(base_pay * 100) / 100,
    overtime_pay: Math.round(overtime_pay * 100) / 100,
    housing_allowance: housing, transport_allowance: transport,
    food_allowance: food, other_allowances: other_allow,
    bonuses: Math.round(bonuses * 100) / 100,
    gross_pay: Math.round(gross_pay * 100) / 100,
    absence_deduction: Math.round(absence_deduction * 100) / 100,
    late_deduction: Math.round(late_deduction * 100) / 100,
    social_insurance: social, tax_deduction: tax,
    loans_deduction: loan_repayments, other_deductions: extra_deductions + employee.other_deductions_fixed,
    total_deductions: Math.round(total_deductions * 100) / 100,
    net_pay: Math.round(net_pay * 100) / 100,
    days_worked: attendanceSummary.days_worked,
    hours_worked: attendanceSummary.total_hours,
    overtime_hours: attendanceSummary.overtime_hours,
    absent_days: attendanceSummary.absent_days,
  };
}

// GET /api/hr/payroll/:periodId — full period details
router.get('/payroll/:periodId', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const period = db.prepare('SELECT * FROM payroll_periods WHERE id = ?').get(req.params.periodId);
    if (!period) return res.status(404).json({ error: 'كشف الرواتب غير موجود' });

    const records = db.prepare(`
      SELECT pr.*, e.emp_code, e.full_name, e.department, e.job_title, e.salary_type, e.base_salary
      FROM payroll_records pr
      JOIN employees e ON e.id = pr.employee_id
      WHERE pr.period_id = ?
      ORDER BY e.emp_code
    `).all(period.id);

    res.json({ ...period, records });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/hr/payroll/:periodId/approve
router.patch('/payroll/:periodId/approve', requireRole('superadmin', 'manager'), (req, res) => {
  try {
    const period = db.prepare('SELECT * FROM payroll_periods WHERE id = ?').get(req.params.periodId);
    if (!period) return res.status(404).json({ error: 'كشف الرواتب غير موجود' });
    if (period.status !== 'calculated') return res.status(400).json({ error: 'يجب احتساب الرواتب أولاً' });

    db.prepare("UPDATE payroll_periods SET status='approved', approved_by=?, approved_at=datetime('now') WHERE id=?")
      .run(req.user.id, period.id);

    logAudit(req, 'UPDATE', 'payroll_period', period.id, `Approve ${period.period_name}`);
    res.json({ message: 'تم اعتماد كشف الرواتب' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/hr/payroll/:periodId/pay
router.patch('/payroll/:periodId/pay', requireRole('superadmin', 'manager'), (req, res) => {
  try {
    const period = db.prepare('SELECT * FROM payroll_periods WHERE id = ?').get(req.params.periodId);
    if (!period) return res.status(404).json({ error: 'كشف الرواتب غير موجود' });
    if (period.status !== 'approved') return res.status(400).json({ error: 'يجب اعتماد الكشف أولاً' });

    const now = new Date().toISOString();
    db.prepare("UPDATE payroll_periods SET status='paid' WHERE id=?").run(period.id);
    db.prepare("UPDATE payroll_records SET payment_status='paid', payment_date=? WHERE period_id=?").run(now, period.id);

    logAudit(req, 'UPDATE', 'payroll_period', period.id, `Pay ${period.period_name}`);
    res.json({ message: 'تم تأكيد صرف الرواتب' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/hr/payroll/:periodId/slip/:employeeId — payslip
router.get('/payroll/:periodId/slip/:employeeId', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const record = db.prepare(`
      SELECT pr.*, e.emp_code, e.full_name, e.department, e.job_title, e.salary_type,
        e.base_salary, e.standard_hours_per_day, e.standard_days_per_month, e.overtime_rate_multiplier,
        pp.period_month, pp.period_name
      FROM payroll_records pr
      JOIN employees e ON e.id = pr.employee_id
      JOIN payroll_periods pp ON pp.id = pr.period_id
      WHERE pr.period_id = ? AND pr.employee_id = ?
    `).get(req.params.periodId, req.params.employeeId);

    if (!record) return res.status(404).json({ error: 'سجل الراتب غير موجود' });
    res.json(record);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/hr/adjustments
router.post('/adjustments', requireRole('superadmin', 'hr'), (req, res) => {
  try {
    const { employee_id, period_id, adj_type, amount, description } = req.body;
    if (!employee_id || !adj_type || !amount || !description) {
      return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
    }

    const result = db.prepare(
      'INSERT INTO hr_adjustments (employee_id, period_id, adj_type, amount, description, created_by) VALUES (?,?,?,?,?,?)'
    ).run(employee_id, period_id || null, adj_type, amount, description, req.user.id);

    logAudit(req, 'CREATE', 'hr_adjustment', result.lastInsertRowid, `${adj_type}: ${description}`);
    res.json({ id: result.lastInsertRowid, message: 'تم إضافة التعديل' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/hr/adjustments/:employeeId
router.get('/adjustments/:employeeId', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const adjs = db.prepare('SELECT * FROM hr_adjustments WHERE employee_id = ? ORDER BY created_at DESC').all(req.params.employeeId);
    res.json(adjs);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════
// LEAVE REQUESTS
// ═══════════════════════════════════════════════

// GET /api/hr/leaves
router.get('/leaves', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const leaves = db.prepare(`
      SELECT lr.*, e.name as employee_name, e.code as employee_code
      FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id
      ORDER BY lr.created_at DESC
    `).all();
    res.json(leaves);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/hr/leaves
router.post('/leaves', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const { employee_id, leave_type, start_date, end_date, reason } = req.body;
    if (!employee_id || !start_date || !end_date) return res.status(400).json({ error: 'الموظف وتواريخ الإجازة مطلوبة' });
    const validTypes = ['annual', 'sick', 'unpaid', 'emergency'];
    if (leave_type && !validTypes.includes(leave_type)) return res.status(400).json({ error: 'نوع الإجازة غير صالح' });

    const result = db.prepare(`
      INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(employee_id, leave_type || 'annual', start_date, end_date, reason || null);

    const leave = db.prepare(`
      SELECT lr.*, e.name as employee_name FROM leave_requests lr
      LEFT JOIN employees e ON e.id = lr.employee_id WHERE lr.id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json(leave);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/hr/leaves/:id — approve/reject
router.patch('/leaves/:id', requireRole('superadmin', 'hr', 'manager'), (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'الحالة غير صالحة' });
    const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id);
    if (!leave) return res.status(404).json({ error: 'الطلب غير موجود' });
    if (leave.status !== 'pending') return res.status(400).json({ error: 'لا يمكن تعديل طلب تمت مراجعته' });

    db.prepare(`UPDATE leave_requests SET status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`)
      .run(status, req.user?.id || null, req.params.id);

    res.json({ message: status === 'approved' ? 'تم قبول الطلب' : 'تم رفض الطلب' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
