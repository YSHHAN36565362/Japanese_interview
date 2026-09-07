export interface ParsedResumeCareer {
  company: string
  role?: string
  department?: string
  duties?: string
  startYm?: string
  endYm?: string
}

export interface ParsedResumeEducation {
  school: string
  major?: string
  degree?: string
}

export interface ParsedResumeCertification {
  name: string
  date?: string
}

export interface ParsedResume {
  personal: {
    nameKanji?: string
    nameRomaji?: string
    nameKana?: string
    hobby?: string
    desiredJob?: string
    desiredDuty?: string
  }
  careers: ParsedResumeCareer[]
  education: ParsedResumeEducation[]
  certifications: ParsedResumeCertification[]
  techStack: string[]
  essays: {
    growth: string
    personality: string
    whyJapan: string
    whyProgram: string
    aspiration: string
  }
}

export interface ResumeParseError {
  error: 'invalid_template'
  message: string
  missingSections?: string[]
}
