export interface ProtocoloUrgenciaGes {
  id: string
  titulo: string
  estado: 'validado'
  pasos: readonly string[]
}

/** Texto transcrito del BP14; el responsable clínico del proyecto informó que validó su contenido. */
export const PROTOCOLOS_URGENCIA_GES: readonly ProtocoloUrgenciaGes[] = [
  {
    id: 'pulpitis', titulo: '1. Pulpitis', estado: 'validado', pasos: [
      'Pulpitis irreversible',
      'Diagnóstico: Pruebas pulpares (frío, EPT), Rx periapical',
      'Anestesia: Lidocaína 2% + Epinefrina 1:100.000 (BP11 #1)',
      'Apertura cameral: Acceso endodóntico de urgencia',
      'Extirpación pulpar: Pulpotomía o pulpectomía parcial',
      'Medicación: Hidróxido de calcio (BP11 #90)',
      'Obturación provisoria: Óxido de zinc eugenol (BP11 #91)',
      'Analgesia: Paracetamol 1g + Ibuprofeno 600mg sinérgico',
      'Derivación: Citar a endodoncia definitiva en 7-14 días'
    ]
  },
  {
    id: 'absceso_odontogenico_localizado', titulo: '2. Absceso localizado', estado: 'validado', pasos: [
      'Absceso submucoso/subperióstico/apical',
      'Diagnóstico: Clínico + Rx periapical',
      'Drenaje: Por vía endodóntica o incisión y drenaje',
      'Antibióticos: Amoxicilina 500mg c/8h 7 días (BP11 #31)',
      'Si alergia a penicilina: Clindamicina 300mg c/8h (BP11 #39)',
      'Si infección anaerobia: Agregar Metronidazol 500mg c/8h (BP11 #44)',
      'Analgesia: Ibuprofeno 600mg c/8h + Paracetamol 1g c/8h',
      'Enjuague: Clorhexidina 0.12% c/12h (BP11 #63)',
      'Control: 48-72 horas para evaluar evolución'
    ]
  },
  {
    id: 'absceso_espacios_bucomaxilofaciales', titulo: '3. Absceso de espacios profundos', estado: 'validado', pasos: [
      'Angina de Ludwig / Celulitis facial severa',
      'Signos de alarma: Edema cervical extenso, disnea, disfagia, trismo severo',
      'Estabilización inicial: Oxígeno (BP11 urgencia #9), monitoreo signos vitales',
      'Antibióticos IV: Clindamicina 600mg IV (BP11 #40) si disponible',
      'DERIVACIÓN INMEDIATA: Llamar ambulancia (131) o traslado',
      'Ficha de derivación: Generar PDF con todos los datos clínicos',
      'Comunicación: Notificar a hospital receptor'
    ]
  },
  {
    id: 'pericoronaritis_aguda', titulo: '4. Pericoronaritis aguda', estado: 'validado', pasos: [
      'Pericoronaritis (terceros molares)',
      'Diagnóstico: Clínico + Rx panorámica',
      'Irrigación: Suero fisiológico o Clorhexidina bajo el colgajo',
      'Antibióticos: Amoxicilina 500mg c/8h + Metronidazol 500mg c/8h 7d',
      'Analgesia: Ibuprofeno 600mg c/8h',
      'Enjuague: Clorhexidina 0.12% c/12h',
      'Control: 48 horas para re-evaluar',
      'Tratamiento definitivo: Exodoncia del tercer molar cuando resuelva la fase aguda'
    ]
  },
  {
    id: 'flegmones_orofaringeos', titulo: '5. Flegmones orofaríngeos', estado: 'validado', pasos: [
      'Flegmón orofaríngeo de origen odontogénico',
      'Reconocer urgencia vital: Compromiso vía aérea potencial',
      'Posición: Semi-sentado, oxígeno si SatO2 <94%',
      'Vía IV: Si disponible, iniciar hidratación',
      'Antibióticos IV: Clindamicina 600mg IV o Ampicilina/Sulbactam',
      'DERIVACIÓN INMEDIATA: Hospital con servicio de Cirugía Maxilofacial',
      'Llamar 131: Ambulancia de emergencia',
      'Acompañar: Ficha completa + Rx + medicamentos administrados'
    ]
  },
  {
    id: 'gingivitis_ulcero_necrotizante', titulo: '6. Gingivitis úlcero-necrotizante (GUN)', estado: 'validado', pasos: [
      'GUN (Vincent)',
      'Diagnóstico: Clínico característico (úlceras + pseudomembrana + halitosis)',
      'Desbridamiento: Suave con curetas, remover pseudomembranas',
      'Irrigación: Peróxido de hidrógeno 3% diluido al 50% (BP11 #66)',
      'Antibióticos: Metronidazol 500mg c/8h 7 días (BP11 #44)',
      'PROHIBIDO: Alcohol durante tratamiento (efecto disulfiram)',
      'Enjuague: Clorhexidina 0.12% c/12h',
      'Analgesia: Paracetamol 500mg-1g c/8h',
      'Control: 48 horas. Repetir desbridamiento si necesario'
    ]
  },
  {
    id: 'complicaciones_post_exodoncia', titulo: '7. Complicaciones post-exodoncia', estado: 'validado', pasos: [
      'Manejo hemorrágico',
      'Compresión con gasa 20-30 min',
      'Ácido tranexámico 500mg oral (BP11 #71)',
      'Gelfoam en alvéolo (BP11 #74)',
      'Suturas herméticas si necesario',
      'Evitar AINEs (preferir Paracetamol)',
      'Verificar si paciente anticoagulado (BP11 manejo_anticoagulantes)',
      'Alveolitis seca',
      'Irrigación suave con suero fisiológico',
      'Remover detritos del alvéolo',
      'Pasta obturante alveolar (Alvogyl)',
      'Analgesia potente: Ketorolaco 10mg sublingual (BP11 #17)',
      'No ATB salvo signos de infección',
      'Control 24-48h para reemplazar pasta'
    ]
  },
  {
    id: 'traumatismo_dentoalveolar', titulo: '8. Traumatismo dentoalveolar', estado: 'validado', pasos: [
      'Trauma dental',
      'Fractura coronaria no complicada: Pulir bordes + resina si disponible',
      'Fractura con exposición pulpar: Pulpotomía + hidróxido de calcio (BP11 #90)',
      'Subluxación: Dieta blanda 2 semanas + control',
      'Luxación extrusiva/lateral: Reposición + férula semi-rígida 2 semanas',
      'Avulsión: Reimplantación inmediata si <60 min + férula 2-4 semanas',
      'Fractura radicular: Férula 4 semanas + evaluar extracción si tercio cervical',
      'Todos los casos: Control a 2 semanas, 1 mes, 3 meses, 6 meses, 1 año',
      'Antibióticos: Solo si contaminación severa o tejidos blandos comprometidos'
    ]
  }
]
