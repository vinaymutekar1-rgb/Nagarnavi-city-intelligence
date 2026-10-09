/**
 * Curated DEMO dataset.
 *
 * Every record here is explicitly labelled `demo` and is rendered with a
 * "Demo" badge. It exists so the product is demonstrable when a public
 * provider (Overpass) is rate-limited. It deliberately contains NO invented
 * ratings, prices, opening hours, or safety claims — only well-known place
 * names, categories and approximate coordinates.
 */

export interface DemoPlace {
  id: string
  name: string
  category: 'attraction' | 'restaurant' | 'hotel' | 'heritage' | 'park' | 'market'
  city: string
  latitude: number
  longitude: number
  address: string | null
  source: 'demo'
}

export interface DemoCity {
  name: string
  aliases: string[]
  latitude: number
  longitude: number
  zoom: number
}

export const DEMO_CITIES: DemoCity[] = [
  { name: 'Pune', aliases: ['pune', 'poona'], latitude: 18.5204, longitude: 73.8567, zoom: 12 },
  { name: 'Mumbai', aliases: ['mumbai', 'bombay'], latitude: 19.076, longitude: 72.8777, zoom: 12 },
  { name: 'Delhi', aliases: ['delhi', 'new delhi', 'ncr'], latitude: 28.6139, longitude: 77.209, zoom: 12 },
  { name: 'Bengaluru', aliases: ['bengaluru', 'bangalore'], latitude: 12.9716, longitude: 77.5946, zoom: 12 },
  { name: 'Hyderabad', aliases: ['hyderabad'], latitude: 17.385, longitude: 78.4867, zoom: 12 },
  { name: 'Chennai', aliases: ['chennai', 'madras'], latitude: 13.0827, longitude: 80.2707, zoom: 12 },
  { name: 'Kolkata', aliases: ['kolkata', 'calcutta'], latitude: 22.5726, longitude: 88.3639, zoom: 12 },
  { name: 'Jaipur', aliases: ['jaipur'], latitude: 26.9124, longitude: 75.7873, zoom: 12 },
  { name: 'Solapur', aliases: ['solapur', 'sholapur'], latitude: 17.6599, longitude: 75.9064, zoom: 12 },
]

export const DEMO_PLACES: DemoPlace[] = [
  // ---- Pune ----
  { id: 'demo-pune-1', name: 'Shaniwar Wada', category: 'heritage', city: 'Pune', latitude: 18.5195, longitude: 73.8553, address: 'Shaniwar Peth, Pune', source: 'demo' },
  { id: 'demo-pune-2', name: 'Aga Khan Palace', category: 'heritage', city: 'Pune', latitude: 18.5524, longitude: 73.9011, address: 'Nagar Road, Yerawada, Pune', source: 'demo' },
  { id: 'demo-pune-3', name: 'Parvati Hill & Temple', category: 'heritage', city: 'Pune', latitude: 18.4993, longitude: 73.8467, address: 'Parvati, Pune', source: 'demo' },
  { id: 'demo-pune-4', name: 'Pataleshwar Cave Temple', category: 'heritage', city: 'Pune', latitude: 18.5261, longitude: 73.8496, address: 'Shivajinagar, Pune', source: 'demo' },
  { id: 'demo-pune-5', name: 'Raja Dinkar Kelkar Museum', category: 'attraction', city: 'Pune', latitude: 18.5103, longitude: 73.8545, address: 'Natu Baug, Shukrawar Peth, Pune', source: 'demo' },
  { id: 'demo-pune-6', name: 'Dagdusheth Halwai Ganpati Temple', category: 'heritage', city: 'Pune', latitude: 18.5162, longitude: 73.856, address: 'Budhwar Peth, Pune', source: 'demo' },
  { id: 'demo-pune-7', name: 'Saras Baug', category: 'park', city: 'Pune', latitude: 18.5009, longitude: 73.851, address: 'Swargate, Pune', source: 'demo' },
  { id: 'demo-pune-8', name: 'Empress Garden', category: 'park', city: 'Pune', latitude: 18.515, longitude: 73.886, address: 'Camp, Pune', source: 'demo' },
  { id: 'demo-pune-9', name: 'Kamala Nehru Park', category: 'park', city: 'Pune', latitude: 18.5085, longitude: 73.8202, address: 'Deccan Gymkhana, Pune', source: 'demo' },
  { id: 'demo-pune-10', name: 'Rajiv Gandhi Zoological Park (Katraj)', category: 'attraction', city: 'Pune', latitude: 18.4529, longitude: 73.858, address: 'Katraj, Pune', source: 'demo' },
  { id: 'demo-pune-11', name: 'Sinhagad Fort', category: 'heritage', city: 'Pune', latitude: 18.3663, longitude: 73.7559, address: 'Sinhagad, Pune', source: 'demo' },
  { id: 'demo-pune-12', name: 'Mahatma Phule Mandai (Market)', category: 'market', city: 'Pune', latitude: 18.5147, longitude: 73.8564, address: 'Shukrawar Peth, Pune', source: 'demo' },
  { id: 'demo-pune-13', name: 'FC Road (Fergusson College Road)', category: 'market', city: 'Pune', latitude: 18.5236, longitude: 73.8426, address: 'Shivajinagar, Pune', source: 'demo' },
  { id: 'demo-pune-14', name: 'Koregaon Park', category: 'park', city: 'Pune', latitude: 18.5362, longitude: 73.8939, address: 'Koregaon Park, Pune', source: 'demo' },
  { id: 'demo-pune-15', name: 'Bund Garden', category: 'park', city: 'Pune', latitude: 18.534, longitude: 73.883, address: 'Bund Garden Road, Pune', source: 'demo' },
  { id: 'demo-pune-16', name: 'Vaishali (FC Road)', category: 'restaurant', city: 'Pune', latitude: 18.5231, longitude: 73.842, address: 'Fergusson College Road, Pune', source: 'demo' },
  { id: 'demo-pune-17', name: 'Cafe Goodluck', category: 'restaurant', city: 'Pune', latitude: 18.5246, longitude: 73.8415, address: 'Deccan Gymkhana, Pune', source: 'demo' },
  { id: 'demo-pune-18', name: 'Roopali Restaurant', category: 'restaurant', city: 'Pune', latitude: 18.5237, longitude: 73.8419, address: 'FC Road, Pune', source: 'demo' },
  { id: 'demo-pune-19', name: 'Sujata Mastani', category: 'restaurant', city: 'Pune', latitude: 18.5065, longitude: 73.8425, address: 'Sadashiv Peth, Pune', source: 'demo' },
  { id: 'demo-pune-20', name: 'Durga Coffee House', category: 'restaurant', city: 'Pune', latitude: 18.5074, longitude: 73.8075, address: 'Kothrud, Pune', source: 'demo' },
  { id: 'demo-pune-21', name: 'JW Marriott Hotel Pune', category: 'hotel', city: 'Pune', latitude: 18.5355, longitude: 73.8834, address: 'Senapati Bapat Road, Pune', source: 'demo' },
  { id: 'demo-pune-22', name: 'The Westin Pune Koregaon Park', category: 'hotel', city: 'Pune', latitude: 18.5382, longitude: 73.8939, address: 'Koregaon Park, Pune', source: 'demo' },
  { id: 'demo-pune-23', name: 'Hyatt Regency Pune', category: 'hotel', city: 'Pune', latitude: 18.5607, longitude: 73.9135, address: 'Weikfield IT Park, Nagar Road, Pune', source: 'demo' },
  { id: 'demo-pune-24', name: 'Pune Camp Market (MG Road)', category: 'market', city: 'Pune', latitude: 18.5158, longitude: 73.8793, address: 'Camp, MG Road, Pune', source: 'demo' },

  // ---- Mumbai ----
  { id: 'demo-mum-1', name: 'Gateway of India', category: 'heritage', city: 'Mumbai', latitude: 18.922, longitude: 72.8347, address: 'Colaba, Mumbai', source: 'demo' },
  { id: 'demo-mum-2', name: 'Chhatrapati Shivaji Maharaj Terminus', category: 'heritage', city: 'Mumbai', latitude: 18.9398, longitude: 72.8355, address: 'Fort, Mumbai', source: 'demo' },
  { id: 'demo-mum-3', name: 'Marine Drive', category: 'attraction', city: 'Mumbai', latitude: 18.9433, longitude: 72.8235, address: 'Netaji Subhash Chandra Bose Road, Mumbai', source: 'demo' },
  { id: 'demo-mum-4', name: 'Sanjay Gandhi National Park', category: 'park', city: 'Mumbai', latitude: 19.2147, longitude: 72.9106, address: 'Borivali East, Mumbai', source: 'demo' },
  { id: 'demo-mum-5', name: 'Chor Bazaar', category: 'market', city: 'Mumbai', latitude: 18.9582, longitude: 72.8276, address: 'Bhendi Bazaar, Mumbai', source: 'demo' },
  { id: 'demo-mum-6', name: 'Haji Ali Dargah', category: 'heritage', city: 'Mumbai', latitude: 18.9827, longitude: 72.8089, address: 'Worli, Mumbai', source: 'demo' },

  // ---- Delhi ----
  { id: 'demo-del-1', name: 'Red Fort', category: 'heritage', city: 'Delhi', latitude: 28.6562, longitude: 77.241, address: 'Netaji Subhash Marg, Delhi', source: 'demo' },
  { id: 'demo-del-2', name: 'Qutub Minar', category: 'heritage', city: 'Delhi', latitude: 28.5245, longitude: 77.1855, address: 'Mehrauli, Delhi', source: 'demo' },
  { id: 'demo-del-3', name: 'Humayun\u2019s Tomb', category: 'heritage', city: 'Delhi', latitude: 28.5933, longitude: 77.2507, address: 'Nizamuddin East, Delhi', source: 'demo' },
  { id: 'demo-del-4', name: 'India Gate', category: 'attraction', city: 'Delhi', latitude: 28.6129, longitude: 77.2295, address: 'Rajpath, Delhi', source: 'demo' },
  { id: 'demo-del-5', name: 'Lodhi Garden', category: 'park', city: 'Delhi', latitude: 28.5931, longitude: 77.2197, address: 'Lodhi Road, Delhi', source: 'demo' },
  { id: 'demo-del-6', name: 'Chandni Chowk', category: 'market', city: 'Delhi', latitude: 28.6506, longitude: 77.2303, address: 'Old Delhi', source: 'demo' },

  // ---- Bengaluru ----
  { id: 'demo-blr-1', name: 'Lalbagh Botanical Garden', category: 'park', city: 'Bengaluru', latitude: 12.9507, longitude: 77.5848, address: 'Mavalli, Bengaluru', source: 'demo' },
  { id: 'demo-blr-2', name: 'Cubbon Park', category: 'park', city: 'Bengaluru', latitude: 12.9763, longitude: 77.5929, address: 'Sampangi Rama Nagar, Bengaluru', source: 'demo' },
  { id: 'demo-blr-3', name: 'Bangalore Palace', category: 'heritage', city: 'Bengaluru', latitude: 12.9987, longitude: 77.5921, address: 'Vasanth Nagar, Bengaluru', source: 'demo' },
  { id: 'demo-blr-4', name: 'Tipu Sultan\u2019s Summer Palace', category: 'heritage', city: 'Bengaluru', latitude: 12.9597, longitude: 77.5736, address: 'Chamarajpet, Bengaluru', source: 'demo' },
  { id: 'demo-blr-5', name: 'Commercial Street', category: 'market', city: 'Bengaluru', latitude: 12.9822, longitude: 77.6086, address: 'Shivaji Nagar, Bengaluru', source: 'demo' },
]
