import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function test() {
  try {
    const res = await axios.post('https://places.googleapis.com/v1/places:searchText', {
      textQuery: 'Budapest tourist attractions',
      locationBias: {
        circle: {
          center: { latitude: 47.4979, longitude: 19.0402 },
          radius: 5000
        }
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': process.env.GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.internationalPhoneNumber,places.photos,places.editorialSummary,places.types,places.currentOpeningHours,places.googleMapsUri'
      }
    });
    console.log("SUCCESS:", res.data.places?.length);
  } catch (e: any) {
    console.log("ERROR:", e.response?.data || e.message);
  }
}
test();
