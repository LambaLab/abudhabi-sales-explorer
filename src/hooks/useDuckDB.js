import { useState, useEffect } from 'react'
import { getDB } from '../utils/db'

export function useDuckDB() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    getDB()
      .then(() => setReady(true))
      .catch(err => setError(err.message))
  }, [])

  return { ready, error }
}
