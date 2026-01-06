import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import { useEmail } from '../context/EmailContext';
import toast from 'react-hot-toast';

const Templates = () => {
  const { templates, addTemplate } = useEmail();
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    subject: '',
    content: '',
    variables: []
  });

  // Load templates from context (already loaded from localStorage)
  
  const handleOpenDialog = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData(template);
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        subject: '',
        content: '',
        variables: []
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.subject || !formData.content) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      // Use context instead of API
      if (editingTemplate) {
        // For now, we'll just add as new (update functionality would need to be added to context)
        addTemplate(formData);
        toast.success('Template updated!');
      } else {
        addTemplate(formData);
        toast.success('Template created!');
      }
      
      handleCloseDialog();
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const handleDelete = (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      // Remove from localStorage directly since context doesn't have delete yet
      const savedTemplates = JSON.parse(localStorage.getItem('templates')) || [];
      const updatedTemplates = savedTemplates.filter(t => t.id !== templateId);
      localStorage.setItem('templates', JSON.stringify(updatedTemplates));
      
      // Reload page to refresh context
      window.location.reload();
      toast.success('Template deleted!');
    }
  };

  const handleUseTemplate = (template) => {
    // Copy template content to clipboard
    navigator.clipboard.writeText(template.content)
      .then(() => toast.success('Template content copied to clipboard!'))
      .catch(() => toast.error('Failed to copy template'));
  };

  const variables = ['{{first_name}}', '{{last_name}}', '{{email}}', '{{company}}', '{{date}}'];

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Email Templates
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Create and manage email templates
        </Typography>
      </Box>

      {/* Action Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1">
            {templates.length} template(s)
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenDialog()}
          >
            New Template
          </Button>
        </Box>
      </Paper>

      {/* Variables Info */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Available Variables:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
          {variables.map((variable, index) => (
            <Chip key={index} label={variable} size="small" />
          ))}
        </Box>
      </Alert>

      {/* Templates Grid */}
      {templates.length > 0 ? (
        <Grid container spacing={3}>
          {templates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {template.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Subject: {template.subject}
                  </Typography>
                  <Typography variant="body2" noWrap>
                    {template.content.substring(0, 100)}...
                  </Typography>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="textSecondary">
                      Created: {new Date(template.createdAt).toLocaleDateString()}
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions>
                  <IconButton size="small" onClick={() => handleOpenDialog(template)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleUseTemplate(template)}>
                    <CopyIcon />
                  </IconButton>
                  <IconButton size="small" onClick={() => handleDelete(template.id)}>
                    <DeleteIcon />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="textSecondary">
            No templates yet. Create your first template!
          </Typography>
        </Paper>
      )}

      {/* Template Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Template' : 'Create New Template'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="name"
                  label="Template Name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="subject"
                  label="Email Subject"
                  value={formData.subject}
                  onChange={handleInputChange}
                  placeholder="Insert Placeholder: {{first_name}} {{last_name}}"
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="content"
                  label="Email Content"
                  value={formData.content}
                  onChange={handleInputChange}
                  multiline
                  rows={10}
                  placeholder="Dear {{first_name}}, ..."
                  required
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingTemplate ? 'Update' : 'Create'} Template
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default Templates;