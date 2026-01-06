const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get all templates (user's + public)
router.get('/', auth, async (req, res) => {
  try {
    const templates = await Template.find({
      $or: [
        { userId: req.userId },
        { isPublic: true }
      ]
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new template
router.post('/', auth, [
  body('name').notEmpty().withMessage('Template name is required'),
  body('subject').notEmpty().withMessage('Subject is required'),
  body('body').notEmpty().withMessage('Body is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      subject,
      body,
      htmlBody,
      isHtml = true,
      category = 'general',
      isPublic = false
    } = req.body;

    const template = new Template({
      userId: req.userId,
      name,
      subject,
      body,
      htmlBody: htmlBody || body,
      isHtml,
      category,
      isPublic
    });

    await template.save();

    res.json({
      success: true,
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update template
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const template = await Template.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: updates },
      { new: true }
    );

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete template
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const template = await Template.findOneAndDelete({
      _id: id,
      userId: req.userId
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get template by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const template = await Template.findOne({
      _id: id,
      $or: [
        { userId: req.userId },
        { isPublic: true }
      ]
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    res.json({
      success: true,
      template
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get template categories
router.get('/categories/list', auth, async (req, res) => {
  try {
    const categories = await Template.distinct('category', {
      $or: [
        { userId: req.userId },
        { isPublic: true }
      ]
    });

    res.json({
      success: true,
      categories: categories.filter(cat => cat).sort()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Duplicate template
router.post('/:id/duplicate', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    const originalTemplate = await Template.findOne({
      _id: id,
      $or: [
        { userId: req.userId },
        { isPublic: true }
      ]
    });

    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }

    const duplicatedTemplate = new Template({
      userId: req.userId,
      name: name || `${originalTemplate.name} (Copy)`,
      subject: originalTemplate.subject,
      body: originalTemplate.body,
      htmlBody: originalTemplate.htmlBody,
      isHtml: originalTemplate.isHtml,
      category: originalTemplate.category,
      isPublic: false
    });

    await duplicatedTemplate.save();

    res.json({
      success: true,
      message: 'Template duplicated successfully',
      template: duplicatedTemplate
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;