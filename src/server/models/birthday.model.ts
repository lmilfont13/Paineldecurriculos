import { titleCasePt } from "@/server/models/text.model";
import { formatPhone } from "@/lib/phone";

export type BirthdayCandidate = {
  id: string; // Application ID
  candidateId?: string | null;
  name: string;
  email: string;
  phone: string | null;
  phoneFormatted: string;
  photoUrl: string | null;
  birthDate: Date;
  birthDateFormatted: string; // "08/11/1993" ou "08/11"
  dayMonthFormatted: string; // "8 de novembro"
  currentAge: number;
  turningAge: number;
  isToday: boolean;
  daysUntil: number; // 0 = hoje, 1 = amanhã, etc.
  jobTitle: string;
  jobCode?: string | number | null;
  whatsappUrl: string | null;
  greetingMessage: string;
};

export type CompanyBirthdaysData = {
  companyName: string;
  today: BirthdayCandidate[];
  thisWeek: BirthdayCandidate[];
  thisMonth: BirthdayCandidate[];
  upcoming: BirthdayCandidate[];
  totalWithBirthday: number;
};

const MONTH_NAMES_PT = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

/**
 * Converte qualquer Date para o horário oficial de Brasília (America/Sao_Paulo / UTC-3),
 * garantindo que à noite no Brasil o sistema nunca avance prematuramente para o dia seguinte
 * por causa do fuso horário UTC de servidores na nuvem.
 */
export function getNowInBrazil(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dateInBrazil: Date;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const getPart = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const year = getPart("year") || now.getFullYear();
  const month = (getPart("month") || now.getMonth() + 1) - 1; // 0-indexed
  const day = getPart("day") || now.getDate();
  return {
    year,
    month,
    day,
    dateInBrazil: new Date(year, month, day, 0, 0, 0, 0),
  };
}

/**
 * Extrai a idade expressa no texto do currículo do candidato (ex: "24 anos", "Idade: 23 anos"),
 * fundamental quando o ano de nascimento não foi preenchido ou foi salvo incorretamente.
 */
export function extractAgeFromResume(text: string | null | undefined): number | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, " ");

  // 1. "Idade: 24 anos" ou "Idade: 24"
  const m1 = clean.match(/\bidade\s*[:\-–]?\s*(\d{2})\s*(?:anos)?\b/i);
  if (m1) {
    const age = Number(m1[1]);
    if (age >= 14 && age <= 100) return age;
  }

  // 2. "Solteira, 24 anos", "Brasileira, 22 anos", "Maria Julia, 23 anos"
  const m2 = clean.match(/(?:solteir[oa]|casad[oa]|divorciad[oa]|brasileir[oa]|\b)\s*,?\s*(\d{2})\s*anos\b/i);
  if (m2) {
    const age = Number(m2[1]);
    if (age >= 14 && age <= 100) return age;
  }

  // 3. Menção a "\b(\d{2}) anos\b" no cabeçalho dos primeiros 1000 caracteres (dados pessoais)
  const header = clean.slice(0, 1000);
  const m3 = header.match(/\b(\d{2})\s*anos\b/i);
  if (m3) {
    const age = Number(m3[1]);
    if (age >= 14 && age <= 100) return age;
  }

  return null;
}

/**
 * Retorna o dia e mês da data de nascimento de forma segura (lendo em UTC para datas salvas à meia-noite).
 */
export function getBirthDayMonth(date: Date): { day: number; month: number } {
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
  };
}

/**
 * Calcula a idade que o aniversariante está completando neste ano.
 * Se o ano for inválido (ex: 2026, 0, etc.), resgata a idade do currículo.
 */
export function calculateTurningAge(
  birthDate: Date,
  now: Date = new Date(),
  resumeText?: string | null
): number {
  const nowBr = getNowInBrazil(now);
  const currentYear = nowBr.year;
  const birthYear = birthDate.getUTCFullYear();

  if (birthYear >= 1920 && birthYear <= currentYear - 14) {
    return Math.max(0, currentYear - birthYear);
  }

  if (resumeText) {
    const ageFromCv = extractAgeFromResume(resumeText);
    if (ageFromCv && ageFromCv >= 14 && ageFromCv <= 100) {
      return ageFromCv;
    }
  }

  return 0;
}

/**
 * Calcula a idade atual (antes ou depois do aniversário deste ano).
 */
export function calculateCurrentAge(
  birthDate: Date,
  now: Date = new Date(),
  resumeText?: string | null
): number {
  const turning = calculateTurningAge(birthDate, now, resumeText);
  if (turning <= 0) return 0;

  const { day: bDay, month: bMonth } = getBirthDayMonth(birthDate);
  const nowBr = getNowInBrazil(now);

  if (nowBr.month < bMonth || (nowBr.month === bMonth && nowBr.day < bDay)) {
    return Math.max(0, turning - 1);
  }
  return turning;
}

/**
 * Calcula quantos dias faltam para o próximo aniversário baseado no horário oficial do Brasil
 * (0 = hoje, 1 = amanhã, até 365).
 */
export function getDaysUntilBirthday(birthDate: Date, now: Date = new Date()): number {
  const { day, month } = getBirthDayMonth(birthDate);
  const nowBr = getNowInBrazil(now);
  const currentYear = nowBr.year;

  // Próximo aniversário neste ano ou no próximo ano baseado no horário do Brasil
  const thisYearBirthday = new Date(currentYear, month, day, 0, 0, 0, 0);
  const todayBr = new Date(currentYear, nowBr.month, nowBr.day, 0, 0, 0, 0);

  let target = thisYearBirthday;
  if (thisYearBirthday.getTime() < todayBr.getTime()) {
    target = new Date(currentYear + 1, month, day, 0, 0, 0, 0);
  }

  const diffMs = target.getTime() - todayBr.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Gera mensagem cordial, calorosa e profissional de parabéns para o WhatsApp da empresa.
 */
export function generateBirthdayGreeting(
  candidateName: string,
  companyName: string,
  turningAge: number
): string {
  const firstName = candidateName.trim().split(/\s+/)[0] || "Candidato";
  const titleFirstName = titleCasePt(firstName);
  const company = companyName.trim() || "Nossa Empresa";

  const ageText = turningAge > 0 ? ` com ${turningAge} anos` : "";

  return `Olá, ${titleFirstName}! 🎉🎂\n\nA equipe da *${company}* passa para desejar a você um *Feliz Aniversário*!\n\nQue este novo ciclo${ageText} seja repleto de muitas realizações, saúde, paz e novas conquistas profissionais e pessoais.\n\nParabéns pelo seu dia especial! ✨🎈`;
}

/**
 * Constrói o link direto wa.me para abrir o WhatsApp Web ou App já com a mensagem preenchida.
 */
export function buildBirthdayWhatsAppUrl(
  phone: string | null | undefined,
  candidateName: string,
  companyName: string,
  turningAge: number
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;

  // Garante DDI 55 do Brasil se tiver 10 ou 11 dígitos
  const fullPhone = digits.length <= 11 ? `55${digits}` : digits;
  const msg = generateBirthdayGreeting(candidateName, companyName, turningAge);
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
}

export type RawCandidateForBirthday = {
  id: string;
  candidateId?: string | null;
  name: string;
  email: string;
  phone: string | null;
  photoUrl: string | null;
  birthDate: Date | string | null;
  resumeText?: string | null;
  jobTitle: string;
  jobCode?: string | number | null;
};

/**
 * Consolida a lista de candidatos e agrupa em: Hoje, Nesta Semana e Neste Mês
 * respeitando estritamente o horário oficial do Brasil.
 */
export function buildCompanyBirthdays(
  rawCandidates: RawCandidateForBirthday[],
  companyName: string,
  now: Date = new Date()
): CompanyBirthdaysData {
  const todayCandidates: BirthdayCandidate[] = [];
  const thisWeekCandidates: BirthdayCandidate[] = [];
  const thisMonthCandidates: BirthdayCandidate[] = [];
  const upcomingCandidates: BirthdayCandidate[] = [];

  const nowBr = getNowInBrazil(now);
  const nowMonth = nowBr.month;
  const nowDay = nowBr.day;

  for (const c of rawCandidates) {
    if (!c.birthDate) continue;
    let bDate = typeof c.birthDate === "string" ? new Date(c.birthDate) : c.birthDate;
    if (isNaN(bDate.getTime())) continue;

    const { day: bDay, month: bMonth } = getBirthDayMonth(bDate);
    const birthYear = bDate.getUTCFullYear();

    // Se o ano gravado for suspeito (ex: 2026, menor que 1920 ou futuro), tenta resolver pelo currículo
    if (birthYear > nowBr.year - 14 || birthYear < 1920) {
      const ageFromCv = extractAgeFromResume(c.resumeText);
      if (ageFromCv) {
        const inferredYear = nowBr.year - ageFromCv;
        bDate = new Date(Date.UTC(inferredYear, bMonth, bDay, 12));
      }
    }

    const turning = calculateTurningAge(bDate, now, c.resumeText);
    const current = calculateCurrentAge(bDate, now, c.resumeText);
    const daysUntil = getDaysUntilBirthday(bDate, now);
    const isToday = daysUntil === 0 && bDay === nowDay && bMonth === nowMonth;

    const pad = (n: number) => String(n).padStart(2, "0");
    const displayYear = bDate.getUTCFullYear();
    const hasValidYear = displayYear >= 1920 && displayYear <= nowBr.year - 14;
    const birthDateFormatted = hasValidYear
      ? `${pad(bDay)}/${pad(bMonth + 1)}/${displayYear}`
      : `${pad(bDay)}/${pad(bMonth + 1)}`;
    const dayMonthFormatted = `${bDay} de ${MONTH_NAMES_PT[bMonth]}`;
    const greetingMessage = generateBirthdayGreeting(c.name, companyName, turning);
    const whatsappUrl = buildBirthdayWhatsAppUrl(c.phone, c.name, companyName, turning);

    const candidateItem: BirthdayCandidate = {
      id: c.id,
      candidateId: c.candidateId,
      name: titleCasePt(c.name),
      email: c.email,
      phone: c.phone,
      phoneFormatted: formatPhone(c.phone) || c.phone || "—",
      photoUrl: c.photoUrl,
      birthDate: bDate,
      birthDateFormatted,
      dayMonthFormatted,
      currentAge: current,
      turningAge: turning,
      isToday,
      daysUntil,
      jobTitle: c.jobTitle,
      jobCode: c.jobCode,
      whatsappUrl,
      greetingMessage,
    };

    if (isToday) {
      todayCandidates.push(candidateItem);
    } else if (daysUntil <= 7) {
      thisWeekCandidates.push(candidateItem);
    }

    if (bMonth === nowMonth) {
      thisMonthCandidates.push(candidateItem);
    } else {
      upcomingCandidates.push(candidateItem);
    }
  }

  // Ordena por proximidade dos dias
  const sortByDays = (a: BirthdayCandidate, b: BirthdayCandidate) => a.daysUntil - b.daysUntil;
  todayCandidates.sort(sortByDays);
  thisWeekCandidates.sort(sortByDays);
  thisMonthCandidates.sort(sortByDays);
  upcomingCandidates.sort(sortByDays);

  return {
    companyName,
    today: todayCandidates,
    thisWeek: thisWeekCandidates,
    thisMonth: thisMonthCandidates,
    upcoming: upcomingCandidates,
    totalWithBirthday:
      todayCandidates.length +
      thisWeekCandidates.length +
      upcomingCandidates.filter((u) => !thisMonthCandidates.includes(u)).length,
  };
}
