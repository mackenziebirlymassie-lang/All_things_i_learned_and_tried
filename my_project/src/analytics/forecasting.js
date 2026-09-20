'use strict';

function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }
function variance(values) { const average = mean(values); return mean(values.map(value => (value - average) ** 2)); }

function movingAverage(values, window = 3) {
  const size = Math.max(1, Number(window) || 1);
  return values.map((_, index) => mean(values.slice(Math.max(0, index - size + 1), index + 1)));
}

function linearRegression(values) {
  const points = values.map((value, index) => [index, Number(value)]).filter(([, value]) => Number.isFinite(value));
  if (points.length < 2) return { slope: 0, intercept: points[0]?.[1] || 0, r2: 0 };
  const xMean = mean(points.map(point => point[0])); const yMean = mean(points.map(point => point[1]));
  const numerator = points.reduce((sum, [x, y]) => sum + (x - xMean) * (y - yMean), 0);
  const denominator = points.reduce((sum, [x]) => sum + (x - xMean) ** 2, 0);
  const slope = denominator ? numerator / denominator : 0; const intercept = yMean - slope * xMean;
  const ssTotal = points.reduce((sum, [, y]) => sum + (y - yMean) ** 2, 0);
  const ssResidual = points.reduce((sum, [x, y]) => sum + (y - (slope * x + intercept)) ** 2, 0);
  return { slope, intercept, r2: ssTotal ? 1 - ssResidual / ssTotal : 1 };
}

function forecast(values, periods = 1, options = {}) {
  const clean = values.map(Number).filter(Number.isFinite);
  const regression = linearRegression(clean);
  const average = movingAverage(clean, options.window || 3);
  const last = clean.length - 1;
  const predictions = [];
  for (let index = 1; index <= periods; index += 1) predictions.push(Math.max(0, regression.slope * (last + index) + regression.intercept));
  return { input: clean, predictions, model: regression, movingAverage: average, confidence: Math.max(0, Math.min(1, regression.r2)), volatility: Math.sqrt(variance(clean)) };
}

function capacityEstimate(completions, pending, options = {}) {
  const dailyRate = mean(completions.map(Number).filter(Number.isFinite));
  const safety = Math.max(.1, Math.min(1, Number(options.safetyFactor) || .8));
  const effectiveRate = dailyRate * safety;
  return { dailyRate, effectiveRate, pending: Number(pending) || 0, days: effectiveRate ? (Number(pending) || 0) / effectiveRate : Infinity, confidence: completions.length >= 7 ? 'high' : completions.length >= 3 ? 'medium' : 'low' };
}

module.exports = { mean, variance, movingAverage, linearRegression, forecast, capacityEstimate };
