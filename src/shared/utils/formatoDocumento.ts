export const IDIOMAS_DOCUMENTO = ['es-CL', 'es-419', 'es-ES', 'pt-BR', 'en'] as const
export type IdiomaDocumento = (typeof IDIOMAS_DOCUMENTO)[number]

export const MONEDAS_DOCUMENTO = ['CLP', 'ARS', 'MXN', 'COP', 'PEN', 'USD', 'EUR'] as const
export type MonedaDocumento = (typeof MONEDAS_DOCUMENTO)[number]

export type ClaveDocumento =
  | 'patient' | 'rut' | 'issueDate' | 'professional' | 'prescription'
  | 'dosage' | 'frequency' | 'duration' | 'instructions'
  | 'budget' | 'quotation' | 'folio' | 'agreement' | 'validity'
  | 'odontogram' | 'piece' | 'treatment' | 'status' | 'value'
  | 'quotedTotal' | 'paymentsReceived' | 'balanceDue' | 'notesConditions'
  | 'sendToPatient' | 'approveVerbally' | 'reject' | 'print'
  | 'paymentReceipt' | 'receipt' | 'date' | 'method' | 'concept'
  | 'allocatedTo' | 'totalPaid' | 'thankYou' | 'cashier' | 'receivedBy'
  | 'detailPayment' | 'observation' | 'patientSignature' | 'cashSignature'
  | 'accordingToDirection' | 'days'
  | 'referral' | 'notReported' | 'issuingProfessional' | 'destinationSpecialty' | 'specialistCenter'
  | 'priority' | 'urgent' | 'normal' | 'diagnosis' | 'reasonFindings' | 'referencedRecords'
  | 'checkCurrentChart' | 'section' | 'currentOdontogram' | 'currentEvolutions' | 'file'
  | 'unavailableFiles' | 'noReferences' | 'documentNotice'

const TRADUCCIONES: Record<IdiomaDocumento, Record<ClaveDocumento, string>> = {
  'es-CL': {
    patient: 'Paciente', rut: 'RUT', issueDate: 'Fecha de emisión', professional: 'Profesional tratante',
    prescription: 'Rp. / Fármacos prescritos', dosage: 'Dosis', frequency: 'Frecuencia', duration: 'Duración', instructions: 'Indicaciones al paciente',
    budget: 'Presupuesto odontológico', quotation: 'Cotización de presupuesto', folio: 'Folio', agreement: 'Convenio / previsión', validity: 'Vigencia',
    odontogram: 'Estado de dentición registrado (odontograma clínico)', piece: 'Pieza', treatment: 'Tratamiento / prestación', status: 'Estado', value: 'Valor',
    quotedTotal: 'Total cotizado', paymentsReceived: 'Abonos registrados', balanceDue: 'Saldo pendiente', notesConditions: 'Notas / condiciones',
    sendToPatient: 'Enviar al paciente', approveVerbally: 'Aprobar verbalmente', reject: 'Rechazar', print: 'Imprimir',
    paymentReceipt: 'Comprobante de recaudación y pago', receipt: 'Recibo', date: 'Fecha', method: 'Medio de pago', concept: 'Concepto',
    allocatedTo: 'Imputado a', totalPaid: 'Total cancelado', thankYou: 'Gracias por su confianza', cashier: 'Cajero', receivedBy: 'Recibido por',
    detailPayment: 'Detalle del pago', observation: 'Observación', patientSignature: 'Firma del paciente', cashSignature: 'Recibido conforme / caja',
    accordingToDirection: 'Según indicación', days: 'días', referral: 'Ficha de derivación clínica', notReported: 'No informado',
    issuingProfessional: 'Profesional emisor', destinationSpecialty: 'Especialidad de destino', specialistCenter: 'Especialista o centro',
    priority: 'Prioridad', urgent: 'Urgente', normal: 'Normal', diagnosis: 'Diagnóstico', reasonFindings: 'Motivo y hallazgos',
    referencedRecords: 'Antecedentes referenciados', checkCurrentChart: 'Consultar en la ficha actual del paciente', section: 'Sección',
    currentOdontogram: 'Odontograma actual', currentEvolutions: 'Evoluciones de la ficha actual', file: 'Archivo',
    unavailableFiles: 'Archivos no disponibles', noReferences: 'Sin referencias seleccionadas',
    documentNotice: 'Documento informativo no firmado. Los antecedentes se consultan en la ficha clínica actual.',
  },
  'es-419': {
    patient: 'Paciente', rut: 'ID fiscal', issueDate: 'Fecha de emisión', professional: 'Profesional tratante',
    prescription: 'Rp. / Medicamentos prescritos', dosage: 'Dosis', frequency: 'Frecuencia', duration: 'Duración', instructions: 'Indicaciones para el paciente',
    budget: 'Presupuesto odontológico', quotation: 'Cotización del presupuesto', folio: 'Folio', agreement: 'Convenio / cobertura', validity: 'Vigencia',
    odontogram: 'Estado dental registrado (odontograma clínico)', piece: 'Pieza', treatment: 'Tratamiento / prestación', status: 'Estado', value: 'Valor',
    quotedTotal: 'Total cotizado', paymentsReceived: 'Pagos recibidos', balanceDue: 'Saldo pendiente', notesConditions: 'Notas / condiciones',
    sendToPatient: 'Enviar al paciente', approveVerbally: 'Aprobar verbalmente', reject: 'Rechazar', print: 'Imprimir',
    paymentReceipt: 'Comprobante de pago', receipt: 'Recibo', date: 'Fecha', method: 'Medio de pago', concept: 'Concepto',
    allocatedTo: 'Aplicado a', totalPaid: 'Total pagado', thankYou: 'Gracias por su confianza', cashier: 'Cajero', receivedBy: 'Recibido por',
    detailPayment: 'Detalle del pago', observation: 'Observación', patientSignature: 'Firma del paciente', cashSignature: 'Recibido conforme / caja',
    accordingToDirection: 'Según indicación', days: 'días', referral: 'Ficha de derivación clínica', notReported: 'No informado',
    issuingProfessional: 'Profesional emisor', destinationSpecialty: 'Especialidad de destino', specialistCenter: 'Especialista o centro',
    priority: 'Prioridad', urgent: 'Urgente', normal: 'Normal', diagnosis: 'Diagnóstico', reasonFindings: 'Motivo y hallazgos',
    referencedRecords: 'Antecedentes referenciados', checkCurrentChart: 'Consultar en la ficha actual del paciente', section: 'Sección',
    currentOdontogram: 'Odontograma actual', currentEvolutions: 'Evoluciones de la ficha actual', file: 'Archivo',
    unavailableFiles: 'Archivos no disponibles', noReferences: 'Sin referencias seleccionadas',
    documentNotice: 'Documento informativo no firmado. Los antecedentes se consultan en la ficha clínica actual.',
  },
  'es-ES': {
    patient: 'Paciente', rut: 'Identificación fiscal', issueDate: 'Fecha de emisión', professional: 'Profesional responsable',
    prescription: 'Rp. / Medicamentos prescritos', dosage: 'Dosis', frequency: 'Frecuencia', duration: 'Duración', instructions: 'Indicaciones para el paciente',
    budget: 'Presupuesto odontológico', quotation: 'Presupuesto', folio: 'Referencia', agreement: 'Convenio / cobertura', validity: 'Validez',
    odontogram: 'Estado dental registrado (odontograma clínico)', piece: 'Pieza', treatment: 'Tratamiento / prestación', status: 'Estado', value: 'Importe',
    quotedTotal: 'Total presupuestado', paymentsReceived: 'Pagos recibidos', balanceDue: 'Saldo pendiente', notesConditions: 'Notas / condiciones',
    sendToPatient: 'Enviar al paciente', approveVerbally: 'Aprobar verbalmente', reject: 'Rechazar', print: 'Imprimir',
    paymentReceipt: 'Justificante de pago', receipt: 'Recibo', date: 'Fecha', method: 'Método de pago', concept: 'Concepto',
    allocatedTo: 'Aplicado a', totalPaid: 'Total pagado', thankYou: 'Gracias por su confianza', cashier: 'Caja', receivedBy: 'Recibido por',
    detailPayment: 'Detalle del pago', observation: 'Observación', patientSignature: 'Firma del paciente', cashSignature: 'Recibido conforme / caja',
    accordingToDirection: 'Según indicación', days: 'días', referral: 'Ficha de derivación clínica', notReported: 'No informado',
    issuingProfessional: 'Profesional emisor', destinationSpecialty: 'Especialidad de destino', specialistCenter: 'Especialista o centro',
    priority: 'Prioridad', urgent: 'Urgente', normal: 'Normal', diagnosis: 'Diagnóstico', reasonFindings: 'Motivo y hallazgos',
    referencedRecords: 'Antecedentes referenciados', checkCurrentChart: 'Consultar en la ficha actual del paciente', section: 'Sección',
    currentOdontogram: 'Odontograma actual', currentEvolutions: 'Evoluciones de la ficha actual', file: 'Archivo',
    unavailableFiles: 'Archivos no disponibles', noReferences: 'Sin referencias seleccionadas',
    documentNotice: 'Documento informativo no firmado. Los antecedentes se consultan en la ficha clínica actual.',
  },
  'pt-BR': {
    patient: 'Paciente', rut: 'CPF / documento', issueDate: 'Data de emissão', professional: 'Profissional responsável',
    prescription: 'Rp. / Medicamentos prescritos', dosage: 'Dose', frequency: 'Frequência', duration: 'Duração', instructions: 'Orientações ao paciente',
    budget: 'Orçamento odontológico', quotation: 'Orçamento', folio: 'Número', agreement: 'Convênio / cobertura', validity: 'Validade',
    odontogram: 'Condição dentária registrada (odontograma clínico)', piece: 'Dente', treatment: 'Tratamento / procedimento', status: 'Status', value: 'Valor',
    quotedTotal: 'Total orçado', paymentsReceived: 'Pagamentos recebidos', balanceDue: 'Saldo pendente', notesConditions: 'Observações / condições',
    sendToPatient: 'Enviar ao paciente', approveVerbally: 'Aprovar verbalmente', reject: 'Rejeitar', print: 'Imprimir',
    paymentReceipt: 'Comprovante de pagamento', receipt: 'Recibo', date: 'Data', method: 'Forma de pagamento', concept: 'Descrição',
    allocatedTo: 'Vinculado a', totalPaid: 'Total pago', thankYou: 'Agradecemos a confiança', cashier: 'Caixa', receivedBy: 'Recebido por',
    detailPayment: 'Detalhes do pagamento', observation: 'Observação', patientSignature: 'Assinatura do paciente', cashSignature: 'Recebido / caixa',
    accordingToDirection: 'Conforme orientação', days: 'dias', referral: 'Ficha de encaminhamento clínico', notReported: 'Não informado',
    issuingProfessional: 'Profissional emissor', destinationSpecialty: 'Especialidade de destino', specialistCenter: 'Especialista ou clínica',
    priority: 'Prioridade', urgent: 'Urgente', normal: 'Normal', diagnosis: 'Diagnóstico', reasonFindings: 'Motivo e achados',
    referencedRecords: 'Registros referenciados', checkCurrentChart: 'Consultar o prontuário atual do paciente', section: 'Seção',
    currentOdontogram: 'Odontograma atual', currentEvolutions: 'Evoluções do prontuário atual', file: 'Arquivo',
    unavailableFiles: 'Arquivos indisponíveis', noReferences: 'Nenhuma referência selecionada',
    documentNotice: 'Documento informativo sem assinatura. Os registros podem ser consultados no prontuário atual do paciente.',
  },
  en: {
    patient: 'Patient', rut: 'Tax ID', issueDate: 'Issue date', professional: 'Treating professional',
    prescription: 'Rp. / Prescribed medication', dosage: 'Dosage', frequency: 'Frequency', duration: 'Duration', instructions: 'Patient instructions',
    budget: 'Dental treatment estimate', quotation: 'Treatment estimate', folio: 'Reference', agreement: 'Plan / coverage', validity: 'Validity',
    odontogram: 'Recorded dental status (clinical odontogram)', piece: 'Tooth', treatment: 'Treatment / service', status: 'Status', value: 'Amount',
    quotedTotal: 'Estimated total', paymentsReceived: 'Payments received', balanceDue: 'Balance due', notesConditions: 'Notes / terms',
    sendToPatient: 'Send to patient', approveVerbally: 'Approve verbally', reject: 'Reject', print: 'Print',
    paymentReceipt: 'Payment receipt', receipt: 'Receipt', date: 'Date', method: 'Payment method', concept: 'Description',
    allocatedTo: 'Applied to', totalPaid: 'Total paid', thankYou: 'Thank you for your trust', cashier: 'Cashier', receivedBy: 'Received by',
    detailPayment: 'Payment details', observation: 'Note', patientSignature: 'Patient signature', cashSignature: 'Received / cashier',
    accordingToDirection: 'As directed', days: 'days', referral: 'Clinical referral form', notReported: 'Not reported',
    issuingProfessional: 'Issuing professional', destinationSpecialty: 'Destination specialty', specialistCenter: 'Specialist or clinic',
    priority: 'Priority', urgent: 'Urgent', normal: 'Routine', diagnosis: 'Diagnosis', reasonFindings: 'Reason and findings',
    referencedRecords: 'Referenced records', checkCurrentChart: "See the patient's current chart", section: 'Section',
    currentOdontogram: 'Current odontogram', currentEvolutions: 'Current chart notes', file: 'File',
    unavailableFiles: 'Unavailable files', noReferences: 'No references selected',
    documentNotice: 'Informational document, not signed. Referenced records are available in the patient’s current chart.',
  },
}

export const resolverIdiomaDocumento = (idioma?: unknown): IdiomaDocumento =>
  IDIOMAS_DOCUMENTO.includes(idioma as IdiomaDocumento) ? idioma as IdiomaDocumento : 'es-CL'

export const resolverMonedaDocumento = (moneda?: unknown): MonedaDocumento =>
  MONEDAS_DOCUMENTO.includes(moneda as MonedaDocumento) ? moneda as MonedaDocumento : 'CLP'

export const traducirEtiquetaDocumento = (idioma: unknown, clave: ClaveDocumento): string =>
  TRADUCCIONES[resolverIdiomaDocumento(idioma)][clave]

export const formatearImporteDocumento = (
  importe: number | string | null | undefined,
  moneda?: unknown,
  idioma?: unknown,
): string => {
  const valor = Number(importe)
  const numero = Number.isFinite(valor) ? valor : 0
  return new Intl.NumberFormat(resolverIdiomaDocumento(idioma), {
    style: 'currency',
    currency: resolverMonedaDocumento(moneda),
    currencyDisplay: 'code',
  }).format(numero)
}
