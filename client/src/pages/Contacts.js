import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  Grid,
  InputAdornment,
  Tooltip,
  Card,
  CardContent,
  FormControlLabel,
  Checkbox
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Business as BusinessIcon,
  FileDownload as ExportIcon,
  Group as GroupIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useEmail } from '../context/EmailContext';
import toast from 'react-hot-toast';
import Papa from 'papaparse';

const Contacts = () => {
  const { contacts, addContact, updateContact, deleteContact } = useEmail();
  const [searchTerm, setSearchTerm] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    tags: [],
    isActive: true
  });
  const [tagInput, setTagInput] = useState('');
  const [importData, setImportData] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const filteredContacts = contacts.filter(contact =>
    contact.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleOpenDialog = (contact = null) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || '',
        phone: contact.phone || '',
        company: contact.company || '',
        tags: contact.tags || [],
        isActive: contact.isActive !== false
      });
    } else {
      setEditingContact(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        tags: [],
        isActive: true
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingContact(null);
  };

  const handleOpenImportDialog = () => {
    setOpenImportDialog(true);
  };

  const handleCloseImportDialog = () => {
    setOpenImportDialog(false);
    setImportData('');
    setImportFile(null);
  };

  const handleFileChange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) setImportFile(f);
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()]
      });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter(tag => tag !== tagToRemove)
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.email) {
      toast.error('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      if (editingContact) {
        // Update existing contact
        updateContact(editingContact.id || editingContact._id, formData);
        toast.success('Contact updated successfully!');
      } else {
        // Check if contact already exists
        const contactExists = contacts.some(contact => 
          contact.email.toLowerCase() === formData.email.toLowerCase()
        );
        if (contactExists) {
          toast.error('Contact with this email already exists');
          return;
        }
        
        // Add new contact
        addContact(formData);
        toast.success('Contact added successfully!');
      }
      
      handleCloseDialog();
    } catch (error) {
      toast.error('Failed to save contact');
    }
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this contact?')) {
      deleteContact(id);
      toast.success('Contact deleted successfully!');
    }
  };

  const handleBulkDelete = () => {
    if (selectedContacts.length === 0) {
      toast.error('No contacts selected');
      return;
    }

    if (window.confirm(`Are you sure you want to delete ${selectedContacts.length} contact(s)?`)) {
      selectedContacts.forEach(id => {
        deleteContact(id);
      });
      setSelectedContacts([]);
      toast.success(`${selectedContacts.length} contact(s) deleted successfully!`);
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['First Name', 'Last Name', 'Email', 'Phone', 'Company', 'Tags', 'Status'],
      ...contacts.map(contact => [
        contact.firstName,
        contact.lastName,
        contact.email,
        contact.phone || '',
        contact.company || '',
        contact.tags?.join(', ') || '',
        contact.isActive ? 'Active' : 'Inactive'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contacts_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Contacts exported to CSV!');
  };

  const handleImport = () => {
    // If a file is selected, try uploading to server import endpoint or parse locally for CSV when logged out
    if (importFile) {
      const storedUser = localStorage.getItem('user');
      const token = storedUser ? JSON.parse(storedUser).token : null;
      const ext = (importFile.name || '').split('.').pop().toLowerCase();

      // If logged out and CSV file, parse locally (client-side) so demo users can import CSV without auth
      if (!token) {
        if (ext === 'csv') {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target.result;
            // Re-use same parsing logic as pasted CSV (supports header or header-less fallback)
            Papa.parse(text, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => {
                const importBatchId = `local_import_${Date.now()}`;

                const processRows = (rows) => {
                  const importedContacts = rows
                    .filter(row => {
                      const email = row['Email'] || row['email'] || row.Email || '';
                      return email && email.toString().trim();
                    })
                    .map(row => ({
                      firstName: row['First Name'] || row['firstName'] || row.FirstName || row.firstName || '',
                      lastName: row['Last Name'] || row['lastName'] || row.LastName || row.lastName || '',
                      email: (row.Email || row['email'] || row.email || '').toString().trim(),
                      phone: row.Phone || row['phone'] || row.phone || '',
                      company: row.Company || row['company'] || row.company || '',
                      tags: row.Tags ? String(row.Tags).split(/[,;|]/).map(tag => tag.trim()).filter(Boolean) : [],
                      isActive: true,
                      id: Date.now() + Math.random(),
                      source: 'local_import',
                      importBatch: importBatchId
                    }));

                  if (importedContacts.length === 0) {
                    toast.error('No valid contacts found in CSV file');
                    return;
                  }

                  const existingContacts = JSON.parse(localStorage.getItem('contacts')) || [];
                  const newContacts = [...existingContacts, ...importedContacts];
                  localStorage.setItem('contacts', JSON.stringify(newContacts));
                  localStorage.setItem('lastImportBatch', importBatchId);
                  window.location.reload();
                  toast.success(`${importedContacts.length} contacts imported successfully!`);
                  handleCloseImportDialog();
                };

                const fieldsLower = (results.meta && results.meta.fields) ? results.meta.fields.map(f => (f || '').toString().trim().toLowerCase()) : [];
                const hasEmailField = fieldsLower.some(f => ['email', 'e-mail', 'e_mail'].includes(f));

                if (!hasEmailField) {
                  Papa.parse(text, {
                    header: false,
                    skipEmptyLines: true,
                    complete: (r2) => {
                      const mapped = r2.data.map(cols => ({
                        'First Name': cols[0] || '',
                        'Last Name': cols[1] || '',
                        'Email': cols[2] || '',
                        'Phone': cols[3] || '',
                        'Company': cols[4] || '',
                        'Tags': cols[5] || ''
                      }));
                      processRows(mapped);
                    },
                    error: () => toast.error('Error parsing CSV file')
                  });
                  return;
                }

                processRows(results.data);
              },
              error: () => toast.error('Error parsing CSV file')
            });
          };

          reader.onerror = () => {
            toast.error('Failed to read file');
          };

          reader.readAsText(importFile);
          return;
        }

        // For non-CSV files (xlsx/xls) when logged out, require login to import
        toast.error('Importing Excel files (.xlsx/.xls) requires login. Please log in or use a CSV file.');
        return;
      }

      // Otherwise upload to server when authenticated
      const form = new FormData();
      form.append('file', importFile);

      fetch('/api/contacts/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form
      })
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'Import failed');
          toast.success(`${json.imported || 0} contacts imported successfully`);
          if (json.invalid) console.warn('Invalid rows:', json.invalid);
          if (json.importBatch) {
            localStorage.setItem('lastImportBatch', json.importBatch);
          }

          window.location.reload();
        })
        .catch((err) => {
          console.error(err);
          toast.error(err.message || 'Failed to upload file');
        });

      return;
    }

    if (!importData.trim()) {
      toast.error('Please paste CSV data or select a file to upload');
      return;
    }

    try {
      Papa.parse(importData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const importBatchId = `local_import_${Date.now()}`;

          const processRows = (rows) => {
            const importedContacts = rows
              .filter(row => {
                // support both header-based row (obj) and mapped row (obj with Email)
                const email = row['Email'] || row['email'] || row.Email || '';
                return email && email.toString().trim();
              })
              .map(row => ({
                firstName: row['First Name'] || row['firstName'] || row.FirstName || row.firstName || '',
                lastName: row['Last Name'] || row['lastName'] || row.LastName || row.lastName || '',
                email: (row.Email || row['email'] || row.email || '').toString().trim(),
                phone: row.Phone || row['phone'] || row.phone || '',
                company: row.Company || row['company'] || row.company || '',
                tags: row.Tags ? String(row.Tags).split(/[,;|]/).map(tag => tag.trim()).filter(Boolean) : [],
                isActive: true,
                id: Date.now() + Math.random(),
                source: 'local_import',
                importBatch: importBatchId
              }));

            if (importedContacts.length === 0) {
              toast.error('No valid contacts found in CSV data');
              return;
            }

            // Save imported contacts locally for demo mode
            const existingContacts = JSON.parse(localStorage.getItem('contacts')) || [];
            const newContacts = [...existingContacts, ...importedContacts];
            localStorage.setItem('contacts', JSON.stringify(newContacts));
            // Save last importBatch for clearing
            localStorage.setItem('lastImportBatch', importBatchId);
            // Reload page to update context
            window.location.reload();
            toast.success(`${importedContacts.length} contacts imported successfully!`);
            handleCloseImportDialog();
          };

          // If the parsed CSV didn't have an Email header, try fallback parsing without header (assume column order)
          const fieldsLower = (results.meta && results.meta.fields) ? results.meta.fields.map(f => (f || '').toString().trim().toLowerCase()) : [];
          const hasEmailField = fieldsLower.some(f => ['email', 'e-mail', 'e_mail'].includes(f));

          if (!hasEmailField && results.data.length === 0) {
            // header-less single-line case (first row was treated as header)
            Papa.parse(importData, {
              header: false,
              skipEmptyLines: true,
              complete: (r2) => {
                const mapped = r2.data.map(cols => ({
                  'First Name': cols[0] || '',
                  'Last Name': cols[1] || '',
                  'Email': cols[2] || '',
                  'Phone': cols[3] || '',
                  'Company': cols[4] || '',
                  'Tags': cols[5] || ''
                }));
                processRows(mapped);
              },
              error: () => toast.error('Error parsing CSV data')
            });
            return;
          }

          // If headers exist but no Email column, also attempt header-less parse as fallback
          if (!hasEmailField) {
            Papa.parse(importData, {
              header: false,
              skipEmptyLines: true,
              complete: (r2) => {
                const mapped = r2.data.map(cols => ({
                  'First Name': cols[0] || '',
                  'Last Name': cols[1] || '',
                  'Email': cols[2] || '',
                  'Phone': cols[3] || '',
                  'Company': cols[4] || '',
                  'Tags': cols[5] || ''
                }));
                processRows(mapped);
              },
              error: () => toast.error('Error parsing CSV data')
            });
            return;
          }

          // Normal header-based processing
          processRows(results.data);
        },
        error: (error) => {
          toast.error('Error parsing CSV data');
        }
      });
    } catch (error) {
      toast.error('Failed to import contacts');
    }
  };

  const handleSelectContact = (id) => {
    if (selectedContacts.includes(id)) {
      setSelectedContacts(selectedContacts.filter(contactId => contactId !== id));
    } else {
      setSelectedContacts([...selectedContacts, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map(contact => contact.id || contact._id));
    }
    setSelectAll(!selectAll);
  }; 

  const handleDownloadTemplate = () => {
    const template = 'First Name,Last Name,Email,Phone,Company,Tags\nJohn,Doe,john@example.com,1234567890,Acme Inc.,Customer\nJane,Smith,jane@example.com,,,Prospect';
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contacts_template.csv';
    a.click();
    toast.success('Template downloaded!');
  };

  // Stats
  const totalContacts = contacts.length;
  const activeContacts = contacts.filter(c => c.isActive !== false).length;
  const contactsWithCompany = contacts.filter(c => c.company).length;

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Contact Manager
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Manage your contact lists and email recipients
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {totalContacts}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Total Contacts
                  </Typography>
                </Box>
                <GroupIcon color="primary" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {activeContacts}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Active Contacts
                  </Typography>
                </Box>
                <PersonIcon color="success" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h4" fontWeight="bold">
                    {contactsWithCompany}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    With Company
                  </Typography>
                </Box>
                <BusinessIcon color="warning" sx={{ fontSize: 40 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Actions Bar */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              placeholder="Search contacts by name, email, company, or tags..."
              value={searchTerm}
              onChange={handleSearch}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={6} sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              Add Contact
            </Button>
            <Button
              variant="outlined"
              startIcon={<ExportIcon />}
              onClick={handleExport}
              disabled={contacts.length === 0}
            >
              Export
            </Button>
            <Button
              variant="outlined"
              onClick={handleOpenImportDialog}
            >
              Import CSV
            </Button>
            <Button
              variant="outlined"
              onClick={async () => {
                const storedUser = localStorage.getItem('user');
                const token = storedUser ? JSON.parse(storedUser).token : null;

                if (token) {
                  // Clear all imported on server
                  try {
                    const res = await fetch('/api/contacts/clear', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ allImported: true })
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || 'Failed to clear');
                    toast.success(json.message || 'Cleared imported contacts');
                    window.location.reload();
                  } catch (err) {
                    toast.error(err.message || 'Failed to clear imported contacts');
                  }
                } else {
                  // Local clear
                  const existing = JSON.parse(localStorage.getItem('contacts')) || [];
                  const filtered = existing.filter(c => c.source !== 'local_import');
                  localStorage.setItem('contacts', JSON.stringify(filtered));
                  window.location.reload();
                  toast.success('Cleared local imported contacts');
                }
              }}
            >
              Clear All Imported
            </Button>
            {selectedContacts.length > 0 && (
              <Button
                variant="contained"
                color="error"
                onClick={handleBulkDelete}
              >
                Delete ({selectedContacts.length})
              </Button>
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Contacts Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={selectAll}
                      onChange={handleSelectAll}
                      indeterminate={selectedContacts.length > 0 && selectedContacts.length < filteredContacts.length}
                    />
                  }
                />
              </TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Company</TableCell>
              <TableCell>Tags</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredContacts.length > 0 ? (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id || contact._id} hover> 
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedContacts.includes(contact.id || contact._id)}
                      onChange={() => handleSelectContact(contact.id || contact._id)}
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PersonIcon color="action" />
                      <Typography>
                        {contact.firstName} {contact.lastName}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <EmailIcon color="action" />
                      <Typography>{contact.email}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography>{contact.phone || 'N/A'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessIcon color="action" />
                      <Typography>{contact.company || 'N/A'}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {contact.tags?.map((tag, index) => (
                        <Chip key={index} label={tag} size="small" />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={contact.isActive !== false ? 'Active' : 'Inactive'}
                      color={contact.isActive !== false ? 'success' : 'error'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenDialog(contact)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => handleDelete(contact.id || contact._id)}>
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">
                    {contacts.length === 0 ? 'No contacts yet. Add your first contact!' : 'No contacts match your search.'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Contact Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingContact ? 'Edit Contact' : 'Add New Contact'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="firstName"
                  label="First Name"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  placeholder="(first_name)"
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  name="lastName"
                  label="Last Name"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  placeholder="(last_name)"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="email"
                  label="Email *"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="(email)"
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="phone"
                  label="Phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+1 (123) 456-7890"
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  name="company"
                  label="Company"
                  value={formData.company}
                  onChange={handleInputChange}
                  placeholder="(company)"
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ mb: 1 }}>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Tags (press Enter to add)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                    {formData.tags.map((tag, index) => (
                      <Chip
                        key={index}
                        label={tag}
                        onDelete={() => handleRemoveTag(tag)}
                        size="small"
                      />
                    ))}
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add tag and press Enter..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.isActive}
                      onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                    />
                  }
                  label="Active Contact"
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingContact ? 'Update' : 'Add'} Contact
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={openImportDialog} onClose={handleCloseImportDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          Import Contacts from CSV
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Paste CSV data. If your CSV has no header row, columns are assumed to be: First Name, Last Name, Email, Phone, Company, Tags
          </Alert>
          <Box sx={{ mb: 2 }}>
            <input
              accept=".csv,.xlsx,.xls"
              style={{ display: 'block', marginBottom: 8 }}
              id="import-file"
              type="file"
              onChange={handleFileChange}
            />
            {importFile && (
              <Typography variant="caption" color="textSecondary">Selected file: {importFile.name}</Typography>
            )}
          </Box>
          <TextField
            fullWidth
            multiline
            rows={8}
            placeholder={`First Name,Last Name,Email,Phone,Company,Tags\nJohn,Doe,john@example.com,1234567890,Acme Inc.,Customer\nJane,Smith,jane@example.com,,,Prospect`}
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            sx={{ fontFamily: 'monospace' }}
          />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={handleDownloadTemplate} size="small">
              Download Template
            </Button>
            <Typography variant="caption" color="textSecondary">
              CSV or Excel (.xlsx/.xls) supported — header optional (First,Last,Email,Phone,Company,Tags)
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseImportDialog}>Cancel</Button>
          <Button onClick={handleImport} variant="contained">
            Import Contacts
          </Button>
          <Button onClick={async () => {
            // Clear last import batch if exists
            const last = localStorage.getItem('lastImportBatch');
            const storedUser = localStorage.getItem('user');
            const token = storedUser ? JSON.parse(storedUser).token : null;

            if (!last) {
              toast.error('No last import batch found');
              return;
            }

            if (token) {
              try {
                const res = await fetch('/api/contacts/clear', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ importBatch: last })
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Failed to clear');
                toast.success(json.message || 'Cleared import batch');
                localStorage.removeItem('lastImportBatch');
                window.location.reload();
              } catch (err) {
                toast.error(err.message || 'Failed to clear import batch');
              }
            } else {
              const existing = JSON.parse(localStorage.getItem('contacts')) || [];
              const filtered = existing.filter(c => c.importBatch !== last);
              localStorage.setItem('contacts', JSON.stringify(filtered));
              localStorage.removeItem('lastImportBatch');
              window.location.reload();
              toast.success('Cleared local import batch');
            }
          }} variant="outlined">
            Clear Last Import
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Contacts;