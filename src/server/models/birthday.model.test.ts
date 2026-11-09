import { describe, expect, it } from "vitest";

import {
  calculateCurrentAge,
  calculateTurningAge,
  getDaysUntilBirthday,
  generateBirthdayGreeting,
  buildBirthdayWhatsAppUrl,
  buildCompanyBirthdays,
  type RawCandidateForBirthday,
} from "./birthday.model";

describe("birthday.model", () => {
  const referenceNow = new Date(2026, 10, 8); // 08 de novembro de 2026

  it("calcula idade que está completando e idade atual corretamente", () => {
    // Nasceu em 08/11/1993 (hoje faz aniversário de 33 anos)
    const bToday = new Date("1993-11-08T00:00:00.000Z");
    expect(calculateTurningAge(bToday, referenceNow)).toBe(33);
    expect(calculateCurrentAge(bToday, referenceNow)).toBe(33);

    // Nasceu em 20/11/1993 (vai fazer 33 anos no final do mês, hoje tem 32)
    const bLater = new Date("1993-11-20T00:00:00.000Z");
    expect(calculateTurningAge(bLater, referenceNow)).toBe(33);
    expect(calculateCurrentAge(bLater, referenceNow)).toBe(32);

    // Nasceu em 01/01/1990 (já fez 36 anos este ano)
    const bEarlier = new Date("1990-01-01T00:00:00.000Z");
    expect(calculateTurningAge(bEarlier, referenceNow)).toBe(36);
    expect(calculateCurrentAge(bEarlier, referenceNow)).toBe(36);
  });

  it("calcula dias até o próximo aniversário", () => {
    // Hoje
    const bToday = new Date("1995-11-08T00:00:00.000Z");
    expect(getDaysUntilBirthday(bToday, referenceNow)).toBe(0);

    // Amanhã (09/11)
    const bTomorrow = new Date("1995-11-09T00:00:00.000Z");
    expect(getDaysUntilBirthday(bTomorrow, referenceNow)).toBe(1);

    // Daqui a 5 dias (13/11)
    const bIn5Days = new Date("1998-11-13T00:00:00.000Z");
    expect(getDaysUntilBirthday(bIn5Days, referenceNow)).toBe(5);
  });

  it("gera mensagem de parabéns personalizada com nome e idade", () => {
    const msg = generateBirthdayGreeting("Jessica Silva de Lima", "Empresa Exemplo", 33);
    expect(msg).toContain("Olá, Jessica!");
    expect(msg).toContain("Empresa Exemplo");
    expect(msg).toContain("33 anos");
    expect(msg).toContain("Feliz Aniversário");
  });

  it("gera link wa.me válido com telefone brasileiro", () => {
    const url = buildBirthdayWhatsAppUrl("(85) 98888-1111", "Jessica Silva", "Target Varejo", 33);
    expect(url).not.toBeNull();
    expect(url).toContain("https://wa.me/5585988881111?text=");
    expect(url).toContain(encodeURIComponent("Olá, Jessica!"));
  });

  it("agrupa candidatos em Hoje, Nesta Semana e Neste Mês", () => {
    const candidates: RawCandidateForBirthday[] = [
      {
        id: "app-1",
        name: "Jessica Silva de Lima",
        email: "jessica@exemplo.com",
        phone: "85988881111",
        photoUrl: null,
        birthDate: new Date("1993-11-08T00:00:00.000Z"), // Hoje
        jobTitle: "Promotor de Vendas",
      },
      {
        id: "app-2",
        name: "Carlos Andrade",
        email: "carlos@exemplo.com",
        phone: "85977772222",
        photoUrl: null,
        birthDate: new Date("1990-11-12T00:00:00.000Z"), // Em 4 dias (nesta semana)
        jobTitle: "Operador de Caixa",
      },
      {
        id: "app-3",
        name: "Mariana Souza",
        email: "mariana@exemplo.com",
        phone: "85966663333",
        photoUrl: null,
        birthDate: new Date("2000-11-28T00:00:00.000Z"), // No final do mês
        jobTitle: "Repositora",
      },
      {
        id: "app-4",
        name: "Pedro Lima",
        email: "pedro@exemplo.com",
        phone: "85955554444",
        photoUrl: null,
        birthDate: new Date("1996-03-15T00:00:00.000Z"), // Outro mês
        jobTitle: "Auxiliar",
      },
    ];

    const data = buildCompanyBirthdays(candidates, "Empresa Modelo", referenceNow);

    expect(data.today).toHaveLength(1);
    expect(data.today[0].name).toBe("Jessica Silva de Lima");
    expect(data.today[0].isToday).toBe(true);
    expect(data.today[0].turningAge).toBe(33);

    expect(data.thisWeek).toHaveLength(1);
    expect(data.thisWeek[0].name).toBe("Carlos Andrade");
    expect(data.thisWeek[0].daysUntil).toBe(4);

    expect(data.thisMonth).toHaveLength(3); // Jessica, Carlos, Mariana
  });

  it("corrige ano suspeito (ex: 2026) resgatando a idade real do texto do currículo", () => {
    const rawCandidate: RawCandidateForBirthday = {
      id: "app-maria-julia",
      name: "Maria Julia de Maria Araújo",
      email: "mariajulia@exemplo.com",
      phone: "85999999999",
      photoUrl: null,
      birthDate: new Date("2026-11-09T00:00:00.000Z"), // Data com ano 2026 (suspeito)
      resumeText: "Maria Julia de Maria Araújo\n23 anos, Solteira\nTelefone: (85) 99999-9999\nPromotora de Vendas",
      jobTitle: "Promotor(a) de Vendas",
    };

    // No domingo à noite em Fortaleza (08/11 21:50 BRT -> 09/11 00:50 UTC)
    const sundayNightUtc = new Date("2026-11-09T00:50:00.000Z");
    const data = buildCompanyBirthdays([rawCandidate], "Tarhget Fortaleza", sundayNightUtc);

    // No Brasil ainda é dia 8, então o aniversário (dia 9) é AMANHÃ!
    expect(data.today).toHaveLength(0);
    expect(data.thisWeek).toHaveLength(1);
    expect(data.thisWeek[0].isToday).toBe(false);
    expect(data.thisWeek[0].daysUntil).toBe(1); // Amanhã
    expect(data.thisWeek[0].turningAge).toBe(23); // Idade resgatada do currículo, nunca 0!
    expect(data.thisWeek[0].dayMonthFormatted).toBe("9 de novembro");
    expect(data.thisWeek[0].greetingMessage).toContain("com 23 anos");
  });
});

