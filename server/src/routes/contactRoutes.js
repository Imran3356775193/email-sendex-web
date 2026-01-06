const express = require('express');
const router = express.Router();
const Contact = require('../models/Contact');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const csv = require('csv-parser');
const xlsx = require('xlsx');
const multer = require('multer');
const { Readable } = require('stream');

const upload = multer({ storage: multer.memoryStorage() });

// Contact Manager deprecated: Only /export is available. All other endpoints return 410 Gone.
router.use((req, res, next) => {
  if (req.path === '/export') return next();
  return res.status(410).json({ success: false, error: 'Contact Manager feature removed per client request. Use /api/contacts/export to download your contacts.' });
});

// Get all contacts
router.get('/', auth, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', tag = '', status = 'active' } = req.query;
    const skip = (page - 1) * limit;

    const query = { userId: req.userId };

    if (status) {
      query.status = status;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } }
      ];
    }

    if (tag) {
      query.tags = tag;
    }

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Contact.countDocuments(query);

    // Get all unique tags for the user
    const tags = await Contact.distinct('tags', { userId: req.userId });

    res.json({
      success: true,
      contacts,
      tags,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new contact
router.post('/', auth, [
  body('email').isEmail().normalizeEmail(),
  body('firstName').optional().trim(),
  body('lastName').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      email,
      firstName,
      lastName,
      phone,
      company,
      position,
      tags = [],
      notes
    } = req.body;

    // Check if contact exists
    const existingContact = await Contact.findOne({
      userId: req.userId,
      email
    });

    if (existingContact) {
      return res.status(400).json({
        success: false,
        error: 'Contact with this email already exists'
      });
    }

    const contact = new Contact({
      userId: req.userId,
      email,
      firstName,
      lastName,
      phone,
      company,
      position,
      tags: Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()),
      notes,
      status: 'active'
    });

    await contact.save();

    res.json({
      success: true,
      message: 'Contact created successfully',
      contact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update contact
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Convert tags string to array if needed
    if (updates.tags && typeof updates.tags === 'string') {
      updates.tags = updates.tags.split(',').map(tag => tag.trim());
    }

    const contact = await Contact.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: updates },
      { new: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact updated successfully',
      contact
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete contact
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findOneAndDelete({
      _id: id,
      userId: req.userId
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Import contacts from CSV
router.post('/import', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const importBatch = `import_${Date.now()}`;
    const contacts = [];
    const invalidRows = [];
    const seenEmails = new Set();

    // Helper email validation
    const isValidEmail = (email) => {
      if (!email) return false;
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return re.test(String(email).toLowerCase());
    };

    const processRow = (row) => {
      // Normalize keys (case-insensitive)
      const get = (keys) => keys.map(k => row[k]).find(v => v !== undefined && v !== null) || '';

      const email = (get(['Email', 'email', 'e-mail', 'E-mail']) || '').toString().trim();
      const firstName = (get(['First Name', 'firstName', 'first_name', 'firstname']) || '').toString().trim();
      const lastName = (get(['Last Name', 'lastName', 'last_name', 'lastname']) || '').toString().trim();
      const company = (get(['Company', 'company']) || '').toString().trim();
      const tagsRaw = (get(['Tags', 'tags']) || '').toString().trim();
      const tags = tagsRaw ? tagsRaw.split(/[,;|]/).map(t => t.trim()).filter(Boolean) : [];

      if (!isValidEmail(email)) {
        invalidRows.push({ email, firstName, lastName, reason: 'invalid_email' });
        return;
      }

      const emailLower = email.toLowerCase();
      if (seenEmails.has(emailLower)) {
        // duplicate within file
        return;
      }

      seenEmails.add(emailLower);

      contacts.push({
        userId: req.userId,
        email: emailLower,
        firstName,
        lastName,
        company,
        tags,
        importBatch,
        source: 'csv_import'
      });
    };

    // Detect file type by extension
    const originalName = req.file.originalname || '';
    const ext = originalName.split('.').pop().toLowerCase();

    if (ext === 'xls' || ext === 'xlsx') {
      // Parse XLSX
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

      rows.forEach((row) => processRow(row));
    } else {
      // Parse CSV robustly using csv-parser
      await new Promise((resolve, reject) => {
        const stream = Readable.from([req.file.buffer]);
        stream.pipe(csv())
          .on('data', (row) => {
            processRow(row);
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });
    }

    // Check existing contacts to avoid duplicates in DB
    const emailsToCheck = contacts.map(c => c.email);
    let existing = [];
    if (emailsToCheck.length > 0) {
      existing = await Contact.find({ userId: req.userId, email: { $in: emailsToCheck } }).select('email');
    }
    const existingSet = new Set(existing.map(e => e.email.toLowerCase()));

    const operations = [];
    let skipped = 0;

    contacts.forEach(contact => {
      if (existingSet.has(contact.email)) {
        skipped++;
        return;
      }

      operations.push({
        updateOne: {
          filter: { userId: req.userId, email: contact.email },
          update: { $setOnInsert: contact },
          upsert: true
        }
      });
    });

    if (operations.length > 0) {
      await Contact.bulkWrite(operations);
    }

    res.json({
      success: true,
      message: `Imported ${operations.length} contacts successfully`,
      imported: operations.length,
      skipped: skipped,
      importBatch,
      invalid: invalidRows.length > 0 ? invalidRows : undefined
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Clear contacts (by ids, by importBatch, or all imported)
router.post('/clear', auth, async (req, res) => {
  try {
    const { ids, importBatch, allImported } = req.body;

    if (ids && Array.isArray(ids) && ids.length > 0) {
      await Contact.deleteMany({ userId: req.userId, _id: { $in: ids } });
      return res.json({ success: true, message: `Deleted ${ids.length} contacts` });
    }

    if (importBatch) {
      const result = await Contact.deleteMany({ userId: req.userId, importBatch });
      return res.json({ success: true, message: `Deleted ${result.deletedCount} contacts from import ${importBatch}` });
    }

    if (allImported) {
      const result = await Contact.deleteMany({ userId: req.userId, source: { $in: ['csv_import', 'xlsx_import', 'local_import'] } });
      return res.json({ success: true, message: `Deleted ${result.deletedCount} imported contacts` });
    }

    return res.status(400).json({ success: false, error: 'No clear criteria provided' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export contacts to CSV
router.get('/export', auth, async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.userId })
      .select('email firstName lastName company phone position tags status')
      .sort({ lastName: 1, firstName: 1 });

    // Create CSV content
    let csvContent = 'Email,First Name,Last Name,Company,Phone,Position,Tags,Status\n';
    
    contacts.forEach(contact => {
      const row = [
        contact.email,
        contact.firstName || '',
        contact.lastName || '',
        contact.company || '',
        contact.phone || '',
        contact.position || '',
        contact.tags?.join(';') || '',
        contact.status || 'active'
      ].map(field => `"${field}"`).join(',');
      
      csvContent += row + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=contacts.csv');
    res.send(csvContent);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get contact stats
router.get('/stats', auth, async (req, res) => {
  try {
    const stats = await Contact.aggregate([
      {
        $match: { userId: req.userId }
      },
      {
        $group: {
          _id: null,
          totalContacts: { $sum: 1 },
          activeContacts: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          unsubscribedContacts: {
            $sum: { $cond: [{ $eq: ['$status', 'unsubscribed'] }, 1, 0] }
          },
          bouncedContacts: {
            $sum: { $cond: [{ $eq: ['$status', 'bounced'] }, 1, 0] }
          }
        }
      }
    ]);

    const tagStats = await Contact.aggregate([
      {
        $match: { userId: req.userId, tags: { $exists: true, $ne: [] } }
      },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      stats: stats[0] || {
        totalContacts: 0,
        activeContacts: 0,
        unsubscribedContacts: 0,
        bouncedContacts: 0
      },
      tagStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;