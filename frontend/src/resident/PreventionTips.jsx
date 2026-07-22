import { useState, useEffect, useRef } from 'react';

const DISEASES = [
  {
    name: 'Dengue', icon: '🦟', color: '#ef4444', videoId: 'AxjL9T57svI',
    tips: [
      'Eliminate stagnant water where mosquitoes breed (flower pots, tires, cans).',
      'Use mosquito repellent and mosquito nets while sleeping.',
      'Wear long-sleeved clothing and pants, especially during dawn and dusk.',
      'Clean and scrub water containers at least once a week.',
      'Participate in community cleanup drives (Brigada Eskwela).',
      'Seek immediate medical help if fever persists for 2 days.',
      'Support fogging operations in your barangay during outbreaks.',
    ],
    symptoms: [
      'Do you have a sudden high fever (38°C or higher)?',
      'Do you have severe headache, especially behind the eyes?',
      'Do you have joint and muscle pain?',
      'Do you have nausea or vomiting?',
      'Do you have skin rashes or red spots on your body?',
      'Do you have bleeding from your gums or nose?',
      'Do you feel extreme fatigue or weakness?',
      'Do you have pain in your abdomen?',
    ],
  },
  {
    name: 'Diarrhea', icon: '💧', color: '#0ea5e9', videoId: 'OGIUigzPuew',
    tips: [
      'Wash hands thoroughly with soap and water before eating and after using the toilet.',
      'Drink only boiled or properly treated water.',
      'Avoid eating raw or undercooked food, especially seafood.',
      'Keep food covered and away from flies.',
      'Use oral rehydration solution (ORS) to prevent dehydration.',
      'Consult a doctor if diarrhea lasts more than 2 days.',
    ],
    symptoms: [
      'Do you have frequent watery bowel movements (3 or more per day)?',
      'Do you have abdominal cramps or pain?',
      'Do you feel nauseous or have vomiting?',
      'Do you have a fever?',
      'Do you feel thirsty or have dry mouth?',
      'Do you feel dizzy or lightheaded?',
    ],
  },
  {
    name: 'Covid-19', icon: '🛡️', color: '#3b82f6', videoId: '7tgm8KBlCtE',
    tips: [
      'Wear a mask in crowded or enclosed spaces.',
      'Wash hands frequently with soap and water or use alcohol-based sanitizer.',
      'Maintain physical distance from people with flu-like symptoms.',
      'Ensure proper ventilation in indoor spaces.',
      'Stay home if you feel unwell and avoid contact with others.',
      'Get vaccinated and stay updated with booster shots.',
      'Cover your mouth and nose when coughing or sneezing.',
    ],
    symptoms: [
      'Do you have fever or chills?',
      'Do you have a dry cough?',
      'Do you have difficulty breathing or shortness of breath?',
      'Do you have loss of taste or smell?',
      'Do you have sore throat?',
      'Do you have body aches or muscle pain?',
      'Do you feel extreme fatigue?',
    ],
  },
  {
    name: 'Leptospirosis', icon: '🐀', color: '#10b981', videoId: 'aqnpyMsvMbk',
    tips: [
      'Avoid wading or swimming in floodwaters.',
      'Wear protective boots and gloves when cleaning flood-damaged areas.',
      'Cover wounds with waterproof bandages before exposure to water.',
      'Control rat population in your home and community.',
      'Store food in rat-proof containers.',
      'Seek medical attention immediately if you develop fever after flood exposure.',
      'Clean and disinfect areas contaminated by rat urine.',
    ],
    symptoms: [
      'Do you have high fever?',
      'Do you have severe headache?',
      'Do you have muscle pain, especially in calves and lower back?',
      'Do you have red eyes?',
      'Do you have nausea or vomiting?',
      'Do you have jaundice (yellowing of skin or eyes)?',
      'Have you been exposed to floodwater recently?',
    ],
  },
  {
    name: 'Tuberculosis', icon: '🫁', color: '#f97316', videoId: 'vn44uL7qpUA',
    tips: [
      'Cover your mouth when coughing or sneezing.',
      'Ensure good ventilation in living and working spaces.',
      'Complete the full course of TB treatment if diagnosed.',
      'Wear a mask if you have a persistent cough.',
      'Avoid close contact with people who have active TB.',
      'Get tested if you have a cough lasting more than 2 weeks.',
      'Maintain a healthy diet to strengthen immune system.',
    ],
    symptoms: [
      'Do you have a cough that has lasted more than 2 weeks?',
      'Do you cough up blood or phlegm?',
      'Do you have chest pain when coughing or breathing?',
      'Do you have unexplained weight loss?',
      'Do you have night sweats?',
      'Do you have fever or chills in the afternoon?',
      'Do you feel weak or tired easily?',
    ],
  },
  {
    name: 'Typhoid Fever', icon: '🌡️', color: '#8b5cf6', videoId: 'kfmYf8u8U8A',
    tips: [
      'Drink only boiled or bottled water.',
      'Eat well-cooked food while it is still hot.',
      'Wash hands thoroughly before handling food.',
      'Avoid eating raw vegetables and fruits that cannot be peeled.',
      'Use separate utensils for raw and cooked food.',
      'Get vaccinated if traveling to high-risk areas.',
      'Practice proper sanitation and sewage disposal.',
    ],
    symptoms: [
      'Do you have a persistently high fever that increases gradually?',
      'Do you have headache?',
      'Do you have stomach pain or discomfort?',
      'Do you have constipation or diarrhea?',
      'Do you feel extremely weak or fatigued?',
      'Do you have loss of appetite?',
    ],
  },
  {
    name: 'Cholera', icon: '🌊', color: '#0ea5e9', videoId: 'areQVuj_48w',
    tips: [
      'Drink only boiled or chemically treated water.',
      'Wash hands with soap and water after using the toilet.',
      'Avoid raw or undercooked seafood.',
      'Keep food covered to protect from flies.',
      'Use oral rehydration solution (ORS) for mild symptoms.',
      'Seek immediate medical help for severe watery diarrhea.',
      'Ensure proper sewage disposal in your community.',
    ],
    symptoms: [
      'Do you have profuse watery diarrhea (rice-water stool)?',
      'Do you have vomiting?',
      'Do you feel extremely thirsty?',
      'Do you have muscle cramps?',
      'Do you feel weak or lethargic?',
      'Do you have dry skin or sunken eyes?',
    ],
  },
  {
    name: 'Measles', icon: '🔴', color: '#dc2626', videoId: 'KUn530zyhCA',
    tips: [
      'Get vaccinated with the MMR vaccine (2 doses).',
      'Isolate infected individuals to prevent spread.',
      'Practice good respiratory hygiene (cover coughs and sneezes).',
      'Wash hands frequently, especially after contact with an infected person.',
      'Clean and disinfect surfaces regularly.',
      'Ensure children complete their vaccination schedule.',
      'Avoid sharing utensils, cups, or towels with an infected person.',
    ],
    symptoms: [
      'Do you have high fever?',
      'Do you have a runny nose or nasal congestion?',
      'Do you have red, watery eyes (conjunctivitis)?',
      'Do you have a cough?',
      'Do you have a red rash that started on your face and spread downward?',
      'Do you have small white spots inside your mouth (Koplik spots)?',
    ],
  },
  {
    name: 'Hepatitis A', icon: '🫀', color: '#ca8a04', videoId: '1KXEmwmM_xs',
    tips: [
      'Wash hands thoroughly after using the toilet and before preparing food.',
      'Drink only clean, boiled water.',
      'Avoid eating raw or undercooked shellfish.',
      'Wash fruits and vegetables thoroughly before eating.',
      'Get vaccinated for Hepatitis A.',
      'Avoid sharing personal items like toothbrushes or razors.',
    ],
    symptoms: [
      'Do you have fatigue or extreme tiredness?',
      'Do you have nausea or vomiting?',
      'Do you have abdominal pain, especially on the right side?',
      'Do you have dark urine?',
      'Do you have jaundice (yellowing of skin or eyes)?',
      'Do you have loss of appetite?',
    ],
  },
  {
    name: 'Hepatitis B', icon: '🩸', color: '#b45309', videoId: 'a8-5mQG57Vc',
    tips: [
      'Get vaccinated with the Hepatitis B vaccine (3 doses).',
      'Avoid sharing needles, syringes, or personal grooming items.',
      'Practice safe sex by using condoms.',
      'Wear gloves when handling blood or bodily fluids.',
      'Ensure all tattoos and piercings are done with sterile equipment.',
      'Get tested if you are at risk or pregnant.',
    ],
    symptoms: [
      'Do you have abdominal pain or swelling?',
      'Do you have dark urine?',
      'Do you have jaundice (yellowing of skin or eyes)?',
      'Do you have joint pain?',
      'Do you feel nauseous or have vomiting?',
      'Do you have extreme fatigue that lasts for weeks?',
    ],
  },
  {
    name: 'Rabies', icon: '🐾', color: '#7c3aed', videoId: '', videoUrl: 'https://www.facebook.com/watch/?v=1058377798571868',
    tips: [
      'Vaccinate your pets against rabies annually.',
      'Avoid approaching or handling stray animals.',
      'Wash any animal bite wound immediately with soap and running water for 10-15 minutes.',
      'Seek medical attention immediately after any animal bite.',
      'Complete the full course of rabies vaccination if bitten.',
      'Report stray or aggressive animals to the barangay or city veterinarian.',
    ],
    symptoms: [
      'Were you bitten or scratched by an animal recently?',
      'Do you have tingling or itching at the wound site?',
      'Do you have fever?',
      'Do you have difficulty swallowing?',
      'Do you feel agitated or confused?',
      'Do you have muscle spasms when exposed to water (hydrophobia)?',
    ],
  },
  {
    name: 'Acute Respiratory Infection', icon: '🤧', color: '#6366f1', videoId: 'rDNE48wCbYU',
    tips: [
      'Wash hands frequently with soap and water.',
      'Avoid close contact with people who have cold or flu symptoms.',
      'Cover your mouth and nose when coughing or sneezing.',
      'Stay home when you are sick to prevent spreading infection.',
      'Keep your environment well-ventilated.',
      'Drink plenty of fluids and get adequate rest.',
      'Avoid smoking and second-hand smoke.',
    ],
    symptoms: [
      'Do you have a runny or stuffy nose?',
      'Do you have a sore throat?',
      'Do you have a cough?',
      'Do you have fever?',
      'Do you have difficulty breathing?',
      'Do you have body aches?',
    ],
  },
  {
    name: 'Avian Influenza', icon: '🐔', color: '#f59e0b', videoId: 'iAusO1XxhnQ',
    tips: [
      'Avoid contact with sick or dead birds.',
      'Cook poultry and eggs thoroughly before eating.',
      'Wash hands after handling raw poultry.',
      'Use separate cutting boards for raw poultry and other foods.',
      'Report unusual bird deaths to the local agriculture office.',
      'Wear protective gear if you work with poultry.',
      'Seek medical attention if you develop flu symptoms after contact with birds.',
    ],
    symptoms: [
      'Do you have high fever?',
      'Do you have a cough?',
      'Do you have difficulty breathing?',
      'Do you have sore throat?',
      'Do you have muscle aches?',
      'Have you had contact with sick or dead birds recently?',
    ],
  },
  {
    name: 'Chickenpox', icon: '🟠', color: '#f97316', videoId: 'jvNHpVB1JpY',
    tips: [
      'Get vaccinated with the varicella vaccine.',
      'Isolate infected individuals until all blisters have crusted over.',
      'Avoid scratching blisters to prevent scarring and infection.',
      'Wash hands frequently to prevent spread.',
      'Clean and disinfect contaminated surfaces.',
      'Pregnant women should avoid contact with infected individuals.',
    ],
    symptoms: [
      'Do you have an itchy rash with small blisters?',
      'Do you have fever?',
      'Do you feel tired or fatigued?',
      'Do you have loss of appetite?',
      'Do you have headache?',
      'Did the rash start on your face, chest, or back before spreading?',
    ],
  },
  {
    name: 'Diphtheria', icon: '🔵', color: '#2563eb', videoId: '', videoUrl: 'https://www.facebook.com/watch/?v=554657040414969',
    tips: [
      'Get vaccinated with the DPT vaccine (5 doses by age 6).',
      'Ensure children complete their vaccination schedule.',
      'Practice good respiratory hygiene.',
      'Avoid close contact with infected individuals.',
      'Seek medical help immediately if you have severe sore throat with difficulty breathing.',
    ],
    symptoms: [
      'Do you have a sore throat?',
      'Do you have difficulty swallowing?',
      'Do you have a thick gray coating on your throat or tonsils?',
      'Do you have difficulty breathing?',
      'Do you have fever?',
      'Do you have swollen glands in your neck?',
    ],
  },
  {
    name: 'Ebola', icon: '🦠', color: '#991b1b', videoId: '', videoUrl: 'https://www.facebook.com/reel/944081381802905',
    tips: [
      'Avoid contact with blood and bodily fluids of infected individuals.',
      'Practice strict hand hygiene.',
      'Avoid handling bats, monkeys, or other wild animals.',
      'Use protective equipment when caring for sick individuals.',
      'Report suspected cases immediately to health authorities.',
      'Follow quarantine and isolation protocols strictly.',
    ],
    symptoms: [
      'Do you have sudden high fever?',
      'Do you have severe headache?',
      'Do you have muscle pain?',
      'Do you have unexplained bleeding or bruising?',
      'Do you have vomiting or diarrhea?',
      'Do you have red eyes or skin rash?',
    ],
  },
  {
    name: 'Hand Foot and Mouth Disease', icon: '🖐️', color: '#ec4899', videoId: '14bA-jTc9jQ',
    tips: [
      'Wash hands frequently, especially after changing diapers.',
      'Clean and disinfect toys, doorknobs, and surfaces.',
      'Avoid close contact with infected children.',
      'Keep children home from school if they show symptoms.',
      'Cover mouth and nose when coughing or sneezing.',
      'Ensure proper disposal of diapers and tissues.',
    ],
    symptoms: [
      'Do you have fever?',
      'Do you have sore throat?',
      'Do you have painful red blisters in your mouth?',
      'Do you have a rash or blisters on your hands and feet?',
      'Do you have loss of appetite?',
      'Do you feel irritable or unwell?',
    ],
  },
  {
    name: 'Hepatitis C', icon: '🩺', color: '#92400e', videoId: 'x0WND-EVrTI',
    tips: [
      'Avoid sharing needles, syringes, or drug paraphernalia.',
      'Ensure blood products are screened before transfusion.',
      'Practice safe sex.',
      'Avoid sharing personal items like razors or toothbrushes.',
      'Wear gloves when handling blood or wounds.',
      'Get tested if you are at risk.',
    ],
    symptoms: [
      'Do you have fatigue?',
      'Do you have nausea or poor appetite?',
      'Do you have abdominal pain?',
      'Do you have dark urine?',
      'Do you have jaundice (yellowing of skin or eyes)?',
      'Do you have joint pain?',
    ],
  },
  {
    name: 'HIV/AIDS', icon: '🎗️', color: '#dc2626', videoId: 'pLUIkgvpy_U',
    tips: [
      'Practice safe sex: use condoms correctly every time.',
      'Get tested regularly for HIV.',
      'Avoid sharing needles or syringes.',
      'Take PrEP if you are at high risk.',
      'If living with HIV, take ART medication daily as prescribed.',
      'Support and reduce stigma for people living with HIV.',
    ],
    symptoms: [
      'Do you have persistent fever?',
      'Do you have swollen lymph nodes?',
      'Do you have unexplained weight loss?',
      'Do you have night sweats?',
      'Do you feel extreme fatigue?',
      'Do you have persistent diarrhea?',
    ],
  },
  {
    name: 'Influenza', icon: '🤒', color: '#f59e0b', videoId: 'wMUk5zSlzqY',
    tips: [
      'Get the annual flu vaccine.',
      'Wash hands frequently with soap and water.',
      'Cover your mouth and nose when coughing or sneezing.',
      'Stay home when you are sick.',
      'Avoid touching your eyes, nose, and mouth.',
      'Clean and disinfect frequently touched surfaces.',
      'Drink plenty of fluids and get adequate rest.',
    ],
    symptoms: [
      'Do you have sudden high fever?',
      'Do you have a dry cough?',
      'Do you have sore throat?',
      'Do you have body aches and muscle pain?',
      'Do you have headache?',
      'Do you feel extremely tired?',
    ],
  },
  {
    name: 'Influenza A', icon: '🦠', color: '#d97706', videoId: '', videoUrl: 'https://www.tiktok.com/@doc.emil/video/7070837730183269658',
    tips: [
      'Get vaccinated annually (flu vaccine covers Influenza A).',
      'Practice good respiratory hygiene.',
      'Wash hands frequently and thoroughly.',
      'Avoid crowded places during flu season.',
      'Stay home if you have flu symptoms.',
      'Take antiviral medications if prescribed by a doctor.',
    ],
    symptoms: [
      'Do you have sudden high fever (above 38°C)?',
      'Do you have a cough?',
      'Do you have sore throat?',
      'Do you have severe body aches?',
      'Do you have headache?',
      'Do you have chills and sweats?',
    ],
  },
  {
    name: 'Leprosy', icon: '🟤', color: '#78716c', videoId: 'LnS3mBfcPrE',
    tips: [
      'Early diagnosis and treatment prevent disability.',
      'Complete the full course of MDT (Multi-Drug Therapy).',
      'Do not isolate — leprosy is not highly contagious.',
      'Educate your community to reduce stigma.',
      'Regular check-ups for people in close contact with patients.',
    ],
    symptoms: [
      'Do you have pale or reddish skin patches?',
      'Do you have loss of sensation in the skin patches?',
      'Do you have numbness in your hands or feet?',
      'Do you have muscle weakness?',
      'Do you have skin lumps or thickening?',
      'Do you have painless ulcers or burns on your hands or feet?',
    ],
  },
  {
    name: 'Malaria', icon: '🦟', color: '#059669', videoId: '', videoUrl: 'https://www.facebook.com/CalambaMedicalCenter/videos/1006334831743202/',
    tips: [
      'Use mosquito nets while sleeping, especially in high-risk areas.',
      'Apply mosquito repellent on exposed skin.',
      'Wear long-sleeved clothing during evening hours.',
      'Eliminate mosquito breeding sites near your home.',
      'Take prophylactic medication if traveling to endemic areas.',
      'Seek treatment immediately if you develop fever with chills.',
    ],
    symptoms: [
      'Do you have fever that comes and goes (cyclic fever)?',
      'Do you have chills and shivering?',
      'Do you have sweating after fever episodes?',
      'Do you have headache?',
      'Do you have nausea or vomiting?',
      'Do you have muscle pain?',
    ],
  },
  {
    name: 'Meningococcemia', icon: '🔴', color: '#b91c1c', videoId: 'xTKpfNk5fP8',
    tips: [
      'Get vaccinated against meningococcal disease.',
      'Avoid close contact with infected individuals.',
      'Practice good respiratory hygiene.',
      'Do not share utensils, drinks, or personal items.',
      'Seek emergency medical help immediately if symptoms appear.',
      'Outbreaks require immediate public health response.',
    ],
    symptoms: [
      'Do you have sudden high fever?',
      'Do you have severe headache?',
      'Do you have a stiff neck?',
      'Do you have a purple-red rash that does not fade when pressed?',
      'Do you feel confused or disoriented?',
      'Are you sensitive to light?',
    ],
  },
  {
    name: 'Pertussis', icon: '🤧', color: '#7c3aed', videoId: 'riCFyEf2QNw',
    tips: [
      'Get vaccinated with the DPT vaccine.',
      'Ensure children complete their vaccination schedule.',
      'Pregnant women should get the Tdap vaccine.',
      'Cover your mouth and nose when coughing.',
      'Wash hands frequently.',
      'Keep infants away from people with coughing illness.',
    ],
    symptoms: [
      'Do you have a mild cough that has become severe over time?',
      'Do you have coughing fits followed by a "whooping" sound?',
      'Do you vomit after coughing?',
      'Do you turn blue or red during coughing fits?',
      'Do you feel exhausted after coughing episodes?',
      'Do you have a runny nose?',
    ],
  },
  {
    name: 'Poliomyelitis', icon: '🦵', color: '#ea580c', videoId: 'kmgf1LU00xY',
    tips: [
      'Ensure children complete the polio vaccination series.',
      'Practice good hand hygiene.',
      'Drink clean, treated water.',
      'Use proper sanitation facilities.',
      'Report suspected polio cases immediately.',
      'Support national immunization days.',
    ],
    symptoms: [
      'Do you have fever?',
      'Do you have fatigue?',
      'Do you have headache?',
      'Do you have stiffness in your neck or back?',
      'Do you have sudden weakness in your arms or legs?',
      'Do you have difficulty moving your limbs?',
    ],
  },
  {
    name: 'SARS', icon: '😷', color: '#6366f1', videoId: 'mhQVariR390',
    tips: [
      'Wear a mask in public places during outbreaks.',
      'Wash hands frequently and thoroughly.',
      'Avoid close contact with people showing respiratory symptoms.',
      'Ensure good ventilation in indoor spaces.',
      'Quarantine if exposed to a suspected case.',
      'Report symptoms immediately to health authorities.',
    ],
    symptoms: [
      'Do you have high fever (above 38°C)?',
      'Do you have a dry cough?',
      'Do you have difficulty breathing?',
      'Do you have headache?',
      'Do you have body aches?',
      'Do you feel extremely weak?',
    ],
  },
  {
    name: 'Sore Eyes', icon: '👁️', color: '#0ea5e9', videoId: 'jMJLweTwPZk',
    tips: [
      'Wash hands frequently, especially before touching your eyes.',
      'Avoid sharing towels, pillows, or eye makeup.',
      'Do not touch or rub your eyes.',
      'Clean eyeglasses and contact lenses properly.',
      'Replace eye makeup after an infection.',
      'Stay home from school or work if you have symptoms.',
    ],
    symptoms: [
      'Do you have red or pink eyes?',
      'Do you have itching or burning sensation in your eyes?',
      'Do you have watery or sticky discharge from your eyes?',
      'Do your eyes feel gritty or like something is in them?',
      'Are your eyelids swollen?',
      'Are you sensitive to light?',
    ],
  },
];

export default function PreventionTips() {
  const [expanded, setExpanded] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => { setExpanded(null); }, [search]);

  const [scStep, setScStep] = useState('pick'); // pick | quiz | result
  const [scDisease, setScDisease] = useState(null);
  const [scAnswers, setScAnswers] = useState({});
  const [scResult, setScResult] = useState(null);
  const quizRef = useRef(null);

  const filtered = DISEASES.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const startQuiz = (disease) => {
    setScDisease(disease);
    setScAnswers({});
    setScStep('quiz');
    setTimeout(() => {
      quizRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const answerQuestion = (idx, answer) => {
    setScAnswers(prev => ({ ...prev, [idx]: answer }));
  };

  const calculateResult = () => {
    const disease = DISEASES.find(d => d.name === scDisease);
    if (!disease) return;
    const total = disease.symptoms.length;
    const yesCount = Object.values(scAnswers).filter(a => a === true).length;
    const pct = Math.round((yesCount / total) * 100);
    setScResult(pct);
    setScStep('result');
  };

  const resetQuiz = () => {
    setScStep('pick');
    setScDisease(null);
    setScAnswers({});
    setScResult(null);
  };

  const getResultLevel = (pct) => {
    if (pct < 25) return { label: 'Low Likelihood', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', text: 'Your symptoms do not strongly match this disease. Stay observant and practice prevention measures.' };
    if (pct < 50) return { label: 'Moderate Risk', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', text: 'Your symptoms partially match this disease. Consider visiting a health center for a check-up.' };
    return { label: 'High Risk', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', text: 'Your symptoms strongly match this disease. Please go to the hospital immediately for evaluation.' };
  };

  return (
    <div>
      <h2 style={{ margin: '0 0 24px', fontSize: '24px', fontWeight: '700' }}>
        Prevention Tips
      </h2>

      <input
        type="text"
        placeholder="Search for a disease..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '12px 16px', border: '1px solid var(--border-color)',
          borderRadius: '10px', fontSize: '14px', marginBottom: '20px',
          outline: 'none', boxSizing: 'border-box',
        }}
      />

<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px', alignItems: 'start' }}>
    {filtered.map((disease, idx) => (
          <div key={disease.name} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '10px',
            overflow: 'hidden',
            gridColumn: expanded === idx ? '1 / -1' : 'auto',
          }}>
            <div
              onClick={() => setExpanded(expanded === idx ? null : idx)}
              style={{
                padding: '14px 18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
              <span style={{ fontSize: '24px' }}>{disease.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-main)' }}>{disease.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {disease.tips.length} prevention tips
                </div>
              </div>
              <span style={{ color: '#94a3b8', fontSize: '16px' }}>
                {expanded === idx ? '▲' : '▼'}
              </span>
            </div>
            {expanded === idx && (
              <div style={{ padding: '0 18px 16px', borderTop: '1px solid var(--border-color)' }}>
                <ul style={{ margin: '12px 0', paddingLeft: '18px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.8' }}>
                  {disease.tips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
                {disease.videoId && (
                  <div style={{ margin: '20px auto 16px', borderRadius: '10px', overflow: 'hidden', aspectRatio: '16 / 9', maxWidth: '600px' }}>
                    <iframe
                      width="100%"
                      height="100%"
                      src={`https://www.youtube.com/embed/${disease.videoId}`}
                      title={`${disease.name} prevention video`}
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                {!disease.videoId && disease.videoUrl && (
                  <a
                    href={disease.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      margin: '12px 0',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#1E3A8A',
                      color: '#fff',
                      fontSize: '13px',
                      fontWeight: 600,
                      textDecoration: 'none'
                    }}
                  >
                    ▶ Watch prevention video →
                  </a>
                )}
                <div style={{ marginTop: '8px', textAlign: 'right' }}>
                  <button onClick={(e) => { e.stopPropagation(); startQuiz(disease.name); }}
                    style={{
                      padding: '6px 16px', background: '#10B981', color: '#fff',
                      border: 'none', borderRadius: '6px', cursor: 'pointer',
                      fontSize: '17px', fontWeight: '600',
                    }}>
                    Symptom Checker
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── SYMPTOM CHECKER ── */}
      <div ref={quizRef} style={{
        marginTop: '40px', background: 'var(--bg-surface)',
        border: '2px solid #10B981', borderRadius: '14px',
        overflow: 'hidden',
      }}>
        <div style={{
          background: '#10B981', padding: '16px 24px', color: '#fff',
        }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
            🩺 Symptom Checker
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
            Select a disease and answer a few questions to assess your risk level.
          </p>
        </div>

        <div style={{ padding: '24px' }}>
          {scStep === 'pick' && (
            <div>
              <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Choose a disease to check your symptoms against:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
                {DISEASES.map(d => (
                  <button key={d.name} onClick={() => startQuiz(d.name)}
                    style={{
                      padding: '10px 14px', background: 'var(--bg-main)', border: '1px solid var(--border-color)',
                      borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      fontSize: '13px', color: 'var(--text-main)', fontWeight: '500',
                      transition: 'all 0.15s',
                    }}>
                    {d.icon} {d.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {scStep === 'quiz' && scDisease && (() => {
            const disease = DISEASES.find(d => d.name === scDisease);
            if (!disease) return null;
            const answeredCount = Object.keys(scAnswers).length;
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: 'var(--text-main)' }}>
                    {disease.icon} {disease.name} - Symptom Check
                  </h4>
                  <button onClick={resetQuiz}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}>
                    ← Pick another disease
                  </button>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Answer Yes or No to each question ({answeredCount}/{disease.symptoms.length} answered).
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {disease.symptoms.map((q, idx) => (
                    <div key={idx} style={{
                      padding: '12px 16px', background: 'var(--bg-main)', borderRadius: '8px',
                      border: scAnswers[idx] !== undefined ? '1px solid #10B981' : '1px solid var(--border-color)',
                    }}>
                      <div style={{ fontSize: '14px', color: 'var(--text-main)', marginBottom: '8px' }}>
                        {idx + 1}. {q}
                      </div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => answerQuestion(idx, true)}
                          style={{
                            padding: '6px 20px', borderRadius: '6px', border: '1px solid',
                            borderColor: scAnswers[idx] === true ? '#22c55e' : 'var(--border-color)',
                            background: scAnswers[idx] === true ? 'rgba(34,197,94,0.12)' : 'var(--bg-surface)',
                            color: scAnswers[idx] === true ? '#16a34a' : 'var(--text-muted)',
                            fontWeight: scAnswers[idx] === true ? '600' : '400',
                            cursor: 'pointer', fontSize: '13px',
                          }}>
                          Yes
                        </button>
                        <button onClick={() => answerQuestion(idx, false)}
                          style={{
                            padding: '6px 20px', borderRadius: '6px', border: '1px solid',
                            borderColor: scAnswers[idx] === false ? '#ef4444' : 'var(--border-color)',
                            background: scAnswers[idx] === false ? 'rgba(239,68,68,0.12)' : 'var(--bg-surface)',
                            color: scAnswers[idx] === false ? '#dc2626' : 'var(--text-muted)',
                            fontWeight: scAnswers[idx] === false ? '600' : '400',
                            cursor: 'pointer', fontSize: '13px',
                          }}>
                          No
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <button onClick={calculateResult}
                    disabled={answeredCount < disease.symptoms.length}
                    style={{
                      padding: '12px 40px', background: answeredCount < disease.symptoms.length ? '#94a3b8' : '#10B981',
                      color: '#fff', border: 'none', borderRadius: '8px',
                      fontSize: '15px', fontWeight: '700', cursor: answeredCount < disease.symptoms.length ? 'not-allowed' : 'pointer',
                    }}>
                    {answeredCount < disease.symptoms.length
                      ? `Answer all questions (${answeredCount}/${disease.symptoms.length})`
                      : 'See Result'}
                  </button>
                </div>
              </div>
            );
          })()}

          {scStep === 'result' && scResult !== null && scDisease && (() => {
            const level = getResultLevel(scResult);
            return (
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: '120px', height: '120px', borderRadius: '50%',
                  margin: '0 auto 16px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '32px', fontWeight: '800',
                  background: level.bg, border: `4px solid ${level.color}`,
                  color: level.color,
                }}>
                  {scResult}%
                </div>
                <h4 style={{ fontSize: '20px', fontWeight: '700', margin: '0 0 8px', color: level.color }}>
                  {level.label}
                </h4>
                <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 20px', lineHeight: '1.6' }}>
                  {level.text}
                </p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button onClick={() => { resetQuiz(); }}
                    style={{
                      padding: '10px 24px', background: '#10B981', color: '#fff',
                      border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                    }}>
                    Try Another Disease
                  </button>
                  <button onClick={() => window.location.href = '/Resident/contact'}
                    style={{
                      padding: '10px 24px', background: 'var(--input-bg)', color: 'var(--text-muted)',
                      border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
                    }}>
                    Contact Us
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
