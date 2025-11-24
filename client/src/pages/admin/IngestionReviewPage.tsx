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
  type IngestedDealRow,
} from '@/api/adminIngestion';
import { assessDealQuality } from '@/utils/dealQuality';

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

const IngestionReviewPage = () => {
  const queryClient = useQueryClient();
  const [limit] = useState(50);

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

  const rows: IngestedDealRow[] = pendingQuery.data?.data ?? [];

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

      {rows.length === 0 && !pendingQuery.isLoading ? (
        <Alert 
          severity="info"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isLoading}
            >
              {seedMutation.isLoading ? 'Seeding...' : 'Seed Test Deals'}
            </Button>
          }
        >
          No pending ingestion rows. Click "Seed Test Deals" to create sample deals for testing.
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        {rows.map((row) => {
          const confidence = row.confidence != null ? `${(Number(row.confidence) * 100).toFixed(0)}%` : '—';
          const quality = assessDealQuality(row.normalized_payload, row.raw_payload);
          const qualityScore = `${(quality.score * 100).toFixed(0)}%`;
          
          return (
            <Grid item xs={12} key={row.id}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={1.5}>
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

                    <Typography variant="body2" color="text.secondary">
                      Created {formatDate(row.created_at)}
                      {row.job_started_at ? ` · Job started ${formatDate(row.job_started_at)}` : ''}
                    </Typography>

                    <Divider />

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


