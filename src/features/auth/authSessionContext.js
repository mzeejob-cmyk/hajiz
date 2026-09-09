import { createContext, useContext } from "react"

export const AuthSessionContext = createContext(Object.freeze({ status: "checking", user: null, retry() {} }))

export function useAuthSession() {
  return useContext(AuthSessionContext)
}
