/**
 * KML Parser for pump locations
 * Returns hardcoded pump station coordinates
 */

export interface PumpLocation {
  name: string
  lat: number
  lng: number
  description?: string
}

/**
 * Get pump locations from hardcoded list
 * Made this function async to match API route expectations
 */
export async function getPumpLocations(): Promise<PumpLocation[]> {
  return getHardcodedPumpLocations()
}

/**
 * Get pump locations from hardcoded list (fallback)
 */
export function getHardcodedPumpLocations(): PumpLocation[] {
  return [
    { name: "Rumah Pompa Pulomas 2", lat: -6.168055599999999, lng: 106.8808333, description: "Pump station Pulomas 2" },
    { name: "Rumah Pompa Kampung Ambon", lat: -6.1788889, lng: 106.8988889, description: "Pump station Kampung Ambon" },
    { name: "Rumah Pompa Kelinci", lat: -6.161388899999999, lng: 106.8375, description: "Pump station Kelinci" },
    {
      name: "Rumah Pompa Jembatan Merah",
      lat: -6.1494444,
      lng: 106.8347222,
      description: "Pump station Jembatan Merah",
    },
    { name: "Rumah Pompa Hayam Wuruk", lat: -6.1594444, lng: 106.8194444, description: "Pump station Hayam Wuruk" },
    { name: "Rumah Pompa Batu Ceper", lat: -6.1633, lng: 106.82, description: "Pump station Batu Ceper" },
    {
      name: "Rumah Pompa Green Garden",
      lat: -6.158333300000001,
      lng: 106.7602778,
      description: "Pump station Green Garden",
    },
    { name: "Rumah Pompa Kamal", lat: -6.0961734, lng: 106.7183362, description: "Pump station Polder Kamal" },
    { name: "Ruang Limpah Sungai Brigif", lat: -6.3511111, lng: 106.7983333, description: "Pump station RLS Brigif" },
    {
      name: "Pintu Air Pasar Ikan/Pakin",
      lat: -6.1283326,
      lng: 106.805917,
      description: "Pump station Pintu Air Pakin",
    },
    {
      name: "Ruang Limpah Sungai Pondok Ranggon",
      lat: -6.3380556,
      lng: 106.9177778,
      description: "Pump station Pondok Ranggon",
    },
    {
      name: "Rumah Pompa Telukgong",
      lat: -6.133645520597007,
      lng: 106.7778712339822,
      description: "Pump station Teluk Gong",
    },
    { name: "Rumah Pompa Bukit Duri 1", lat: -6.223906449801994, lng: 106.8651980347636 },
    { name: "Rumah Pompa Waduk Pluit", lat: -6.109587893238242, lng: 106.7967176335852 },
    { name: "Rumah Pompa Cideng", lat: -6.173347983888852, lng: 106.8063777136397 },
    { name: "Rumah Pompa Dewaruci", lat: -6.108332940862889, lng: 106.9218814431276 },
    { name: "Rumah Pompa Pinang", lat: -6.112265246347072, lng: 106.9037317017107 },
    { name: "Rumah Pompa Sunter Selatan", lat: -6.149889431815075, lng: 106.8611801473172 },
    { name: "Rumah Pompa Taman BMW", lat: -6.12684107764029, lng: 106.8545055514351 },
    { name: "Rumah Pompa Rawa Malang", lat: -6.127779021766349, lng: 106.9401438821179 },
    { name: "Rumah Pompa Kali Item", lat: -6.155156766341556, lng: 106.859460379957 },
    { name: "Rumah Pompa Pulomas 1", lat: -6.16690057171208, lng: 106.8814243287584 },
    { name: "Rumah Pompa Waduk Bojong Indah", lat: -6.160163771805825, lng: 106.7375715921876 },
    { name: "Rumah Pompa Wijaya Kusuma", lat: -6.154598942080172, lng: 106.7698480551546 },
    { name: "Rumah Pompa Tanjung Duren", lat: -6.173337274490633, lng: 106.7895207853486 },
    { name: "Waduk Lebak Bulus", lat: -6.299807747878253, lng: 106.7890031953335 },
    { name: "Rumah Pompa Bukit Duri 2", lat: -6.22056015192837, lng: 106.8630637540948 },
    { name: "Rumah Pompa Bukit Duri 8", lat: -6.217461155155786, lng: 106.8599389220821 },
    { name: "Rumah Pompa Bukit Duri 6", lat: -6.218122490841282, lng: 106.8616926642308 },
    { name: "Rumah Pompa Bukit Duri 3", lat: -6.22047494746874, lng: 106.8618388038947 },
    { name: "Rumah Pompa Bukit Duri 4", lat: -6.22008247348054, lng: 106.8592419078934 },
    { name: "Rumah Pompa Bukit Duri 7", lat: -6.216552443127356, lng: 106.8625409402699 },
    { name: "Rumah Pompa Bukit Duri 9", lat: -6.217256964631904, lng: 106.8583430909437 },
    { name: "Rumah Pompa Setiabudi Timur", lat: -6.204649199770714, lng: 106.8295595953325 },
    { name: "Rumah Pompa Kemang Raya 2", lat: -6.26360474259669, lng: 106.8158738366411 },
    { name: "Rumah Pompa Gaya Motor 2", lat: -6.139962530245941, lng: 106.8838831478398 },
    { name: "Rumah Pompa Sunter C", lat: -6.140144820593734, lng: 106.8570686046035 },
    { name: "Rumah Pompa KBN", lat: -6.146025344636846, lng: 106.9245249685864 },
    { name: "Ruang Limpah Greenville", lat: -6.163600625668501, lng: 106.769305854051 },
    { name: "Rumah Pompa Katulampa", lat: -6.633214648637848, lng: 106.8369770666501 },
    { name: "Pintu Air Tangki", lat: -6.14691949698571, lng: 106.8172137920673 },
    { name: "Rumah Pompa Bukit Duri 5", lat: -6.221097465021177, lng: 106.8599390717508 },
    { name: "Rumah Pompa Artha Gading", lat: -6.1438, lng: 106.8912 },
    { name: "Rumah Pompa Kali Betik", lat: -6.1371, lng: 106.8933 },
    { name: "Rumah Pompa Angkasa", lat: -6.1594, lng: 106.8372 },
    { name: "Rumah Pompa Mangga 2", lat: -6.1352159, lng: 106.831607 },
    { name: "Rumah Pompa Kali Asin", lat: -6.1113889, lng: 106.7727778 },
    { name: "Rumah Pompa Muara Angke", lat: -6.1075, lng: 106.7683333 },
  ]
}
