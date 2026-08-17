import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { ArrowLeft, BarChart3, HandCoins } from 'lucide-react'
import App from './App'
import Loans from './Loans'
import VariableAnalysis from './VariableAnalysis'
import ReportActions from './ReportActions'
import { supabase } from './supabase'
import './styles.css'

function Root() {
  const initialRoute = window.location.hash === '#verliehen'
    ? 'loans'
    : window.location.hash === '#auswertung'
      ? 'analysis'
      : 'app'

  const [session, setSession] = useState(null)
  const [route, setRoute] = useState(initialRoute)

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setSession(data.session || null))
    const { data: listener } = supabase?.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession)) || { data:null }
    const onHash = () => {
      if (window.location.hash === '#verliehen') setRoute('loans')
      else if (window.location.hash === '#auswertung') setRoute('analysis')
      else setRoute('app')
    }
    window.addEventListener('hashchange', onHash)
    return () => {
      listener?.subscription?.unsubscribe()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  function openLoans() {
    window.location.hash = 'verliehen'
  }

  function openAnalysis() {
    window.location.hash = 'auswertung'
  }

  function back() {
    history.replaceState(null, '', window.location.pathname + window.location.search)
    setRoute('app')
  }

  if (route === 'loans' && session) {
    return <div className="loans-page">
      <header className="loans-page-head">
        <div className="loans-page-brand">
          <img src="/finanzapp-icon-512.png" alt="FinanzBlick" />
          <div><strong>FinanzBlick</strong><small>Verliehenes Geld</small></div>
        </div>
        <button className="ghost" onClick={back}><ArrowLeft size={18}/> Zurück</button>
      </header>
      <main className="loans-page-content">
        <p className="eyebrow">Persönliche Finanzübersicht</p>
        <h1>Verliehenes Geld</h1>
        <div style={{height:18}} />
        <Loans />
      </main>
      <ReportActions />
    </div>
  }

  if (route === 'analysis' && session) {
    return <div className="loans-page">
      <header className="loans-page-head">
        <div className="loans-page-brand">
          <img src="/finanzapp-icon-512.png" alt="FinanzBlick" />
          <div><strong>FinanzBlick</strong><small>Variable Kosten</small></div>
        </div>
        <button className="ghost" onClick={back}><ArrowLeft size={18}/> Zurück</button>
      </header>
      <main className="loans-page-content">
        <p className="eyebrow">Persönliche Finanzübersicht</p>
        <h1>Auswertung variable Kosten</h1>
        <div style={{height:18}} />
        <VariableAnalysis />
      </main>
      <ReportActions />
    </div>
  }

  return <>
    <App />
    {session && <>
      <ReportActions />
      <div className="finance-shortcuts">
        <button className="analysis-shortcut" onClick={openAnalysis} title="Variable Kosten auswerten"><BarChart3 size={20}/><span>Auswertung</span></button>
        <button className="loan-shortcut" onClick={openLoans} title="Verliehenes Geld öffnen"><HandCoins size={20}/><span>Verliehen</span></button>
      </div>
    </>}
  </>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
