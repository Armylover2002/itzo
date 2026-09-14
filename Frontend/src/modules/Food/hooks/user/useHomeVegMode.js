import { useCallback } from 'react';

export const useHomeVegMode = ({
  vegMode,
  setVegMode,
  setShowVegModePopup,
  setShowSwitchOffPopup,
}) => {
  const handleVegModeToggle = useCallback((e) => {
    // If e is an event, prevent propagation if needed, but here we just need to know the next state
    // If it's becoming true, show popup. If it's becoming false, show confirmation.
    
    // The switch component usually passes the new checked value or we check the current state
    const becomingActive = !vegMode;

    if (becomingActive) {
      setVegMode(true);
      setShowVegModePopup(true);
    } else {
      setShowSwitchOffPopup(true);
    }
  }, [vegMode, setVegMode, setShowVegModePopup, setShowSwitchOffPopup]);

  const confirmSwitchOff = useCallback(() => {
    setVegMode(false);
    setShowSwitchOffPopup(false);
  }, [setVegMode, setShowSwitchOffPopup]);

  return {
    handleVegModeToggle,
    confirmSwitchOff
  };
};
