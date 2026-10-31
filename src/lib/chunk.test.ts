import { describe, expect, it } from "vitest";

import { chunk } from "@/lib/chunk";

describe("chunk", () => {
  it("divide em blocos do tamanho pedido, o último pode ser menor", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("lista vazia e tamanho maior que a lista", () => {
    expect(chunk([], 100)).toEqual([]);
    expect(chunk([1, 2], 100)).toEqual([[1, 2]]);
  });
  it("tamanho inválido não trava", () => {
    expect(chunk([1, 2, 3], 0)).toEqual([[1], [2], [3]]);
  });
});
