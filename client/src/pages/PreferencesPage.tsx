import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';

import { addFavoritePlace, fetchPreferences, updatePreferences } from '@/api/preferences';
import { useAuth } from '@/auth/AuthContext';
import ErrorState from '@/components/common/ErrorState';
import FullScreenLoader from '@/components/common/FullScreenLoader';

const CATEGORY_OPTIONS = ['Groceries', 'Dining', 'Home Improvement', 'Family Activities', 'Wellness', 'Travel'];
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

  const preferencesQuery = useQuery({ queryKey: ['preferences'], queryFn: fetchPreferences, enabled: Boolean(user) });

  useEffect(() => {
    const envelope = preferencesQuery.data;
    if (!envelope || !envelope.data) {
      return;
    }
    const pref = envelope.data;
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
  }, [preferencesQuery.data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      updatePreferences({
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
      }),
    onSuccess: async (response) => {
      const updated = response.data;
      setConsentUpdatedAt(updated?.consentUpdatedAt ?? new Date().toISOString());
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
  });

  // Auto-save preferences when user makes changes (debounced)
  useEffect(() => {
    // Don't auto-save on initial load
    if (!hasLoadedInitialData || !hasUserMadeChanges) return;
    
    // Don't auto-save if preferences are loading
    if (preferencesQuery.isLoading) return;
    
    // Don't auto-save if mutation is already in progress
    if (updateMutation.isPending) return;

    const timeoutId = setTimeout(() => {
      // Only auto-save if user is logged in
      if (user) {
        updateMutation.mutate();
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [categories, brands, preferredCities, notificationsEnabled, emailUpdates, privacy, user, hasLoadedInitialData, hasUserMadeChanges, updateMutation, preferencesQuery.isLoading]);

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

  if (preferencesQuery.isLoading) {
    return <FullScreenLoader message="Loading your DWIGO preferences…" />;
  }

  if (preferencesQuery.isError || preferencesQuery.data?.error) {
    return <ErrorState onRetry={() => preferencesQuery.refetch()} />;
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Your DWIGO Preferences
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Tune DWIGO Agent so deals and recommendations feel handpicked for your household.
        </Typography>
        {recommendedBy ? (
          <Typography variant="caption" color="text.secondary">
            Personalisation powered by {recommendedBy}
          </Typography>
        ) : null}
      </Box>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
          Favourite categories
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
      </Paper>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
          Destinations you frequent
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
        <Typography variant="caption" color="text.secondary">
          Want to add a specific venue? Tap suggestions in the deals feed to lock them in.
        </Typography>
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
          Control how DWIGO uses your data and location to personalise deals. You can adjust these anytime.
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
            label="Use my activity to personalise agent recommendations"
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
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? 'Saving…' : 'Save preferences'}
        </Button>
        <Button
          variant="outlined"
          onClick={() =>
            void addFavoritePlace({
              placeName: 'Custom Venue',
              placeType: 'dining',
              category: 'Restaurants',
            })
          }
        >
          Quick add venue
        </Button>
      </Stack>
    </Stack>
  );
};

export default PreferencesPage;

