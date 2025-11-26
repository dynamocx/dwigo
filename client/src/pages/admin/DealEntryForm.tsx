import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  Stack,
  TextField,
  Typography,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AddIcon from '@mui/icons-material/Add';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitManualDeal, uploadCSV, type ManualDealEntry } from '@/api/adminIngestion';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const DealEntryForm = () => {
  const queryClient = useQueryClient();
  const [tabValue, setTabValue] = useState(0);
  const [formData, setFormData] = useState<Partial<ManualDealEntry>>({
    merchantAlias: '',
    title: '',
    description: '',
    category: '',
    city: '',
    state: 'MI',
    address: '',
    postalCode: '',
    latitude: '',
    longitude: '',
    startDate: '',
    endDate: '',
    price: '',
    discountPercentage: '',
    sourceUrl: '',
    confidence: 0.75,
  });

  const manualEntryMutation = useMutation({
    mutationFn: (deal: ManualDealEntry) => submitManualDeal(deal),
    onSuccess: () => {
      // Reset form
      setFormData({
        merchantAlias: '',
        title: '',
        description: '',
        category: '',
        city: '',
        state: 'MI',
        address: '',
        postalCode: '',
        latitude: '',
        longitude: '',
        startDate: '',
        endDate: '',
        price: '',
        discountPercentage: '',
        sourceUrl: '',
        confidence: 0.75,
      });
      // Refresh pending deals
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-pending'] });
      }, 2000);
    },
  });

  const csvUploadMutation = useMutation({
    mutationFn: (file: File) => uploadCSV(file),
    onSuccess: () => {
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-pending'] });
      }, 2000);
    },
  });

  const handleInputChange = (field: keyof ManualDealEntry) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.merchantAlias || !formData.title || !formData.category) {
      return;
    }
    manualEntryMutation.mutate(formData as ManualDealEntry);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      csvUploadMutation.mutate(file);
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Add Deals
        </Typography>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Manual Entry" />
          <Tab label="CSV Upload" />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <form onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                required
                label="Merchant Name"
                value={formData.merchantAlias}
                onChange={handleInputChange('merchantAlias')}
                fullWidth
              />
              <TextField
                required
                label="Deal Title"
                value={formData.title}
                onChange={handleInputChange('title')}
                fullWidth
              />
              <TextField
                label="Description"
                value={formData.description}
                onChange={handleInputChange('description')}
                multiline
                rows={3}
                fullWidth
              />
              <TextField
                required
                label="Category"
                value={formData.category}
                onChange={handleInputChange('category')}
                fullWidth
                helperText="e.g., Dining, Entertainment, Shopping"
              />
              
              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Location
              </Typography>
              
              <TextField
                label="Address"
                value={formData.address}
                onChange={handleInputChange('address')}
                fullWidth
              />
              <Stack direction="row" spacing={2}>
                <TextField
                  label="City"
                  value={formData.city}
                  onChange={handleInputChange('city')}
                  fullWidth
                />
                <TextField
                  label="State"
                  value={formData.state}
                  onChange={handleInputChange('state')}
                  sx={{ width: 100 }}
                />
                <TextField
                  label="ZIP"
                  value={formData.postalCode}
                  onChange={handleInputChange('postalCode')}
                  sx={{ width: 120 }}
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Latitude"
                  type="number"
                  value={formData.latitude}
                  onChange={handleInputChange('latitude')}
                  fullWidth
                />
                <TextField
                  label="Longitude"
                  type="number"
                  value={formData.longitude}
                  onChange={handleInputChange('longitude')}
                  fullWidth
                />
              </Stack>

              <Divider />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Pricing & Dates
              </Typography>
              
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Price ($)"
                  type="number"
                  value={formData.price}
                  onChange={handleInputChange('price')}
                  fullWidth
                />
                <TextField
                  label="Discount (%)"
                  type="number"
                  value={formData.discountPercentage}
                  onChange={handleInputChange('discountPercentage')}
                  fullWidth
                />
              </Stack>
              <Stack direction="row" spacing={2}>
                <TextField
                  label="Start Date"
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={handleInputChange('startDate')}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="End Date"
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={handleInputChange('endDate')}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>

              <TextField
                label="Source URL"
                value={formData.sourceUrl}
                onChange={handleInputChange('sourceUrl')}
                fullWidth
                helperText="URL where this deal was found"
              />

              {manualEntryMutation.isSuccess && (
                <Alert severity="success">
                  Deal submitted successfully! It will appear in the pending queue shortly.
                </Alert>
              )}

              {manualEntryMutation.isError && (
                <Alert severity="error">
                  Failed to submit deal: {manualEntryMutation.error instanceof Error ? manualEntryMutation.error.message : 'Unknown error'}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                startIcon={<AddIcon />}
                disabled={manualEntryMutation.isPending || !formData.merchantAlias || !formData.title || !formData.category}
                fullWidth
              >
                {manualEntryMutation.isPending ? 'Submitting...' : 'Submit Deal'}
              </Button>
            </Stack>
          </form>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Upload a CSV file with deal data. Use the template format:
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                merchantAlias,title,description,category,address,city,state,postalCode,latitude,longitude,startDate,endDate,price,discountPercentage,sourceUrl,confidence
              </Typography>
            </Paper>
            
            <Box>
              <input
                accept=".csv"
                style={{ display: 'none' }}
                id="csv-upload-input"
                type="file"
                onChange={handleFileUpload}
                disabled={csvUploadMutation.isPending}
              />
              <label htmlFor="csv-upload-input">
                <Button
                  variant="outlined"
                  component="span"
                  startIcon={<UploadFileIcon />}
                  disabled={csvUploadMutation.isPending}
                  fullWidth
                >
                  {csvUploadMutation.isPending ? 'Uploading...' : 'Choose CSV File'}
                </Button>
              </label>
            </Box>

            {csvUploadMutation.isSuccess && (
              <Alert severity="success">
                CSV uploaded successfully! {csvUploadMutation.data?.data?.dealCount || 0} deals imported. They will appear in the pending queue shortly.
              </Alert>
            )}

            {csvUploadMutation.isError && (
              <Alert severity="error">
                Failed to upload CSV: {csvUploadMutation.error instanceof Error ? csvUploadMutation.error.message : 'Unknown error'}
              </Alert>
            )}
          </Stack>
        </TabPanel>
      </CardContent>
    </Card>
  );
};

export default DealEntryForm;

