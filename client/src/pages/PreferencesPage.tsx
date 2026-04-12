import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
import { useEffect, useMemo, useState } from 'react';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

import { toggleDealSaved } from '@/api/deals';
import {
  addFavoritePlace,
  addMerchantSuggestion,
  deleteFavoritePlace,
  deleteMerchantSuggestion,
  fetchFavoritePlaces,
  fetchMerchantSuggestions,
  fetchPreferences,
  updatePreferences,
} from '@/api/preferences';
import { useAuth } from '@/auth/AuthContext';
import ErrorState from '@/components/common/ErrorState';
import FullScreenLoader from '@/components/common/FullScreenLoader';

const CATEGORY_OPTIONS = [
  'Groceries',
  'Dining',
  'Bars & Pubs',
  'Wineries & Breweries',
  'Night Clubs',
  'Home Improvement',
  'Family Activities',
  'Wellness',
  'Travel',
  'Spirits, Beer & Wine',
  'Entertainment',
  'Shopping',
];
const BRAND_OPTIONS = ['Target', 'Costco', 'Starbucks', 'Home Depot', 'REI', 'Marriott'];
const CITY_OPTIONS = ['San Francisco', 'Los Angeles', 'Seattle', 'Austin', 'Chicago', 'Orlando'];
const CONSENT_VERSION = 'v2025-01';

interface PrivacySettingsState {
  preciseLocation: boolean;
  approximateLocation: boolean;
  personalization: boolean;
  marketingEmails: boolean;
}

const PreferencesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const dealId = (location.state as { dealId?: number })?.dealId;
  const redirectTo = (location.state as { redirectTo?: string })?.redirectTo;
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [preferredCities, setPreferredCities] = useState<string[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [privacy, setPrivacy] = useState<PrivacySettingsState>({
    preciseLocation: false,
    approximateLocation: true,
    personalization: true,
    marketingEmails: true,
  });
  const [consentUpdatedAt, setConsentUpdatedAt] = useState<string | null>(null);
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [hasUserMadeChanges, setHasUserMadeChanges] = useState(false);
  const [merchantForm, setMerchantForm] = useState({ name: '', address: '', city: '', state: '' });
  const [destinationForm, setDestinationForm] = useState({ name: '', address: '' });

  const queryClient = useQueryClient();
  const preferencesQuery = useQuery({ queryKey: ['preferences'], queryFn: fetchPreferences, enabled: Boolean(user) });
  const merchantSuggestionsQuery = useQuery({
    queryKey: ['preferences', 'merchant-suggestions'],
    queryFn: fetchMerchantSuggestions,
    enabled: Boolean(user),
  });
  const favoritePlacesQuery = useQuery({
    queryKey: ['preferences', 'favorite-places'],
    queryFn: fetchFavoritePlaces,
    enabled: Boolean(user),
  });

  const addMerchantMutation = useMutation({
    mutationFn: addMerchantSuggestion,
    onSuccess: () => {
      setMerchantForm({ name: '', address: '', city: '', state: '' });
      void queryClient.invalidateQueries({ queryKey: ['preferences', 'merchant-suggestions'] });
    },
  });

  const removeMerchantMutation = useMutation({
    mutationFn: deleteMerchantSuggestion,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['preferences', 'merchant-suggestions'] });
    },
  });

  const addDestinationMutation = useMutation({
    mutationFn: addFavoritePlace,
    onSuccess: () => {
      setDestinationForm({ name: '', address: '' });
      void queryClient.invalidateQueries({ queryKey: ['preferences', 'favorite-places'] });
    },
  });

  const removeDestinationMutation = useMutation({
    mutationFn: deleteFavoritePlace,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['preferences', 'favorite-places'] });
    },
  });

  useEffect(() => {
    const envelope = preferencesQuery.data;
    if (!envelope || !envelope.data) {
      // If no preferences exist yet, mark as loaded so we can start saving
      if (envelope && !envelope.error && user) {
        setHasLoadedInitialData(true);
        setHasUserMadeChanges(false);
      }
      return;
    }
    const pref = envelope.data;
    console.log('[Preferences] Loading preferences data:', pref);
    setCategories(pref.preferredCategories ?? []);
    setBrands(pref.preferredBrands ?? []);
    setPreferredCities(pref.preferredLocations ?? []);
    setNotificationsEnabled(Boolean(pref.notificationSettings?.push));
    setEmailUpdates(Boolean(pref.notificationSettings?.email));
    setPrivacy({
      preciseLocation: Boolean(pref.privacySettings?.preciseLocation),
      approximateLocation:
        pref.privacySettings?.approximateLocation ?? true,
      personalization: pref.privacySettings?.personalization ?? true,
      marketingEmails: pref.privacySettings?.marketingEmails ?? Boolean(pref.notificationSettings?.email),
    });
    setConsentUpdatedAt(pref.consentUpdatedAt ?? null);
    setHasLoadedInitialData(true);
    setHasUserMadeChanges(false);
  }, [preferencesQuery.data, user]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        preferredCategories: categories,
        preferredBrands: brands,
        preferredLocations: preferredCities,
        budgetPreferences: null,
        notificationSettings: {
          push: notificationsEnabled,
          email: emailUpdates,
        },
        travelPreferences: null,
        privacySettings: {
          preciseLocation: privacy.preciseLocation,
          approximateLocation: privacy.approximateLocation,
          personalization: privacy.personalization,
          marketingEmails: privacy.marketingEmails,
        },
        consentVersion: CONSENT_VERSION,
      };
      console.log('[Preferences] Calling updatePreferences with payload:', JSON.stringify(payload, null, 2));
      try {
        const result = await updatePreferences(payload);
        console.log('[Preferences] updatePreferences returned:', result);
        return result;
      } catch (error) {
        console.error('[Preferences] updatePreferences threw error:', error);
        throw error;
      }
    },
    onSuccess: async (response) => {
      console.log('[Preferences] Save successful:', response);
      const updated = response.data;
      if (updated) {
        setConsentUpdatedAt(updated.consentUpdatedAt ?? new Date().toISOString());
      }
      setHasUserMadeChanges(false); // Reset after successful save
      void preferencesQuery.refetch();
      
      // If we have a dealId from registration flow, save the deal and redirect
      if (dealId) {
        try {
          await toggleDealSaved(dealId);
          // Redirect to the deal or the specified redirect path
          if (redirectTo) {
            navigate(redirectTo);
          } else {
            navigate(`/deals/${dealId}`);
          }
        } catch (error) {
          console.error('Failed to save deal:', error);
          // Still redirect even if save fails
          if (redirectTo) {
            navigate(redirectTo);
          } else if (dealId) {
            navigate(`/deals/${dealId}`);
          }
        }
      }
    },
    onError: (error) => {
      console.error('[Preferences] Save failed:', error);
      setHasUserMadeChanges(true); // Keep the flag so user can retry
    },
  });

  // Auto-save preferences when user makes changes (debounced)
  useEffect(() => {
    // Don't auto-save on initial load
    if (!hasLoadedInitialData || !hasUserMadeChanges) {
      console.log('[Preferences] Auto-save skipped:', { hasLoadedInitialData, hasUserMadeChanges });
      return;
    }
    
    // Don't auto-save if preferences are loading
    if (preferencesQuery.isLoading) {
      console.log('[Preferences] Auto-save skipped: preferences loading');
      return;
    }
    
    // Don't auto-save if mutation is already in progress
    if (updateMutation.isPending) {
      console.log('[Preferences] Auto-save skipped: mutation in progress');
      return;
    }

    console.log('[Preferences] Setting up auto-save timer...');
    const timeoutId = setTimeout(() => {
      // Only auto-save if user is logged in
      if (user) {
        console.log('[Preferences] Auto-saving preferences...');
        updateMutation.mutate();
      } else {
        console.log('[Preferences] Auto-save skipped: no user');
      }
    }, 2000); // 2 second debounce

    return () => {
      console.log('[Preferences] Clearing auto-save timer');
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, brands, preferredCities, notificationsEnabled, emailUpdates, privacy, user, hasLoadedInitialData, hasUserMadeChanges]);

  const handleToggle = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setHasUserMadeChanges(true);
  };

  const consentLastUpdated = useMemo(() => {
    if (!consentUpdatedAt) return 'Not yet recorded';
    try {
      return dayjs(consentUpdatedAt).fromNow();
    } catch {
      return 'Recently updated';
    }
  }, [consentUpdatedAt]);

  const recommendedBy = preferencesQuery.data?.meta?.recommended_by ?? null;
  const merchantSuggestions = merchantSuggestionsQuery.data?.data ?? [];
  const favoritePlaces = favoritePlacesQuery.data?.data ?? [];

  if (preferencesQuery.isLoading) {
    return <FullScreenLoader message="Loading your DWIGO preferences…" />;
  }

  if (preferencesQuery.isError || preferencesQuery.data?.error) {
    return <ErrorState onRetry={() => preferencesQuery.refetch()} />;
  }

  return (
    <Stack spacing={3} sx={{ px: 2.5 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Your DWIGO Preferences
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tune DWIGO Agent so deals and recommendations feel handpicked for your household.
        </Typography>
        {recommendedBy ? (
          <Typography variant="caption" color="text.secondary">
            Personalization powered by {recommendedBy}
          </Typography>
        ) : null}
      </Box>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
          Favorite categories
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {CATEGORY_OPTIONS.map((category) => (
            <Chip
              key={category}
              label={category}
              onClick={() => handleToggle(category, categories, setCategories)}
              color={categories.includes(category) ? 'primary' : 'default'}
              variant={categories.includes(category) ? 'filled' : 'outlined'}
              sx={{ borderRadius: 999 }}
            />
          ))}
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
          Merchants you never miss
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Pick quick suggestions below, add a business manually, or use the store icon on any deal card (or{' '}
          <strong>Track this merchant</strong> on the deal page)—entries feed our merchant directory.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {BRAND_OPTIONS.map((brand) => (
            <Chip
              key={brand}
              label={brand}
              onClick={() => handleToggle(brand, brands, setBrands)}
              color={brands.includes(brand) ? 'secondary' : 'default'}
              variant={brands.includes(brand) ? 'filled' : 'outlined'}
              sx={{ borderRadius: 999 }}
            />
          ))}
        </Stack>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <TextField
            label="Merchant or brand name"
            value={merchantForm.name}
            onChange={(e) => setMerchantForm((f) => ({ ...f, name: e.target.value }))}
            fullWidth
            size="small"
            required
          />
          <TextField
            label="Address or neighborhood (optional)"
            value={merchantForm.address}
            onChange={(e) => setMerchantForm((f) => ({ ...f, address: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="City (optional)"
            value={merchantForm.city}
            onChange={(e) => setMerchantForm((f) => ({ ...f, city: e.target.value }))}
            fullWidth
            size="small"
          />
          <TextField
            label="State or region (optional)"
            value={merchantForm.state}
            onChange={(e) => setMerchantForm((f) => ({ ...f, state: e.target.value }))}
            fullWidth
            size="small"
            inputProps={{ maxLength: 50 }}
          />
          <Button
            variant="outlined"
            disabled={!merchantForm.name.trim() || addMerchantMutation.isPending}
            onClick={() =>
              addMerchantMutation.mutate({
                merchantName: merchantForm.name.trim(),
                address: merchantForm.address.trim() || undefined,
                city: merchantForm.city.trim() || undefined,
                state: merchantForm.state.trim() || undefined,
              })
            }
          >
            {addMerchantMutation.isPending ? 'Adding…' : 'Add merchant to track'}
          </Button>
          {addMerchantMutation.isError ? (
            <Typography variant="caption" color="error">
              Could not save that merchant. Try again.
            </Typography>
          ) : null}
        </Stack>
        {merchantSuggestionsQuery.isError ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Could not load your saved merchants.
          </Typography>
        ) : merchantSuggestionsQuery.isLoading ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Loading your merchants…
          </Typography>
        ) : merchantSuggestions.length > 0 ? (
          <List dense disablePadding sx={{ mt: 1 }}>
            {merchantSuggestions.map((m) => (
              <ListItem
                key={m.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={`Remove ${m.merchantName}`}
                    onClick={() => removeMerchantMutation.mutate(m.id)}
                    disabled={removeMerchantMutation.isPending}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ pr: 6, alignItems: 'flex-start' }}
              >
                <ListItemText
                  primary={m.merchantName}
                  secondary={
                    [
                      m.address,
                      [m.city, m.state].filter(Boolean).join(', ') || null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Location not specified'
                  }
                />
              </ListItem>
            ))}
          </List>
        ) : null}
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
          Destinations you frequent
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Choose metro areas you care about, then add specific places (malls, neighborhoods, venues) you visit often.
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap mb={1.5}>
          {CITY_OPTIONS.map((city) => (
            <Chip
              key={city}
              label={city}
              onClick={() => handleToggle(city, preferredCities, setPreferredCities)}
              color={preferredCities.includes(city) ? 'primary' : 'default'}
              variant={preferredCities.includes(city) ? 'filled' : 'outlined'}
              sx={{ borderRadius: 999 }}
            />
          ))}
        </Stack>
        <Stack spacing={1.5}>
          <TextField
            label="Place or destination name"
            value={destinationForm.name}
            onChange={(e) => setDestinationForm((f) => ({ ...f, name: e.target.value }))}
            fullWidth
            size="small"
            required
          />
          <TextField
            label="Address or area (optional)"
            value={destinationForm.address}
            onChange={(e) => setDestinationForm((f) => ({ ...f, address: e.target.value }))}
            fullWidth
            size="small"
          />
          <Button
            variant="outlined"
            disabled={!destinationForm.name.trim() || addDestinationMutation.isPending}
            onClick={() =>
              addDestinationMutation.mutate({
                placeName: destinationForm.name.trim(),
                address: destinationForm.address.trim() || undefined,
                placeType: 'destination',
                category: 'Travel',
              })
            }
          >
            {addDestinationMutation.isPending ? 'Adding…' : 'Add destination'}
          </Button>
          {addDestinationMutation.isError ? (
            <Typography variant="caption" color="error">
              Could not save that destination. Try again.
            </Typography>
          ) : null}
        </Stack>
        {favoritePlacesQuery.isError ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Could not load your saved destinations.
          </Typography>
        ) : favoritePlacesQuery.isLoading ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Loading your destinations…
          </Typography>
        ) : favoritePlaces.length > 0 ? (
          <List dense disablePadding sx={{ mt: 1 }}>
            {favoritePlaces.map((p) => (
              <ListItem
                key={p.id}
                secondaryAction={
                  <IconButton
                    edge="end"
                    aria-label={`Remove ${p.place_name}`}
                    onClick={() => removeDestinationMutation.mutate(p.id)}
                    disabled={removeDestinationMutation.isPending}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                }
                sx={{ pr: 6, alignItems: 'flex-start' }}
              >
                <ListItemText
                  primary={p.place_name}
                  secondary={p.address || 'No address saved'}
                />
              </ListItem>
            ))}
          </List>
        ) : null}
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
          Notifications
        </Typography>
        <Stack spacing={1}>
          <FormControlLabel
            control={
              <Switch checked={notificationsEnabled} onChange={(event) => {
                setNotificationsEnabled(event.target.checked);
                setHasUserMadeChanges(true);
              }} />
            }
            label="Push notifications when deals are nearby"
          />
          <FormControlLabel
            control={<Switch checked={emailUpdates} onChange={(event) => {
              setEmailUpdates(event.target.checked);
              setHasUserMadeChanges(true);
            }} />}
            label="Email me weekly DWIGO recaps"
          />
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
          Privacy & consent
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Control how DWIGO uses your data and location to personalize deals. You can adjust these anytime.
        </Typography>
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                checked={privacy.preciseLocation}
                onChange={(event) => {
                  setPrivacy((prev) => ({
                    ...prev,
                    preciseLocation: event.target.checked,
                    approximateLocation: event.target.checked || prev.approximateLocation,
                  }));
                  setHasUserMadeChanges(true);
                }}
              />
            }
            label="Share precise location for doorstep-level deal alerts"
          />
          <FormControlLabel
            control={
              <Switch
                checked={privacy.approximateLocation}
                onChange={(event) => {
                  setPrivacy((prev) => ({
                    ...prev,
                    approximateLocation: event.target.checked,
                  }));
                  setHasUserMadeChanges(true);
                }}
              />
            }
            label="Share approximate city-level location"
          />
          <FormControlLabel
            control={
              <Switch
                checked={privacy.personalization}
                onChange={(event) => {
                  setPrivacy((prev) => ({
                    ...prev,
                    personalization: event.target.checked,
                  }));
                  setHasUserMadeChanges(true);
                }}
              />
            }
            label="Use my activity to personalize agent recommendations"
          />
          <FormControlLabel
            control={
              <Switch
                checked={privacy.marketingEmails}
                onChange={(event) => {
                  setPrivacy((prev) => ({
                    ...prev,
                    marketingEmails: event.target.checked,
                  }));
                  setEmailUpdates(event.target.checked);
                  setHasUserMadeChanges(true);
                }}
              />
            }
            label="Send invites to exclusive merchant events & perks"
          />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
          Consent pack {CONSENT_VERSION} · Last updated {consentLastUpdated}
        </Typography>
      </Paper>

      <Stack direction="row" spacing={2}>
        <Button
          variant="contained"
          size="large"
          onClick={() => {
            setHasUserMadeChanges(true); // Ensure changes flag is set
            updateMutation.mutate();
          }}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving…' : updateMutation.isSuccess ? 'Saved ✓' : 'Save preferences'}
        </Button>
      </Stack>
      
      {updateMutation.isSuccess && !dealId && (
        <Typography variant="caption" color="success.main" sx={{ display: 'block', textAlign: 'center' }}>
          Preferences saved successfully
        </Typography>
      )}
      
      {updateMutation.isError && (
        <Typography variant="caption" color="error.main" sx={{ display: 'block', textAlign: 'center' }}>
          Failed to save preferences. Please try again.
        </Typography>
      )}
    </Stack>
  );
};

export default PreferencesPage;

