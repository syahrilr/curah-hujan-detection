import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, Db, ObjectId } from 'mongodb';

// MongoDB Connection URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://sda:PasukanBiruJatiBaru2024@192.168.5.192:27017/db_curah_hujan?authSource=admin&directConnection=true';
const DB_NAME = 'db_curah_hujan';
const COLLECTION_NAME = 'rainfall_records';

// --- MongoDB Client Setup ---
let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

async function connectToDatabase() {
  // Return cached connection if available
  if (cachedClient && cachedDb) {
    console.log('♻️ Using cached connection');
    return { client: cachedClient, db: cachedDb };
  }

  try {
    console.log('🔄 Creating new MongoDB connection...');
    console.log('📦 Database:', DB_NAME);
    console.log('📋 Collection:', COLLECTION_NAME);

    // Create new client
    const client = await MongoClient.connect(MONGODB_URI, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    const db = client.db(DB_NAME);

    console.log('✅ Connected to database:', db.databaseName);

    // Create indexes
    const collection = db.collection(COLLECTION_NAME);
    await collection.createIndex({ location: '2dsphere' });
    await collection.createIndex({ timestamp: -1 });
    await collection.createIndex({ radarStation: 1, timestamp: -1 });

    console.log('✅ Indexes created successfully');

    // Cache the connection
    cachedClient = client;
    cachedDb = db;

    console.log('✅ MongoDB connected successfully');

    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw new Error('Database connection failed');
  }
}

// --- Helper Functions ---
function validateCoordinates(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
}

function validateRainfallData(body: any): { valid: boolean; error?: string } {
  if (!body.lat || !body.lng || !body.timestamp) {
    return { valid: false, error: 'Missing required fields: lat, lng, or timestamp' };
  }

  const lat = parseFloat(body.lat);
  const lng = parseFloat(body.lng);

  if (!validateCoordinates(lat, lng)) {
    return { valid: false, error: 'Invalid latitude or longitude values' };
  }

  return { valid: true };
}

// --- API Handlers ---

export async function POST(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const body = await request.json();

    // Validate input
    const validation = validateRainfallData(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const lat = parseFloat(body.lat);
    const lng = parseFloat(body.lng);

    // Prepare document
    const document = {
      location: {
        type: 'Point',
        coordinates: [lng, lat], // GeoJSON format: [longitude, latitude]
      },
      locationName: body.locationName || 'Clicked Location',
      timestamp: new Date(body.timestamp),
      radarStation: (body.radarStation || 'JAK').toUpperCase(),
      radarImage: body.radarImage || '',
      screenshot: body.screenshot || '',
      markers: body.markers || [],
      notes: body.notes || '',
      metadata: {
        radarTime: body.metadata?.radarTime || '',
        bounds: body.metadata?.bounds || null,
        zoom: body.metadata?.zoom || null,
        dbz: body.metadata?.dbz || 0,
        rainRate: body.metadata?.rainRate || 0,
        intensity: body.metadata?.intensity || 'No Rain',
        confidence: body.metadata?.confidence || 'Visual Estimate',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Insert document
    const collection = db.collection(COLLECTION_NAME);
    console.log('📝 Inserting to collection:', COLLECTION_NAME);
    console.log('📍 Document location:', document.location);

    const result = await collection.insertOne(document);

    console.log('✅ Insert successful. ID:', result.insertedId.toString());
    console.log('📊 Collection name:', collection.collectionName);

    return NextResponse.json({
      success: true,
      id: result.insertedId.toString(),
      message: 'Rainfall data saved successfully',
      data: {
        id: result.insertedId.toString(),
        location: document.location,
        timestamp: document.timestamp,
        intensity: document.metadata.intensity,
        rainRate: document.metadata.rainRate,
      },
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error saving rainfall data:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, error: 'Duplicate entry detected' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to save rainfall data', details: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const skip = Math.max(parseInt(searchParams.get('skip') || '0'), 0);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const radius = Math.min(parseFloat(searchParams.get('radius') || '10000'), 100000);
    const radarStation = searchParams.get('radarStation');
    const intensity = searchParams.get('intensity');

    // Build query
    const query: any = {};

    // Date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    // Radar station filter
    if (radarStation) {
      query.radarStation = radarStation.toUpperCase();
    }

    // Intensity filter
    if (intensity) {
      query['metadata.intensity'] = intensity;
    }

    // Geospatial query
    if (lat && lng) {
      const latNum = parseFloat(lat);
      const lngNum = parseFloat(lng);

      if (validateCoordinates(latNum, lngNum)) {
        query.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lngNum, latNum],
            },
            $maxDistance: radius,
          },
        };
      }
    }

    // Execute query
    const collection = db.collection(COLLECTION_NAME);

    const records = await collection
      .find(query, { projection: { screenshot: 0 } }) // Exclude large screenshot field
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collection.countDocuments(query);

    // Format response
    const formattedRecords = records.map((record: any) => ({
      id: record._id.toString(),
      location: record.location,
      locationName: record.locationName,
      timestamp: record.timestamp,
      radarStation: record.radarStation,
      markers: record.markers,
      notes: record.notes,
      metadata: record.metadata,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedRecords,
      pagination: {
        total,
        limit,
        skip,
        page: Math.floor(skip / limit) + 1,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    });

  } catch (error: any) {
    console.error('Error fetching rainfall data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rainfall data', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    // Validate ObjectId
    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid ID format' },
        { status: 400 }
      );
    }

    // Delete document
    const collection = db.collection(COLLECTION_NAME);
    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Record deleted successfully',
      id: id,
    });

  } catch (error: any) {
    console.error('Error deleting rainfall data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete rainfall data', details: error.message },
      { status: 500 }
    );
  }
}
