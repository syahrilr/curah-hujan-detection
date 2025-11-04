import { MongoClient, ServerApiVersion } from "mongodb";

// MongoDB Configuration
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = "db_curah_hujan";
const COLLECTION_FORECAST = "forecast_records"; // Menyimpan prediksi
const COLLECTION_ACCURACY = "forecast_accuracy"; // Menyimpan hasil analisis

// Initialize MongoDB Client
let client: MongoClient | null = null;
if (MONGODB_URI) {
  client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
}

//Types & Interfaces

export interface ForecastRecord {
  location: {
    name: string;
    latitude: number;
    longitude: number;
  };
  forecastTime: Date; // Kapan forecast dibuat
  targetTime: Date; // Untuk jam berapa prediksinya
  predicted: {
    precipitation: number;
    probability: number;
    weatherCode: number;
  };
  actual?: {
    precipitation: number;
    rain: number;
    weatherCode: number;
  };
  verified: boolean;
  verifiedAt?: Date;
}

export interface AccuracyMetrics {
  location: {
    name: string;
    latitude: number;
    longitude: number;
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalForecasts: number;
  verifiedForecasts: number;
  metrics: {
    // Precipitation accuracy
    mae: number;
    rmse: number;
    bias: number;
    correlation: number;
    probabilityScore: number;


    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;

    // Threshold-based metrics
    rainyDaysCorrect: number;
    rainyDaysTotal: number;
    dryDaysCorrect: number;
    dryDaysTotal: number;
  };
  summary: {
    avgPredicted: number;
    avgActual: number;
    maxError: number;
    reliability: string; // "Excellent" | "Good" | "Fair" | "Poor"
  };
}

//Save Forecast Record

export async function saveForecastRecord(
  locationName: string,
  latitude: number,
  longitude: number,
  forecastData: {
    targetTime: string;
    precipitation: number;
    probability: number;
    weatherCode: number;
  }
): Promise<boolean> {
  if (!client) {
    console.warn("MongoDB not configured, skipping forecast save");
    return false;
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection<ForecastRecord>(COLLECTION_FORECAST);

    const record: ForecastRecord = {
      location: {
        name: locationName,
        latitude,
        longitude,
      },
      forecastTime: new Date(),
      targetTime: new Date(forecastData.targetTime),
      predicted: {
        precipitation: forecastData.precipitation,
        probability: forecastData.probability,
        weatherCode: forecastData.weatherCode,
      },
      verified: false,
    };

    await collection.insertOne(record as any);
    console.log(`✅ Saved forecast for ${locationName} targeting ${forecastData.targetTime}`);
    return true;
  } catch (error) {
    console.error("Failed to save forecast record:", error);
    return false;
  } finally {
    await client.close();
  }
}

//Verify Forecasts with Actual Data

export async function verifyForecasts(
  startDate: Date,
  endDate: Date
): Promise<{ verified: number; failed: number }> {
  if (!client) {
    throw new Error("MongoDB not configured");
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const forecastCollection = db.collection<ForecastRecord>(COLLECTION_FORECAST);

    // Find unverified forecasts dalam range waktu
    const unverifiedForecasts = await forecastCollection
      .find({
        verified: false,
        targetTime: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .toArray();

    console.log(`🔍 Found ${unverifiedForecasts.length} unverified forecasts`);

    let verified = 0;
    let failed = 0;

    for (const forecast of unverifiedForecasts) {
      try {
        // Fetch actual data from Open-Meteo Archive
        const actualData = await fetchActualData(
          forecast.location.latitude,
          forecast.location.longitude,
          forecast.targetTime
        );

        if (actualData) {
          // Update forecast record dengan actual data
          await forecastCollection.updateOne(
            { _id: forecast._id },
            {
              $set: {
                actual: actualData,
                verified: true,
                verifiedAt: new Date(),
              },
            }
          );
          verified++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to verify forecast for ${forecast.location.name}:`, error);
        failed++;
      }
    }

    console.log(`✅ Verified: ${verified}, ❌ Failed: ${failed}`);
    return { verified, failed };
  } finally {
    await client.close();
  }
}

//Calculate Accuracy Metrics

export async function calculateAccuracyMetrics(
  locationName: string,
  startDate: Date,
  endDate: Date
): Promise<AccuracyMetrics | null> {
  if (!client) {
    throw new Error("MongoDB not configured");
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const forecastCollection = db.collection<ForecastRecord>(COLLECTION_FORECAST);

    // Get verified forecasts untuk lokasi dan periode tertentu
    const forecasts = await forecastCollection
      .find({
        "location.name": locationName,
        verified: true,
        targetTime: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .toArray();

    if (forecasts.length === 0) {
      console.log(`No verified forecasts found for ${locationName}`);
      return null;
    }

    console.log(`📊 Calculating metrics for ${forecasts.length} forecasts`);

    // Extract predictions and actuals
    const predictions = forecasts.map((f) => f.predicted.precipitation);
    const actuals = forecasts.map((f) => f.actual!.precipitation);
    const probabilities = forecasts.map((f) => f.predicted.probability);

    // Calculate metrics
    const mae = calculateMAE(predictions, actuals);
    const rmse = calculateRMSE(predictions, actuals);
    const bias = calculateBias(predictions, actuals);
    const correlation = calculateCorrelation(predictions, actuals);
    const brierScore = calculateBrierScore(probabilities, actuals);

    // Classification metrics (rain > 0.5mm = rain, else = no rain)
    const threshold = 0.5;
    const { accuracy, precision, recall, f1Score, rainyDays, dryDays } =
      calculateClassificationMetrics(predictions, actuals, threshold);

    // Summary statistics
    const avgPredicted = predictions.reduce((a, b) => a + b, 0) / predictions.length;
    const avgActual = actuals.reduce((a, b) => a + b, 0) / actuals.length;
    const errors = predictions.map((p, i) => Math.abs(p - actuals[i]));
    const maxError = Math.max(...errors);

    // Determine reliability
    const reliability = getReliabilityRating(mae, correlation);

    const metrics: AccuracyMetrics = {
      location: forecasts[0].location,
      period: {
        startDate,
        endDate,
      },
      totalForecasts: forecasts.length,
      verifiedForecasts: forecasts.length,
      metrics: {
        mae,
        rmse,
        bias,
        correlation,
        probabilityScore: brierScore,
        accuracy,
        precision,
        recall,
        f1Score,
        rainyDaysCorrect: rainyDays.correct,
        rainyDaysTotal: rainyDays.total,
        dryDaysCorrect: dryDays.correct,
        dryDaysTotal: dryDays.total,
      },
      summary: {
        avgPredicted,
        avgActual,
        maxError,
        reliability,
      },
    };

    // Save accuracy metrics to database
    await saveAccuracyMetrics(metrics);

    return metrics;
  } finally {
    await client.close();
  }
}

//Statistical Functions

function calculateMAE(predictions: number[], actuals: number[]): number {
  const errors = predictions.map((p, i) => Math.abs(p - actuals[i]));
  return errors.reduce((a, b) => a + b, 0) / errors.length;
}

function calculateRMSE(predictions: number[], actuals: number[]): number {
  const squaredErrors = predictions.map((p, i) => Math.pow(p - actuals[i], 2));
  const mse = squaredErrors.reduce((a, b) => a + b, 0) / squaredErrors.length;
  return Math.sqrt(mse);
}

function calculateBias(predictions: number[], actuals: number[]): number {
  const errors = predictions.map((p, i) => p - actuals[i]);
  return errors.reduce((a, b) => a + b, 0) / errors.length;
}

function calculateCorrelation(predictions: number[], actuals: number[]): number {
  const n = predictions.length;
  const meanPred = predictions.reduce((a, b) => a + b, 0) / n;
  const meanActual = actuals.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomPred = 0;
  let denomActual = 0;

  for (let i = 0; i < n; i++) {
    const diffPred = predictions[i] - meanPred;
    const diffActual = actuals[i] - meanActual;
    numerator += diffPred * diffActual;
    denomPred += diffPred * diffPred;
    denomActual += diffActual * diffActual;
  }

  if (denomPred === 0 || denomActual === 0) return 0;
  return numerator / Math.sqrt(denomPred * denomActual);
}

function calculateBrierScore(probabilities: number[], actuals: number[]): number {
  // Brier score untuk probabilistic forecasts
  // 0 = perfect, 1 = worst
  const threshold = 0.5; // 0.5mm = rain
  const outcomes = actuals.map((a) => (a > threshold ? 1 : 0));
  const probs = probabilities.map((p) => p / 100); // Convert to 0-1

  const squaredErrors = probs.map((p, i) => Math.pow(p - outcomes[i], 2));
  return squaredErrors.reduce((a, b) => a + b, 0) / squaredErrors.length;
}

function calculateClassificationMetrics(
  predictions: number[],
  actuals: number[],
  threshold: number
) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  let rainyCorrect = 0, rainyTotal = 0;
  let dryCorrect = 0, dryTotal = 0;

  for (let i = 0; i < predictions.length; i++) {
    const predictedRain = predictions[i] > threshold;
    const actualRain = actuals[i] > threshold;

    if (actualRain) {
      rainyTotal++;
      if (predictedRain) {
        tp++;
        rainyCorrect++;
      } else {
        fn++;
      }
    } else {
      dryTotal++;
      if (!predictedRain) {
        tn++;
        dryCorrect++;
      } else {
        fp++;
      }
    }
  }

  const accuracy = (tp + tn) / (tp + fp + tn + fn);
  const precision = tp / (tp + fp) || 0;
  const recall = tp / (tp + fn) || 0;
  const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

  return {
    accuracy,
    precision,
    recall,
    f1Score,
    rainyDays: { correct: rainyCorrect, total: rainyTotal },
    dryDays: { correct: dryCorrect, total: dryTotal },
  };
}

function getReliabilityRating(mae: number, correlation: number): string {
  // MAE in mm/h, correlation -1 to 1
  if (mae < 1 && correlation > 0.8) return "Excellent";
  if (mae < 2 && correlation > 0.6) return "Good";
  if (mae < 3 && correlation > 0.4) return "Fair";
  return "Poor";
}

//Fetch Actual Data from Open-Meteo

async function fetchActualData(
  latitude: number,
  longitude: number,
  targetTime: Date
): Promise<{ precipitation: number; rain: number; weatherCode: number } | null> {
  const date = targetTime.toISOString().split("T")[0]; // YYYY-MM-DD
  const hour = targetTime.getHours();

  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", latitude.toFixed(5));
  url.searchParams.set("longitude", longitude.toFixed(5));
  url.searchParams.set("start_date", date);
  url.searchParams.set("end_date", date);
  url.searchParams.set("hourly", "precipitation,rain,weather_code");
  url.searchParams.set("timezone", "Asia/Jakarta");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) return null;

    const data = await response.json();

    // Find data untuk jam yang tepat
    const timeIndex = data.hourly.time.findIndex((t: string) => {
      const dataTime = new Date(t);
      return dataTime.getHours() === hour && dataTime.toDateString() === targetTime.toDateString();
    });

    if (timeIndex === -1) return null;

    return {
      precipitation: data.hourly.precipitation[timeIndex] || 0,
      rain: data.hourly.rain[timeIndex] || 0,
      weatherCode: data.hourly.weather_code[timeIndex] || 0,
    };
  } catch (error) {
    console.error("Failed to fetch actual data:", error);
    return null;
  }
}

//Save Accuracy Metrics to DB

async function saveAccuracyMetrics(metrics: AccuracyMetrics): Promise<void> {
  if (!client) return;

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_ACCURACY);

    await collection.insertOne({
      ...metrics,
      createdAt: new Date(),
    } as any);

    console.log(`✅ Saved accuracy metrics for ${metrics.location.name}`);
  } finally {
    await client.close();
  }
}

//Get Historical Accuracy

export async function getHistoricalAccuracy(
  locationName?: string,
  limit: number = 10
): Promise<AccuracyMetrics[]> {
  if (!client) {
    throw new Error("MongoDB not configured");
  }

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection<AccuracyMetrics>(COLLECTION_ACCURACY);

    const filter = locationName ? { "location.name": locationName } : {};

    const results = await collection
      .find(filter)
      .sort({ "period.endDate": -1 })
      .limit(limit)
      .toArray();

    return results as AccuracyMetrics[];
  } finally {
    await client.close();
  }
}
