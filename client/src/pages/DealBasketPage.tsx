import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DirectionsIcon from '@mui/icons-material/Directions';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

import { useAuth } from '@/auth/AuthContext';
import { useAnalytics } from '@/analytics/AnalyticsProvider';
import { fetchSavedDeals, toggleDealSaved } from '@/api/deals';
import ErrorState from '@/components/common/ErrorState';
import DealCard from '@/features/deals/components/DealCard';
import type { Deal } from '@/types/deal';

const DealBasketPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();
  const [redeemMenuAnchor, setRedeemMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  const savedDealsQuery = useQuery({
    queryKey: ['saved-deals'],
    queryFn: fetchSavedDeals,
    enabled: Boolean(user),
  });

  const saveMutation = useMutation({
    mutationFn: (deal: Deal) => toggleDealSaved(deal.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-deals'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['personalised-deals'] });
    },
  });

  const handleToggleSave = (deal: Deal) => {
    saveMutation.mutate(deal);
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

  const handleRedeem = (event: React.MouseEvent<HTMLElement>, deal: Deal) => {
    setSelectedDeal(deal);
    setRedeemMenuAnchor(event.currentTarget);
  };

  const handleCloseRedeemMenu = () => {
    setRedeemMenuAnchor(null);
    setSelectedDeal(null);
  };

  const handleGoToSource = (deal: Deal) => {
    const url = deal.sourceReference || deal.website;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      trackEvent({
        eventType: 'deal_source_clicked',
        entityType: 'deal',
        entityId: deal.id,
        source: 'deal-basket',
      }).catch(console.error);
    }
    handleCloseRedeemMenu();
  };

  const handleGetDirections = (deal: Deal) => {
    if (deal.latitude && deal.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      trackEvent({
        eventType: 'deal_directions_clicked',
        entityType: 'deal',
        entityId: deal.id,
        source: 'deal-basket',
      }).catch(console.error);
    }
    handleCloseRedeemMenu();
  };

  const handlePurchase = (deal: Deal) => {
    const url = deal.sourceReference || deal.website;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      trackEvent({
        eventType: 'deal_purchase_clicked',
        entityType: 'deal',
        entityId: deal.id,
        source: 'deal-basket',
      }).catch(console.error);
    }
    handleCloseRedeemMenu();
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
            <Box key={deal.id}>
              <DealCard
                deal={deal}
                onToggleSave={handleToggleSave}
                onShare={handleShare}
              />
              <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  variant="contained"
                  size="medium"
                  onClick={(e) => handleRedeem(e, deal)}
                >
                  Redeem Deal
                </Button>
              </Box>
            </Box>
          ))}
        </Stack>
      )}

      {/* Redemption Options Menu */}
      <Menu
        anchorEl={redeemMenuAnchor}
        open={Boolean(redeemMenuAnchor) && Boolean(selectedDeal)}
        onClose={handleCloseRedeemMenu}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        {selectedDeal && (selectedDeal.sourceReference || selectedDeal.website) && (
          <MenuItem onClick={() => handleGoToSource(selectedDeal)}>
            <ListItemIcon>
              <OpenInNewIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Go to Source Web Page</ListItemText>
          </MenuItem>
        )}
        {selectedDeal && selectedDeal.latitude && selectedDeal.longitude && (
          <MenuItem onClick={() => handleGetDirections(selectedDeal)}>
            <ListItemIcon>
              <DirectionsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Get Directions</ListItemText>
          </MenuItem>
        )}
        {selectedDeal && (selectedDeal.sourceReference || selectedDeal.website) && (
          <MenuItem onClick={() => handlePurchase(selectedDeal)}>
            <ListItemIcon>
              <ShoppingCartIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Go to Purchase Destination</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </Stack>
  );
};

export default DealBasketPage;

