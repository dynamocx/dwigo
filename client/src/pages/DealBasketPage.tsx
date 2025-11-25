import { useQuery } from '@tanstack/react-query';
import { Box, Skeleton, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/auth/AuthContext';
import { fetchSavedDeals } from '@/api/deals';
import ErrorState from '@/components/common/ErrorState';
import DealCard from '@/features/deals/components/DealCard';
import type { Deal } from '@/types/deal';

const DealBasketPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const savedDealsQuery = useQuery({
    queryKey: ['saved-deals'],
    queryFn: fetchSavedDeals,
    enabled: Boolean(user),
  });

  const handleToggleSave = (deal: Deal) => {
    // This will be handled by the DealCard component
  };

  const handleShare = (deal: Deal) => {
    const shareData = {
      title: deal.title,
      text: deal.description ?? 'Check out this DWIGO find!',
      url: `${window.location.origin}/deals/${deal.id}`,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(console.error);
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${deal.title} - ${shareData.url}`);
    }
  };

  if (!user) {
    return (
      <Box textAlign="center" py={6}>
        <Typography variant="h6">You are not signed in.</Typography>
      </Box>
    );
  }

  if (savedDealsQuery.isLoading) {
    return (
      <Stack spacing={3}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Your Deal Basket
        </Typography>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={200} />
        ))}
      </Stack>
    );
  }

  if (savedDealsQuery.isError || savedDealsQuery.data?.error) {
    return (
      <ErrorState
        title="Unable to load your Deal Basket"
        description="We couldn't load your saved deals right now. Please retry."
        onRetry={() => savedDealsQuery.refetch()}
      />
    );
  }

  const savedDeals = savedDealsQuery.data?.data ?? [];

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Your Deal Basket
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {savedDeals.length === 0
            ? "You haven't saved any deals yet. Start exploring to build your basket!"
            : `${savedDeals.length} ${savedDeals.length === 1 ? 'deal' : 'deals'} saved`}
        </Typography>
      </Box>

      {savedDeals.length === 0 ? (
        <Box textAlign="center" py={6}>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
            Your Deal Basket is empty
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Browse deals and save your favorites to access them here
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {savedDeals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onToggleSave={handleToggleSave}
              onShare={handleShare}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

export default DealBasketPage;

