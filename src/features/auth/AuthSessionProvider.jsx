import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { authSessionDataSource } from "../../services/authSessionDataSource.js"
import { AuthSessionContext } from "./authSessionContext.js"
import { createSessionRequestGuard } from "./sessionRequestGuard.js"

export function AuthSessionProvider({ children, dataSource = authSessionDataSource }) {
  const [state, setState] = useState({ status: "checking", user: null })
  const guard = useRef(null)
  const check = useCallback(() => {
    const requestGuard = guard.current
    if (!requestGuard) return
    const token = requestGuard.begin()
    setState({ status: "checking", user: null })
    dataSource.getCurrentUser()
      .then(user => { if (requestGuard.accepts(token)) setState({ status: user ? "signed_in" : "signed_out", user }) })
      .catch(() => { if (requestGuard.accepts(token)) setState({ status: "error", user: null }) })
  }, [dataSource])
  useEffect(() => {
    const requestGuard = createSessionRequestGuard()
    guard.current = requestGuard
    const initialToken = requestGuard.begin()
    let unsubscribe
    try {
      unsubscribe = dataSource.subscribe(user => {
        requestGuard.invalidate()
        setState({ status: user ? "signed_in" : "signed_out", user })
      })
    } catch {
      requestGuard.invalidate()
      setState({ status: "error", user: null })
      return () => { requestGuard.stop(); if (guard.current === requestGuard) guard.current = null }
    }
    dataSource.getCurrentUser()
      .then(user => { if (requestGuard.accepts(initialToken)) setState({ status: user ? "signed_in" : "signed_out", user }) })
      .catch(() => { if (requestGuard.accepts(initialToken)) setState({ status: "error", user: null }) })
    return () => { requestGuard.stop(); if (guard.current === requestGuard) guard.current = null; unsubscribe() }
  }, [dataSource])
  const value = useMemo(() => Object.freeze({ ...state, retry: check }), [state, check])
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}
