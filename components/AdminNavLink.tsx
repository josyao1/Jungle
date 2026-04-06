'use client'

/**
 * AdminNavLink — Only renders the Admin nav link when 'joshua' is the
 * selected player in localStorage. Hidden for everyone else.
 */

import { useState, useEffect } from 'react'

export default function AdminNavLink() {
  const [isJoshua, setIsJoshua] = useState(false)

  useEffect(() => {
    const check = () => setIsJoshua(localStorage.getItem('jungle_player') === 'joshua')
    check()
    // Re-check when storage changes (e.g., switching players in another tab)
    window.addEventListener('storage', check)
    return () => window.removeEventListener('storage', check)
  }, [])

  if (!isJoshua) return null

  return (
    <a href="/admin" className="text-slate-500 hover:text-slate-300 transition-colors">
      Admin
    </a>
  )
}
