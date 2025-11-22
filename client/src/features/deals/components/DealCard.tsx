import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import FavoriteIcon from '@mui/icons-material/Favorite';
import PlaceIcon from '@mui/icons-material/PlaceOutlined';
import ShareIcon from '@mui/icons-material/ShareOutlined';
import { Avatar, Box, Button, Card, CardActions, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

import type { Deal } from '@/types/deal';

interface DealCardProps {
  deal: Deal;
  onToggleSave?: (deal: Deal) => void;
  onShare?: (deal: Deal) => void;
}

const formatCurrency = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return null;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

const formatDistance = (meters?: number | null) => {
  if (!meters) return null;
  if (meters > 1000) {
    return `${(meters / 1000).toFixed(1)} km away`;
  }
  return `${Math.round(meters)} m away`;
};

const DealCard = ({ deal, onToggleSave, onShare }: DealCardProps) => {
  const navigate = useNavigate();
  const primaryPrice = formatCurrency(deal.dealPrice);
  const originalPrice = formatCurrency(deal.originalPrice);
  const distance = formatDistance(deal.distanceMeters);

  return (
    <Card
      sx={{
        borderRadius: 1.5,
        overflow: 'hidden',
        border: (theme) => `1px solid ${theme.palette.divider}`,
        background: '#ffffff',
      }}
    >
      <CardContent sx={{ pb: 1 }}>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          <Avatar
            variant="rounded"
            sx={{
              width: 56,
              height: 56,
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              fontWeight: 700,
            }}
          >
            {deal.businessName?.substring(0, 2).toUpperCase() || 'DE'}
          </Avatar>
          <Box flex={1} minWidth={0}>
            <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }} noWrap>
                {deal.title}
              </Typography>
              {deal.discountPercentage ? (
                <Chip
                  color="secondary"
                  size="small"
                  label={`${Math.round(deal.discountPercentage)}% OFF`}
                />
              ) : null}
            </Stack>
            <Typography variant="body2" color="text.secondary" gutterBottom noWrap>
              {deal.description}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              {primaryPrice ? (
                <Typography variant="h6" color="primary" sx={{ fontWeight: 700 }}>
                  {primaryPrice}
                </Typography>
              ) : null}
              {originalPrice ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textDecoration: 'line-through' }}
                >
                  {originalPrice}
                </Typography>
              ) : null}
            </Stack>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" mt={2}>
          <PlaceIcon fontSize="small" color="primary" />
          <Typography variant="body2" color="text.secondary" noWrap>
            {deal.businessName || 'Business'}
            {deal.city || deal.state ? ' · ' : ''}
            {[deal.city, deal.state].filter(Boolean).join(', ') || 'Location TBD'}
          </Typography>
        </Stack>
        {distance ? (
          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
            {distance}
          </Typography>
        ) : null}
      </CardContent>

      <CardActions sx={{ px: 2, pb: 2, pt: 0, justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1}>
          <IconButton
            color={deal.isSaved ? 'error' : 'default'}
            onClick={() => onToggleSave?.(deal)}
            aria-label={deal.isSaved ? 'Remove from favourites' : 'Save deal'}
          >
            {deal.isSaved ? <FavoriteIcon /> : <FavoriteBorderIcon />}
          </IconButton>
          <IconButton onClick={() => onShare?.(deal)} aria-label="Share deal">
            <ShareIcon />
          </IconButton>
        </Stack>
        <Button
          variant="contained"
          size="medium"
          onClick={() => navigate(`/deals/${deal.id}`)}
        >
          View Deal
        </Button>
      </CardActions>
    </Card>
  );
};

export default DealCard;

