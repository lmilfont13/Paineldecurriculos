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
  birthDateFormatted: string; // "08/11/1993"
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
 */
export function calculateTurningAge(birthDate: Date, now: Date = new Date()): number {
  const currentYear = now.getFullYear();
  const birthYear = birthDate.getUTCFullYear();
  return Math.max(0, currentYear - birthYear);
}

/**
 * Calcula a idade atual (antes ou depois do aniversário deste ano).
 */
export function calculateCurrentAge(birthDate: Date, now: Date = new Date()): number {
  const turning = calculateTurningAge(birthDate, now);
  const { day: bDay, month: bMonth } = getBirthDayMonth(birthDate);
  const nowDay = now.getDate();
  const nowMonth = now.getMonth();

  if (nowMonth < bMonth || (nowMonth === bMonth && nowDay < bDay)) {
    return Math.max(0, turning - 1);
  }
  return turning;
}

/**
 * Calcula quantos dias faltam para o próximo aniversário (0 = hoje, 1 = amanhã, até 365).
 */
export function getDaysUntilBirthday(birthDate: Date, now: Date = new Date()): number {
  const { day, month } = getBirthDayMonth(birthDate);
  const currentYear = now.getFullYear();

  // Próximo aniversário neste ano ou no próximo ano
  const thisYearBirthday = new Date(currentYear, month, day, 0, 0, 0, 0);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  let target = thisYearBirthday;
  if (thisYearBirthday.getTime() < today.getTime()) {
    target = new Date(currentYear + 1, month, day, 0, 0, 0, 0);
  }

  const diffMs = target.getTime() - today.getTime();
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

  return `Olá, ${titleFirstName}! 🎉🎂\n\nA equipe da *${company}* passa para desejar a você um *Feliz Aniversário*!\n\nQue este novo ciclo com ${turningAge} anos seja repleto de muitas realizações, saúde, paz e novas conquistas profissionais e pessoais.\n\nParabéns pelo seu dia especial! ✨🎈`;
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
  jobTitle: string;
  jobCode?: string | number | null;
};

/**
 * Consolida a lista de candidatos e agrupa em: Hoje, Nesta Semana e Neste Mês.
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

  const nowMonth = now.getMonth();
  const nowDay = now.getDate();

  for (const c of rawCandidates) {
    if (!c.birthDate) continue;
    const bDate = typeof c.birthDate === "string" ? new Date(c.birthDate) : c.birthDate;
    if (isNaN(bDate.getTime())) continue;

    const { day: bDay, month: bMonth } = getBirthDayMonth(bDate);
    const turning = calculateTurningAge(bDate, now);
    const current = calculateCurrentAge(bDate, now);
    const daysUntil = getDaysUntilBirthday(bDate, now);
    const isToday = daysUntil === 0 || (bDay === nowDay && bMonth === nowMonth);

    const pad = (n: number) => String(n).padStart(2, "0");
    const birthDateFormatted = `${pad(bDay)}/${pad(bMonth + 1)}/${bDate.getUTCFullYear()}`;
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
