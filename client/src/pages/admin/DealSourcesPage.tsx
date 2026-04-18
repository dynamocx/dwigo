import { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useQuery } from '@tanstack/react-query';

import { fetchDealSourcesCatalog, type DealSourceCatalogRow } from '@/api/adminDealSources';

const selectorSummary = (row: DealSourceCatalogRow) => {
  const s = row.selectors;
  if (!s || typeof s !== 'object') return '—';
  const keys = Object.keys(s);
  if (!keys.length) return '—';
  return keys.map((k) => `${k}: ${String(s[k]).slice(0, 48)}${String(s[k]).length > 48 ? '…' : ''}`).join(' · ');
};

const DealSourcesPage = () => {
  const query = useQuery({
    queryKey: ['admin-deal-sources-catalog'],
    queryFn: async () => {
      const env = await fetchDealSourcesCatalog();
      if (env.error) {
        throw new Error(env.error.message);
      }
      return env.data;
    },
    staleTime: 30 * 1000,
  });

  const byCity = useMemo(() => {
    const sources = query.data?.sources ?? [];
    const map = new Map<string, DealSourceCatalogRow[]>();
    for (const row of sources) {
      const city = (row.city || '').trim() || 'Other';
      if (!map.has(city)) map.set(city, []);
      map.get(city)!.push(row);
    }
    const cities = [...map.keys()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return cities.map((city) => ({
      city,
      rows: (map.get(city) || []).sort((a, b) =>
        (a.merchantName || '').localeCompare(b.merchantName || '', undefined, { sensitivity: 'base' })
      ),
    }));
  }, [query.data?.sources]);

  return (
    <Stack spacing={3} sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Web scrape sources
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Read-only mirror of <code>server/config/dealSources.json</code> (not under <code>scrapers/</code>). The
            &quot;Scrape Deals from Web&quot; job only hits URLs listed here.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button component={RouterLink} to="/admin/ingestion" variant="outlined" size="small">
            Ingestion review
          </Button>
          <IconButton aria-label="refresh" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Stack>

      {query.data?.categoryFilter ? (
        <Alert severity="info">
          Server <code>SCRAPER_CATEGORY_FILTER</code> is set to <strong>{query.data.categoryFilter}</strong> — runs
          only sources whose <code>category</code> matches (see scraper logs). This page still lists every row in the
          file.
        </Alert>
      ) : (
        <Alert severity="info" variant="outlined">
          No <code>SCRAPER_CATEGORY_FILTER</code> on the server — every <strong>enabled</strong> source can run
          (subject to city filter on the ingestion page).
        </Alert>
      )}

      {query.isLoading ? (
        <Typography variant="body2" color="text.secondary">
          Loading sources…
        </Typography>
      ) : null}

      {query.isError ? (
        <Alert severity="error">
          {query.error instanceof Error ? query.error.message : 'Failed to load deal sources.'}
        </Alert>
      ) : null}

      {!query.isLoading && !query.isError && byCity.length === 0 ? (
        <Alert severity="warning">No sources returned.</Alert>
      ) : null}

      {byCity.map(({ city, rows }) => (
        <Paper key={city} variant="outlined" sx={{ overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.5, bgcolor: 'action.hover', borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {city}
              <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                {rows.length} source{rows.length === 1 ? '' : 's'}
              </Typography>
            </Typography>
          </Box>
          <TableContainer sx={{ maxWidth: '100%' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Merchant</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Enabled</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Fetch</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>URL</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Selectors (summary)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {row.merchantName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        id: {row.id}
                        {row.priority != null ? ` · priority ${row.priority}` : ''}
                        {Array.isArray(row.keywords) && row.keywords.length > 0
                          ? ` · keywords: ${row.keywords.join(', ')}`
                          : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={row.enabled === false ? 'Off' : 'On'}
                        color={row.enabled === false ? 'default' : 'success'}
                        variant={row.enabled === false ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                    <TableCell>{row.fetchMode || 'staticHtml'}</TableCell>
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Link href={row.url} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ wordBreak: 'break-all' }}>
                        {row.url}
                        <OpenInNewIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle' }} />
                      </Link>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'normal' }}>
                        {selectorSummary(row)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      ))}

      <Alert severity="warning" variant="outlined">
        To add or change sources, edit <code>{query.data?.configHint ?? 'server/config/dealSources.json'}</code> in the
        repo and redeploy. An admin editor could be added later if you want in-app CRUD without deploys.
      </Alert>
    </Stack>
  );
};

export default DealSourcesPage;
