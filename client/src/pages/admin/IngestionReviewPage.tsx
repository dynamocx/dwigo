import { useState } from 'react';

import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  fetchPendingIngestionRows,
  promoteIngestionRows,
  rejectIngestionRows,
  seedIngestionJob,
  seedMidMichiganDeals,
  fetchDealsWithAI,
  scrapeDealsFromWeb,
  type IngestedDealRow,
} from '@/api/adminIngestion';
import { assessDealQuality } from '@/utils/dealQuality';
import DealEntryForm from './DealEntryForm';

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
  const [selectedDeals, setSelectedDeals] = useState<number[]>([]);

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

  const scrapeMutation = useMutation({
    mutationFn: () => scrapeDealsFromWeb(),
    onSuccess: (data) => {
      console.log('[Scrape] Success:', data);
      // Wait a moment for the job to process, then refresh
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['admin-ingestion-pending', limit] });
        void pendingQuery.refetch();
      }, 10000); // Scraping takes longer
    },
    onError: (error) => {
      console.error('[Scrape] Error:', error);
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
      syntheticDeal: (normalized.syntheticDeal as boolean) || false,
      merchantVerified: (normalized.merchantVerified as boolean) || false,
      dealVerified: (normalized.dealVerified as boolean) || false,
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

      {scrapeMutation.isError ? (
        <Alert severity="error" onClose={() => scrapeMutation.reset()}>
          Web Scraping failed: {scrapeMutation.error instanceof Error ? scrapeMutation.error.message : 'Unknown error'}
        </Alert>
      ) : null}

      {scrapeMutation.isSuccess && scrapeMutation.data?.data ? (
        <Alert 
          severity={scrapeMutation.data.data.dealsExtracted === 0 ? 'warning' : 'success'} 
          onClose={() => scrapeMutation.reset()}
        >
          {scrapeMutation.data.data.dealsExtracted === 0 ? (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Web Scraping completed but found 0 deals from {scrapeMutation.data.data.sourcesScraped} sources.
              </Typography>
              {(scrapeMutation.data.data as any).sourceDetails && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" display="block" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Source Details:
                  </Typography>
                  {(scrapeMutation.data.data as any).sourceDetails.map((source: any, idx: number) => (
                    <Typography key={idx} variant="caption" display="block" sx={{ fontSize: '0.75rem' }}>
                      • {source.merchantName}: {source.success ? `${source.itemsFound} items found, ${source.dealsFound} deals extracted` : `Failed: ${source.error || 'Unknown error'}`}
                    </Typography>
                  ))}
                </Box>
              )}
              {(scrapeMutation.data.data as any).troubleshooting && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" display="block" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Possible reasons:
                  </Typography>
                  <Typography component="ul" variant="caption" sx={{ pl: 2, m: 0 }}>
                    {(scrapeMutation.data.data as any).troubleshooting.possibleReasons.map((reason: string, idx: number) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            `Web Scraping completed! Scraped ${scrapeMutation.data.data.sourcesScraped} sources, extracted ${scrapeMutation.data.data.dealsExtracted} deals. They should appear below shortly.`
          )}
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
                onClick={() => scrapeMutation.mutate()}
                disabled={scrapeMutation.isPending}
                size="large"
              >
                {scrapeMutation.isPending ? 'Scraping...' : '🌐 Scrape Deals from Web'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => aiFetchMutation.mutate()}
                disabled={aiFetchMutation.isPending}
                size="large"
              >
                {aiFetchMutation.isPending ? 'AI Fetching...' : '🤖 Fetch Deals with AI'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => seedMidMichiganMutation.mutate()}
                disabled={seedMidMichiganMutation.isPending}
                size="large"
              >
                {seedMidMichiganMutation.isPending ? 'Seeding...' : 'Seed Mid-Michigan Deals'}
              </Button>
              <Button
                variant="outlined"
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                size="large"
              >
                {seedMutation.isPending ? 'Seeding...' : 'Seed Test Deals'}
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

      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Pending Deals ({rows.length})
          </Typography>
          {selectedDeals.length > 0 && (
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={() => {
                  promoteMutation.mutate(selectedDeals);
                  setSelectedDeals([]);
                }}
                disabled={promoteMutation.isPending}
              >
                Promote Selected ({selectedDeals.length})
              </Button>
              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={() => {
                  rejectMutation.mutate(selectedDeals);
                  setSelectedDeals([]);
                }}
                disabled={rejectMutation.isPending}
              >
                Reject Selected ({selectedDeals.length})
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => setSelectedDeals([])}
              >
                Clear Selection
              </Button>
            </Stack>
          )}
        </Stack>

        {rows.length === 0 ? (
          <Alert severity="info">
            No pending deals. Use the buttons above to fetch or seed deals.
          </Alert>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" width={50}>
                    <Checkbox
                      indeterminate={selectedDeals.length > 0 && selectedDeals.length < rows.length}
                      checked={rows.length > 0 && selectedDeals.length === rows.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDeals(rows.map((r) => r.id));
                        } else {
                          setSelectedDeals([]);
                        }
                      }}
                    />
                  </TableCell>
                  <TableCell width={80}>ID</TableCell>
                  <TableCell width={150}>Merchant</TableCell>
                  <TableCell>Title</TableCell>
                  <TableCell width={200}>Location</TableCell>
                  <TableCell width={120}>Deal Info</TableCell>
                  <TableCell width={150}>Dates</TableCell>
                  <TableCell width={100}>Source</TableCell>
                  <TableCell width={100}>Quality</TableCell>
                  <TableCell width={150}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => {
                  const confidence = row.confidence != null ? `${(Number(row.confidence) * 100).toFixed(0)}%` : '—';
                  const quality = assessDealQuality(row.normalized_payload, row.raw_payload);
                  const qualityScore = `${(quality.score * 100).toFixed(0)}%`;
                  const deal = getDealDetails(row);
                  const isSelected = selectedDeals.includes(row.id);
                  
                  // Format location
                  const locationParts = [
                    deal.city,
                    deal.state,
                  ].filter(Boolean);
                  const location = locationParts.length > 0 ? locationParts.join(', ') : '—';
                  
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
                  
                  const dealInfo = discountInfo || priceInfo || '—';
                  
                  // Format date range
                  const dateRange = deal.startDate && deal.endDate
                    ? `${new Date(deal.startDate).toLocaleDateString()} - ${new Date(deal.endDate).toLocaleDateString()}`
                    : deal.startDate
                    ? `Starts: ${new Date(deal.startDate).toLocaleDateString()}`
                    : '—';
                  
                  return (
                    <TableRow key={row.id} selected={isSelected} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDeals([...selectedDeals, row.id]);
                            } else {
                              setSelectedDeals(selectedDeals.filter((id) => id !== row.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>#{row.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {row.merchant_alias ?? '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {deal.title}
                          </Typography>
                          {deal.syntheticDeal && (
                            <Chip
                              size="small"
                              label="Synthetic"
                              color="warning"
                              variant="outlined"
                              sx={{ fontSize: '0.65rem', height: '20px' }}
                              title="This deal was generated by AI and is not verified from an actual source. The merchant is verified, but the deal details are synthetic."
                            />
                          )}
                        </Stack>
                        {deal.description && (
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                            {deal.description.substring(0, 100)}
                            {deal.description.length > 100 ? '...' : ''}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{location}</Typography>
                        {deal.address && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {deal.address}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {dealInfo !== '—' ? (
                          <Chip
                            size="small"
                            label={dealInfo}
                            color={discountInfo ? 'success' : 'default'}
                            variant={discountInfo ? 'filled' : 'outlined'}
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontSize={12}>
                          {dateRange}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.job_source ? row.job_source.split(':')[0] : 'unknown'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={qualityScore}
                          color={quality.isValid ? 'success' : 'warning'}
                        />
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          {confidence}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={() => promoteMutation.mutate([row.id])}
                            disabled={promoteMutation.isPending}
                            sx={{ minWidth: 70 }}
                          >
                            Promote
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            onClick={() => rejectMutation.mutate([row.id])}
                            disabled={rejectMutation.isPending}
                            sx={{ minWidth: 60 }}
                          >
                            Reject
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>
    </Stack>
  );
};

export default IngestionReviewPage;


