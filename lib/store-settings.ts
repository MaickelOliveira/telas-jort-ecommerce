import "server-only";
import { getStoredStoreSettings } from "@/lib/database";

export type StoreSettings = {
  name: string;
  cnpj: string;
  email: string;
  phone: string;
  whatsapp: string;
  postalCode: string;
  address: string;
  number: string;
  district: string;
  city: string;
  state: string;
  instagram: string;
  largeOrderQuantityThreshold: string;
};

export const defaultStoreSettings: StoreSettings = {
  name: "Telas Jort",
  cnpj: "15.496.207/0001-76",
  email: "contato@telasjort.com.br",
  phone: "(44) 99157-2075",
  whatsapp: "5544991572075",
  postalCode: "87308-830",
  address: "Av. Cap. Índio Bandeira",
  number: "2554",
  district: "Centro",
  city: "Campo Mourão",
  state: "PR",
  instagram: "https://instagram.com/telasjort",
  largeOrderQuantityThreshold: "",
};

export async function getStoreSettings(): Promise<StoreSettings> {
  const stored = await getStoredStoreSettings();
  if (!stored) return defaultStoreSettings;
  const safe = Object.fromEntries(Object.entries(stored).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  return { ...defaultStoreSettings, ...safe };
}
