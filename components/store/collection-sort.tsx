"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function CollectionSort({ value }: { value: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const changeSort = (nextValue: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue === "relevantes") params.delete("ordem");
    else params.set("ordem", nextValue);
    const query = params.toString();
    router.push(query ? `/produtos?${query}` : "/produtos");
  };

  return (
    <label className="tj-collection-sort">
      <span className="tj-visually-hidden">Ordenar por</span>
      <select value={value} onChange={(event) => changeSort(event.target.value)}>
        <option value="relevantes">Mais relevantes</option>
        <option value="menor-preco">Menor preço</option>
        <option value="maior-preco">Maior preço</option>
        <option value="a-z">A–Z</option>
      </select>
    </label>
  );
}
