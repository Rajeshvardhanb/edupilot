import { PAGES } from "./i18n-pages";

export const LANGS = { en: "English", hi: "हिन्दी", te: "తెలుగు" } as const;
export type Lang = keyof typeof LANGS;
export const LANG_COOKIE = "edupilot_lang";

/** Navigation and common interface labels. Data (names, subjects, notices) stays as entered. */
const DICT: Record<string, Record<Exclude<Lang, "en">, string>> = {
  Overview: { hi: "सारांश", te: "అవలోకనం" },
  People: { hi: "लोग", te: "వ్యక్తులు" },
  Academics: { hi: "शैक्षणिक", te: "విద్యా విభాగం" },
  Examinations: { hi: "परीक्षाएँ", te: "పరీక్షలు" },
  Campus: { hi: "परिसर", te: "క్యాంపస్" },
  Services: { hi: "सेवाएँ", te: "సేవలు" },
  System: { hi: "सिस्टम", te: "సిస్టమ్" },
  Dashboard: { hi: "डैशबोर्ड", te: "డాష్‌బోర్డ్" },
  Notices: { hi: "सूचनाएँ", te: "నోటీసులు" },
  Calendar: { hi: "कैलेंडर", te: "క్యాలెండర్" },
  Students: { hi: "विद्यार्थी", te: "విద్యార్థులు" },
  Faculty: { hi: "शिक्षक", te: "అధ్యాపకులు" },
  Admissions: { hi: "प्रवेश", te: "ప్రవేశాలు" },
  Timetable: { hi: "समय सारणी", te: "టైమ్‌టేబుల్" },
  Attendance: { hi: "उपस्थिति", te: "హాజరు" },
  "Leave & OD": { hi: "अवकाश", te: "సెలవు" },
  "Study material": { hi: "अध्ययन सामग्री", te: "స్టడీ మెటీరియల్" },
  Syllabus: { hi: "पाठ्यक्रम", te: "సిలబస్" },
  "Marks entry": { hi: "अंक प्रविष्टि", te: "మార్కుల నమోదు" },
  "Exam schedule": { hi: "परीक्षा कार्यक्रम", te: "పరీక్షల షెడ్యూల్" },
  "Hall tickets": { hi: "प्रवेश पत्र", te: "హాల్ టికెట్లు" },
  Results: { hi: "परिणाम", te: "ఫలితాలు" },
  Supplementary: { hi: "पूरक परीक्षा", te: "సప్లిమెంటరీ" },
  Electives: { hi: "वैकल्पिक विषय", te: "ఎలక్టివ్‌లు" },
  "Outcomes (CO-PO)": { hi: "परिणाम (CO-PO)", te: "ఫలితాలు (CO-PO)" },
  Feedback: { hi: "प्रतिक्रिया", te: "అభిప్రాయం" },
  Fees: { hi: "शुल्क", te: "ఫీజులు" },
  Scholarships: { hi: "छात्रवृत्ति", te: "స్కాలర్‌షిప్‌లు" },
  Placements: { hi: "प्लेसमेंट", te: "ప్లేస్‌మెంట్లు" },
  Library: { hi: "पुस्तकालय", te: "గ్రంథాలయం" },
  Hostel: { hi: "छात्रावास", te: "హాస్టల్" },
  Transport: { hi: "परिवहन", te: "రవాణా" },
  Certificates: { hi: "प्रमाण पत्र", te: "సర్టిఫికెట్లు" },
  Helpdesk: { hi: "सहायता", te: "హెల్ప్‌డెస్క్" },
  "ID card": { hi: "पहचान पत्र", te: "ఐడీ కార్డ్" },
  Administration: { hi: "प्रशासन", te: "పరిపాలన" },
  "My Profile": { hi: "मेरी प्रोफ़ाइल", te: "నా ప్రొఫైల్" },
  "Search students, pages…": { hi: "विद्यार्थी, पृष्ठ खोजें…", te: "విద్యార్థులు, పేజీలు వెతకండి…" },
  Notifications: { hi: "सूचनाएँ", te: "నోటిఫికేషన్లు" },
  "Sign out": { hi: "साइन आउट", te: "సైన్ అవుట్" },
  "Current term": { hi: "वर्तमान सत्र", te: "ప్రస్తుత టర్మ్" },
  Home: { hi: "होम", te: "హోమ్" },
  Language: { hi: "भाषा", te: "భాష" },
  // Student and parent screens
  "Overall attendance": { hi: "कुल उपस्थिति", te: "మొత్తం హాజరు" },
  "Active backlogs": { hi: "बकाया विषय", te: "బ్యాక్‌లాగ్‌లు" },
  "Fee due": { hi: "बकाया शुल्क", te: "బకాయి ఫీజు" },
  "Academic progress · SGPA by semester": { hi: "शैक्षणिक प्रगति · सेमेस्टर अनुसार SGPA", te: "విద్యా పురోగతి · సెమిస్టర్ వారీ SGPA" },
  "Attendance this term": { hi: "इस सत्र की उपस्थिति", te: "ఈ టర్మ్ హాజరు" },
  "Subject-wise attendance": { hi: "विषयवार उपस्थिति", te: "సబ్జెక్ట్ వారీ హాజరు" },
  "Fee summary": { hi: "शुल्क सारांश", te: "ఫీజు సారాంశం" },
  Payable: { hi: "देय राशि", te: "చెల్లించవలసినది" },
  Paid: { hi: "भुगतान किया", te: "చెల్లించినది" },
  Balance: { hi: "शेष राशि", te: "బ్యాలెన్స్" },
  "Notice board": { hi: "सूचना पट्ट", te: "నోటీసు బోర్డు" },
  "My attendance": { hi: "मेरी उपस्थिति", te: "నా హాజరు" },
  "Attendance calendar": { hi: "उपस्थिति कैलेंडर", te: "హాజరు క్యాలెండర్" },
  "Subject-wise": { hi: "विषयवार", te: "సబ్జెక్ట్ వారీగా" },
  Subject: { hi: "विषय", te: "సబ్జెక్ట్" },
  Attended: { hi: "उपस्थित", te: "హాజరైనవి" },
  Percentage: { hi: "प्रतिशत", te: "శాతం" },
  Status: { hi: "स्थिति", te: "స్థితి" },
  "Recent absences": { hi: "हाल की अनुपस्थिति", te: "ఇటీవలి గైర్హాజరు" },
  "My fees": { hi: "मेरा शुल्क", te: "నా ఫీజులు" },
  Payments: { hi: "भुगतान", te: "చెల్లింపులు" },
  "Pay now": { hi: "अभी भुगतान करें", te: "ఇప్పుడు చెల్లించండి" },
  "My academic record": { hi: "मेरा शैक्षणिक रिकॉर्ड", te: "నా విద్యా రికార్డు" },
  Credits: { hi: "क्रेडिट", te: "క్రెడిట్లు" },
  Internal: { hi: "आंतरिक", te: "ఇంటర్నల్" },
  External: { hi: "बाह्य", te: "ఎక్స్‌టర్నల్" },
  Total: { hi: "कुल", te: "మొత్తం" },
  Grade: { hi: "ग्रेड", te: "గ్రేడ్" },
  Code: { hi: "कोड", te: "కోడ్" },
  Semester: { hi: "सेमेस्टर", te: "సెమిస్టర్" },
  "Grade card": { hi: "ग्रेड कार्ड", te: "గ్రేడ్ కార్డ్" },
  "Mark all as read": { hi: "सभी को पढ़ा हुआ चिह्नित करें", te: "అన్నీ చదివినట్లు గుర్తించండి" },
  "My tasks": { hi: "मेरे कार्य", te: "నా పనులు" },
  Staff: { hi: "कर्मचारी", te: "సిబ్బంది" },
  Alumni: { hi: "पूर्व छात्र", te: "పూర్వ విద్యార్థులు" },
  Reports: { hi: "रिपोर्ट", te: "నివేదికలు" },
};

// Page-level strings live in their own file to keep this one readable.
Object.assign(DICT, PAGES);

export function translator(lang: Lang) {
  return (key: string) => (lang === "en" ? key : DICT[key]?.[lang] ?? key);
}

/** Plain map for client components (functions can't cross the server/client boundary). */
export function dictionary(lang: Lang): Record<string, string> {
  if (lang === "en") return {};
  return Object.fromEntries(Object.entries(DICT).map(([k, v]) => [k, v[lang]]));
}
