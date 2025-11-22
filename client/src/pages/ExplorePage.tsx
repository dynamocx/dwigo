import { Box, Paper, Stack, Typography } from '@mui/material';

const ExplorePage = () => (
  <Stack spacing={3}>
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
        Explore Nearby
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Discover trending spots, seasonal events, and destinations DWIGO users love.
      </Typography>
    </Box>

    <Paper
      elevation={0}
      sx={{
        height: 180,
        borderRadius: 4,
        border: (theme) => `1px dashed ${theme.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.secondary',
        textAlign: 'center',
        px: 3,
      }}
    >
      Map view coming soon. Turn on location services to see DWIGO deals light up around you.
    </Paper>

    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
        Weekend ideas
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 2,
        }}
      >
        {['Family Day Trips', 'Outdoor Adventures', 'Foodie Trails', 'Nightlife Pulse'].map((item) => (
          <Paper
            key={item}
            elevation={0}
            sx={{
              p: 2,
              minHeight: 110,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'flex-end',
              fontWeight: 600,
            }}
          >
            {item}
          </Paper>
        ))}
      </Box>
    </Box>

    <Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
        Featured destinations
      </Typography>
      <Stack spacing={2}>
        {[
          {
            title: 'Napa Valley Escape',
            description: 'Wine tastings, sunrise balloon rides, curated dining',
          },
          {
            title: 'Lake Tahoe Winter Playbook',
            description: 'Ski passes, family tubing, après-ski lounges',
          },
        ].map((tile) => (
          <Paper key={tile.title} elevation={0} sx={{ p: 2.5, borderRadius: 3, border: (theme) => `1px solid ${theme.palette.divider}` }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {tile.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {tile.description}
            </Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  </Stack>
);

export default ExplorePage;

