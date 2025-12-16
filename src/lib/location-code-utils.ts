// File: lib/location-code-utils.ts

// Daftar Valid Location Codes (Referensi)
export const validLocationCodes = [
  "katulampa",
  "psdepok",
  "pamanggarai",
  "sodetanciliwung",
  "pskrukuthulu",
  "pakaret",
  "wadukpluit",
  "papasarikan",
  "pamarina",
  "jembatanmerah",
  "pintuairtangki",
  "istiqlal",
  "pscipinanghulu",
  "pssunterhulu",
  "papulogadung",
  "paflushingancol",
  "wijayakusuma",
  "cideng",
  "greengarden",
  "setiabuditimur",
  "angkasa",
  "batuceper",
  "sunterselatan",
  "kaliitem",
  "tamanbmw",
  "dewaruci",
  "arthagading",
  "pulomas"
];

export function getLocationCode(dbName: string): string | null {
  if (!dbName) return null;

  // 1. Normalisasi dasar: lowercase, hapus spasi & simbol
  const cleanName = dbName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // --- 2. MAPPING KHUSUS (Manual) ---

  // Kasus Pasar Ikan / Pakin -> papasarikan
  if (cleanName.includes('pakin') || cleanName.includes('pasarikan')) {
      return "papasarikan";
  }

  // Kasus Marina -> pamarina
  if (cleanName.includes('marina')) {
      return "pamarina";
  }

  // Kasus Manggarai (Termasuk Ciliwung Lama) -> pamanggarai
  if (cleanName.includes('manggarai')) {
      return "pamanggarai";
  }

  // --- 3. PENCARIAN DI DAFTAR VALID ---
  for (const code of validLocationCodes) {
    const cleanCode = code.replace(/[^a-z0-9]/g, '');

    // Hapus prefix umum dari nama DB agar pencocokan lebih akurat
    const cleanNameNoPrefix = cleanName
      .replace('rumahpompa', '')
      .replace('pintuair', 'pa')
      .replace('pos', 'ps');

    if (cleanNameNoPrefix.includes(cleanCode) || cleanCode.includes(cleanNameNoPrefix)) {
      return code;
    }
  }

  // --- 4. FALLBACK OTOMATIS (Generator) ---
  // Jika tidak ada di daftar valid, buat kode sendiri dengan format serupa
  // Contoh: "Rumah Pompa Teluk Gong" -> "telukgong"
  // Contoh: "Pintu Air Cengkareng" -> "pacengkareng"

  const generatedCode = cleanName
      .replace('rumahpompa', '')   // Hapus kata 'rumahpompa'
      .replace('pintuair', 'pa')   // Singkat 'pintuair' jadi 'pa'
      .replace('pos', 'ps')        // Singkat 'pos' jadi 'ps'
      .replace('stasiun', '');     // Hapus 'stasiun'

  return generatedCode;
}
