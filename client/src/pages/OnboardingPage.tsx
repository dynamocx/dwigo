import { Box, Button, Paper, Stack, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const steps = ['Tell DWIGO your go-to places', 'Set travel personas', 'Enable smart notifications'];

const OnboardingPage = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  const content = useMemo(() => {
    switch (activeStep) {
      case 0:
        return 'Add the brands, grocery stores, and neighbourhood favourites where you already spend. DWIGO will tune your feed instantly.';
      case 1:
        return 'Choose personas like “family adventures” or “golf weekends” so DWIGO Agent can curate experiences.';
      case 2:
        return 'Turn on location nudges to get timely reminders when you are near a stackable offer or last-minute event.';
      default:
        return '';
    }
  }, [activeStep]);

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      navigate('/preferences', { replace: true });
      return;
    }
    setActiveStep((step) => step + 1);
  };

  return (
    <Stack spacing={3} sx={{ minHeight: '70vh' }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>
          Let’s personalise DWIGO
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Answer a few quick questions so every recommendation feels made-for-you from day one.
        </Typography>
      </Box>

      <Stepper activeStep={activeStep} alternativeLabel>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper elevation={0} sx={{ p: 3, borderRadius: 4, border: (theme) => `1px solid ${theme.palette.divider}`, flex: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }} gutterBottom>
          {steps[activeStep]}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {content}
        </Typography>
      </Paper>

      <Button variant="contained" size="large" onClick={handleNext} sx={{ alignSelf: 'flex-end' }}>
        {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
      </Button>
    </Stack>
  );
};

export default OnboardingPage;

