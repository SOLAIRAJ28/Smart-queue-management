/**
 * Queue Theory AI Wait Predictor & Crowd Forecaster.
 * Computes wait times using a multi-server queue approximation (Little's Law).
 * Applies time-of-day and day-of-week modifiers to predict lobby congestion.
 * 
 * @param {number} waitingCount - Number of customers currently in the waiting state
 * @param {number} avgServingTime - Service's average transaction completion duration (minutes)
 * @param {number} activeTellers - Count of operational tellers assigned to this service
 * @param {Date} [date] - Evaluation timestamp
 * @returns {Object} Forecast details
 */
export const predictWaitingTime = (waitingCount, avgServingTime, activeTellers, date = new Date()) => {
  if (waitingCount <= 0) {
    return {
      waitMinutes: 0,
      congestionLevel: 'low',
      advice: 'Lobby is operating smoothly. Tellers are ready to serve.'
    };
  }

  // Operational servers capacity floor is 1 to prevent division by zero
  const capacity = activeTellers > 0 ? activeTellers : 1;
  
  // Base wait prediction: (Queue length * Avg Service duration) / Num of tellers
  let rawPrediction = (waitingCount * avgServingTime) / capacity;

  const day = date.getDay(); 
  const hour = date.getHours();
  let multiplier = 1.0;

  // 1. Time of Day Multipliers (Lunch hour rush & closing hours)
  if (hour >= 12 && hour < 14) {
    multiplier += 0.30; // +30% volume modifier
  } else if (hour >= 15 && hour < 17) {
    multiplier += 0.15; // +15% modifier
  }

  // 2. Day of Week Multipliers (Monday and Friday rushes)
  if (day === 1) { 
    multiplier += 0.20; // +20% Monday morning rush
  } else if (day === 5) {
    multiplier += 0.25; // +25% Friday weekend payout rush
  }

  const predictedMins = Math.max(1, Math.round(rawPrediction * multiplier));

  // 3. Formulate congestion levels and smart management advice
  let congestionLevel = 'low';
  let advice = 'Lobby is running within bounds. Operations are optimal.';

  if (predictedMins >= 30) {
    congestionLevel = 'critical';
    advice = 'Critical delay: Waiting times exceed 30 mins! Recommend enabling backup counter tellers immediately.';
  } else if (predictedMins >= 15) {
    congestionLevel = 'moderate';
    advice = 'Moderate queue: Customer wait times are climbing. Monitor serving speeds.';
  }

  return {
    waitMinutes: predictedMins,
    congestionLevel,
    advice
  };
};

/**
 * Generates an hourly crowd density forecast curve for a full business day.
 * 
 * @param {number} baseLoad - Average base visitor count
 * @returns {Array<{ hour: string, density: string, index: number }>}
 */
export const generateCrowdForecast = (baseLoad = 10) => {
  const businessHours = Array.from({ length: 9 }, (_, i) => i + 9); // 9 AM to 5 PM
  
  return businessHours.map(hour => {
    let index = 1.0;
    
    // Simulate lunch peak and closing rushes
    if (hour === 12 || hour === 13) index = 1.8;
    else if (hour === 16) index = 1.5;
    else if (hour === 9) index = 1.3;
    else index = 0.9;

    const densityVal = baseLoad * index;
    let density = 'Low';
    if (densityVal > 15) density = 'High Rush';
    else if (densityVal > 10) density = 'Moderate';

    return {
      hour: `${hour}:00`,
      densityIndex: parseFloat(index.toFixed(2)),
      density
    };
  });
};
