import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const baseUrl = 'https://places.googleapis.com/v1';
const axiosInstance = axios.create({
  baseURL: baseUrl,
  timeout: 4000,
  headers: {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
  },
});

async function test() {
  const fieldMask = 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.internationalPhoneNumber,places.photos,places.editorialSummary,places.types,places.currentOpeningHours,places.googleMapsUri';
  
  const payload: any = {
    textQuery: 'Budapest tourist attractions',
  };

  payload.locationBias = {
    circle: {
      center: {
        latitude: 47.4979,
        longitude: 19.0402
      },
      radius: 5000
    }
  };

  try {
    const response = await axiosInstance.post('/places:searchText', payload, {
      headers: { 'X-Goog-FieldMask': fieldMask }
    });
    console.log("SUCCESS:", response.data.places?.length);
  } catch (e: any) {
    console.log("ERROR:", e.response?.data || e.message);
  }
}

test();
