import { useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Grid,
  IconButton,
  Stack,
  Typography,
  Tabs,
  Tab,
  Paper,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchPendingIngestionRows,
  promoteIngestionRows,
  rejectIngestionRows,
  seedIngestionJob,
  seedMidMichiganDeals,
  fetchDealsWithAI,
  type IngestedDealRow,
} from '@/api/adminIngestion';
import { assessDealQuality } from '@/utils/dealQuality';
import DealEntryForm from './DealEntryForm';

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const PayloadViewer: React.FC<{ title: string; payload?: Record<string, unknown> | null }> = ({
  title,
  payload,
}) => {
  const [expanded, setExpanded] = useState(false);

  if (!payload || Object.keys(payload).length === 0) {
    return null;
  }

  return (
    <Box>
      <Button
        size="small"
        startIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? `Hide ${title}` : `Show ${title}`}
      </Button>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box
          component="pre"
          sx={{
            mt: 1,
            p: 1.5,
            borderRadius: 1,
            bgcolor: 'grey.100',
            fontSize: 12,
            maxHeight: 240,
            overflow: 'auto',
          }}
        >
          {JSON.stringify(payload, null, 2)}
        </Box>
      </Collapse>
    </Box>
  );
};

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

const IngestionReviewPage = () => {
  const queryClient = useQueryClient();
  const [limit] = useState(50);
  const [tabValue, setTabValue] = useState(0); // 0 = Auto-Seeding, 1 = Add Deals

  const pendingQuery = useQuery({
    queryKey: ['admin-ingestion-pending', limit],
    queryFn: () => fetchPendingIngestionRows(limit),
    staleTime: 60 * 1000,
  });

  const promoteMutation = useMutation({
    mutationFn: (ids: number[]) => promoteIngestionRows(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-pending', limit] });
      // Invalidate deals queries so promoted deals show up immediately
      void queryClient.invalidateQueries({ queryKey: ['deals'] });
      void queryClient.invalidateQueries({ queryKey: ['personalised-deals'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (ids: number[]) => rejectIngestionRows(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-pending', limit] });
    },
  });

  const seedMutation = useMutation({
    mutationFn: () => seedIngestionJob(),
    onSuccess: () => {
      // Wait a moment for the job to process, then refresh
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-pending', limit] });
      }, 2000);
    },
  });

  const seedMidMichiganMutation = useMutation({
    mutationFn: () => seedMidMichiganDeals(),
    onSuccess: () => {
      // Wait a moment for the job to process, then refresh
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-pending', limit] });
      }, 2000);
    },
  });

  const aiFetchMutation = useMutation({
    mutationFn: () => fetchDealsWithAI({ categories: ['Dining', 'Entertainment', 'Shopping'], maxDealsPerLocation: 5 }),
    onSuccess: (data) => {
      console.log('[AI Fetch] Success:', data);
      // Wait a moment for the job to process, then refresh
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-pending', limit] });
        void pendingQuery.refetch();
      }, 5000); // AI takes longer
    },
    onError: (error) => {
      console.error('[AI Fetch] Error:', error);
    },
  });

  const rows: IngestedDealRow[] = pendingQuery.data?.data ?? [];

  // Extract deal details from payloads
  const getDealDetails = (row: IngestedDealRow) => {
    const normalized = row.normalized_payload || {};
    const raw = row.raw_payload || {};
    
    return {
      title: (normalized.title as string) || (raw.title as string) || 'Untitled Deal',
      description: (normalized.description as string) || (raw.description as string) || '',
      category: (normalized.category as string) || (raw.category as string) || '',
      city: (normalized.location as { city?: string })?.city || (raw.city as string) || '',
      state: (normalized.location as { state?: string })?.state || (raw.state as string) || '',
      address: (raw.address as string) || '',
      postalCode: (raw.postalCode as string) || '',
      discount: (normalized.discount as { type?: string; value?: number }) || null,
      price: (normalized.price as { currency?: string; amount?: number }) || null,
      discountPercentage: (raw.discountPercentage as number) || null,
      priceAmount: (raw.price as number) || null,
      startDate: (raw.startDate as string) || '',
      endDate: (raw.endDate as string) || '',
      sourceUrl: (raw.sourceUrl as string) || '',
    };
  };

  return (
    <Stack spacing={3} sx={{ p: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Ingestion Review
        </Typography>
        <IconButton
          aria-label="refresh"
          onClick={() => pendingQuery.refetch()}
          disabled={pendingQuery.isFetching}
        >
          <RefreshIcon />
        </IconButton>
      </Stack>

      {pendingQuery.isLoading ? (
        <Typography variant="body2" color="text.secondary">
          Loading pending ingestion rows…
        </Typography>
      ) : null}

      {pendingQuery.isError ? (
        <Alert severity="error">Failed to load pending ingestion rows.</Alert>
      ) : null}

      {aiFetchMutation.isError ? (
        <Alert severity="error" onClose={() => aiFetchMutation.reset()}>
          AI Fetch failed: {aiFetchMutation.error instanceof Error ? aiFetchMutation.error.message : 'Unknown error'}
        </Alert>
      ) : null}

      {aiFetchMutation.isSuccess && aiFetchMutation.data?.data ? (
        <Alert severity="success" onClose={() => aiFetchMutation.reset()}>
          AI Fetch completed! Found {aiFetchMutation.data.data.dealCount} deals. They should appear below shortly.
        </Alert>
      ) : null}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Auto-Seeding" />
          <Tab label="Add Deals" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Stack spacing={3}>
          <Stack spacing={2}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Automated Deal Seeding
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Use AI-powered discovery or seed deals from predefined templates.
            </Typography>
            
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Button
                variant="contained"
                color="primary"
                onClick={() => aiFetchMutation.mutate()}
                disabled={aiFetchMutation.isPending}
                size="large"
              >
                {aiFetchMutation.isPending ? 'AI Fetching...' : '🤖 Fetch Deals with AI'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => seedMidMichiganMutation.mutate()}
                disabled={seedMidMichiganMutation.isLoading}
                size="large"
              >
                {seedMidMichiganMutation.isLoading ? 'Seeding...' : 'Seed Mid-Michigan Deals'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isLoading}
                size="large"
              >
                {seedMutation.isLoading ? 'Seeding...' : 'Seed Test Deals'}
              </Button>
            </Stack>
          </Stack>

          {rows.length === 0 && !pendingQuery.isLoading ? (
            <Alert severity="info">
              No pending deals. Use the buttons above to fetch or seed deals.
            </Alert>
          ) : null}
        </Stack>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <DealEntryForm />
      </TabPanel>

      <Divider />

      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Pending Deals ({rows.length})
      </Typography>

      <Grid container spacing={2}>
        {rows.map((row) => {
          const confidence = row.confidence != null ? `${(Number(row.confidence) * 100).toFixed(0)}%` : '—';
          const quality = assessDealQuality(row.normalized_payload, row.raw_payload);
          const qualityScore = `${(quality.score * 100).toFixed(0)}%`;
          const deal = getDealDetails(row);
          
          // Format location
          const locationParts = [
            deal.address,
            deal.city,
            deal.state,
            deal.postalCode,
          ].filter(Boolean);
          const location = locationParts.length > 0 ? locationParts.join(', ') : 'Location not specified';
          
          // Format discount/price info
          const discountInfo = deal.discount?.value 
            ? `${deal.discount.value}% off`
            : deal.discountPercentage 
            ? `${deal.discountPercentage}% off`
            : null;
          
          const priceInfo = deal.price?.amount 
            ? `$${deal.price.amount}`
            : deal.priceAmount 
            ? `$${deal.priceAmount}`
            : null;
          
          // Format date range
          const dateRange = deal.startDate && deal.endDate
            ? `${new Date(deal.startDate).toLocaleDateString()} - ${new Date(deal.endDate).toLocaleDateString()}`
            : deal.startDate
            ? `Starts: ${new Date(deal.startDate).toLocaleDateString()}`
            : null;
          
          return (
            <Grid item xs={12} key={row.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        #{row.id} · {row.merchant_alias ?? 'Unmatched Merchant'}
                      </Typography>
                      <Chip size="small" label={`Confidence: ${confidence}`} />
                      <Chip
                        size="small"
                        variant="outlined"
                        label={row.job_source ? `Source: ${row.job_source}` : 'Source: unknown'}
                      />
                      <Chip
                        size="small"
                        color={quality.isValid ? 'success' : 'warning'}
                        label={`Quality: ${qualityScore}`}
                      />
                      {deal.category && (
                        <Chip size="small" label={deal.category} color="primary" variant="outlined" />
                      )}
                    </Stack>

                    {/* Deal Title and Description */}
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                        {deal.title}
                      </Typography>
                      {deal.description && (
                        <Typography variant="body2" color="text.secondary">
                          {deal.description}
                        </Typography>
                      )}
                    </Box>

                    <Divider />

                    {/* Deal Details */}
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={2} flexWrap="wrap">
                        {discountInfo && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Discount
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                              {discountInfo}
                            </Typography>
                          </Box>
                        )}
                        {priceInfo && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Price
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {priceInfo}
                            </Typography>
                          </Box>
                        )}
                        {dateRange && (
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block">
                              Valid Dates
                            </Typography>
                            <Typography variant="body2">
                              {dateRange}
                            </Typography>
                          </Box>
                        )}
                      </Stack>

                      {/* Location */}
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Location
                        </Typography>
                        <Typography variant="body2">
                          {location}
                        </Typography>
                      </Box>

                      {deal.sourceUrl && (
                        <Box>
                          <Typography variant="caption" color="text.secondary" display="block">
                            Source
                          </Typography>
                          <Typography 
                            variant="body2" 
                            component="a" 
                            href={deal.sourceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            sx={{ color: 'primary.main', textDecoration: 'none' }}
                          >
                            {deal.sourceUrl}
                          </Typography>
                        </Box>
                      )}
                    </Stack>

                    {!quality.isValid && (
                      <Alert severity="warning" sx={{ mt: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                          Quality Issues Detected
                        </Typography>
                        <Typography variant="body2" component="div">
                          <strong>Issues:</strong> {quality.reasons.join(', ')}
                        </Typography>
                        {quality.recommendations.length > 0 && (
                          <Typography variant="body2" component="div" sx={{ mt: 1 }}>
                            <strong>Recommendations:</strong> {quality.recommendations.join(', ')}
                          </Typography>
                        )}
                      </Alert>
                    )}

                    <Divider />

                    <Typography variant="body2" color="text.secondary">
                      Created {formatDate(row.created_at)}
                      {row.job_started_at ? ` · Job started ${formatDate(row.job_started_at)}` : ''}
                    </Typography>

                    <Stack spacing={1}>
                      <PayloadViewer title="Normalized Payload" payload={row.normalized_payload ?? undefined} />
                      <PayloadViewer title="Raw Payload" payload={row.raw_payload ?? undefined} />
                    </Stack>

                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={() => promoteMutation.mutate([row.id])}
                        disabled={promoteMutation.isLoading}
                      >
                        Promote
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        onClick={() => rejectMutation.mutate([row.id])}
                        disabled={rejectMutation.isLoading}
                      >
                        Reject
                      </Button>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Stack>
  );
};

export default IngestionReviewPage;


