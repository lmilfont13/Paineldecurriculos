import { describe, expect, it } from "vitest";

import { DEFAULT_POST_DATA, socialJobPostSchema } from "./social-post.model";
import {
  balanceTitle,
  benefitCenters,
  cleanPosterText,
  posterBenefits,
  posterDisclaimer,
  posterInfoRows,
  posterTitle,
  wrapWords,
} from "./poster.model";

const measure = (t: string) => t.length * 10;
const empty = socialJobPostSchema.parse({ roleTitle: "Promotor" });

describe("posterTitle", () => {
  it("tira a cidade, cola o (A) e põe em caixa alta", () => {
    expect(posterTitle("Promotor (a) de Merchandising ( LIMOEIRO DO NORTE - CE )", "Limoeiro do Norte - CE")).toBe(
      "PROMOTOR(A) DE MERCHANDISING"
    );
    expect(posterTitle("Consultor(a) Merchan Jr", "Fortaleza - CE")).toBe("CONSULTOR(A) MERCHAN JR");
  });
});

describe("balanceTitle", () => {
  it("nunca separa o (A) da palavra e equilibra as linhas", () => {
    expect(balanceTitle("CONSULTOR(A) MERCHAN JR", measure)).toEqual(["CONSULTOR(A)", "MERCHAN JR"]);
    expect(balanceTitle("PROMOTOR(A) DE MERCHANDISING", measure)).toEqual(["PROMOTOR(A) DE", "MERCHANDISING"]);
    expect(balanceTitle("REPOSITOR", measure)).toEqual(["REPOSITOR"]);
  });
});

describe("wrapWords", () => {
  it("quebra em palavras inteiras", () => {
    expect(wrapWords("um dois tres quatro", 90, measure)).toEqual(["um dois", "tres", "quatro"]);
  });
});

describe("posterInfoRows", () => {
  it("só entra o que foi preenchido", () => {
    const rows = posterInfoRows({ ...empty, location: "Pacajus - CE", startDate: "", route: "" });
    expect(rows.map((r) => r.icon)).toEqual(["local"]);
  });
  it("o contrato vazio não vira 'Efetivo' (o padrão do formulário é vazio)", () => {
    expect(empty.contractType).toBe("");
  });
});

describe("posterBenefits", () => {
  it("vaga sem benefícios não mostra nenhum (antes os cinco vinham desenhados no fundo)", () => {
    expect(posterBenefits(empty)).toEqual([]);
  });
  it("só os preenchidos, na ordem do cartaz", () => {
    const b = posterBenefits({ ...empty, salary: "R$ 1.700,00", corporatePhone: "Aparelho corporativo" });
    expect(b.map((x) => [x.label, x.value])).toEqual([
      ["Salário:", "R$ 1.700,00"],
      ["APARELHO", "CORPORATIVO"],
    ]);
  });
  it("o exemplo completo continua com as cinco colunas", () => {
    expect(posterBenefits(DEFAULT_POST_DATA)).toHaveLength(5);
  });
  it("sem campos, usa a lista da IA ignorando itens vazios", () => {
    const b = posterBenefits({
      ...empty,
      benefitsList: [
        { id: "1", type: "transport", label: "Vale transporte", value: "Incluso", highlight: false },
        { id: "2", type: "health", label: "Convênio", value: "", highlight: false },
      ],
    });
    expect(b).toEqual([{ icon: "aid", label: "VALE TRANSPORTE", value: "Incluso", strongValue: false }]);
  });
});

describe("benefitCenters", () => {
  it("cinco colunas no lugar do original e menos colunas centralizadas", () => {
    expect(benefitCenters(5).map(Math.round)).toEqual([132, 336, 540, 744, 948]);
    expect(benefitCenters(1)).toEqual([540]);
    expect(benefitCenters(2).map(Math.round)).toEqual([437, 644]);
  });
});

describe("textos", () => {
  it("tira emoji e o 'Atenção:' repetido", () => {
    expect(cleanPosterText("Acesse o link! 👆")).toBe("Acesse o link!");
    expect(posterDisclaimer("⚠️ Atenção: Inscrições abertas!")).toBe("Inscrições abertas!");
  });
});
