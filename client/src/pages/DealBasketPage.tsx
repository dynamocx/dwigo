import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import LocalPrintshopIcon from '@mui/icons-material/LocalPrintshop';
import TextsmsIcon from '@mui/icons-material/Textsms';
import WalletIcon from '@mui/icons-material/AccountBalanceWallet';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import LinkIcon from '@mui/icons-material/Link';
import { useNavigate } from 'react-router-dom';

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
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [isRedemptionModalOpen, setIsRedemptionModalOpen] = useState(false);

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

  const openRedemptionModal = (deal: Deal) => {
    setSelectedDeal(deal);
    setIsRedemptionModalOpen(true);
  };

  const closeRedemptionModal = () => {
    setIsRedemptionModalOpen(false);
    setSelectedDeal(null);
  };

  const handleRemoveDeal = (deal: Deal) => {
    handleToggleSave(deal);
  };

  const handlePrintSticker = () => {
    window.print();
  };

  const handleSendText = () => {
    window.alert('SMS delivery coming soon!');
  };

  const handleSaveWallet = () => {
    window.alert('Wallet save coming soon!');
  };

  const handleOpenLink = (deal: Deal) => {
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
  };

  const handleGetDirectionsInline = (deal: Deal) => {
    if (deal.latitude && deal.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`;
      window.open(url, '_blank', 'noopener,noreferrer');
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
            <Box key={deal.id}>
              <DealCard
                deal={deal}
                onToggleSave={handleToggleSave}
                onShare={handleShare}
                onActionClick={openRedemptionModal}
                actionLabel="View & Redeem"
                onRemove={handleRemoveDeal}
                showExpiration
              />
            </Box>
          ))}
        </Stack>
      )}

      <Dialog
        open={isRedemptionModalOpen && Boolean(selectedDeal)}
        onClose={closeRedemptionModal}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 6 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {selectedDeal?.title}
            </Typography>
            {selectedDeal?.discountPercentage ? (
              <Chip
                label={`${Math.round(selectedDeal.discountPercentage)}% OFF`}
                color="secondary"
                size="small"
                sx={{ mt: 1 }}
              />
            ) : null}
          </Box>
          <IconButton
            onClick={closeRedemptionModal}
            sx={{ ml: 'auto' }}
            aria-label="Close redemption modal"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={4}>
            {/* Deal Sticker */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Deal Sticker
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box
                sx={{
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  borderRadius: 2,
                  p: 3,
                  bgcolor: (theme) => theme.palette.mode === 'light' 
                    ? 'rgba(25, 118, 210, 0.08)' // Very light blue for better text readability
                    : theme.palette.primary.dark + '20',
                }}
              >
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {selectedDeal?.title}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
                  {selectedDeal?.description}
                </Typography>
              </Box>
              <Stack direction="row" spacing={2} mt={2}>
                <Button
                  variant="contained"
                  startIcon={<LocalPrintshopIcon />}
                  onClick={handlePrintSticker}
                >
                  Print
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TextsmsIcon />}
                  onClick={handleSendText}
                >
                  Send to Text
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<WalletIcon />}
                  onClick={handleSaveWallet}
                >
                  Save to Wallet
                </Button>
              </Stack>
            </Box>

            {/* Deal Location */}
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                Deal Location
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Stack spacing={1}>
                <Typography variant="subtitle1">{selectedDeal?.businessName}</Typography>
                {selectedDeal?.address ? (
                  <Typography variant="body2">{selectedDeal.address}</Typography>
                ) : null}
                {(selectedDeal?.city || selectedDeal?.state) && (
                  <Typography variant="body2" color="text.secondary">
                    {[selectedDeal?.city, selectedDeal?.state].filter(Boolean).join(', ')}
                  </Typography>
                )}
                {selectedDeal?.latitude && selectedDeal?.longitude ? (
                  <Button
                    startIcon={<LocationOnIcon />}
                    variant="outlined"
                    sx={{ alignSelf: 'flex-start', mt: 1 }}
                    onClick={() => selectedDeal && handleGetDirectionsInline(selectedDeal)}
                  >
                    Get Directions
                  </Button>
                ) : null}
                {selectedDeal?.website ? (
                  <Button
                    startIcon={<LinkIcon />}
                    variant="text"
                    sx={{ alignSelf: 'flex-start' }}
                    onClick={() => selectedDeal && handleOpenLink(selectedDeal)}
                  >
                    Visit Website
                  </Button>
                ) : null}
              </Stack>
            </Box>

            {/* Deal Direct */}
            {(selectedDeal?.sourceReference || selectedDeal?.website) && (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  Deal Direct
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Not all redemption links are in our control and may not always work. If this link
                  does not work, please try the Deal Sticker or Location options above to redeem
                  your deal.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => selectedDeal && handleOpenLink(selectedDeal)}
                >
                  Open Redemption Link
                </Button>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeRedemptionModal}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default DealBasketPage;

