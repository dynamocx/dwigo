import { Box, CircularProgress, Typography } from '@mui/material';

interface FullScreenLoaderProps {
  message?: string;
}

const FullScreenLoader = ({ message = 'Loading DWIGO…' }: FullScreenLoaderProps) => (
  <Box
    sx={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      background: (theme) => theme.palette.background.default,
    }}
  >
    <Box
      component="img"
      src="/branding/DWIGO-LOGO.svg"
      alt="DWIGO"
      sx={{ height: 56, mb: 1 }}
    />
    <CircularProgress color="primary" size={48} thickness={4} />
    <Typography variant="body2" color="text.secondary">
      {message}
    </Typography>
  </Box>
);

export default FullScreenLoader;

