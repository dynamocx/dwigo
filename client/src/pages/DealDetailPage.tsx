import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Stack,
  Typography,
  Skeleton,
  Link,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import ShareIcon from '@mui/icons-material/Share';
import PlaceIcon from '@mui/icons-material/Place';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import BusinessIcon from '@mui/icons-material/Business';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DirectionsIcon from '@mui/icons-material/Directions';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import MoreVertIcon from '@mui/icons-material/MoreVert';

import { useAnalytics } from '@/analytics/AnalyticsProvider';
import { useAuth } from '@/auth/AuthContext';
import { fetchDeal, toggleDealSaved, trackDealView } from '@/api/deals';
import ErrorState from '@/components/common/ErrorState';
import type { Deal } from '@/types/deal';

const formatCurrency = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
};

const formatDateTime = (dateString: string | null) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
};

const DealDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { trackEvent } = useAnalytics();
  const [savedDealMenuAnchor, setSavedDealMenuAnchor] = useState<null | HTMLElement>(null);

  const dealId = id ? Number(id) : null;

  const dealQuery = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => (dealId ? fetchDeal(dealId) : Promise.reject(new Error('Invalid deal ID'))),
    enabled: Boolean(dealId),
  });

  const saveMutation = useMutation({
    mutationFn: (deal: Deal) => toggleDealSaved(deal.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal', dealId] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['personalised-deals'] });
    },
  });

  // Track deal view
  useEffect(() => {
    if (dealId && dealQuery.data?.data) {
      trackDealView(dealId).catch(console.error);
      trackEvent({
        eventType: 'deal_viewed',
        entityType: 'deal',
        entityId: dealId,
        source: 'app',
      }).catch(console.error);
    }
  }, [dealId, dealQuery.data?.data, trackEvent]);

  const handleShare = async (deal: Deal) => {
    const shareData = {
      title: deal.title,
      text: deal.description ?? 'Check out this DWIGO find!',
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        trackEvent({
          eventType: 'deal_shared',
          entityType: 'deal',
          entityId: deal.id,
          source: 'app',
        }).catch(console.error);
      } catch (error) {
        console.error('Share failed:', error);
      }
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(`${deal.title} - ${shareData.url}`);
      window.alert('Link copied to clipboard');
    }
  };

  const handleGetDeal = async (deal: Deal) => {
    if (!user) {
      // Not logged in - prompt to sign up
      navigate('/register', { state: { redirectTo: `/deals/${deal.id}` } });
      return;
    }

    if (!deal.isSaved) {
      // Not saved - save it first, then show options
      saveMutation.mutate(deal);
      // After saving, show the menu
      setTimeout(() => {
        const button = document.querySelector('[data-get-deal-button]') as HTMLElement;
        if (button) {
          setSavedDealMenuAnchor(button);
        }
      }, 100);
      return;
    }

    // Already saved - show menu with options
    const button = document.querySelector('[data-get-deal-button]') as HTMLElement;
    if (button) {
      setSavedDealMenuAnchor(button);
    }
  };

  const handleCloseSavedDealMenu = () => {
    setSavedDealMenuAnchor(null);
  };

  const handleGoToSource = (deal: Deal) => {
    const url = deal.sourceReference || deal.website;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      trackEvent({
        eventType: 'deal_source_clicked',
        entityType: 'deal',
        entityId: deal.id,
        source: 'app',
      }).catch(console.error);
    }
    handleCloseSavedDealMenu();
  };

  const handleGetDirections = (deal: Deal) => {
    if (deal.latitude && deal.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${deal.latitude},${deal.longitude}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      trackEvent({
        eventType: 'deal_directions_clicked',
        entityType: 'deal',
        entityId: deal.id,
        source: 'app',
      }).catch(console.error);
    }
    handleCloseSavedDealMenu();
  };

  const handlePurchase = (deal: Deal) => {
    // For now, go to source URL or merchant website
    const url = deal.sourceReference || deal.website;
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
      trackEvent({
        eventType: 'deal_purchase_clicked',
        entityType: 'deal',
        entityId: deal.id,
        source: 'app',
      }).catch(console.error);
    }
    handleCloseSavedDealMenu();
  };

  if (dealQuery.isLoading) {
    return (
      <Box>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 3, borderRadius: 1.5 }} />
        <Skeleton variant="text" width="60%" height={40} sx={{ mb: 2 }} />
        <Skeleton variant="text" width="100%" height={24} sx={{ mb: 1 }} />
        <Skeleton variant="text" width="80%" height={24} />
      </Box>
    );
  }

  if (dealQuery.isError || dealQuery.data?.error) {
    return (
      <ErrorState
        title="Deal not found"
        description={dealQuery.data?.error?.message ?? 'This deal may have expired or been removed.'}
        onRetry={() => dealQuery.refetch()}
      />
    );
  }

  const deal = dealQuery.data?.data;
  if (!deal) {
    return (
      <ErrorState
        title="Deal not found"
        description="This deal may have expired or been removed."
        onRetry={() => navigate('/deals')}
      />
    );
  }

  const primaryPrice = formatCurrency(deal.dealPrice);
  const originalPrice = formatCurrency(deal.originalPrice);
  const startDate = formatDate(deal.startDate);
  const endDate = formatDate(deal.endDate);
  const startDateTime = formatDateTime(deal.startDate);
  const endDateTime = formatDateTime(deal.endDate);

  return (
    <Box>
      {/* Header with back button */}
      <Stack direction="row" alignItems="center" spacing={2} mb={3}>
        <IconButton onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Deal Details
        </Typography>
        <IconButton
          color={deal.isSaved ? 'error' : 'default'}
          onClick={() => saveMutation.mutate(deal)}
          aria-label={deal.isSaved ? 'Remove from favourites' : 'Save deal'}
          disabled={!user}
        >
          {deal.isSaved ? <FavoriteIcon /> : <FavoriteBorderIcon />}
        </IconButton>
        <IconButton onClick={() => handleShare(deal)} aria-label="Share deal">
          <ShareIcon />
        </IconButton>
      </Stack>

      {/* Deal Image Placeholder */}
      {deal.imageUrl ? (
        <Box
          component="img"
          src={deal.imageUrl}
          alt={deal.title}
          sx={{
            width: '100%',
            height: 240,
            objectFit: 'cover',
            borderRadius: 1.5,
            mb: 3,
          }}
        />
      ) : (
        <Box
          sx={{
            width: '100%',
            height: 240,
            bgcolor: 'primary.light',
            borderRadius: 1.5,
            mb: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LocalOfferIcon sx={{ fontSize: 64, color: 'primary.contrastText', opacity: 0.5 }} />
        </Box>
      )}

      {/* Deal Title and Price */}
      <Stack spacing={2} mb={3}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1} mb={1}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {deal.title}
            </Typography>
            {deal.discountPercentage ? (
              <Chip
                color="secondary"
                size="medium"
                label={`${Math.round(deal.discountPercentage)}% OFF`}
                sx={{ fontWeight: 700 }}
              />
            ) : null}
          </Stack>
          {deal.category ? (
            <Chip label={deal.category} size="small" variant="outlined" sx={{ mt: 1 }} />
          ) : null}
        </Box>

        <Stack direction="row" alignItems="center" spacing={2}>
          {primaryPrice ? (
            <Typography variant="h5" color="primary" sx={{ fontWeight: 700 }}>
              {primaryPrice}
            </Typography>
          ) : null}
          {originalPrice ? (
            <Typography
              variant="h6"
              color="text.secondary"
              sx={{ textDecoration: 'line-through' }}
            >
              {originalPrice}
            </Typography>
          ) : null}
        </Stack>
      </Stack>

      <Divider sx={{ my: 3 }} />

      {/* Description */}
      {deal.description ? (
        <Box mb={3}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            About this deal
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
            {deal.description}
          </Typography>
        </Box>
      ) : null}

      <Divider sx={{ my: 3 }} />

      {/* Merchant Information */}
      <Card sx={{ borderRadius: 1.5, mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} mb={2}>
            <BusinessIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {deal.businessName}
            </Typography>
          </Stack>

          {deal.businessType ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {deal.businessType}
            </Typography>
          ) : null}

          <Stack spacing={1}>
            {deal.address || deal.city || deal.state ? (
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <PlaceIcon fontSize="small" color="primary" sx={{ mt: 0.5 }} />
                <Box>
                  {deal.address ? (
                    <Typography variant="body2">{deal.address}</Typography>
                  ) : null}
                  {(deal.city || deal.state) && (
                    <Typography variant="body2" color="text.secondary">
                      {[deal.city, deal.state].filter(Boolean).join(', ')}
                    </Typography>
                  )}
                </Box>
              </Stack>
            ) : null}

            {deal.latitude && deal.longitude ? (
              <Button
                variant="outlined"
                size="small"
                startIcon={<PlaceIcon />}
                href={`https://www.google.com/maps?q=${deal.latitude},${deal.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ alignSelf: 'flex-start', mt: 1 }}
              >
                View on Map
              </Button>
            ) : null}
          </Stack>
        </CardContent>
      </Card>

      {/* Dates */}
      {(startDate || endDate) && (
        <>
          <Card sx={{ borderRadius: 1.5, mb: 3 }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} mb={2}>
                <CalendarTodayIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Valid Dates
                </Typography>
              </Stack>
              <Stack spacing={1}>
                {startDate && (
                  <Typography variant="body2">
                    <strong>Starts:</strong> {startDateTime || startDate}
                  </Typography>
                )}
                {endDate && (
                  <Typography variant="body2">
                    <strong>Ends:</strong> {endDateTime || endDate}
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </>
      )}

      {/* Terms and Conditions */}
      {deal.termsConditions ? (
        <>
          <Divider sx={{ my: 3 }} />
          <Box mb={3}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Terms & Conditions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {deal.termsConditions}
            </Typography>
          </Box>
        </>
      ) : null}

      {/* Action Buttons */}
      <Stack spacing={2} sx={{ mt: 4 }}>
        <Button
          variant="contained"
          size="large"
          fullWidth
          sx={{ py: 1.5 }}
          onClick={() => handleGetDeal(deal)}
          data-get-deal-button
        >
          {!user
            ? 'Get This Deal'
            : !deal.isSaved
              ? 'Save to Deal Basket'
              : 'Get This Deal'}
        </Button>
        
        {!user && (
          <Typography variant="body2" color="text.secondary" textAlign="center">
            <Link component="button" variant="body2" onClick={() => navigate('/register')}>
              Sign up
            </Link>{' '}
            to save deals to your Deal Basket and get personalized recommendations
          </Typography>
        )}

        {/* Saved Deal Options Menu */}
        <Menu
          anchorEl={savedDealMenuAnchor}
          open={Boolean(savedDealMenuAnchor)}
          onClose={handleCloseSavedDealMenu}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'center',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'center',
          }}
        >
          {(deal.sourceReference || deal.website) && (
            <MenuItem onClick={() => handleGoToSource(deal)}>
              <ListItemIcon>
                <OpenInNewIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Go to Source Web Page</ListItemText>
            </MenuItem>
          )}
          {deal.latitude && deal.longitude && (
            <MenuItem onClick={() => handleGetDirections(deal)}>
              <ListItemIcon>
                <DirectionsIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Get Directions</ListItemText>
            </MenuItem>
          )}
          {(deal.sourceReference || deal.website) && (
            <MenuItem onClick={() => handlePurchase(deal)}>
              <ListItemIcon>
                <ShoppingCartIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Go to Purchase Destination</ListItemText>
            </MenuItem>
          )}
        </Menu>
      </Stack>
    </Box>
  );
};

export default DealDetailPage;

