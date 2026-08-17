import { createContext, useContext } from "react";

export const DialogContext = createContext(null);

export function useDialog() {
  return useContext(DialogContext);
}
