import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';

import { useAnalytics } from '@/analytics/AnalyticsProvider';
import { useAuth } from '@/auth/AuthContext';
import { fetchDeals, fetchPersonalisedDeals, toggleDealSaved } from '@/api/deals';
import ErrorState from '@/components/common/ErrorState';
import DealCard from '@/features/deals/components/DealCard';
import type { Deal } from '@/types/deal';
import type { DwigoEnvelope } from '@/lib/dwigo';

const CATEGORIES = ['Restaurants', 'Shopping', 'Entertainment', 'Travel', 'Home', 'Beauty', 'Sports'];

const DealsPage = () => {
  const theme = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const dealsQuery = useQuery({
    queryKey: ['deals', selectedCategory],
    queryFn: () =>
      fetchDeals(
        selectedCategory
          ? {
              category: selectedCategory.toLowerCase(),
            }
          : undefined
      ),
  });

  const personalisedDealsQuery = useQuery({
    queryKey: ['personalised-deals'],
    queryFn: fetchPersonalisedDeals,
    enabled: Boolean(user),
  });

  const saveMutation = useMutation({
    mutationFn: (deal: Deal) => toggleDealSaved(deal.id),
    onMutate: async (deal) => {
      await queryClient.cancelQueries({ queryKey: ['deals'] });
      queryClient.setQueriesData<DwigoEnvelope<Deal[]> | undefined>(
        { queryKey: ['deals'] },
        (previous) =>
          previous
            ? {
                ...previous,
                data: previous.data?.map((item) =>
                  item.id === deal.id ? { ...item, isSaved: !item.isSaved } : item
                ),
              }
            : previous
      );
      queryClient.setQueriesData<DwigoEnvelope<Deal[]> | undefined>(
        { queryKey: ['personalised-deals'] },
        (previous) =>
          previous
            ? {
                ...previous,
                data: previous.data?.map((item) =>
                  item.id === deal.id ? { ...item, isSaved: !item.isSaved } : item
                ),
              }
            : previous
      );
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['personalised-deals'] });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['personalised-deals'] });
    },
  });

  const handleShare = async (deal: Deal) => {
    const shareData = {
      title: deal.title,
      text: deal.description ?? 'Check out this DWIGO find!',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${deal.title} - ${shareData.url}`);
      window.alert('Link copied to clipboard');
    }
  };

  const categoryChips = useMemo(
    () =>
      CATEGORIES.map((category) => {
        const lowercase = category.toLowerCase();
        const isSelected = selectedCategory?.toLowerCase() === lowercase;
        return (
          <Chip
            key={category}
            label={category}
            onClick={() => setSelectedCategory(isSelected ? null : category)}
            color={isSelected ? 'primary' : 'default'}
            variant={isSelected ? 'filled' : 'outlined'}
            sx={{ borderRadius: 999 }}
          />
        );
      }),
    [selectedCategory]
  );

  useEffect(() => {
    try {
      void trackEvent({
        eventType: 'deals_feed_viewed',
        source: 'app',
        metadata: selectedCategory ? { category: selectedCategory } : undefined,
      });
    } catch (error) {
      console.error('Failed to track event:', error);
    }
  }, [selectedCategory, trackEvent]);

  const recommendedByFeed = dealsQuery.data?.meta?.recommended_by ?? null;
  const recommendedByPersonal = personalisedDealsQuery.data?.meta?.recommended_by ?? null;

  if (dealsQuery.isError) {
    return <ErrorState onRetry={() => dealsQuery.refetch()} />;
  }

  if (dealsQuery.data?.error) {
    console.error('Deals envelope contained error', dealsQuery.data.error);
    return (
      <ErrorState
        title="We hit a snag"
        description={dealsQuery.data.error.message ?? 'Unable to load deals right now.'}
        onRetry={() => dealsQuery.refetch()}
      />
    );
  }

  const renderDeals = (list?: Deal[]) => {
    if (!list || list.length === 0) {
      return (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h6">No deals yet.</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Adjust your filters or check back soon for more savings where you go.
          </Typography>
        </Box>
      );
    }

    try {
      return (
        <Stack spacing={2} mt={2}>
          {list.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onToggleSave={() => saveMutation.mutate(deal)}
              onShare={handleShare}
            />
          ))}
        </Stack>
      );
    } catch (error) {
      console.error('Error rendering deals:', error);
      return (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography variant="h6">Error displaying deals</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please refresh the page or try again later.
          </Typography>
        </Box>
      );
    }
  };

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Deals Where You Go
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Discover personalised savings around your favourite places.
        </Typography>
        {recommendedByFeed ? (
          <Typography variant="caption" color="text.secondary">
            Powered by {recommendedByFeed}
          </Typography>
        ) : null}
      </Box>

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {categoryChips}
      </Stack>

      {user ? (
        <Box mt={4}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
            Recommended for you
          </Typography>
          {recommendedByPersonal ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Suggested by {recommendedByPersonal}
            </Typography>
          ) : null}
          {personalisedDealsQuery.isLoading ? (
            <Stack spacing={2}>
              {[...Array(2)].map((_, index) => (
                <Skeleton key={index} variant="rounded" height={160} animation="wave" />
              ))}
            </Stack>
          ) : personalisedDealsQuery.isError ? (
            <Box sx={{ py: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Unable to load personalized deals. Showing all deals instead.
              </Typography>
            </Box>
          ) : (
            renderDeals(personalisedDealsQuery.data?.data)
          )}
        </Box>
      ) : (
        <Box
          mt={4}
          sx={{
            p: 3,
            borderRadius: 3,
            background: theme.palette.background.paper,
            border: `1px dashed ${theme.palette.divider}`,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
            Sign in for smarter deals
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Create preferences to power DWIGO Agent and unlock personalised travel and shopping
            recommendations.
          </Typography>
        </Box>
      )}

      <Divider sx={{ my: 4 }}>
        <Typography variant="subtitle2" color="text.secondary">
          All Deals Near You
        </Typography>
      </Divider>

      {dealsQuery.isLoading ? (
        <Stack spacing={2}>
          {[...Array(3)].map((_, index) => (
            <Skeleton key={index} variant="rounded" height={160} animation="wave" />
          ))}
        </Stack>
      ) : (
        renderDeals(dealsQuery.data?.data)
      )}
    </Box>
  );
};

export default DealsPage;

